// SPDX-License-Identifier: Apache-2.0

import { Position } from "../domain/position.js";
import type { OperationResult } from "../domain/operation-result.js";
import { success } from "../domain/operation-result.js";
import { failureWithCode } from "./result-helpers.js";

export function validatePosition(value: unknown): OperationResult<Position> {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0) {
    return failureWithCode("INPUT_TYPE_INVALID", "input");
  }
  return success(Position.fromValidated(value));
}
