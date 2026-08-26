// SPDX-License-Identifier: Apache-2.0

import assert from "node:assert/strict";
import { test } from "node:test";

import {
  bundledNpmManifestPath,
  getToolchainProfile,
  validateActiveToolchain,
  validateToolchainManifest,
} from "../../scripts/toolchain-rules.mjs";

const validManifest = {
  primaryProfile: "node-24-primary",
  profiles: {
    "node-22-minimum": { node: "22.14.0", npm: "10.9.2", role: "supported-minimum" },
    "node-24-primary": { node: "24.20.0", npm: "11.19.0", role: "primary" },
  },
};

void test("runtime manifest requires one exact primary toolchain", () => {
  assert.deepEqual(validateToolchainManifest(validManifest), []);
  assert.deepEqual(getToolchainProfile(validManifest, "node-24-primary"), {
    node: "24.20.0",
    npm: "11.19.0",
    role: "primary",
  });
  assert.throws(() => getToolchainProfile(validManifest, "missing"), /Unknown runtime/u);
});

void test("runtime manifest rejects mutable, duplicate, and ambiguous profiles", () => {
  const invalidManifest = {
    primaryProfile: "node-24-primary",
    profiles: {
      "bad profile": { node: "24", npm: "latest", role: "mutable" },
      "node-24-primary": { node: "24", npm: "latest", role: "primary" },
      "node-26-current": { node: "26", npm: "latest", role: "primary" },
    },
  };
  const failures = validateToolchainManifest(invalidManifest);
  assert.ok(failures.length >= 5);
  assert.match(failures.join("\n"), /invalid runtime profile name/u);
  assert.match(failures.join("\n"), /invalid role/u);
  assert.match(failures.join("\n"), /exactly one runtime profile/u);
});

void test("active runtime must match both Node and its bundled npm", () => {
  const expected = { node: "24.20.0", npm: "11.19.0" };
  assert.deepEqual(validateActiveToolchain(expected, expected), []);
  assert.deepEqual(validateActiveToolchain({ node: "24.20.0", npm: "11.18.0" }, expected), [
    "npm 11.19.0 is required; found 11.18.0",
  ]);
});

void test("bundled npm is resolved from the active official Node layout", () => {
  assert.equal(
    bundledNpmManifestPath("/opt/node/bin/node", "linux"),
    "/opt/node/lib/node_modules/npm/package.json",
  );
  assert.equal(
    bundledNpmManifestPath("C:\\node\\node.exe", "win32"),
    "C:\\node\\node_modules\\npm\\package.json",
  );
  assert.throws(() => bundledNpmManifestPath("", "linux"), /executable path is required/u);
});
