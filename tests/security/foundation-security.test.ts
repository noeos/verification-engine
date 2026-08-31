// SPDX-License-Identifier: Apache-2.0

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { test } from "node:test";

const root = process.cwd();

void test("engine has no runtime dependencies and CLI only references the engine", async () => {
  const engine = await readFile(resolve(root, "packages/engine/package.json"), "utf8");
  const cli = await readFile(resolve(root, "packages/cli/package.json"), "utf8");

  assert.doesNotMatch(engine, /"dependencies"\s*:/u);
  const engineManifest: unknown = JSON.parse(engine);
  const cliManifest: unknown = JSON.parse(cli);
  if (!isRecord(engineManifest) || !isRecord(cliManifest)) {
    throw new Error("package manifests must be JSON objects");
  }
  const engineVersion = engineManifest["version"];
  if (typeof engineVersion !== "string") throw new Error("engine version must be text");
  assert.match(engineVersion, /^(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)$/u);
  assert.equal(cliManifest["version"], engineVersion);
  assert.equal(cliManifest["private"], false);
  assert.deepEqual(cliManifest["dependencies"], {
    "@noeos/verification-engine": engineVersion,
  });
});

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

void test("foundation source cannot perform I/O, networking, process execution, or logging", async () => {
  const engineSource = await readFile(resolve(root, "packages/engine/src/index.ts"), "utf8");
  assert.doesNotMatch(
    engineSource,
    /node:(?:fs|net|http|https|tls|dgram|child_process)|console\.|process\./u,
  );
  const cliSource = await readFile(resolve(root, "packages/cli/src/main.ts"), "utf8");
  assert.doesNotMatch(
    cliSource,
    /node:(?:net|http|https|tls|dgram|child_process)|console\.|eval\(|import\(/u,
  );
});
