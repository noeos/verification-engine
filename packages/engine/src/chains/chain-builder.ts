// SPDX-License-Identifier: Apache-2.0

import type { ChainSnapshot } from "../domain/chain.js";
import type { DuplicateObservation, DuplicatePolicy } from "../domain/duplicate-policy.js";
import type {
  ChainSummaryEvidence,
  DiagnosticSummary,
  LinkEvidence,
  PreviousLink,
} from "../domain/evidence.js";
import { CHAIN_SUMMARY_EVIDENCE_SCHEMA, LINK_EVIDENCE_SCHEMA } from "../domain/evidence.js";
import type { Limits } from "../domain/limits.js";
import type { OperationResult } from "../domain/operation-result.js";
import { failure, success } from "../domain/operation-result.js";
import type { Diagnostic } from "../domain/diagnostic.js";
import { buildLinkFrame } from "../framing/frame-builders.js";
import { hashFrame } from "../hashing/hash-frame.js";
import type { ProfileRegistry } from "../normalization/profile-registry.js";
import {
  computeRecord,
  type RecordServiceOptions,
  validateProfile,
} from "../records/record-service.js";
import { RuleSet } from "../rules/rule-set.js";
import { DiagnosticCollector } from "../validation/diagnostic-collector.js";
import { validateAlgorithmId } from "../validation/algorithm-validation.js";
import { equalDigest, validateDigest } from "../validation/digest-validation.js";
import {
  validateContextId,
  validateRecordId,
  validateSequenceId,
} from "../validation/identifier-validation.js";
import { inspectPlainObject } from "../validation/object-inspection.js";
import { validatePosition } from "../validation/position-validation.js";
import { createDuplicateDetector, observedLink } from "./duplicate-detector.js";

export interface ChainBuilderOptions {
  readonly limits: Limits;
  readonly profiles: ProfileRegistry;
}

type BuilderState = "active" | "finalized" | "aborted" | "failed";

export class ChainLifecycleError extends Error {
  constructor(readonly code: "BUILDER_FINALIZED" | "BUILDER_FAILED") {
    super(code);
    this.name = "ChainLifecycleError";
  }
}

export class ChainBuilder {
  private state: BuilderState = "active";
  private nextPosition = 0;
  private previous: PreviousLink = Object.freeze({ kind: "none" });
  private firstDigest: string | undefined;
  private finalDigest: string | undefined;
  private readonly diagnostics: DiagnosticCollector;
  private count = 0;
  private readonly duplicates;

  private constructor(
    private readonly config: ValidatedChainConfig,
    private readonly rules: RuleSet,
    private readonly options: ChainBuilderOptions,
  ) {
    this.diagnostics = new DiagnosticCollector(options.limits);
    this.duplicates = createDuplicateDetector(config.duplicatePolicy, options.limits);
  }

  static create(input: unknown, options: ChainBuilderOptions): OperationResult<ChainBuilder> {
    const config = validateChainConfig(input, options.limits);
    if (!config.ok) return config;
    const rules = RuleSet.create(config.value.rules, options.limits);
    if (!rules.ok) return rules;
    return success(new ChainBuilder(config.value, rules.value, options));
  }

  append(input: unknown): OperationResult<LinkEvidence> {
    this.requireActive();
    const chainInput = validateChainRecordInput(input, this.config.algorithm, this.options.limits);
    if (!chainInput.ok) return chainInput;
    const collector = new DiagnosticCollector(this.options.limits);
    if (chainInput.value.position !== this.nextPosition) {
      collector.addCode("POSITION_MISMATCH", "link", { position: chainInput.value.position });
    }
    if (!samePrevious(chainInput.value.previous, this.previous, this.config.algorithm)) {
      collector.addCode("PREVIOUS_LINK_MISMATCH", "link", { position: chainInput.value.position });
    }
    if (collector.hasErrors()) return failure(collector.finish());
    const record = computeRecord(
      {
        contextId: this.config.contextId,
        recordId: chainInput.value.recordId,
        payload: chainInput.value.payload,
        profile: this.config.profile,
        algorithm: this.config.algorithm,
      },
      this.recordOptions(),
    );
    if (!record.ok) return record;
    addAll(collector, record.diagnostics);
    const recordDigest = validateDigest(record.value.evidence.recordDigest, this.config.algorithm);
    if (!recordDigest.ok) return recordDigest;
    const previousDigest =
      chainInput.value.previous.kind === "digest"
        ? validateDigest(chainInput.value.previous.value, this.config.algorithm)
        : undefined;
    if (previousDigest !== undefined && !previousDigest.ok) return previousDigest;
    const linkDigest = hashFrame(
      this.config.algorithm,
      buildLinkFrame(
        {
          algorithm: this.config.algorithm,
          contextId: this.config.contextId,
          sequenceId: this.config.sequenceId,
          position: chainInput.value.position,
          recordId: chainInput.value.recordId,
          recordDigest: recordDigest.value,
          ...(previousDigest === undefined ? {} : { previousLinkDigest: previousDigest.value }),
        },
        this.options.limits,
      ),
      this.options.limits,
    );
    if (!linkDigest.ok) return linkDigest;
    const evidence = freezeLinkEvidence({
      ...record.value.evidence,
      $schema: LINK_EVIDENCE_SCHEMA,
      sequenceId: this.config.sequenceId,
      position: chainInput.value.position,
      previous: chainInput.value.previous,
      linkDigest: linkDigest.value.toHex(),
    });
    addAll(
      collector,
      this.rules.evaluate(
        Object.freeze({
          phase: "link",
          link: evidence,
          recordId: evidence.recordId,
          position: evidence.position,
        }),
        this.options.limits,
      ),
    );
    if (collector.hasErrors()) return failure(collector.finish());
    const observed = observedLink(evidence);
    const duplicate = this.duplicates.inspect(observed);
    if (!duplicate.ok) {
      this.state = "failed";
      return duplicate;
    }
    addAll(collector, duplicate.value);
    if (collector.hasErrors()) return failure(collector.finish());
    try {
      this.duplicates.commit(observed);
      this.commit(evidence);
    } catch {
      this.state = "failed";
      return failure([createInternalDiagnostic()]);
    }
    addAll(this.diagnostics, collector.finish());
    return success(evidence, collector.finish());
  }

  snapshot(): ChainSnapshot {
    this.requireReadable();
    return Object.freeze({
      contextId: this.config.contextId,
      sequenceId: this.config.sequenceId,
      profile: Object.freeze({ ...this.config.profile }),
      algorithm: this.config.algorithm,
      nextPosition: this.nextPosition,
      previous: freezePrevious(this.previous),
      count: this.count,
    });
  }

  finalize(): OperationResult<ChainSummaryEvidence> {
    this.requireActive();
    if (this.count === 0 && !this.config.allowEmpty) {
      return failure([{ ...createInternalDiagnostic("EMPTY_CHAIN_FORBIDDEN"), phase: "chain" }]);
    }
    const collector = new DiagnosticCollector(this.options.limits);
    addAll(
      collector,
      this.rules.evaluate(
        Object.freeze({ phase: "chain", chain: this.snapshot() }),
        this.options.limits,
      ),
    );
    if (collector.hasErrors()) return failure(collector.finish());
    addAll(this.diagnostics, collector.finish());
    const evidence = this.summary("valid", "verified", "verified");
    this.state = "finalized";
    return success(evidence, this.diagnostics.finish());
  }

  abort(): void {
    if (this.state === "active") this.state = "aborted";
  }

  private recordOptions(): RecordServiceOptions {
    return Object.freeze({
      limits: this.options.limits,
      profiles: this.options.profiles,
      rules: this.rules,
    });
  }

  private commit(evidence: LinkEvidence): void {
    if (this.count === 0) this.firstDigest = evidence.linkDigest;
    this.finalDigest = evidence.linkDigest;
    this.previous = Object.freeze({ kind: "digest", value: evidence.linkDigest });
    this.nextPosition += 1;
    this.count += 1;
  }

  private summary(
    status: "valid" | "invalid" | "indeterminate" | "aborted",
    start: "verified" | "unverified" | "not-applicable",
    end: "verified" | "unverified" | "not-applicable",
  ): ChainSummaryEvidence {
    const diagnostics = this.diagnostics.finish();
    const summary = diagnosticSummary(diagnostics);
    const base = {
      $schema: CHAIN_SUMMARY_EVIDENCE_SCHEMA,
      protocolVersion: 1 as const,
      contextId: this.config.contextId,
      sequenceId: this.config.sequenceId,
      profile: Object.freeze({ ...this.config.profile }),
      algorithm: this.config.algorithm,
      count: this.count,
      boundaries: Object.freeze({ start, end }),
      status,
      diagnostics: summary,
    };
    if (this.count === 0) return Object.freeze(base);
    if (this.firstDigest === undefined || this.finalDigest === undefined) {
      throw new Error("chain summary invariant broken");
    }
    return Object.freeze({
      ...base,
      firstPosition: 0,
      lastPosition: this.count - 1,
      firstLinkDigest: this.firstDigest,
      finalLinkDigest: this.finalDigest,
    });
  }

  private requireActive(): void {
    if (this.state === "finalized") throw new ChainLifecycleError("BUILDER_FINALIZED");
    if (this.state === "failed" || this.state === "aborted")
      throw new ChainLifecycleError("BUILDER_FAILED");
  }

  private requireReadable(): void {
    if (this.state === "failed" || this.state === "aborted")
      throw new ChainLifecycleError("BUILDER_FAILED");
  }
}

interface ValidatedChainConfig {
  readonly contextId: string;
  readonly sequenceId: string;
  readonly profile: Readonly<{ readonly id: string; readonly version: string }>;
  readonly algorithm: "sha-256" | "sha-384" | "sha-512";
  readonly duplicatePolicy: DuplicatePolicy;
  readonly rules: unknown;
  readonly allowEmpty: boolean;
}

function validateChainConfig(
  value: unknown,
  limits: Limits,
): OperationResult<ValidatedChainConfig> {
  const entries = inspectPlainObject(value);
  if (entries === undefined) return invalidConfig(limits);
  const fields = new Map(entries);
  for (const key of fields.keys()) {
    if (
      ![
        "contextId",
        "sequenceId",
        "profile",
        "algorithm",
        "duplicatePolicy",
        "rules",
        "allowEmpty",
      ].includes(key)
    )
      return invalidConfig(limits);
  }
  if (
    !fields.has("contextId") ||
    !fields.has("sequenceId") ||
    !fields.has("profile") ||
    !fields.has("algorithm")
  ) {
    return invalidConfig(limits);
  }
  const contextId = validateContextId(fields.get("contextId"));
  const sequenceId = validateSequenceId(fields.get("sequenceId"));
  const profile = validateProfile(fields.get("profile"), limits);
  const algorithm = validateAlgorithmId(fields.get("algorithm"));
  const duplicates = validateDuplicatePolicy(fields.get("duplicatePolicy"), limits);
  const allowEmpty = fields.get("allowEmpty") ?? false;
  if (!contextId.ok) return contextId;
  if (!sequenceId.ok) return sequenceId;
  if (!profile.ok) return profile;
  if (!algorithm.ok) return algorithm;
  if (!duplicates.ok || typeof allowEmpty !== "boolean") return invalidConfig(limits);
  return success(
    Object.freeze({
      contextId: contextId.value.value,
      sequenceId: sequenceId.value.value,
      profile: profile.value,
      algorithm: algorithm.value,
      duplicatePolicy: duplicates.value,
      rules: fields.get("rules"),
      allowEmpty,
    }),
  );
}

function validateDuplicatePolicy(value: unknown, limits: Limits): OperationResult<DuplicatePolicy> {
  if (value === undefined) return success(Object.freeze({ kind: "none" }));
  const entries = inspectPlainObject(value);
  if (entries === undefined) return invalidConfig(limits);
  const fields = new Map(entries);
  const kind = fields.get("kind");
  if (kind === "none" && fields.size === 1) return success(Object.freeze({ kind }));
  if (kind === "window" && fields.size === 2 && typeof fields.get("size") === "number") {
    const size = fields.get("size");
    if (
      typeof size !== "number" ||
      !Number.isSafeInteger(size) ||
      size < 1 ||
      size > limits.maxFullRecords
    )
      return invalidConfig(limits);
    return success(Object.freeze({ kind, size }));
  }
  if (kind === "full" && fields.size === 2 && typeof fields.get("maxRecords") === "number") {
    const maxRecords = fields.get("maxRecords");
    if (
      typeof maxRecords !== "number" ||
      !Number.isSafeInteger(maxRecords) ||
      maxRecords < 1 ||
      maxRecords > limits.maxFullRecords
    )
      return invalidConfig(limits);
    return success(Object.freeze({ kind, maxRecords }));
  }
  if (kind === "external" && fields.size === 2 && fields.has("index")) {
    const index = fields.get("index");
    const indexEntries = inspectPlainObject(index);
    if (indexEntries === undefined) {
      return invalidConfig(limits);
    }
    const indexFields = new Map(indexEntries);
    const observe = indexFields.get("observe");
    if (indexFields.size !== 1 || typeof observe !== "function") return invalidConfig(limits);
    return success(
      Object.freeze({
        kind,
        index: Object.freeze({
          observe(batch: readonly DuplicateObservation[]): unknown {
            return Reflect.apply(observe, undefined, [batch]);
          },
        }),
      }),
    );
  }
  return invalidConfig(limits);
}

interface ValidatedChainRecordInput {
  readonly recordId: string;
  readonly payload: unknown;
  readonly position: number;
  readonly previous: PreviousLink;
}

function validateChainRecordInput(
  value: unknown,
  algorithm: string,
  limits: Limits,
): OperationResult<ValidatedChainRecordInput> {
  const entries = inspectPlainObject(value);
  if (entries === undefined) return invalidConfig(limits);
  const fields = new Map(entries);
  if (
    fields.size !== 4 ||
    !fields.has("recordId") ||
    !fields.has("payload") ||
    !fields.has("position") ||
    !fields.has("previous")
  ) {
    return invalidConfig(limits);
  }
  const recordId = validateRecordId(fields.get("recordId"));
  const position = validatePosition(fields.get("position"));
  const previous = validatePrevious(fields.get("previous"), algorithm, limits);
  if (!recordId.ok) return recordId;
  if (!position.ok) return position;
  if (!previous.ok) return previous;
  return success(
    Object.freeze({
      recordId: recordId.value.value,
      payload: fields.get("payload"),
      position: position.value.value,
      previous: previous.value,
    }),
  );
}

function validatePrevious(
  value: unknown,
  algorithm: string,
  limits: Limits,
): OperationResult<PreviousLink> {
  const entries = inspectPlainObject(value);
  if (entries === undefined) return invalidConfig(limits);
  const fields = new Map(entries);
  if (fields.get("kind") === "none" && fields.size === 1)
    return success(Object.freeze({ kind: "none" }));
  if (fields.get("kind") === "digest" && fields.size === 2 && fields.has("value")) {
    const digest = validateDigest(fields.get("value"), algorithm);
    if (!digest.ok) return digest;
    return success(Object.freeze({ kind: "digest", value: digest.value.toHex() }));
  }
  return invalidConfig(limits);
}

function samePrevious(left: PreviousLink, right: PreviousLink, algorithm: string): boolean {
  if (left.kind !== right.kind) return false;
  if (left.kind === "none" || right.kind === "none") return true;
  const expected = validateDigest(left.value, algorithm);
  const actual = validateDigest(right.value, algorithm);
  return expected.ok && actual.ok && equalDigest(expected.value, actual.value);
}

function freezePrevious(value: PreviousLink): PreviousLink {
  return value.kind === "none"
    ? Object.freeze({ kind: "none" })
    : Object.freeze({ kind: "digest", value: value.value });
}

function freezeLinkEvidence(value: LinkEvidence): LinkEvidence {
  return Object.freeze({
    ...value,
    profile: Object.freeze({ ...value.profile }),
    previous: freezePrevious(value.previous),
  });
}

function diagnosticSummary(diagnostics: readonly Diagnostic[]): DiagnosticSummary {
  let errors = 0;
  let warnings = 0;
  let info = 0;
  for (const diagnostic of diagnostics) {
    if (diagnostic.severity === "error") errors += 1;
    else if (diagnostic.severity === "warning") warnings += 1;
    else info += 1;
  }
  return Object.freeze({
    errors,
    warnings,
    info,
    truncated: diagnostics.some(({ code }) => code === "DIAGNOSTIC_LIMIT_REACHED"),
  });
}

function addAll(collector: DiagnosticCollector, diagnostics: readonly Diagnostic[]): void {
  for (const diagnostic of diagnostics) collector.add(diagnostic);
}

function invalidConfig<T>(limits: Limits): OperationResult<T> {
  const collector = new DiagnosticCollector(limits);
  collector.addCode("INPUT_TYPE_INVALID", "input");
  return failure(collector.finish());
}

function createInternalDiagnostic(
  code: "EMPTY_CHAIN_FORBIDDEN" | "INTERNAL_INVARIANT_BROKEN" = "INTERNAL_INVARIANT_BROKEN",
): Diagnostic {
  return Object.freeze({
    $schema: "urn:noeos:verification-engine:diagnostic:1" as const,
    code,
    severity: "error" as const,
    phase: "chain" as const,
    messageKey: code.toLowerCase().replaceAll("_", "."),
  });
}
