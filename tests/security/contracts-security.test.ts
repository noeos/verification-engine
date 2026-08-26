// SPDX-License-Identifier: Apache-2.0

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { test } from "node:test";

void test("contract exports do not add I/O, networking, process execution, or mutable global state to the engine", async () => {
  for (const path of [
    "packages/engine/src/index.ts",
    "packages/engine/src/contracts/generated.ts",
    "packages/engine/src/contracts/schema-assets.ts",
    "packages/engine/src/contracts/vector-assets.ts",
  ]) {
    const source = await readFile(resolve(process.cwd(), path), "utf8");
    assert.doesNotMatch(
      source,
      /node:(?:fs|net|http|https|tls|dgram|child_process)|console\.|process\.|eval\(/u,
    );
  }
});
