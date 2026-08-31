// SPDX-License-Identifier: Apache-2.0

import type { AlgorithmId } from "./algorithm-id.js";
import type { Diagnostic } from "./diagnostic.js";

/** @public */
export const RECORD_EVIDENCE_SCHEMA = "urn:noeos:verification-engine:record-evidence:1" as const;
/** @public */
export const LINK_EVIDENCE_SCHEMA = "urn:noeos:verification-engine:link-evidence:1" as const;
/** @public */
export const CHAIN_SUMMARY_EVIDENCE_SCHEMA =
  "urn:noeos:verification-engine:chain-summary:1" as const;

/** @public */
export interface EvidenceProfile {
  readonly id: string;
  readonly version: string;
}

/** @public */
export interface RecordEvidenceFields {
  readonly protocolVersion: 1;
  readonly contextId: string;
  readonly recordId: string;
  readonly profile: EvidenceProfile;
  readonly algorithm: AlgorithmId;
  readonly normalizedByteLength: number;
  readonly contentDigest: string;
  readonly recordDigest: string;
}

/** @public */
export interface RecordEvidence extends RecordEvidenceFields {
  readonly $schema: typeof RECORD_EVIDENCE_SCHEMA;
}

/** @public */
export type PreviousLink =
  { readonly kind: "none" } | { readonly kind: "digest"; readonly value: string };

/** @public */
export interface LinkEvidence extends RecordEvidenceFields {
  readonly $schema: typeof LINK_EVIDENCE_SCHEMA;
  readonly sequenceId: string;
  readonly position: number;
  readonly previous: PreviousLink;
  readonly linkDigest: string;
}

/** @public */
export type BoundaryState = "verified" | "unverified" | "not-applicable";
/** @public */
export type VerificationStatus = "valid" | "invalid" | "indeterminate" | "aborted";

/** @public */
export interface DiagnosticSummary {
  readonly errors: number;
  readonly warnings: number;
  readonly info: number;
  readonly truncated: boolean;
}

/** @public */
export interface ChainSummaryEvidence {
  readonly $schema: typeof CHAIN_SUMMARY_EVIDENCE_SCHEMA;
  readonly protocolVersion: 1;
  readonly contextId: string;
  readonly sequenceId: string;
  readonly profile: EvidenceProfile;
  readonly algorithm: AlgorithmId;
  readonly count: number;
  readonly firstPosition?: number;
  readonly lastPosition?: number;
  readonly firstLinkDigest?: string;
  readonly finalLinkDigest?: string;
  readonly boundaries: Readonly<{ readonly start: BoundaryState; readonly end: BoundaryState }>;
  readonly status: VerificationStatus;
  readonly diagnostics: DiagnosticSummary;
}

/** @public */
export type Evidence = RecordEvidence | LinkEvidence | ChainSummaryEvidence;

/** @public */
export interface VerificationStats {
  readonly recordsSeen: number;
  readonly recordsVerified: number;
  readonly linksVerified: number;
  readonly bytesNormalized: number;
  readonly errors: number;
  readonly warnings: number;
  readonly info: number;
}

/** @public */
export type VerificationMode = "complete" | "fragment" | "internal";

/** @public */
export interface VerificationResult<T> {
  readonly status: VerificationStatus;
  readonly diagnostics: readonly Diagnostic[];
  readonly evidence: T | undefined;
  readonly stats: VerificationStats;
  readonly boundaries: Readonly<{ readonly start: BoundaryState; readonly end: BoundaryState }>;
  readonly verificationMode: VerificationMode;
}
