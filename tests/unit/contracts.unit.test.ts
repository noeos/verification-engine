// SPDX-License-Identifier: Apache-2.0

import assert from "node:assert/strict";
import { test } from "node:test";

import { DIAGNOSTIC_CODES } from "../../packages/engine/dist/esm/index.js";
import { SCHEMA_ASSETS } from "../../packages/engine/dist/esm/schemas.js";
import { VECTOR_SET } from "../../packages/engine/dist/esm/vectors.js";

void test("generated public contract metadata is complete, frozen by type, and deterministic", () => {
  assert.equal(DIAGNOSTIC_CODES.length, 64);
  assert.equal(new Set(DIAGNOSTIC_CODES.map((entry) => entry.code)).size, DIAGNOSTIC_CODES.length);
  assert.ok(DIAGNOSTIC_CODES.every((entry) => /^[A-Z][A-Z0-9_]+$/u.test(entry.code)));
  assert.ok(DIAGNOSTIC_CODES.every((entry) => entry.since === "1.0.0"));
  assert.deepEqual(
    SCHEMA_ASSETS.map((entry) => entry.id),
    [
      "urn:noeos:verification-engine:chain-summary:1",
      "urn:noeos:verification-engine:diagnostic:1",
      "urn:noeos:verification-engine:link-evidence:1",
      "urn:noeos:verification-engine:record-evidence:1",
      "urn:noeos:verification-engine:vector-set:1",
    ],
  );
  assert.equal(VECTOR_SET.protocolVersion, 1);
  assert.equal(VECTOR_SET.files.length, 4);
});
