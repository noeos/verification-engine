// SPDX-License-Identifier: Apache-2.0

import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";

import {
  assertProjectRoot,
  listTarGzEntries,
  projectRoot,
  readJson,
  run,
  runNpm,
} from "./project.mjs";
import { isAllowedPackedPath } from "./policy-rules.mjs";

await assertProjectRoot();
run(process.execPath, [resolve(projectRoot, "scripts/build.mjs")]);

const workspaces = [
  {
    name: "@noeos/verification-engine",
    required: [
      "CHANGELOG.md",
      "LICENSE",
      "NOTICE",
      "README.md",
      "dist/cjs/index.js",
      "dist/cjs/package.json",
      "dist/esm/index.js",
      "dist/types/index.d.ts",
      "package.json",
    ],
  },
  {
    name: "@noeos/verification-engine-cli",
    required: [
      "CHANGELOG.md",
      "LICENSE",
      "NOTICE",
      "README.md",
      "dist/esm/main.js",
      "dist/types/main.d.ts",
      "package.json",
    ],
  },
];

for (const workspace of workspaces) {
  const destination = await mkdtemp(resolve(tmpdir(), "noeos-pack-policy-"));
  let files;
  try {
    runNpm([
      "pack",
      "--silent",
      "--ignore-scripts",
      "--pack-destination",
      destination,
      "--workspace",
      workspace.name,
    ]);
    const archives = (await readdir(destination)).filter((filename) => filename.endsWith(".tgz"));
    if (archives.length !== 1) {
      throw new Error(
        `${workspace.name} produced ${archives.length} package archives instead of one`,
      );
    }
    files = listTarGzEntries(await readFile(resolve(destination, archives[0])))
      .map((path) => path.replace(/^package\//u, ""))
      .sort();
  } finally {
    await rm(destination, { force: true, recursive: true });
  }

  for (const file of files) {
    if (!isAllowedPackedPath(file)) {
      throw new Error(`${workspace.name} contains an unexpected packed file: ${file}`);
    }
  }
  for (const required of workspace.required) {
    if (!files.includes(required)) {
      throw new Error(`${workspace.name} is missing required packed file: ${required}`);
    }
  }

  const manifestPath = workspace.name.endsWith("-cli")
    ? "packages/cli/package.json"
    : "packages/engine/package.json";
  const manifest = await readJson(resolve(projectRoot, manifestPath));
  if (manifest.private !== true) {
    throw new Error(`${workspace.name} unexpectedly became publishable`);
  }
  if (manifest.bin !== undefined) {
    throw new Error(`${workspace.name} must not expose a binary in the foundation phase`);
  }
}

console.log("Package allowlists and publication guards passed.");
