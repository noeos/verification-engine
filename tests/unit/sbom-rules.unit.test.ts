// SPDX-License-Identifier: Apache-2.0

import assert from "node:assert/strict";
import { test } from "node:test";

import {
  componentName,
  declaredLicenseExpressions,
  hashesFromSri,
  spdxHashAlgorithm,
} from "../../scripts/sbom-rules.mjs";

void test("SRI integrity becomes lowercase CycloneDX hashes", () => {
  assert.deepEqual(hashesFromSri("sha512-YWJj"), [{ alg: "SHA-512", content: "616263" }]);
  assert.deepEqual(hashesFromSri("unsupported-YWJj malformed"), []);
  assert.equal(spdxHashAlgorithm("SHA-512"), "sha512");
  assert.throws(() => spdxHashAlgorithm("MD5"), /Unsupported SPDX hash/u);
});

void test("SBOM component names and declared licenses are normalized", () => {
  assert.equal(componentName({ group: "@noeos", name: "engine" }), "@noeos/engine");
  assert.equal(componentName({ name: "plain" }), "plain");
  assert.deepEqual(
    declaredLicenseExpressions({
      licenses: [
        { license: { id: "MIT" } },
        { expression: "Apache-2.0 OR MIT" },
        { license: { id: "MIT" } },
      ],
    }),
    ["Apache-2.0 OR MIT", "MIT"],
  );
});
