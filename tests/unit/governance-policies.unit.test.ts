// SPDX-License-Identifier: Apache-2.0

import assert from "node:assert/strict";
import { test } from "node:test";

import {
  isCriticalPath,
  minimumCriticalWaitMilliseconds,
  remainingCriticalWait,
} from "../../scripts/critical-change-policy.mjs";
import { hasMatchingDcoSignoff } from "../../scripts/dco-policy.mjs";

void test("critical-path waiting is measured from immutable GitHub observation time", () => {
  const firstSeen = "2026-08-25T00:00:00Z";
  const firstSeenMilliseconds = Date.parse(firstSeen);

  assert.equal(
    remainingCriticalWait(firstSeen, firstSeenMilliseconds),
    minimumCriticalWaitMilliseconds,
  );
  assert.equal(
    remainingCriticalWait(firstSeen, firstSeenMilliseconds + minimumCriticalWaitMilliseconds - 1),
    1,
  );
  assert.equal(
    remainingCriticalWait(firstSeen, firstSeenMilliseconds + minimumCriticalWaitMilliseconds),
    0,
  );
  assert.throws(() => remainingCriticalWait("not-a-date"), /Invalid GitHub workflow/u);
});

void test("critical paths cover supply-chain, protocol, security, and legal changes", () => {
  for (const path of [
    ".github/workflows/ci.yml",
    "package-lock.json",
    "packages/engine/src/hashing/sha256.ts",
    "scripts/build.mjs",
    "security/dependency-inventory.json",
    "docs/09-legalidad/02-licencias-pi.md",
  ]) {
    assert.equal(isCriticalPath(path), true, path);
  }
  assert.equal(isCriticalPath("packages/engine/README.md"), false);
});

void test("DCO sign-off must match the recorded commit author", () => {
  const message = "feat: example\n\nSigned-off-by: Daniel David <daniel@noeos.es>\n";
  assert.equal(hasMatchingDcoSignoff(message, "Daniel David", "daniel@noeos.es"), true);
  assert.equal(hasMatchingDcoSignoff(message, "Another Author", "daniel@noeos.es"), false);
  assert.equal(hasMatchingDcoSignoff(message, "Daniel David", "other@noeos.es"), false);
});
