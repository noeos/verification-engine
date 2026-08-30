// SPDX-License-Identifier: Apache-2.0

import type { Digest } from "../domain/digest.js";
import type { Limits } from "../domain/limits.js";
import type { OperationResult } from "../domain/operation-result.js";
import { buildTrustedEvidenceFrame } from "../framing/frame-builders.js";
import { hashTrustedFrame } from "../hashing/hash-frame.js";
import { jcsProfile } from "../normalization/jcs-profile.js";
import { normalizeToBytes } from "../normalization/normalize.js";
import { parseEvidence } from "./evidence-parser.js";

export function digestEvidence(value: unknown, limits: Limits): OperationResult<Digest> {
  const evidence = parseEvidence(value, limits);
  if (!evidence.ok) return evidence;
  const normalized = normalizeToBytes(jcsProfile, evidence.value, limits);
  if (!normalized.ok) return normalized;
  return hashTrustedFrame(
    evidence.value.algorithm,
    buildTrustedEvidenceFrame(
      {
        algorithm: evidence.value.algorithm,
        schemaUrn: evidence.value.$schema,
        evidenceJcsBytes: normalized.value.bytes,
      },
      limits,
    ),
  );
}
