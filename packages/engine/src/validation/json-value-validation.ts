// SPDX-License-Identifier: Apache-2.0

import { types } from "node:util";
import type { JsonArray, JsonObject, JsonValue } from "../domain/json-value.js";
import type { Limits } from "../domain/limits.js";
import type { OperationResult } from "../domain/operation-result.js";
import { failure, success } from "../domain/operation-result.js";
import { DiagnosticCollector } from "./diagnostic-collector.js";
import { inspectPlainObject, isDataPropertyDescriptor } from "./object-inspection.js";
import { hasWellFormedUnicode, encodeUtf8 } from "./utf8-validation.js";

export function validateJsonValue(value: unknown, limits: Limits): OperationResult<JsonValue> {
  const collector = new DiagnosticCollector(limits);
  const active = new WeakSet();
  const validated = validateValue(value, "", 0, limits, collector, active);
  const diagnostics = collector.finish();
  if (validated === undefined || collector.hasErrors()) return failure(diagnostics);
  return success(validated, diagnostics);
}

function validateValue(
  value: unknown,
  path: string,
  depth: number,
  limits: Limits,
  collector: DiagnosticCollector,
  active: WeakSet<object>,
): JsonValue | undefined {
  if (depth > limits.maxJsonDepth) {
    collector.addCode("INPUT_LIMIT_EXCEEDED", "input", { path });
    return undefined;
  }
  if (value === null || typeof value === "boolean") return value;
  if (typeof value === "string") return validateString(value, path, limits, collector);
  if (typeof value === "number") return validateNumber(value, path, collector);
  if (typeof value !== "object") {
    collector.addCode("JSON_VALUE_UNSUPPORTED", "input", { path });
    return undefined;
  }
  if (types.isProxy(value) || active.has(value)) {
    collector.addCode("JSON_VALUE_UNSUPPORTED", "input", { path });
    return undefined;
  }
  active.add(value);
  try {
    if (Array.isArray(value)) return validateArray(value, path, depth, limits, collector, active);
    return validateObject(value, path, depth, limits, collector, active);
  } finally {
    active.delete(value);
  }
}

function validateString(
  value: string,
  path: string,
  limits: Limits,
  collector: DiagnosticCollector,
): string | undefined {
  if (!hasWellFormedUnicode(value)) {
    collector.addCode("UTF8_INVALID", "input", { path });
    return undefined;
  }
  const encoded = encodeUtf8(value, limits.maxStringBytes);
  if (!encoded.ok) {
    collector.addCode("INPUT_LIMIT_EXCEEDED", "input", { path });
    return undefined;
  }
  return value;
}

function validateNumber(
  value: number,
  path: string,
  collector: DiagnosticCollector,
): number | undefined {
  if (!Number.isFinite(value)) {
    collector.addCode("JSON_NUMBER_UNSAFE", "input", { path });
    return undefined;
  }
  if (Number.isInteger(value) && !Number.isSafeInteger(value)) {
    collector.addCode("JSON_NUMBER_UNSAFE", "input", { path });
    return undefined;
  }
  return value;
}

function validateArray(
  value: readonly unknown[],
  path: string,
  depth: number,
  limits: Limits,
  collector: DiagnosticCollector,
  active: WeakSet<object>,
): JsonArray | undefined {
  const descriptors = Object.getOwnPropertyDescriptors(value);
  const symbols = Object.getOwnPropertySymbols(value);
  const lengthDescriptor = Object.getOwnPropertyDescriptor(value, "length");
  if (
    symbols.length !== 0 ||
    lengthDescriptor === undefined ||
    !isDataPropertyDescriptor(lengthDescriptor)
  ) {
    collector.addCode("JSON_VALUE_UNSUPPORTED", "input", { path });
    return undefined;
  }
  const length = lengthDescriptor.value;
  if (
    typeof length !== "number" ||
    !Number.isSafeInteger(length) ||
    length > limits.maxArrayElements
  ) {
    collector.addCode("INPUT_LIMIT_EXCEEDED", "input", { path });
    return undefined;
  }
  for (const [name, descriptor] of Object.entries(descriptors)) {
    if (name === "length") continue;
    if (
      !isArrayIndex(name) ||
      descriptor.enumerable !== true ||
      descriptor.get !== undefined ||
      descriptor.set !== undefined
    ) {
      collector.addCode("JSON_VALUE_UNSUPPORTED", "input", { path });
      return undefined;
    }
  }
  const output: JsonValue[] = [];
  for (let index = 0; index < length; index += 1) {
    const descriptor = descriptors[String(index)];
    if (descriptor === undefined || !isDataPropertyDescriptor(descriptor)) {
      collector.addCode("JSON_VALUE_UNSUPPORTED", "input", { path });
      return undefined;
    }
    const itemPath = `${path}/${String(index)}`;
    const item = validateValue(descriptor.value, itemPath, depth + 1, limits, collector, active);
    if (item === undefined) return undefined;
    output.push(item);
  }
  return Object.freeze(output);
}

function validateObject(
  value: object,
  path: string,
  depth: number,
  limits: Limits,
  collector: DiagnosticCollector,
  active: WeakSet<object>,
): JsonObject | undefined {
  const properties = inspectPlainObject(value);
  if (properties === undefined) {
    collector.addCode("JSON_VALUE_UNSUPPORTED", "input", { path });
    return undefined;
  }
  if (properties.length > limits.maxObjectProperties) {
    collector.addCode("INPUT_LIMIT_EXCEEDED", "input", { path });
    return undefined;
  }
  const output: Record<string, JsonValue> = {};
  for (const [name, property] of properties) {
    const key = validateString(name, path, limits, collector);
    if (key === undefined) return undefined;
    const propertyPath = `${path}/${escapeJsonPointer(key)}`;
    const item = validateValue(property, propertyPath, depth + 1, limits, collector, active);
    if (item === undefined) return undefined;
    Object.defineProperty(output, key, {
      configurable: false,
      enumerable: true,
      value: item,
      writable: false,
    });
  }
  return Object.freeze(output);
}

function isArrayIndex(name: string): boolean {
  if (!/^(?:0|[1-9][0-9]*)$/u.test(name)) return false;
  const value = Number(name);
  return (
    Number.isSafeInteger(value) && value >= 0 && value < 4_294_967_295 && String(value) === name
  );
}

function escapeJsonPointer(value: string): string {
  return value.replaceAll("~", "~0").replaceAll("/", "~1");
}
