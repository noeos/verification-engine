// SPDX-License-Identifier: Apache-2.0

import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

import { assertProjectRoot, projectRoot } from "./project.mjs";

await assertProjectRoot();

const engineEsm = await import(
  pathToFileURL(resolve(projectRoot, "packages/engine/dist/esm/index.js")).href
);
const require = createRequire(import.meta.url);
const engineCjs = require(resolve(projectRoot, "packages/engine/dist/cjs/index.js"));
await import(pathToFileURL(resolve(projectRoot, "packages/cli/dist/esm/main.js")).href);

assert.deepEqual(
  Object.keys(engineEsm).sort(),
  Object.keys(engineCjs).sort(),
  "ESM and CommonJS exports must remain equivalent on the current Node line",
);

console.log(`Runtime smoke passed on Node ${process.versions.node}.`);
