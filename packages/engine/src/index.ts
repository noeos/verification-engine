// SPDX-License-Identifier: Apache-2.0

export { DIAGNOSTIC_CODES } from "./contracts/generated.js";
export type {
  DiagnosticCode,
  DiagnosticFamily,
  DiagnosticSeverity,
} from "./contracts/generated.js";
export { createEngine, EngineConfigurationError } from "./api/engine.js";
export { BUILTIN_PROFILES } from "./profiles.js";
export type { BuiltinProfile } from "./profiles.js";
export type {
  ByteSink,
  ChainBuilder,
  ChainConfig,
  ChainVerificationConfig,
  Engine,
  EngineEvent,
  EngineEventName,
  EngineOptions,
  NormalizationProfile,
  ProfileManifest,
  StreamOptions,
  VerifyChainInput,
  VerifyChainRecord,
  VerifyRecordInput,
  VerifyStreamInput,
} from "./api/types.js";
export type {
  AlgorithmId,
  BoundaryState,
  ChainRecordInput,
  ChainSummaryEvidence,
  ChainSnapshot,
  Diagnostic,
  DiagnosticDetails,
  DiagnosticSummary,
  DiagnosticPhase,
  DuplicatePolicy,
  Digest,
  Evidence,
  LinkEvidence,
  Limits,
  OperationResult,
  ProfileReference,
  PreviousLink,
  RecordEvidence,
  RecordEvidenceFields,
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
} from "./api/types.js";
export {
  CHAIN_SUMMARY_EVIDENCE_SCHEMA,
  DIAGNOSTIC_SCHEMA,
  LINK_EVIDENCE_SCHEMA,
  RECORD_EVIDENCE_SCHEMA,
} from "./api/types.js";
