// SPDX-License-Identifier: Apache-2.0

import type {
  ChainSummaryEvidence,
  BoundaryState,
  DiagnosticSummary,
  Evidence,
  EvidenceProfile,
  LinkEvidence,
  PreviousLink,
  RecordEvidence,
} from "../domain/evidence.js";
import {
  CHAIN_SUMMARY_EVIDENCE_SCHEMA,
  LINK_EVIDENCE_SCHEMA,
  RECORD_EVIDENCE_SCHEMA,
} from "../domain/evidence.js";
import type { Limits } from "../domain/limits.js";
import type { OperationResult } from "../domain/operation-result.js";
import { failure, success } from "../domain/operation-result.js";
import { validateAlgorithmId } from "../validation/algorithm-validation.js";
import { DiagnosticCollector } from "../validation/diagnostic-collector.js";
import { validateDigest } from "../validation/digest-validation.js";
import {
  validateContextId,
  validateRecordId,
  validateSequenceId,
} from "../validation/identifier-validation.js";
import { parseJsonText } from "../validation/json-text-parser.js";
import { inspectPlainObject } from "../validation/object-inspection.js";
import { validatePosition } from "../validation/position-validation.js";
import { validateProtocolVersion } from "../validation/version-validation.js";
import { validateProfile } from "../records/record-service.js";

export function parseEvidence(value: unknown, limits: Limits): OperationResult<Evidence> {
  const entries = inspectPlainObject(value);
  if (entries === undefined) return evidenceFailure("EVIDENCE_INVALID", limits);
  const schema = new Map(entries).get("$schema");
  if (schema === RECORD_EVIDENCE_SCHEMA) return parseRecordEvidence(value, limits);
  if (schema === LINK_EVIDENCE_SCHEMA) return parseLinkEvidence(value, limits);
  if (schema === CHAIN_SUMMARY_EVIDENCE_SCHEMA) return parseChainSummaryEvidence(value, limits);
  return evidenceFailure("EVIDENCE_SCHEMA_UNKNOWN", limits);
}

export function parseEvidenceText(value: unknown, limits: Limits): OperationResult<Evidence> {
  const parsed = parseJsonText(value, limits);
  if (!parsed.ok) return parsed;
  return parseEvidence(parsed.value, limits);
}

export function parseRecordEvidence(
  value: unknown,
  limits: Limits,
): OperationResult<RecordEvidence> {
  const fields = strictFields(value, [
    "$schema",
    "protocolVersion",
    "contextId",
    "recordId",
    "profile",
    "algorithm",
    "normalizedByteLength",
    "contentDigest",
    "recordDigest",
  ]);
  if (fields?.get("$schema") !== RECORD_EVIDENCE_SCHEMA) {
    return evidenceFailure("EVIDENCE_INVALID", limits);
  }
  const common = parseRecordFields(fields, limits);
  if (!common.ok) return common;
  return success(Object.freeze({ $schema: RECORD_EVIDENCE_SCHEMA, ...common.value }));
}

export function parseLinkEvidence(value: unknown, limits: Limits): OperationResult<LinkEvidence> {
  const fields = strictFields(value, [
    "$schema",
    "protocolVersion",
    "contextId",
    "sequenceId",
    "position",
    "recordId",
    "profile",
    "algorithm",
    "normalizedByteLength",
    "contentDigest",
    "recordDigest",
    "previous",
    "linkDigest",
  ]);
  if (fields?.get("$schema") !== LINK_EVIDENCE_SCHEMA) {
    return evidenceFailure("EVIDENCE_INVALID", limits);
  }
  const common = parseRecordFields(fields, limits);
  const sequenceId = validateSequenceId(fields.get("sequenceId"));
  const position = validatePosition(fields.get("position"));
  if (!common.ok) return common;
  if (!sequenceId.ok) return evidenceFailure("EVIDENCE_INVALID", limits);
  if (!position.ok) return evidenceFailure("EVIDENCE_INVALID", limits);
  const previous = parsePrevious(fields.get("previous"), common.value.algorithm, limits);
  const linkDigest = validateDigest(fields.get("linkDigest"), common.value.algorithm);
  if (!previous.ok || !linkDigest.ok) return evidenceFailure("EVIDENCE_INVALID", limits);
  if ((position.value.value === 0) !== (previous.value.kind === "none")) {
    return evidenceFailure("EVIDENCE_INVALID", limits);
  }
  return success(
    Object.freeze({
      $schema: LINK_EVIDENCE_SCHEMA,
      ...common.value,
      sequenceId: sequenceId.value.value,
      position: position.value.value,
      previous: previous.value,
      linkDigest: linkDigest.value.toHex(),
    }),
  );
}

export function parseChainSummaryEvidence(
  value: unknown,
  limits: Limits,
): OperationResult<ChainSummaryEvidence> {
  const fields = strictFields(
    value,
    [
      "$schema",
      "protocolVersion",
      "contextId",
      "sequenceId",
      "profile",
      "algorithm",
      "count",
      "firstPosition",
      "lastPosition",
      "firstLinkDigest",
      "finalLinkDigest",
      "boundaries",
      "status",
      "diagnostics",
    ],
    true,
  );
  if (fields?.get("$schema") !== CHAIN_SUMMARY_EVIDENCE_SCHEMA) {
    return evidenceFailure("EVIDENCE_INVALID", limits);
  }
  const protocol = validateProtocolVersion(fields.get("protocolVersion"));
  const contextId = validateContextId(fields.get("contextId"));
  const sequenceId = validateSequenceId(fields.get("sequenceId"));
  const profile = validateProfile(fields.get("profile"), limits);
  const algorithm = validateAlgorithmId(fields.get("algorithm"));
  const count = validateNonNegativeSafeInteger(fields.get("count"));
  const boundaries = parseBoundaries(fields.get("boundaries"));
  const status = fields.get("status");
  const diagnostics = parseDiagnosticSummary(fields.get("diagnostics"));
  if (
    !protocol.ok ||
    !contextId.ok ||
    !sequenceId.ok ||
    !profile.ok ||
    !algorithm.ok ||
    count === undefined ||
    boundaries === undefined ||
    !isStatus(status) ||
    diagnostics === undefined
  ) {
    return evidenceFailure("EVIDENCE_INVALID", limits);
  }
  if (count === 0) {
    if (
      fields.has("firstPosition") ||
      fields.has("lastPosition") ||
      fields.has("firstLinkDigest") ||
      fields.has("finalLinkDigest")
    )
      return evidenceFailure("EVIDENCE_INVALID", limits);
    return success(
      Object.freeze({
        $schema: CHAIN_SUMMARY_EVIDENCE_SCHEMA,
        protocolVersion: 1,
        contextId: contextId.value.value,
        sequenceId: sequenceId.value.value,
        profile: profile.value,
        algorithm: algorithm.value,
        count,
        boundaries,
        status,
        diagnostics,
      }),
    );
  }
  if (
    !fields.has("firstPosition") ||
    !fields.has("lastPosition") ||
    !fields.has("firstLinkDigest") ||
    !fields.has("finalLinkDigest")
  )
    return evidenceFailure("EVIDENCE_INVALID", limits);
  const firstPosition = validateNonNegativeSafeInteger(fields.get("firstPosition"));
  const lastPosition = validateNonNegativeSafeInteger(fields.get("lastPosition"));
  const firstDigest = validateDigest(fields.get("firstLinkDigest"), algorithm.value);
  const finalDigest = validateDigest(fields.get("finalLinkDigest"), algorithm.value);
  if (
    firstPosition === undefined ||
    lastPosition === undefined ||
    firstPosition > lastPosition ||
    !firstDigest.ok ||
    !finalDigest.ok
  )
    return evidenceFailure("EVIDENCE_INVALID", limits);
  return success(
    Object.freeze({
      $schema: CHAIN_SUMMARY_EVIDENCE_SCHEMA,
      protocolVersion: 1,
      contextId: contextId.value.value,
      sequenceId: sequenceId.value.value,
      profile: profile.value,
      algorithm: algorithm.value,
      count,
      firstPosition,
      lastPosition,
      firstLinkDigest: firstDigest.value.toHex(),
      finalLinkDigest: finalDigest.value.toHex(),
      boundaries,
      status,
      diagnostics,
    }),
  );
}

interface ParsedRecordFields {
  readonly protocolVersion: 1;
  readonly contextId: string;
  readonly recordId: string;
  readonly profile: EvidenceProfile;
  readonly algorithm: "sha-256" | "sha-384" | "sha-512";
  readonly normalizedByteLength: number;
  readonly contentDigest: string;
  readonly recordDigest: string;
}

function parseRecordFields(
  fields: ReadonlyMap<string, unknown>,
  limits: Limits,
): OperationResult<ParsedRecordFields> {
  const protocol = validateProtocolVersion(fields.get("protocolVersion"));
  const contextId = validateContextId(fields.get("contextId"));
  const recordId = validateRecordId(fields.get("recordId"));
  const profile = validateProfile(fields.get("profile"), limits);
  const algorithm = validateAlgorithmId(fields.get("algorithm"));
  const normalizedByteLength = validateNonNegativeSafeInteger(fields.get("normalizedByteLength"));
  if (
    !protocol.ok ||
    !contextId.ok ||
    !recordId.ok ||
    !profile.ok ||
    !algorithm.ok ||
    normalizedByteLength === undefined
  )
    return evidenceFailure("EVIDENCE_INVALID", limits);
  const contentDigest = validateDigest(fields.get("contentDigest"), algorithm.value);
  const recordDigest = validateDigest(fields.get("recordDigest"), algorithm.value);
  if (!contentDigest.ok || !recordDigest.ok) return evidenceFailure("EVIDENCE_INVALID", limits);
  return success(
    Object.freeze({
      protocolVersion: 1,
      contextId: contextId.value.value,
      recordId: recordId.value.value,
      profile: profile.value,
      algorithm: algorithm.value,
      normalizedByteLength,
      contentDigest: contentDigest.value.toHex(),
      recordDigest: recordDigest.value.toHex(),
    }),
  );
}

function parsePrevious(
  value: unknown,
  algorithm: string,
  limits: Limits,
): OperationResult<PreviousLink> {
  const fields = strictFields(value, ["kind", "value"], true);
  if (fields === undefined) return evidenceFailure("EVIDENCE_INVALID", limits);
  if (fields.get("kind") === "none" && fields.size === 1)
    return success(Object.freeze({ kind: "none" }));
  if (fields.get("kind") !== "digest" || fields.size !== 2)
    return evidenceFailure("EVIDENCE_INVALID", limits);
  const digest = validateDigest(fields.get("value"), algorithm);
  if (!digest.ok) return evidenceFailure("EVIDENCE_INVALID", limits);
  return success(Object.freeze({ kind: "digest", value: digest.value.toHex() }));
}

function parseBoundaries(
  value: unknown,
): Readonly<{ readonly start: BoundaryState; readonly end: BoundaryState }> | undefined {
  const fields = strictFields(value, ["start", "end"]);
  if (fields === undefined) return undefined;
  const start = fields.get("start");
  const end = fields.get("end");
  if (!isBoundary(start) || !isBoundary(end)) return undefined;
  return Object.freeze({ start, end });
}

function parseDiagnosticSummary(value: unknown): DiagnosticSummary | undefined {
  const fields = strictFields(value, ["errors", "warnings", "info", "truncated"]);
  if (fields === undefined) return undefined;
  const errors = validateNonNegativeSafeInteger(fields.get("errors"));
  const warnings = validateNonNegativeSafeInteger(fields.get("warnings"));
  const info = validateNonNegativeSafeInteger(fields.get("info"));
  const truncated = fields.get("truncated");
  if (
    errors === undefined ||
    warnings === undefined ||
    info === undefined ||
    typeof truncated !== "boolean"
  )
    return undefined;
  return Object.freeze({ errors, warnings, info, truncated });
}

function strictFields(
  value: unknown,
  keys: readonly string[],
  optional = false,
): ReadonlyMap<string, unknown> | undefined {
  const entries = inspectPlainObject(value);
  if (entries === undefined) return undefined;
  const fields = new Map(entries);
  for (const key of fields.keys()) if (!keys.includes(key)) return undefined;
  if (!optional && fields.size !== keys.length) return undefined;
  if (optional && fields.size > keys.length) return undefined;
  return fields;
}

function validateNonNegativeSafeInteger(value: unknown): number | undefined {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0 ? value : undefined;
}

function isBoundary(value: unknown): value is "verified" | "unverified" | "not-applicable" {
  return value === "verified" || value === "unverified" || value === "not-applicable";
}

function isStatus(value: unknown): value is "valid" | "invalid" | "indeterminate" | "aborted" {
  return (
    value === "valid" || value === "invalid" || value === "indeterminate" || value === "aborted"
  );
}

function evidenceFailure<T>(
  code: "EVIDENCE_INVALID" | "EVIDENCE_SCHEMA_UNKNOWN",
  limits: Limits,
): OperationResult<T> {
  const collector = new DiagnosticCollector(limits);
  collector.addCode(code, "input");
  return failure(collector.finish());
}
