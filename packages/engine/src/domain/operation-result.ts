// SPDX-License-Identifier: Apache-2.0

import type { Diagnostic } from "./diagnostic.js";

/** @public */
export type OperationResult<T> =
  | {
      readonly ok: true;
      readonly value: T;
      readonly diagnostics: readonly Diagnostic[];
    }
  | {
      readonly ok: false;
      readonly diagnostics: readonly Diagnostic[];
    };

export function success<T>(value: T, diagnostics: readonly Diagnostic[] = []): OperationResult<T> {
  return Object.freeze({ ok: true as const, value, diagnostics: Object.freeze([...diagnostics]) });
}

export function failure<T>(diagnostics: readonly Diagnostic[]): OperationResult<T> {
  return Object.freeze({ ok: false as const, diagnostics: Object.freeze([...diagnostics]) });
}
