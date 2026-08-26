// SPDX-License-Identifier: Apache-2.0

import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { lstat, readFile, readdir } from "node:fs/promises";
import { basename, dirname, isAbsolute, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { gunzipSync } from "node:zlib";

export const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");

const excludedDirectories = new Set([
  ".build",
  ".git",
  ".npm",
  "artifacts",
  "coverage",
  "dist",
  "node_modules",
  "temp",
  "tmp",
]);

export async function assertProjectRoot() {
  const manifest = await readJson(resolve(projectRoot, "package.json"));
  if (manifest.name !== "@noeos/verification-engine-workspace" || manifest.private !== true) {
    throw new Error("Refusing to operate outside the Noeos verification-engine workspace.");
  }
}

export function digest(data, algorithm = "sha256") {
  return createHash(algorithm).update(data).digest("hex");
}

export async function listRepositoryFiles(start = projectRoot) {
  const files = [];

  async function visit(directory) {
    const entries = await readdir(directory, { withFileTypes: true });
    entries.sort((left, right) => left.name.localeCompare(right.name, "en"));

    for (const entry of entries) {
      if (entry.isDirectory() && excludedDirectories.has(entry.name)) {
        continue;
      }

      const absolutePath = resolve(directory, entry.name);
      const metadata = await lstat(absolutePath);
      if (metadata.isSymbolicLink()) {
        throw new Error(
          `Symbolic links are not permitted in the repository: ${toPosix(absolutePath)}`,
        );
      }
      if (metadata.isDirectory()) {
        await visit(absolutePath);
      } else if (metadata.isFile()) {
        files.push(absolutePath);
      }
    }
  }

  await visit(start);
  return files;
}

export function listTarGzEntries(archive) {
  const tar = gunzipSync(archive);
  const entries = [];
  let offset = 0;
  while (offset + 512 <= tar.length) {
    const header = tar.subarray(offset, offset + 512);
    if (header.every((byte) => byte === 0)) {
      break;
    }
    const name = readTarString(header, 0, 100);
    const prefix = readTarString(header, 345, 155);
    const sizeText = readTarString(header, 124, 12).trim();
    const size = Number.parseInt(sizeText || "0", 8);
    if (!Number.isSafeInteger(size) || size < 0 || name.length === 0) {
      throw new Error("Malformed tar entry in npm package.");
    }
    entries.push(prefix.length > 0 ? `${prefix}/${name}` : name);
    offset += 512 + Math.ceil(size / 512) * 512;
  }
  return entries;
}

export function isPathInside(parent, candidate) {
  const pathFromParent = relative(parent, candidate);
  return (
    pathFromParent.length > 0 &&
    pathFromParent !== ".." &&
    !pathFromParent.startsWith(`..${sep}`) &&
    !isAbsolute(pathFromParent)
  );
}

export async function readJson(path) {
  const source = await readFile(path, "utf8");
  try {
    return JSON.parse(source);
  } catch (error) {
    throw new Error(`Invalid JSON in ${toPosix(path)}`, { cause: error });
  }
}

export function npmCliPath(environment = process.env) {
  const candidate = environment.npm_execpath;
  if (
    typeof candidate !== "string" ||
    !isAbsolute(candidate) ||
    basename(candidate).toLowerCase() !== "npm-cli.js"
  ) {
    throw new Error("A trusted absolute npm CLI path is required; run this command through npm.");
  }
  return candidate;
}

export function run(command, arguments_, options = {}) {
  return execFileSync(command, arguments_, {
    cwd: projectRoot,
    encoding: "utf8",
    maxBuffer: 32 * 1024 * 1024,
    stdio: options.capture === true ? ["ignore", "pipe", "pipe"] : "inherit",
    ...options,
  });
}

export function runNpm(arguments_, options = {}) {
  return run(process.execPath, [npmCliPath(), ...arguments_], options);
}

export function stableJson(value) {
  return `${JSON.stringify(sortJson(value), null, 2)}\n`;
}

export function toPosix(path) {
  return relative(projectRoot, path).split(sep).join("/") || ".";
}

function sortJson(value) {
  if (Array.isArray(value)) {
    return value.map((item) => sortJson(item));
  }
  if (value !== null && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        .sort(([left], [right]) => left.localeCompare(right, "en"))
        .map(([key, item]) => [key, sortJson(item)]),
    );
  }
  return value;
}

function readTarString(buffer, start, length) {
  const end = buffer.indexOf(0, start);
  const boundedEnd = end >= start && end < start + length ? end : start + length;
  return buffer.subarray(start, boundedEnd).toString("utf8");
}
