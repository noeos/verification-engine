// SPDX-License-Identifier: Apache-2.0

import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

import { DEFAULT_LIMITS } from "../packages/engine/dist/esm/domain/limits.js";
import { parseJsonText } from "../packages/engine/dist/esm/validation/json-text-parser.js";
import { parseFrame } from "../packages/engine/dist/esm/framing/frame-parser.js";
import { jcsProfile } from "../packages/engine/dist/esm/normalization/jcs-profile.js";
import { normalizeToBytes } from "../packages/engine/dist/esm/normalization/normalize.js";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const corpus = JSON.parse(
  await readFile(resolve(projectRoot, "tests/fuzz/phase34-seeds.json"), "utf8"),
);
const seconds = parseSeconds(process.env.NOEOS_FUZZ_SECONDS);
const deadline = Date.now() + seconds * 1000;

function parseSeconds(value) {
  if (value === undefined) return 60;
  const secondsValue = Number(value);
  if (!Number.isSafeInteger(secondsValue) || secondsValue < 1 || secondsValue > 3600) {
    throw new Error("NOEOS_FUZZ_SECONDS must be an integer between 1 and 3600");
  }
  return secondsValue;
}

await Promise.all([
  runTarget("json", fuzzJson),
  runTarget("frame", fuzzFrame),
  runTarget("jcs", fuzzJcs),
]);

async function runTarget(name, target) {
  let seed = hashSeed(name);
  let iterations = 0;
  while (Date.now() < deadline) {
    seed = next(seed);
    target(seed, iterations);
    iterations += 1;
    if ((iterations & 0x3ff) === 0) await Promise.resolve();
  }
  if (iterations === 0) throw new Error(`Fuzz target ${name} did not execute`);
  process.stdout.write(`Fuzz target ${name}: ${iterations} iterations\n`);
}

function fuzzJson(seed, iteration) {
  const base = corpus.json[seed % corpus.json.length];
  const suffix = iteration % 5 === 0 ? " " : String.fromCharCode(0x20 + (seed % 0x5f));
  const input = iteration % 3 === 0 ? base : `${base}${suffix}`;
  assertResult(parseJsonText(input, DEFAULT_LIMITS));
}

function fuzzFrame(seed, iteration) {
  const base = corpus.frames[seed % corpus.frames.length];
  const bytes = hexToBytes(base);
  if (bytes.length > 0 && iteration % 2 === 0) bytes[seed % bytes.length] ^= seed & 0xff;
  assertResult(parseFrame(bytes, DEFAULT_LIMITS));
}

function fuzzJcs(seed, iteration) {
  const value = corpus.jcs[seed % corpus.jcs.length];
  const candidate = iteration % 4 === 0 ? value : { value, seed: seed % 1000 };
  assertResult(normalizeToBytes(jcsProfile, candidate, DEFAULT_LIMITS));
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

function hashSeed(value) {
  let output = 0x811c9dc5;
  for (const character of value)
    output = Math.imul(output ^ character.charCodeAt(0), 0x01000193) >>> 0;
  return output;
}

function next(value) {
  let output = value ^ (value << 13);
  output ^= output >>> 17;
  output ^= output << 5;
  return output >>> 0;
}
