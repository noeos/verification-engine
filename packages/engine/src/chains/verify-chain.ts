// SPDX-License-Identifier: Apache-2.0

import type { DuplicateObservation, DuplicatePolicy } from "../domain/duplicate-policy.js";
import type {
  BoundaryState,
  ChainSummaryEvidence,
  DiagnosticSummary,
  LinkEvidence,
  PreviousLink,
  VerificationMode,
  VerificationResult,
  VerificationStats,
} from "../domain/evidence.js";
import { CHAIN_SUMMARY_EVIDENCE_SCHEMA } from "../domain/evidence.js";
import type { Limits } from "../domain/limits.js";
import type { Diagnostic } from "../domain/diagnostic.js";
import type { Digest } from "../domain/digest.js";
import type { OperationResult } from "../domain/operation-result.js";
import { buildLinkFrame } from "../framing/frame-builders.js";
import { hashFrame } from "../hashing/hash-frame.js";
import type { ProfileRegistry } from "../normalization/profile-registry.js";
import { parseLinkEvidence } from "../evidence/evidence-parser.js";
import {
  computeRecord,
  type RecordServiceOptions,
  validateProfile,
} from "../records/record-service.js";
import { RuleSet } from "../rules/rule-set.js";
import { DiagnosticCollector } from "../validation/diagnostic-collector.js";
import { validateAlgorithmId } from "../validation/algorithm-validation.js";
import { equalDigest, validateDigest } from "../validation/digest-validation.js";
import { validateContextId, validateSequenceId } from "../validation/identifier-validation.js";
import { inspectPlainObject } from "../validation/object-inspection.js";
import { createDuplicateDetector, observedLink } from "./duplicate-detector.js";

export interface ChainVerificationOptions {
  readonly limits: Limits;
  readonly profiles: ProfileRegistry;
}

interface VerificationConfig {
  readonly contextId: string;
  readonly sequenceId: string;
  readonly profile: Readonly<{ readonly id: string; readonly version: string }>;
  readonly algorithm: "sha-256" | "sha-384" | "sha-512";
  readonly mode: VerificationMode;
  readonly records: Iterable<unknown> | AsyncIterable<unknown>;
  readonly expectedCount?: number;
  readonly expectedFinalLinkDigest?: string;
  readonly expectedPrevious?: PreviousLink;
  readonly startPosition?: number;
  readonly allowEmpty: boolean;
  readonly duplicatePolicy: DuplicatePolicy;
  readonly rules: unknown;
}

interface VerificationItem {
  readonly payload: unknown;
  readonly evidence: unknown;
}

export function verifyChain(
  input: unknown,
  options: ChainVerificationOptions,
): VerificationResult<ChainSummaryEvidence> {
  const config = validateVerificationConfig(input, options.limits, "sync");
  if (!config.ok) return invalidResult(config.diagnostics, "internal");
  const rules = RuleSet.create(config.value.rules, options.limits);
  if (!rules.ok) return invalidResult(rules.diagnostics, config.value.mode);
  const verifier = new ChainVerificationAccumulator(config.value, options, rules.value);
  if (!isIterable(config.value.records)) return invalidResult([], config.value.mode);
  try {
    for (const item of config.value.records) verifier.process(item);
  } catch {
    return verifier.streamFailure();
  }
  return verifier.finish();
}

export async function verifyChainStream(
  input: unknown,
  options: ChainVerificationOptions,
  signal?: AbortSignal,
): Promise<VerificationResult<ChainSummaryEvidence>> {
  const config = validateVerificationConfig(input, options.limits, "async");
  if (!config.ok) return invalidResult(config.diagnostics, "internal");
  const rules = RuleSet.create(config.value.rules, options.limits);
  if (!rules.ok) return invalidResult(rules.diagnostics, config.value.mode);
  const verifier = new ChainVerificationAccumulator(config.value, options, rules.value);
  const asyncRecords = config.value.records;
  if (!isAsyncIterable(asyncRecords)) return invalidResult([], config.value.mode);
  let iterator: AsyncIterator<unknown> | undefined;
  try {
    if (isAborted(signal)) return verifier.aborted();
    iterator = asyncRecords[Symbol.asyncIterator]();
    for (;;) {
      if (isAborted(signal)) return verifier.aborted();
      let next: IteratorResult<unknown>;
      try {
        next = await iterator.next();
      } catch {
        return verifier.streamFailure();
      }
      if (next.done === true) {
        if (isAborted(signal)) return verifier.aborted();
        return verifier.finish();
      }
      verifier.process(next.value);
      if (isAborted(signal)) return verifier.aborted();
    }
  } finally {
    if (iterator !== undefined && isAborted(signal)) {
      try {
        await iterator.return?.();
      } catch {
        // The requested abort result remains authoritative; no payload is exposed.
      }
    }
  }
}

class ChainVerificationAccumulator {
  private readonly collector: DiagnosticCollector;
  private readonly duplicateDetector;
  private previous: PreviousLink | undefined;
  private first: LinkEvidence | undefined;
  private last: LinkEvidence | undefined;
  private expectedPosition: number | undefined;
  private bytesNormalized = 0;
  private recordsVerified = 0;
  private linksVerified = 0;
  private recordsSeen = 0;
  private fatal = false;

  constructor(
    private readonly config: VerificationConfig,
    private readonly options: ChainVerificationOptions,
    private readonly rules: RuleSet,
  ) {
    this.collector = new DiagnosticCollector(options.limits);
    this.duplicateDetector = createDuplicateDetector(config.duplicatePolicy, options.limits);
  }

  process(item: unknown): void {
    this.recordsSeen += 1;
    const parsedItem = parseVerificationItem(item, this.options.limits);
    if (!parsedItem.ok) {
      addAll(this.collector, parsedItem.diagnostics);
      this.fatal = true;
      return;
    }
    const evidence = parseLinkEvidence(parsedItem.value.evidence, this.options.limits);
    if (!evidence.ok) {
      addAll(this.collector, evidence.diagnostics);
      this.fatal = true;
      return;
    }
    addAll(
      this.collector,
      this.rules.evaluate(
        Object.freeze({
          phase: "link",
          link: evidence.value,
          recordId: evidence.value.recordId,
          position: evidence.value.position,
        }),
        this.options.limits,
      ),
    );
    if (this.first === undefined) {
      this.first = evidence.value;
      this.expectedPosition = initialPosition(this.config, evidence.value);
    }
    checkMetadata(evidence.value, this.config, this.collector);
    if (this.expectedPosition !== undefined && evidence.value.position !== this.expectedPosition) {
      this.collector.addCode("POSITION_MISMATCH", "chain", { position: evidence.value.position });
    }
    if (
      this.previous !== undefined &&
      !samePrevious(evidence.value.previous, this.previous, this.config.algorithm)
    ) {
      this.collector.addCode("PREVIOUS_LINK_MISMATCH", "chain", {
        position: evidence.value.position,
      });
    }
    if (this.previous === undefined)
      checkStartBoundary(evidence.value, this.config, this.collector);

    const record = computeRecord(
      {
        contextId: this.config.contextId,
        recordId: evidence.value.recordId,
        payload: parsedItem.value.payload,
        profile: this.config.profile,
        algorithm: this.config.algorithm,
      },
      recordOptions(this.options, this.rules),
    );
    if (!record.ok) {
      addAll(this.collector, record.diagnostics);
      this.fatal = true;
    } else {
      this.bytesNormalized += record.value.evidence.normalizedByteLength;
      if (
        !sameDigest(
          record.value.evidence.contentDigest,
          evidence.value.contentDigest,
          this.config.algorithm,
        )
      ) {
        this.collector.addCode("CONTENT_DIGEST_MISMATCH", "record", {
          recordId: evidence.value.recordId,
          position: evidence.value.position,
        });
      }
      if (
        !sameDigest(
          record.value.evidence.recordDigest,
          evidence.value.recordDigest,
          this.config.algorithm,
        )
      ) {
        this.collector.addCode("RECORD_DIGEST_MISMATCH", "record", {
          recordId: evidence.value.recordId,
          position: evidence.value.position,
        });
      } else {
        this.recordsVerified += 1;
      }
    }
    const selfLink = recomposeLink(evidence.value, this.options.limits);
    if (!selfLink.ok) {
      addAll(this.collector, selfLink.diagnostics);
      this.fatal = true;
    } else if (
      !sameDigest(selfLink.value.toHex(), evidence.value.linkDigest, this.config.algorithm)
    ) {
      this.collector.addCode("LINK_DIGEST_MISMATCH", "link", {
        recordId: evidence.value.recordId,
        position: evidence.value.position,
      });
    } else {
      this.linksVerified += 1;
    }
    const observed = observedLink(evidence.value);
    const duplicates = this.duplicateDetector.inspect(observed);
    if (!duplicates.ok) {
      addAll(this.collector, duplicates.diagnostics);
      this.fatal = true;
    } else {
      addAll(this.collector, duplicates.value);
      try {
        this.duplicateDetector.commit(observed);
      } catch {
        this.collector.addCode("INTERNAL_INVARIANT_BROKEN", "chain");
        this.fatal = true;
      }
    }
    this.previous = Object.freeze({ kind: "digest", value: evidence.value.linkDigest });
    this.expectedPosition = evidence.value.position + 1;
    this.last = evidence.value;
  }

  finish(): VerificationResult<ChainSummaryEvidence> {
    if (this.recordsSeen === 0 && !this.config.allowEmpty) {
      this.collector.addCode("EMPTY_CHAIN_FORBIDDEN", "chain");
    }
    const boundaries = determineBoundaries(
      this.config,
      this.first,
      this.last,
      this.recordsSeen,
      this.collector,
    );
    addAll(
      this.collector,
      this.rules.evaluate(
        Object.freeze({
          phase: "chain",
          chain: Object.freeze({ count: this.recordsSeen, boundaries, mode: this.config.mode }),
        }),
        this.options.limits,
      ),
    );
    const diagnostics = this.collector.finish();
    const status =
      diagnostics.some(({ severity }) => severity === "error") || this.fatal
        ? "invalid"
        : this.config.mode === "complete" &&
            (boundaries.start === "unverified" || boundaries.end === "unverified")
          ? "indeterminate"
          : "valid";
    return Object.freeze({
      status,
      diagnostics,
      evidence: buildSummary(
        this.config,
        this.first,
        this.last,
        this.recordsSeen,
        diagnostics,
        status,
        boundaries,
      ),
      stats: buildStats(
        this.recordsSeen,
        this.recordsVerified,
        this.linksVerified,
        this.bytesNormalized,
        diagnostics,
      ),
      boundaries,
      verificationMode: this.config.mode,
    });
  }

  streamFailure(): VerificationResult<ChainSummaryEvidence> {
    this.collector.addCode("INPUT_STREAM_FAILED", "output");
    return this.failureResult("invalid");
  }

  aborted(): VerificationResult<ChainSummaryEvidence> {
    this.collector.addCode("OPERATION_ABORTED", "output");
    return this.failureResult("aborted");
  }

  private failureResult(status: "invalid" | "aborted"): VerificationResult<ChainSummaryEvidence> {
    const diagnostics = this.collector.finish();
    return Object.freeze({
      status,
      diagnostics,
      evidence: undefined,
      stats: buildStats(
        this.recordsSeen,
        this.recordsVerified,
        this.linksVerified,
        this.bytesNormalized,
        diagnostics,
      ),
      boundaries: Object.freeze({
        start: "not-applicable" as const,
        end: "not-applicable" as const,
      }),
      verificationMode: this.config.mode,
    });
  }
}

function validateVerificationConfig(
  value: unknown,
  limits: Limits,
  kind: "sync" | "async",
): OperationResult<VerificationConfig> {
  const entries = inspectPlainObject(value);
  if (entries === undefined) return verificationFailure(limits);
  const fields = new Map(entries);
  const allowed = new Set([
    "contextId",
    "sequenceId",
    "profile",
    "algorithm",
    "mode",
    "records",
    "expectedCount",
    "expectedFinalLinkDigest",
    "expectedPrevious",
    "startPosition",
    "allowEmpty",
    "duplicatePolicy",
    "rules",
  ]);
  for (const key of fields.keys()) if (!allowed.has(key)) return verificationFailure(limits);
  for (const key of ["contextId", "sequenceId", "profile", "algorithm", "mode", "records"]) {
    if (!fields.has(key)) return verificationFailure(limits);
  }
  const contextId = validateContextId(fields.get("contextId"));
  const sequenceId = validateSequenceId(fields.get("sequenceId"));
  const profile = validateProfile(fields.get("profile"), limits);
  const algorithm = validateAlgorithmId(fields.get("algorithm"));
  const mode = fields.get("mode");
  const records = fields.get("records");
  const allowEmpty = fields.get("allowEmpty") ?? false;
  if (
    !contextId.ok ||
    !sequenceId.ok ||
    !profile.ok ||
    !algorithm.ok ||
    !isMode(mode) ||
    typeof allowEmpty !== "boolean"
  ) {
    return verificationFailure(limits);
  }
  const recordsResult =
    kind === "sync" ? asIterable(records, limits) : asAsyncIterable(records, limits);
  if (!recordsResult.ok) return recordsResult;
  const expectedCount = optionalSafeInteger(fields.get("expectedCount"));
  if (fields.has("expectedCount") && expectedCount === undefined)
    return verificationFailure(limits);
  const expectedFinal = fields.has("expectedFinalLinkDigest")
    ? validateDigest(fields.get("expectedFinalLinkDigest"), algorithm.value)
    : undefined;
  if (expectedFinal !== undefined && !expectedFinal.ok) return verificationFailure(limits);
  const expectedPrevious = fields.has("expectedPrevious")
    ? parsePrevious(fields.get("expectedPrevious"), algorithm.value, limits)
    : undefined;
  if (expectedPrevious !== undefined && !expectedPrevious.ok) return verificationFailure(limits);
  const startPosition = optionalSafeInteger(fields.get("startPosition"));
  if (fields.has("startPosition") && startPosition === undefined)
    return verificationFailure(limits);
  const duplicatePolicy = parseDuplicatePolicy(fields.get("duplicatePolicy"), limits);
  if (!duplicatePolicy.ok) return duplicatePolicy;
  return {
    ok: true as const,
    value: Object.freeze({
      contextId: contextId.value.value,
      sequenceId: sequenceId.value.value,
      profile: profile.value,
      algorithm: algorithm.value,
      mode,
      records: recordsResult.value,
      ...(expectedCount === undefined ? {} : { expectedCount }),
      ...(expectedFinal === undefined
        ? {}
        : { expectedFinalLinkDigest: expectedFinal.value.toHex() }),
      ...(expectedPrevious === undefined ? {} : { expectedPrevious: expectedPrevious.value }),
      ...(startPosition === undefined ? {} : { startPosition }),
      allowEmpty,
      duplicatePolicy: duplicatePolicy.value,
      rules: fields.get("rules"),
    }),
    diagnostics: Object.freeze([]),
  };
}

function parseVerificationItem(value: unknown, limits: Limits): OperationResult<VerificationItem> {
  const entries = inspectPlainObject(value);
  if (entries === undefined) return verificationFailure(limits);
  const fields = new Map(entries);
  if (fields.size !== 2 || !fields.has("payload") || !fields.has("evidence"))
    return verificationFailure(limits);
  return {
    ok: true as const,
    value: Object.freeze({ payload: fields.get("payload"), evidence: fields.get("evidence") }),
    diagnostics: Object.freeze([]),
  };
}

function checkMetadata(
  evidence: LinkEvidence,
  config: VerificationConfig,
  collector: DiagnosticCollector,
): void {
  if (
    evidence.contextId !== config.contextId ||
    evidence.sequenceId !== config.sequenceId ||
    evidence.profile.id !== config.profile.id ||
    evidence.profile.version !== config.profile.version ||
    evidence.algorithm !== config.algorithm
  )
    collector.addCode("CHAIN_CONFIGURATION_MISMATCH", "chain", {
      recordId: evidence.recordId,
      position: evidence.position,
    });
}

function checkStartBoundary(
  evidence: LinkEvidence,
  config: VerificationConfig,
  collector: DiagnosticCollector,
): void {
  if (config.mode === "complete") {
    if (evidence.position !== 0 || evidence.previous.kind !== "none") {
      collector.addCode("POSITION_MISMATCH", "chain", { position: evidence.position });
    }
    return;
  }
  if (config.mode === "fragment") {
    if (config.startPosition !== undefined && evidence.position !== config.startPosition) {
      collector.addCode("POSITION_MISMATCH", "chain", { position: evidence.position });
    }
    if (
      config.expectedPrevious !== undefined &&
      !samePrevious(evidence.previous, config.expectedPrevious, config.algorithm)
    ) {
      collector.addCode("PREVIOUS_LINK_MISMATCH", "chain", { position: evidence.position });
    }
  }
}

function determineBoundaries(
  config: VerificationConfig,
  first: LinkEvidence | undefined,
  last: LinkEvidence | undefined,
  count: number,
  collector: DiagnosticCollector,
): Readonly<{ readonly start: BoundaryState; readonly end: BoundaryState }> {
  if (config.mode === "internal")
    return Object.freeze({ start: "not-applicable", end: "not-applicable" });
  let start: BoundaryState = "unverified";
  let end: BoundaryState = "unverified";
  if (config.mode === "complete") {
    start = first?.position === 0 && first.previous.kind === "none" ? "verified" : "unverified";
    const countVerified = config.expectedCount !== undefined && config.expectedCount === count;
    if (config.expectedCount === undefined) {
      collector.addCode("BOUNDARY_UNVERIFIED", "chain");
    } else if (!countVerified) {
      collector.addCode("EXPECTED_COUNT_MISMATCH", "chain");
    }
    if (config.expectedFinalLinkDigest === undefined) {
      collector.addCode("BOUNDARY_UNVERIFIED", "chain");
    } else if (
      last === undefined ||
      !sameDigest(last.linkDigest, config.expectedFinalLinkDigest, config.algorithm)
    ) {
      collector.addCode("FINAL_LINK_MISMATCH", "chain");
    } else if (countVerified) {
      end = "verified";
    }
    if (start === "unverified") collector.addCode("BOUNDARY_UNVERIFIED", "chain");
    return Object.freeze({ start, end });
  }
  if (config.expectedPrevious !== undefined) {
    start =
      first !== undefined && samePrevious(first.previous, config.expectedPrevious, config.algorithm)
        ? "verified"
        : "unverified";
  }
  if (config.expectedFinalLinkDigest !== undefined) {
    end =
      last !== undefined &&
      sameDigest(last.linkDigest, config.expectedFinalLinkDigest, config.algorithm)
        ? "verified"
        : "unverified";
    if (end === "unverified") collector.addCode("FINAL_LINK_MISMATCH", "chain");
  }
  if (start === "unverified") collector.addCode("BOUNDARY_UNVERIFIED", "chain");
  if (end === "unverified") collector.addCode("BOUNDARY_UNVERIFIED", "chain");
  return Object.freeze({ start, end });
}

function recomposeLink(evidence: LinkEvidence, limits: Limits): OperationResult<Digest> {
  const recordDigest = validateDigest(evidence.recordDigest, evidence.algorithm);
  if (!recordDigest.ok) return recordDigest;
  const previous =
    evidence.previous.kind === "digest"
      ? validateDigest(evidence.previous.value, evidence.algorithm)
      : undefined;
  if (previous !== undefined && !previous.ok) return previous;
  return hashFrame(
    evidence.algorithm,
    buildLinkFrame(
      {
        algorithm: evidence.algorithm,
        contextId: evidence.contextId,
        sequenceId: evidence.sequenceId,
        position: evidence.position,
        recordId: evidence.recordId,
        recordDigest: recordDigest.value,
        ...(previous === undefined ? {} : { previousLinkDigest: previous.value }),
      },
      limits,
    ),
    limits,
  );
}

function buildSummary(
  config: VerificationConfig,
  first: LinkEvidence | undefined,
  last: LinkEvidence | undefined,
  count: number,
  diagnostics: readonly Diagnostic[],
  status: "valid" | "invalid" | "indeterminate",
  boundaries: Readonly<{ readonly start: BoundaryState; readonly end: BoundaryState }>,
): ChainSummaryEvidence {
  const base = {
    $schema: CHAIN_SUMMARY_EVIDENCE_SCHEMA,
    protocolVersion: 1 as const,
    contextId: config.contextId,
    sequenceId: config.sequenceId,
    profile: Object.freeze({ ...config.profile }),
    algorithm: config.algorithm,
    count,
    boundaries,
    status,
    diagnostics: diagnosticSummary(diagnostics),
  };
  if (first === undefined || last === undefined) return Object.freeze(base);
  return Object.freeze({
    ...base,
    firstPosition: first.position,
    lastPosition: last.position,
    firstLinkDigest: first.linkDigest,
    finalLinkDigest: last.linkDigest,
  });
}

function buildStats(
  recordsSeen: number,
  recordsVerified: number,
  linksVerified: number,
  bytesNormalized: number,
  diagnostics: readonly Diagnostic[],
): VerificationStats {
  const summary = diagnosticSummary(diagnostics);
  return Object.freeze({
    recordsSeen,
    recordsVerified,
    linksVerified,
    bytesNormalized,
    ...summary,
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

function recordOptions(options: ChainVerificationOptions, rules: RuleSet): RecordServiceOptions {
  return Object.freeze({ limits: options.limits, profiles: options.profiles, rules });
}

function initialPosition(config: VerificationConfig, evidence: LinkEvidence): number {
  if (config.mode === "fragment" && config.startPosition !== undefined) return config.startPosition;
  return evidence.position;
}

function samePrevious(left: PreviousLink, right: PreviousLink, algorithm: string): boolean {
  if (left.kind !== right.kind) return false;
  if (left.kind === "none" || right.kind === "none") return true;
  return sameDigest(left.value, right.value, algorithm);
}

function sameDigest(left: string, right: string, algorithm: string): boolean {
  const leftDigest = validateDigest(left, algorithm);
  const rightDigest = validateDigest(right, algorithm);
  return leftDigest.ok && rightDigest.ok && equalDigest(leftDigest.value, rightDigest.value);
}

function parsePrevious(
  value: unknown,
  algorithm: string,
  limits: Limits,
): OperationResult<PreviousLink> {
  const entries = inspectPlainObject(value);
  if (entries === undefined) return verificationFailure(limits);
  const fields = new Map(entries);
  if (fields.get("kind") === "none" && fields.size === 1)
    return {
      ok: true as const,
      value: Object.freeze({ kind: "none" as const }),
      diagnostics: Object.freeze([]),
    };
  if (fields.get("kind") !== "digest" || fields.size !== 2) return verificationFailure(limits);
  const digest = validateDigest(fields.get("value"), algorithm);
  if (!digest.ok) return verificationFailure(limits);
  return {
    ok: true as const,
    value: Object.freeze({ kind: "digest" as const, value: digest.value.toHex() }),
    diagnostics: Object.freeze([]),
  };
}

function parseDuplicatePolicy(value: unknown, limits: Limits): OperationResult<DuplicatePolicy> {
  if (value === undefined)
    return {
      ok: true as const,
      value: Object.freeze({ kind: "none" as const }),
      diagnostics: Object.freeze([]),
    };
  const entries = inspectPlainObject(value);
  if (entries === undefined) return verificationFailure(limits);
  const fields = new Map(entries);
  const kind = fields.get("kind");
  if (kind === "none" && fields.size === 1)
    return { ok: true as const, value: Object.freeze({ kind }), diagnostics: Object.freeze([]) };
  if (kind === "window" && fields.size === 2) {
    const size = fields.get("size");
    if (
      typeof size !== "number" ||
      !Number.isSafeInteger(size) ||
      size < 1 ||
      size > limits.maxFullRecords
    )
      return verificationFailure(limits);
    return {
      ok: true as const,
      value: Object.freeze({ kind, size }),
      diagnostics: Object.freeze([]),
    };
  }
  if (kind === "full" && fields.size === 2) {
    const maxRecords = fields.get("maxRecords");
    if (
      typeof maxRecords !== "number" ||
      !Number.isSafeInteger(maxRecords) ||
      maxRecords < 1 ||
      maxRecords > limits.maxFullRecords
    )
      return verificationFailure(limits);
    return {
      ok: true as const,
      value: Object.freeze({ kind, maxRecords }),
      diagnostics: Object.freeze([]),
    };
  }
  if (kind === "external" && fields.size === 2 && fields.has("index")) {
    const indexEntries = inspectPlainObject(fields.get("index"));
    if (indexEntries === undefined) return verificationFailure(limits);
    const indexFields = new Map(indexEntries);
    const observe = indexFields.get("observe");
    if (indexFields.size !== 1 || typeof observe !== "function") return verificationFailure(limits);
    return {
      ok: true as const,
      value: Object.freeze({
        kind,
        index: Object.freeze({
          observe(batch: readonly DuplicateObservation[]): unknown {
            return Reflect.apply(observe, undefined, [batch]);
          },
        }),
      }),
      diagnostics: Object.freeze([]),
    };
  }
  return verificationFailure(limits);
}

function optionalSafeInteger(value: unknown): number | undefined {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0 ? value : undefined;
}

function isMode(value: unknown): value is VerificationMode {
  return value === "complete" || value === "fragment" || value === "internal";
}

function addAll(collector: DiagnosticCollector, diagnostics: readonly Diagnostic[]): void {
  for (const diagnostic of diagnostics) collector.add(diagnostic);
}

function verificationFailure<T>(limits: Limits): OperationResult<T> {
  const collector = new DiagnosticCollector(limits);
  collector.addCode("INPUT_TYPE_INVALID", "input");
  return { ok: false as const, diagnostics: collector.finish() };
}

function invalidResult(
  diagnostics: readonly Diagnostic[],
  mode: VerificationMode,
): VerificationResult<ChainSummaryEvidence> {
  return Object.freeze({
    status: "invalid",
    diagnostics,
    evidence: undefined,
    stats: buildStats(0, 0, 0, 0, diagnostics),
    boundaries: Object.freeze({ start: "not-applicable", end: "not-applicable" }),
    verificationMode: mode,
  });
}

function isIterable(value: unknown): value is Iterable<unknown> {
  if (typeof value !== "object" || value === null) return false;
  return typeof Reflect.get(value, Symbol.iterator) === "function";
}

function asIterable(value: unknown, limits: Limits): OperationResult<Iterable<unknown>> {
  return isIterable(value)
    ? { ok: true as const, value, diagnostics: Object.freeze([]) }
    : verificationFailure(limits);
}

function isAsyncIterable(value: unknown): value is AsyncIterable<unknown> {
  if (typeof value !== "object" || value === null) return false;
  return typeof Reflect.get(value, Symbol.asyncIterator) === "function";
}

function asAsyncIterable(value: unknown, limits: Limits): OperationResult<AsyncIterable<unknown>> {
  return isAsyncIterable(value)
    ? { ok: true as const, value, diagnostics: Object.freeze([]) }
    : verificationFailure(limits);
}

function isAborted(signal: AbortSignal | undefined): boolean {
  return signal?.aborted === true;
}
