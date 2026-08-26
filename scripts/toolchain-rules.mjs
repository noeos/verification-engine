// SPDX-License-Identifier: Apache-2.0

import { posix, win32 } from "node:path";

const exactVersionPattern = /^\d+\.\d+\.\d+$/u;
const profileNamePattern = /^node-\d+-(?:current|latest|minimum|primary)$/u;
const allowedRoles = new Set([
  "informational-current",
  "primary",
  "supported-latest-node-22",
  "supported-minimum",
]);
const roleByProfileSuffix = new Map([
  ["current", "informational-current"],
  ["latest", "supported-latest-node-22"],
  ["minimum", "supported-minimum"],
  ["primary", "primary"],
]);

export function getToolchainProfile(manifest, profileName) {
  const failures = validateToolchainManifest(manifest);
  if (failures.length > 0) {
    throw new AggregateError(
      failures.map((failure) => new Error(failure)),
      "Runtime toolchain policy is invalid",
    );
  }

  const profile = manifest.profiles[profileName];
  if (profile === undefined) {
    throw new Error(`Unknown runtime toolchain profile: ${profileName}`);
  }
  return profile;
}

export function bundledNpmManifestPath(nodeExecutable, platform = process.platform) {
  if (typeof nodeExecutable !== "string" || nodeExecutable.length === 0) {
    throw new Error("Node executable path is required.");
  }
  if (platform === "win32") {
    return win32.resolve(win32.dirname(nodeExecutable), "node_modules", "npm", "package.json");
  }
  return posix.resolve(
    posix.dirname(nodeExecutable),
    "..",
    "lib",
    "node_modules",
    "npm",
    "package.json",
  );
}

export function bundledNpmCliPath(nodeExecutable, platform = process.platform) {
  const path = platform === "win32" ? win32 : posix;
  return path.resolve(
    path.dirname(bundledNpmManifestPath(nodeExecutable, platform)),
    "bin",
    "npm-cli.js",
  );
}

export function validateActiveToolchain(actual, expected) {
  const failures = [];
  if (actual.node !== expected.node) {
    failures.push(`Node ${expected.node} is required; found ${actual.node}`);
  }
  if (actual.npm !== expected.npm) {
    failures.push(`npm ${expected.npm} is required; found ${actual.npm}`);
  }
  return failures;
}

export function validateToolchainManifest(manifest) {
  const failures = [];
  if (manifest === null || typeof manifest !== "object" || Array.isArray(manifest)) {
    return ["toolchain manifest must be an object"];
  }
  if (typeof manifest.primaryProfile !== "string") {
    failures.push("primaryProfile must be a string");
  }
  if (
    manifest.profiles === null ||
    typeof manifest.profiles !== "object" ||
    Array.isArray(manifest.profiles)
  ) {
    failures.push("profiles must be an object");
    return failures;
  }

  const entries = Object.entries(manifest.profiles);
  if (entries.length === 0) {
    failures.push("at least one runtime profile is required");
  }
  const combinations = new Set();
  let primaryRoleCount = 0;
  for (const [name, profile] of entries) {
    if (!profileNamePattern.test(name)) {
      failures.push(`invalid runtime profile name: ${name}`);
    }
    if (profile === null || typeof profile !== "object" || Array.isArray(profile)) {
      failures.push(`runtime profile ${name} must be an object`);
      continue;
    }
    if (!exactVersionPattern.test(profile.node ?? "")) {
      failures.push(`runtime profile ${name} has an invalid Node version`);
    }
    if (!exactVersionPattern.test(profile.npm ?? "")) {
      failures.push(`runtime profile ${name} has an invalid npm version`);
    }
    if (!allowedRoles.has(profile.role)) {
      failures.push(`runtime profile ${name} has an invalid role`);
    }
    const suffix = name.slice(name.lastIndexOf("-") + 1);
    if (roleByProfileSuffix.get(suffix) !== profile.role) {
      failures.push(`runtime profile ${name} has a role that does not match its name`);
    }
    if (profile.role === "primary") {
      primaryRoleCount += 1;
    }
    const combination = `${profile.node}/${profile.npm}`;
    if (combinations.has(combination)) {
      failures.push(`duplicate runtime combination: ${combination}`);
    }
    combinations.add(combination);
  }

  if (!Object.hasOwn(manifest.profiles, manifest.primaryProfile ?? "")) {
    failures.push("primaryProfile must reference a declared profile");
  } else if (manifest.profiles[manifest.primaryProfile].role !== "primary") {
    failures.push("primaryProfile must reference the primary role");
  }
  if (primaryRoleCount !== 1) {
    failures.push("exactly one runtime profile must have the primary role");
  }
  return failures;
}
