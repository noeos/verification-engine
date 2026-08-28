// SPDX-License-Identifier: Apache-2.0

import { readFile } from "node:fs/promises";
import { extname, resolve } from "node:path";

import { assertProjectRoot, listRepositoryFiles, projectRoot, toPosix } from "./project.mjs";

await assertProjectRoot();

const failures = [];
const engineAllowedNodeModules = new Set(["node:assert", "node:crypto", "node:util"]);
const cliAllowedNodeModules = new Set([
  "node:buffer",
  "node:crypto",
  "node:fs",
  "node:fs/promises",
  "node:path",
  "node:stream",
  "node:url",
]);
const forbiddenRuntimePatterns = [
  /\b(?:eval|Function|WebAssembly|require)\s*\(/u,
  /\b(?:child_process|node:child_process|node:net|node:http|node:https|node:dgram|node:tls)\b/u,
  /\b(?:vm\.run|execFile|execSync|spawn|fork)\s*\(/u,
  /from\s+["'](?:https?:|data:)/u,
];

for (const file of await listRepositoryFiles()) {
  const path = toPosix(file);
  if (!path.startsWith("packages/engine/src/") && !path.startsWith("packages/cli/src/")) continue;
  if (extname(path) !== ".ts") continue;
  const source = await readFile(file, "utf8");
  const isEngine = path.startsWith("packages/engine/src/");
  for (const pattern of forbiddenRuntimePatterns) {
    if (pattern.test(source)) failures.push(`${path}: forbidden runtime construct ${pattern}`);
  }
  for (const match of source.matchAll(/from\s+["'](node:[^"']+)["']/gu)) {
    const moduleName = match[1];
    const allowed = isEngine ? engineAllowedNodeModules : cliAllowedNodeModules;
    if (moduleName !== undefined && !allowed.has(moduleName)) {
      failures.push(`${path}: runtime boundary does not allow ${moduleName}`);
    }
  }
  if (/from\s+["'](?:\.\/|\.\.\/).*cli\b/u.test(source) && isEngine) {
    failures.push(`${path}: engine must not depend on CLI code`);
  }
  if (/from\s+["'](?:\.\/|\.\.\/).*packages\b/u.test(source)) {
    failures.push(`${path}: package-root imports are not allowed inside product source`);
  }
}

const engineManifest = JSON.parse(
  await readFile(resolve(projectRoot, "packages/engine/package.json"), "utf8"),
);
const cliManifest = JSON.parse(
  await readFile(resolve(projectRoot, "packages/cli/package.json"), "utf8"),
);
if (Object.keys(engineManifest.dependencies ?? {}).length !== 0) {
  failures.push("engine package contains runtime dependencies");
}
const cliDependencies = cliManifest.dependencies ?? {};
if (
  Object.keys(cliDependencies).length !== 1 ||
  cliDependencies["@noeos/verification-engine"] !== engineManifest.version
) {
  failures.push("CLI runtime dependency boundary is not exact");
}

if (failures.length > 0) throw new Error(failures.join("\n"));
console.log("Security runtime boundaries passed.");
