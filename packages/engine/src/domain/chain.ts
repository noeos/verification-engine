// SPDX-License-Identifier: Apache-2.0

import type { AlgorithmId } from "./algorithm-id.js";
import type { DuplicatePolicy } from "./duplicate-policy.js";
import type { PreviousLink } from "./evidence.js";
import type { Rule } from "./rule.js";

export interface ProfileReference {
  readonly id: string;
  readonly version: string;
}

export interface RecordInput {
  readonly contextId: string;
  readonly recordId: string;
  readonly payload: unknown;
  readonly profile: ProfileReference;
  readonly algorithm: AlgorithmId;
}

export interface ChainConfig {
  readonly contextId: string;
  readonly sequenceId: string;
  readonly profile: ProfileReference;
  readonly algorithm: AlgorithmId;
  readonly duplicatePolicy?: DuplicatePolicy;
  readonly rules?: readonly Rule[];
  readonly allowEmpty?: boolean;
}

export interface ChainRecordInput {
  readonly recordId: string;
  readonly payload: unknown;
  readonly position: number;
  readonly previous: PreviousLink;
}

export interface ChainSnapshot {
  readonly contextId: string;
  readonly sequenceId: string;
  readonly profile: ProfileReference;
  readonly algorithm: AlgorithmId;
  readonly nextPosition: number;
  readonly previous: PreviousLink;
  readonly count: number;
}
