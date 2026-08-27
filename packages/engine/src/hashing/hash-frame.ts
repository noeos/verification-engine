// SPDX-License-Identifier: Apache-2.0

import type { Limits } from "../domain/limits.js";
import type { OperationResult } from "../domain/operation-result.js";
import type { Digest } from "../domain/digest.js";
import { hashBytes } from "./hash-adapter.js";

export function hashFrame(
  algorithm: unknown,
  frame: OperationResult<Uint8Array>,
  limits: Limits,
): OperationResult<Digest> {
  if (!frame.ok) return frame;
  return hashBytes(algorithm, frame.value, limits);
}
