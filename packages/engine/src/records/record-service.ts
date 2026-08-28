// SPDX-License-Identifier: Apache-2.0

import type { RecordEvidence } from "../domain/evidence.js";
import { RECORD_EVIDENCE_SCHEMA } from "../domain/evidence.js";
import type { Limits } from "../domain/limits.js";
import type { OperationResult } from "../domain/operation-result.js";
import { failure, success } from "../domain/operation-result.js";
import type { AlgorithmId } from "../domain/algorithm-id.js";
import type { Diagnostic } from "../domain/diagnostic.js";
import type { Digest } from "../domain/digest.js";
import { buildTrustedContentFrame, buildTrustedRecordFrame } from "../framing/frame-builders.js";
import { hashTrustedFrame } from "../hashing/hash-frame.js";
import { normalizeRegisteredToBytes } from "../normalization/normalize.js";
import type { ProfileRegistry } from "../normalization/profile-registry.js";
import type { RuleSet } from "../rules/rule-set.js";
import { createReadonlyByteView } from "../rules/rule-set.js";
import { DiagnosticCollector } from "../validation/diagnostic-collector.js";
import { validateAlgorithmId } from "../validation/algorithm-validation.js";
import { equalDigest, validateDigest } from "../validation/digest-validation.js";
import {
  validateContextId,
  validateProfileId,
  validateRecordId,
} from "../validation/identifier-validation.js";
import { inspectExactProperties } from "../validation/object-inspection.js";
import { validateProfileVersion } from "../validation/version-validation.js";

export interface RecordServiceOptions {
  readonly limits: Limits;
  readonly profiles: ProfileRegistry;
  readonly rules?: RuleSet;
}

export interface ComputedRecord {
  readonly evidence: RecordEvidence;
}

interface ValidatedRecordInput {
  readonly contextId: string;
  readonly recordId: string;
  readonly payload: unknown;
  readonly profile: Readonly<{ readonly id: string; readonly version: string }>;
  readonly algorithm: AlgorithmId;
}

export function hashRecord(
  input: unknown,
  options: RecordServiceOptions,
): OperationResult<RecordEvidence> {
  const computed = computeRecord(input, options);
  if (!computed.ok) return computed;
  return success(computed.value.evidence, computed.diagnostics);
}

export function computeRecord(
  input: unknown,
  options: RecordServiceOptions,
): OperationResult<ComputedRecord> {
  const validated = validateRecordInput(input, options.limits);
  if (!validated.ok) return validated;
  const collector = new DiagnosticCollector(options.limits);
  const hasRules = options.rules?.hasRules() === true;
  if (hasRules) {
    addAll(
      collector,
      options.rules.evaluate(
        Object.freeze({
          phase: "input",
          input: freezeInputView(validated.value),
          recordId: validated.value.recordId,
        }),
        options.limits,
      ),
    );
  }
  if (collector.hasErrors()) return failure(collector.finish());

  const profileReference = validateProfileReference(validated.value, options);
  if (!profileReference.ok) return profileReference;
  const profile = profileReference.value;
  if (profile.inputKind === "json" && inputPayloadIsBytes(validated.value.payload)) {
    collector.addCode("PROFILE_INPUT_KIND_MISMATCH", "input", {
      recordId: validated.value.recordId,
    });
    return failure(collector.finish());
  }
  if (profile.inputKind === "bytes" && !inputPayloadIsBytes(validated.value.payload)) {
    collector.addCode("PROFILE_INPUT_KIND_MISMATCH", "input", {
      recordId: validated.value.recordId,
    });
    return failure(collector.finish());
  }
  const profileInput = profile.validate(validated.value.payload, options.limits);
  if (!profileInput.ok) return profileInput;
  const normalized = normalizeRegisteredToBytes(profile, profileInput.value, options.limits);
  if (!normalized.ok) return normalized;
  addAll(collector, normalized.diagnostics);
  if (hasRules) {
    addAll(
      collector,
      options.rules.evaluate(
        Object.freeze({
          phase: "normalization",
          normalized: createReadonlyByteView(normalized.value.bytes),
          recordId: validated.value.recordId,
        }),
        options.limits,
      ),
    );
  }
  if (collector.hasErrors()) return failure(collector.finish());

  const contentDigest = hashTrustedFrame(
    validated.value.algorithm,
    buildTrustedContentFrame(
      {
        algorithm: validated.value.algorithm,
        profileId: validated.value.profile.id,
        profileVersion: validated.value.profile.version,
        normalizedBytes: normalized.value.bytes,
      },
      options.limits,
    ),
  );
  if (!contentDigest.ok) return contentDigest;
  const recordDigest = hashTrustedFrame(
    validated.value.algorithm,
    buildTrustedRecordFrame(
      {
        algorithm: validated.value.algorithm,
        contextId: validated.value.contextId,
        recordId: validated.value.recordId,
        profileId: validated.value.profile.id,
        profileVersion: validated.value.profile.version,
        normalizedByteLength: normalized.value.stats.byteLength,
        contentDigest: contentDigest.value,
      },
      options.limits,
    ),
  );
  if (!recordDigest.ok) return recordDigest;
  const evidence = freezeRecordEvidence({
    $schema: RECORD_EVIDENCE_SCHEMA,
    protocolVersion: 1,
    contextId: validated.value.contextId,
    recordId: validated.value.recordId,
    profile: validated.value.profile,
    algorithm: validated.value.algorithm,
    normalizedByteLength: normalized.value.stats.byteLength,
    contentDigest: contentDigest.value.toHex(),
    recordDigest: recordDigest.value.toHex(),
  });
  if (hasRules) {
    addAll(
      collector,
      options.rules.evaluate(
        Object.freeze({
          phase: "record",
          record: evidence,
          recordId: evidence.recordId,
        }),
        options.limits,
      ),
    );
  }
  if (collector.hasErrors()) return failure(collector.finish());
  return success(Object.freeze({ evidence }), collector.finish());
}

export function verifyComputedRecord(
  expected: RecordEvidence,
  payload: unknown,
  options: RecordServiceOptions,
): OperationResult<RecordEvidence> {
  const computed = computeRecord(
    {
      contextId: expected.contextId,
      recordId: expected.recordId,
      payload,
      profile: expected.profile,
      algorithm: expected.algorithm,
    },
    options,
  );
  if (!computed.ok) return computed;
  const expectedContent = expected.contentDigest;
  const expectedRecord = expected.recordDigest;
  const actualContent = computed.value.evidence.contentDigest;
  const actualRecord = computed.value.evidence.recordDigest;
  const collector = new DiagnosticCollector(options.limits);
  addAll(collector, computed.diagnostics);
  if (!sameDigest(expectedContent, actualContent, expected.algorithm)) {
    collector.addCode("CONTENT_DIGEST_MISMATCH", "record", { recordId: expected.recordId });
  }
  if (!sameDigest(expectedRecord, actualRecord, expected.algorithm)) {
    collector.addCode("RECORD_DIGEST_MISMATCH", "record", { recordId: expected.recordId });
  }
  if (collector.hasErrors()) return failure(collector.finish());
  return success(computed.value.evidence, collector.finish());
}

export function validateRecordInput(
  value: unknown,
  limits: Limits,
): OperationResult<ValidatedRecordInput> {
  const exact = inspectExactProperties(value, [
    "contextId",
    "recordId",
    "payload",
    "profile",
    "algorithm",
  ]);
  if (exact === undefined) return inputFailure(limits);
  const [contextIdInput, recordIdInput, payload, profileInput, algorithmInput] = exact;
  const contextId = validateContextId(contextIdInput);
  const recordId = validateRecordId(recordIdInput);
  const profile = validateProfile(profileInput, limits);
  const algorithm = validateAlgorithmId(algorithmInput);
  if (!contextId.ok) return contextId;
  if (!recordId.ok) return recordId;
  if (!profile.ok) return profile;
  if (!algorithm.ok) return algorithm;
  return success(
    Object.freeze({
      contextId: contextId.value.value,
      recordId: recordId.value.value,
      payload,
      profile: profile.value,
      algorithm: algorithm.value,
    }),
  );
}

export function validateProfile(
  value: unknown,
  limits: Limits,
): OperationResult<Readonly<{ readonly id: string; readonly version: string }>> {
  void limits;
  const exact = inspectExactProperties(value, ["id", "version"]);
  if (exact === undefined) return inputFailure(limits);
  const [idInput, versionInput] = exact;
  const id = validateProfileId(idInput);
  const version = validateProfileVersion(versionInput);
  if (!id.ok) return id;
  if (!version.ok) return version;
  return success(Object.freeze({ id: id.value.value, version: version.value.value }));
}

export function freezeRecordEvidence(value: RecordEvidence): RecordEvidence {
  return Object.freeze(value);
}

function validateProfileReference(
  input: ValidatedRecordInput,
  options: RecordServiceOptions,
): OperationResult<
  ReturnType<ProfileRegistry["resolve"]> extends OperationResult<infer T> ? T : never
> {
  return options.profiles.resolveValidated(input.profile);
}

function inputPayloadIsBytes(value: unknown): value is Uint8Array {
  return value instanceof Uint8Array;
}

function freezeInputView(value: ValidatedRecordInput): Readonly<Record<string, unknown>> {
  return Object.freeze({
    contextId: value.contextId,
    recordId: value.recordId,
    profile: Object.freeze({ ...value.profile }),
    algorithm: value.algorithm,
  });
}

function sameDigest(expected: string, actual: string, algorithm: AlgorithmId): boolean {
  const left = hexToDigest(expected, algorithm);
  const right = hexToDigest(actual, algorithm);
  return left !== undefined && right !== undefined && equalDigest(left, right);
}

function hexToDigest(value: string, algorithm: AlgorithmId): Digest | undefined {
  const result = validateDigest(value, algorithm);
  return result.ok ? result.value : undefined;
}

function addAll(
  collector: DiagnosticCollector,
  diagnostics: readonly Diagnostic[] | undefined,
): void {
  if (diagnostics === undefined) return;
  for (const diagnostic of diagnostics) collector.add(diagnostic);
}

function inputFailure<T>(limits: Limits): OperationResult<T> {
  const collector = new DiagnosticCollector(limits);
  collector.addCode("INPUT_TYPE_INVALID", "input");
  return failure(collector.finish());
}
