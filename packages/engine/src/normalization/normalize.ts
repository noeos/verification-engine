// SPDX-License-Identifier: Apache-2.0

import type { Limits } from "../domain/limits.js";
import type { OperationResult } from "../domain/operation-result.js";
import { failure } from "../domain/operation-result.js";
import { ByteArraySink } from "./byte-sink.js";
import type { NormalizationProfile, NormalizationStats, NormalizedBytes } from "./profile.js";
import { DiagnosticCollector } from "../validation/diagnostic-collector.js";

interface RegisteredNormalizationProfile {
  normalize(
    input: unknown,
    sink: ByteArraySink,
    limits: Limits,
  ): OperationResult<NormalizationStats>;
  normalizeValidated?(
    input: unknown,
    sink: ByteArraySink,
    limits: Limits,
  ): OperationResult<NormalizationStats>;
}

export function normalizeToBytes<I>(
  profile: NormalizationProfile<I>,
  input: unknown,
  limits: Limits,
): OperationResult<NormalizedBytes> {
  const validated = profile.validate(input, limits);
  if (!validated.ok) return validated;
  const sink = new ByteArraySink(limits.maxPayloadBytes, initialCapacity(input));
  try {
    const normalized = profile.normalize(validated.value, sink, limits);
    if (!normalized.ok) return normalized;
    if (normalized.value.byteLength !== sink.byteLength) return normalizationFailure(limits);
    const bytes = sink.takeBytes();
    return {
      ok: true,
      value: Object.freeze({ bytes, stats: normalized.value }),
      diagnostics: normalized.diagnostics,
    };
  } catch {
    return normalizationFailure(limits);
  }
}

export function normalizeRegisteredToBytes(
  profile: RegisteredNormalizationProfile,
  input: unknown,
  limits: Limits,
): OperationResult<NormalizedBytes> {
  const sink = new ByteArraySink(limits.maxPayloadBytes, initialCapacity(input));
  try {
    const normalized = (profile.normalizeValidated ?? profile.normalize)(input, sink, limits);
    if (!normalized.ok) return normalized;
    if (normalized.value.byteLength !== sink.byteLength) return normalizationFailure(limits);
    return {
      ok: true,
      value: Object.freeze({ bytes: sink.takeBytes(), stats: normalized.value }),
      diagnostics: normalized.diagnostics,
    };
  } catch {
    return normalizationFailure(limits);
  }
}

function normalizationFailure(limits: Limits): OperationResult<NormalizedBytes> {
  const collector = new DiagnosticCollector(limits);
  collector.addCode("NORMALIZATION_FAILED", "normalization");
  return failure(collector.finish());
}

function initialCapacity(input: unknown): number {
  return input instanceof Uint8Array ? input.length : 0;
}
