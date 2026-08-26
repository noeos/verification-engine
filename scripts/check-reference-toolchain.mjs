// SPDX-License-Identifier: Apache-2.0

import { spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import { assertProjectRoot, projectRoot } from "./project.mjs";

await assertProjectRoot();
const manifest = JSON.parse(
  await readFile(resolve(projectRoot, "security/reference-toolchain.json"), "utf8"),
);
if (
  !/^3\.13\.\d+$/u.test(manifest.python) ||
  manifest.reviewedAt !== "2026-08-26" ||
  !/^https:\/\/www\.python\.org\/downloads\/release\//u.test(manifest.source)
) {
  throw new Error("Reference Python toolchain manifest is invalid");
}
const executable = process.env.NOEOS_PYTHON ?? "python3";
const result = spawnSync(executable, ["--version"], { encoding: "utf8", stdio: "pipe" });
const observed = `${result.stdout}${result.stderr}`.trim();
if (result.status !== 0 || observed !== `Python ${manifest.python}`) {
  throw new Error(
    `Expected Python ${manifest.python} for independent verification; received ${observed || "no usable Python"}`,
  );
}
console.log(`Independent reference runtime verified: Python ${manifest.python}.`);
