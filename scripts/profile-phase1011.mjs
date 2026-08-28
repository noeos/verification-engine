// SPDX-License-Identifier: Apache-2.0

import { mkdir } from "node:fs/promises";
import { spawn } from "node:child_process";
import { resolve } from "node:path";

import { assertProjectRoot, projectRoot } from "./project.mjs";

await assertProjectRoot();
const relativeDirectory = process.env.NOEOS_PROFILE_DIR ?? "benchmarks/reports";
if (relativeDirectory.startsWith("/") || relativeDirectory.split(/[\\/]+/u).includes("..")) {
  throw new Error("NOEOS_PROFILE_DIR must remain inside the repository");
}
const directory = resolve(projectRoot, relativeDirectory);
await mkdir(directory, { recursive: true });
const benchmark = resolve(projectRoot, "scripts/benchmark-phase1011.mjs");
const child = spawn(
  process.execPath,
  [
    "--cpu-prof",
    "--heap-prof",
    `--cpu-prof-dir=${directory}`,
    `--heap-prof-dir=${directory}`,
    benchmark,
  ],
  {
    cwd: projectRoot,
    env: {
      ...process.env,
      NOEOS_BENCH_OFFICIAL: "0",
      NOEOS_BENCH_REPORT: "benchmarks/reports/phase1011-profile.json",
    },
    stdio: "inherit",
  },
);
child.on("error", (error) => {
  throw error;
});
const exitCode = await new Promise((resolvePromise) => {
  child.on("close", (code, signal) => {
    if (signal !== null) resolvePromise(1);
    else resolvePromise(code ?? 1);
  });
});
if (exitCode !== 0) process.exitCode = exitCode;
