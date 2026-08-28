// SPDX-License-Identifier: Apache-2.0

import { resolve } from "node:path";

import { assertProjectRoot, projectRoot, run } from "./project.mjs";

await assertProjectRoot();
run(process.execPath, [resolve(projectRoot, "scripts/build.mjs")]);
run(process.execPath, [
  resolve(projectRoot, "node_modules/typescript/bin/tsc"),
  "--project",
  "tsconfig.tests.json",
]);

const testEntry = ".build/tests/tests/index.test.js";
run(process.execPath, [
  "--experimental-test-coverage",
  "--test-coverage-branches=95",
  "--test-coverage-functions=98",
  "--test-coverage-lines=98",
  "--test-coverage-include=.build/tests/packages/engine/dist/esm/**/*.js",
  testEntry,
]);
run(process.execPath, [
  "--experimental-test-coverage",
  "--test-coverage-branches=90",
  "--test-coverage-functions=95",
  "--test-coverage-lines=95",
  "--test-coverage-include=.build/tests/packages/cli/dist/esm/**/*.js",
  testEntry,
]);

console.log("Engine and CLI coverage gates passed independently.");
