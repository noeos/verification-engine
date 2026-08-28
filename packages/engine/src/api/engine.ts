// SPDX-License-Identifier: Apache-2.0

import { ProfileId } from "../domain/identifiers.js";
import { ProfileVersion } from "../domain/version.js";
import { DEFAULT_LIMITS } from "../domain/limits.js";
import type { Limits } from "../domain/limits.js";
import type { OperationResult } from "../domain/operation-result.js";
import type {
  RecordEvidence,
  Evidence,
  ChainSummaryEvidence,
  VerificationResult,
} from "../domain/evidence.js";
import { ProfileRegistry } from "../normalization/profile-registry.js";
import type { NormalizationProfile as InternalProfile } from "../normalization/profile.js";
import type { ByteSink as InternalByteSink } from "../normalization/byte-sink.js";
import type { NormalizationStats } from "../normalization/profile.js";
import type { StreamOptions } from "../domain/stream.js";
import type { Diagnostic } from "../domain/diagnostic.js";
import { RuleSet } from "../rules/rule-set.js";
import { validateLimits } from "../validation/limit-validation.js";
import { validateProfileId } from "../validation/identifier-validation.js";
import { validateProfileVersion } from "../validation/version-validation.js";
import {
  hashRecord,
  verifyComputedRecord,
  type RecordServiceOptions,
} from "../records/record-service.js";
import { ChainBuilder as InternalChainBuilder } from "../chains/chain-builder.js";
import { verifyChain, verifyChainStream } from "../chains/verify-chain.js";
import { digestEvidence } from "../evidence/digest-evidence.js";
import { parseRecordEvidence } from "../evidence/evidence-parser.js";
import type {
  ChainBuilder,
  ChainConfig,
  Engine,
  EngineEvent,
  EngineOptions,
  NormalizationProfile,
  VerifyChainInput,
  VerifyRecordInput,
  VerifyStreamInput,
} from "./types.js";

/** @public */
export function createEngine(options: EngineOptions = {}): Engine {
  const limits = resolveLimits(options.limits);
  const additionalProfiles = (options.profiles ?? []).map((profile) => adaptProfile(profile));
  let profiles: ProfileRegistry;
  try {
    profiles = new ProfileRegistry(additionalProfiles);
  } catch {
    throw new EngineConfigurationError("PROFILE_VERSION_CONFLICT");
  }
  const rulesResult = RuleSet.create(options.rules, limits);
  if (!rulesResult.ok) throw new EngineConfigurationError("RULE_VERSION_CONFLICT");
  const defaultPolicy = options.duplicatePolicy;
  const observer = options.onEvent;
  if (observer !== undefined && typeof observer !== "function") {
    throw new EngineConfigurationError("INPUT_TYPE_INVALID");
  }
  return Object.freeze(
    new EngineImpl(limits, profiles, rulesResult.value, defaultPolicy, observer),
  );
}

/** @public */
export class EngineConfigurationError extends TypeError {
  constructor(
    readonly code:
      | "INPUT_TYPE_INVALID"
      | "INPUT_LIMIT_EXCEEDED"
      | "RULE_VERSION_CONFLICT"
      | "PROFILE_VERSION_CONFLICT",
  ) {
    super(code);
    this.name = "EngineConfigurationError";
  }
}

class EngineImpl implements Engine {
  constructor(
    private readonly limits: Limits,
    private readonly profiles: ProfileRegistry,
    private readonly rules: RuleSet,
    private readonly defaultPolicy: EngineOptions["duplicatePolicy"],
    private readonly observer: EngineOptions["onEvent"],
  ) {}

  hashRecord(input: Parameters<typeof hashRecord>[0]): ReturnType<typeof hashRecord> {
    this.emit({
      name: "operation.started",
      operation: "hash-record",
      recordsSeen: 0,
      bytesNormalized: 0,
    });
    const result = hashRecord(input, this.recordOptions());
    this.emitResult(result, "hash-record");
    return result;
  }

  verifyRecord(input: VerifyRecordInput): VerificationResult<RecordEvidence> {
    const evidence = parseRecordEvidenceInput(input.evidence, this.limits);
    if (!evidence.ok) return invalidRecordResult(evidence.diagnostics);
    const result = verifyComputedRecord(evidence.value, input.payload, this.recordOptions());
    const diagnostics = result.diagnostics;
    const status = result.ok ? "valid" : "invalid";
    return Object.freeze({
      status,
      diagnostics,
      evidence: result.ok ? result.value : undefined,
      stats: Object.freeze({
        recordsSeen: 1,
        recordsVerified: result.ok ? 1 : 0,
        linksVerified: 0,
        bytesNormalized: result.ok ? result.value.normalizedByteLength : 0,
        errors: diagnostics.filter(({ severity }) => severity === "error").length,
        warnings: diagnostics.filter(({ severity }) => severity === "warning").length,
        info: diagnostics.filter(({ severity }) => severity === "info").length,
      }),
      boundaries: Object.freeze({
        start: "not-applicable" as const,
        end: "not-applicable" as const,
      }),
      verificationMode: "internal" as const,
    });
  }

  createChain(config: ChainConfig): ChainBuilder {
    const internal = InternalChainBuilder.create(
      {
        ...config,
        ...(config.duplicatePolicy === undefined && this.defaultPolicy !== undefined
          ? { duplicatePolicy: this.defaultPolicy }
          : {}),
        rules: this.rulesAsUnknown(),
      },
      { limits: this.limits, profiles: this.profiles },
    );
    if (!internal.ok) throw new EngineConfigurationError(firstCode(internal.diagnostics));
    return new PublicChainBuilder(internal.value);
  }

  verifyChain(input: VerifyChainInput): VerificationResult<ChainSummaryEvidence> {
    return verifyChain(
      {
        ...input,
        ...(input.duplicatePolicy === undefined && this.defaultPolicy !== undefined
          ? { duplicatePolicy: this.defaultPolicy }
          : {}),
        rules: this.rulesAsUnknown(),
      },
      { limits: this.limits, profiles: this.profiles },
    );
  }

  async verifyStream(input: VerifyStreamInput): Promise<VerificationResult<ChainSummaryEvidence>> {
    const { signal, ...streamConfig } = input;
    return verifyChainStream(
      {
        ...streamConfig,
        ...(streamConfig.duplicatePolicy === undefined && this.defaultPolicy !== undefined
          ? { duplicatePolicy: this.defaultPolicy }
          : {}),
        rules: this.rulesAsUnknown(),
      },
      { limits: this.limits, profiles: this.profiles },
      signal,
    );
  }

  digestEvidence(input: Evidence): ReturnType<typeof digestEvidence> {
    return digestEvidence(input, this.limits);
  }

  private recordOptions(): RecordServiceOptions {
    return Object.freeze({ limits: this.limits, profiles: this.profiles, rules: this.rules });
  }

  private rulesAsUnknown(): readonly unknown[] {
    return this.rules.toArray();
  }

  private emit(event: EngineEvent): void {
    if (this.observer === undefined) return;
    try {
      this.observer(Object.freeze({ ...event }));
    } catch {
      // Observer failures are intentionally isolated from deterministic operation results.
    }
  }

  private emitResult<T>(result: OperationResult<T>, operation: string): void {
    if (result.ok)
      this.emit({ name: "operation.completed", operation, recordsSeen: 1, bytesNormalized: 0 });
    for (const diagnostic of result.diagnostics) {
      this.emit({
        name: "diagnostic.emitted",
        operation,
        recordsSeen: 0,
        bytesNormalized: 0,
        code: diagnostic.code,
      });
    }
  }
}

class PublicChainBuilder implements ChainBuilder {
  constructor(private readonly inner: InternalChainBuilder) {}
  append(
    input: Parameters<InternalChainBuilder["append"]>[0],
  ): ReturnType<InternalChainBuilder["append"]> {
    return this.inner.append(input);
  }
  appendAll(
    input: Iterable<Parameters<InternalChainBuilder["append"]>[0]>,
  ): ReturnType<InternalChainBuilder["appendAll"]> {
    return this.inner.appendAll(input);
  }
  appendStream(
    input: AsyncIterable<Parameters<InternalChainBuilder["append"]>[0]>,
    options?: StreamOptions,
  ): ReturnType<InternalChainBuilder["appendStream"]> {
    return this.inner.appendStream(input, options);
  }
  snapshot(): ReturnType<InternalChainBuilder["snapshot"]> {
    return this.inner.snapshot();
  }
  finalize(): ReturnType<InternalChainBuilder["finalize"]> {
    return this.inner.finalize();
  }
  abort(reason?: string): void {
    this.inner.abort(reason);
  }
}

function adaptProfile(profile: NormalizationProfile): InternalProfile {
  if (
    !isRecord(profile) ||
    typeof profile.validate !== "function" ||
    typeof profile.normalize !== "function"
  ) {
    throw new EngineConfigurationError("INPUT_TYPE_INVALID");
  }
  const id = validateProfileId(profile.id);
  const version = validateProfileVersion(profile.version);
  if (!id.ok) throw new EngineConfigurationError(firstCode(id.diagnostics));
  if (!version.ok) throw new EngineConfigurationError(firstCode(version.diagnostics));
  validateManifest(profile, id.value.value, version.value.value);
  const adapted: InternalProfile = {
    id: ProfileId.fromValidated(id.value.value),
    version: ProfileVersion.fromValidated(version.value.value),
    inputKind: profile.inputKind,
    validate(input: unknown, limits: Limits): OperationResult<unknown> {
      return profile.validate(input, limits);
    },
    normalize(
      input: unknown,
      sink: InternalByteSink,
      limits: Limits,
    ): OperationResult<NormalizationStats> {
      return profile.normalize(input, sink, limits);
    },
  };
  return Object.freeze(adapted);
}

function validateManifest(profile: NormalizationProfile, id: string, version: string): void {
  if (!isRecord(profile.manifest)) throw new EngineConfigurationError("INPUT_TYPE_INVALID");
  const manifest = profile.manifest;
  if (
    Object.keys(manifest).length !== 5 ||
    manifest.name !== id ||
    manifest.version !== version ||
    typeof manifest.vectorSha256 !== "string" ||
    !/^[0-9a-f]{64}$/u.test(manifest.vectorSha256) ||
    typeof manifest.license !== "string" ||
    manifest.license.length === 0
  ) {
    throw new EngineConfigurationError("INPUT_TYPE_INVALID");
  }
  const limits = validateLimits(manifest.limits);
  if (!limits.ok) throw new EngineConfigurationError(firstCode(limits.diagnostics));
}

function resolveLimits(value: Partial<Limits> | undefined): Limits {
  const candidate = value === undefined ? DEFAULT_LIMITS : { ...DEFAULT_LIMITS, ...value };
  const result = validateLimits(candidate);
  if (!result.ok) throw new EngineConfigurationError(firstCode(result.diagnostics));
  return result.value;
}

function parseRecordEvidenceInput(value: unknown, limits: Limits): OperationResult<RecordEvidence> {
  return parseRecordEvidence(value, limits);
}

function invalidRecordResult(
  diagnostics: readonly Diagnostic[],
): VerificationResult<RecordEvidence> {
  return Object.freeze({
    status: "invalid" as const,
    diagnostics,
    evidence: undefined,
    stats: Object.freeze({
      recordsSeen: 0,
      recordsVerified: 0,
      linksVerified: 0,
      bytesNormalized: 0,
      errors: diagnostics.length,
      warnings: 0,
      info: 0,
    }),
    boundaries: Object.freeze({ start: "not-applicable" as const, end: "not-applicable" as const }),
    verificationMode: "internal" as const,
  });
}

function firstCode(
  diagnostics: readonly { readonly code: string }[],
):
  | "INPUT_TYPE_INVALID"
  | "INPUT_LIMIT_EXCEEDED"
  | "RULE_VERSION_CONFLICT"
  | "PROFILE_VERSION_CONFLICT" {
  const code = diagnostics[0]?.code;
  if (code === "INPUT_LIMIT_EXCEEDED" || code === "RULE_VERSION_CONFLICT") return code;
  return "INPUT_TYPE_INVALID";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
