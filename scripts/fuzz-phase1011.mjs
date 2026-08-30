// SPDX-License-Identifier: Apache-2.0

import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { DEFAULT_LIMITS } from "../packages/engine/dist/esm/domain/limits.js";
import { ChainBuilder } from "../packages/engine/dist/esm/chains/chain-builder.js";
import { verifyChain } from "../packages/engine/dist/esm/chains/verify-chain.js";
import { digestEvidence } from "../packages/engine/dist/esm/evidence/digest-evidence.js";
import { parseEvidenceText } from "../packages/engine/dist/esm/evidence/evidence-parser.js";
import { ProfileRegistry } from "../packages/engine/dist/esm/normalization/profile-registry.js";
import { normalizeToBytes } from "../packages/engine/dist/esm/normalization/normalize.js";
import { jcsProfile } from "../packages/engine/dist/esm/normalization/jcs-profile.js";
import { parseFrame } from "../packages/engine/dist/esm/framing/frame-parser.js";
import { parseJsonText } from "../packages/engine/dist/esm/validation/json-text-parser.js";
import { parseNdjson } from "../packages/cli/dist/esm/io/json-input.js";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const corpus = JSON.parse(
  await readFile(resolve(projectRoot, "tests/fuzz/phase34-seeds.json"), "utf8"),
);
const targetNames = ["json", "ndjson", "frame", "jcs", "evidence", "chain"];
const requestedTarget = process.env.NOEOS_FUZZ_TARGET;
const targets = requestedTarget === undefined ? targetNames : [requestedTarget];
if (targets.some((target) => !targetNames.includes(target))) {
  throw new Error(`NOEOS_FUZZ_TARGET must be one of: ${targetNames.join(", ")}`);
}
const seconds = parseInteger(process.env.NOEOS_FUZZ_SECONDS, 60, 3600);
const initialSeed = parseInteger(process.env.NOEOS_FUZZ_SEED, 0x9e3779b9, 0xffffffff);
const deadline = Date.now() + seconds * 1000;
const engineOptions = Object.freeze({ limits: DEFAULT_LIMITS, profiles: new ProfileRegistry() });
const chain = makeChain();

await Promise.all(targets.map((target, index) => runTarget(target, initialSeed + index)));

async function runTarget(name, seed) {
  let iterations = 0;
  while (Date.now() < deadline) {
    seed = next(seed);
    await runCase(name, seed >>> 0, iterations);
    iterations += 1;
    if ((iterations & 0x3ff) === 0) await Promise.resolve();
  }
  if (iterations === 0) throw new Error(`Fuzz target ${name} did not execute`);
  process.stdout.write(`Fuzz target ${name}: ${iterations} iterations\n`);
}

async function runCase(name, seed, iteration) {
  switch (name) {
    case "json":
      assertResult(
        parseJsonText(mutateText(corpus.json[seed % corpus.json.length], seed), DEFAULT_LIMITS),
      );
      return;
    case "ndjson":
      await fuzzNdjson(seed, iteration);
      return;
    case "frame":
      fuzzFrame(seed, iteration);
      return;
    case "jcs":
      assertResult(normalizeToBytes(jcsProfile, fuzzValue(seed), DEFAULT_LIMITS));
      return;
    case "evidence":
      fuzzEvidence(seed);
      return;
    case "chain":
      fuzzChain(seed, iteration);
      return;
    default:
      throw new Error(`Unhandled fuzz target ${name}`);
  }
}

async function fuzzNdjson(seed, iteration) {
  const base = `${mutateText(corpus.json[seed % corpus.json.length], seed)}\n`;
  const chunks = [...base].map((character, index) =>
    index % 3 === seed % 3 ? character : `${character}${iteration % 5 === 0 ? "" : " "}`,
  );
  try {
    const values = parseNdjson(
      (async function* input() {
        for (const chunk of chunks) yield new TextEncoder().encode(chunk);
      })(),
      { maxBytes: 1024, maxDepth: 64, maxObjectProperties: 100, maxArrayElements: 100 },
    );
    await consume(values);
  } catch (error) {
    if (!(error instanceof Error)) throw error;
  }
}

async function consume(values) {
  for await (const value of values) void value;
}

function fuzzFrame(seed, iteration) {
  const base = corpus.frames[seed % corpus.frames.length];
  const bytes = hexToBytes(base);
  if (bytes.length > 0 && iteration % 2 === 0) bytes[seed % bytes.length] ^= seed & 0xff;
  assertResult(parseFrame(bytes, DEFAULT_LIMITS));
}

function fuzzEvidence(seed) {
  const evidence = chain[seed % chain.length];
  const candidate = seed % 2 === 0 ? evidence : { ...evidence, position: evidence.position + 1 };
  assertResult(parseEvidenceText(JSON.stringify(candidate), DEFAULT_LIMITS));
  assertResult(digestEvidence(candidate, DEFAULT_LIMITS));
}

function fuzzChain(seed, iteration) {
  const evidence = chain[seed % chain.length];
  const result = verifyChain(
    {
      contextId: "fuzz.context",
      sequenceId: "fuzz.sequence",
      profile: { id: "dev.noeos.jcs", version: "1.0.0" },
      algorithm: "sha-256",
      mode: "internal",
      records: [
        { payload: { value: iteration % 2 === 0 ? evidence.position : seed % 1000 }, evidence },
      ],
    },
    engineOptions,
  );
  if (
    result === null ||
    typeof result !== "object" ||
    !["valid", "invalid", "indeterminate", "aborted"].includes(result.status)
  ) {
    throw new Error("chain fuzz returned a malformed verification result");
  }
}

function fuzzValue(seed) {
  switch (seed % 8) {
    case 0:
      return null;
    case 1:
      return seed % 2 === 0;
    case 2:
      return seed % 1000;
    case 3:
      return `unicode-😀-${seed}`;
    case 4:
      return [null, seed, true, "value"];
    case 5:
      return { b: seed, a: { nested: [null, true] } };
    case 6:
      return { [`key-${seed}`]: "x".repeat(seed % 64) };
    default:
      return { depth: { value: seed % 10 } };
  }
}

function mutateText(value, seed) {
  if (typeof value !== "string" || value.length === 0) return String(value);
  const index = seed % value.length;
  const replacement = seed % 4 === 0 ? " " : String.fromCharCode(0x20 + (seed % 0x5f));
  return `${value.slice(0, index)}${replacement}${value.slice(index + 1)}`;
}

function makeChain() {
  const created = ChainBuilder.create(
    {
      contextId: "fuzz.context",
      sequenceId: "fuzz.sequence",
      profile: { id: "dev.noeos.jcs", version: "1.0.0" },
      algorithm: "sha-256",
    },
    engineOptions,
  );
  if (!created.ok) throw new Error("fuzz chain setup failed");
  const first = created.value.append({
    recordId: "fuzz-0",
    payload: { value: 0 },
    position: 0,
    previous: { kind: "none" },
  });
  if (!first.ok) throw new Error("fuzz chain setup failed");
  const second = created.value.append({
    recordId: "fuzz-1",
    payload: { value: 1 },
    position: 1,
    previous: { kind: "digest", value: first.value.linkDigest },
  });
  if (!second.ok) throw new Error("fuzz chain setup failed");
  return [first.value, second.value];
}

function assertResult(result) {
  if (result === null || typeof result !== "object" || typeof result.ok !== "boolean") {
    throw new Error("fuzz target returned a malformed operation result");
  }
}

function hexToBytes(value) {
  if (!/^(?:[0-9a-f]{2})*$/u.test(value)) throw new Error("invalid fuzz corpus hex");
  const bytes = new Uint8Array(value.length / 2);
  for (let index = 0; index < bytes.length; index += 1) {
    bytes[index] = Number.parseInt(value.slice(index * 2, index * 2 + 2), 16);
  }
  return bytes;
}

function parseInteger(value, fallback, maximum) {
  if (value === undefined) return fallback;
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 1 || parsed > maximum) {
    throw new Error("invalid fuzz numeric option");
  }
  return parsed;
}

function next(value) {
  let output = value ^ (value << 13);
  output ^= output >>> 17;
  output ^= output << 5;
  return output >>> 0;
}
