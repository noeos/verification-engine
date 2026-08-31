// SPDX-License-Identifier: Apache-2.0

import assert from "node:assert/strict";
import { test } from "node:test";

import { parseVerifiedPackageManagerInvocation } from "../../scripts/package-manager-rules.mjs";

void test("verified package-manager invocations require an exact profile and separator", () => {
  assert.deepEqual(
    parseVerifiedPackageManagerInvocation([
      "--profile",
      "node-24-primary",
      "--",
      "run",
      "policy:check",
    ]),
    {
      profileName: "node-24-primary",
      packageManagerArguments: ["run", "policy:check"],
    },
  );
  assert.throws(
    () => parseVerifiedPackageManagerInvocation(["--profile", "node-24-primary", "run"]),
    /Usage/u,
  );
});

void test("verified package-manager invocations reject commands outside the reviewed allowlist", () => {
  assert.deepEqual(
    parseVerifiedPackageManagerInvocation([
      "--profile",
      "node-24-primary",
      "--",
      "publish",
      "package.tgz",
    ]),
    {
      profileName: "node-24-primary",
      packageManagerArguments: ["publish", "package.tgz"],
    },
  );
  assert.throws(
    () => parseVerifiedPackageManagerInvocation(["--profile", "node-24-primary", "--", "install"]),
    /Unsupported package-manager command/u,
  );
});
