// SPDX-License-Identifier: Apache-2.0

import type { AlgorithmId } from "../domain/algorithm-id.js";
import type {
  ChainRecordInput,
  ChainSnapshot,
  ProfileReference,
  RecordInput,
} from "../domain/chain.js";
import type { PreviousLink } from "../domain/evidence.js";
import type { Diagnostic, DiagnosticPhase, DiagnosticSeverity } from "../domain/diagnostic.js";
import type {
  BoundaryState,
  DiagnosticSummary,
  ChainSummaryEvidence,
  Evidence,
  LinkEvidence,
  RecordEvidenceFields,
  RecordEvidence,
  VerificationResult,
  VerificationMode,
  VerificationStats,
  VerificationStatus,
} from "../domain/evidence.js";
import {
  CHAIN_SUMMARY_EVIDENCE_SCHEMA,
  LINK_EVIDENCE_SCHEMA,
  RECORD_EVIDENCE_SCHEMA,
} from "../domain/evidence.js";
import type { DiagnosticDetails } from "../domain/diagnostic.js";
import { DIAGNOSTIC_SCHEMA } from "../domain/diagnostic.js";
import type { Digest } from "../domain/digest.js";
import type { Limits } from "../domain/limits.js";
import type { OperationResult } from "../domain/operation-result.js";
import type { DuplicatePolicy } from "../domain/duplicate-policy.js";
import type {
  Rule,
  RuleContext,
  RuleFinding,
  RulePhase,
  ReadonlyByteView,
} from "../domain/rule.js";
import type { NormalizationInputKind, NormalizationStats } from "../normalization/profile.js";

export type {
  AlgorithmId,
  ChainRecordInput,
  ChainSummaryEvidence,
  ChainSnapshot,
  BoundaryState,
  Diagnostic,
  DiagnosticDetails,
  DiagnosticPhase,
  DiagnosticSeverity,
  DuplicatePolicy,
  Digest,
  DiagnosticSummary,
  Evidence,
  LinkEvidence,
  Limits,
  OperationResult,
  ProfileReference,
  PreviousLink,
  RecordEvidenceFields,
  RecordEvidence,
  RecordInput,
  Rule,
  RuleContext,
  RuleFinding,
  RulePhase,
  ReadonlyByteView,
  VerificationResult,
  VerificationMode,
  VerificationStats,
  VerificationStatus,
  NormalizationInputKind,
  NormalizationStats,
};

export {
  CHAIN_SUMMARY_EVIDENCE_SCHEMA,
  DIAGNOSTIC_SCHEMA,
  LINK_EVIDENCE_SCHEMA,
  RECORD_EVIDENCE_SCHEMA,
};

/** @public */
export interface ByteSink {
  readonly byteLength: number;
  write(value: Uint8Array): void;
}

/** @public */
export interface ProfileManifest {
  readonly name: string;
  readonly version: string;
  readonly vectorSha256: string;
  readonly limits: Limits;
  readonly license: string;
}

/** @public */
export interface NormalizationProfile<I = unknown> {
  readonly id: string;
  readonly version: string;
  readonly inputKind: NormalizationInputKind;
  readonly manifest: ProfileManifest;
  validate(input: unknown, limits: Limits): OperationResult<I>;
  normalize(input: I, sink: ByteSink, limits: Limits): OperationResult<NormalizationStats>;
}

/** @public */
export type EngineEventName =
  | "operation.started"
  | "record.validated"
  | "record.hashed"
  | "link.created"
  | "diagnostic.emitted"
  | "operation.completed"
  | "operation.aborted";

/** @public */
export interface EngineEvent {
  readonly name: EngineEventName;
  readonly operation: string;
  readonly recordsSeen: number;
  readonly bytesNormalized: number;
  readonly code?: string;
  readonly recordId?: string;
  readonly position?: number;
}

/** @public */
export interface EngineOptions {
  readonly profiles?: readonly NormalizationProfile[];
  readonly rules?: readonly Rule[];
  readonly limits?: Partial<Limits>;
  readonly duplicatePolicy?: DuplicatePolicy;
  readonly onEvent?: (event: EngineEvent) => void;
}

/** @public */
export interface VerifyRecordInput {
  readonly payload: unknown;
  readonly evidence: unknown;
}

/** @public */
export interface VerifyChainRecord {
  readonly payload: unknown;
  readonly evidence: unknown;
}

/** @public */
export interface ChainVerificationConfig {
  readonly contextId: string;
  readonly sequenceId: string;
  readonly profile: ProfileReference;
  readonly algorithm: AlgorithmId;
  readonly expectedCount?: number;
  readonly expectedFinalLinkDigest?: string;
  readonly expectedPrevious?: PreviousLink;
  readonly startPosition?: number;
  readonly allowEmpty?: boolean;
  readonly duplicatePolicy?: DuplicatePolicy;
}

/** @public */
export interface VerifyChainInput extends ChainVerificationConfig {
  readonly mode: "complete" | "fragment" | "internal";
  readonly records: Iterable<VerifyChainRecord>;
}

/** @public */
export interface VerifyStreamInput extends ChainVerificationConfig {
  readonly mode: "complete" | "fragment" | "internal";
  readonly records: AsyncIterable<VerifyChainRecord>;
  readonly signal?: AbortSignal;
}

/** @public */
export interface StreamOptions {
  readonly signal?: AbortSignal;
  readonly onEvidence?: (evidence: LinkEvidence) => void | Promise<void>;
}

/** @public */
/** @public */
export interface ChainConfig {
  readonly contextId: string;
  readonly sequenceId: string;
  readonly profile: ProfileReference;
  readonly algorithm: AlgorithmId;
  readonly duplicatePolicy?: DuplicatePolicy;
  readonly allowEmpty?: boolean;
}

/** @public */
export interface ChainBuilder {
  append(input: ChainRecordInput): OperationResult<LinkEvidence>;
  appendAll(input: Iterable<ChainRecordInput>): OperationResult<ChainSummaryEvidence>;
  appendStream(
    input: AsyncIterable<ChainRecordInput>,
    options?: StreamOptions,
  ): Promise<OperationResult<ChainSummaryEvidence>>;
  snapshot(): ChainSnapshot;
  finalize(): OperationResult<ChainSummaryEvidence>;
  abort(reason?: string): void;
}

/** @public */
export interface Engine {
  hashRecord(input: RecordInput): OperationResult<RecordEvidence>;
  verifyRecord(input: VerifyRecordInput): VerificationResult<RecordEvidence>;
  createChain(config: ChainConfig): ChainBuilder;
  verifyChain(input: VerifyChainInput): VerificationResult<ChainSummaryEvidence>;
  verifyStream(input: VerifyStreamInput): Promise<VerificationResult<ChainSummaryEvidence>>;
  digestEvidence(input: Evidence): OperationResult<Digest>;
}
