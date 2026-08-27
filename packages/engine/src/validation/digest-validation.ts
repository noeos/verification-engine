// SPDX-License-Identifier: Apache-2.0

import type { AlgorithmId } from "../domain/algorithm-id.js";
import { Digest } from "../domain/digest.js";
import type { OperationResult } from "../domain/operation-result.js";
import { success } from "../domain/operation-result.js";
import { failureWithCode } from "./result-helpers.js";
import { validateAlgorithmId } from "./algorithm-validation.js";

const digestLengths: Readonly<Record<AlgorithmId, number>> = Object.freeze({
  "sha-256": 32,
  "sha-384": 48,
  "sha-512": 64,
});

export function digestLength(algorithm: AlgorithmId): number {
  return digestLengths[algorithm];
}

export function validateDigest(value: unknown, algorithm: unknown): OperationResult<Digest> {
  const algorithmResult = validateAlgorithmId(algorithm);
  if (!algorithmResult.ok) return algorithmResult;
  if (typeof value !== "string" || !/^(?:[0-9a-f]{2})+$/u.test(value)) {
    return failureWithCode("DIGEST_ENCODING_INVALID", "input");
  }
  const expectedLength = digestLength(algorithmResult.value) * 2;
  if (value.length !== expectedLength) {
    return failureWithCode("DIGEST_LENGTH_INVALID", "input");
  }
  const bytes = new Uint8Array(expectedLength / 2);
  for (let index = 0; index < bytes.length; index += 1) {
    bytes[index] = Number.parseInt(value.slice(index * 2, index * 2 + 2), 16);
  }
  return success(Digest.fromValidated(algorithmResult.value, bytes));
}

export function equalDigest(left: Digest, right: Digest): boolean {
  if (left.algorithm !== right.algorithm) return false;
  const leftBytes = left.toBytes();
  const rightBytes = right.toBytes();
  const leftView = new DataView(leftBytes.buffer, leftBytes.byteOffset, leftBytes.byteLength);
  const rightView = new DataView(rightBytes.buffer, rightBytes.byteOffset, rightBytes.byteLength);
  let difference = 0;
  for (let index = 0; index < leftBytes.length; index += 1) {
    difference |= leftView.getUint8(index) ^ rightView.getUint8(index);
  }
  return difference === 0;
}
