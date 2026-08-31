// SPDX-License-Identifier: Apache-2.0

import { readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { isAbsolute, resolve } from "node:path";

import { projectRoot, stableJson } from "./project.mjs";

const reportPath = resolveRepoPath(
  process.env.NOEOS_BENCH_REPORT ?? "benchmarks/reports/phase1011-baseline-candidate.json",
);
const baselinePath = resolveRepoPath(
  process.env.NOEOS_BENCH_BASELINE ?? "benchmarks/baselines/phase1011-linux-x64.json",
);
if (process.env.NOEOS_ALLOW_BASELINE_UPDATE !== "1") {
  throw new Error("Baseline creation requires NOEOS_ALLOW_BASELINE_UPDATE=1");
}

const report = JSON.parse(await readFile(reportPath, "utf8"));
const scenario = JSON.parse(
  await readFile(resolve(projectRoot, "benchmarks/scenarios/phase1011.json"), "utf8"),
);
if (report.official !== true || report.cleanTree !== true) {
  throw new Error("Only a clean official performance report can become a baseline");
}
if (
  report.scenarioSha256 !==
  sha256(await readFile(resolve(projectRoot, "benchmarks/scenarios/phase1011.json")))
) {
  throw new Error("Baseline report does not match the current benchmark scenario");
}
for (const thresholdResult of Object.entries(scenario.thresholds)) {
  const [id, threshold] = thresholdResult;
  const result = report.results.find((candidate) => candidate.id === id);
  if (result === undefined || result.status !== undefined) throw new Error(`Missing ${id} result`);
  const value =
    result.metric === "throughput"
      ? result.median
      : result.id === "P-09" && threshold.metric === "negativeRatio"
        ? result.ratio
        : result[threshold.metric];
  if (
    value === undefined ||
    (threshold.minimum !== undefined && value < threshold.minimum) ||
    (threshold.maximum !== undefined && value > threshold.maximum)
  ) {
    throw new Error(`Baseline candidate does not pass ${id}`);
  }
}
const baseline = {
  version: 1,
  scenarioSha256: report.scenarioSha256,
  seriesId: `${report.environment.cpuModel}|${report.environment.kernel}|${report.node}`,
  reference: report.reference,
  environment: report.environment,
  commit: report.commit,
  node: report.node,
  results: report.results,
};
const allowReplace = process.env.NOEOS_ALLOW_BASELINE_REPLACE === "1";
try {
  await writeFile(baselinePath, stableJson(baseline), {
    encoding: "utf8",
    flag: allowReplace ? "w" : "wx",
  });
} catch (error) {
  if (error?.code === "EEXIST") {
    throw new Error("Baseline already exists; replacement requires explicit approval", {
      cause: error,
    });
  }
  throw error;
}
process.stdout.write(`Performance baseline recorded at ${baselinePath}\n`);

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

function resolveRepoPath(candidate) {
  const path = resolve(projectRoot, candidate);
  if (
    !path.startsWith(`${projectRoot}/`) ||
    isAbsolute(candidate) ||
    candidate.split(/[\\/]+/u).includes("..")
  ) {
    throw new Error("performance paths must remain inside the repository");
  }
  return path;
}
