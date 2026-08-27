// SPDX-License-Identifier: Apache-2.0

import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { lstat, readFile, readdir } from "node:fs/promises";
import { relative, resolve } from "node:path";

import { assertProjectRoot, digest, isPathInside, projectRoot, stableJson } from "./project.mjs";
import { encodeFrame } from "./protocol-reference.mjs";

const vectorsRoot = resolve(projectRoot, "vectors");
const algorithms = new Map([
  ["sha-256", 64],
  ["sha-384", 96],
  ["sha-512", 128],
]);
const mandatoryCategories = new Set(["framing", "hashing", "invalid"]);

await assertProjectRoot();
const manifest = await readJson(resolve(vectorsRoot, "manifest.json"));
const sourceIds = validateManifest(manifest);
const vectorIds = new Set();
const manifestPaths = manifest.files.map((file) => file.path);
const actualPaths = await listVectorPaths();
if (stableJson(manifestPaths) !== stableJson(actualPaths)) {
  throw new Error("Vector manifest must list every vector file exactly once in lexical order");
}

const emitted = [];
for (const file of manifest.files) {
  const path = safeVectorPath(file.path);
  const bytes = await readFile(path);
  if (digest(bytes) !== file.sha256) {
    throw new Error("Vector digest mismatch: " + file.path);
  }
  const document = JSON.parse(bytes.toString("utf8"));
  if (
    !isObject(document) ||
    !Array.isArray(document.cases) ||
    document.cases.length !== file.caseCount
  ) {
    throw new Error("Vector case count mismatch: " + file.path);
  }
  for (const vector of document.cases) {
    const expected = verifyVector(vector, file.category, sourceIds, vectorIds);
    if (expected !== undefined) emitted.push(expected);
  }
}

if (process.argv.includes("--emit")) {
  console.log(JSON.stringify(emitted, null, 2));
  process.exit(0);
}

if (!process.argv.includes("--skip-reference")) {
  const result = spawnSync(
    "python3",
    [resolve(projectRoot, "reference/noeos_ve_reference.py"), "--check", vectorsRoot],
    {
      cwd: projectRoot,
      encoding: "utf8",
      stdio: "pipe",
    },
  );
  if (result.status !== 0) {
    throw new Error(
      "Independent Python reference failed:\n" + result.stdout + "\n" + result.stderr,
    );
  }
}

console.log(
  "Validated " +
    vectorIds.size +
    " vectors with Node" +
    (process.argv.includes("--skip-reference") ? "" : " and Python") +
    ".",
);

function verifyVector(vector, category, sourceIds, vectorIds) {
  if (
    !isObject(vector) ||
    typeof vector.id !== "string" ||
    !/^[A-Z][A-Z0-9_-]+$/u.test(vector.id)
  ) {
    throw new Error("Invalid vector ID");
  }
  if (vectorIds.has(vector.id)) throw new Error("Duplicate vector ID: " + vector.id);
  vectorIds.add(vector.id);
  if (
    typeof vector.requirement !== "string" ||
    !/^[A-Z]{3}-[0-9]{3}$/u.test(vector.requirement) ||
    typeof vector.source !== "string" ||
    !sourceIds.has(vector.source) ||
    vector.kind !== category
  ) {
    throw new Error("Invalid common vector metadata: " + vector.id);
  }

  if (vector.kind === "framing") {
    assertExactKeys(vector, [
      "algorithm",
      "expectedDigest",
      "expectedFrameHex",
      "frame",
      "id",
      "kind",
      "requirement",
      "source",
    ]);
    const algorithm = checkedAlgorithm(vector.algorithm, vector.id);
    assertHex(vector.expectedFrameHex, vector.id, "expected frame");
    assertDigest(vector.expectedDigest, algorithm, vector.id);
    const frame = encodeFrame(vector.frame);
    if (frame.toString("hex") !== vector.expectedFrameHex) {
      throw new Error("Frame mismatch: " + vector.id);
    }
    const hash = createHash(algorithm.replace("-", "")).update(frame).digest("hex");
    if (hash !== vector.expectedDigest) throw new Error("Digest mismatch: " + vector.id);
    return {
      id: vector.id,
      expectedFrameHex: frame.toString("hex"),
      expectedDigest: hash,
    };
  }

  if (vector.kind === "evidence") {
    assertExactKeys(vector, [
      "algorithm",
      "evidence",
      "expectedDigest",
      "expectedFrameHex",
      "expectedJcsHex",
      "id",
      "kind",
      "requirement",
      "source",
    ]);
    const algorithm = checkedAlgorithm(vector.algorithm, vector.id);
    if (!isObject(vector.evidence)) throw new Error("Invalid evidence vector: " + vector.id);
    const jcs = Buffer.from(canonicalJson(vector.evidence), "utf8");
    if (jcs.toString("hex") !== vector.expectedJcsHex) {
      throw new Error("Evidence JCS mismatch: " + vector.id);
    }
    const frame = encodeFrame({
      kind: "evidence",
      fields: [
        { tag: 1, type: "utf8", value: algorithm },
        { tag: 2, type: "utf8", value: vector.evidence.$schema },
        { tag: 3, type: "bytes", value: jcs.toString("hex") },
      ],
    });
    if (frame.toString("hex") !== vector.expectedFrameHex) {
      throw new Error("Evidence frame mismatch: " + vector.id);
    }
    const hash = createHash(algorithm.replace("-", "")).update(frame).digest("hex");
    if (hash !== vector.expectedDigest) throw new Error("Evidence digest mismatch: " + vector.id);
    return { id: vector.id, expectedFrameHex: frame.toString("hex"), expectedDigest: hash };
  }

  if (vector.kind === "hashing") {
    assertExactKeys(vector, [
      "algorithm",
      "expectedDigest",
      "id",
      "inputHex",
      "kind",
      "requirement",
      "source",
    ]);
    const algorithm = checkedAlgorithm(vector.algorithm, vector.id);
    assertHex(vector.inputHex, vector.id, "input");
    assertDigest(vector.expectedDigest, algorithm, vector.id);
    const input = Buffer.from(vector.inputHex, "hex");
    const hash = createHash(algorithm.replace("-", "")).update(input).digest("hex");
    if (hash !== vector.expectedDigest) throw new Error("Digest mismatch: " + vector.id);
    return { id: vector.id, expectedDigest: hash };
  }

  if (vector.kind === "invalid") {
    assertExactKeys(vector, ["expectedCode", "frame", "id", "kind", "requirement", "source"]);
    if (
      typeof vector.expectedCode !== "string" ||
      !/^[A-Z][A-Z0-9_]+$/u.test(vector.expectedCode)
    ) {
      throw new Error("Invalid expected diagnostic code: " + vector.id);
    }
    try {
      encodeFrame(vector.frame);
    } catch (error) {
      if (error instanceof Error && error.message === vector.expectedCode) return undefined;
      throw error;
    }
    throw new Error("Invalid vector unexpectedly succeeded: " + vector.id);
  }

  throw new Error("Unsupported vector kind: " + vector.id);
}

function validateManifest(value) {
  if (
    !isObject(value) ||
    value.$schema !== "urn:noeos:verification-engine:vector-set:1" ||
    value.version !== "1.0.0" ||
    value.protocolVersion !== 1 ||
    value.license !== "Apache-2.0" ||
    !Array.isArray(value.files) ||
    !Array.isArray(value.sources)
  ) {
    throw new Error("Invalid vector manifest");
  }
  assertExactKeys(value, ["$schema", "files", "license", "protocolVersion", "sources", "version"]);
  if (value.files.length < mandatoryCategories.size)
    throw new Error("Unexpected vector manifest file count");
  const paths = [];
  const fileCategories = new Set();
  for (const file of value.files) {
    if (!isObject(file)) throw new Error("Invalid vector manifest file entry");
    assertExactKeys(file, ["caseCount", "category", "path", "sha256"]);
    if (
      typeof file.path !== "string" ||
      !/^[a-z0-9][a-z0-9./-]*\.json$/u.test(file.path) ||
      file.path.includes("..") ||
      typeof file.category !== "string" ||
      !/^[a-z][a-z0-9-]{0,63}$/u.test(file.category) ||
      fileCategories.has(file.category) ||
      !Number.isSafeInteger(file.caseCount) ||
      file.caseCount < 1 ||
      file.caseCount > 100_000 ||
      typeof file.sha256 !== "string" ||
      !/^[0-9a-f]{64}$/u.test(file.sha256)
    ) {
      throw new Error("Invalid vector manifest file entry");
    }
    paths.push(file.path);
    fileCategories.add(file.category);
  }
  if (new Set(paths).size !== paths.length || stableJson(paths) !== stableJson([...paths].sort())) {
    throw new Error("Vector manifest paths must be unique and sorted");
  }
  for (const category of mandatoryCategories) {
    if (!fileCategories.has(category))
      throw new Error("Missing vector manifest category: " + category);
  }

  const sourceIds = new Set();
  const sources = [];
  for (const source of value.sources) {
    if (!isObject(source)) throw new Error("Invalid vector source");
    assertExactKeys(source, ["id", "license", "revision", "url"]);
    if (
      typeof source.id !== "string" ||
      !/^[A-Za-z0-9._:-]{1,128}$/u.test(source.id) ||
      sourceIds.has(source.id) ||
      typeof source.url !== "string" ||
      !/^https:\/\/[^\s]{1,2040}$/u.test(source.url) ||
      typeof source.license !== "string" ||
      source.license.length === 0 ||
      source.license.length > 128 ||
      typeof source.revision !== "string" ||
      source.revision.length === 0 ||
      source.revision.length > 128
    ) {
      throw new Error("Invalid vector source");
    }
    sourceIds.add(source.id);
    sources.push(source.id);
  }
  if (stableJson(sources) !== stableJson([...sources].sort())) {
    throw new Error("Vector sources must be sorted by ID");
  }
  return sourceIds;
}

function checkedAlgorithm(value, vectorId) {
  if (typeof value !== "string" || !algorithms.has(value)) {
    throw new Error("Invalid algorithm: " + vectorId);
  }
  return value;
}

function assertDigest(value, algorithm, vectorId) {
  const length = algorithms.get(algorithm);
  if (typeof value !== "string" || !new RegExp("^[0-9a-f]{" + length + "}$", "u").test(value)) {
    throw new Error("Invalid expected digest: " + vectorId);
  }
}

function assertHex(value, vectorId, label) {
  if (typeof value !== "string" || !/^(?:[0-9a-f]{2})*$/u.test(value)) {
    throw new Error("Invalid " + label + " hex: " + vectorId);
  }
}

function assertExactKeys(value, keys) {
  if (stableJson(Object.keys(value).sort()) !== stableJson([...keys].sort())) {
    throw new Error("Unexpected fields: " + Object.keys(value).sort().join(","));
  }
}

function canonicalJson(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (value !== null && typeof value === "object") {
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

function safeVectorPath(path) {
  const candidate = resolve(vectorsRoot, path);
  if (!isPathInside(vectorsRoot, candidate)) throw new Error("Unsafe vector path");
  return candidate;
}

async function listVectorPaths(directory = vectorsRoot, prefix = "") {
  const paths = [];
  const entries = await readdir(directory, { withFileTypes: true });
  for (const entry of entries.sort((left, right) => left.name.localeCompare(right.name, "en"))) {
    const path = resolve(directory, entry.name);
    const relativePath = prefix + entry.name;
    const metadata = await lstat(path);
    if (metadata.isSymbolicLink()) {
      throw new Error("Symbolic link in vectors: " + relative(projectRoot, path));
    }
    if (metadata.isDirectory()) {
      paths.push(...(await listVectorPaths(path, relativePath + "/")));
    } else if (
      metadata.isFile() &&
      relativePath !== "manifest.json" &&
      relativePath.endsWith(".json")
    ) {
      paths.push(relativePath);
    }
  }
  return paths.sort();
}

async function readJson(path) {
  return JSON.parse(await readFile(path, "utf8"));
}

function isObject(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
