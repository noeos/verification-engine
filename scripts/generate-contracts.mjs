// SPDX-License-Identifier: Apache-2.0

import { mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { relative, resolve } from "node:path";

import { format, resolveConfig } from "prettier";

import { assertProjectRoot, projectRoot, stableJson } from "./project.mjs";

const checkOnly = process.argv.includes("--check");
const contractsRoot = resolve(projectRoot, "contracts");
const sourceSchemas = resolve(contractsRoot, "schemas");
const generatedSchemas = resolve(projectRoot, "packages/engine/schemas");
const sourceVectors = resolve(projectRoot, "vectors");
const generatedVectors = resolve(projectRoot, "packages/engine/vectors");
const generatedSource = resolve(projectRoot, "packages/engine/src/contracts/generated.ts");

await assertProjectRoot();

const catalog = await readJson(resolve(contractsRoot, "diagnostic-codes.v1.json"));
validateCatalog(catalog);
const codeNames = catalog.codes.map((entry) => entry.code);
const schemaFiles = (await readdir(sourceSchemas))
  .filter((file) => file.endsWith(".schema.json") || file.endsWith(".schema.template.json"))
  .sort();
const outputSchemas = new Map();
for (const file of schemaFiles) {
  const source = await readFile(resolve(sourceSchemas, file), "utf8");
  const target = file.replace(".template", "");
  outputSchemas.set(
    target,
    await format(source.replace('"__NOEOS_DIAGNOSTIC_CODES__"', JSON.stringify(codeNames)), {
      ...((await resolveConfig(resolve(generatedSchemas, target))) ?? {}),
      filepath: resolve(generatedSchemas, target),
    }),
  );
}
const manifest = await readJson(resolve(sourceVectors, "manifest.json"));
validateManifest(manifest);
const generatedTypeScript = await format(renderTypeScript(catalog, manifest), {
  ...((await resolveConfig(generatedSource)) ?? {}),
  filepath: generatedSource,
});

await synchronizeDirectory(generatedSchemas, outputSchemas);
await synchronizeDirectory(generatedVectors, await vectorOutputs());
await synchronizeFile(generatedSource, generatedTypeScript);

if (checkOnly) {
  console.log(
    `Contract generation is current for ${codeNames.length} diagnostic codes and ${outputSchemas.size} schemas.`,
  );
} else {
  console.log(
    `Generated contracts for ${codeNames.length} diagnostic codes and ${outputSchemas.size} schemas.`,
  );
}

async function vectorOutputs() {
  const output = new Map();
  const files = await readdir(sourceVectors);
  for (const file of files.sort()) {
    if (file.endsWith(".json")) {
      output.set(file, await readFile(resolve(sourceVectors, file), "utf8"));
    }
  }
  return output;
}

async function synchronizeDirectory(directory, files) {
  if (!checkOnly) {
    await rm(directory, { force: true, recursive: true });
    await mkdir(directory, { recursive: true });
    for (const [name, content] of files) {
      await writeFile(resolve(directory, name), content, "utf8");
    }
    return;
  }
  const actualNames = (await readdir(directory)).sort();
  const expectedNames = [...files.keys()].sort();
  if (stableJson(actualNames) !== stableJson(expectedNames)) {
    throw new Error(`${relative(projectRoot, directory)} has unexpected generated files`);
  }
  for (const [name, content] of files) {
    const actual = await readFile(resolve(directory, name), "utf8");
    if (actual !== content) {
      throw new Error(
        `${relative(projectRoot, directory)}/${name} is stale; run npm run contracts:generate`,
      );
    }
  }
}

async function synchronizeFile(path, content) {
  if (!checkOnly) {
    await mkdir(resolve(path, ".."), { recursive: true });
    await writeFile(path, content, "utf8");
    return;
  }
  const actual = await readFile(path, "utf8");
  if (actual !== content) {
    throw new Error(`${relative(projectRoot, path)} is stale; run npm run contracts:generate`);
  }
}

function validateCatalog(value) {
  if (!isObject(value) || value.version !== "1.0.0" || !Array.isArray(value.codes)) {
    throw new Error("Diagnostic catalog must declare version 1.0.0 and a code array");
  }
  const seen = new Set();
  for (const entry of value.codes) {
    if (
      !isObject(entry) ||
      typeof entry.code !== "string" ||
      !/^[A-Z][A-Z0-9_]+$/u.test(entry.code)
    ) {
      throw new Error("Diagnostic catalog contains an invalid code");
    }
    if (seen.has(entry.code)) {
      throw new Error(`Diagnostic catalog contains a duplicate code: ${entry.code}`);
    }
    seen.add(entry.code);
    if (
      !["error", "warning", "info"].includes(entry.severity) ||
      !Number.isSafeInteger(entry.exitCode)
    ) {
      throw new Error(`Diagnostic catalog contains invalid metadata: ${entry.code}`);
    }
  }
}

function validateManifest(value) {
  if (!isObject(value) || value.version !== "1.0.0" || !Array.isArray(value.files)) {
    throw new Error("Vector manifest must declare version 1.0.0 and files");
  }
}

function renderTypeScript(catalog, manifest) {
  const entries = catalog.codes.map((entry) => ({
    code: entry.code,
    family: entry.family,
    severity: entry.severity,
    exitCode: entry.exitCode,
    since: entry.since,
  }));
  const schemaAssets = [
    [
      "chain-summary",
      "urn:noeos:verification-engine:chain-summary:1",
      "chain-summary.v1.schema.json",
    ],
    ["diagnostic", "urn:noeos:verification-engine:diagnostic:1", "diagnostic.v1.schema.json"],
    [
      "link-evidence",
      "urn:noeos:verification-engine:link-evidence:1",
      "link-evidence.v1.schema.json",
    ],
    [
      "record-evidence",
      "urn:noeos:verification-engine:record-evidence:1",
      "record-evidence.v1.schema.json",
    ],
    ["vector-set", "urn:noeos:verification-engine:vector-set:1", "vector-set.v1.schema.json"],
  ];
  return `// SPDX-License-Identifier: Apache-2.0\n// Generated from contracts/diagnostic-codes.v1.json and contracts/schemas/.\n// Run: npm run contracts:generate\n\n/** @public */\nexport const DIAGNOSTIC_CODES = ${JSON.stringify(entries, null, 2)} as const;\n\n/** @public */\nexport type DiagnosticCode = (typeof DIAGNOSTIC_CODES)[number]["code"];\n/** @public */\nexport type DiagnosticSeverity = (typeof DIAGNOSTIC_CODES)[number]["severity"];\n/** @public */\nexport type DiagnosticFamily = (typeof DIAGNOSTIC_CODES)[number]["family"];\n\n/** @public */\nexport const SCHEMA_ASSETS = ${JSON.stringify(
    schemaAssets.map(([name, id, path]) => ({ name, id, path })),
    null,
    2,
  )} as const;\n/** @public */\nexport type SchemaName = (typeof SCHEMA_ASSETS)[number]["name"];\n/** @public */\nexport type SchemaId = (typeof SCHEMA_ASSETS)[number]["id"];\n\n/** @public */\nexport const VECTOR_SET = ${JSON.stringify({ version: manifest.version, protocolVersion: manifest.protocolVersion, files: manifest.files.map(({ path, category, sha256 }) => ({ path, category, sha256 })) }, null, 2)} as const;\n/** @public */\nexport type VectorCategory = (typeof VECTOR_SET.files)[number]["category"];\n`;
}

async function readJson(path) {
  return JSON.parse(await readFile(path, "utf8"));
}

function isObject(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
