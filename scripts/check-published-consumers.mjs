// SPDX-License-Identifier: Apache-2.0

import { mkdir, mkdtemp, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { delimiter, resolve } from "node:path";

import { assertProjectRoot, projectRoot, run, runNpm, stableJson } from "./project.mjs";

await assertProjectRoot();

const version = process.env.NOEOS_RELEASE_VERSION;
if (typeof version !== "string" || version.length === 0) {
  throw new Error("NOEOS_RELEASE_VERSION is required");
}

const packages = ["@noeos/verification-engine", "@noeos/verification-engine-cli"];
const root = await mkdtemp(resolve(tmpdir(), "noeos-published-consumer-"));

try {
  const archives = [];
  for (const packageName of packages) {
    runNpm(["pack", "--silent", `${packageName}@${version}`, "--pack-destination", root]);
    const names = (await readdir(root)).filter((name) => name.endsWith(".tgz"));
    const archive = names.find((name) => name.startsWith(packageName.slice(1).replace("/", "-")));
    if (archive === undefined) {
      throw new Error(`npm pack did not produce an archive for ${packageName}@${version}`);
    }
    archives.push(resolve(root, archive));
  }

  const consumer = resolve(root, "consumer");
  await mkdir(consumer, { recursive: true });
  await writeFile(
    resolve(consumer, "package.json"),
    stableJson({ name: "noeos-published-consumer", private: true, type: "module" }),
    "utf8",
  );
  runNpm([
    "install",
    "--prefix",
    consumer,
    "--no-save",
    "--package-lock=false",
    "--ignore-scripts",
    "--no-audit",
    "--no-fund",
    ...archives,
  ]);
  runNpm(["audit", "signatures", "--prefix", consumer, "--omit=optional"]);

  const esm = resolve(consumer, "esm.mjs");
  await writeFile(
    esm,
    'import { DIAGNOSTIC_CODES, createEngine } from "@noeos/verification-engine";\nif (typeof createEngine !== "function" || DIAGNOSTIC_CODES.length !== 64) process.exit(1);\n',
    "utf8",
  );
  run(process.execPath, [esm], { cwd: consumer });

  const common = resolve(consumer, "common.cjs");
  await writeFile(
    common,
    'const engine = require("@noeos/verification-engine");\nif (typeof engine.createEngine !== "function" || engine.DIAGNOSTIC_CODES.length !== 64) process.exit(1);\n',
    "utf8",
  );
  run(process.execPath, [common], { cwd: consumer });

  const types = resolve(consumer, "consumer.ts");
  await writeFile(
    types,
    'import { DIAGNOSTIC_CODES, type DiagnosticCode } from "@noeos/verification-engine";\nconst code: DiagnosticCode = DIAGNOSTIC_CODES[0].code;\nvoid code;\n',
    "utf8",
  );
  const tsconfig = resolve(consumer, "tsconfig.json");
  await writeFile(
    tsconfig,
    stableJson({
      compilerOptions: {
        module: "NodeNext",
        moduleResolution: "NodeNext",
        noEmit: true,
        strict: true,
        target: "ES2022",
      },
      include: ["consumer.ts"],
    }),
    "utf8",
  );
  run(
    process.execPath,
    [resolve(projectRoot, "node_modules/typescript/bin/tsc"), "--project", tsconfig],
    {
      cwd: consumer,
      env: {
        ...process.env,
        PATH: `${resolve(projectRoot, "node_modules/.bin")}${delimiter}${process.env.PATH ?? ""}`,
      },
    },
  );

  const cli = resolve(consumer, "node_modules/.bin/noeos-ve");
  const versionOutput = run(cli, ["version", "--output", "json"], { cwd: consumer, capture: true });
  const versionJson = JSON.parse(versionOutput);
  if (versionJson.value?.version !== version) throw new Error("CLI version output is incorrect");
  const vectorsOutput = run(cli, ["vectors", "verify", "--output", "json"], {
    cwd: consumer,
    capture: true,
  });
  if (JSON.parse(vectorsOutput).ok !== true) throw new Error("CLI vector fixture failed");

  for (const packageName of packages) {
    const declaration = packageName.endsWith("-cli")
      ? "dist/types/main.d.ts"
      : "dist/types/index.d.ts";
    run(process.execPath, [
      "--input-type=module",
      "-e",
      `import { access } from "node:fs/promises"; await access(process.argv[1]);`,
      resolve(consumer, "node_modules", packageName, declaration),
    ]);
  }
} finally {
  await rm(root, { force: true, recursive: true });
}

console.log(`Published consumer verification passed for ${version}.`);
