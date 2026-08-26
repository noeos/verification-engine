// SPDX-License-Identifier: Apache-2.0

import Ajv2020 from "ajv/dist/2020.js";
import { readFile, readdir } from "node:fs/promises";
import { resolve } from "node:path";

import { assertProjectRoot, projectRoot, run, stableJson } from "./project.mjs";

await assertProjectRoot();
run(process.execPath, [resolve(projectRoot, "scripts/generate-contracts.mjs"), "--check"]);

const schemaDirectory = resolve(projectRoot, "packages/engine/schemas");
const schemaFiles = (await readdir(schemaDirectory))
  .filter((file) => file.endsWith(".json"))
  .sort();
if (schemaFiles.length !== 5)
  throw new Error(`Expected five generated schemas, received ${schemaFiles.length}`);

const schemas = await Promise.all(
  schemaFiles.map(async (file) =>
    JSON.parse(await readFile(resolve(schemaDirectory, file), "utf8")),
  ),
);
const ajv = new Ajv2020({
  allErrors: true,
  strict: true,
  strictTypes: true,
  validateFormats: true,
});
for (const schema of schemas) ajv.addSchema(schema);

const fixturesDirectory = resolve(projectRoot, "tests/fixtures/contracts");
const fixtures = (await readdir(fixturesDirectory)).filter((file) => file.endsWith(".json")).sort();
for (const fixtureFile of fixtures) {
  const fixture = JSON.parse(await readFile(resolve(fixturesDirectory, fixtureFile), "utf8"));
  const validator = ajv.getSchema(fixture.schema);
  if (validator === undefined)
    throw new Error(`Unknown fixture schema in ${fixtureFile}: ${fixture.schema}`);
  const accepted = validator(fixture.value);
  if (accepted !== fixture.valid) {
    throw new Error(
      `Schema fixture ${fixtureFile} expected valid=${fixture.valid}; errors=${stableJson(validator.errors)}`,
    );
  }
}

const vectorManifest = JSON.parse(
  await readFile(resolve(projectRoot, "vectors/manifest.json"), "utf8"),
);
const vectorManifestValidator = ajv.getSchema("urn:noeos:verification-engine:vector-set:1");
if (vectorManifestValidator === undefined) throw new Error("Missing vector set schema");
if (!vectorManifestValidator(vectorManifest)) {
  throw new Error(
    "The vector manifest does not satisfy its published schema: " +
      stableJson(vectorManifestValidator.errors),
  );
}

const catalog = JSON.parse(
  await readFile(resolve(projectRoot, "contracts/diagnostic-codes.v1.json"), "utf8"),
);
const catalogCodes = catalog.codes.map((entry) => entry.code);
const documentation = await readFile(
  resolve(projectRoot, "docs/03-contratos/05-catalogo-codigos.md"),
  "utf8",
);
const documentedCodes = [...documentation.matchAll(/^\| `([A-Z][A-Z0-9_]+)` \|/gmu)].map(
  (match) => match[1],
);
if (stableJson(catalogCodes) !== stableJson(documentedCodes)) {
  throw new Error("The human diagnostic catalog differs from its canonical structured source");
}

console.log(
  `Validated ${schemaFiles.length} schemas, ${fixtures.length} fixtures, and ${catalogCodes.length} diagnostic codes.`,
);
