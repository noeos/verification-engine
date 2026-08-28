// SPDX-License-Identifier: Apache-2.0

import { DIAGNOSTIC_CODES } from "../contracts/generated.js";
import type {
  Diagnostic,
  DiagnosticCode,
  DiagnosticDetail,
  DiagnosticPhase,
  DiagnosticSeverity,
} from "../domain/diagnostic.js";
import { DIAGNOSTIC_SCHEMA } from "../domain/diagnostic.js";
import type { Limits } from "../domain/limits.js";
import { isDataPropertyDescriptor } from "./object-inspection.js";

export interface DiagnosticOptions {
  readonly path?: string;
  readonly recordId?: string;
  readonly position?: number;
  readonly details?: Readonly<Record<string, DiagnosticDetail>>;
  readonly causeCode?: string;
  /** Only RuleSet may override the catalog default for RULE_FAILED. */
  readonly severity?: DiagnosticSeverity;
  /** Stable namespaced key supplied by a trusted rule. */
  readonly messageKey?: string;
}

export function createDiagnostic(
  code: DiagnosticCode,
  phase: DiagnosticPhase,
  options: DiagnosticOptions = {},
): Diagnostic {
  const metadata = DIAGNOSTIC_CODES.find((entry) => entry.code === code);
  if (metadata === undefined) {
    throw new Error(`Unknown generated diagnostic code: ${code}`);
  }
  const details = options.details === undefined ? undefined : tryCopyDetails(options.details);
  const path = safePath(options.path);
  const recordId = safeString(options.recordId, /^[A-Za-z0-9][A-Za-z0-9._:/-]{0,127}$/u, 128);
  const causeCode = safeString(options.causeCode, /^[A-Z][A-Z0-9_]{1,127}$/u, 128);
  const position = safePosition(options.position);
  const diagnostic = {
    $schema: DIAGNOSTIC_SCHEMA,
    code,
    severity:
      code === "RULE_FAILED" && options.severity !== undefined
        ? options.severity
        : metadata.severity,
    phase,
    messageKey:
      safeString(options.messageKey, /^[a-z][a-z0-9.-]{0,127}$/u, 128) ??
      code.toLowerCase().replaceAll("_", "."),
    ...(path === undefined ? {} : { path }),
    ...(recordId === undefined ? {} : { recordId }),
    ...(position === undefined ? {} : { position }),
    ...(details === undefined ? {} : { details }),
    ...(causeCode === undefined ? {} : { causeCode }),
  };
  return Object.freeze(diagnostic) satisfies Diagnostic;
}

function tryCopyDetails(
  value: Readonly<Record<string, DiagnosticDetail>>,
): Readonly<Record<string, DiagnosticDetail>> | undefined {
  try {
    return copyDetails(value);
  } catch {
    return undefined;
  }
}

function safeString(value: unknown, pattern: RegExp, maxLength: number): string | undefined {
  return typeof value === "string" && value.length <= maxLength && pattern.test(value)
    ? value
    : undefined;
}

function safePath(value: unknown): string | undefined {
  if (typeof value !== "string" || value.length > 512) {
    return undefined;
  }
  if (value === "" || /^[a-z][a-z0-9.-]{0,127}$/u.test(value)) {
    return value;
  }
  if (!value.startsWith("/")) {
    return undefined;
  }
  const segments = value.split("/");
  return segments.slice(1).every(isJsonPointerSegment) ? value : undefined;
}

function isJsonPointerSegment(segment: string): boolean {
  if (segment.length === 0) {
    return false;
  }
  for (let index = 0; index < segment.length; index += 1) {
    const character = segment[index];
    if (character === "~") {
      const escape = segment[index + 1];
      if (escape !== "0" && escape !== "1") {
        return false;
      }
      index += 1;
      continue;
    }
    if (character === undefined || !/[A-Za-z0-9._~-]/u.test(character)) {
      return false;
    }
  }
  return true;
}

function safePosition(value: unknown): number | undefined {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0 ? value : undefined;
}

function copyDetails(
  value: Readonly<Record<string, DiagnosticDetail>>,
): Readonly<Record<string, DiagnosticDetail>> {
  const keys = Object.keys(value);
  if (Object.getOwnPropertySymbols(value).length !== 0 || keys.length > 32) {
    throw new Error("invalid diagnostic details");
  }
  const output: Record<string, DiagnosticDetail> = {};
  for (const key of keys) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (
      !/^[a-z][a-z0-9.-]{0,63}$/u.test(key) ||
      descriptor === undefined ||
      !isDataPropertyDescriptor(descriptor)
    ) {
      throw new Error("invalid diagnostic details");
    }
    const detail: unknown = descriptor.value;
    if (
      detail !== null &&
      typeof detail !== "boolean" &&
      (typeof detail !== "number" || !Number.isFinite(detail)) &&
      (typeof detail !== "string" || detail.length > 256)
    ) {
      throw new Error("invalid diagnostic details");
    }
    Object.defineProperty(output, key, {
      configurable: false,
      enumerable: true,
      value: detail,
      writable: false,
    });
  }
  return Object.freeze(output);
}

export class DiagnosticCollector {
  private readonly entries: Diagnostic[] = [];

  private truncated = false;

  constructor(private readonly limits: Limits) {}

  add(diagnostic: Diagnostic): void {
    if (this.entries.length < this.limits.maxDiagnostics) {
      this.entries.push(diagnostic);
      return;
    }
    if (!this.truncated) {
      this.truncated = true;
      this.entries[this.entries.length - 1] = createDiagnostic(
        "DIAGNOSTIC_LIMIT_REACHED",
        "output",
      );
    }
  }

  addCode(code: DiagnosticCode, phase: DiagnosticPhase, options?: DiagnosticOptions): void {
    this.add(createDiagnostic(code, phase, options));
  }

  hasErrors(): boolean {
    return this.entries.some(({ severity }) => severity === ("error" satisfies DiagnosticSeverity));
  }

  finish(): readonly Diagnostic[] {
    if (this.entries.length === 0) return Object.freeze([]);
    const sorted = [...this.entries].sort(compareDiagnostics);
    return Object.freeze(sorted);
  }
}

function compareDiagnostics(left: Diagnostic, right: Diagnostic): number {
  const leftPosition = left.position ?? Number.MAX_SAFE_INTEGER;
  const rightPosition = right.position ?? Number.MAX_SAFE_INTEGER;
  return (
    leftPosition - rightPosition ||
    compareText(left.phase, right.phase) ||
    compareText(left.code, right.code) ||
    compareText(left.path ?? "", right.path ?? "")
  );
}

function compareText(left: string, right: string): number {
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
}
