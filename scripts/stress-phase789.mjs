// SPDX-License-Identifier: Apache-2.0

import { createEngine } from "../packages/engine/dist/esm/index.js";

const requested = Number.parseInt(process.env.NOEOS_STRESS_RECORDS ?? "100000", 10);
const records = Number.isSafeInteger(requested) && requested > 0 ? requested : 100000;
if (records > 10_000_000) throw new Error("NOEOS_STRESS_RECORDS exceeds the governed 10M gate");

const engine = createEngine({ duplicatePolicy: { kind: "none" } });
const builder = engine.createChain({
  contextId: "stress.context",
  sequenceId: "stress.sequence",
  profile: { id: "dev.noeos.jcs", version: "1.0.0" },
  algorithm: "sha-256",
});
let previous = Object.freeze({ kind: "none" });
let emitted = 0;
const heapStart = process.memoryUsage().heapUsed;
const rssStart = process.memoryUsage().rss;
const resourcesStart = new Set(process.getActiveResourcesInfo?.() ?? []);
const started = performance.now();

async function* source() {
  for (let position = 0; position < records; position += 1) {
    yield { recordId: `stress-${String(position)}`, payload: { position }, position, previous };
  }
}

const result = await builder.appendStream(source(), {
  onEvidence(evidence) {
    previous = Object.freeze({ kind: "digest", value: evidence.linkDigest });
    emitted += 1;
  },
});
const elapsed = performance.now() - started;
if (!result.ok || emitted !== records) throw new Error("Streaming stress operation failed");
const heapDelta = process.memoryUsage().heapUsed - heapStart;
const rssDelta = process.memoryUsage().rss - rssStart;
const resourcesEnd = new Set(process.getActiveResourcesInfo?.() ?? []);
const newResources = [...resourcesEnd].filter((resource) => !resourcesStart.has(resource));
if (newResources.length > 0)
  throw new Error(`Streaming stress leaked resources: ${newResources.join(",")}`);

console.log(
  JSON.stringify({
    records,
    emitted,
    elapsedMs: Math.round(elapsed),
    heapDeltaBytes: heapDelta,
    rssDeltaBytes: rssDelta,
    resources: [...resourcesEnd].sort(),
  }),
);
