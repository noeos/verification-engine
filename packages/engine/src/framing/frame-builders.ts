// SPDX-License-Identifier: Apache-2.0

import type { Digest } from "../domain/digest.js";
import type { Limits } from "../domain/limits.js";
import type { OperationResult } from "../domain/operation-result.js";
import { encodeFrame } from "./frame-encoder.js";
import type { FrameInput } from "./frame-types.js";

export interface ContentFrameInput {
  readonly algorithm: string;
  readonly profileId: string;
  readonly profileVersion: string;
  readonly normalizedBytes: Uint8Array;
}

export interface RecordFrameInput {
  readonly algorithm: string;
  readonly contextId: string;
  readonly recordId: string;
  readonly profileId: string;
  readonly profileVersion: string;
  readonly normalizedByteLength: number;
  readonly contentDigest: Digest;
}

export interface LinkFrameInput {
  readonly algorithm: string;
  readonly contextId: string;
  readonly sequenceId: string;
  readonly position: number;
  readonly recordId: string;
  readonly recordDigest: Digest;
  readonly previousLinkDigest?: Digest;
}

export interface EvidenceFrameInput {
  readonly algorithm: string;
  readonly schemaUrn: string;
  readonly evidenceJcsBytes: Uint8Array;
}

export function buildContentFrame(
  input: ContentFrameInput,
  limits: Limits,
): OperationResult<Uint8Array> {
  const frame: FrameInput = {
    kind: "content",
    fields: [
      { tag: 1, type: "utf8", value: input.algorithm },
      { tag: 2, type: "utf8", value: input.profileId },
      { tag: 3, type: "utf8", value: input.profileVersion },
      { tag: 4, type: "bytes", value: input.normalizedBytes },
    ],
  };
  return encodeFrame(frame, limits);
}

export function buildRecordFrame(
  input: RecordFrameInput,
  limits: Limits,
): OperationResult<Uint8Array> {
  const frame: FrameInput = {
    kind: "record",
    fields: [
      { tag: 1, type: "utf8", value: input.algorithm },
      { tag: 2, type: "utf8", value: input.contextId },
      { tag: 3, type: "utf8", value: input.recordId },
      { tag: 4, type: "utf8", value: input.profileId },
      { tag: 5, type: "utf8", value: input.profileVersion },
      { tag: 6, type: "uint64", value: input.normalizedByteLength },
      { tag: 7, type: "bytes", value: input.contentDigest.toBytes() },
    ],
  };
  return encodeFrame(frame, limits);
}

export function buildLinkFrame(input: LinkFrameInput, limits: Limits): OperationResult<Uint8Array> {
  const previous = input.previousLinkDigest;
  const frame: FrameInput = {
    kind: "link",
    fields: [
      { tag: 1, type: "utf8", value: input.algorithm },
      { tag: 2, type: "utf8", value: input.contextId },
      { tag: 3, type: "utf8", value: input.sequenceId },
      { tag: 4, type: "uint64", value: input.position },
      { tag: 5, type: "utf8", value: input.recordId },
      { tag: 6, type: "bytes", value: input.recordDigest.toBytes() },
      previous === undefined
        ? { tag: 7, type: "none" }
        : { tag: 7, type: "bytes", value: previous.toBytes() },
    ],
  };
  return encodeFrame(frame, limits);
}

export function buildEvidenceFrame(
  input: EvidenceFrameInput,
  limits: Limits,
): OperationResult<Uint8Array> {
  const frame: FrameInput = {
    kind: "evidence",
    fields: [
      { tag: 1, type: "utf8", value: input.algorithm },
      { tag: 2, type: "utf8", value: input.schemaUrn },
      { tag: 3, type: "bytes", value: input.evidenceJcsBytes },
    ],
  };
  return encodeFrame(frame, limits);
}
