// SPDX-License-Identifier: Apache-2.0

import { types } from "node:util";
import type { Limits } from "../domain/limits.js";
import type { OperationResult } from "../domain/operation-result.js";
import { failure } from "../domain/operation-result.js";
import { DiagnosticCollector } from "../validation/diagnostic-collector.js";
import { encodeUtf8 } from "../validation/utf8-validation.js";
import { inspectPlainObject, isPlainObject } from "../validation/object-inspection.js";
import { ByteArraySink } from "../normalization/byte-sink.js";
import type { FrameField, FrameInput, FrameKind } from "./frame-types.js";

const MAGIC = "NOEOSVE1";
const PROTOCOL_VERSION = 1;
const KIND_CODES: Readonly<Record<FrameKind, number>> = Object.freeze({
  content: 0x01,
  record: 0x02,
  link: 0x03,
  evidence: 0x04,
});
const MAGIC_BYTES = new TextEncoder().encode(MAGIC);
const UTF8_ENCODER = new TextEncoder();

export function encodeFrame(input: unknown, limits: Limits): OperationResult<Uint8Array> {
  const frameInput = validateFrameInput(input);
  if (!frameInput.ok) return frameFailure(frameInput.code, limits);
  const kindCode = KIND_CODES[frameInput.value.kind];
  if (frameInput.value.fields.length > 0xffff) return frameFailure("FRAME_LENGTH_INVALID", limits);
  const encodedFields: EncodedField[] = [];
  let previousTag = 0;
  for (const field of frameInput.value.fields) {
    if (!Number.isSafeInteger(field.tag) || field.tag < 1 || field.tag > 0xffff) {
      return frameFailure("FRAME_LENGTH_INVALID", limits);
    }
    if (field.tag === previousTag) return frameFailure("FRAME_FIELD_DUPLICATE", limits);
    if (field.tag < previousTag) return frameFailure("FRAME_FIELD_ORDER_INVALID", limits);
    previousTag = field.tag;
    const encoded = encodeField(field, limits);
    if (!encoded.ok) return encoded;
    encodedFields.push(encoded.value);
  }

  const sink = new ByteArraySink(limits.maxPayloadBytes);
  try {
    sink.write(new TextEncoder().encode(MAGIC));
    sink.write(Uint8Array.of(kindCode, 0, PROTOCOL_VERSION));
    sink.write(uint16Bytes(encodedFields.length));
    for (const field of encodedFields) {
      sink.write(uint16Bytes(field.tag));
      sink.write(Uint8Array.of(field.typeCode));
      sink.write(uint64Bytes(field.value.length));
      sink.write(field.value);
    }
    return { ok: true, value: sink.toBytes(), diagnostics: Object.freeze([]) };
  } catch {
    return frameFailure("FRAME_LENGTH_INVALID", limits);
  }
}

/** Internal fast path. Callers must have completed positive validation. */
export function encodeTrustedFrame(input: FrameInput, limits: Limits): OperationResult<Uint8Array> {
  const kindCode = KIND_CODES[input.kind];
  const encodedFields: EncodedField[] = [];
  let total = MAGIC_BYTES.length + 3 + 2;
  try {
    for (const field of input.fields) {
      const encoded = encodeTrustedField(field, limits);
      total += 2 + 1 + 8 + encoded.value.length;
      encodedFields.push(encoded);
    }
    if (input.fields.length > 0xffff || total > limits.maxPayloadBytes) {
      return frameFailure("FRAME_LENGTH_INVALID", limits);
    }
    const output = new Uint8Array(total);
    let offset = 0;
    output.set(MAGIC_BYTES, offset);
    offset += MAGIC_BYTES.length;
    output[offset++] = kindCode;
    output[offset++] = 0;
    output[offset++] = PROTOCOL_VERSION;
    output[offset++] = (encodedFields.length >>> 8) & 0xff;
    output[offset++] = encodedFields.length & 0xff;
    for (const field of encodedFields) {
      output[offset++] = (field.tag >>> 8) & 0xff;
      output[offset++] = field.tag & 0xff;
      output[offset++] = field.typeCode;
      writeUint64(output, offset, field.value.length);
      offset += 8;
      output.set(field.value, offset);
      offset += field.value.length;
    }
    return { ok: true, value: output, diagnostics: Object.freeze([]) };
  } catch {
    return frameFailure("FRAME_LENGTH_INVALID", limits);
  }
}

function validateFrameInput(input: unknown): FrameValidation {
  if (!isPlainObject(input) || !isFrameKind(input["kind"]))
    return { ok: false, code: "FRAME_KIND_UNKNOWN" };
  if (!Array.isArray(input["fields"]) || types.isProxy(input["fields"]))
    return { ok: false, code: "FRAME_LENGTH_INVALID" };
  const fields: FrameField[] = [];
  for (const field of input["fields"]) {
    const validated = validateFrameField(field);
    if (validated === undefined) return { ok: false, code: "FRAME_FIELD_TYPE_INVALID" };
    fields.push(validated);
  }
  return { ok: true, value: { kind: input["kind"], fields } };
}

type FrameValidation =
  | { readonly ok: true; readonly value: FrameInput }
  | {
      readonly ok: false;
      readonly code: "FRAME_FIELD_TYPE_INVALID" | "FRAME_KIND_UNKNOWN" | "FRAME_LENGTH_INVALID";
    };

function validateFrameField(input: unknown): FrameField | undefined {
  if (!isPlainObject(input)) return undefined;
  const entries = inspectPlainObject(input);
  if (entries === undefined) return undefined;
  const properties = new Map(entries);
  const tag = properties.get("tag");
  const type = properties.get("type");
  if (typeof tag !== "number" || typeof type !== "string") return undefined;
  if (type === "bytes") {
    const value = properties.get("value");
    if (types.isProxy(value) || !(value instanceof Uint8Array)) return undefined;
    return { tag, type, value };
  }
  if (type === "utf8") {
    const value = properties.get("value");
    if (typeof value !== "string") return undefined;
    return { tag, type, value };
  }
  if (type === "uint64") {
    const value = properties.get("value");
    if (typeof value !== "number") return undefined;
    return { tag, type, value };
  }
  if (type === "none" && !properties.has("value")) return { tag, type };
  return undefined;
}

function isFrameKind(value: unknown): value is FrameKind {
  return value === "content" || value === "record" || value === "link" || value === "evidence";
}

interface EncodedField {
  readonly tag: number;
  readonly typeCode: number;
  readonly value: Uint8Array;
}

function encodeField(field: FrameField, limits: Limits): OperationResult<EncodedField> {
  if (field.type === "bytes") {
    return successField(field.tag, 0x01, field.value);
  }
  if (field.type === "utf8") {
    const encoded = encodeUtf8(field.value, limits.maxPayloadBytes);
    if (!encoded.ok) return encoded;
    return successField(field.tag, 0x02, encoded.value);
  }
  if (field.type === "uint64") {
    if (!Number.isSafeInteger(field.value) || field.value < 0)
      return frameFailure("FRAME_LENGTH_INVALID", limits);
    return successField(field.tag, 0x03, uint64Bytes(field.value));
  }
  return successField(field.tag, 0x04, new Uint8Array(0));
}

function encodeTrustedField(field: FrameField, limits: Limits): EncodedField {
  if (field.type === "bytes") return { tag: field.tag, typeCode: 0x01, value: field.value };
  if (field.type === "utf8") {
    const value = UTF8_ENCODER.encode(field.value);
    if (value.length > limits.maxPayloadBytes) throw new RangeError("frame field too large");
    return { tag: field.tag, typeCode: 0x02, value };
  }
  if (field.type === "uint64")
    return { tag: field.tag, typeCode: 0x03, value: uint64Bytes(field.value) };
  return { tag: field.tag, typeCode: 0x04, value: new Uint8Array(0) };
}

function successField(
  tag: number,
  typeCode: number,
  value: Uint8Array,
): OperationResult<EncodedField> {
  return {
    ok: true,
    value: Object.freeze({ tag, typeCode, value: Uint8Array.from(value) }),
    diagnostics: Object.freeze([]),
  };
}

function uint16Bytes(value: number): Uint8Array {
  return Uint8Array.of((value >>> 8) & 0xff, value & 0xff);
}

function uint64Bytes(value: number): Uint8Array {
  const output = new Uint8Array(8);
  let remaining = BigInt(value);
  for (let index = 7; index >= 0; index -= 1) {
    output[index] = Number(remaining & 0xffn);
    remaining >>= 8n;
  }
  return output;
}

function writeUint64(output: Uint8Array, offset: number, value: number): void {
  let remaining = BigInt(value);
  for (let index = offset + 7; index >= offset; index -= 1) {
    output[index] = Number(remaining & 0xffn);
    remaining >>= 8n;
  }
}

function frameFailure<T = Uint8Array>(
  code:
    | "FRAME_FIELD_DUPLICATE"
    | "FRAME_FIELD_ORDER_INVALID"
    | "FRAME_FIELD_TYPE_INVALID"
    | "FRAME_KIND_UNKNOWN"
    | "FRAME_LENGTH_INVALID",
  limits: Limits,
): OperationResult<T> {
  const collector = new DiagnosticCollector(limits);
  collector.addCode(code, "input");
  return failure(collector.finish());
}
