// SPDX-License-Identifier: Apache-2.0

import type { OperationResult } from "../domain/operation-result.js";
import { failure, success } from "../domain/operation-result.js";
import type { ProfileId } from "../domain/identifiers.js";
import type { Limits } from "../domain/limits.js";
import type { ProfileVersion } from "../domain/version.js";
import { createDiagnostic } from "../validation/diagnostic-collector.js";
import type { ByteSink } from "./byte-sink.js";
import type { NormalizationProfile, NormalizationStats } from "./profile.js";
import { jcsProfile } from "./jcs-profile.js";
import { rawBytesProfile } from "./raw-bytes-profile.js";

interface RegisteredProfile {
  readonly id: ProfileId;
  readonly version: ProfileVersion;
  readonly inputKind: NormalizationProfile["inputKind"];
  validate(input: unknown, limits: Limits): OperationResult<unknown>;
  normalize(input: unknown, sink: ByteSink, limits: Limits): OperationResult<NormalizationStats>;
  normalizeValidated(
    input: unknown,
    sink: ByteSink,
    limits: Limits,
  ): OperationResult<NormalizationStats>;
}

export class ProfileRegistry {
  private readonly profiles = new Map<string, RegisteredProfile>();

  constructor(additional: readonly NormalizationProfile[] = []) {
    this.registerBuiltin(rawBytesProfile);
    this.registerBuiltin(jcsProfile);
    for (const profile of additional) {
      const result = this.register(profile);
      if (!result.ok) throw new Error("profile registration conflict");
    }
  }

  register<I>(profile: NormalizationProfile<I>): OperationResult<void> {
    const key = profileKey(profile.id, profile.version);
    if (this.profiles.has(key)) {
      return failure([createDiagnostic("PROFILE_VERSION_CONFLICT", "input")]);
    }
    this.profiles.set(key, eraseProfile(profile));
    return success(undefined);
  }

  resolve(id: ProfileId, version: ProfileVersion): OperationResult<RegisteredProfile> {
    const profile = this.profiles.get(profileKey(id, version));
    if (profile === undefined) return failure([createDiagnostic("PROFILE_UNKNOWN", "input")]);
    return success(profile);
  }

  resolveValidated(
    reference: Readonly<{ readonly id: string; readonly version: string }>,
  ): OperationResult<RegisteredProfile> {
    const profile = this.profiles.get(`${reference.id}\u0000${reference.version}`);
    if (profile === undefined) return failure([createDiagnostic("PROFILE_UNKNOWN", "input")]);
    return success(profile);
  }

  private registerBuiltin<I>(profile: NormalizationProfile<I>): void {
    this.profiles.set(profileKey(profile.id, profile.version), eraseProfile(profile));
  }
}

function eraseProfile<I>(profile: NormalizationProfile<I>): RegisteredProfile {
  return Object.freeze({
    id: profile.id,
    version: profile.version,
    inputKind: profile.inputKind,
    validate: (input: unknown, limits: Limits) => profile.validate(input, limits),
    normalize: (
      input: unknown,
      sink: ByteSink,
      limits: Limits,
    ): OperationResult<NormalizationStats> => {
      const validated = profile.validate(input, limits);
      if (!validated.ok) return validated;
      return profile.normalize(validated.value, sink, limits);
    },
    normalizeValidated: (
      input: unknown,
      sink: ByteSink,
      limits: Limits,
    ): OperationResult<NormalizationStats> => {
      // The record service invokes this only after the profile validator succeeds.
      // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- erased generic at the trusted registry boundary
      return profile.normalize(input as I, sink, limits);
    },
  });
}

function profileKey(id: ProfileId, version: ProfileVersion): string {
  return `${id.value}\u0000${version.value}`;
}
