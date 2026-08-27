// SPDX-License-Identifier: Apache-2.0

export interface Limits {
  readonly maxPayloadBytes: number;
  readonly maxJsonDepth: number;
  readonly maxObjectProperties: number;
  readonly maxArrayElements: number;
  readonly maxStringBytes: number;
  readonly maxNdjsonLineBytes: number;
  readonly maxDiagnostics: number;
  readonly maxFullRecords: number;
}

export const DEFAULT_LIMITS: Limits = Object.freeze({
  maxPayloadBytes: 1 * 1024 * 1024,
  maxJsonDepth: 64,
  maxObjectProperties: 10_000,
  maxArrayElements: 100_000,
  maxStringBytes: 1 * 1024 * 1024,
  maxNdjsonLineBytes: 1 * 1024 * 1024,
  maxDiagnostics: 1_000,
  maxFullRecords: 1_000_000,
});

export const HARD_LIMITS: Limits = Object.freeze({
  maxPayloadBytes: 16 * 1024 * 1024,
  maxJsonDepth: 128,
  maxObjectProperties: 100_000,
  maxArrayElements: 1_000_000,
  maxStringBytes: 16 * 1024 * 1024,
  maxNdjsonLineBytes: 16 * 1024 * 1024,
  maxDiagnostics: 10_000,
  maxFullRecords: 5_000_000,
});
