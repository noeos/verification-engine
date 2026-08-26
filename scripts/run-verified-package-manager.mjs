// SPDX-License-Identifier: Apache-2.0

import { lstat } from "node:fs/promises";

import { parseVerifiedPackageManagerInvocation } from "./package-manager-rules.mjs";
import { assertProjectRoot, readJson, run } from "./project.mjs";
import {
  bundledNpmCliPath,
  bundledNpmManifestPath,
  getToolchainProfile,
  validateActiveToolchain,
} from "./toolchain-rules.mjs";

await assertProjectRoot();

const { profileName, packageManagerArguments } = parseVerifiedPackageManagerInvocation(
  process.argv.slice(2),
);
const runtimeToolchain = await readJson(
  new URL("../security/runtime-toolchain.json", import.meta.url),
);
const expected = getToolchainProfile(runtimeToolchain, profileName);
const manifestPath = bundledNpmManifestPath(process.execPath);
const cliPath = bundledNpmCliPath(process.execPath);
await assertRegularFile(manifestPath, "bundled package-manager manifest");
const packageManagerManifest = await readJson(manifestPath);

if (packageManagerManifest.name !== "npm") {
  throw new Error(
    `The bundled package manager has an unexpected package identity: ${packageManagerManifest.name}`,
  );
}
const failures = validateActiveToolchain(
  { node: process.versions.node, npm: packageManagerManifest.version },
  expected,
);
if (failures.length > 0) {
  throw new AggregateError(
    failures.map((failure) => new Error(failure)),
    `Runtime toolchain does not match profile ${profileName}`,
  );
}
await assertRegularFile(cliPath, "bundled package-manager CLI");

run(process.execPath, [cliPath, ...packageManagerArguments]);

async function assertRegularFile(path, description) {
  const metadata = await lstat(path);
  if (!metadata.isFile()) {
    throw new Error(`${description} must be a regular, non-symbolic-link file: ${path}`);
  }
}
