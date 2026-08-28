// SPDX-License-Identifier: Apache-2.0

import assert from "node:assert/strict";
import { test } from "node:test";

import fc from "fast-check";

import { digest, stableJson } from "../../scripts/project.mjs";

void test("stable serialization and digests are deterministic for JSON values", () => {
  fc.assert(
    fc.property(fc.jsonValue(), (value) => {
      const first = stableJson(value);
      const second = stableJson(value);
      assert.equal(first, second);
      assert.equal(digest(first), digest(second));
      assert.doesNotThrow(() => JSON.parse(first));
      assert.deepEqual(JSON.parse(first), JSON.parse(second));
    }),
    { numRuns: 500 },
  );
});

void test("digest separates distinct short strings", () => {
  fc.assert(
    fc.property(fc.string({ maxLength: 128 }), fc.string({ maxLength: 128 }), (left, right) => {
      fc.pre(left !== right);
      assert.notEqual(digest(left), digest(right));
    }),
    { numRuns: 500 },
  );
});
