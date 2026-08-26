// SPDX-License-Identifier: Apache-2.0

import { extname, relative, resolve } from "node:path";
import { readFile } from "node:fs/promises";

import {
  assertProjectRoot,
  digest,
  listRepositoryFiles,
  projectRoot,
  readJson,
  stableJson,
  toPosix,
} from "./project.mjs";
import {
  containsPossibleSecret,
  containsUnresolvedMarker,
  isExactVersion,
  isPinnedAction,
  parseAllowedSshSigner,
} from "./policy-rules.mjs";
import { validateToolchainManifest } from "./toolchain-rules.mjs";

await assertProjectRoot();

const failures = [];
const rootManifest = await readJson(resolve(projectRoot, "package.json"));
const engineManifest = await readJson(resolve(projectRoot, "packages/engine/package.json"));
const cliManifest = await readJson(resolve(projectRoot, "packages/cli/package.json"));
const admission = await readJson(resolve(projectRoot, "security/dependency-admission.json"));
const githubSettings = await readJson(resolve(projectRoot, "security/github-settings.json"));
const runtimeToolchain = await readJson(resolve(projectRoot, "security/runtime-toolchain.json"));
const workflowActions = await readJson(resolve(projectRoot, "security/workflow-actions.json"));
const schemaProvenance = await readJson(
  resolve(projectRoot, "scripts/schemas/spdx-3.0.1.schema.provenance.json"),
);

requireValue(rootManifest.private, true, "root package must be private");
requireValue(engineManifest.private, true, "engine package must be private");
requireValue(cliManifest.private, true, "CLI package must be private");
const toolchainFailures = validateToolchainManifest(runtimeToolchain);
failures.push(...toolchainFailures);
const primaryToolchain = runtimeToolchain.profiles[runtimeToolchain.primaryProfile];
requireValue(
  runtimeToolchain.source,
  "https://nodejs.org/dist/index.json",
  "runtime versions must come from the official Node distribution index",
);
requireValue(runtimeToolchain.reviewedAt, "2026-08-26", "runtime review date is unexpected");
requireValue(
  rootManifest.packageManager,
  `npm@${primaryToolchain?.npm ?? "invalid"}`,
  "packageManager must match the reviewed primary npm",
);
requireValue(rootManifest.engines?.npm, ">=10.9.2 <12", "unexpected supported npm range");
for (const [label, manifest] of [
  ["root", rootManifest],
  ["engine", engineManifest],
  ["CLI", cliManifest],
]) {
  requireValue(
    manifest.engines?.node,
    ">=22.14.0 <23 || >=24.0.0 <25",
    `${label} has an unexpected supported Node range`,
  );
}
requireValue(engineManifest.name, "@noeos/verification-engine", "unexpected engine package name");
requireValue(cliManifest.name, "@noeos/verification-engine-cli", "unexpected CLI package name");
requireValue(githubSettings.visibility, "public", "GitHub visibility policy must remain public");
requireValue(
  githubSettings.actions.allowedActions,
  "selected",
  "GitHub Actions must use an explicit allowlist",
);
requireValue(
  githubSettings.actions.allowedReferences.githubOwned,
  true,
  "reviewed GitHub-owned Actions must remain enabled",
);
requireValue(
  githubSettings.actions.allowedReferences.verified,
  false,
  "all verified Marketplace Actions must not be allowed implicitly",
);
requireValue(
  githubSettings.tagRules["v*"].requireSignedTags,
  true,
  "release tags must require signatures",
);
requireValue(
  githubSettings.repositoryMetadata.description,
  "Specifications and governed TypeScript workspace for deterministic data-integrity evidence, hash chains, and auditable verification.",
  "GitHub description must match the approved public presentation",
);
requireValue(
  githubSettings.environments["npm-staging"].canAdminsBypass,
  false,
  "npm staging must prohibit administrator bypass",
);
requireValue(
  githubSettings.organization.twoFactorAuthenticationRequired,
  true,
  "organization must require two-factor authentication",
);

if (
  engineManifest.dependencies !== undefined &&
  Object.keys(engineManifest.dependencies).length > 0
) {
  failures.push("engine must have zero runtime dependencies");
}

const cliDependencies = cliManifest.dependencies ?? {};
if (
  Object.keys(cliDependencies).length !== 1 ||
  cliDependencies["@noeos/verification-engine"] !== engineManifest.version
) {
  failures.push("CLI must depend only on the exact workspace engine version");
}

for (const [name, version] of Object.entries(rootManifest.devDependencies ?? {})) {
  if (!isExactVersion(version)) {
    failures.push(`development dependency ${name} is not exact: ${version}`);
  }
}

const admittedVersions = Object.fromEntries(
  admission.admissions.map(({ name, version }) => [name, version]),
);
if (stableJson(admittedVersions) !== stableJson(rootManifest.devDependencies)) {
  failures.push("direct development dependencies do not match the reviewed admission inventory");
}

const admittedCiTools = admission.ciTools ?? [];
if (admittedCiTools.length !== 1 || admittedCiTools[0].name !== "gitleaks") {
  failures.push("the reviewed CI tool inventory must contain exactly Gitleaks");
} else {
  const [gitleaks] = admittedCiTools;
  if (!isExactVersion(gitleaks.version)) {
    failures.push(`Gitleaks does not use an exact version: ${gitleaks.version}`);
  }
  if (!/^https:\/\/github\.com\/gitleaks\/gitleaks\/releases\/download\//u.test(gitleaks.archive)) {
    failures.push("Gitleaks must be downloaded from its official GitHub release");
  }
  if (!/^[0-9a-f]{64}$/u.test(gitleaks.sha256)) {
    failures.push("Gitleaks must have a reviewed SHA-256 archive digest");
  }
}

const lock = await readJson(resolve(projectRoot, "package-lock.json"));
requireValue(lock.lockfileVersion, 3, "package-lock.json must use lockfile version 3");
requireValue(lock.name, rootManifest.name, "package-lock.json has an unexpected root name");
requireValue(
  lock.version,
  rootManifest.version,
  "package-lock.json has an unexpected root version",
);

const nodeVersion = (await readFile(resolve(projectRoot, ".node-version"), "utf8")).trim();
requireValue(
  nodeVersion,
  primaryToolchain?.node,
  ".node-version must pin the reviewed primary runtime",
);

const allowedSignerSource = await readFile(
  resolve(projectRoot, "security/allowed-signers"),
  "utf8",
);
const allowedSigner = parseAllowedSshSigner(allowedSignerSource);
if (allowedSigner === undefined) {
  failures.push("release signing policy must contain exactly one valid SSH signer");
} else {
  requireValue(
    allowedSigner.principal,
    "ddcandales@gmail.com",
    "release signer principal must match the verified maintainer identity",
  );
  requireValue(allowedSigner.namespace, "git", "release signer must be restricted to Git");
}

const schemaBytes = await readFile(resolve(projectRoot, "scripts/schemas/spdx-3.0.1.schema.json"));
if (digest(schemaBytes) !== schemaProvenance.sha256) {
  failures.push("vendored SPDX 3.0.1 schema does not match its reviewed digest");
}

const lifecycleScripts = new Set([
  "preinstall",
  "install",
  "postinstall",
  "prepare",
  "prepublish",
  "prepublishOnly",
]);
for (const [label, manifest] of [
  ["root", rootManifest],
  ["engine", engineManifest],
  ["CLI", cliManifest],
]) {
  for (const name of Object.keys(manifest.scripts ?? {})) {
    if (lifecycleScripts.has(name)) {
      failures.push(`${label} manifest contains prohibited lifecycle script ${name}`);
    }
  }
}

const files = await listRepositoryFiles();
const forbiddenSourceNames = /(?:^|\/)(?:common|helpers|misc|utils)\.(?:ts|js|mjs|cjs)$/u;

for (const file of files) {
  const relativePath = toPosix(file);
  if (forbiddenSourceNames.test(relativePath)) {
    failures.push(`prohibited ambiguous source filename: ${relativePath}`);
  }
  if (extname(file) === ".pdf" || relativePath === "LICENSE") {
    continue;
  }
  const source = await readFile(file, "utf8");
  if (
    !relativePath.startsWith("docs/") &&
    relativePath !== "scripts/check-policies.mjs" &&
    relativePath !== "scripts/policy-rules.mjs" &&
    containsUnresolvedMarker(source)
  ) {
    failures.push(`unresolved marker in ${relativePath}`);
  }
  if (
    relativePath !== "scripts/check-policies.mjs" &&
    relativePath !== "scripts/policy-rules.mjs" &&
    containsPossibleSecret(source)
  ) {
    failures.push(`possible secret in ${relativePath}`);
  }
}

const workflowFiles = files.filter(
  (file) =>
    toPosix(file).startsWith(".github/workflows/") && [".yml", ".yaml"].includes(extname(file)),
);
const dependabotSource = await readFile(resolve(projectRoot, ".github/dependabot.yml"), "utf8");
for (const dependency of ['dependency-name: "@types/node"', "dependency-name: typescript"]) {
  if (!dependabotSource.includes(dependency)) {
    failures.push(`Dependabot must isolate major updates for ${dependency}`);
  }
}
const securityWorkflowSource = await readFile(
  resolve(projectRoot, ".github/workflows/security.yml"),
  "utf8",
);
const releaseWorkflowSource = await readFile(
  resolve(projectRoot, ".github/workflows/release-candidate.yml"),
  "utf8",
);
if (
  !releaseWorkflowSource.includes(
    "if: github.ref_type == 'tag' && vars.NPM_STAGE_ENABLED == 'true'",
  ) ||
  releaseWorkflowSource.includes("inputs.stage")
) {
  failures.push("npm staging must be gated by an approved release-candidate tag");
}
for (const tool of admittedCiTools) {
  if (
    !securityWorkflowSource.includes(tool.archive) ||
    !securityWorkflowSource.includes(tool.sha256)
  ) {
    failures.push(`${tool.name} workflow inputs do not match the reviewed CI tool inventory`);
  }
}
const thirdPartyActionReferences = new Set();
const workflowActionReferences = new Set();
for (const workflow of workflowFiles) {
  const source = await readFile(workflow, "utf8");
  for (const match of source.matchAll(/^\s*uses:\s*([^\s#]+)(?:\s+#.*)?$/gmu)) {
    const reference = match[1];
    if (!isPinnedAction(reference)) {
      failures.push(`${toPosix(workflow)} has an action not pinned by full SHA: ${reference}`);
    }
    workflowActionReferences.add(reference);
    if (!/^(?:actions|github)\//u.test(reference) && !reference.startsWith("./")) {
      thirdPartyActionReferences.add(reference);
    }
  }
  if (/pull_request_target\s*:/u.test(source)) {
    failures.push(`${toPosix(workflow)} uses prohibited pull_request_target`);
  }
  if (/permissions:\s*write-all/u.test(source)) {
    failures.push(`${toPosix(workflow)} grants prohibited write-all permissions`);
  }
  const checkoutCount = [...source.matchAll(/^\s*uses:\s*actions\/checkout@/gmu)].length;
  const credentialGuardCount = [...source.matchAll(/^\s*persist-credentials:\s*false\s*$/gmu)]
    .length;
  if (checkoutCount !== credentialGuardCount) {
    failures.push(`${toPosix(workflow)} must disable credentials for every checkout`);
  }
  const setupNodeCount = [...source.matchAll(/^\s*uses:\s*actions\/setup-node@/gmu)].length;
  const toolchainCheckCount = [
    ...source.matchAll(/^\s*run:\s*node scripts\/check-toolchain\.mjs --profile\s+/gmu),
  ].length;
  if (setupNodeCount !== toolchainCheckCount) {
    failures.push(`${toPosix(workflow)} must verify every configured Node/npm toolchain`);
  }
}

const admittedWorkflowActions = new Set(
  (workflowActions.actions ?? []).map(({ reference }) => reference),
);
const workflowSources = await Promise.all(
  workflowFiles.map((workflow) => readFile(workflow, "utf8")),
);
requireValue(workflowActions.reviewedAt, "2026-08-26", "workflow Action review date is unexpected");
if (admittedWorkflowActions.size !== (workflowActions.actions ?? []).length) {
  failures.push("reviewed workflow Action inventory contains duplicate references");
}
for (const action of workflowActions.actions ?? []) {
  if (!isPinnedAction(action.reference) || !isExactVersion(action.version)) {
    failures.push(`invalid reviewed workflow Action: ${action.reference ?? "missing"}`);
  }
  if (
    !workflowSources.some((source) => source.includes(`${action.reference} # v${action.version}`))
  ) {
    failures.push(
      `reviewed workflow Action lacks its exact human-readable version: ${action.reference}`,
    );
  }
}
if (
  stableJson([...workflowActionReferences].sort()) !==
  stableJson([...admittedWorkflowActions].sort())
) {
  failures.push("workflow Actions do not match the reviewed Action inventory");
}

for (const workflow of workflowFiles) {
  const source = await readFile(workflow, "utf8");
  if (/npm\s+install\s+(?:--global|-g)\s+npm(?:@|\s)/u.test(source)) {
    failures.push(
      `${toPosix(workflow)} installs npm globally instead of using the Node distribution`,
    );
  }
}

for (const readmePath of ["README.md", "packages/engine/README.md", "packages/cli/README.md"]) {
  const source = await readFile(resolve(projectRoot, readmePath), "utf8");
  if (/\b(?:foundation phase|future|under development)\b/iu.test(source)) {
    failures.push(`${readmePath} contains internal construction language`);
  }
}

if (
  stableJson([...thirdPartyActionReferences].sort()) !==
  stableJson([...githubSettings.actions.allowedReferences.patterns].sort())
) {
  failures.push("third-party workflow Actions do not match the GitHub allowlist");
}

const requiredPaths = [
  ".github/CODEOWNERS",
  ".github/dependabot.yml",
  "packages/engine/src/index.ts",
  "packages/cli/src/main.ts",
  "scripts/check-runtime-smoke.mjs",
  "security/dependency-inventory.json",
  "security/allowed-signers",
  "security/runtime-toolchain.json",
  "security/workflow-actions.json",
  "vectors/.gitkeep",
];
for (const path of requiredPaths) {
  if (!files.some((file) => relative(projectRoot, file) === path)) {
    failures.push(`required repository path is missing: ${path}`);
  }
}

if (failures.length > 0) {
  throw new AggregateError(
    failures.map((failure) => new Error(failure)),
    "Repository policy failed",
  );
}

console.log(`Repository policy passed for ${files.length} files.`);

function requireValue(actual, expected, message) {
  if (actual !== expected) {
    failures.push(message);
  }
}
