// SPDX-License-Identifier: Apache-2.0

import type { ContextId, ProfileId, RecordId, SequenceId } from "../domain/identifiers.js";
import {
  ContextId as ContextIdValue,
  ProfileId as ProfileIdValue,
  RecordId as RecordIdValue,
  SequenceId as SequenceIdValue,
} from "../domain/identifiers.js";
import type { OperationResult } from "../domain/operation-result.js";
import { success } from "../domain/operation-result.js";
import { failureWithCode } from "./result-helpers.js";

const identifierPattern = /^[A-Za-z0-9][A-Za-z0-9._:/-]{0,127}$/u;
const profilePattern = /^[A-Za-z0-9][A-Za-z0-9._:/-]{0,127}$/u;

export function validateRecordId(value: unknown): OperationResult<RecordId> {
  return validateIdentifier(value, (input) => RecordIdValue.fromValidated(input));
}

export function validateSequenceId(value: unknown): OperationResult<SequenceId> {
  return validateIdentifier(value, (input) => SequenceIdValue.fromValidated(input));
}

export function validateContextId(value: unknown): OperationResult<ContextId> {
  return validateIdentifier(value, (input) => ContextIdValue.fromValidated(input));
}

export function validateProfileId(value: unknown): OperationResult<ProfileId> {
  if (typeof value !== "string" || !profilePattern.test(value) || value.length > 128) {
    return failureWithCode("IDENTIFIER_INVALID", "input");
  }
  return success(ProfileIdValue.fromValidated(value));
}

function validateIdentifier<T>(value: unknown, create: (input: string) => T): OperationResult<T> {
  if (typeof value !== "string" || !identifierPattern.test(value) || value.length > 128) {
    return failureWithCode("IDENTIFIER_INVALID", "input");
  }
  return success(create(value));
}
