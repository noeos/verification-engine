// SPDX-License-Identifier: Apache-2.0

import type { DiagnosticDetails, DiagnosticPhase, DiagnosticSeverity } from "./diagnostic.js";

export type RulePhase = Exclude<DiagnosticPhase, "output">;

export interface ReadonlyByteView {
  readonly byteLength: number;
  copySlice(start?: number, end?: number): Uint8Array;
}

export interface RuleFinding {
  readonly messageKey: string;
  readonly path?: string;
  readonly details?: DiagnosticDetails;
  readonly severity?: DiagnosticSeverity;
}

export interface RuleContext {
  readonly phase: RulePhase;
  readonly input?: Readonly<Record<string, unknown>>;
  readonly normalized?: ReadonlyByteView;
  readonly record?: object;
  readonly link?: object;
  readonly chain?: object;
  readonly recordId?: string;
  readonly position?: number;
}

export interface Rule {
  readonly id: string;
  readonly version: string;
  readonly phases: readonly RulePhase[];
  readonly defaultSeverity: DiagnosticSeverity;
  evaluate(context: RuleContext): unknown;
}
