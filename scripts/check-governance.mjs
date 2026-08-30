// SPDX-License-Identifier: Apache-2.0

import { readFile } from "node:fs/promises";

import { assertProjectRoot, listRepositoryFiles, toPosix } from "./project.mjs";

await assertProjectRoot();

const forbidden = [
  /critical-change-policy/iu,
  /check-critical-wait/iu,
  /minimumCriticalWait/u,
  /remainingCriticalWait/u,
  /critical-path waiting/iu,
  /critical changes require 24 hours/iu,
  /critical changes wait at least 24 hours/iu,
  /espera de 24 horas para cambios críticos/iu,
  /waiting-period check/iu,
];
const failures = [];
for (const file of await listRepositoryFiles()) {
  const path = toPosix(file);
  if (path === "scripts/check-governance.mjs") continue;
  const source = await readFile(file, "utf8");
  for (const pattern of forbidden) {
    if (pattern.test(source)) failures.push(`${path}: obsolete governance protocol ${pattern}`);
  }
}
if (failures.length > 0) throw new Error(failures.join("\n"));
console.log("Governance protocol cleanup passed.");
