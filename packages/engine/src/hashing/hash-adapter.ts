// SPDX-License-Identifier: Apache-2.0

import { createHash } from "node:crypto";
import { strict as assert } from "node:assert";
import { types } from "node:util";
import type { AlgorithmId } from "../domain/algorithm-id.js";
import type { Digest } from "../domain/digest.js";
import type { Limits } from "../domain/limits.js";
import type { OperationResult } from "../domain/operation-result.js";
import { failure, success } from "../domain/operation-result.js";
import { DiagnosticCollector } from "../validation/diagnostic-collector.js";
import { digestLength } from "../validation/digest-validation.js";
import { validateAlgorithmId } from "../validation/algorithm-validation.js";
import { Digest as DigestValue } from "../domain/digest.js";

const NODE_ALGORITHMS: Readonly<Record<AlgorithmId, string>> = Object.freeze({
  "sha-256": "sha256",
  "sha-384": "sha384",
  "sha-512": "sha512",
});

export interface HashSink {
  update(value: Uint8Array): void;
  digest(): Digest;
}

export function createHashSink(algorithm: unknown, limits: Limits): OperationResult<HashSink> {
  void limits;
  const validated = validateAlgorithmId(algorithm);
  if (!validated.ok) return validated;
  return success(new NodeHashSink(validated.value));
}

export function hashBytes(
  algorithm: unknown,
  input: unknown,
  limits: Limits,
): OperationResult<Digest> {
  const sinkResult = createHashSink(algorithm, limits);
  if (!sinkResult.ok) return sinkResult;
  if (types.isProxy(input) || !(input instanceof Uint8Array))
    return hashFailure("INPUT_TYPE_INVALID", limits);
  if (input.length > limits.maxPayloadBytes) return hashFailure("INPUT_LIMIT_EXCEEDED", limits);
  sinkResult.value.update(input);
  return success(sinkResult.value.digest());
}

export function hashChunks(
  algorithm: unknown,
  chunks: Iterable<Uint8Array>,
  limits: Limits,
): OperationResult<Digest> {
  const sinkResult = createHashSink(algorithm, limits);
  if (!sinkResult.ok) return sinkResult;
  let total = 0;
  try {
    for (const chunk of chunks) {
      if (types.isProxy(chunk) || !(chunk instanceof Uint8Array))
        return hashFailure("INPUT_TYPE_INVALID", limits);
      if (chunk.length > limits.maxPayloadBytes - total)
        return hashFailure("INPUT_LIMIT_EXCEEDED", limits);
      total += chunk.length;
      sinkResult.value.update(chunk);
    }
    return success(sinkResult.value.digest());
  } catch {
    return hashFailure("NORMALIZATION_FAILED", limits);
  }
}

class NodeHashSink implements HashSink {
  private readonly hash: ReturnType<typeof createHash>;

  private finalized = false;

  constructor(private readonly algorithm: AlgorithmId) {
    this.hash = createHash(NODE_ALGORITHMS[algorithm]);
  }

  update(value: Uint8Array): void {
    if (this.finalized) throw new Error("hash already finalized");
    this.hash.update(value);
  }

  digest(): Digest {
    if (this.finalized) throw new Error("hash already finalized");
    this.finalized = true;
    const bytes = Uint8Array.from(this.hash.digest());
    assert.equal(bytes.length, digestLength(this.algorithm), "unexpected digest length");
    return DigestValue.fromValidated(this.algorithm, bytes);
  }
}

function hashFailure<T = Digest>(
  code:
    "ALGORITHM_UNKNOWN" | "INPUT_TYPE_INVALID" | "INPUT_LIMIT_EXCEEDED" | "NORMALIZATION_FAILED",
  limits: Limits,
): OperationResult<T> {
  const collector = new DiagnosticCollector(limits);
  collector.addCode(code, "input");
  return failure(collector.finish());
}
