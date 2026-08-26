// SPDX-License-Identifier: Apache-2.0

import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

import { assertProjectRoot, projectRoot, readJson, stableJson } from "./project.mjs";

await assertProjectRoot();

const licenseText = await readFile(resolve(projectRoot, "LICENSE"), "utf8");
for (const phrase of [
  "Apache License",
  "Version 2.0, January 2004",
  "TERMS AND CONDITIONS FOR USE, REPRODUCTION, AND DISTRIBUTION",
  "END OF TERMS AND CONDITIONS",
]) {
  if (!licenseText.includes(phrase)) {
    throw new Error(`Root LICENSE is not the complete Apache-2.0 text: missing ${phrase}`);
  }
}

const lock = await readJson(resolve(projectRoot, "package-lock.json"));
const rootManifest = await readJson(resolve(projectRoot, "package.json"));
const admission = await readJson(resolve(projectRoot, "security/dependency-admission.json"));
const directDependencies = new Set(Object.keys(rootManifest.devDependencies ?? {}));
const entries = [];

for (const [path, metadata] of Object.entries(lock.packages ?? {})) {
  if (!path.startsWith("node_modules/") || metadata.link === true) {
    continue;
  }
  const name = metadata.name ?? packageNameFromPath(path);
  if (typeof metadata.version !== "string" || metadata.version.length === 0) {
    throw new Error(`Dependency at ${path} has no exact version`);
  }
  const license = normalizeLicense(metadata.license);
  if (license === null) {
    throw new Error(`Dependency ${name}@${metadata.version ?? "unknown"} has an unknown license`);
  }
  if (/(?:AGPL|GPL|SSPL|BUSL|Commons-Clause)/iu.test(license)) {
    throw new Error(`Dependency ${name}@${metadata.version} has a blocked license: ${license}`);
  }
  if (
    typeof metadata.resolved !== "string" ||
    !metadata.resolved.startsWith("https://registry.npmjs.org/") ||
    typeof metadata.integrity !== "string" ||
    metadata.integrity.length === 0
  ) {
    throw new Error(`Dependency ${name}@${metadata.version} lacks reviewed registry provenance`);
  }
  if (typeof metadata.deprecated === "string" && metadata.optional !== true) {
    throw new Error(`Required dependency ${name}@${metadata.version} is deprecated`);
  }
  entries.push({
    deprecated: typeof metadata.deprecated === "string" ? metadata.deprecated : null,
    direct: directDependencies.has(name) && path === `node_modules/${name}`,
    hasInstallScript: metadata.hasInstallScript === true,
    integrity: metadata.integrity,
    license,
    name,
    optional: metadata.optional === true,
    path,
    resolved: metadata.resolved,
    scope: "development",
    version: metadata.version,
  });
}

entries.sort((left, right) => left.path.localeCompare(right.path, "en"));
const inventory = {
  generatedFrom: "package-lock.json",
  licensePolicy:
    "Apache-2.0-compatible outputs; development-only tools reviewed for distribution impact",
  reviewedAt: admission.reviewedAt,
  schemaVersion: 1,
  components: entries,
};
const inventoryPath = resolve(projectRoot, "security/dependency-inventory.json");

for (const component of entries) {
  if (component.hasInstallScript && !component.optional) {
    throw new Error(
      `Non-optional development component ${component.name}@${component.version} has an install script`,
    );
  }
}

if (process.argv.includes("--write")) {
  await writeFile(inventoryPath, stableJson(inventory), "utf8");
} else {
  const recorded = await readFile(inventoryPath, "utf8");
  if (recorded !== stableJson(inventory)) {
    throw new Error("Dependency inventory drifted; review changes and regenerate it explicitly.");
  }
}

for (const workspace of ["packages/engine/package.json", "packages/cli/package.json"]) {
  const manifest = await readJson(resolve(projectRoot, workspace));
  if (manifest.license !== "Apache-2.0") {
    throw new Error(`${workspace} must declare Apache-2.0`);
  }
}

console.log(`License checks passed for ${entries.length} locked development occurrences.`);

function normalizeLicense(value) {
  if (typeof value === "string" && value.trim().length > 0) {
    return value.trim();
  }
  if (Array.isArray(value) && value.every((item) => typeof item === "string")) {
    return value.join(" OR ");
  }
  return null;
}

function packageNameFromPath(path) {
  const segments = path.split("node_modules/").at(-1).split("/");
  return segments[0].startsWith("@") ? `${segments[0]}/${segments[1]}` : segments[0];
}
