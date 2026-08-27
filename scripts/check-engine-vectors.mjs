// SPDX-License-Identifier: Apache-2.0

import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import { encodeFrame } from "../packages/engine/dist/esm/framing/frame-encoder.js";
import { buildEvidenceFrame } from "../packages/engine/dist/esm/framing/frame-builders.js";
import { hashBytes } from "../packages/engine/dist/esm/hashing/hash-adapter.js";
import { DEFAULT_LIMITS } from "../packages/engine/dist/esm/domain/limits.js";
import { digestEvidence } from "../packages/engine/dist/esm/evidence/digest-evidence.js";
import { jcsProfile } from "../packages/engine/dist/esm/normalization/jcs-profile.js";
import { normalizeToBytes } from "../packages/engine/dist/esm/normalization/normalize.js";

const root = resolve(import.meta.dirname, "..");
const files = ["evidence.json", "framing.json", "hashing.json", "invalid.json"];
let checked = 0;

for (const file of files) {
  const document = JSON.parse(await readFile(resolve(root, "vectors", file), "utf8"));
  for (const vector of document.cases) {
    if (vector.kind === "invalid") {
      if (vector.expectedCode === "DIGEST_ENCODING_INVALID") {
        assertInvalidHexFixture(vector);
        checked += 1;
        continue;
      }
      const result = encodeFrame(toFrameInput(vector.frame), DEFAULT_LIMITS);
      if (result.ok || result.diagnostics[0]?.code !== vector.expectedCode) {
        throw new Error(`Engine unexpectedly accepted invalid vector: ${vector.id}`);
      }
      checked += 1;
      continue;
    }
    if (vector.kind === "hashing") {
      const result = hashBytes(vector.algorithm, hexToBytes(vector.inputHex), DEFAULT_LIMITS);
      assertSuccess(result, vector.id);
      if (result.value.toHex() !== vector.expectedDigest)
        throw new Error(`Engine digest mismatch: ${vector.id}`);
      checked += 1;
      continue;
    }
    if (vector.kind === "evidence") {
      const normalized = normalizeToBytes(jcsProfile, vector.evidence, DEFAULT_LIMITS);
      assertSuccess(normalized, vector.id);
      if (bytesToHex(normalized.value.bytes) !== vector.expectedJcsHex)
        throw new Error(`Engine evidence JCS mismatch: ${vector.id}`);
      const frame = buildEvidenceFrame(
        {
          algorithm: vector.algorithm,
          schemaUrn: vector.evidence.$schema,
          evidenceJcsBytes: normalized.value.bytes,
        },
        DEFAULT_LIMITS,
      );
      assertSuccess(frame, vector.id);
      if (bytesToHex(frame.value) !== vector.expectedFrameHex)
        throw new Error(`Engine evidence frame mismatch: ${vector.id}`);
      const digest = digestEvidence(vector.evidence, DEFAULT_LIMITS);
      assertSuccess(digest, vector.id);
      if (digest.value.toHex() !== vector.expectedDigest)
        throw new Error(`Engine evidence digest mismatch: ${vector.id}`);
      checked += 1;
      continue;
    }
    const frame = encodeFrame(toFrameInput(vector.frame), DEFAULT_LIMITS);
    assertSuccess(frame, vector.id);
    if (bytesToHex(frame.value) !== vector.expectedFrameHex)
      throw new Error(`Engine frame mismatch: ${vector.id}`);
    const digest = hashBytes(vector.algorithm, frame.value, DEFAULT_LIMITS);
    assertSuccess(digest, vector.id);
    if (digest.value.toHex() !== vector.expectedDigest)
      throw new Error(`Engine frame digest mismatch: ${vector.id}`);
    checked += 1;
  }
}

console.log(`Engine implementation validated ${checked} published vectors.`);

function toFrameInput(frame) {
  return {
    kind: frame.kind,
    fields: frame.fields.map((field) => {
      if (field.type === "bytes")
        return { tag: field.tag, type: "bytes", value: hexToBytes(field.value, field.repeat) };
      if (field.type === "none")
        return "value" in field
          ? { tag: field.tag, type: "none", value: field.value }
          : { tag: field.tag, type: "none" };
      return { tag: field.tag, type: field.type, value: field.value };
    }),
  };
}

function assertInvalidHexFixture(vector) {
  const fields = vector.frame?.fields;
  const field = Array.isArray(fields)
    ? fields.find((candidate) => candidate?.type === "bytes")
    : undefined;
  if (
    typeof field?.value !== "string" ||
    /^(?:[0-9a-f]{2})+$/u.test(field.value) ||
    vector.expectedCode !== "DIGEST_ENCODING_INVALID"
  ) {
    throw new Error(`Invalid hex fixture was not rejected: ${vector.id}`);
  }
}

function hexToBytes(value, repeat = 1) {
  if (value.length % 2 !== 0) throw new Error("odd hex in vector");
  const unit = new Uint8Array(value.length / 2);
  for (let index = 0; index < unit.length; index += 1)
    unit[index] = Number.parseInt(value.slice(index * 2, index * 2 + 2), 16);
  const output = new Uint8Array(unit.length * repeat);
  for (let index = 0; index < repeat; index += 1) output.set(unit, index * unit.length);
  return output;
}

function bytesToHex(value) {
  return Buffer.from(value).toString("hex");
}

function assertSuccess(result, id) {
  if (!result.ok)
    throw new Error(`Engine vector failed: ${id}: ${result.diagnostics[0]?.code ?? "unknown"}`);
}
