// SPDX-License-Identifier: Apache-2.0

import { resolve } from "node:path";

import { assertProjectRoot, projectRoot, readJson } from "./project.mjs";
import {
  bundledNpmManifestPath,
  getToolchainProfile,
  validateActiveToolchain,
} from "./toolchain-rules.mjs";

await assertProjectRoot();

const profileName = readProfileArgument(process.argv.slice(2));
const manifest = await readJson(resolve(projectRoot, "security/runtime-toolchain.json"));
const expected = getToolchainProfile(manifest, profileName);
const npmManifestPath = bundledNpmManifestPath(process.execPath);
const npmManifest = await readJson(npmManifestPath);

if (npmManifest.name !== "npm") {
  throw new Error(`The active npm CLI has an unexpected package identity: ${npmManifest.name}`);
}

const actual = { node: process.versions.node, npm: npmManifest.version };
const failures = validateActiveToolchain(actual, expected);
if (failures.length > 0) {
  throw new AggregateError(
    failures.map((failure) => new Error(failure)),
    `Runtime toolchain does not match profile ${profileName}`,
  );
}

console.log(`Runtime toolchain verified: Node ${actual.node}, npm ${actual.npm} (${profileName}).`);

function readProfileArgument(arguments_) {
  if (arguments_.length !== 2 || arguments_[0] !== "--profile" || arguments_[1].length === 0) {
    throw new Error("Usage: npm run toolchain:check -- --profile <profile-name>");
  }
  return arguments_[1];
}
