// SPDX-License-Identifier: Apache-2.0

import { cp, mkdtemp, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const mutants = [
  {
    name: "duplicate-json-keys",
    file: "packages/engine/src/validation/json-text-parser.ts",
    from: 'if (names.has(key)) this.fail("JSON_DUPLICATE_KEY", `${path}/${escapeJsonPointer(key)}`);',
    to: 'if (!names.has(key)) this.fail("JSON_DUPLICATE_KEY", `${path}/${escapeJsonPointer(key)}`);',
  },
  {
    name: "jcs-object-order",
    file: "packages/engine/src/normalization/jcs-profile.ts",
    from: "const keys = Object.keys(value).sort(compareUtf16);",
    to: "const keys = Object.keys(value);",
  },
  {
    name: "frame-trailing-data",
    file: "packages/engine/src/framing/frame-parser.ts",
    from: 'if (offset !== input.length) return frameFailure("FRAME_TRAILING_DATA", limits);',
    to: 'if (offset === input.length) return frameFailure("FRAME_TRAILING_DATA", limits);',
  },
  {
    name: "frame-field-order",
    file: "packages/engine/src/framing/frame-encoder.ts",
    from: 'if (field.tag < previousTag) return frameFailure("FRAME_FIELD_ORDER_INVALID", limits);',
    to: 'if (field.tag > previousTag) return frameFailure("FRAME_FIELD_ORDER_INVALID", limits);',
  },
  {
    name: "digest-length",
    file: "packages/engine/src/validation/digest-validation.ts",
    from: "if (value.length !== expectedLength)",
    to: "if (value.length === expectedLength)",
  },
  {
    name: "raw-byte-budget",
    file: "packages/engine/src/normalization/raw-bytes-profile.ts",
    from: "if (input.length > limits.maxPayloadBytes)",
    to: "if (input.length >= limits.maxPayloadBytes)",
  },
  {
    name: "complete-boundary-count",
    file: "packages/engine/src/chains/verify-chain.ts",
    from: "const countVerified = config.expectedCount !== undefined && config.expectedCount === count;",
    to: "const countVerified = config.expectedCount === undefined || config.expectedCount === count;",
  },
  {
    name: "link-previous-digest",
    file: "packages/engine/src/chains/verify-chain.ts",
    from: "...(previous === undefined ? {} : { previousLinkDigest: previous.value }),",
    to: "...(previous === undefined ? { previousLinkDigest: previous?.value } : {}),",
  },
  {
    name: "rule-order",
    critical: true,
    file: "packages/engine/src/rules/rule-set.ts",
    from: "rules.sort(\n      (left, right) => compareText(left.id, right.id) || compareText(left.version, right.version),\n    );",
    to: "rules.sort(\n      (left, right) => compareText(right.id, left.id) || compareText(right.version, left.version),\n    );",
  },
  {
    name: "raw-byte-ownership",
    critical: true,
    file: "packages/engine/src/normalization/raw-bytes-profile.ts",
    from: "return success(input);",
    to: "return success(new Uint8Array(0));",
  },
  {
    name: "trusted-content-kind",
    critical: true,
    file: "packages/engine/src/framing/frame-builders.ts",
    from: 'kind: "content",\n      fields: [\n        { tag: 1, type: "utf8", value: input.algorithm },',
    to: 'kind: "record",\n      fields: [\n        { tag: 1, type: "utf8", value: input.algorithm },',
  },
  {
    name: "digest-hex-nibble",
    critical: true,
    file: "packages/engine/src/domain/digest.ts",
    from: "HEX.charAt(byte >>> 4) + HEX.charAt(byte & 0x0f)",
    to: "HEX.charAt(byte & 0x0f) + HEX.charAt(byte & 0x0f)",
  },
  {
    name: "normalization-length-guard",
    critical: true,
    file: "packages/engine/src/normalization/normalize.ts",
    from: "if (normalized.value.byteLength !== sink.byteLength) return normalizationFailure(limits);\n    const bytes = sink.toBytes();",
    to: "if (normalized.value.byteLength === sink.byteLength) return normalizationFailure(limits);\n    const bytes = sink.toBytes();",
  },
  {
    name: "chain-position-step",
    critical: true,
    file: "packages/engine/src/chains/chain-builder.ts",
    from: "this.nextPosition += 1;",
    to: "this.nextPosition += 2;",
  },
  {
    name: "duplicate-full-limit",
    critical: true,
    file: "packages/engine/src/chains/duplicate-detector.ts",
    from: "this.queue.length >= this.policy.maxRecords",
    to: "this.queue.length > this.policy.maxRecords",
  },
  {
    name: "diagnostic-order-phase",
    critical: false,
    file: "packages/engine/src/validation/diagnostic-collector.ts",
    from: "compareText(left.phase, right.phase)",
    to: "compareText(right.phase, left.phase)",
  },
];

const results = [];
for (const mutant of mutants) {
  const source = await readFile(resolve(projectRoot, mutant.file), "utf8");
  const occurrences = source.split(mutant.from).length - 1;
  if (occurrences !== 1)
    throw new Error(`Mutation ${mutant.name} matched ${occurrences} locations`);
}
for (const mutant of mutants) results.push(await evaluateMutant(mutant));
const killed = results.filter((result) => result.killed).length;
const score = killed / results.length;
const criticalResults = results.filter(
  (result) => mutants.find((mutant) => mutant.name === result.name)?.critical !== false,
);
const criticalKilled = criticalResults.filter((result) => result.killed).length;
const criticalScore = criticalKilled / criticalResults.length;
for (const result of results)
  process.stdout.write(`${result.killed ? "KILLED" : "SURVIVED"} ${result.name}\n`);
process.stdout.write(
  `Mutation score: ${(score * 100).toFixed(2)}% (${killed}/${results.length})\n`,
);
process.stdout.write(
  `Critical mutation score: ${(criticalScore * 100).toFixed(2)}% (${criticalKilled}/${criticalResults.length})\n`,
);
if (score < 0.85) throw new Error("Global mutation score is below 85%");
if (criticalScore < 0.95) throw new Error("Critical mutation score is below 95%");

async function evaluateMutant(mutant) {
  const temporaryRoot = await mkdtemp(join(tmpdir(), "noeos-mutation-"));
  const workingRoot = join(temporaryRoot, "repo");
  try {
    await copyProject(workingRoot);
    const sourcePath = join(workingRoot, mutant.file);
    const source = await readFile(sourcePath, "utf8");
    await writeFile(sourcePath, source.replace(mutant.from, mutant.to), "utf8");
    const build = run(workingRoot, process.execPath, ["scripts/build.mjs"]);
    if (build.status !== 0) return { name: mutant.name, killed: true };
    const compile = run(workingRoot, process.execPath, [
      "node_modules/typescript/bin/tsc",
      "--project",
      "tsconfig.tests.json",
    ]);
    if (compile.status !== 0) return { name: mutant.name, killed: true };
    const tests = run(workingRoot, process.execPath, [".build/tests/tests/index.test.js"]);
    return { name: mutant.name, killed: tests.status !== 0 };
  } finally {
    await rm(temporaryRoot, { recursive: true, force: true });
  }
}

async function copyProject(destination) {
  await cp(projectRoot, destination, {
    recursive: true,
    filter(source) {
      const path = relative(projectRoot, source);
      const components = path.split(sep);
      return !components.some((component) =>
        [
          ".build",
          ".git",
          ".npm",
          "artifacts",
          "coverage",
          "dist",
          "node_modules",
          "temp",
          "tmp",
        ].includes(component),
      );
    },
  });
  await symlink(resolve(projectRoot, "node_modules"), join(destination, "node_modules"), "dir");
}

function run(cwd, command, arguments_ = []) {
  return spawnSync(command, arguments_, {
    cwd,
    encoding: "utf8",
    stdio: "pipe",
    timeout: 120_000,
  });
}
