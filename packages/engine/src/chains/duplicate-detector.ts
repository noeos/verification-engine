// SPDX-License-Identifier: Apache-2.0

import type { DuplicateObservation, DuplicatePolicy } from "../domain/duplicate-policy.js";
import type { LinkEvidence } from "../domain/evidence.js";
import type { Limits } from "../domain/limits.js";
import type { OperationResult } from "../domain/operation-result.js";
import { failure, success } from "../domain/operation-result.js";
import type { Diagnostic } from "../domain/diagnostic.js";
import { createDiagnostic, DiagnosticCollector } from "../validation/diagnostic-collector.js";
import { inspectPlainObject } from "../validation/object-inspection.js";

interface ObservedLink {
  readonly recordId: string;
  readonly contentDigest: string;
  readonly linkDigest: string;
  readonly forkKey: string;
}

interface Detector {
  inspect(value: ObservedLink): OperationResult<readonly Diagnostic[]>;
  commit(value: ObservedLink): void;
}

export function createDuplicateDetector(policy: DuplicatePolicy, limits: Limits): Detector {
  if (policy.kind === "none") return new NoneDetector();
  if (policy.kind === "external") return new ExternalDetector(policy, limits);
  return new MemoryDetector(policy, limits);
}

function observations(value: ObservedLink): readonly DuplicateObservation[] {
  return Object.freeze([
    Object.freeze({ kind: "record-id", key: value.recordId }),
    Object.freeze({ kind: "content-digest", key: value.contentDigest }),
    Object.freeze({ kind: "link-digest", key: value.linkDigest }),
    Object.freeze({ kind: "fork", key: value.forkKey, value: value.linkDigest }),
  ]);
}

export function observedLink(evidence: LinkEvidence): ObservedLink {
  return Object.freeze({
    recordId: evidence.recordId,
    contentDigest: evidence.contentDigest,
    linkDigest: evidence.linkDigest,
    forkKey: `${evidence.sequenceId}\u0000${String(evidence.position)}\u0000${previousKey(evidence)}`,
  });
}

class NoneDetector implements Detector {
  inspect(): OperationResult<readonly Diagnostic[]> {
    return success(Object.freeze([]));
  }

  commit(): void {
    void 0;
  }
}

class ExternalDetector implements Detector {
  private pending: ObservedLink | undefined;

  constructor(
    private readonly policy: Extract<DuplicatePolicy, { readonly kind: "external" }>,
    private readonly limits: Limits,
  ) {}

  inspect(value: ObservedLink): OperationResult<readonly Diagnostic[]> {
    try {
      const result = this.policy.index.observe(observations(value));
      if (!isOperationResult(result)) {
        return failure([
          createDiagnostic("INTERNAL_INVARIANT_BROKEN", "chain", {
            causeCode: "DUPLICATE_INDEX_INVALID",
          }),
        ]);
      }
      if (!result.ok) return failure(result.diagnostics);
      if (!isDuplicateObservationList(result.value)) {
        return failure([
          createDiagnostic("INTERNAL_INVARIANT_BROKEN", "chain", {
            causeCode: "DUPLICATE_INDEX_INVALID",
          }),
        ]);
      }
      this.pending = value;
      return success(diagnosticsForDuplicates(result.value, this.limits));
    } catch {
      return failure([
        createDiagnostic("INTERNAL_INVARIANT_BROKEN", "chain", {
          causeCode: "DUPLICATE_INDEX_FAILED",
        }),
      ]);
    }
  }

  commit(value: ObservedLink): void {
    if (this.pending !== value) throw new Error("external duplicate transaction mismatch");
    this.pending = undefined;
  }
}

class MemoryDetector implements Detector {
  private readonly recordIds = new Map<string, number>();
  private readonly contents = new Map<string, number>();
  private readonly links = new Map<string, number>();
  /** A window can retain more than one observation for a fork key. Keep
   * multiplicities so evicting one entry cannot erase another retained fork. */
  private readonly forks = new Map<string, Map<string, number>>();
  private readonly queue: ObservedLink[] = [];

  constructor(
    private readonly policy: Exclude<
      DuplicatePolicy,
      { readonly kind: "none" } | { readonly kind: "external" }
    >,
    private readonly limits: Limits,
  ) {}

  inspect(value: ObservedLink): OperationResult<readonly Diagnostic[]> {
    if (this.policy.kind === "full" && this.queue.length >= this.policy.maxRecords) {
      return failure([createDiagnostic("RESOURCE_BUDGET_EXCEEDED", "chain")]);
    }
    const collector = new DiagnosticCollector(this.limits);
    if (this.recordIds.has(value.recordId)) collector.addCode("RECORD_ID_DUPLICATE", "chain");
    if (this.contents.has(value.contentDigest)) collector.addCode("CONTENT_DUPLICATE", "chain");
    if (this.links.has(value.linkDigest)) collector.addCode("LINK_DIGEST_DUPLICATE", "chain");
    if (hasDifferentFork(this.forks.get(value.forkKey), value.linkDigest)) {
      collector.addCode("CHAIN_FORK", "chain");
    }
    return success(collector.finish());
  }

  commit(value: ObservedLink): void {
    this.queue.push(value);
    increment(this.recordIds, value.recordId);
    increment(this.contents, value.contentDigest);
    increment(this.links, value.linkDigest);
    incrementNested(this.forks, value.forkKey, value.linkDigest);
    if (this.policy.kind === "window" && this.queue.length > this.policy.size) {
      const discarded = this.queue.shift();
      if (discarded === undefined) throw new Error("duplicate window invariant broken");
      decrement(this.recordIds, discarded.recordId);
      decrement(this.contents, discarded.contentDigest);
      decrement(this.links, discarded.linkDigest);
      decrementNested(this.forks, discarded.forkKey, discarded.linkDigest);
    }
  }
}

function diagnosticsForDuplicates(
  duplicates: readonly DuplicateObservation[],
  limits: Limits,
): readonly Diagnostic[] {
  const collector = new DiagnosticCollector(limits);
  for (const duplicate of duplicates) {
    if (duplicate.kind === "record-id") collector.addCode("RECORD_ID_DUPLICATE", "chain");
    if (duplicate.kind === "content-digest") collector.addCode("CONTENT_DUPLICATE", "chain");
    if (duplicate.kind === "link-digest") collector.addCode("LINK_DIGEST_DUPLICATE", "chain");
    if (duplicate.kind === "fork") collector.addCode("CHAIN_FORK", "chain");
  }
  return collector.finish();
}

function previousKey(value: LinkEvidence): string {
  return value.previous.kind === "none" ? "none" : value.previous.value;
}

function increment(values: Map<string, number>, key: string): void {
  values.set(key, (values.get(key) ?? 0) + 1);
}

function decrement(values: Map<string, number>, key: string): void {
  const count = values.get(key);
  if (count === undefined) throw new Error("duplicate counter invariant broken");
  if (count === 1) values.delete(key);
  else values.set(key, count - 1);
}

function hasDifferentFork(
  values: ReadonlyMap<string, number> | undefined,
  digest: string,
): boolean {
  if (values === undefined) return false;
  for (const observedDigest of values.keys()) if (observedDigest !== digest) return true;
  return false;
}

function incrementNested(
  values: Map<string, Map<string, number>>,
  key: string,
  value: string,
): void {
  const nested = values.get(key) ?? new Map<string, number>();
  increment(nested, value);
  values.set(key, nested);
}

function decrementNested(
  values: Map<string, Map<string, number>>,
  key: string,
  value: string,
): void {
  const nested = values.get(key);
  if (nested === undefined) throw new Error("duplicate fork invariant broken");
  decrement(nested, value);
  if (nested.size === 0) values.delete(key);
}

function isOperationResult(value: unknown): value is OperationResult<unknown> {
  return (
    typeof value === "object" &&
    value !== null &&
    "ok" in value &&
    (value.ok === true || value.ok === false) &&
    "diagnostics" in value &&
    Array.isArray(value.diagnostics)
  );
}

function isDuplicateObservationList(value: unknown): value is readonly DuplicateObservation[] {
  return Array.isArray(value) && value.every(isDuplicateObservation);
}

function isDuplicateObservation(value: unknown): value is DuplicateObservation {
  const entries = inspectPlainObject(value);
  if (entries === undefined) return false;
  const fields = new Map(entries);
  const kind = fields.get("kind");
  const key = fields.get("key");
  if (
    kind !== "record-id" &&
    kind !== "content-digest" &&
    kind !== "link-digest" &&
    kind !== "fork"
  )
    return false;
  if (typeof key !== "string") return false;
  const observedValue = fields.get("value");
  return observedValue === undefined || typeof observedValue === "string";
}
