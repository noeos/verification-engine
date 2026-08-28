// SPDX-License-Identifier: Apache-2.0

/* Runtime contract tests intentionally execute freshly built artifacts. */
/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-return, @typescript-eslint/require-await */

import assert from "node:assert/strict";
import { test } from "node:test";

import { createEngine } from "../../packages/engine/dist/esm/index.js";
import type {
  ChainRecordInput,
  EngineEvent,
  VerifyChainRecord,
} from "../../packages/engine/src/api/types.js";
import type { LinkEvidence } from "../../packages/engine/src/domain/evidence.js";

const engine = createEngine();
const chainConfig = Object.freeze({
  contextId: "ctx",
  sequenceId: "stream",
  profile: Object.freeze({ id: "dev.noeos.jcs", version: "1.0.0" }),
  algorithm: "sha-256" as const,
});

function records(): readonly [ChainRecordInput, ChainRecordInput] {
  return Object.freeze([
    Object.freeze({
      recordId: "one",
      payload: { value: 1 },
      position: 0,
      previous: { kind: "none" } as const,
    }),
    Object.freeze({
      recordId: "two",
      payload: { value: 2 },
      position: 1,
      previous: { kind: "digest", value: "" } as const,
    }),
  ]);
}

function createChainEvidence(): readonly LinkEvidence[] {
  const builder = engine.createChain(chainConfig);
  const first = builder.append(records()[0]);
  assert.equal(first.ok, true);
  if (!first.ok) throw new Error("first link was not created");
  const second = builder.append({
    ...records()[1],
    previous: { kind: "digest", value: first.value.linkDigest },
  });
  assert.equal(second.ok, true);
  if (!second.ok) throw new Error("second link was not created");
  assert.equal(builder.finalize().ok, true);
  return Object.freeze([first.value, second.value]);
}

void test("phase 7 appendStream is sequential, backpressured, abortable, and closes its source", async () => {
  const builder = engine.createChain(chainConfig);
  const inputRows = records();
  let requested = 0;
  let returned = false;
  const controller = new AbortController();
  const seen: string[] = [];
  const source: AsyncIterable<ChainRecordInput> = {
    async *[Symbol.asyncIterator]() {
      try {
        requested += 1;
        yield inputRows[0];
        requested += 1;
        yield inputRows[1];
      } finally {
        returned = true;
      }
    },
  };
  const result = await builder.appendStream(source, {
    signal: controller.signal,
    onEvidence: async (evidence: LinkEvidence) => {
      seen.push(evidence.recordId);
      controller.abort();
      await Promise.resolve();
    },
  });
  assert.equal(result.ok, false);
  assert.equal(result.diagnostics[0]?.code, "OPERATION_ABORTED");
  assert.deepEqual(seen, ["one"]);
  assert.equal(requested, 1);
  assert.equal(returned, true);
});

void test("phase 7 sink failures and sync batches are transactional", async () => {
  const builder = engine.createChain(chainConfig);
  const rows = records();
  const result = await builder.appendStream(
    (async function* () {
      yield rows[0];
    })(),
    {
      onEvidence: () => {
        throw new Error("sink");
      },
    },
  );
  assert.equal(result.ok, false);
  assert.equal(result.diagnostics[0]?.code, "OUTPUT_SINK_FAILED");
  assert.throws(() => builder.snapshot());

  const batch = engine.createChain(chainConfig).appendAll([rows[0]]);
  assert.equal(batch.ok, true);
  if (batch.ok) assert.equal(batch.value.count, 1);
});

void test("phase 7 verifyStream matches sync verification and never emits a final summary after abort", async () => {
  const evidence = createChainEvidence();
  const verifyInput = {
    ...chainConfig,
    mode: "complete" as const,
    expectedCount: 2,
    expectedFinalLinkDigest: evidence[1]?.linkDigest ?? "",
  };
  const recordsToVerify: readonly VerifyChainRecord[] = Object.freeze([
    Object.freeze({ payload: { value: 1 }, evidence: evidence[0] }),
    Object.freeze({ payload: { value: 2 }, evidence: evidence[1] }),
  ]);
  const firstToVerify = recordsToVerify[0];
  const secondToVerify = recordsToVerify[1];
  if (firstToVerify === undefined || secondToVerify === undefined)
    throw new Error("missing test record");
  const sync = engine.verifyChain({ ...verifyInput, records: recordsToVerify });
  const streamed = await engine.verifyStream({
    ...verifyInput,
    records: (async function* () {
      yield firstToVerify;
      yield secondToVerify;
    })(),
  });
  assert.equal(sync.status, "valid");
  assert.deepEqual(streamed, sync);

  const controller = new AbortController();
  let emitted = 0;
  const aborted = await engine.verifyStream({
    ...verifyInput,
    signal: controller.signal,
    records: (async function* () {
      try {
        controller.abort();
        yield firstToVerify;
        emitted += 1;
        yield secondToVerify;
      } finally {
        controller.abort();
      }
    })(),
  });
  assert.equal(aborted.status, "aborted");
  assert.equal(emitted, 0);
});

void test("phase 8 public engine validates configuration, adapts profiles, observes, and verifies records", () => {
  const events: string[] = [];
  const observedEngine = createEngine({
    onEvent: (event: EngineEvent) => {
      events.push(event.name);
      if (event.name === "diagnostic.emitted") throw new Error("observer");
    },
  });
  const record = observedEngine.hashRecord({
    contextId: "ctx",
    recordId: "public-record",
    profile: { id: "dev.noeos.jcs", version: "1.0.0" },
    algorithm: "sha-256",
    payload: { value: 1 },
  });
  assert.equal(record.ok, true);
  if (!record.ok) throw new Error("public record missing");
  assert.deepEqual(
    observedEngine.verifyRecord({ payload: { value: 1 }, evidence: record.value }).status,
    "valid",
  );
  assert.equal(observedEngine.verifyRecord({ payload: {}, evidence: {} }).status, "invalid");
  assert.equal(observedEngine.digestEvidence(record.value).ok, true);
  assert.deepEqual(events, ["operation.started", "operation.completed"]);

  const customProfile = {
    id: "com.example.profile",
    version: "1.0.0",
    inputKind: "json" as const,
    manifest: {
      name: "com.example.profile",
      version: "1.0.0",
      vectorSha256: "a".repeat(64),
      limits: {
        maxPayloadBytes: 1,
        maxJsonDepth: 1,
        maxObjectProperties: 1,
        maxArrayElements: 1,
        maxStringBytes: 1,
        maxNdjsonLineBytes: 1,
        maxDiagnostics: 1,
        maxFullRecords: 1,
      },
      license: "Apache-2.0",
    },
    validate(input: unknown) {
      return { ok: true as const, value: input, diagnostics: [] };
    },
    normalize(
      input: unknown,
      sink: { write(value: Uint8Array): void; readonly byteLength: number },
    ) {
      sink.write(new TextEncoder().encode(JSON.stringify(input)));
      return { ok: true as const, value: { byteLength: sink.byteLength }, diagnostics: [] };
    },
  };
  const customEngine = createEngine({ profiles: [customProfile] });
  assert.equal(
    customEngine.hashRecord({
      contextId: "ctx",
      recordId: "custom",
      profile: { id: customProfile.id, version: customProfile.version },
      algorithm: "sha-256",
      payload: { value: 1 },
    }).ok,
    true,
  );

  assert.throws(() => createEngine({ limits: { maxPayloadBytes: 0 } }), {
    code: "INPUT_LIMIT_EXCEEDED",
  });
  assert.throws(() => createEngine({ rules: [{}] }), { code: "RULE_VERSION_CONFLICT" });
  assert.throws(() => createEngine({ profiles: [customProfile, customProfile] }), {
    code: "PROFILE_VERSION_CONFLICT",
  });
  assert.throws(
    () =>
      createEngine({
        profiles: [
          { ...customProfile, manifest: { ...customProfile.manifest, vectorSha256: "bad" } },
        ],
      }),
    { code: "INPUT_TYPE_INVALID" },
  );
});
