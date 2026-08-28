// SPDX-License-Identifier: Apache-2.0

import assert from "node:assert/strict";
import { test } from "node:test";

import { hasMatchingDcoSignoff } from "../../scripts/dco-policy.mjs";

void test("DCO sign-off must match the recorded commit author", () => {
  const message = "feat: example\n\nSigned-off-by: Daniel David <daniel@noeos.es>\n";
  assert.equal(hasMatchingDcoSignoff(message, "Daniel David", "daniel@noeos.es"), true);
  assert.equal(hasMatchingDcoSignoff(message, "Another Author", "daniel@noeos.es"), false);
  assert.equal(hasMatchingDcoSignoff(message, "Daniel David", "other@noeos.es"), false);
});
