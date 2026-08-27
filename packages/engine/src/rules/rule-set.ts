// SPDX-License-Identifier: Apache-2.0

import type { Diagnostic } from "../domain/diagnostic.js";
import type { Limits } from "../domain/limits.js";
import type { OperationResult } from "../domain/operation-result.js";
import { failure, success } from "../domain/operation-result.js";
import type { ReadonlyByteView, Rule, RuleContext, RulePhase } from "../domain/rule.js";
import {
  createDiagnostic,
  DiagnosticCollector,
  type DiagnosticOptions,
} from "../validation/diagnostic-collector.js";
import { inspectPlainObject } from "../validation/object-inspection.js";
import { validateProfileVersion } from "../validation/version-validation.js";

const ruleIdPattern = /^[A-Za-z0-9][A-Za-z0-9._:/-]{0,127}$/u;
export class RuleSet {
  private constructor(private readonly rules: readonly Rule[]) {
    Object.freeze(this);
  }

  static create(value: unknown, limits: Limits): OperationResult<RuleSet> {
    if (value === undefined) return success(new RuleSet(Object.freeze([])));
    if (!Array.isArray(value)) return ruleFailure("RULE_VERSION_CONFLICT", limits);
    const rules: Rule[] = [];
    const keys = new Set<string>();
    for (const candidate of value) {
      const validated = validateRule(candidate, limits);
      if (!validated.ok) return validated;
      const key = `${validated.value.id}\u0000${validated.value.version}`;
      if (keys.has(key)) return ruleFailure("RULE_VERSION_CONFLICT", limits);
      keys.add(key);
      rules.push(validated.value);
    }
    rules.sort(
      (left, right) => compareText(left.id, right.id) || compareText(left.version, right.version),
    );
    return success(new RuleSet(Object.freeze(rules)));
  }

  evaluate(context: RuleContext, limits: Limits): readonly Diagnostic[] {
    const collector = new DiagnosticCollector(limits);
    for (const rule of this.rules) {
      if (!rule.phases.includes(context.phase)) continue;
      try {
        const findings = rule.evaluate(context);
        if (!Array.isArray(findings)) {
          collector.addCode(
            "RULE_EXECUTION_FAILED",
            context.phase,
            failureOptions(context, "RULE_RESULT_INVALID"),
          );
          continue;
        }
        for (const finding of findings) {
          const diagnostic = toDiagnostic(rule, finding, context);
          if (diagnostic === undefined) {
            collector.addCode(
              "RULE_EXECUTION_FAILED",
              context.phase,
              failureOptions(context, "RULE_RESULT_INVALID"),
            );
          } else {
            collector.add(diagnostic);
          }
        }
      } catch {
        collector.addCode(
          "RULE_EXECUTION_FAILED",
          context.phase,
          failureOptions(context, "RULE_EVALUATION_FAILED"),
        );
      }
    }
    return collector.finish();
  }
}

export function createReadonlyByteView(bytes: Uint8Array): ReadonlyByteView {
  const copy = Uint8Array.from(bytes);
  return Object.freeze({
    byteLength: copy.length,
    copySlice(start?: number, end?: number): Uint8Array {
      return Uint8Array.from(copy.slice(start, end));
    },
  });
}

function validateRule(value: unknown, limits: Limits): OperationResult<Rule> {
  const entries = inspectPlainObject(value);
  if (entries === undefined) return ruleFailure("RULE_VERSION_CONFLICT", limits);
  const fields = new Map(entries);
  if (
    fields.size !== 5 ||
    !fields.has("id") ||
    !fields.has("version") ||
    !fields.has("phases") ||
    !fields.has("defaultSeverity") ||
    !fields.has("evaluate")
  ) {
    return ruleFailure("RULE_VERSION_CONFLICT", limits);
  }
  const id = fields.get("id");
  const version = fields.get("version");
  const phases = fields.get("phases");
  const defaultSeverity = fields.get("defaultSeverity");
  const evaluate = fields.get("evaluate");
  if (typeof id !== "string" || !ruleIdPattern.test(id) || id.length > 128) {
    return ruleFailure("RULE_VERSION_CONFLICT", limits);
  }
  const validatedVersion = validateProfileVersion(version);
  if (!validatedVersion.ok || !Array.isArray(phases) || typeof evaluate !== "function") {
    return ruleFailure("RULE_VERSION_CONFLICT", limits);
  }
  if (defaultSeverity !== "error" && defaultSeverity !== "warning" && defaultSeverity !== "info") {
    return ruleFailure("RULE_VERSION_CONFLICT", limits);
  }
  const normalizedPhases: RulePhase[] = [];
  for (const phase of phases) {
    if (!isRulePhase(phase) || normalizedPhases.includes(phase)) {
      return ruleFailure("RULE_VERSION_CONFLICT", limits);
    }
    normalizedPhases.push(phase);
  }
  if (normalizedPhases.length === 0) return ruleFailure("RULE_VERSION_CONFLICT", limits);
  return success(
    Object.freeze({
      id,
      version: validatedVersion.value.value,
      phases: Object.freeze([...normalizedPhases]),
      defaultSeverity,
      evaluate(context: RuleContext): unknown {
        return Reflect.apply(evaluate, undefined, [context]);
      },
    }),
  );
}

function toDiagnostic(rule: Rule, value: unknown, context: RuleContext): Diagnostic | undefined {
  const entries = inspectPlainObject(value);
  if (entries === undefined) return undefined;
  const fields = new Map(entries);
  for (const key of fields.keys()) {
    if (key !== "messageKey" && key !== "path" && key !== "details" && key !== "severity")
      return undefined;
  }
  const messageKey = fields.get("messageKey");
  const path = fields.get("path");
  const details = fields.get("details");
  const severity = fields.get("severity");
  if (typeof messageKey !== "string") return undefined;
  if (path !== undefined && typeof path !== "string") return undefined;
  if (
    severity !== undefined &&
    severity !== "error" &&
    severity !== "warning" &&
    severity !== "info"
  ) {
    return undefined;
  }
  const ruleDetails: Record<string, string | number | boolean | null> = {
    "rule-id": rule.id,
    "rule-version": rule.version,
  };
  if (details !== undefined) {
    const detailEntries = inspectPlainObject(details);
    if (detailEntries === undefined) return undefined;
    for (const [key, item] of detailEntries) {
      if (key === "rule-id" || key === "rule-version") return undefined;
      if (
        item !== null &&
        typeof item !== "string" &&
        typeof item !== "number" &&
        typeof item !== "boolean"
      ) {
        return undefined;
      }
      ruleDetails[key] = item;
    }
  }
  return createDiagnostic("RULE_FAILED", context.phase, {
    messageKey,
    details: ruleDetails,
    severity: severity ?? rule.defaultSeverity,
    ...optionalDiagnosticFields(context, path),
  });
}

function isRulePhase(value: unknown): value is RulePhase {
  return (
    value === "input" ||
    value === "normalization" ||
    value === "record" ||
    value === "link" ||
    value === "chain"
  );
}

function ruleFailure<T>(code: "RULE_VERSION_CONFLICT", limits: Limits): OperationResult<T> {
  void limits;
  return failure([createDiagnostic(code, "input")]);
}

function failureOptions(context: RuleContext, causeCode: string): DiagnosticOptions {
  return {
    causeCode,
    ...optionalDiagnosticFields(context),
  };
}

function optionalDiagnosticFields(context: RuleContext, path?: string): DiagnosticOptions {
  return {
    ...(path === undefined ? {} : { path }),
    ...(context.recordId === undefined ? {} : { recordId: context.recordId }),
    ...(context.position === undefined ? {} : { position: context.position }),
  };
}

function compareText(left: string, right: string): number {
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
}
