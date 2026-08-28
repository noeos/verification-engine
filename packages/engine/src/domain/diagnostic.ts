// SPDX-License-Identifier: Apache-2.0

import type { DiagnosticCode, DiagnosticSeverity } from "../contracts/generated.js";

export type { DiagnosticCode, DiagnosticSeverity } from "../contracts/generated.js";

/** @public */
export type DiagnosticPhase = "input" | "normalization" | "record" | "link" | "chain" | "output";

export type DiagnosticDetail = string | number | boolean | null;
/** @public */
export type DiagnosticDetails = Readonly<Record<string, DiagnosticDetail>>;

/** @public */
export const DIAGNOSTIC_SCHEMA = "urn:noeos:verification-engine:diagnostic:1" as const;

/** @public */
export interface Diagnostic {
  readonly $schema: typeof DIAGNOSTIC_SCHEMA;
  readonly code: DiagnosticCode;
  readonly severity: DiagnosticSeverity;
  readonly phase: DiagnosticPhase;
  readonly messageKey: string;
  readonly path?: string;
  readonly recordId?: string;
  readonly position?: number;
  readonly details?: DiagnosticDetails;
  readonly causeCode?: string;
}
