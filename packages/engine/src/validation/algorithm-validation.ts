// SPDX-License-Identifier: Apache-2.0

import type { AlgorithmId } from "../domain/algorithm-id.js";
import type { OperationResult } from "../domain/operation-result.js";
import { success } from "../domain/operation-result.js";
import { failureWithCode } from "./result-helpers.js";

export function validateAlgorithmId(value: unknown): OperationResult<AlgorithmId> {
  if (value === "sha-256" || value === "sha-384" || value === "sha-512") {
    return success(value);
  }
  return failureWithCode("ALGORITHM_UNKNOWN", "input");
}
