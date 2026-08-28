// SPDX-License-Identifier: Apache-2.0

import type { LinkEvidence } from "./evidence.js";

export interface StreamOptions {
  readonly signal?: AbortSignal;
  readonly onEvidence?: (evidence: LinkEvidence) => void | Promise<void>;
}
