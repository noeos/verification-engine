// SPDX-License-Identifier: Apache-2.0

import assert from "node:assert/strict";
import { test } from "node:test";

import { DEFAULT_LIMITS, HARD_LIMITS } from "../../packages/engine/dist/esm/domain/limits.js";
import type { Diagnostic } from "../../packages/engine/src/domain/diagnostic.js";
import type { OperationResult } from "../../packages/engine/src/domain/operation-result.js";
import type { NormalizedBytes } from "../../packages/engine/src/normalization/profile.js";
import type {
  NormalizationProfile,
  NormalizationStats,
} from "../../packages/engine/src/normalization/profile.js";
import type { ByteSink } from "../../packages/engine/src/normalization/byte-sink.js";
import type { ParsedFrame } from "../../packages/engine/src/framing/frame-types.js";
import type { Digest } from "../../packages/engine/src/domain/digest.js";
import type { Limits } from "../../packages/engine/src/domain/limits.js";
import type { ProfileVersion } from "../../packages/engine/src/domain/version.js";
import type { ProfileId } from "../../packages/engine/src/domain/identifiers.js";
import type { HashSink } from "../../packages/engine/src/hashing/hash-adapter.js";
import { validateJsonValue } from "../../packages/engine/dist/esm/validation/json-value-validation.js";
import { parseJsonText } from "../../packages/engine/dist/esm/validation/json-text-parser.js";
import {
  validateContextId,
  validateProfileId,
  validateRecordId,
  validateSequenceId,
} from "../../packages/engine/dist/esm/validation/identifier-validation.js";
import {
  validateLimits,
  validateLimitValue,
} from "../../packages/engine/dist/esm/validation/limit-validation.js";
import {
  validateProfileReference,
  validateProfileVersion,
  validateProtocolVersion,
} from "../../packages/engine/dist/esm/validation/version-validation.js";
import { validateAlgorithmId } from "../../packages/engine/dist/esm/validation/algorithm-validation.js";
import {
  validateDigest,
  equalDigest,
} from "../../packages/engine/dist/esm/validation/digest-validation.js";
import {
  encodeUtf8,
  decodeUtf8,
  hasWellFormedUnicode,
} from "../../packages/engine/dist/esm/validation/utf8-validation.js";
import {
  createDiagnostic,
  DiagnosticCollector,
} from "../../packages/engine/dist/esm/validation/diagnostic-collector.js";
import { jcsProfile } from "../../packages/engine/dist/esm/normalization/jcs-profile.js";
import { rawBytesProfile } from "../../packages/engine/dist/esm/normalization/raw-bytes-profile.js";
import { normalizeToBytes } from "../../packages/engine/dist/esm/normalization/normalize.js";
import { ProfileRegistry } from "../../packages/engine/dist/esm/normalization/profile-registry.js";
import {
  buildContentFrame,
  buildEvidenceFrame,
  buildLinkFrame,
  buildRecordFrame,
} from "../../packages/engine/dist/esm/framing/frame-builders.js";
import { encodeFrame } from "../../packages/engine/dist/esm/framing/frame-encoder.js";
import { parseFrame } from "../../packages/engine/dist/esm/framing/frame-parser.js";
import {
  createHashSink,
  hashBytes,
  hashChunks,
} from "../../packages/engine/dist/esm/hashing/hash-adapter.js";
import { hashFrame } from "../../packages/engine/dist/esm/hashing/hash-frame.js";
import { validatePosition } from "../../packages/engine/dist/esm/validation/position-validation.js";
import { ByteArraySink } from "../../packages/engine/dist/esm/normalization/byte-sink.js";
import { inspectExactProperties } from "../../packages/engine/dist/esm/validation/object-inspection.js";

void test("phase 3 rejects hostile JSON values without evaluating accessors", () => {
  const getter = {};
  Object.defineProperty(getter, "secret", { enumerable: true, get: () => "should not run" });
  const cyclic: Record<string, unknown> = {};
  cyclic["self"] = cyclic;
  const proxy = new Proxy(
    {},
    {
      get: () => {
        throw new Error("proxy evaluated");
      },
    },
  );
  const revoked = Proxy.revocable(new Uint8Array([1]), {});
  revoked.revoke();

  assert.equal(code(validateJsonValue(getter, DEFAULT_LIMITS)), "JSON_VALUE_UNSUPPORTED");
  assert.equal(code(validateJsonValue(cyclic, DEFAULT_LIMITS)), "JSON_VALUE_UNSUPPORTED");
  assert.equal(code(validateJsonValue(proxy, DEFAULT_LIMITS)), "JSON_VALUE_UNSUPPORTED");
  assert.equal(code(validateJsonValue(Number.NaN, DEFAULT_LIMITS)), "JSON_NUMBER_UNSAFE");
  assert.equal(code(parseJsonText('{"a":1,"a":2}', DEFAULT_LIMITS)), "JSON_DUPLICATE_KEY");
  assert.equal(code(parseJsonText(new Uint8Array([0xc3, 0x28]), DEFAULT_LIMITS)), "UTF8_INVALID");
  assert.equal(code(parseJsonText(revoked.proxy, DEFAULT_LIMITS)), "JSON_SYNTAX_INVALID");
});

void test("phase 3 fixed-shape inspection preserves descriptor safety", () => {
  assert.deepEqual(inspectExactProperties({ first: 1, second: 2 }, ["first", "second"]), [1, 2]);
  const nullPrototype: Record<string, unknown> = { first: 1, second: 2 };
  Object.setPrototypeOf(nullPrototype, null);
  assert.deepEqual(inspectExactProperties(nullPrototype, ["first", "second"]), [1, 2]);
  assert.equal(inspectExactProperties(null, ["first"]), undefined);
  assert.equal(inspectExactProperties({ first: 1, extra: 2 }, ["first"]), undefined);
  assert.equal(inspectExactProperties({ first: 1, extra: 2 }, ["first", "second"]), undefined);
  const symbol = { first: 1 } as Record<string, unknown>;
  Object.defineProperty(symbol, Symbol("hidden"), { value: true });
  assert.equal(inspectExactProperties(symbol, ["first"]), undefined);
  const hidden = {} as Record<string, unknown>;
  Object.defineProperty(hidden, "first", { value: 1, enumerable: false });
  assert.equal(inspectExactProperties(hidden, ["first"]), undefined);
  const getter = {} as Record<string, unknown>;
  Object.defineProperty(getter, "first", { enumerable: true, get: () => 1 });
  assert.equal(inspectExactProperties(getter, ["first"]), undefined);
  const setter = {} as Record<string, unknown>;
  Object.defineProperty(setter, "first", { enumerable: true, set: () => undefined });
  assert.equal(inspectExactProperties(setter, ["first"]), undefined);
});

void test("phase 3 validators enforce exact identifiers, versions and digest lengths", () => {
  assert.ok(validateContextId("tenant/2026").ok);
  assert.equal(code(validateContextId("bad value")), "IDENTIFIER_INVALID");
  assert.ok(validateProfileId("dev.noeos.jcs").ok);
  assert.equal(code(validateProfileId("dev.noeos.jcs@1.0.0")), "IDENTIFIER_INVALID");
  assert.ok(validateProfileVersion("1.0.0-beta.1+build.7").ok);
  assert.equal(code(validateProfileVersion("v1.0")), "VERSION_INVALID");
  assert.ok(validateDigest("00".repeat(32), "sha-256").ok);
  assert.equal(code(validateDigest("00".repeat(31), "sha-256")), "DIGEST_LENGTH_INVALID");
  assert.equal(code(validateDigest("AA".repeat(32), "sha-256")), "DIGEST_ENCODING_INVALID");
  assert.equal(code(validateDigest("00".repeat(32), "md5")), "ALGORITHM_UNKNOWN");
});

void test("phase 4 raw and JCS profiles produce immutable deterministic bytes", () => {
  const input = new Uint8Array([0, 1, 2, 255]);
  const rawResult: OperationResult<NormalizedBytes> = checkedResult(
    normalizeToBytes(rawBytesProfile, input, DEFAULT_LIMITS),
    isNormalizedBytes,
  );
  const raw = must(rawResult);
  input[0] = 99;
  assert.deepEqual([...raw.bytes], [0, 1, 2, 255]);
  assert.equal(raw.stats.byteLength, 4);
  assert.equal(
    code(
      normalizeToBytes(rawBytesProfile, new Uint8Array([1]), limitsWith({ maxPayloadBytes: 1 })),
    ),
    undefined,
  );

  const firstResult: OperationResult<NormalizedBytes> = checkedResult(
    normalizeToBytes(jcsProfile, { b: 2, a: 1, nested: [true, null] }, DEFAULT_LIMITS),
    isNormalizedBytes,
  );
  const secondResult: OperationResult<NormalizedBytes> = checkedResult(
    normalizeToBytes(jcsProfile, { nested: [true, null], a: 1, b: 2 }, DEFAULT_LIMITS),
    isNormalizedBytes,
  );
  const first = must(firstResult);
  const second = must(secondResult);
  assert.equal(new TextDecoder().decode(first.bytes), '{"a":1,"b":2,"nested":[true,null]}');
  assert.deepEqual(first.bytes, second.bytes);
  const negativeZeroResult: OperationResult<NormalizedBytes> = checkedResult(
    normalizeToBytes(jcsProfile, -0, DEFAULT_LIMITS),
    isNormalizedBytes,
  );
  const escapedResult: OperationResult<NormalizedBytes> = checkedResult(
    normalizeToBytes(jcsProfile, '\u0000\n"\\', DEFAULT_LIMITS),
    isNormalizedBytes,
  );
  assert.equal(new TextDecoder().decode(must(negativeZeroResult).bytes), "0");
  assert.equal(new TextDecoder().decode(must(escapedResult).bytes), '"\\u0000\\n\\"\\\\"');
});

void test("phase 4 profile registry is closed against replacement", () => {
  const registry = new ProfileRegistry();
  assert.equal(code(registry.resolve(jcsProfile.id, jcsProfile.version)), undefined);
  assert.equal(code(registry.register(jcsProfile)), "PROFILE_VERSION_CONFLICT");
  assert.equal(code(registry.resolve(jcsProfile.id, jcsProfile.version)), undefined);
});

void test("phase 4 frames match the published content vector and parse losslessly", () => {
  const frameResult: OperationResult<Uint8Array> = checkedResult(
    encodeFrame(
      {
        kind: "content",
        fields: [
          { tag: 1, type: "utf8", value: "sha-256" },
          { tag: 2, type: "utf8", value: "dev.noeos.raw-bytes" },
          { tag: 3, type: "utf8", value: "1.0.0" },
          { tag: 4, type: "bytes", value: new Uint8Array([0, 1, 2, 255]) },
        ],
      },
      DEFAULT_LIMITS,
    ),
    isByteArray,
  );
  const frame = must(frameResult);
  assert.equal(
    hex(frame),
    "4e4f454f53564531010001000400010200000000000000077368612d32353600020200000000000000136465762e6e6f656f732e7261772d62797465730003020000000000000005312e302e300004010000000000000004000102ff",
  );
  const parsedResult: OperationResult<ParsedFrame> = checkedResult(
    parseFrame(frame, DEFAULT_LIMITS),
    isParsedFrame,
  );
  const parsed = must(parsedResult);
  assert.equal(parsed.kind, "content");
  assert.deepEqual(parsed.fields[3], {
    tag: 4,
    type: "bytes",
    value: new Uint8Array([0, 1, 2, 255]),
  });
  assert.equal(
    code(parseFrame(frame.subarray(0, frame.length - 1), DEFAULT_LIMITS)),
    "FRAME_LENGTH_INVALID",
  );
  assert.equal(
    code(parseFrame(Uint8Array.from([...frame, 0]), DEFAULT_LIMITS)),
    "FRAME_TRAILING_DATA",
  );
  const badMagic = Uint8Array.from(frame);
  badMagic[0] = 0;
  assert.equal(code(parseFrame(badMagic, DEFAULT_LIMITS)), "FRAME_MAGIC_INVALID");
});

void test("phase 4 framing rejects duplicate, order, type and structural errors", () => {
  assert.equal(
    code(
      encodeFrame(
        {
          kind: "content",
          fields: [
            { tag: 1, type: "utf8", value: "a" },
            { tag: 1, type: "utf8", value: "b" },
          ],
        },
        DEFAULT_LIMITS,
      ),
    ),
    "FRAME_FIELD_DUPLICATE",
  );
  assert.equal(
    code(
      encodeFrame(
        {
          kind: "content",
          fields: [
            { tag: 2, type: "utf8", value: "a" },
            { tag: 1, type: "utf8", value: "b" },
          ],
        },
        DEFAULT_LIMITS,
      ),
    ),
    "FRAME_FIELD_ORDER_INVALID",
  );
  assert.equal(
    code(
      encodeFrame(
        { kind: "link", fields: [{ tag: 7, type: "none", value: "invalid" }] },
        DEFAULT_LIMITS,
      ),
    ),
    "FRAME_FIELD_TYPE_INVALID",
  );
  assert.equal(
    code(encodeFrame({ kind: "unknown", fields: [] }, DEFAULT_LIMITS)),
    "FRAME_KIND_UNKNOWN",
  );
});

void test("phase 4 SHA adapters match known digests and chunking invariance", () => {
  const emptyResult: OperationResult<Digest> = checkedResult(
    hashBytes("sha-256", new Uint8Array(0), DEFAULT_LIMITS),
    isDigest,
  );
  const empty256 = must(emptyResult);
  assert.equal(
    empty256.toHex(),
    "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
  );
  const input = new TextEncoder().encode("Noeos verification engine");
  const oneResult: OperationResult<Digest> = checkedResult(
    hashBytes("sha-512", input, DEFAULT_LIMITS),
    isDigest,
  );
  const manyResult: OperationResult<Digest> = checkedResult(
    hashChunks(
      "sha-512",
      [input.subarray(0, 3), input.subarray(3, 8), input.subarray(8)],
      DEFAULT_LIMITS,
    ),
    isDigest,
  );
  const one = must(oneResult);
  const many = must(manyResult);
  assert.ok(equalDigest(one, many));
  const otherAlgorithmResult: OperationResult<Digest> = checkedResult(
    hashBytes("sha-384", input, DEFAULT_LIMITS),
    isDigest,
  );
  const otherAlgorithm = must(otherAlgorithmResult);
  const changedResult: OperationResult<Digest> = checkedResult(
    hashBytes("sha-512", new Uint8Array([...input, 0]), DEFAULT_LIMITS),
    isDigest,
  );
  const changed = must(changedResult);
  assert.ok(!equalDigest(one, otherAlgorithm));
  assert.ok(!equalDigest(one, changed));
  assert.equal(code(hashBytes("md5", input, DEFAULT_LIMITS)), "ALGORITHM_UNKNOWN");
  const frame = must(
    checkedResult(encodeFrame({ kind: "content", fields: [] }, DEFAULT_LIMITS), isByteArray),
  );
  assert.equal(
    code(hashFrame("sha-256", { ok: true, value: frame, diagnostics: [] }, DEFAULT_LIMITS)),
    undefined,
  );
  assert.equal(
    code(hashFrame("sha-256", encodeFrame(null, DEFAULT_LIMITS), DEFAULT_LIMITS)),
    "FRAME_KIND_UNKNOWN",
  );
});

void test("phase 4 link builder preserves the explicit genesis discriminant", () => {
  const digestResult: OperationResult<Digest> = checkedResult(
    validateDigest("00".repeat(32), "sha-256"),
    isDigest,
  );
  const digest = must(digestResult);
  const frameResult: OperationResult<Uint8Array> = checkedResult(
    buildLinkFrame(
      {
        algorithm: "sha-256",
        contextId: "example.context",
        sequenceId: "sequence-2026",
        position: 0,
        recordId: "record-0001",
        recordDigest: digest,
      },
      DEFAULT_LIMITS,
    ),
    isByteArray,
  );
  const frame = must(frameResult);
  const parsedResult: OperationResult<ParsedFrame> = checkedResult(
    parseFrame(frame, DEFAULT_LIMITS),
    isParsedFrame,
  );
  const parsed = must(parsedResult);
  assert.deepEqual(parsed.fields[6], { tag: 7, type: "none" });
  assert.ok(
    buildContentFrame(
      {
        algorithm: "sha-256",
        profileId: "dev.noeos.raw-bytes",
        profileVersion: "1.0.0",
        normalizedBytes: new Uint8Array(),
      },
      DEFAULT_LIMITS,
    ).ok,
  );
});

void test("phase 3 covers validator boundaries and exact resource budgets", () => {
  assert.ok(validateRecordId("record-1").ok);
  assert.ok(validateSequenceId("sequence-1").ok);
  assert.equal(code(validateRecordId("")), "IDENTIFIER_INVALID");
  assert.equal(code(validateSequenceId("_leading")), "IDENTIFIER_INVALID");
  assert.equal(code(validateContextId("x".repeat(129))), "IDENTIFIER_INVALID");
  assert.equal(code(validateProfileId("@scope/name")), "IDENTIFIER_INVALID");
  assert.equal(code(validateProfileVersion("1.0.0+" + "a".repeat(252))), "VERSION_INVALID");
  assert.ok(validateProtocolVersion(1).ok);
  assert.equal(code(validateProtocolVersion(2)), "VERSION_INVALID");
  assert.ok(validatePosition(0).ok);
  assert.equal(code(validatePosition(-1)), "INPUT_TYPE_INVALID");
  assert.equal(code(validatePosition(1.5)), "INPUT_TYPE_INVALID");
  assert.ok(validateAlgorithmId("sha-256").ok);
  assert.ok(validateAlgorithmId("sha-384").ok);
  assert.ok(validateAlgorithmId("sha-512").ok);
  assert.equal(code(validateAlgorithmId("sha-1")), "ALGORITHM_UNKNOWN");
  assert.ok(validateProfileReference("dev.noeos.jcs", "1.0.0").ok);
  assert.equal(code(validateProfileReference("bad id", "1.0.0")), "IDENTIFIER_INVALID");
  assert.equal(code(validateProfileReference("dev.noeos.jcs", "1")), "VERSION_INVALID");
  assert.ok(validateLimits(undefined).ok);
  assert.ok(validateLimits({ maxPayloadBytes: 2 }).ok);
  assert.equal(code(validateLimits({ unknown: 1 })), "INPUT_TYPE_INVALID");
  assert.equal(code(validateLimits({ maxPayloadBytes: undefined })), "INPUT_LIMIT_EXCEEDED");
  assert.equal(
    code(validateLimits({ maxPayloadBytes: HARD_LIMITS.maxPayloadBytes + 1 })),
    "INPUT_LIMIT_EXCEEDED",
  );
  assert.equal(code(validateLimits({ maxPayloadBytes: 0 })), "INPUT_LIMIT_EXCEEDED");
  assert.equal(code(validateLimits({ maxPayloadBytes: 1.5 })), "INPUT_LIMIT_EXCEEDED");
  assert.ok(validateLimitValue(1, 1).ok);
  assert.equal(code(validateLimitValue(0, 1)), "INPUT_LIMIT_EXCEEDED");
  assert.equal(code(validateLimitValue(2, 1)), "INPUT_LIMIT_EXCEEDED");
  assert.equal(code(validateLimitValue(1.5, 2)), "INPUT_LIMIT_EXCEEDED");
  const getterLimits = {};
  Object.defineProperty(getterLimits, "maxPayloadBytes", { enumerable: true, get: () => 1 });
  assert.equal(code(validateLimits(getterLimits)), "INPUT_TYPE_INVALID");
});

void test("phase 3 validates all JSON primitives, containers and hostile descriptors", () => {
  for (const value of [null, true, false, "text", 0, -1, 1.5, -0])
    assert.ok(validateJsonValue(value, DEFAULT_LIMITS).ok);
  assert.equal(code(validateJsonValue(undefined, DEFAULT_LIMITS)), "JSON_VALUE_UNSUPPORTED");
  assert.equal(code(validateJsonValue(1n, DEFAULT_LIMITS)), "JSON_VALUE_UNSUPPORTED");
  assert.equal(code(validateJsonValue(Symbol("x"), DEFAULT_LIMITS)), "JSON_VALUE_UNSUPPORTED");
  assert.equal(code(validateJsonValue(() => null, DEFAULT_LIMITS)), "JSON_VALUE_UNSUPPORTED");
  assert.equal(
    code(validateJsonValue(Number.POSITIVE_INFINITY, DEFAULT_LIMITS)),
    "JSON_NUMBER_UNSAFE",
  );
  assert.equal(
    code(validateJsonValue(Number.MAX_SAFE_INTEGER + 1, DEFAULT_LIMITS)),
    "JSON_NUMBER_UNSAFE",
  );
  assert.equal(code(validateJsonValue("\ud800", DEFAULT_LIMITS)), "UTF8_INVALID");
  assert.ok(validateJsonValue({ "a/b~c": ["x", 1] }, DEFAULT_LIMITS).ok);
  assert.ok(validateJsonValue(Object.create(null), DEFAULT_LIMITS).ok);
  assert.equal(code(validateJsonValue(new Date(), DEFAULT_LIMITS)), "JSON_VALUE_UNSUPPORTED");
  const symbolProperty: Record<string, unknown> = {};
  Object.defineProperty(symbolProperty, Symbol("x"), { value: 1, enumerable: true });
  assert.equal(code(validateJsonValue(symbolProperty, DEFAULT_LIMITS)), "JSON_VALUE_UNSUPPORTED");
  const sparse: unknown[] = [];
  sparse.length = 1;
  assert.equal(code(validateJsonValue(sparse, DEFAULT_LIMITS)), "JSON_VALUE_UNSUPPORTED");
  const symbolArray: unknown[] = [1];
  Object.defineProperty(symbolArray, Symbol("x"), { value: 1, enumerable: true });
  assert.equal(code(validateJsonValue(symbolArray, DEFAULT_LIMITS)), "JSON_VALUE_UNSUPPORTED");
  const unsafeIndexArray: unknown[] = [1];
  Object.defineProperty(unsafeIndexArray, "9007199254740992", { value: 1, enumerable: true });
  assert.equal(code(validateJsonValue(unsafeIndexArray, DEFAULT_LIMITS)), "JSON_VALUE_UNSUPPORTED");
  const accessorArray: unknown[] = [1];
  Object.defineProperty(accessorArray, "1", { enumerable: true, get: () => 1 });
  assert.equal(code(validateJsonValue(accessorArray, DEFAULT_LIMITS)), "JSON_VALUE_UNSUPPORTED");
  const customArray = [1];
  Object.defineProperty(customArray, "01", { value: 1, enumerable: true });
  assert.equal(code(validateJsonValue(customArray, DEFAULT_LIMITS)), "JSON_VALUE_UNSUPPORTED");
  const largeIndexArray = [1];
  Object.defineProperty(largeIndexArray, "4294967295", { value: 1, enumerable: true });
  assert.equal(code(validateJsonValue(largeIndexArray, DEFAULT_LIMITS)), "JSON_VALUE_UNSUPPORTED");
  const invalidKey: Record<string, unknown> = {};
  Object.defineProperty(invalidKey, "\ud800", { enumerable: true, value: 1 });
  assert.equal(code(validateJsonValue(invalidKey, DEFAULT_LIMITS)), "UTF8_INVALID");
  assert.equal(
    code(validateJsonValue(["x"], limitsWith({ maxJsonDepth: 0 }))),
    "INPUT_LIMIT_EXCEEDED",
  );
  assert.equal(
    code(validateJsonValue({ a: 1 }, limitsWith({ maxObjectProperties: 0 }))),
    "INPUT_LIMIT_EXCEEDED",
  );
  assert.equal(
    code(validateJsonValue([1], limitsWith({ maxArrayElements: 0 }))),
    "INPUT_LIMIT_EXCEEDED",
  );
  assert.equal(
    code(validateJsonValue("ab", limitsWith({ maxStringBytes: 1 }))),
    "INPUT_LIMIT_EXCEEDED",
  );
});

void test("phase 3 parses every JSON grammar branch and reports syntax precisely", () => {
  const text =
    '{ "a\\/b~c": [true, false, null, "\\b\\f\\n\\r\\t\\u0001\\uD834\\uDD1E"], "n": -12.50e+2 }';
  assert.ok(parseJsonText(text, DEFAULT_LIMITS).ok);
  assert.ok(parseJsonText("{}", DEFAULT_LIMITS).ok);
  assert.ok(parseJsonText("[]", DEFAULT_LIMITS).ok);
  assert.ok(parseJsonText("  0  ", DEFAULT_LIMITS).ok);
  assert.ok(parseJsonText(new TextEncoder().encode('{"ok":1}'), DEFAULT_LIMITS).ok);
  const invalid = [
    "",
    "{",
    "[",
    '{"a"}',
    "{a:1}",
    '{"a":}',
    '{"a":1,}',
    "[1,]",
    "tru",
    "true false",
    "01",
    "-",
    "1.",
    "1e",
    "1e+",
    '"bad\\q"',
    '"bad\\u12"',
    '"bad\n"',
    '"\\uD800"',
    '"\\uDC00"',
  ];
  for (const candidate of invalid) {
    const expected = candidate.includes("\\uD") ? "UTF8_INVALID" : "JSON_SYNTAX_INVALID";
    assert.equal(code(parseJsonText(candidate, DEFAULT_LIMITS)), expected);
  }
  assert.equal(code(parseJsonText('"unterminated', DEFAULT_LIMITS)), "JSON_SYNTAX_INVALID");
  assert.equal(code(parseJsonText('"\\uD834\\x"', DEFAULT_LIMITS)), "UTF8_INVALID");
  assert.equal(code(parseJsonText('"\\uD834\\u0041"', DEFAULT_LIMITS)), "UTF8_INVALID");
  assert.ok(parseJsonText("\n\t\r 0 ", DEFAULT_LIMITS).ok);
  assert.equal(code(parseJsonText("9007199254740992", DEFAULT_LIMITS)), "JSON_NUMBER_UNSAFE");
  assert.equal(code(parseJsonText("1e400", DEFAULT_LIMITS)), "JSON_NUMBER_UNSAFE");
  assert.ok(parseJsonText("1.5", DEFAULT_LIMITS).ok);
  assert.ok(parseJsonText("1e-2", DEFAULT_LIMITS).ok);
  assert.equal(code(parseJsonText('{"a":1,"a":2}', DEFAULT_LIMITS)), "JSON_DUPLICATE_KEY");
  assert.equal(
    code(parseJsonText('{"a":1}', limitsWith({ maxObjectProperties: 0 }))),
    "INPUT_LIMIT_EXCEEDED",
  );
  assert.equal(
    code(parseJsonText("[1]", limitsWith({ maxArrayElements: 0 }))),
    "INPUT_LIMIT_EXCEEDED",
  );
  assert.equal(
    code(parseJsonText('"ab"', limitsWith({ maxStringBytes: 1 }))),
    "INPUT_LIMIT_EXCEEDED",
  );
  assert.equal(code(parseJsonText("{}", limitsWith({ maxJsonDepth: 0 }))), undefined);
  assert.equal(
    code(parseJsonText("[[]]", limitsWith({ maxJsonDepth: 0 }))),
    "INPUT_LIMIT_EXCEEDED",
  );
  assert.equal(
    code(parseJsonText("x".repeat(5), limitsWith({ maxPayloadBytes: 4 }))),
    "INPUT_LIMIT_EXCEEDED",
  );
  assert.equal(
    code(parseJsonText(new Uint8Array([0xef, 0xbb, 0xbf, 0x7b, 0x7d]), DEFAULT_LIMITS)),
    "UTF8_INVALID",
  );
});

void test("phase 3 diagnostics, UTF-8 and byte sinks are bounded and deterministic", () => {
  const diagnostic = createDiagnostic("INPUT_REQUIRED", "input", {
    path: "/a",
    recordId: "r",
    position: 2,
    details: { count: 1, safe: true, note: null },
    causeCode: "INPUT_TYPE_INVALID",
  });
  assert.equal(diagnostic.$schema, "urn:noeos:verification-engine:diagnostic:1");
  assert.equal(diagnostic.messageKey, "input.required");
  assert.equal(Object.isFrozen(diagnostic), true);
  assert.throws(() => createDiagnostic("NOT_A_CODE", "input"));
  const detailGetter = {};
  Object.defineProperty(detailGetter, "safe", {
    enumerable: true,
    get: () => {
      throw new Error("detail getter evaluated");
    },
  });
  assert.equal(
    createDiagnostic("INPUT_REQUIRED", "input", { details: detailGetter }).details,
    undefined,
  );
  const invalidDetails: Record<string, null> = { bad: null };
  Object.defineProperty(invalidDetails, "bad", {
    configurable: true,
    enumerable: true,
    value: { nested: true },
    writable: true,
  });
  assert.equal(
    createDiagnostic("INPUT_REQUIRED", "input", { details: invalidDetails }).details,
    undefined,
  );
  let descriptorReads = 0;
  const changingDetails = new Proxy(
    {},
    {
      ownKeys: () => ["safe"],
      getOwnPropertyDescriptor: () => {
        descriptorReads += 1;
        return descriptorReads === 1
          ? { configurable: true, enumerable: true, value: null, writable: true }
          : undefined;
      },
    },
  );
  assert.equal(
    createDiagnostic("INPUT_REQUIRED", "input", { details: changingDetails }).details,
    undefined,
  );
  assert.equal(
    createDiagnostic("INPUT_REQUIRED", "input", { details: { "Bad-Key": true } }).details,
    undefined,
  );
  assert.equal(
    createDiagnostic("INPUT_REQUIRED", "input", { details: { finite: Number.POSITIVE_INFINITY } })
      .details,
    undefined,
  );
  assert.equal(
    createDiagnostic("INPUT_REQUIRED", "input", { details: { text: "x".repeat(257) } }).details,
    undefined,
  );
  const symbolDetails: Record<string, null> = { safe: null };
  Object.defineProperty(symbolDetails, Symbol("secret"), { value: true, enumerable: true });
  assert.equal(
    createDiagnostic("INPUT_REQUIRED", "input", { details: symbolDetails }).details,
    undefined,
  );
  const tooManyDetails: Record<string, null> = {};
  for (let index = 0; index < 33; index += 1) tooManyDetails[`key${String(index)}`] = null;
  assert.equal(
    createDiagnostic("INPUT_REQUIRED", "input", { details: tooManyDetails }).details,
    undefined,
  );
  const sanitized = createDiagnostic("INPUT_REQUIRED", "input", {
    path: "/\ud800",
    recordId: "not valid",
    position: -1,
    causeCode: "bad-code",
  });
  assert.equal(sanitized.path, undefined);
  assert.equal(sanitized.recordId, undefined);
  assert.equal(sanitized.position, undefined);
  assert.equal(sanitized.causeCode, undefined);
  const adversarialPath = createDiagnostic("INPUT_REQUIRED", "input", {
    path: `/${"~0".repeat(200)}~`,
  });
  assert.equal(adversarialPath.path, undefined);
  const collector = new DiagnosticCollector(limitsWith({ maxDiagnostics: 2 }));
  collector.add(diagnostic);
  collector.addCode("ALGORITHM_VERIFY_ONLY", "output", { position: 1 });
  collector.addCode("JSON_SYNTAX_INVALID", "input", { position: 3 });
  collector.addCode("JSON_SYNTAX_INVALID", "input", { position: 4 });
  assert.equal(collector.finish().length, 2);
  assert.ok(collector.hasErrors());
  const limitedDiagnostics = collector.finish().filter(isDiagnostic);
  assert.equal(limitedDiagnostics[1]?.code, "DIAGNOSTIC_LIMIT_REACHED");
  const orderingCollector = new DiagnosticCollector(DEFAULT_LIMITS);
  orderingCollector.addCode("INPUT_REQUIRED", "input", { position: 1, path: "b" });
  orderingCollector.addCode("JSON_SYNTAX_INVALID", "input", { position: 1, path: "a" });
  orderingCollector.addCode("INPUT_REQUIRED", "output", { position: 1, path: "a" });
  orderingCollector.addCode("INPUT_REQUIRED", "input", { position: 1, path: "a" });
  const orderedDiagnostics = orderingCollector.finish().filter(isDiagnostic);
  assert.equal(orderedDiagnostics[0]?.path, "a");
  assert.equal(orderedDiagnostics.at(-1)?.phase, "output");
  const equalCollector = new DiagnosticCollector(DEFAULT_LIMITS);
  equalCollector.addCode("INPUT_REQUIRED", "input", { position: 1, path: "a" });
  equalCollector.addCode("INPUT_REQUIRED", "input", { position: 1, path: "a" });
  assert.equal(equalCollector.finish().length, 2);
  assert.ok(hasWellFormedUnicode("😀"));
  assert.ok(!hasWellFormedUnicode("\udfff"));
  assert.ok(encodeUtf8("abc", 3).ok);
  assert.equal(code(encodeUtf8("abcd", 3)), "INPUT_LIMIT_EXCEEDED");
  assert.equal(code(encodeUtf8("\ud800", 3)), "UTF8_INVALID");
  assert.ok(decodeUtf8(new Uint8Array([0xf0, 0x9f, 0x98, 0x80])).ok);
  assert.equal(code(decodeUtf8(new Uint8Array([0xc3, 0x28]))), "UTF8_INVALID");
  assert.equal(code(decodeUtf8(new Uint8Array([0xef, 0xbb, 0xbf, 0x7b]))), "UTF8_INVALID");
  const sink = new ByteArraySink(2);
  sink.write(new Uint8Array([1]));
  sink.write(new Uint8Array([2]));
  assert.deepEqual([...sink.toBytes()], [1, 2]);
  assert.throws(() => {
    sink.write(new Uint8Array([3]));
  });
  const warningCollector = new DiagnosticCollector(DEFAULT_LIMITS);
  warningCollector.addCode("ALGORITHM_VERIFY_ONLY", "output");
  assert.ok(!warningCollector.hasErrors());
});

void test("phase 4 builds every frame kind and parser rejects every structural mutation", () => {
  const digestResult: OperationResult<Digest> = checkedResult(
    validateDigest("11".repeat(32), "sha-256"),
    isDigest,
  );
  const digest = must(digestResult);
  const recordResult: OperationResult<Uint8Array> = checkedResult(
    buildRecordFrame(
      {
        algorithm: "sha-256",
        contextId: "example.context",
        recordId: "record-0001",
        profileId: "dev.noeos.jcs",
        profileVersion: "1.0.0",
        normalizedByteLength: 3,
        contentDigest: digest,
      },
      DEFAULT_LIMITS,
    ),
    isByteArray,
  );
  const record = must(recordResult);
  const evidenceResult: OperationResult<Uint8Array> = checkedResult(
    buildEvidenceFrame(
      {
        algorithm: "sha-512",
        schemaUrn: "urn:noeos:verification-engine:record-evidence:1",
        evidenceJcsBytes: new Uint8Array([0x7b, 0x7d]),
      },
      DEFAULT_LIMITS,
    ),
    isByteArray,
  );
  const evidence = must(evidenceResult);
  const linkResult: OperationResult<Uint8Array> = checkedResult(
    buildLinkFrame(
      {
        algorithm: "sha-256",
        contextId: "example.context",
        sequenceId: "sequence-2026",
        position: 1,
        recordId: "record-0001",
        recordDigest: digest,
        previousLinkDigest: digest,
      },
      DEFAULT_LIMITS,
    ),
    isByteArray,
  );
  const link = must(linkResult);
  assert.equal(
    must(checkedResult(parseFrame(record, DEFAULT_LIMITS), isParsedFrame)).kind,
    "record",
  );
  assert.equal(
    must(checkedResult(parseFrame(evidence, DEFAULT_LIMITS), isParsedFrame)).kind,
    "evidence",
  );
  assert.equal(must(checkedResult(parseFrame(link, DEFAULT_LIMITS), isParsedFrame)).kind, "link");

  const base = must(
    checkedResult(
      encodeFrame(
        {
          kind: "content",
          fields: [
            { tag: 1, type: "utf8", value: "sha-256" },
            { tag: 2, type: "utf8", value: "dev.noeos.jcs" },
            { tag: 3, type: "utf8", value: "1.0.0" },
            { tag: 4, type: "bytes", value: new Uint8Array([1]) },
          ],
        },
        DEFAULT_LIMITS,
      ),
      isByteArray,
    ),
  );
  const duplicate = mutate(base, fieldOffset(base, 2), 0);
  duplicate[fieldOffset(base, 2) + 1] = 1;
  assert.equal(code(parseFrame(duplicate, DEFAULT_LIMITS)), "FRAME_FIELD_DUPLICATE");
  const order = mutate(base, fieldOffset(base, 1), 0);
  order[fieldOffset(base, 1) + 1] = 3;
  assert.equal(code(parseFrame(order, DEFAULT_LIMITS)), "FRAME_FIELD_ORDER_INVALID");
  const unknown = must(
    checkedResult(
      encodeFrame(
        { kind: "content", fields: [{ tag: 8, type: "bytes", value: new Uint8Array() }] },
        DEFAULT_LIMITS,
      ),
      isByteArray,
    ),
  );
  assert.equal(code(parseFrame(unknown, DEFAULT_LIMITS)), "FRAME_FIELD_UNKNOWN");
  const zeroTag = Uint8Array.from(unknown);
  const unknownOffset = fieldOffset(unknown, 8);
  zeroTag[unknownOffset] = 0;
  zeroTag[unknownOffset + 1] = 0;
  assert.equal(code(parseFrame(zeroTag, DEFAULT_LIMITS)), "FRAME_FIELD_UNKNOWN");
  const missing = must(
    checkedResult(encodeFrame({ kind: "content", fields: [] }, DEFAULT_LIMITS), isByteArray),
  );
  assert.equal(code(parseFrame(missing, DEFAULT_LIMITS)), "FRAME_FIELD_MISSING");
  const wrongType = must(
    checkedResult(
      encodeFrame(
        {
          kind: "content",
          fields: [
            { tag: 1, type: "bytes", value: new Uint8Array() },
            { tag: 2, type: "utf8", value: "p" },
            { tag: 3, type: "utf8", value: "1.0.0" },
            { tag: 4, type: "bytes", value: new Uint8Array() },
          ],
        },
        DEFAULT_LIMITS,
      ),
      isByteArray,
    ),
  );
  assert.equal(code(parseFrame(wrongType, DEFAULT_LIMITS)), "FRAME_FIELD_TYPE_INVALID");
  const badType = mutate(base, fieldOffset(base, 1) + 2, 0xff);
  assert.equal(code(parseFrame(badType, DEFAULT_LIMITS)), "FRAME_FIELD_TYPE_INVALID");
  const badLength = mutate(base, fieldOffset(base, 1) + 10, 0xff);
  assert.equal(code(parseFrame(badLength, DEFAULT_LIMITS)), "FRAME_LENGTH_INVALID");
  const unsafeFieldLength = mutate(base, fieldOffset(base, 1) + 3, 0x20);
  assert.equal(code(parseFrame(unsafeFieldLength, DEFAULT_LIMITS)), "FRAME_LENGTH_INVALID");
  const badUtf8 = mutate(base, fieldOffset(base, 1) + 11, 0xc3);
  assert.equal(code(parseFrame(badUtf8, DEFAULT_LIMITS)), "UTF8_INVALID");
  const badVersion = mutate(base, 10, 2);
  assert.equal(code(parseFrame(badVersion, DEFAULT_LIMITS)), "FRAME_VERSION_UNSUPPORTED");
  const badSecondVersion = mutate(base, 9, 0);
  badSecondVersion[10] = 2;
  assert.equal(code(parseFrame(badSecondVersion, DEFAULT_LIMITS)), "FRAME_VERSION_UNSUPPORTED");
  const badKind = mutate(base, 8, 9);
  assert.equal(code(parseFrame(badKind, DEFAULT_LIMITS)), "FRAME_KIND_UNKNOWN");
  assert.equal(code(parseFrame(new Uint8Array(0), DEFAULT_LIMITS)), "FRAME_LENGTH_INVALID");
  assert.equal(code(parseFrame("not bytes", DEFAULT_LIMITS)), "FRAME_LENGTH_INVALID");
  assert.equal(code(parseFrame(new Proxy(base, {}), DEFAULT_LIMITS)), "FRAME_LENGTH_INVALID");
  assert.equal(
    code(parseFrame(new Uint8Array(DEFAULT_LIMITS.maxPayloadBytes + 1), DEFAULT_LIMITS)),
    "INPUT_LIMIT_EXCEEDED",
  );

  const recordLengthOffset = fieldOffset(record, 6);
  const shortUint = Uint8Array.from([...record, 0]);
  shortUint[recordLengthOffset + 10] = 7;
  assert.equal(code(parseFrame(shortUint, DEFAULT_LIMITS)), "FRAME_LENGTH_INVALID");
  const unsafeUint = Uint8Array.from(record);
  unsafeUint[recordLengthOffset + 11] = 0x20;
  assert.equal(code(parseFrame(unsafeUint, DEFAULT_LIMITS)), "FRAME_LENGTH_INVALID");
  const linkNoneOffset = fieldOffset(
    must(
      checkedResult(
        buildLinkFrame(
          {
            algorithm: "sha-256",
            contextId: "example.context",
            sequenceId: "sequence-2026",
            position: 0,
            recordId: "record-0001",
            recordDigest: digest,
          },
          DEFAULT_LIMITS,
        ),
        isByteArray,
      ),
    ),
    7,
  );
  const badNone = Uint8Array.from([
    ...must(
      checkedResult(
        buildLinkFrame(
          {
            algorithm: "sha-256",
            contextId: "example.context",
            sequenceId: "sequence-2026",
            position: 0,
            recordId: "record-0001",
            recordDigest: digest,
          },
          DEFAULT_LIMITS,
        ),
        isByteArray,
      ),
    ),
    0,
  ]);
  badNone[linkNoneOffset + 10] = 1;
  assert.equal(code(parseFrame(badNone, DEFAULT_LIMITS)), "FRAME_LENGTH_INVALID");
  assert.equal(code(encodeFrame(null, DEFAULT_LIMITS)), "FRAME_KIND_UNKNOWN");
  assert.equal(
    code(encodeFrame({ kind: "unknown", fields: [] }, DEFAULT_LIMITS)),
    "FRAME_KIND_UNKNOWN",
  );
  assert.equal(
    code(encodeFrame({ kind: "content", fields: null }, DEFAULT_LIMITS)),
    "FRAME_LENGTH_INVALID",
  );
  assert.equal(
    code(encodeFrame({ kind: "content", fields: [null] }, DEFAULT_LIMITS)),
    "FRAME_FIELD_TYPE_INVALID",
  );
  assert.equal(
    code(encodeFrame({ kind: "content", fields: new Proxy([], {}) }, DEFAULT_LIMITS)),
    "FRAME_LENGTH_INVALID",
  );
  assert.equal(
    code(
      encodeFrame(
        { kind: "content", fields: [{ tag: 0, type: "bytes", value: new Uint8Array() }] },
        DEFAULT_LIMITS,
      ),
    ),
    "FRAME_LENGTH_INVALID",
  );
  assert.equal(
    code(
      encodeFrame(
        { kind: "content", fields: [{ tag: Number.NaN, type: "bytes", value: new Uint8Array() }] },
        DEFAULT_LIMITS,
      ),
    ),
    "FRAME_LENGTH_INVALID",
  );
  assert.equal(
    code(
      encodeFrame(
        { kind: "content", fields: [{ tag: 65_536, type: "bytes", value: new Uint8Array() }] },
        DEFAULT_LIMITS,
      ),
    ),
    "FRAME_LENGTH_INVALID",
  );
  assert.equal(
    code(
      encodeFrame(
        { kind: "content", fields: [{ type: "bytes", value: new Uint8Array() }] },
        DEFAULT_LIMITS,
      ),
    ),
    "FRAME_FIELD_TYPE_INVALID",
  );
  assert.equal(
    code(
      encodeFrame(
        { kind: "content", fields: [{ tag: 1, type: "bytes", value: "bad" }] },
        DEFAULT_LIMITS,
      ),
    ),
    "FRAME_FIELD_TYPE_INVALID",
  );
  assert.equal(
    code(
      encodeFrame(
        {
          kind: "content",
          fields: [{ tag: 1, type: "bytes", value: new Proxy(new Uint8Array(), {}) }],
        },
        DEFAULT_LIMITS,
      ),
    ),
    "FRAME_FIELD_TYPE_INVALID",
  );
  assert.equal(
    code(
      encodeFrame(
        { kind: "content", fields: [{ tag: 1, type: "other", value: new Uint8Array() }] },
        DEFAULT_LIMITS,
      ),
    ),
    "FRAME_FIELD_TYPE_INVALID",
  );
  assert.equal(
    code(
      encodeFrame(
        { kind: "content", fields: [{ tag: 1, type: "uint64", value: "1" }] },
        DEFAULT_LIMITS,
      ),
    ),
    "FRAME_FIELD_TYPE_INVALID",
  );
  assert.equal(
    code(
      encodeFrame(
        { kind: "content", fields: [{ tag: 1, type: "utf8", value: 1 }] },
        DEFAULT_LIMITS,
      ),
    ),
    "FRAME_FIELD_TYPE_INVALID",
  );
  assert.equal(
    code(
      encodeFrame(
        { kind: "content", fields: [{ tag: "1", type: "bytes", value: new Uint8Array() }] },
        DEFAULT_LIMITS,
      ),
    ),
    "FRAME_FIELD_TYPE_INVALID",
  );
  const symbolField = {
    tag: 1,
    type: "bytes",
    value: new Uint8Array(),
    [Symbol("unexpected")]: true,
  };
  assert.equal(
    code(encodeFrame({ kind: "content", fields: [symbolField] }, DEFAULT_LIMITS)),
    "FRAME_FIELD_TYPE_INVALID",
  );
  assert.equal(
    code(
      encodeFrame(
        { kind: "content", fields: [{ tag: 1, type: "utf8", value: "\ud800" }] },
        DEFAULT_LIMITS,
      ),
    ),
    "UTF8_INVALID",
  );
  assert.equal(
    code(
      encodeFrame(
        { kind: "content", fields: [{ tag: 1, type: "uint64", value: -1 }] },
        DEFAULT_LIMITS,
      ),
    ),
    "FRAME_LENGTH_INVALID",
  );
  const manyFields = Array.from({ length: 65_536 }, (_, index) => ({
    tag: index + 1,
    type: "bytes",
    value: new Uint8Array(),
  }));
  assert.equal(
    code(encodeFrame({ kind: "content", fields: manyFields }, DEFAULT_LIMITS)),
    "FRAME_LENGTH_INVALID",
  );
  const truncatedFieldHeader = Uint8Array.from([
    0x4e, 0x4f, 0x45, 0x4f, 0x53, 0x56, 0x45, 0x31, 1, 0, 1, 0, 1,
  ]);
  assert.equal(code(parseFrame(truncatedFieldHeader, DEFAULT_LIMITS)), "FRAME_LENGTH_INVALID");
  const firstVersionByte = mutate(base, 9, 1);
  assert.equal(code(parseFrame(firstVersionByte, DEFAULT_LIMITS)), "FRAME_VERSION_UNSUPPORTED");
});

void test("phase 4 normalizer failure paths and profile registration remain closed", () => {
  assert.equal(
    code(normalizeToBytes(rawBytesProfile, "not bytes", DEFAULT_LIMITS)),
    "INPUT_TYPE_INVALID",
  );
  const versionResult: OperationResult<ProfileVersion> = checkedResult(
    validateProfileVersion("1.0.1"),
    isProfileVersion,
  );
  const version = must(versionResult);
  const successful = customProfile(version, "ok");
  const registry = new ProfileRegistry([successful]);
  assert.equal(code(registry.resolve(successful.id, successful.version)), undefined);
  assert.equal(code(registry.resolve(jcsProfile.id, version)), "PROFILE_UNKNOWN");
  assert.equal(code(normalizeToBytes(successful, new Uint8Array([1]), DEFAULT_LIMITS)), undefined);
  assert.equal(
    code(normalizeToBytes(customProfile(version, "failure"), new Uint8Array([1]), DEFAULT_LIMITS)),
    "NORMALIZATION_FAILED",
  );
  assert.equal(
    code(
      normalizeToBytes(
        customProfile(version, "validate-failure"),
        new Uint8Array([1]),
        DEFAULT_LIMITS,
      ),
    ),
    "INPUT_TYPE_INVALID",
  );
  assert.equal(
    code(normalizeToBytes(customProfile(version, "mismatch"), new Uint8Array([1]), DEFAULT_LIMITS)),
    "NORMALIZATION_FAILED",
  );
  assert.equal(
    code(normalizeToBytes(customProfile(version, "throw"), new Uint8Array([1]), DEFAULT_LIMITS)),
    "NORMALIZATION_FAILED",
  );
  assert.equal(
    code(
      normalizeToBytes(
        customProfile(version, "ok"),
        new Uint8Array([1, 2]),
        limitsWith({ maxPayloadBytes: 1 }),
      ),
    ),
    "NORMALIZATION_FAILED",
  );
  assert.throws(() => new ProfileRegistry([jcsProfile]));
  const erased = must(
    checkedResult(registry.resolve(successful.id, successful.version), isProfile),
  );
  assert.equal(code(normalizeToBytes(erased, new Uint8Array([2]), DEFAULT_LIMITS)), undefined);
  const validatingFailure = customProfile(version, "validate-failure");
  const validatingFailureRegistry = new ProfileRegistry([validatingFailure]);
  const erasedFailure = must(
    checkedResult(
      validatingFailureRegistry.resolve(validatingFailure.id, validatingFailure.version),
      isProfile,
    ),
  );
  assert.equal(
    code(normalizeToBytes(erasedFailure, new Uint8Array([2]), DEFAULT_LIMITS)),
    "INPUT_TYPE_INVALID",
  );
  const rawBytes = new Uint8Array([1]);
  const rawResult: OperationResult<NormalizedBytes> = checkedResult(
    normalizeToBytes(rawBytesProfile, rawBytes, DEFAULT_LIMITS),
    isNormalizedBytes,
  );
  const rawValue = must(rawResult);
  rawBytes[0] = 2;
  assert.deepEqual([...rawValue.bytes], [1]);
});

void test("phase 4 hash adapters handle invalid input, streaming errors and finalization", () => {
  assert.equal(code(hashBytes("sha-256", "not bytes", DEFAULT_LIMITS)), "INPUT_TYPE_INVALID");
  assert.equal(
    code(hashBytes("sha-256", new Proxy(new Uint8Array([1]), {}), DEFAULT_LIMITS)),
    "INPUT_TYPE_INVALID",
  );
  assert.equal(
    code(hashBytes("sha-256", new Uint8Array(DEFAULT_LIMITS.maxPayloadBytes + 1), DEFAULT_LIMITS)),
    "INPUT_LIMIT_EXCEEDED",
  );
  assert.equal(
    code(hashChunks("sha-256", [new Uint8Array([1, 2])], limitsWith({ maxPayloadBytes: 1 }))),
    "INPUT_LIMIT_EXCEEDED",
  );
  assert.equal(
    code(hashChunks("sha-256", invalidChunkIterable(), DEFAULT_LIMITS)),
    "INPUT_TYPE_INVALID",
  );
  assert.equal(
    code(hashChunks("sha-256", [new Proxy(new Uint8Array([1]), {})], DEFAULT_LIMITS)),
    "INPUT_TYPE_INVALID",
  );
  assert.equal(code(hashChunks("sha-256", [], DEFAULT_LIMITS)), undefined);
  assert.equal(code(hashChunks("md5", [], DEFAULT_LIMITS)), "ALGORITHM_UNKNOWN");
  assert.equal(
    code(hashChunks("sha-256", throwingIterable(), DEFAULT_LIMITS)),
    "NORMALIZATION_FAILED",
  );
  const sinkResult: OperationResult<HashSink> = checkedResult(
    createHashSink("sha-384", DEFAULT_LIMITS),
    isHashSink,
  );
  const sink = must(sinkResult);
  sink.update(new Uint8Array([1]));
  sink.digest();
  assert.throws(() => {
    sink.update(new Uint8Array([2]));
  });
  assert.throws(() => {
    sink.digest();
  });
});

void test("phase 4 exercises canonical JSON token and sink failure branches", () => {
  const allEscapes = '\b\f\n\r\t\u0001"\\/';
  const canonicalResult: OperationResult<NormalizedBytes> = checkedResult(
    normalizeToBytes(jcsProfile, [null, true, false, 1, 1e-7, allEscapes, {}], DEFAULT_LIMITS),
    isNormalizedBytes,
  );
  const canonical = must(canonicalResult);
  assert.equal(
    new TextDecoder().decode(canonical.bytes),
    '[null,true,false,1,1e-7,"\\b\\f\\n\\r\\t\\u0001\\"\\\\/",{}]',
  );
  assert.equal(
    new TextDecoder().decode(
      must(checkedResult(normalizeToBytes(jcsProfile, {}, DEFAULT_LIMITS), isNormalizedBytes))
        .bytes,
    ),
    "{}",
  );
  assert.equal(
    new TextDecoder().decode(
      must(checkedResult(normalizeToBytes(jcsProfile, [], DEFAULT_LIMITS), isNormalizedBytes))
        .bytes,
    ),
    "[]",
  );
  assert.throws(() => jcsProfile.normalize(new Array(1), new ByteArraySink(100)));
  assert.throws(() => jcsProfile.normalize({ invalid: undefined }, new ByteArraySink(100)));
  assert.throws(() => jcsProfile.normalize(Number.NaN, new ByteArraySink(100)));
  assert.throws(() => jcsProfile.normalize(Number.MAX_SAFE_INTEGER + 1, new ByteArraySink(100)));
  assert.equal(
    code(normalizeToBytes(rawBytesProfile, new Proxy(new Uint8Array([1]), {}), DEFAULT_LIMITS)),
    "INPUT_TYPE_INVALID",
  );
  assert.equal(
    code(
      normalizeToBytes(
        rawBytesProfile,
        new Uint8Array(DEFAULT_LIMITS.maxPayloadBytes + 1),
        DEFAULT_LIMITS,
      ),
    ),
    "INPUT_LIMIT_EXCEEDED",
  );
  const overflowFrame = encodeFrame(
    {
      kind: "content",
      fields: [{ tag: 1, type: "bytes", value: new Uint8Array(DEFAULT_LIMITS.maxPayloadBytes) }],
    },
    DEFAULT_LIMITS,
  );
  assert.equal(code(overflowFrame), "FRAME_LENGTH_INVALID");
  assert.equal(code(parseJsonText(null, DEFAULT_LIMITS)), "JSON_SYNTAX_INVALID");
  assert.equal(code(parseJsonText("\ud800", DEFAULT_LIMITS)), "JSON_SYNTAX_INVALID");
  const parserLimits = new Proxy(DEFAULT_LIMITS, {
    get(target, property: string | symbol): unknown {
      if (property === "maxJsonDepth") throw new Error("hostile limits");
      if (property === "maxPayloadBytes") return target.maxPayloadBytes;
      if (property === "maxObjectProperties") return target.maxObjectProperties;
      if (property === "maxArrayElements") return target.maxArrayElements;
      if (property === "maxStringBytes") return target.maxStringBytes;
      if (property === "maxNdjsonLineBytes") return target.maxNdjsonLineBytes;
      if (property === "maxDiagnostics") return target.maxDiagnostics;
      if (property === "maxFullRecords") return target.maxFullRecords;
      return undefined;
    },
  });
  assert.equal(code(parseJsonText("{}", parserLimits)), "JSON_SYNTAX_INVALID");
  const danglingEscape = String.fromCharCode(0x22, 0x5c);
  assert.equal(code(parseJsonText(danglingEscape, DEFAULT_LIMITS)), "JSON_SYNTAX_INVALID");
});

function must<T>(result: OperationResult<T>): T {
  if (!result.ok)
    throw new Error(result.diagnostics.map((diagnostic) => diagnostic.code).join(","));
  return result.value;
}

function code(result: unknown): string | undefined {
  if (!isRecord(result)) throw new Error("runtime result is not an object");
  if (result["ok"] === true) return undefined;
  if (result["ok"] !== false || !Array.isArray(result["diagnostics"]))
    throw new Error("runtime result is malformed");
  const diagnostics = result["diagnostics"];
  if (!isUnknownArray(diagnostics)) throw new Error("runtime diagnostics are malformed");
  const diagnostic: unknown = diagnostics[0];
  if (!isRecord(diagnostic) || typeof diagnostic["code"] !== "string")
    throw new Error("runtime diagnostic is malformed");
  return diagnostic["code"];
}

function hex(value: Uint8Array): string {
  return Buffer.from(value).toString("hex");
}

function limitsWith(overrides: Partial<Limits>): Limits {
  return Object.freeze({ ...DEFAULT_LIMITS, ...overrides });
}

function mutate(source: Uint8Array, index: number, value: number): Uint8Array {
  const output = Uint8Array.from(source);
  output[index] = value;
  return output;
}

function fieldOffset(frame: Uint8Array, wantedTag: number): number {
  const fieldCount = ((frame[11] ?? 0) << 8) | (frame[12] ?? 0);
  let offset = 13;
  for (let index = 0; index < fieldCount; index += 1) {
    const tag = ((frame[offset] ?? 0) << 8) | (frame[offset + 1] ?? 0);
    const lengthStart = offset + 3;
    let length = 0n;
    for (let byte = 0; byte < 8; byte += 1)
      length = (length << 8n) | BigInt(frame[lengthStart + byte] ?? 0);
    if (tag === wantedTag) return offset;
    offset += 11 + Number(length);
  }
  throw new Error(`field not found: ${String(wantedTag)}`);
}

type CustomMode = "failure" | "mismatch" | "ok" | "throw" | "validate-failure";

function customProfile(version: ProfileVersion, mode: CustomMode): NormalizationProfile {
  const customId = must(checkedResult(validateProfileId("dev.noeos.custom"), isProfileId));
  return Object.freeze({
    id: customId,
    version,
    inputKind: "bytes",
    validate(input: unknown): OperationResult<unknown> {
      if (mode === "validate-failure")
        return {
          ok: false,
          diagnostics: Object.freeze([localDiagnostic("INPUT_TYPE_INVALID", "input", "error")]),
        };
      return { ok: true, value: input, diagnostics: Object.freeze([]) };
    },
    normalize(input: unknown, sink: ByteSink): OperationResult<NormalizationStats> {
      if (mode === "failure")
        return {
          ok: false,
          diagnostics: Object.freeze([
            localDiagnostic("NORMALIZATION_FAILED", "normalization", "error"),
          ]),
        };
      if (mode === "throw") throw new Error("normalizer failure");
      if (!(input instanceof Uint8Array))
        return {
          ok: false,
          diagnostics: Object.freeze([localDiagnostic("INPUT_TYPE_INVALID", "input", "error")]),
        };
      sink.write(input);
      return {
        ok: true,
        value: Object.freeze({
          byteLength: mode === "mismatch" ? sink.byteLength + 1 : sink.byteLength,
        }),
        diagnostics: Object.freeze([]),
      };
    },
  });
}

function localDiagnostic(
  codeValue: "INPUT_TYPE_INVALID" | "NORMALIZATION_FAILED",
  phase: "input" | "normalization",
  severity: "error",
): Diagnostic {
  return {
    $schema: "urn:noeos:verification-engine:diagnostic:1",
    code: codeValue,
    phase,
    severity,
    messageKey: codeValue.toLowerCase().replaceAll("_", "."),
  };
}

function invalidChunkIterable(): Iterable<unknown> {
  return ["bad"];
}

function throwingIterable(): Iterable<Uint8Array> {
  return {
    [Symbol.iterator](): Iterator<Uint8Array> {
      throw new Error("iterator failure");
    },
  };
}

function checkedResult<T>(
  result: unknown,
  valueGuard: (value: unknown) => value is T,
): OperationResult<T> {
  if (
    !isRecord(result) ||
    typeof result["ok"] !== "boolean" ||
    !isUnknownArray(result["diagnostics"])
  )
    throw new Error("runtime result is malformed");
  const diagnostics = result["diagnostics"].filter(isDiagnostic);
  if (diagnostics.length !== result["diagnostics"].length)
    throw new Error("runtime diagnostics are malformed");
  if (!result["ok"]) return { ok: false, diagnostics: Object.freeze(diagnostics) };
  if (!valueGuard(result["value"])) throw new Error("runtime result value is malformed");
  return { ok: true, value: result["value"], diagnostics: Object.freeze(diagnostics) };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isUnknownArray(value: unknown): value is readonly unknown[] {
  return Array.isArray(value);
}

function isDiagnostic(value: unknown): value is Diagnostic {
  return (
    isRecord(value) &&
    typeof value["code"] === "string" &&
    typeof value["severity"] === "string" &&
    typeof value["phase"] === "string" &&
    typeof value["messageKey"] === "string"
  );
}

function isByteArray(value: unknown): value is Uint8Array {
  return value instanceof Uint8Array;
}

function isNormalizedBytes(value: unknown): value is NormalizedBytes {
  return (
    isRecord(value) &&
    isByteArray(value["bytes"]) &&
    isRecord(value["stats"]) &&
    typeof value["stats"]["byteLength"] === "number"
  );
}

function isDigest(value: unknown): value is Digest {
  return (
    isRecord(value) &&
    typeof value["algorithm"] === "string" &&
    typeof value["toBytes"] === "function" &&
    typeof value["toHex"] === "function"
  );
}

function isParsedFrame(value: unknown): value is ParsedFrame {
  return (
    isRecord(value) &&
    typeof value["kind"] === "string" &&
    value["protocolVersion"] === 1 &&
    Array.isArray(value["fields"])
  );
}

function isProfileVersion(value: unknown): value is ProfileVersion {
  return isRecord(value) && typeof value["value"] === "string";
}

function isProfileId(value: unknown): value is ProfileId {
  return isRecord(value) && typeof value["value"] === "string";
}

function isProfile(value: unknown): value is NormalizationProfile {
  return (
    isRecord(value) &&
    isProfileVersion(value["version"]) &&
    isRecord(value["id"]) &&
    typeof value["validate"] === "function" &&
    typeof value["normalize"] === "function"
  );
}

function isHashSink(value: unknown): value is HashSink {
  return (
    isRecord(value) &&
    typeof value["update"] === "function" &&
    typeof value["digest"] === "function"
  );
}
