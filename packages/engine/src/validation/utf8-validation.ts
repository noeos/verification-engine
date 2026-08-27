// SPDX-License-Identifier: Apache-2.0

import type { OperationResult } from "../domain/operation-result.js";
import { success } from "../domain/operation-result.js";
import { failureWithCode } from "./result-helpers.js";

const encoder = new TextEncoder();
const decoder = new TextDecoder("utf-8", { fatal: true, ignoreBOM: false });

export function hasWellFormedUnicode(value: string): boolean {
  for (let index = 0; index < value.length; index += 1) {
    const codeUnit = value.charCodeAt(index);
    if (codeUnit >= 0xd800 && codeUnit <= 0xdbff) {
      const next = value.charCodeAt(index + 1);
      if (Number.isNaN(next) || next < 0xdc00 || next > 0xdfff) return false;
      index += 1;
    } else if (codeUnit >= 0xdc00 && codeUnit <= 0xdfff) {
      return false;
    }
  }
  return true;
}

export function encodeUtf8(value: unknown, maxBytes: number): OperationResult<Uint8Array> {
  if (typeof value !== "string" || !hasWellFormedUnicode(value)) {
    return failureWithCode("UTF8_INVALID", "input");
  }
  const bytes = encoder.encode(value);
  if (bytes.length > maxBytes) return failureWithCode("INPUT_LIMIT_EXCEEDED", "input");
  return success(bytes);
}

export function decodeUtf8(value: Uint8Array): OperationResult<string> {
  if (value.length >= 3 && value[0] === 0xef && value[1] === 0xbb && value[2] === 0xbf) {
    return failureWithCode("UTF8_INVALID", "input");
  }
  try {
    const decoded = decoder.decode(value);
    return success(decoded);
  } catch {
    return failureWithCode("UTF8_INVALID", "input");
  }
}
