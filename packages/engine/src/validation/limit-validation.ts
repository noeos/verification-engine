// SPDX-License-Identifier: Apache-2.0

import { DEFAULT_LIMITS, HARD_LIMITS } from "../domain/limits.js";
import type { Limits } from "../domain/limits.js";
import type { OperationResult } from "../domain/operation-result.js";
import { success } from "../domain/operation-result.js";
import { createDiagnostic } from "./diagnostic-collector.js";
import { failureWithCode } from "./result-helpers.js";
import { inspectPlainObject } from "./object-inspection.js";

const limitKeys = Object.freeze([
  "maxPayloadBytes",
  "maxJsonDepth",
  "maxObjectProperties",
  "maxArrayElements",
  "maxStringBytes",
  "maxNdjsonLineBytes",
  "maxDiagnostics",
  "maxFullRecords",
] as const);
type LimitKey = (typeof limitKeys)[number];

export function validateLimits(value: unknown): OperationResult<Limits> {
  if (value === undefined) return success(DEFAULT_LIMITS);
  const properties = inspectPlainObject(value);
  if (properties === undefined) return failureWithCode("INPUT_TYPE_INVALID", "input");
  const provided = new Map(properties);
  for (const name of provided.keys()) {
    if (!isLimitKey(name)) return failureWithCode("INPUT_TYPE_INVALID", "input");
  }
  const entries: Record<LimitKey, number> = {
    maxPayloadBytes: DEFAULT_LIMITS.maxPayloadBytes,
    maxJsonDepth: DEFAULT_LIMITS.maxJsonDepth,
    maxObjectProperties: DEFAULT_LIMITS.maxObjectProperties,
    maxArrayElements: DEFAULT_LIMITS.maxArrayElements,
    maxStringBytes: DEFAULT_LIMITS.maxStringBytes,
    maxNdjsonLineBytes: DEFAULT_LIMITS.maxNdjsonLineBytes,
    maxDiagnostics: DEFAULT_LIMITS.maxDiagnostics,
    maxFullRecords: DEFAULT_LIMITS.maxFullRecords,
  };
  for (const name of limitKeys) {
    const candidate = provided.has(name) ? provided.get(name) : DEFAULT_LIMITS[name];
    if (
      typeof candidate !== "number" ||
      !Number.isSafeInteger(candidate) ||
      candidate <= 0 ||
      candidate > HARD_LIMITS[name]
    ) {
      return failureWithCode("INPUT_LIMIT_EXCEEDED", "input");
    }
    entries[name] = candidate;
  }
  const limits: Limits = {
    maxPayloadBytes: entries.maxPayloadBytes,
    maxJsonDepth: entries.maxJsonDepth,
    maxObjectProperties: entries.maxObjectProperties,
    maxArrayElements: entries.maxArrayElements,
    maxStringBytes: entries.maxStringBytes,
    maxNdjsonLineBytes: entries.maxNdjsonLineBytes,
    maxDiagnostics: entries.maxDiagnostics,
    maxFullRecords: entries.maxFullRecords,
  };
  return success(Object.freeze(limits));
}

function isLimitKey(value: string): value is LimitKey {
  return (limitKeys as readonly string[]).includes(value);
}

export function validateLimitValue(value: number, maximum: number): OperationResult<number> {
  if (!Number.isSafeInteger(value) || value <= 0 || value > maximum) {
    return {
      ok: false,
      diagnostics: Object.freeze([createDiagnostic("INPUT_LIMIT_EXCEEDED", "input")]),
    };
  }
  return success(value);
}
