// SPDX-License-Identifier: Apache-2.0

import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { relative, resolve } from "node:path";

import { assertProjectRoot, digest, projectRoot, run, stableJson } from "./project.mjs";

await assertProjectRoot();

const first = await buildSnapshot();
const second = await buildSnapshot();
if (stableJson(first) !== stableJson(second)) {
  throw new Error("Two clean builds produced different output trees or hashes.");
}

const firstTarballs = await packSnapshot();
const secondTarballs = await packSnapshot();
if (stableJson(firstTarballs) !== stableJson(secondTarballs)) {
  throw new Error("Two clean package operations produced different tarball hashes.");
}

console.log(
  `Reproducibility passed for ${Object.keys(first).length} build files and two tarballs.`,
);

async function buildSnapshot() {
  run(process.execPath, [resolve(projectRoot, "scripts/build.mjs")]);
  const result = {};
  for (const directory of [
    resolve(projectRoot, "packages/engine/dist"),
    resolve(projectRoot, "packages/cli/dist"),
  ]) {
    for (const file of await collectFiles(directory)) {
      result[relative(projectRoot, file).replaceAll("\\", "/")] = digest(await readFile(file));
    }
  }
  return result;
}

async function packSnapshot() {
  const destination = await mkdtemp(resolve(tmpdir(), "noeos-reproducible-pack-"));
  try {
    run(npmCommand(), [
      "pack",
      "--silent",
      "--ignore-scripts",
      "--pack-destination",
      destination,
      "--workspaces",
    ]);
    const results = (await readdir(destination))
      .filter((filename) => filename.endsWith(".tgz"))
      .sort();
    const snapshot = {};
    for (const filename of results) {
      snapshot[filename] = digest(await readFile(resolve(destination, filename)));
    }
    return snapshot;
  } finally {
    await rm(destination, { force: true, recursive: true });
  }
}

async function collectFiles(directory) {
  const results = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) {
      results.push(...(await collectFiles(path)));
    } else if (entry.isFile()) {
      results.push(path);
    }
  }
  return results.sort();
}

function npmCommand() {
  return process.platform === "win32" ? "npm.cmd" : "npm";
}
