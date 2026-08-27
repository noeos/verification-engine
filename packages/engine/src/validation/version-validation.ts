// SPDX-License-Identifier: Apache-2.0

import type { ProfileId } from "../domain/identifiers.js";
import { validateProfileId } from "./identifier-validation.js";
import type { ProfileVersion } from "../domain/version.js";
import { ProfileVersion as ProfileVersionValue } from "../domain/version.js";
import type { OperationResult } from "../domain/operation-result.js";
import { success } from "../domain/operation-result.js";
import { failureWithCode } from "./result-helpers.js";

const semverPattern =
  /^(?:0|[1-9][0-9]*)\.(?:0|[1-9][0-9]*)\.(?:0|[1-9][0-9]*)(?:-(?:0|[1-9A-Za-z-][0-9A-Za-z-]*)(?:\.(?:0|[1-9A-Za-z-][0-9A-Za-z-]*))*)?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/u;

export function validateProfileVersion(value: unknown): OperationResult<ProfileVersion> {
  if (typeof value !== "string" || value.length > 256 || !semverPattern.test(value)) {
    return failureWithCode("VERSION_INVALID", "input");
  }
  return success(ProfileVersionValue.fromValidated(value));
}

export function validateProtocolVersion(value: unknown): OperationResult<1> {
  if (value !== 1) return failureWithCode("VERSION_INVALID", "input");
  return success(1);
}

export function validateProfileReference(
  id: unknown,
  version: unknown,
): OperationResult<{ readonly id: ProfileId; readonly version: ProfileVersion }> {
  const idResult = validateProfileId(id);
  if (!idResult.ok) return idResult;
  const versionResult = validateProfileVersion(version);
  if (!versionResult.ok) return versionResult;
  return success(Object.freeze({ id: idResult.value, version: versionResult.value }));
}
