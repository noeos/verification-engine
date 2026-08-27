// SPDX-License-Identifier: Apache-2.0

import type { DiagnosticCode, DiagnosticPhase } from "../domain/diagnostic.js";
import type { OperationResult } from "../domain/operation-result.js";
import { failure } from "../domain/operation-result.js";
import { createDiagnostic } from "./diagnostic-collector.js";

export function failureWithCode<T>(
  code: DiagnosticCode,
  phase: DiagnosticPhase,
): OperationResult<T> {
  return failure([createDiagnostic(code, phase)]);
}
