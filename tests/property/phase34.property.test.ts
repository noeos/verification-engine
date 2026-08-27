// SPDX-License-Identifier: Apache-2.0

import assert from "node:assert/strict";
import { test } from "node:test";

import fc from "fast-check";

import { DEFAULT_LIMITS } from "../../packages/engine/dist/esm/domain/limits.js";
import { hashBytes, hashChunks } from "../../packages/engine/dist/esm/hashing/hash-adapter.js";
import { jcsProfile } from "../../packages/engine/dist/esm/normalization/jcs-profile.js";
import { normalizeToBytes } from "../../packages/engine/dist/esm/normalization/normalize.js";
import { encodeFrame } from "../../packages/engine/dist/esm/framing/frame-encoder.js";
import { parseFrame } from "../../packages/engine/dist/esm/framing/frame-parser.js";

void test("phase 3 properties preserve input bytes and normalization determinism", () => {
  fc.assert(
    fc.property(fc.uint8Array({ maxLength: 4096 }), (input) => {
      const original = Uint8Array.from(input);
      const firstValue = resultValue(
        normalizeToBytes(jcsProfile, { bytes: Array.from(input) }, DEFAULT_LIMITS),
        isNormalizedBytes,
      );
      const secondValue = resultValue(
        normalizeToBytes(jcsProfile, { bytes: Array.from(input) }, DEFAULT_LIMITS),
        isNormalizedBytes,
      );
      assert.deepEqual(firstValue.bytes, secondValue.bytes);
      assert.deepEqual(input, original);
    }),
    { numRuns: 300 },
  );
});

void test("phase 4 properties preserve hash chunking invariance", () => {
  fc.assert(
    fc.property(fc.uint8Array({ maxLength: 4096 }), (input) => {
      const single = hashBytes("sha-256", input, DEFAULT_LIMITS);
      const split = Math.floor(input.length / 2);
      const chunked = hashChunks(
        "sha-256",
        [input.subarray(0, split), input.subarray(split)],
        DEFAULT_LIMITS,
      );
      const singleValue = resultValue(single, isDigestLike);
      const chunkedValue = resultValue(chunked, isDigestLike);
      assert.equal(singleValue.toHex(), chunkedValue.toHex());
      assert.deepEqual(input, Uint8Array.from(input));
    }),
    { numRuns: 300 },
  );
});

void test("phase 4 properties preserve frame round trips for arbitrary payloads", () => {
  fc.assert(
    fc.property(fc.uint8Array({ maxLength: 4096 }), (payload) => {
      const encoded = encodeFrame(
        {
          kind: "content",
          fields: [
            { tag: 1, type: "utf8", value: "sha-256" },
            { tag: 2, type: "utf8", value: "dev.noeos.raw-bytes" },
            { tag: 3, type: "utf8", value: "1.0.0" },
            { tag: 4, type: "bytes", value: payload },
          ],
        },
        DEFAULT_LIMITS,
      );
      const encodedValue = resultValue(encoded, isByteArray);
      const repeated = encodeFrame(
        {
          kind: "content",
          fields: [
            { tag: 1, type: "utf8", value: "sha-256" },
            { tag: 2, type: "utf8", value: "dev.noeos.raw-bytes" },
            { tag: 3, type: "utf8", value: "1.0.0" },
            { tag: 4, type: "bytes", value: payload },
          ],
        },
        DEFAULT_LIMITS,
      );
      const repeatedValue = resultValue(repeated, isByteArray);
      assert.deepEqual(encodedValue, repeatedValue);
      const parsed = resultValue(parseFrame(encodedValue, DEFAULT_LIMITS), isParsedFrame);
      assert.deepEqual(parsed.fields[3], { tag: 4, type: "bytes", value: payload });
    }),
    { numRuns: 250 },
  );
});

function resultValue<T>(result: unknown, guard: (value: unknown) => value is T): T {
  if (!isRecord(result) || result["ok"] !== true || !guard(result["value"])) {
    throw new Error("property test received an unexpected operation result");
  }
  return result["value"];
}

function isNormalizedBytes(value: unknown): value is { bytes: Uint8Array } {
  return isRecord(value) && value["bytes"] instanceof Uint8Array;
}

function isDigestLike(value: unknown): value is { toHex(): string } {
  return isRecord(value) && typeof value["toHex"] === "function";
}

function isByteArray(value: unknown): value is Uint8Array {
  return value instanceof Uint8Array;
}

function isParsedFrame(value: unknown): value is { fields: readonly unknown[] } {
  return isRecord(value) && Array.isArray(value["fields"]);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
