// SPDX-License-Identifier: Apache-2.0

/* The contract suite executes the freshly built JavaScript artifacts. The
 * package emits declarations in a separate dist/types tree, so this boundary
 * intentionally relies on the runtime module's checked contract tests. */
/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access */

import assert from "node:assert/strict";
import { test } from "node:test";

import {
  ChainBuilder,
  ChainLifecycleError,
} from "../../packages/engine/dist/esm/chains/chain-builder.js";
import { verifyChain } from "../../packages/engine/dist/esm/chains/verify-chain.js";
import { DEFAULT_LIMITS } from "../../packages/engine/dist/esm/domain/limits.js";
import { digestEvidence } from "../../packages/engine/dist/esm/evidence/digest-evidence.js";
import {
  parseChainSummaryEvidence,
  parseEvidence,
  parseEvidenceText,
  parseLinkEvidence,
  parseRecordEvidence,
} from "../../packages/engine/dist/esm/evidence/evidence-parser.js";
import { ProfileRegistry } from "../../packages/engine/dist/esm/normalization/profile-registry.js";
import {
  computeRecord,
  hashRecord,
  verifyComputedRecord,
} from "../../packages/engine/dist/esm/records/record-service.js";
import { RuleSet } from "../../packages/engine/dist/esm/rules/rule-set.js";
import type { ChainBuilder as ChainBuilderType } from "../../packages/engine/src/chains/chain-builder.js";
import type {
  ChainSummaryEvidence,
  LinkEvidence,
  RecordEvidence,
} from "../../packages/engine/src/domain/evidence.js";
import type { OperationResult } from "../../packages/engine/src/domain/operation-result.js";

const profiles = new ProfileRegistry();
const recordOptions = Object.freeze({ limits: DEFAULT_LIMITS, profiles });
const builderOptions = Object.freeze({ limits: DEFAULT_LIMITS, profiles });

void test("phase 5 produces stable record evidence under all protocol algorithms", () => {
  for (const algorithm of ["sha-256", "sha-384", "sha-512"] as const) {
    const result = hashRecord(
      {
        contextId: "ctx",
        recordId: `record-${algorithm}`,
        payload: { b: 2, a: 1 },
        profile: { id: "dev.noeos.jcs", version: "1.0.0" },
        algorithm,
      },
      recordOptions,
    );
    const evidence = must<RecordEvidence>(result);
    assert.equal(evidence.$schema, "urn:noeos:verification-engine:record-evidence:1");
    assert.equal(
      evidence.contentDigest.length,
      algorithm === "sha-256" ? 64 : algorithm === "sha-384" ? 96 : 128,
    );
    assert.equal(evidence.recordDigest.length, evidence.contentDigest.length);
    assert.ok(parseRecordEvidence(evidence, DEFAULT_LIMITS).ok);
    assert.ok(verifyComputedRecord(evidence, { a: 1, b: 2 }, recordOptions).ok);
    assert.equal(
      code(verifyComputedRecord(evidence, { a: 1, b: 3 }, recordOptions)),
      "CONTENT_DIGEST_MISMATCH",
    );
  }
});

void test("phase 5 rejects ambiguous record inputs before hashing", () => {
  assert.equal(code(hashRecord({}, recordOptions)), "INPUT_TYPE_INVALID");
  assert.equal(
    code(
      hashRecord(
        {
          contextId: "ctx",
          recordId: "record",
          payload: new Uint8Array([1]),
          profile: { id: "dev.noeos.jcs", version: "1.0.0" },
          algorithm: "sha-256",
        },
        recordOptions,
      ),
    ),
    "PROFILE_INPUT_KIND_MISMATCH",
  );
  assert.equal(
    code(
      hashRecord(
        {
          contextId: "ctx",
          recordId: "record",
          payload: { value: 1 },
          profile: { id: "dev.noeos.raw-bytes", version: "1.0.0" },
          algorithm: "sha-256",
        },
        recordOptions,
      ),
    ),
    "PROFILE_INPUT_KIND_MISMATCH",
  );
  assert.equal(
    code(
      hashRecord(
        {
          contextId: "ctx",
          recordId: "record",
          payload: {},
          profile: { id: "unknown.profile", version: "1.0.0" },
          algorithm: "sha-256",
        },
        recordOptions,
      ),
    ),
    "PROFILE_UNKNOWN",
  );
});

void test("phase 5 builder creates genesis, commits transactionally and summarizes", () => {
  const builder = must<ChainBuilderType>(createBuilder());
  const first = must<LinkEvidence>(
    builder.append({
      recordId: "record-1",
      payload: { sequence: 1 },
      position: 0,
      previous: { kind: "none" },
    }),
  );
  assert.equal(first.position, 0);
  assert.deepEqual(first.previous, { kind: "none" });
  assert.equal(builder.snapshot().nextPosition, 1);
  assert.equal(
    code(
      builder.append({
        recordId: "record-invalid",
        payload: {},
        position: 3,
        previous: { kind: "none" },
      }),
    ),
    "POSITION_MISMATCH",
  );
  assert.equal(builder.snapshot().nextPosition, 1);
  const second = must<LinkEvidence>(
    builder.append({
      recordId: "record-2",
      payload: { sequence: 2 },
      position: 1,
      previous: { kind: "digest", value: first.linkDigest },
    }),
  );
  const summary = must<ChainSummaryEvidence>(builder.finalize());
  assert.equal(summary.status, "valid");
  assert.equal(summary.count, 2);
  assert.equal(summary.firstLinkDigest, first.linkDigest);
  assert.equal(summary.finalLinkDigest, second.linkDigest);
  assert.equal(summary.boundaries.start, "verified");
  assert.throws(
    () =>
      builder.append({
        recordId: "late",
        payload: {},
        position: 2,
        previous: { kind: "digest", value: second.linkDigest },
      }),
    ChainLifecycleError,
  );
});

void test("phase 5 builder enforces genesis, previous digest, empty chain and abort lifecycle", () => {
  const builder = must<ChainBuilderType>(createBuilder());
  assert.equal(
    code(
      builder.append({
        recordId: "record",
        payload: {},
        position: 0,
        previous: { kind: "digest", value: "00".repeat(32) },
      }),
    ),
    "PREVIOUS_LINK_MISMATCH",
  );
  assert.equal(code(builder.finalize()), "EMPTY_CHAIN_FORBIDDEN");
  builder.abort();
  assert.throws(
    () => builder.snapshot(),
    (error: unknown) => error instanceof ChainLifecycleError && error.code === "BUILDER_FAILED",
  );
  const empty = must<ChainBuilderType>(
    ChainBuilder.create(
      {
        contextId: "ctx",
        sequenceId: "empty",
        profile: { id: "dev.noeos.jcs", version: "1.0.0" },
        algorithm: "sha-256",
        allowEmpty: true,
      },
      builderOptions,
    ),
  );
  assert.equal(must<ChainSummaryEvidence>(empty.finalize()).count, 0);
});

void test("phase 5 duplicate policies distinguish identity, content, links and limits", () => {
  const full = must<ChainBuilderType>(
    createBuilder({ duplicatePolicy: { kind: "full", maxRecords: 2 } }),
  );
  const first = must<LinkEvidence>(
    full.append({
      recordId: "one",
      payload: { same: true },
      position: 0,
      previous: { kind: "none" },
    }),
  );
  assert.equal(
    code(
      full.append({
        recordId: "one",
        payload: { other: true },
        position: 1,
        previous: { kind: "digest", value: first.linkDigest },
      }),
    ),
    "RECORD_ID_DUPLICATE",
  );
  assert.equal(
    must<LinkEvidence>(
      full.append({
        recordId: "two",
        payload: { same: true },
        position: 1,
        previous: { kind: "digest", value: first.linkDigest },
      }),
    ).recordId,
    "two",
  );
  const limited = must<ChainBuilderType>(
    createBuilder({ duplicatePolicy: { kind: "full", maxRecords: 1 } }),
  );
  const only = must<LinkEvidence>(
    limited.append({ recordId: "one", payload: {}, position: 0, previous: { kind: "none" } }),
  );
  assert.equal(
    code(
      limited.append({
        recordId: "two",
        payload: {},
        position: 1,
        previous: { kind: "digest", value: only.linkDigest },
      }),
    ),
    "RESOURCE_BUDGET_EXCEEDED",
  );
  const window = must<ChainBuilderType>(
    createBuilder({ duplicatePolicy: { kind: "window", size: 1 } }),
  );
  const w1 = must<LinkEvidence>(
    window.append({ recordId: "one", payload: {}, position: 0, previous: { kind: "none" } }),
  );
  const w2 = must<LinkEvidence>(
    window.append({
      recordId: "two",
      payload: {},
      position: 1,
      previous: { kind: "digest", value: w1.linkDigest },
    }),
  );
  assert.equal(
    must<LinkEvidence>(
      window.append({
        recordId: "one",
        payload: {},
        position: 2,
        previous: { kind: "digest", value: w2.linkDigest },
      }),
    ).recordId,
    "one",
  );
});

void test("phase 5 complete, fragment and internal verification remain semantically distinct", () => {
  const chain = createTwoLinkChain();
  const complete = verifyChain(
    verificationInput("complete", chain, {
      expectedCount: 2,
      expectedFinalLinkDigest: chain.second.linkDigest,
    }),
    builderOptions,
  );
  assert.equal(complete.status, "valid");
  assert.equal(complete.boundaries.start, "verified");
  assert.equal(complete.boundaries.end, "verified");
  const missingFinal = verifyChain(
    verificationInput("complete", chain, { expectedCount: 2 }),
    builderOptions,
  );
  assert.equal(missingFinal.status, "indeterminate");
  assert.ok(
    missingFinal.diagnostics.some(
      (diagnostic: { readonly code: string }) => diagnostic.code === "BOUNDARY_UNVERIFIED",
    ),
  );
  const fragment = verifyChain(
    verificationInput(
      "fragment",
      { first: chain.second, second: undefined },
      {
        startPosition: 1,
        expectedPrevious: { kind: "digest", value: chain.first.linkDigest },
        expectedFinalLinkDigest: chain.second.linkDigest,
      },
    ),
    builderOptions,
  );
  assert.equal(fragment.status, "valid");
  assert.equal(fragment.boundaries.start, "verified");
  const internal = verifyChain(verificationInput("internal", chain), builderOptions);
  assert.equal(internal.status, "valid");
  assert.deepEqual(internal.boundaries, { start: "not-applicable", end: "not-applicable" });
});

void test("phase 5 detects payload, configuration, order and final alterations", () => {
  const chain = createTwoLinkChain();
  const payloadChanged = verifyChain(
    {
      contextId: "ctx",
      sequenceId: "sequence",
      profile: { id: "dev.noeos.jcs", version: "1.0.0" },
      algorithm: "sha-256",
      mode: "complete",
      expectedCount: 2,
      expectedFinalLinkDigest: chain.second.linkDigest,
      records: [
        { payload: { sequence: 99 }, evidence: chain.first },
        { payload: { sequence: 2 }, evidence: chain.second },
      ],
    },
    builderOptions,
  );
  assert.equal(payloadChanged.status, "invalid");
  assert.ok(
    payloadChanged.diagnostics.some(
      (diagnostic: { readonly code: string }) => diagnostic.code === "CONTENT_DIGEST_MISMATCH",
    ),
  );
  const reordered = verifyChain(
    verificationInput("internal", { first: chain.second, second: chain.first }),
    builderOptions,
  );
  assert.equal(reordered.status, "invalid");
  assert.ok(
    reordered.diagnostics.some(
      (diagnostic: { readonly code: string }) => diagnostic.code === "POSITION_MISMATCH",
    ),
  );
  const finalChanged = verifyChain(
    verificationInput("complete", chain, {
      expectedCount: 2,
      expectedFinalLinkDigest: "00".repeat(32),
    }),
    builderOptions,
  );
  assert.equal(finalChanged.status, "invalid");
  assert.ok(
    finalChanged.diagnostics.some(
      (diagnostic: { readonly code: string }) => diagnostic.code === "FINAL_LINK_MISMATCH",
    ),
  );
});

void test("phase 6 rules are ordered, isolated and captured", () => {
  const seen: string[] = [];
  const rules = [
    {
      id: "z.rule",
      version: "1.0.0",
      phases: ["record"],
      defaultSeverity: "warning",
      evaluate: () => {
        seen.push("z");
        return [{ messageKey: "z.rule.notice" }];
      },
    },
    {
      id: "a.rule",
      version: "1.0.0",
      phases: ["record"],
      defaultSeverity: "warning",
      evaluate: () => {
        seen.push("a");
        return [{ messageKey: "a.rule.notice" }];
      },
    },
  ];
  const set = must<RuleSet>(RuleSet.create(rules, DEFAULT_LIMITS));
  const result = computeRecord(
    {
      contextId: "ctx",
      recordId: "rule-record",
      payload: { value: 1 },
      profile: { id: "dev.noeos.jcs", version: "1.0.0" },
      algorithm: "sha-256",
    },
    { ...recordOptions, rules: set },
  );
  assert.ok(result.ok);
  assert.deepEqual(seen, ["a", "z"]);
  if (result.ok) {
    assert.equal(
      result.diagnostics.filter(
        (diagnostic: { readonly code: string }) => diagnostic.code === "RULE_FAILED",
      ).length,
      2,
    );
    assert.equal(result.diagnostics[0]?.details?.["rule-id"], "a.rule");
  }
  const throwing = must<RuleSet>(
    RuleSet.create(
      [
        {
          id: "throw.rule",
          version: "1.0.0",
          phases: ["input"],
          defaultSeverity: "error",
          evaluate: () => {
            throw new Error("private payload");
          },
        },
      ],
      DEFAULT_LIMITS,
    ),
  );
  assert.equal(
    code(
      hashRecord(
        {
          contextId: "ctx",
          recordId: "throw",
          payload: {},
          profile: { id: "dev.noeos.jcs", version: "1.0.0" },
          algorithm: "sha-256",
        },
        { ...recordOptions, rules: throwing },
      ),
    ),
    "RULE_EXECUTION_FAILED",
  );
});

void test("phase 6 parses strict evidence and produces deterministic evidence digests", () => {
  const record = must<RecordEvidence>(
    hashRecord(
      {
        contextId: "ctx",
        recordId: "record",
        payload: { a: 1 },
        profile: { id: "dev.noeos.jcs", version: "1.0.0" },
        algorithm: "sha-256",
      },
      recordOptions,
    ),
  );
  const first = digestEvidence(record, DEFAULT_LIMITS);
  const second = digestEvidence(JSON.parse(JSON.stringify(record)), DEFAULT_LIMITS);
  assert.equal(must<{ toHex(): string }>(first).toHex(), must<{ toHex(): string }>(second).toHex());
  assert.ok(parseEvidenceText(JSON.stringify(record), DEFAULT_LIMITS).ok);
  assert.equal(code(parseEvidence({ ...record, extra: true }, DEFAULT_LIMITS)), "EVIDENCE_INVALID");
  assert.equal(
    code(
      parseEvidence({ $schema: "urn:noeos:verification-engine:record-evidence:2" }, DEFAULT_LIMITS),
    ),
    "EVIDENCE_SCHEMA_UNKNOWN",
  );
  const summary = must<ChainSummaryEvidence>(
    must<ChainBuilderType>(createBuilder({ allowEmpty: true })).finalize(),
  );
  assert.ok(parseChainSummaryEvidence(summary, DEFAULT_LIMITS).ok);
  const malformedLink = {
    ...createTwoLinkChain().first,
    previous: { kind: "digest", value: "00".repeat(32) },
  };
  assert.equal(code(parseLinkEvidence(malformedLink, DEFAULT_LIMITS)), "EVIDENCE_INVALID");
});

function createBuilder(extra: Record<string, unknown> = {}): OperationResult<ChainBuilderType> {
  return ChainBuilder.create(
    {
      contextId: "ctx",
      sequenceId: "sequence",
      profile: { id: "dev.noeos.jcs", version: "1.0.0" },
      algorithm: "sha-256",
      ...extra,
    },
    builderOptions,
  );
}

function createTwoLinkChain(): { readonly first: LinkEvidence; readonly second: LinkEvidence } {
  const builder = must<ChainBuilderType>(createBuilder());
  const first = must<LinkEvidence>(
    builder.append({
      recordId: "record-1",
      payload: { sequence: 1 },
      position: 0,
      previous: { kind: "none" },
    }),
  );
  const second = must<LinkEvidence>(
    builder.append({
      recordId: "record-2",
      payload: { sequence: 2 },
      position: 1,
      previous: { kind: "digest", value: first.linkDigest },
    }),
  );
  return { first, second };
}

function verificationInput(
  mode: "complete" | "fragment" | "internal",
  links: { readonly first: LinkEvidence; readonly second: LinkEvidence | undefined },
  extra: Record<string, unknown> = {},
): Record<string, unknown> {
  const records = [
    {
      payload: links.first.recordId === "record-1" ? { sequence: 1 } : { sequence: 2 },
      evidence: links.first,
    },
    ...(links.second === undefined ? [] : [{ payload: { sequence: 2 }, evidence: links.second }]),
  ];
  return {
    contextId: "ctx",
    sequenceId: "sequence",
    profile: { id: "dev.noeos.jcs", version: "1.0.0" },
    algorithm: "sha-256",
    mode,
    records,
    ...extra,
  };
}

function must<T>(value: OperationResult<T>): T {
  if (!value.ok) throw new Error(JSON.stringify(value.diagnostics));
  return value.value;
}

function code(value: OperationResult<unknown>): string | undefined {
  return value.diagnostics[0]?.code;
}
