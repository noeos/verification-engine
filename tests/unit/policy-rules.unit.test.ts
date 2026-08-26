// SPDX-License-Identifier: Apache-2.0

import assert from "node:assert/strict";
import { test } from "node:test";

import {
  containsPossibleSecret,
  containsUnresolvedMarker,
  isAllowedPackedPath,
  isExactVersion,
  isPinnedAction,
  parseAllowedSshSigner,
} from "../../scripts/policy-rules.mjs";

void test("dependency versions must be immutable", () => {
  assert.equal(isExactVersion("5.9.3"), true);
  assert.equal(isExactVersion("1.0.0-rc.1"), true);
  assert.equal(isExactVersion("^5.9.3"), false);
  assert.equal(isExactVersion("latest"), false);
});

void test("external Actions require a complete commit digest", () => {
  assert.equal(isPinnedAction("actions/checkout@d23441a48e516b6c34aea4fa41551a30e30af803"), true);
  assert.equal(isPinnedAction("./.github/actions/local"), true);
  assert.equal(isPinnedAction("actions/checkout@v6"), false);
  assert.equal(isPinnedAction("actions/checkout@d23441a"), false);
});

void test("secret and unresolved-work detectors reject hostile fixtures", () => {
  assert.equal(containsPossibleSecret(`npm_${"a".repeat(36)}`), true);
  assert.equal(containsPossibleSecret(`github_pat_${"a".repeat(40)}`), true);
  assert.equal(containsPossibleSecret(`AKIA${"A".repeat(16)}`), true);
  assert.equal(containsPossibleSecret(`sk_live_${"a".repeat(24)}`), true);
  assert.equal(containsPossibleSecret("ordinary synthetic input"), false);
  assert.equal(containsUnresolvedMarker(["TO", "DO"].join("")), true);
  assert.equal(containsUnresolvedMarker("fully specified implementation"), false);
});

void test("package allowlist rejects source, configuration, and hidden markers", () => {
  assert.equal(isAllowedPackedPath("dist/esm/index.js"), true);
  assert.equal(isAllowedPackedPath("schemas/record.schema.json"), true);
  assert.equal(isAllowedPackedPath("src/index.ts"), false);
  assert.equal(isAllowedPackedPath(".env"), false);
  assert.equal(isAllowedPackedPath("schemas/.gitkeep"), false);
});

void test("release signer policy accepts one Git-restricted Ed25519 identity", () => {
  const key = "A".repeat(43) + "=";
  assert.deepEqual(
    parseAllowedSshSigner(
      `ddcandales@gmail.com namespaces="git" ssh-ed25519 ${key} reviewed-key\n`,
    ),
    {
      key: `ssh-ed25519 ${key}`,
      namespace: "git",
      principal: "ddcandales@gmail.com",
    },
  );
  assert.equal(parseAllowedSshSigner("one\ntwo\n"), undefined);
  assert.equal(parseAllowedSshSigner(`owner@example.com ssh-ed25519 ${key}\n`), undefined);
});
