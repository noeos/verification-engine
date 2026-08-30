// SPDX-License-Identifier: Apache-2.0

import { readFile, writeFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { cpus, totalmem } from "node:os";
import { performance } from "node:perf_hooks";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { createEngine } from "../packages/engine/dist/esm/index.js";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const scenarioPath = resolve(projectRoot, "benchmarks/scenarios/phase1011.json");
const scenarioBytes = await readFile(scenarioPath);
const scenario = JSON.parse(scenarioBytes);
const scenarioSha256 = createHash("sha256").update(scenarioBytes).digest("hex");
const official = process.env.NOEOS_BENCH_OFFICIAL === "1";
const samples = integerOption("NOEOS_BENCH_SAMPLES", official ? 10 : 3, 1, 100);
const iterations = integerOption(
  "NOEOS_BENCH_ITERATIONS",
  official ? 10_000 : 1_000,
  10,
  1_000_000,
);
const engine = createEngine({ duplicatePolicy: { kind: "none" } });
const results = [];

if (official && (process.platform !== "linux" || process.arch !== "x64")) {
  throw new Error("official performance gates require the reviewed linux-x64 runner");
}

await runThroughput("P-01", () => record("dev.noeos.raw-bytes", new Uint8Array(1024), "sha-256"));
await runThroughput("P-02", () => record("dev.noeos.jcs", jcsPayload(), "sha-256"));
await runChainThroughput();
await runLatency();

if (official) {
  await runMemoryStream();
  await runTenMillion();
  await runCliLatency();
} else {
  results.push({ id: "P-05", status: "smoke-only" });
  results.push({ id: "P-06", status: "smoke-only" });
  results.push({ id: "P-07", status: "smoke-only" });
  results.push({ id: "P-08", status: "smoke-only" });
}

await runNegativeRatio();
await runAbortLatency();

const report = {
  version: 1,
  official,
  scenarioSha256,
  reference: scenario.reference,
  environment: {
    platform: process.platform,
    arch: process.arch,
    cpus: cpus().length,
    totalMemory: totalmem(),
  },
  commit: process.env.GITHUB_SHA ?? "local",
  node: process.version,
  samples,
  iterations,
  results,
};
const serializedReport = `${JSON.stringify(report)}\n`;
if (process.env.NOEOS_BENCH_REPORT !== undefined) {
  await writeFile(resolve(projectRoot, process.env.NOEOS_BENCH_REPORT), serializedReport, "utf8");
}
process.stdout.write(serializedReport);
if (official) enforce(report);

async function runThroughput(id, operation) {
  const values = [];
  for (let sample = 0; sample < samples; sample += 1) {
    for (let index = 0; index < Math.max(100, Math.floor(iterations / 10)); index += 1) operation();
    const started = performance.now();
    for (let index = 0; index < iterations; index += 1) {
      const result = operation();
      if (!result.ok) throw new Error(`${id} correctness failure`);
    }
    values.push(iterations / ((performance.now() - started) / 1000));
  }
  results.push({ id, metric: "throughput", ...sampleSummary(values) });
}

async function runChainThroughput() {
  const values = [];
  for (let sample = 0; sample < samples; sample += 1) {
    const builder = engine.createChain({
      contextId: "benchmark.context",
      sequenceId: `benchmark-${sample}`,
      profile: { id: "dev.noeos.jcs", version: "1.0.0" },
      algorithm: "sha-256",
    });
    const started = performance.now();
    let previous = { kind: "none" };
    for (let position = 0; position < iterations; position += 1) {
      const result = builder.append({
        recordId: `record-${position}`,
        payload: jcsPayload(),
        position,
        previous,
      });
      if (!result.ok) throw new Error("P-03 correctness failure");
      previous = { kind: "digest", value: result.value.linkDigest };
    }
    values.push(iterations / ((performance.now() - started) / 1000));
  }
  results.push({ id: "P-03", metric: "throughput", ...sampleSummary(values) });
}

async function runLatency() {
  const values = [];
  const count = official ? 10_000 : Math.min(iterations, 1_000);
  for (let index = 0; index < count; index += 1) {
    const started = performance.now();
    const result = record("dev.noeos.jcs", jcsPayload(), "sha-256");
    if (!result.ok) throw new Error("P-04 correctness failure");
    values.push(performance.now() - started);
  }
  results.push({
    id: "P-04",
    metric: "latency",
    p50: percentile(values, 0.5),
    p95: percentile(values, 0.95),
    p99: percentile(values, 0.99),
    maximum: Math.max(...values),
  });
}

async function runMemoryStream() {
  const records = 1024 * 1024;
  const builder = engine.createChain({
    contextId: "benchmark.context",
    sequenceId: "benchmark-memory",
    profile: { id: "dev.noeos.raw-bytes", version: "1.0.0" },
    algorithm: "sha-256",
  });
  const payload = new Uint8Array(1024);
  collectGarbage();
  const before = process.memoryUsage();
  const activeBefore = activeResources();
  let previous = { kind: "none" };
  let emitted = 0;
  let peakRss = before.rss;
  const rssSamples = [];
  async function* source() {
    for (let position = 0; position < records; position += 1) {
      yield { recordId: `memory-${position}`, payload, position, previous };
    }
  }
  const result = await builder.appendStream(source(), {
    onEvidence(evidence) {
      previous = { kind: "digest", value: evidence.linkDigest };
      emitted += 1;
      if (emitted % 65_536 === 0) {
        const rss = process.memoryUsage().rss;
        peakRss = Math.max(peakRss, rss);
        rssSamples.push(rss);
      }
    },
  });
  const after = process.memoryUsage();
  peakRss = Math.max(peakRss, after.rss);
  const activeAfter = activeResources();
  if (!result.ok || emitted !== records) throw new Error("P-05 correctness failure");
  results.push({
    id: "P-05",
    metric: "rssDelta",
    rssDelta: peakRss - before.rss,
    heapDelta: after.heapUsed - before.heapUsed,
    externalDelta: after.external - before.external,
    activeResourcesBefore: activeBefore,
    activeResourcesAfter: activeAfter,
    rssSamples,
    emitted,
  });
}

async function runTenMillion() {
  const records = 10_000_000;
  const builder = engine.createChain({
    contextId: "benchmark.context",
    sequenceId: "benchmark-ten-million",
    profile: { id: "dev.noeos.raw-bytes", version: "1.0.0" },
    algorithm: "sha-256",
  });
  const payload = new Uint8Array(0);
  let previous = { kind: "none" };
  let emitted = 0;
  collectGarbage();
  const before = process.memoryUsage();
  const activeBefore = activeResources();
  let peakRss = before.rss;
  const rssSamples = [];
  async function* source() {
    for (let position = 0; position < records; position += 1) {
      yield { recordId: `empty-${position}`, payload, position, previous };
    }
  }
  const result = await builder.appendStream(source(), {
    onEvidence(evidence) {
      previous = { kind: "digest", value: evidence.linkDigest };
      emitted += 1;
      if (emitted % 1_000_000 === 0) {
        const rss = process.memoryUsage().rss;
        peakRss = Math.max(peakRss, rss);
        rssSamples.push(rss);
      }
    },
  });
  const after = process.memoryUsage();
  peakRss = Math.max(peakRss, after.rss);
  const activeAfter = activeResources();
  if (!result.ok || emitted !== records) throw new Error("P-06 correctness failure");
  results.push({
    id: "P-06",
    metric: "pending",
    pending: 1,
    rssDelta: peakRss - before.rss,
    emitted,
    heapDelta: after.heapUsed - before.heapUsed,
    externalDelta: after.external - before.external,
    activeResourcesBefore: activeBefore,
    activeResourcesAfter: activeAfter,
    rssSamples,
  });
}

async function runCliLatency() {
  const count = official ? 10_000 : 20;
  const versionValues = [];
  const firstRecordValues = [];
  const entry = resolve(projectRoot, "packages/cli/dist/esm/main.js");
  for (let index = 0; index < count; index += 1) {
    versionValues.push(await spawnCli(entry, ["version", "--output", "ndjson"]));
    firstRecordValues.push(
      await spawnCli(
        entry,
        ["record", "hash", "--input", "-", "--output", "ndjson"],
        `${JSON.stringify({
          contextId: "benchmark.context",
          recordId: `cli-${index}`,
          payload: { value: index },
          profile: { id: "dev.noeos.jcs", version: "1.0.0" },
          algorithm: "sha-256",
        })}\n`,
        true,
      ),
    );
  }
  results.push({ id: "P-07", metric: "p95", p95: percentile(versionValues, 0.95), count });
  results.push({ id: "P-08", metric: "p95", p95: percentile(firstRecordValues, 0.95), count });
}

function spawnCli(entry, arguments_, input = "", firstOutput = false) {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(process.execPath, [entry, ...arguments_], {
      cwd: projectRoot,
      stdio: ["pipe", "pipe", "pipe"],
    });
    const started = performance.now();
    let settled = false;
    let firstLatency;
    const finish = (error, value) => {
      if (settled) return;
      settled = true;
      if (error !== undefined) reject(error);
      else resolvePromise(value);
    };
    child.stderr.resume();
    const onOutput = () => {
      if (firstOutput && firstLatency === undefined) firstLatency = performance.now() - started;
    };
    child.stdout.once("data", onOutput);
    child.on("error", (error) => finish(error));
    child.on("close", (code) => {
      if (code !== 0) finish(new Error(`CLI benchmark exited with ${String(code)}`));
      else if (firstOutput) {
        if (firstLatency === undefined) finish(new Error("CLI produced no output"));
        else finish(undefined, firstLatency);
      } else finish(undefined, performance.now() - started);
    });
    child.stdin.end(input);
  });
}

async function runNegativeRatio() {
  const payload = new Uint8Array(1024);
  const fixture = createLinkFixture(payload);
  const invalidEvidence = {
    ...fixture.evidence,
    linkDigest: `${fixture.evidence.linkDigest[0] === "0" ? "1" : "0"}${fixture.evidence.linkDigest.slice(1)}`,
  };
  const count = official ? Math.min(iterations, 1_000) : Math.min(iterations, 100);
  const validValues = [];
  const negativeValues = [];
  for (let index = 0; index < count; index += 1) {
    validValues.push(await verifyLink(fixture.evidence, payload, "valid"));
    negativeValues.push(await verifyLink(invalidEvidence, payload, "invalid"));
  }
  const validMedian = median(validValues);
  const negativeMedian = median(negativeValues);
  results.push({
    id: "P-09",
    metric: "negativeRatio",
    ratio: negativeMedian / validMedian,
    validMedian,
    negativeMedian,
    count,
  });
}

async function runAbortLatency() {
  const values = [];
  const count = official ? 10 : 3;
  for (let sample = 0; sample < count; sample += 1) {
    const controller = new AbortController();
    const payload = new Uint8Array(0);
    const fixture = createLinkFixture(payload);
    let abortAt;
    const source = (async function* input() {
      yield { payload, evidence: fixture.evidence };
      abortAt = performance.now();
      controller.abort();
    })();
    const started = performance.now();
    const result = await engine.verifyStream({
      contextId: "benchmark.context",
      sequenceId: "benchmark-abort",
      profile: { id: "dev.noeos.raw-bytes", version: "1.0.0" },
      algorithm: "sha-256",
      mode: "internal",
      records: source,
      signal: controller.signal,
    });
    if (result.status !== "aborted") throw new Error("P-10 abort setup failed");
    if (abortAt === undefined) throw new Error("P-10 did not abort between records");
    values.push(performance.now() - abortAt);
    if (performance.now() - started > 1_000)
      throw new Error("P-10 operation did not return promptly");
  }
  results.push({
    id: "P-10",
    metric: "abortLatency",
    abortLatency: percentile(values, 0.95),
    p50: percentile(values, 0.5),
    p95: percentile(values, 0.95),
    maximum: Math.max(...values),
    samples: values,
  });
}

function createLinkFixture(payload) {
  const builder = engine.createChain({
    contextId: "benchmark.context",
    sequenceId: "benchmark-negative",
    profile: { id: "dev.noeos.raw-bytes", version: "1.0.0" },
    algorithm: "sha-256",
  });
  const result = builder.append({
    recordId: "benchmark-record",
    payload,
    position: 0,
    previous: { kind: "none" },
  });
  if (!result.ok) throw new Error("benchmark link fixture failed");
  return { evidence: result.value };
}

async function verifyLink(evidence, payload, expectedStatus) {
  const started = performance.now();
  const result = await engine.verifyStream({
    contextId: "benchmark.context",
    sequenceId: "benchmark-negative",
    profile: { id: "dev.noeos.raw-bytes", version: "1.0.0" },
    algorithm: "sha-256",
    mode: "internal",
    records: (async function* records() {
      yield { payload, evidence };
    })(),
  });
  if (result.status !== expectedStatus) throw new Error("P-09 verification classification failure");
  return performance.now() - started;
}

function record(profile, payload, algorithm) {
  return engine.hashRecord({
    contextId: "benchmark.context",
    recordId: `record-${String(payload.length)}`,
    payload,
    profile: { id: profile, version: "1.0.0" },
    algorithm,
  });
}

function jcsPayload() {
  return { amount: "123.45", description: "x".repeat(900), items: [1, 2, 3], marker: true };
}

function enforce(report) {
  const failures = [];
  const [expectedPlatform, expectedArch] = scenario.reference.platform.split("-");
  if (report.environment.platform !== expectedPlatform) {
    failures.push("official benchmark platform does not match the reviewed reference");
  }
  if (report.environment.arch !== expectedArch) {
    failures.push("official benchmark architecture does not match the reviewed reference");
  }
  if (report.environment.cpus < scenario.reference.vcpus) {
    failures.push("official benchmark runner has fewer CPUs than the reviewed reference");
  }
  for (const result of report.results) {
    const threshold = scenario.thresholds[result.id];
    if (threshold === undefined || result.status !== undefined) continue;
    const value = result.metric === "throughput" ? result.median : result[threshold.metric];
    if (
      value === undefined ||
      (threshold.minimum !== undefined && value < threshold.minimum) ||
      (threshold.maximum !== undefined && value > threshold.maximum)
    ) {
      failures.push(`${result.id} ${threshold.metric} gate failed: ${String(value)}`);
    }
    if (
      (result.id === "P-05" || result.id === "P-06") &&
      result.activeResourcesBefore !== undefined
    ) {
      if (
        JSON.stringify(result.activeResourcesBefore) !== JSON.stringify(result.activeResourcesAfter)
      ) {
        failures.push(`${result.id} active resource set changed during the stream`);
      }
      if (result.rssDelta > scenario.thresholds["P-05"].maximum) {
        failures.push(`${result.id} rss stability gate failed: ${String(result.rssDelta)}`);
      }
    }
  }
  if (failures.length > 0) throw new Error(failures.join("\n"));
}

function collectGarbage() {
  if (typeof globalThis.gc === "function") globalThis.gc();
}

function activeResources() {
  return typeof process.getActiveResourcesInfo === "function"
    ? process.getActiveResourcesInfo().sort()
    : [];
}

function sampleSummary(values) {
  return {
    median: median(values),
    values,
    bootstrap95: bootstrapMedianInterval(values),
  };
}

function bootstrapMedianInterval(values) {
  if (values.length < 2) return { low: values[0], high: values[0] };
  let state = 0x9e3779b9;
  const medians = [];
  for (let sample = 0; sample < 2_000; sample += 1) {
    const resample = [];
    for (const index of values.keys()) {
      state = Math.imul(state ^ (state >>> 15), 1 | state);
      state ^= state + Math.imul(state ^ (state >>> 7), 61 | state);
      resample.push(values[((state >>> 0) + index) % values.length]);
    }
    medians.push(median(resample));
  }
  return { low: percentile(medians, 0.025), high: percentile(medians, 0.975) };
}

function integerOption(name, fallback, minimum, maximum) {
  const value = process.env[name];
  if (value === undefined) return fallback;
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < minimum || parsed > maximum)
    throw new Error(`${name} is invalid`);
  return parsed;
}

function median(values) {
  return percentile(values, 0.5);
}
function percentile(values, fraction) {
  const sorted = [...values].sort((left, right) => left - right);
  return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * fraction))];
}
