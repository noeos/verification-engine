// SPDX-License-Identifier: Apache-2.0

import type { JsonArray, JsonObject, JsonValue } from "../domain/json-value.js";
import type { Limits } from "../domain/limits.js";
import type { OperationResult } from "../domain/operation-result.js";
import { ProfileId } from "../domain/identifiers.js";
import { ProfileVersion } from "../domain/version.js";
import { success } from "../domain/operation-result.js";
import { validateJsonValue } from "../validation/json-value-validation.js";
import type { ByteSink } from "./byte-sink.js";
import type { NormalizationProfile, NormalizationStats } from "./profile.js";

const JCS_PROFILE_ID = ProfileId.fromValidated("dev.noeos.jcs");
const JCS_PROFILE_VERSION = ProfileVersion.fromValidated("1.0.0");

export const jcsProfile: NormalizationProfile<JsonValue> = Object.freeze({
  id: JCS_PROFILE_ID,
  version: JCS_PROFILE_VERSION,
  inputKind: "json",
  validate(input: unknown, limits: Limits): OperationResult<JsonValue> {
    return validateJsonValue(input, limits);
  },
  normalize(input: JsonValue, sink: ByteSink): OperationResult<NormalizationStats> {
    writeValue(input, sink);
    return success(Object.freeze({ byteLength: sink.byteLength }));
  },
});

function writeValue(value: JsonValue, sink: ByteSink): void {
  if (value === null) {
    writeText("null", sink);
    return;
  }
  if (typeof value === "boolean") {
    writeText(value ? "true" : "false", sink);
    return;
  }
  if (typeof value === "number") {
    writeText(numberToJcs(value), sink);
    return;
  }
  if (typeof value === "string") {
    writeText(stringToJcs(value), sink);
    return;
  }
  if (isJsonArray(value)) {
    writeArray(value, sink);
    return;
  }
  writeObject(value, sink);
}

function isJsonArray(value: JsonValue): value is JsonArray {
  return Array.isArray(value);
}

function writeArray(value: JsonArray, sink: ByteSink): void {
  writeText("[", sink);
  for (let index = 0; index < value.length; index += 1) {
    if (index > 0) writeText(",", sink);
    const item = value[index];
    if (item === undefined) throw new TypeError("invalid JSON array");
    writeValue(item, sink);
  }
  writeText("]", sink);
}

function writeObject(value: JsonObject, sink: ByteSink): void {
  const keys = Object.keys(value).sort(compareUtf16);
  writeText("{", sink);
  let first = true;
  for (const key of keys) {
    if (!first) writeText(",", sink);
    first = false;
    const item = value[key];
    if (item === undefined) throw new TypeError("invalid JSON object");
    writeText(stringToJcs(key), sink);
    writeText(":", sink);
    writeValue(item, sink);
  }
  writeText("}", sink);
}

function stringToJcs(value: string): string {
  let output = '"';
  for (let index = 0; index < value.length; index += 1) {
    const codeUnit = value.charCodeAt(index);
    switch (codeUnit) {
      case 0x08:
        output += "\\b";
        break;
      case 0x09:
        output += "\\t";
        break;
      case 0x0a:
        output += "\\n";
        break;
      case 0x0c:
        output += "\\f";
        break;
      case 0x0d:
        output += "\\r";
        break;
      case 0x22:
        output += '\\"';
        break;
      case 0x5c:
        output += "\\\\";
        break;
      default:
        if (codeUnit <= 0x1f) output += `\\u${codeUnit.toString(16).padStart(4, "0")}`;
        else output += value.charAt(index);
    }
  }
  return `${output}"`;
}

function numberToJcs(value: number): string {
  if (Object.is(value, -0)) return "0";
  if (!Number.isFinite(value) || (Number.isInteger(value) && !Number.isSafeInteger(value))) {
    throw new TypeError("invalid JSON number");
  }
  return JSON.stringify(value);
}

function writeText(value: string, sink: ByteSink): void {
  sink.write(new TextEncoder().encode(value));
}

function compareUtf16(left: string, right: string): number {
  return left < right ? -1 : 1;
}
