// SPDX-License-Identifier: Apache-2.0

import { types } from "node:util";
import type { Limits } from "../domain/limits.js";
import type { OperationResult } from "../domain/operation-result.js";
import { failure } from "../domain/operation-result.js";
import { DiagnosticCollector } from "../validation/diagnostic-collector.js";
import { decodeUtf8 } from "../validation/utf8-validation.js";
import type { FrameField, FrameFieldType, FrameKind, ParsedFrame } from "./frame-types.js";

const MAGIC = "NOEOSVE1";
const HEADER_LENGTH = 13;
const KIND_NAMES: Readonly<Record<number, FrameKind>> = Object.freeze({
  1: "content",
  2: "record",
  3: "link",
  4: "evidence",
});
const TYPE_NAMES: Readonly<Record<number, FrameFieldType>> = Object.freeze({
  1: "bytes",
  2: "utf8",
  3: "uint64",
  4: "none",
});

export function parseFrame(input: unknown, limits: Limits): OperationResult<ParsedFrame> {
  if (types.isProxy(input) || !(input instanceof Uint8Array))
    return frameFailure("FRAME_LENGTH_INVALID", limits);
  if (input.length > limits.maxPayloadBytes) return frameFailure("INPUT_LIMIT_EXCEEDED", limits);
  if (input.length < HEADER_LENGTH) return frameFailure("FRAME_LENGTH_INVALID", limits);
  const view = new DataView(input.buffer, input.byteOffset, input.byteLength);
  for (let index = 0; index < MAGIC.length; index += 1) {
    if (view.getUint8(index) !== MAGIC.charCodeAt(index))
      return frameFailure("FRAME_MAGIC_INVALID", limits);
  }
  const kind = KIND_NAMES[view.getUint8(8)];
  if (kind === undefined) return frameFailure("FRAME_KIND_UNKNOWN", limits);
  if (view.getUint8(9) !== 0 || view.getUint8(10) !== 1)
    return frameFailure("FRAME_VERSION_UNSUPPORTED", limits);
  const fieldCount = view.getUint16(11);
  let offset = HEADER_LENGTH;
  let previousTag = 0;
  const fields: FrameField[] = [];
  for (let index = 0; index < fieldCount; index += 1) {
    if (offset + 11 > input.length) return frameFailure("FRAME_LENGTH_INVALID", limits);
    const tag = view.getUint16(offset);
    offset += 2;
    const expected = expectedField(kind, tag);
    if (tag === 0 || expected === undefined) return frameFailure("FRAME_FIELD_UNKNOWN", limits);
    if (tag === previousTag) return frameFailure("FRAME_FIELD_DUPLICATE", limits);
    if (tag < previousTag) return frameFailure("FRAME_FIELD_ORDER_INVALID", limits);
    previousTag = tag;
    const typeCode = view.getUint8(offset);
    offset += 1;
    const type = TYPE_NAMES[typeCode];
    if (type === undefined) return frameFailure("FRAME_FIELD_TYPE_INVALID", limits);
    const length = readUint64(view, offset);
    if (length === undefined) return frameFailure("FRAME_LENGTH_INVALID", limits);
    offset += 8;
    if (length > input.length - offset) return frameFailure("FRAME_LENGTH_INVALID", limits);
    if (!expected.types.includes(type)) return frameFailure("FRAME_FIELD_TYPE_INVALID", limits);
    const value = readValue(tag, type, input.subarray(offset, offset + length), limits);
    if (!value.ok) return value;
    fields.push(value.value);
    offset += length;
  }
  if (offset !== input.length) return frameFailure("FRAME_TRAILING_DATA", limits);
  const expectedFields = expectedFieldsFor(kind);
  if (fields.length !== expectedFields.length) {
    return frameFailure("FRAME_FIELD_MISSING", limits);
  }
  return {
    ok: true,
    value: Object.freeze({ kind, protocolVersion: 1, fields: Object.freeze(fields) }),
    diagnostics: Object.freeze([]),
  };
}

interface ExpectedField {
  readonly tag: number;
  readonly types: readonly FrameFieldType[];
}

function expectedFieldsFor(kind: FrameKind): readonly ExpectedField[] {
  const text: readonly FrameFieldType[] = ["utf8"];
  const bytes: readonly FrameFieldType[] = ["bytes"];
  const uint64: readonly FrameFieldType[] = ["uint64"];
  if (kind === "content")
    return [
      { tag: 1, types: text },
      { tag: 2, types: text },
      { tag: 3, types: text },
      { tag: 4, types: bytes },
    ];
  if (kind === "record")
    return [
      { tag: 1, types: text },
      { tag: 2, types: text },
      { tag: 3, types: text },
      { tag: 4, types: text },
      { tag: 5, types: text },
      { tag: 6, types: uint64 },
      { tag: 7, types: bytes },
    ];
  if (kind === "link")
    return [
      { tag: 1, types: text },
      { tag: 2, types: text },
      { tag: 3, types: text },
      { tag: 4, types: uint64 },
      { tag: 5, types: text },
      { tag: 6, types: bytes },
      { tag: 7, types: ["none", "bytes"] },
    ];
  return [
    { tag: 1, types: text },
    { tag: 2, types: text },
    { tag: 3, types: bytes },
  ];
}

function expectedField(kind: FrameKind, tag: number): ExpectedField | undefined {
  return expectedFieldsFor(kind).find((field) => field.tag === tag);
}

function readValue(
  tag: number,
  type: FrameFieldType,
  value: Uint8Array,
  limits: Limits,
): OperationResult<FrameField> {
  if (type === "none") {
    if (value.length !== 0) return frameFailure("FRAME_LENGTH_INVALID", limits);
    return { ok: true, value: { tag, type: "none" }, diagnostics: Object.freeze([]) };
  }
  if (type === "bytes")
    return {
      ok: true,
      value: { tag, type: "bytes", value: Uint8Array.from(value) },
      diagnostics: Object.freeze([]),
    };
  if (type === "utf8") {
    const decoded = decodeUtf8(value);
    if (!decoded.ok) return frameFailure("UTF8_INVALID", limits);
    return {
      ok: true,
      value: { tag, type: "utf8", value: decoded.value },
      diagnostics: Object.freeze([]),
    };
  }
  if (value.length !== 8) return frameFailure("FRAME_LENGTH_INVALID", limits);
  const number = readUint64(new DataView(value.buffer, value.byteOffset, value.byteLength), 0);
  if (number === undefined) return frameFailure("FRAME_LENGTH_INVALID", limits);
  return {
    ok: true,
    value: { tag, type: "uint64", value: number },
    diagnostics: Object.freeze([]),
  };
}

function readUint64(view: DataView, offset: number): number | undefined {
  let value = 0n;
  for (let index = 0; index < 8; index += 1)
    value = (value << 8n) | BigInt(view.getUint8(offset + index));
  if (value > BigInt(Number.MAX_SAFE_INTEGER)) return undefined;
  return Number(value);
}

function frameFailure<T = ParsedFrame>(
  code:
    | "FRAME_MAGIC_INVALID"
    | "FRAME_VERSION_UNSUPPORTED"
    | "FRAME_KIND_UNKNOWN"
    | "FRAME_FIELD_UNKNOWN"
    | "FRAME_FIELD_MISSING"
    | "FRAME_FIELD_DUPLICATE"
    | "FRAME_FIELD_ORDER_INVALID"
    | "FRAME_FIELD_TYPE_INVALID"
    | "FRAME_LENGTH_INVALID"
    | "FRAME_TRAILING_DATA"
    | "INPUT_LIMIT_EXCEEDED"
    | "UTF8_INVALID",
  limits: Limits,
): OperationResult<T> {
  const collector = new DiagnosticCollector(limits);
  collector.addCode(code, "input");
  return failure(collector.finish());
}
