// SPDX-License-Identifier: Apache-2.0

import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

import Ajv from "ajv";
import Ajv2020 from "ajv/dist/2020.js";

import {
  assertProjectRoot,
  digest,
  npmCliPath,
  projectRoot,
  readJson,
  run,
  stableJson,
} from "./project.mjs";
import {
  componentName,
  declaredLicenseExpressions,
  hashesFromSri,
  spdxHashAlgorithm,
} from "./sbom-rules.mjs";

await assertProjectRoot();

const outputDirectory = resolve(projectRoot, "artifacts/sbom");
await mkdir(outputDirectory, { recursive: true });

const cyclonedxManifest = await readJson(
  resolve(projectRoot, "node_modules/@cyclonedx/cyclonedx-npm/package.json"),
);
const cyclonedxBin =
  typeof cyclonedxManifest.bin === "string"
    ? cyclonedxManifest.bin
    : Object.values(cyclonedxManifest.bin)[0];
if (typeof cyclonedxBin !== "string") {
  throw new Error("CycloneDX npm package does not expose a usable CLI.");
}

const cyclonedxPath = resolve(projectRoot, "node_modules/@cyclonedx/cyclonedx-npm", cyclonedxBin);
const cyclonedxOutput = resolve(outputDirectory, "cyclonedx-1.7.json");
run(
  process.execPath,
  [
    cyclonedxPath,
    "--spec-version",
    "1.7",
    "--output-format",
    "JSON",
    "--output-file",
    cyclonedxOutput,
    "--output-reproducible",
    resolve(projectRoot, "package.json"),
  ],
  {
    env: { ...process.env, npm_execpath: npmCliPath() },
  },
);

const lock = await readJson(resolve(projectRoot, "package-lock.json"));
const lockPackages = lock.packages ?? {};
const cyclonedx = await readJson(cyclonedxOutput);
if (
  cyclonedx.metadata?.component === undefined ||
  !Array.isArray(cyclonedx.components) ||
  !Array.isArray(cyclonedx.dependencies)
) {
  throw new Error(
    "Generated CycloneDX document is missing its root, components, or relationships.",
  );
}

const knownCyclonedxReferences = new Set([
  cyclonedx.metadata.component["bom-ref"],
  ...cyclonedx.components.map((component) => component["bom-ref"]),
]);
const referencedCyclonedxComponents = new Set(
  cyclonedx.dependencies.flatMap((relationship) => [
    relationship.ref,
    ...(relationship.dependsOn ?? []),
  ]),
);
for (const reference of referencedCyclonedxComponents) {
  if (knownCyclonedxReferences.has(reference)) {
    continue;
  }
  const component = componentFromMissingReference(reference, lockPackages);
  cyclonedx.components.push(component);
  knownCyclonedxReferences.add(reference);
}
cyclonedx.components.sort((left, right) => left["bom-ref"].localeCompare(right["bom-ref"], "en"));

for (const component of cyclonedx.components) {
  const path = component.properties?.find(
    (property) => property.name === "cdx:npm:package:path",
  )?.value;
  if (typeof path !== "string" || lockPackages[path] === undefined) {
    throw new Error(`CycloneDX component has no matching lockfile path: ${component["bom-ref"]}`);
  }
  const lockMetadata = lockPackages[path];
  if (lockMetadata.link === true) {
    continue;
  }
  const hashes = hashesFromSri(lockMetadata.integrity);
  if (hashes.length === 0) {
    throw new Error(`Registry component has no verifiable integrity hash: ${path}`);
  }
  component.hashes = hashes;
}

const allCyclonedxComponents = [cyclonedx.metadata.component, ...cyclonedx.components];
const componentByReference = new Map();
for (const component of allCyclonedxComponents) {
  const reference = component["bom-ref"];
  if (typeof reference !== "string" || componentByReference.has(reference)) {
    throw new Error(`CycloneDX component reference is missing or duplicated: ${String(reference)}`);
  }
  if (declaredLicenseExpressions(component).length === 0) {
    throw new Error(`CycloneDX component has no declared license: ${reference}`);
  }
  componentByReference.set(reference, component);
}

for (const relationship of cyclonedx.dependencies) {
  if (!componentByReference.has(relationship.ref)) {
    throw new Error(`CycloneDX relationship starts at an unknown component: ${relationship.ref}`);
  }
  for (const dependency of relationship.dependsOn ?? []) {
    if (!componentByReference.has(dependency)) {
      throw new Error(`CycloneDX relationship targets an unknown component: ${dependency}`);
    }
  }
}
const cyclonedxSchemaDirectory = resolve(
  projectRoot,
  "node_modules/@cyclonedx/cyclonedx-library/res/schema",
);
const cyclonedxSchema = await readJson(
  resolve(cyclonedxSchemaDirectory, "bom-1.7.SNAPSHOT.schema.json"),
);
const cyclonedxAjv = new Ajv({ allErrors: true, strict: false, validateFormats: false });
for (const [filename, identifier] of [
  ["spdx.SNAPSHOT.schema.json", "http://cyclonedx.org/schema/spdx.SNAPSHOT.schema.json"],
  ["jsf-0.82.SNAPSHOT.schema.json", "http://cyclonedx.org/schema/jsf-0.82.SNAPSHOT.schema.json"],
  [
    "cryptography-defs.SNAPSHOT.schema.json",
    "http://cyclonedx.org/schema/cryptography-defs.SNAPSHOT.schema.json",
  ],
]) {
  cyclonedxAjv.addSchema(await readJson(resolve(cyclonedxSchemaDirectory, filename)), identifier);
}
const validateCyclonedx = cyclonedxAjv.compile(cyclonedxSchema);
if (!validateCyclonedx(cyclonedx)) {
  throw new Error(
    `Generated CycloneDX 1.7 document is structurally invalid: ${cyclonedxAjv.errorsText(
      validateCyclonedx.errors,
    )}`,
  );
}
await writeFile(cyclonedxOutput, stableJson(cyclonedx), "utf8");

const creationTime = new Date(
  Number.parseInt(process.env.SOURCE_DATE_EPOCH ?? "1787702400", 10) * 1000,
)
  .toISOString()
  .replace(".000Z", "Z");
const baseIri = "https://github.com/noeos/verification-engine/spdx/";
const creatorId = `${baseIri}Agent/Noeos-contributors`;
const documentId = `${baseIri}Document/foundation`;
const sbomId = `${baseIri}Sbom/foundation`;
const creationInfoId = "_:creationinfo";

const packageIdByReference = new Map(
  allCyclonedxComponents.map((component) => [
    component["bom-ref"],
    `${baseIri}Package/${encodeURIComponent(component["bom-ref"])}`,
  ]),
);
const rootReference = cyclonedx.metadata.component["bom-ref"];
const rootId = packageIdByReference.get(rootReference);
if (rootId === undefined) {
  throw new Error("SPDX root package identity could not be constructed.");
}

const packageElements = allCyclonedxComponents.map((component) => {
  const reference = component["bom-ref"];
  const spdxId = packageIdByReference.get(reference);
  const element = {
    creationInfo: creationInfoId,
    name: componentName(component),
    software_packageVersion: component.version,
    software_primaryPurpose: spdxPurpose(component.type),
    spdxId,
    type: "software_Package",
  };
  if (component.purl !== undefined) {
    element.software_packageUrl = component.purl;
  }
  const distribution = component.externalReferences?.find(
    (reference_) => reference_.type === "distribution",
  )?.url;
  if (distribution !== undefined) {
    element.software_downloadLocation = distribution;
  }
  const path = component.properties?.find(
    (property) => property.name === "cdx:npm:package:path",
  )?.value;
  if (typeof path === "string") {
    element.software_sourceInfo = `Resolved from package-lock.json at ${path || "workspace root"}.`;
  }
  if (Array.isArray(component.hashes) && component.hashes.length > 0) {
    element.verifiedUsing = component.hashes.map(({ alg, content }) => ({
      algorithm: spdxHashAlgorithm(alg),
      hashValue: content,
      type: "Hash",
    }));
  }
  if (reference === rootReference) {
    element.originatedBy = [creatorId];
  }
  return element;
});

const licenseExpressions = [
  ...new Set(allCyclonedxComponents.flatMap((component) => declaredLicenseExpressions(component))),
].sort((left, right) => left.localeCompare(right, "en"));
const licenseIdByExpression = new Map(
  licenseExpressions.map((expression) => [
    expression,
    `${baseIri}License/${encodeURIComponent(expression)}`,
  ]),
);
const licenseElements = licenseExpressions.map((expression) => ({
  creationInfo: creationInfoId,
  name: expression,
  simplelicensing_licenseExpression: expression,
  spdxId: licenseIdByExpression.get(expression),
  type: "simplelicensing_LicenseExpression",
}));

const dependencyRelationships = cyclonedx.dependencies
  .filter((relationship) => (relationship.dependsOn?.length ?? 0) > 0)
  .map((relationship) => ({
    completeness: "complete",
    creationInfo: creationInfoId,
    from: packageIdByReference.get(relationship.ref),
    relationshipType: "dependsOn",
    spdxId: `${baseIri}Relationship/${digest(`dependsOn\0${relationship.ref}`)}`,
    to: [...new Set(relationship.dependsOn)]
      .sort((left, right) => left.localeCompare(right, "en"))
      .map((reference) => packageIdByReference.get(reference)),
    type: "Relationship",
  }));
const licenseRelationships = allCyclonedxComponents.map((component) => ({
  completeness: "complete",
  creationInfo: creationInfoId,
  from: packageIdByReference.get(component["bom-ref"]),
  relationshipType: "hasDeclaredLicense",
  spdxId: `${baseIri}Relationship/${digest(`hasDeclaredLicense\0${component["bom-ref"]}`)}`,
  to: declaredLicenseExpressions(component).map((expression) =>
    licenseIdByExpression.get(expression),
  ),
  type: "Relationship",
}));
const relationshipElements = [...dependencyRelationships, ...licenseRelationships];
const sbomElements = [
  ...packageElements.map(({ spdxId }) => spdxId),
  ...licenseElements.map(({ spdxId }) => spdxId),
  ...relationshipElements.map(({ spdxId }) => spdxId),
];

const spdxDocument = {
  "@context": "https://spdx.org/rdf/3.0.1/spdx-context.jsonld",
  "@graph": [
    {
      "@id": creationInfoId,
      created: creationTime,
      createdBy: [creatorId],
      specVersion: "3.0.1",
      type: "CreationInfo",
    },
    {
      creationInfo: creationInfoId,
      name: "Noeos contributors",
      spdxId: creatorId,
      type: "Organization",
    },
    {
      creationInfo: creationInfoId,
      element: [creatorId, sbomId, ...sbomElements],
      profileConformance: ["core", "software", "simpleLicensing"],
      rootElement: [sbomId],
      spdxId: documentId,
      type: "SpdxDocument",
    },
    {
      creationInfo: creationInfoId,
      element: sbomElements,
      profileConformance: ["core", "software", "simpleLicensing"],
      rootElement: [rootId],
      software_sbomType: ["build"],
      spdxId: sbomId,
      type: "software_Sbom",
    },
    ...packageElements,
    ...licenseElements,
    ...relationshipElements,
  ],
};

const graphIds = spdxDocument["@graph"]
  .map((element) => element.spdxId ?? element["@id"])
  .filter((identifier) => identifier !== undefined);
if (new Set(graphIds).size !== graphIds.length) {
  throw new Error("Generated SPDX document contains duplicate element identities.");
}
if (licenseRelationships.length !== packageElements.length) {
  throw new Error("Generated SPDX document does not license every package element.");
}

const schema = await readJson(resolve(projectRoot, "scripts/schemas/spdx-3.0.1.schema.json"));
const ajv = new Ajv2020({ allErrors: true, strict: true, strictRequired: false });
const validate = ajv.compile(schema);
if (!validate(spdxDocument)) {
  throw new Error(
    `Generated SPDX 3.0.1 document is structurally invalid: ${ajv.errorsText(validate.errors)}`,
  );
}

const spdxOutput = resolve(outputDirectory, "spdx-3.0.1.json");
await writeFile(spdxOutput, stableJson(spdxDocument), "utf8");

const inventory = await readJson(resolve(projectRoot, "security/dependency-inventory.json"));
await writeFile(
  resolve(outputDirectory, "license-report.json"),
  stableJson({
    generatedAt: creationTime,
    projectLicense: "Apache-2.0",
    source: inventory.generatedFrom,
    components: inventory.components,
  }),
  "utf8",
);

const evidenceFiles = [
  cyclonedxOutput,
  spdxOutput,
  resolve(outputDirectory, "license-report.json"),
];
for (const algorithm of ["sha256", "sha512"]) {
  const lines = [];
  for (const path of evidenceFiles) {
    lines.push(`${digest(await readFile(path), algorithm)}  ${path.split("/").at(-1)}`);
  }
  await writeFile(
    resolve(outputDirectory, `${algorithm.toUpperCase()}SUMS`),
    `${lines.join("\n")}\n`,
    "utf8",
  );
}

console.log("CycloneDX 1.7, SPDX 3.0.1, license, and checksum evidence generated.");

function spdxPurpose(cycloneDxType) {
  const purposes = new Map([
    ["application", "application"],
    ["container", "container"],
    ["data", "data"],
    ["device", "device"],
    ["device-driver", "deviceDriver"],
    ["file", "file"],
    ["firmware", "firmware"],
    ["framework", "framework"],
    ["library", "library"],
    ["machine-learning-model", "model"],
    ["operating-system", "operatingSystem"],
    ["platform", "platform"],
  ]);
  return purposes.get(cycloneDxType) ?? "other";
}

function componentFromMissingReference(reference, lockPackages_) {
  if (typeof reference !== "string") {
    throw new Error("CycloneDX relationship contains a non-string component reference.");
  }
  const chain = reference.split("|");
  const identity = parsePackageIdentity(chain.at(-1));
  const parentIdentity = chain.length > 2 ? parsePackageIdentity(chain.at(-2)) : null;
  const candidates = Object.entries(lockPackages_).filter(
    ([path, metadata]) =>
      path.startsWith("node_modules/") &&
      metadata.link !== true &&
      packageNameFromPath(path) === identity.name &&
      metadata.version === identity.version,
  );
  const expectedSuffix =
    parentIdentity === null
      ? null
      : `node_modules/${parentIdentity.name}/node_modules/${identity.name}`;
  const preferred =
    expectedSuffix === null
      ? candidates
      : candidates.filter(([path]) => path.endsWith(expectedSuffix));
  const matches = preferred.length === 1 ? preferred : candidates;
  if (matches.length !== 1) {
    throw new Error(
      `Cannot resolve CycloneDX component ${reference} to one lockfile path; found ${matches.length}.`,
    );
  }

  const [path, metadata] = matches[0];
  const scopeSeparator = identity.name.startsWith("@") ? identity.name.indexOf("/") : -1;
  const group = scopeSeparator > 0 ? identity.name.slice(0, scopeSeparator) : undefined;
  const name = scopeSeparator > 0 ? identity.name.slice(scopeSeparator + 1) : identity.name;
  const license = Array.isArray(metadata.license)
    ? metadata.license.join(" OR ")
    : metadata.license;
  if (typeof license !== "string" || license.length === 0) {
    throw new Error(`Cannot construct CycloneDX licensing for ${reference}.`);
  }

  return {
    type: "library",
    name,
    ...(group === undefined ? {} : { group }),
    version: identity.version,
    "bom-ref": reference,
    licenses: [{ expression: license }],
    purl: npmPackageUrl(identity.name, identity.version),
    externalReferences: [
      {
        comment: "as recorded in package-lock.json",
        type: "distribution",
        url: metadata.resolved,
      },
    ],
    properties: [{ name: "cdx:npm:package:path", value: path }],
  };
}

function npmPackageUrl(name, version) {
  const encodedName = name.startsWith("@")
    ? `%40${name.slice(1).split("/").map(encodeURIComponent).join("/")}`
    : encodeURIComponent(name);
  return `pkg:npm/${encodedName}@${encodeURIComponent(version)}`;
}

function packageNameFromPath(path) {
  const segments = path.split("node_modules/").at(-1).split("/");
  return segments[0].startsWith("@") ? `${segments[0]}/${segments[1]}` : segments[0];
}

function parsePackageIdentity(segment) {
  if (typeof segment !== "string") {
    throw new Error("CycloneDX component reference has no package identity.");
  }
  const versionSeparator = segment.lastIndexOf("@");
  if (versionSeparator <= 0 || versionSeparator === segment.length - 1) {
    throw new Error(`CycloneDX component reference has invalid identity: ${segment}`);
  }
  return {
    name: segment.slice(0, versionSeparator),
    version: segment.slice(versionSeparator + 1),
  };
}
