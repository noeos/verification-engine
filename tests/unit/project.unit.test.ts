// SPDX-License-Identifier: Apache-2.0

import assert from "node:assert/strict";
import { test } from "node:test";

import { resolve } from "node:path";

import { digest, isPathInside, npmCliPath, stableJson } from "../../scripts/project.mjs";

void test("stableJson sorts object keys recursively without reordering arrays", () => {
  const value = { zebra: { beta: 2, alpha: 1 }, alpha: [{ delta: 4, charlie: 3 }] };
  assert.equal(
    stableJson(value),
    '{\n  "alpha": [\n    {\n      "charlie": 3,\n      "delta": 4\n    }\n  ],\n  "zebra": {\n    "alpha": 1,\n    "beta": 2\n  }\n}\n',
  );
});

void test("digest uses deterministic lowercase hexadecimal output", () => {
  assert.equal(digest("noeos"), "eed22dada0a03d48dae0a261a5bd5835f836aec861e2b1338a71ebdde1145366");
  assert.match(digest("noeos", "sha512"), /^[0-9a-f]{128}$/u);
});

void test("isPathInside accepts descendants and rejects traversal or the root itself", () => {
  const root = resolve("sandbox", "repository");

  assert.equal(isPathInside(root, resolve(root, ".build")), true);
  assert.equal(isPathInside(root, resolve(root, "packages", "engine", "dist")), true);
  assert.equal(isPathInside(root, root), false);
  assert.equal(isPathInside(root, resolve(root, "..", "outside")), false);
});

void test("npmCliPath accepts only an absolute npm JavaScript entry point", () => {
  const cli = resolve("toolchain", "npm", "bin", "npm-cli.js");

  assert.equal(npmCliPath({ npm_execpath: cli }), cli);
  assert.throws(() => npmCliPath({ npm_execpath: "npm.cmd" }), /trusted absolute npm CLI/u);
  assert.throws(() => npmCliPath({ npm_execpath: resolve("toolchain", "other.js") }), /npm CLI/u);
  assert.throws(() => npmCliPath({}), /npm CLI/u);
});
