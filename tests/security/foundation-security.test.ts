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
  assert.match(
    cli,
    /"dependencies"\s*:\s*\{\s*"@noeos\/verification-engine"\s*:\s*"0\.0\.0-development"\s*\}/u,
  );
});

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
