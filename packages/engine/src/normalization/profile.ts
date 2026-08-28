// SPDX-License-Identifier: Apache-2.0

import type { ProfileId } from "../domain/identifiers.js";
import type { Limits } from "../domain/limits.js";
import type { OperationResult } from "../domain/operation-result.js";
import type { ProfileVersion } from "../domain/version.js";
import type { ByteSink } from "./byte-sink.js";

/** @public */
export type NormalizationInputKind = "json" | "bytes";

/** @public */
export interface NormalizationStats {
  readonly byteLength: number;
}

export interface NormalizationProfile<I = unknown> {
  readonly id: ProfileId;
  readonly version: ProfileVersion;
  readonly inputKind: NormalizationInputKind;
  validate(input: unknown, limits: Limits): OperationResult<I>;
  normalize(input: I, sink: ByteSink, limits: Limits): OperationResult<NormalizationStats>;
}

export interface NormalizedBytes {
  readonly bytes: Uint8Array;
  readonly stats: NormalizationStats;
}
