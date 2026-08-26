// SPDX-License-Identifier: Apache-2.0

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
import { test } from "node:test";

void test("schemas, generated catalog, and human contract reference remain synchronized", () => {
  const result = spawnSync(process.execPath, [resolve("scripts/check-contracts.mjs")], {
    cwd: process.cwd(),
    encoding: "utf8",
  });
  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
});
