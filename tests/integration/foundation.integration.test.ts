// SPDX-License-Identifier: Apache-2.0

import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { test } from "node:test";

const root = process.cwd();

void test("ESM and CommonJS engine builds expose the same reviewed contract surface", async () => {
  const esm: unknown = await import(
    pathToFileURL(resolve(root, "packages/engine/dist/esm/index.js")).href
  );
  const require = createRequire(import.meta.url);
  const common: unknown = require(resolve(root, "packages/engine/dist/cjs/index.js"));

  assert.ok(typeof esm === "object" && esm !== null);
  assert.ok(typeof common === "object" && common !== null);
  assert.ok("DIAGNOSTIC_CODES" in esm);
  assert.ok("DIAGNOSTIC_CODES" in common);
  const publicValues = [
    "BUILTIN_PROFILES",
    "CHAIN_SUMMARY_EVIDENCE_SCHEMA",
    "DIAGNOSTIC_CODES",
    "DIAGNOSTIC_SCHEMA",
    "EngineConfigurationError",
    "LINK_EVIDENCE_SCHEMA",
    "RECORD_EVIDENCE_SCHEMA",
    "createEngine",
  ];
  assert.deepEqual(Object.keys(esm).sort(), publicValues.sort());
  assert.deepEqual(Object.keys(common).sort(), publicValues.sort());
  assert.deepEqual(Object.keys(esm).sort(), Object.keys(common).sort());
  assert.deepEqual(esm.DIAGNOSTIC_CODES, common.DIAGNOSTIC_CODES);
});

void test("CLI module is importable and has no premature public surface", async () => {
  const cli: unknown = await import(
    pathToFileURL(resolve(root, "packages/cli/dist/esm/main.js")).href
  );
  assert.ok(typeof cli === "object" && cli !== null);
  assert.deepEqual(Object.keys(cli), []);
});
