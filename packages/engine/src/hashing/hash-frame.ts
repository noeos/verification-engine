// SPDX-License-Identifier: Apache-2.0

import type { Limits } from "../domain/limits.js";
import type { OperationResult } from "../domain/operation-result.js";
import type { Digest } from "../domain/digest.js";
import { hashBytes, hashValidatedBytes } from "./hash-adapter.js";

export function hashFrame(
  algorithm: unknown,
  frame: OperationResult<Uint8Array>,
  limits: Limits,
): OperationResult<Digest> {
  if (!frame.ok) return frame;
  return hashBytes(algorithm, frame.value, limits);
}

export function hashTrustedFrame(
  algorithm: Parameters<typeof hashValidatedBytes>[0],
  frame: OperationResult<Uint8Array>,
): OperationResult<Digest> {
  if (!frame.ok) return frame;
  return hashValidatedBytes(algorithm, frame.value);
}
