// SPDX-License-Identifier: Apache-2.0

export function encodeFrame(frame) {
  const kind = { content: 1, record: 2, link: 3, evidence: 4 }[frame.kind];
  if (kind === undefined) throw diagnostic("FRAME_KIND_UNKNOWN");
  if (!Array.isArray(frame.fields) || frame.fields.length > 65535)
    throw diagnostic("FRAME_LENGTH_INVALID");
  const parts = [
    Buffer.from("NOEOSVE1", "ascii"),
    Buffer.from([kind, 0, 1, frame.fields.length >> 8, frame.fields.length & 255]),
  ];
  let previous = 0;
  for (const field of frame.fields) {
    if (!Number.isInteger(field.tag) || field.tag < 1 || field.tag > 65535)
      throw diagnostic("FRAME_LENGTH_INVALID");
    if (field.tag <= previous)
      throw diagnostic(
        field.tag === previous ? "FRAME_FIELD_DUPLICATE" : "FRAME_FIELD_ORDER_INVALID",
      );
    previous = field.tag;
    const code = { bytes: 1, utf8: 2, uint64: 3, none: 4 }[field.type];
    if (code === undefined) throw diagnostic("FRAME_FIELD_TYPE_INVALID");
    const value = encodeValue(field);
    const header = Buffer.allocUnsafe(11);
    header.writeUInt16BE(field.tag, 0);
    header.writeUInt8(code, 2);
    header.writeBigUInt64BE(BigInt(value.length), 3);
    parts.push(header, value);
  }
  return Buffer.concat(parts);
}

function encodeValue(field) {
  if (field.type === "none") {
    if (field.value !== undefined) throw diagnostic("FRAME_FIELD_TYPE_INVALID");
    return Buffer.alloc(0);
  }
  if (field.type === "bytes") {
    if (typeof field.value !== "string" || !/^(?:[0-9a-f]{2})*$/u.test(field.value))
      throw diagnostic("DIGEST_ENCODING_INVALID");
    const value = Buffer.from(field.value, "hex");
    const repeat = vectorRepeat(field.repeat);
    if (repeat === 1 || value.length === 0) return value;
    return Buffer.concat(Array.from({ length: repeat }, () => value));
  }
  if (field.type === "utf8") {
    if (typeof field.value !== "string" || /[\uD800-\uDFFF]/u.test(field.value))
      throw diagnostic("UTF8_INVALID");
    return Buffer.from(field.value, "utf8");
  }
  if (!Number.isSafeInteger(field.value) || field.value < 0)
    throw diagnostic("FRAME_LENGTH_INVALID");
  const value = Buffer.allocUnsafe(8);
  value.writeBigUInt64BE(BigInt(field.value));
  return value;
}

function vectorRepeat(repeat) {
  if (repeat === undefined) return 1;
  if (!Number.isSafeInteger(repeat) || repeat < 1 || repeat > 1_000_000)
    throw diagnostic("FRAME_LENGTH_INVALID");
  return repeat;
}

function diagnostic(code) {
  return new Error(code);
}
