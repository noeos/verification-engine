// SPDX-License-Identifier: Apache-2.0

/* These tests execute freshly built artifacts; see the runtime boundary note
 * in phase56.contract.test.ts for the reason the JavaScript imports are any-typed. */
/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access */

import assert from "node:assert/strict";
import { test } from "node:test";

import { ChainBuilder } from "../../packages/engine/dist/esm/chains/chain-builder.js";
import {
  createDuplicateDetector,
  observedLink,
} from "../../packages/engine/dist/esm/chains/duplicate-detector.js";
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
import { jcsProfile } from "../../packages/engine/dist/esm/normalization/jcs-profile.js";
import {
  computeRecord,
  hashRecord,
  validateProfile,
  validateRecordInput,
  verifyComputedRecord,
} from "../../packages/engine/dist/esm/records/record-service.js";
import { createReadonlyByteView, RuleSet } from "../../packages/engine/dist/esm/rules/rule-set.js";
import { createDiagnostic } from "../../packages/engine/dist/esm/validation/diagnostic-collector.js";
import { parseJsonText } from "../../packages/engine/dist/esm/validation/json-text-parser.js";
import type { LinkEvidence, RecordEvidence } from "../../packages/engine/src/domain/evidence.js";
import type { OperationResult } from "../../packages/engine/src/domain/operation-result.js";

const profiles = new ProfileRegistry();
const options = Object.freeze({ limits: DEFAULT_LIMITS, profiles });

void test("phase 5 rejects every malformed verification configuration without throwing", () => {
  const base = verificationBase([]);
  const malformed = [
    undefined,
    null,
    [],
    { ...base, unknown: true },
    { ...base, contextId: "" },
    { ...base, sequenceId: "" },
    { ...base, profile: undefined },
    { ...base, algorithm: "md5" },
    { ...base, mode: "unknown" },
    { ...base, records: {} },
    { ...base, allowEmpty: "yes" },
    { ...base, expectedCount: -1 },
    { ...base, expectedCount: Number.NaN },
    { ...base, expectedFinalLinkDigest: "not-a-digest" },
    { ...base, expectedPrevious: { kind: "digest", value: "00" } },
    { ...base, expectedPrevious: { kind: "unknown" } },
    { ...base, expectedPrevious: null },
    { ...base, startPosition: -1 },
    { ...base, startPosition: Number.POSITIVE_INFINITY },
    { ...base, duplicatePolicy: { kind: "window", size: 0 } },
    { ...base, duplicatePolicy: { kind: "window", size: 1, extra: true } },
    { ...base, duplicatePolicy: { kind: "full", size: 1 } },
    { ...base, duplicatePolicy: { kind: "full", maxRecords: 0 } },
    { ...base, duplicatePolicy: { kind: "external", index: {} } },
    { ...base, duplicatePolicy: { kind: "external", index: { observe: 1 } } },
  ];
  for (const input of malformed)
    assert.equal(code(verifyChain(input, options)), "INPUT_TYPE_INVALID");

  const missing = { ...base };
  delete missing["contextId"];
  assert.equal(code(verifyChain(missing, options)), "INPUT_TYPE_INVALID");
  assert.equal(code(verifyChain({ ...base, rules: {} }, options)), "RULE_VERSION_CONFLICT");
  assert.equal(
    code(verifyChain({ ...base, mode: "internal", records: "not-an-array" }, options)),
    "INPUT_TYPE_INVALID",
  );
  assert.equal(
    code(verifyChain({ ...base, mode: "internal", records: [], allowEmpty: 1 }, options)),
    "INPUT_TYPE_INVALID",
  );
  assert.equal(
    verifyChain({ ...base, duplicatePolicy: { kind: "window", size: 1 } }, options).status,
    "invalid",
  );
  assert.equal(
    verifyChain({ ...base, duplicatePolicy: { kind: "full", maxRecords: 1 } }, options).status,
    "invalid",
  );

  const builderBase: Record<string, unknown> = {
    contextId: "ctx",
    sequenceId: "sequence",
    profile: profile(),
    algorithm: "sha-256",
  };
  const malformedBuilderConfigs: unknown[] = [
    undefined,
    null,
    [],
    { ...builderBase, unknown: true },
    { ...builderBase, contextId: "" },
    { ...builderBase, sequenceId: "" },
    { ...builderBase, profile: {} },
    { ...builderBase, algorithm: "md5" },
    { ...builderBase, allowEmpty: "yes" },
    { ...builderBase, duplicatePolicy: { kind: "window", size: 0 } },
    { ...builderBase, duplicatePolicy: { kind: "full", maxRecords: 0 } },
    { ...builderBase, duplicatePolicy: { kind: "external", index: {} } },
    { ...builderBase, rules: {} },
    { sequenceId: "sequence", profile: profile(), algorithm: "sha-256" },
    { ...builderBase, duplicatePolicy: { kind: "external", index: [] } },
    { ...builderBase, duplicatePolicy: { kind: "unknown" } },
  ];
  for (const input of malformedBuilderConfigs)
    assert.equal(ChainBuilder.create(input, options).ok, false);
  assert.equal(
    code(
      ChainBuilder.create(
        {
          ...builderBase,
          rules: [
            { id: "bad", version: "1", phases: [], defaultSeverity: "error", evaluate: () => [] },
          ],
        },
        options,
      ),
    ),
    "RULE_VERSION_CONFLICT",
  );

  const builder = must(ChainBuilder.create(builderBase, options));
  assert.equal(
    ChainBuilder.create({ ...builderBase, duplicatePolicy: { kind: "none" } }, options).ok,
    true,
  );
  const malformedAppends: unknown[] = [
    undefined,
    null,
    {},
    { recordId: "", payload: {}, position: 0, previous: { kind: "none" } },
    { recordId: "record", payload: {}, position: -1, previous: { kind: "none" } },
    { recordId: "record", payload: {}, position: 0, previous: {} },
    { recordId: "record", payload: {}, position: 0, previous: null },
    { recordId: "record", payload: {}, position: 0, previous: { kind: "digest", value: "00" } },
  ];
  for (const input of malformedAppends) assert.equal(builder.append(input).ok, false);
  assert.equal(
    code(
      builder.append({ recordId: "record", payload: {}, position: 2, previous: { kind: "none" } }),
    ),
    "POSITION_MISMATCH",
  );

  const externalBuilder = must(
    ChainBuilder.create(
      {
        ...builderBase,
        duplicatePolicy: {
          kind: "external",
          index: { observe: () => ({ ok: true, value: [], diagnostics: [] }) },
        },
      },
      options,
    ),
  );
  assert.equal(
    externalBuilder.append({
      recordId: "external",
      payload: {},
      position: 0,
      previous: { kind: "none" },
    }).ok,
    true,
  );
  const inputRule = must(
    ChainBuilder.create(
      {
        ...builderBase,
        rules: [
          {
            id: "input.error",
            version: "1.0.0",
            phases: ["input"],
            defaultSeverity: "error",
            evaluate: () => [{ messageKey: "input.error" }],
          },
        ],
      },
      options,
    ),
  );
  assert.equal(
    code(
      inputRule.append({ recordId: "input", payload: {}, position: 0, previous: { kind: "none" } }),
    ),
    "RULE_FAILED",
  );
  const linkRule = must(
    ChainBuilder.create(
      {
        ...builderBase,
        rules: [
          {
            id: "link.error",
            version: "1.0.0",
            phases: ["link"],
            defaultSeverity: "error",
            evaluate: () => [{ messageKey: "link.error" }],
          },
        ],
      },
      options,
    ),
  );
  assert.equal(
    code(
      linkRule.append({ recordId: "link", payload: {}, position: 0, previous: { kind: "none" } }),
    ),
    "RULE_FAILED",
  );
  const infoRule = must(
    ChainBuilder.create(
      {
        ...builderBase,
        rules: [
          {
            id: "info.rule",
            version: "1.0.0",
            phases: ["link"],
            defaultSeverity: "info",
            evaluate: () => [{ messageKey: "info.rule" }],
          },
        ],
      },
      options,
    ),
  );
  assert.equal(
    infoRule.append({ recordId: "info", payload: {}, position: 0, previous: { kind: "none" } }).ok,
    true,
  );
  assert.equal(infoRule.finalize().ok, true);
  const finalized = must(ChainBuilder.create(builderBase, options));
  must(
    finalized.append({ recordId: "final", payload: {}, position: 0, previous: { kind: "none" } }),
  );
  must(finalized.finalize());
  finalized.abort();
  assert.equal(finalized.snapshot().count, 1);
  assert.throws(
    () => {
      finalized.append({ recordId: "late", payload: {}, position: 1, previous: { kind: "none" } });
    },
    { name: "ChainLifecycleError" },
  );
  const chainRule = must(
    ChainBuilder.create(
      {
        ...builderBase,
        allowEmpty: true,
        rules: [
          {
            id: "chain.error",
            version: "1.0.0",
            phases: ["chain"],
            defaultSeverity: "error",
            evaluate: () => [{ messageKey: "chain.error" }],
          },
        ],
      },
      options,
    ),
  );
  assert.equal(code(chainRule.finalize()), "RULE_FAILED");
  chainRule.abort();
  chainRule.abort();
  assert.throws(() => {
    chainRule.append({ recordId: "late", payload: {}, position: 0, previous: { kind: "none" } });
  });
  const throwingCommit = must(ChainBuilder.create(builderBase, options));
  Reflect.set(throwingCommit, "duplicates", {
    inspect: () => ({ ok: true, value: [], diagnostics: [] }),
    commit: () => {
      throw new Error("duplicate commit failure");
    },
  });
  assert.equal(
    code(
      throwingCommit.append({
        recordId: "commit-failure",
        payload: {},
        position: 0,
        previous: { kind: "none" },
      }),
    ),
    "INTERNAL_INVARIANT_BROKEN",
  );
  assert.throws(() => {
    throwingCommit.append({
      recordId: "after-failure",
      payload: {},
      position: 0,
      previous: { kind: "none" },
    });
  });
  const brokenSummary = must(ChainBuilder.create(builderBase, options));
  must(
    brokenSummary.append({
      recordId: "broken-summary",
      payload: {},
      position: 0,
      previous: { kind: "none" },
    }),
  );
  Reflect.set(brokenSummary, "firstDigest", undefined);
  assert.throws(() => {
    brokenSummary.finalize();
  });
});

void test("phase 5 treats omitted complete boundaries as indeterminate and detects all boundary variants", () => {
  const chain = makeChain();
  const complete = {
    ...verificationBase([
      { payload: { value: 1 }, evidence: chain.first },
      { payload: { value: 2 }, evidence: chain.second },
    ]),
    mode: "complete",
  };
  const missingCount = verifyChain(
    { ...complete, expectedFinalLinkDigest: chain.second.linkDigest },
    options,
  );
  assert.equal(missingCount.status, "indeterminate");
  assert.equal(missingCount.boundaries.end, "unverified");
  assert.ok(
    missingCount.diagnostics.some((item: { code: string }) => item.code === "BOUNDARY_UNVERIFIED"),
  );

  const wrongCount = verifyChain(
    { ...complete, expectedCount: 1, expectedFinalLinkDigest: chain.second.linkDigest },
    options,
  );
  assert.equal(wrongCount.status, "invalid");
  assert.ok(
    wrongCount.diagnostics.some(
      (item: { code: string }) => item.code === "EXPECTED_COUNT_MISMATCH",
    ),
  );

  const noRecords = verifyChain(
    { ...verificationBase([]), mode: "complete", allowEmpty: true, expectedCount: 0 },
    options,
  );
  assert.equal(noRecords.status, "indeterminate");
  assert.equal(noRecords.boundaries.start, "unverified");
  assert.equal(noRecords.boundaries.end, "unverified");

  const fragment = verifyChain(
    {
      ...verificationBase([{ payload: { value: 2 }, evidence: chain.second }]),
      mode: "fragment",
    },
    options,
  );
  assert.equal(fragment.status, "valid");
  assert.equal(fragment.boundaries.start, "unverified");
  assert.equal(fragment.boundaries.end, "unverified");

  const metadataMismatch = verifyChain(
    {
      ...verificationBase([
        { payload: { value: 1 }, evidence: { ...chain.first, sequenceId: "other" } },
      ]),
      mode: "internal",
    },
    options,
  );
  assert.equal(metadataMismatch.status, "invalid");
  assert.ok(
    metadataMismatch.diagnostics.some(
      (item: { code: string }) => item.code === "CHAIN_CONFIGURATION_MISMATCH",
    ),
  );
  for (const evidenceChange of [
    { contextId: "other" },
    { sequenceId: "other" },
    { profile: { id: "other", version: "1.0.0" } },
    { profile: { id: "dev.noeos.jcs", version: "2.0.0" } },
  ]) {
    const changed = verifyChain(
      {
        ...verificationBase([
          { payload: { value: 1 }, evidence: { ...chain.first, ...evidenceChange } },
        ]),
        mode: "internal",
      },
      options,
    );
    assert.ok(
      changed.diagnostics.some(
        (item: { code: string }) => item.code === "CHAIN_CONFIGURATION_MISMATCH",
      ),
    );
  }

  const invalidStart = verifyChain(
    {
      ...verificationBase([{ payload: { value: 2 }, evidence: chain.second }]),
      mode: "complete",
      expectedCount: 1,
      expectedFinalLinkDigest: chain.second.linkDigest,
    },
    options,
  );
  assert.equal(invalidStart.status, "invalid");
  assert.ok(
    invalidStart.diagnostics.some((item: { code: string }) => item.code === "POSITION_MISMATCH"),
  );

  const fragmentMismatch = verifyChain(
    {
      ...verificationBase([{ payload: { value: 2 }, evidence: chain.second }]),
      mode: "fragment",
      startPosition: 0,
      expectedPrevious: { kind: "none" },
    },
    options,
  );
  assert.ok(
    fragmentMismatch.diagnostics.some(
      (item: { code: string }) => item.code === "PREVIOUS_LINK_MISMATCH",
    ),
  );

  const badRecordDigest = verifyChain(
    {
      ...verificationBase([
        { payload: { value: 1 }, evidence: { ...chain.first, recordDigest: "00".repeat(32) } },
      ]),
      mode: "internal",
    },
    options,
  );
  assert.ok(
    badRecordDigest.diagnostics.some(
      (item: { code: string }) => item.code === "RECORD_DIGEST_MISMATCH",
    ),
  );
  const badLinkDigest = verifyChain(
    {
      ...verificationBase([
        { payload: { value: 1 }, evidence: { ...chain.first, linkDigest: "00".repeat(32) } },
      ]),
      mode: "internal",
    },
    options,
  );
  assert.ok(
    badLinkDigest.diagnostics.some(
      (item: { code: string }) => item.code === "LINK_DIGEST_MISMATCH",
    ),
  );
  const brokenPrevious = verifyChain(
    {
      ...verificationBase([
        { payload: { value: 1 }, evidence: chain.first },
        {
          payload: { value: 2 },
          evidence: { ...chain.second, previous: { kind: "digest", value: "00".repeat(32) } },
        },
      ]),
      mode: "internal",
    },
    options,
  );
  assert.ok(
    brokenPrevious.diagnostics.some(
      (item: { code: string }) => item.code === "PREVIOUS_LINK_MISMATCH",
    ),
  );

  const recordFailure = verifyChain(
    {
      ...verificationBase([{ payload: {}, evidence: chain.first }]),
      profile: { id: "dev.noeos.raw-bytes", version: "1.0.0" },
      mode: "internal",
    },
    options,
  );
  assert.equal(recordFailure.status, "invalid");
  assert.equal(recordFailure.stats.recordsVerified, 0);
  assert.equal(
    verifyChain({ ...verificationBase([]), mode: "internal" }, options).status,
    "invalid",
  );

  const malformedItem = verifyChain(
    { ...verificationBase([null, { payload: {}, evidence: {} }]), mode: "internal" },
    options,
  );
  assert.equal(malformedItem.status, "invalid");
  assert.ok(malformedItem.stats.recordsSeen === 2);
  const malformedShape = verifyChain(
    { ...verificationBase([{ payload: {} }]), mode: "internal" },
    options,
  );
  assert.equal(malformedShape.status, "invalid");
});

void test("phase 5 duplicate detectors cover none, memory, fork, window eviction and external host failures", () => {
  const chain = makeChain();
  const first = observedLink(chain.first);
  const none = createDuplicateDetector({ kind: "none" }, DEFAULT_LIMITS);
  const noneResult = none.inspect(first);
  if (!noneResult.ok) throw new Error("none detector rejected an observation");
  assert.deepEqual(noneResult.value, []);
  none.commit(first);

  const full = createDuplicateDetector({ kind: "full", maxRecords: 3 }, DEFAULT_LIMITS);
  assert.equal(full.inspect(first).ok, true);
  full.commit(first);
  const repeated = full.inspect(first);
  if (!repeated.ok) throw new Error("full detector rejected a valid observation");
  assert.ok(repeated.value.some((item: { code: string }) => item.code === "RECORD_ID_DUPLICATE"));
  const fork = observedLink({ ...chain.first, linkDigest: "ff".repeat(32) });
  const forkResult = full.inspect(fork);
  if (!forkResult.ok) throw new Error("full detector rejected a valid fork observation");
  assert.ok(forkResult.value.some((item: { code: string }) => item.code === "CHAIN_FORK"));
  full.commit(fork);
  const fullLimited = createDuplicateDetector({ kind: "full", maxRecords: 1 }, DEFAULT_LIMITS);
  fullLimited.commit(first);
  assert.equal(code(fullLimited.inspect(observedLink(chain.second))), "RESOURCE_BUDGET_EXCEEDED");

  const window = createDuplicateDetector({ kind: "window", size: 2 }, DEFAULT_LIMITS);
  window.commit(first);
  window.commit(fork);
  const third = observedLink({ ...chain.second, linkDigest: "ee".repeat(32) });
  window.commit(third);
  assert.equal(window.inspect(first).ok, true);
  assert.equal(window.inspect(fork).ok, true);
  const repeatedWindow = createDuplicateDetector({ kind: "window", size: 2 }, DEFAULT_LIMITS);
  repeatedWindow.commit(first);
  repeatedWindow.commit(first);
  repeatedWindow.commit(third);
  assert.equal(repeatedWindow.inspect(first).ok, true);

  const validExternal = createDuplicateDetector(
    {
      kind: "external",
      index: {
        observe: (batch: readonly unknown[]) => ({ ok: true, value: batch, diagnostics: [] }),
      },
    },
    DEFAULT_LIMITS,
  );
  const externalResult = validExternal.inspect(first);
  assert.equal(externalResult.ok, true);
  validExternal.commit(first);
  assert.throws(() => {
    validExternal.commit(fork);
  });

  const duplicateExternal = createDuplicateDetector(
    {
      kind: "external",
      index: {
        observe: () => ({
          ok: true,
          value: [{ kind: "record-id", key: "record" }],
          diagnostics: [],
        }),
      },
    },
    DEFAULT_LIMITS,
  );
  const duplicateResult = duplicateExternal.inspect(first);
  if (!duplicateResult.ok) throw new Error("external duplicate fixture failed");
  assert.ok(
    duplicateResult.value.some((item: { code: string }) => item.code === "RECORD_ID_DUPLICATE"),
  );

  const failedExternal = createDuplicateDetector(
    {
      kind: "external",
      index: { observe: () => ({ ok: false, diagnostics: [] }) },
    },
    DEFAULT_LIMITS,
  );
  assert.equal(failedExternal.inspect(first).ok, false);
  const malformedExternal = createDuplicateDetector(
    {
      kind: "external",
      index: { observe: () => ({ ok: true, value: {}, diagnostics: [] }) },
    },
    DEFAULT_LIMITS,
  );
  assert.equal(malformedExternal.inspect(first).ok, false);
  const throwingExternal = createDuplicateDetector(
    {
      kind: "external",
      index: {
        observe: () => {
          throw new Error("private host state");
        },
      },
    },
    DEFAULT_LIMITS,
  );
  assert.equal(throwingExternal.inspect(first).ok, false);
  const malformedResultExternal = createDuplicateDetector(
    {
      kind: "external",
      index: { observe: () => 42 },
    },
    DEFAULT_LIMITS,
  );
  assert.equal(malformedResultExternal.inspect(first).ok, false);
  const malformedObservationExternal = createDuplicateDetector(
    {
      kind: "external",
      index: {
        observe: () => ({
          ok: true,
          value: [
            null,
            { kind: "bad", key: "x" },
            { kind: "record-id", key: 1 },
            { kind: "record-id", key: "x", value: 1 },
          ],
          diagnostics: [],
        }),
      },
    },
    DEFAULT_LIMITS,
  );
  assert.equal(malformedObservationExternal.inspect(first).ok, false);
  for (const invalidValue of [
    null,
    {},
    { ok: "yes", diagnostics: [] },
    { ok: true, diagnostics: "bad" },
  ]) {
    const detector = createDuplicateDetector(
      { kind: "external", index: { observe: () => invalidValue } },
      DEFAULT_LIMITS,
    );
    assert.equal(detector.inspect(first).ok, false);
  }
  for (const invalidObservation of [
    null,
    { kind: "bad", key: "x" },
    { kind: "record-id", key: 1 },
    { kind: "record-id", key: "x", value: 1 },
  ]) {
    const detector = createDuplicateDetector(
      { kind: "external", index: { observe: () => [invalidObservation] } },
      DEFAULT_LIMITS,
    );
    assert.equal(detector.inspect(first).ok, false);
  }
  const incompleteResultExternal = createDuplicateDetector(
    {
      kind: "external",
      index: { observe: () => ({ ok: true }) },
    },
    DEFAULT_LIMITS,
  );
  assert.equal(incompleteResultExternal.inspect(first).ok, false);
});

void test("phase 6 RuleSet validates versions and captures every execution result shape", () => {
  const valid = {
    id: "rule.valid",
    version: "1.0.0",
    phases: ["record"],
    defaultSeverity: "warning",
    evaluate: () => [
      { messageKey: "rule.notice", path: "/field", severity: "info", details: { count: 1 } },
    ],
  };
  const sorted = must(
    RuleSet.create(
      [
        { ...valid, id: "z.rule" },
        { ...valid, id: "a.rule" },
      ],
      DEFAULT_LIMITS,
    ),
  );
  const diagnostics = sorted.evaluate(
    { phase: "record", recordId: "record", position: 4 },
    DEFAULT_LIMITS,
  );
  assert.equal(diagnostics[0]?.code, "RULE_FAILED");
  assert.equal(diagnostics[0]?.severity, "info");

  const invalidCandidates = [
    undefined,
    {},
    { ...valid, id: "bad id" },
    { ...valid, version: "1" },
    { ...valid, phases: "record" },
    { ...valid, defaultSeverity: "bad" },
    { ...valid, evaluate: 1 },
    { ...valid, phases: [] },
    { ...valid, phases: ["bad"] },
    { ...valid, phases: ["record", "record"] },
  ];
  for (const candidate of invalidCandidates)
    assert.equal(code(RuleSet.create([candidate], DEFAULT_LIMITS)), "RULE_VERSION_CONFLICT");
  assert.equal(code(RuleSet.create([valid, valid], DEFAULT_LIMITS)), "RULE_VERSION_CONFLICT");
  assert.equal(RuleSet.create(undefined, DEFAULT_LIMITS).ok, true);
  assert.equal(code(RuleSet.create({}, DEFAULT_LIMITS)), "RULE_VERSION_CONFLICT");

  const invalidFinding = must(
    RuleSet.create(
      [
        {
          ...valid,
          id: "invalid.finding",
          evaluate: () => [
            null,
            { messageKey: 1 },
            { messageKey: "ok", extra: true },
            { messageKey: "bad.severity", severity: "fatal" },
          ],
        },
      ],
      DEFAULT_LIMITS,
    ),
  );
  const invalidResult = invalidFinding.evaluate({ phase: "record" }, DEFAULT_LIMITS);
  assert.equal(
    invalidResult.filter((item: { code: string }) => item.code === "RULE_EXECUTION_FAILED").length,
    4,
  );
  const nonArray = must(
    RuleSet.create([{ ...valid, id: "nonarray", evaluate: () => undefined }], DEFAULT_LIMITS),
  );
  assert.equal(
    nonArray.evaluate({ phase: "record" }, DEFAULT_LIMITS)[0]?.causeCode,
    "RULE_RESULT_INVALID",
  );
  const throwing = must(
    RuleSet.create(
      [
        {
          ...valid,
          id: "throws",
          evaluate: () => {
            throw new Error("payload");
          },
        },
      ],
      DEFAULT_LIMITS,
    ),
  );
  assert.equal(
    throwing.evaluate({ phase: "record" }, DEFAULT_LIMITS)[0]?.causeCode,
    "RULE_EVALUATION_FAILED",
  );
  const skipped = must(
    RuleSet.create([{ ...valid, id: "skipped", phases: ["chain"] }], DEFAULT_LIMITS),
  );
  assert.deepEqual(skipped.evaluate({ phase: "record" }, DEFAULT_LIMITS), []);
  const unsafeDetails = must(
    RuleSet.create(
      [
        {
          ...valid,
          id: "unsafe.details",
          evaluate: () => [{ messageKey: "safe", details: { "bad key": "redact" } }],
        },
      ],
      DEFAULT_LIMITS,
    ),
  );
  assert.equal(unsafeDetails.evaluate({ phase: "record" }, DEFAULT_LIMITS)[0]?.code, "RULE_FAILED");
  const invalidPath = must(
    RuleSet.create(
      [{ ...valid, id: "invalid.path", evaluate: () => [{ messageKey: "safe", path: 1 }] }],
      DEFAULT_LIMITS,
    ),
  );
  assert.equal(
    invalidPath.evaluate({ phase: "record" }, DEFAULT_LIMITS)[0]?.causeCode,
    "RULE_RESULT_INVALID",
  );
  const reservedDetails = must(
    RuleSet.create(
      [
        {
          ...valid,
          id: "reserved.details",
          evaluate: () => [{ messageKey: "safe", details: { "rule-id": "spoof" } }],
        },
      ],
      DEFAULT_LIMITS,
    ),
  );
  assert.equal(
    reservedDetails.evaluate({ phase: "record" }, DEFAULT_LIMITS)[0]?.causeCode,
    "RULE_RESULT_INVALID",
  );
  const objectDetails = must(
    RuleSet.create(
      [
        {
          ...valid,
          id: "object.details",
          evaluate: () => [{ messageKey: "safe", details: { nested: {} } }],
        },
      ],
      DEFAULT_LIMITS,
    ),
  );
  assert.equal(
    objectDetails.evaluate({ phase: "record" }, DEFAULT_LIMITS)[0]?.causeCode,
    "RULE_RESULT_INVALID",
  );
  const emptyFinding = must(
    RuleSet.create(
      [
        {
          ...valid,
          id: "empty.finding",
          phases: ["input", "normalization", "record", "link", "chain"],
          evaluate: () => [],
        },
      ],
      DEFAULT_LIMITS,
    ),
  );
  assert.deepEqual(emptyFinding.evaluate({ phase: "chain" }, DEFAULT_LIMITS), []);
  const versions = must(
    RuleSet.create(
      [
        { ...valid, id: "same.rule", version: "1.0.0" },
        { ...valid, id: "same.rule", version: "2.0.0" },
      ],
      DEFAULT_LIMITS,
    ),
  );
  assert.equal(versions.evaluate({ phase: "record" }, DEFAULT_LIMITS).length, 2);
  const bytes = createReadonlyByteView(new Uint8Array([1, 2, 3]));
  const copy = bytes.copySlice(1, 3);
  copy[0] = 99;
  assert.deepEqual([...bytes.copySlice()], [1, 2, 3]);
});

void test("phase 6 evidence parsers reject malformed records, links, summaries and text", () => {
  const chain = makeChain();
  const record = must<RecordEvidence>(
    hashRecord(
      {
        contextId: "ctx",
        recordId: "record",
        payload: { value: 1 },
        profile: profile(),
        algorithm: "sha-256",
      },
      options,
    ),
  );
  const invalidRecords = [
    null,
    { ...record, protocolVersion: 2 },
    { ...record, contextId: "" },
    { ...record, recordId: "" },
    { ...record, profile: {} },
    { ...record, algorithm: "md5" },
    { ...record, normalizedByteLength: -1 },
    { ...record, contentDigest: "00" },
    { ...record, recordDigest: "00" },
    { ...record, extra: true },
    { ...record, $schema: "wrong" },
  ];
  for (const candidate of invalidRecords)
    assert.equal(code(parseRecordEvidence(candidate, DEFAULT_LIMITS)), "EVIDENCE_INVALID");
  const inputInvalids = [
    { contextId: "", recordId: "record", payload: {}, profile: profile(), algorithm: "sha-256" },
    { contextId: "ctx", recordId: "", payload: {}, profile: profile(), algorithm: "sha-256" },
    { contextId: "ctx", recordId: "record", payload: {}, profile: {}, algorithm: "sha-256" },
    { contextId: "ctx", recordId: "record", payload: {}, profile: profile(), algorithm: "md5" },
  ];
  for (const candidate of inputInvalids)
    assert.equal(validateRecordInput(candidate, DEFAULT_LIMITS).ok, false);
  assert.equal(validateRecordInput(null, DEFAULT_LIMITS).ok, false);
  assert.equal(validateProfile(null, DEFAULT_LIMITS).ok, false);
  assert.equal(validateProfile({}, DEFAULT_LIMITS).ok, false);
  assert.equal(validateProfile({ id: "", version: "1.0.0" }, DEFAULT_LIMITS).ok, false);
  assert.equal(validateProfile({ id: "profile", version: "bad" }, DEFAULT_LIMITS).ok, false);
  assert.equal(
    code(parseEvidence({ $schema: "unknown" }, DEFAULT_LIMITS)),
    "EVIDENCE_SCHEMA_UNKNOWN",
  );
  assert.equal(code(parseEvidence(null, DEFAULT_LIMITS)), "EVIDENCE_INVALID");
  assert.equal(code(parseEvidenceText("{", DEFAULT_LIMITS)), "JSON_SYNTAX_INVALID");
  assert.ok(parseEvidenceText(JSON.stringify(record), DEFAULT_LIMITS).ok);
  assert.ok(parseEvidence(record, DEFAULT_LIMITS).ok);
  assert.ok(parseEvidence(chain.first, DEFAULT_LIMITS).ok);
  assert.ok(parseEvidence(chain.second, DEFAULT_LIMITS).ok);
  assert.equal(
    code(digestEvidence({ ...record, recordDigest: "00" }, DEFAULT_LIMITS)),
    "EVIDENCE_INVALID",
  );
  assert.equal(digestEvidence(record, { ...DEFAULT_LIMITS, maxPayloadBytes: 1 }).ok, false);
  assert.equal(
    computeRecord(
      {
        contextId: "ctx",
        recordId: "unsupported",
        payload: 1n,
        profile: profile(),
        algorithm: "sha-256",
      },
      options,
    ).ok,
    false,
  );
  assert.equal(
    verifyComputedRecord({ ...record, contentDigest: "00" }, { value: 1 }, options).ok,
    false,
  );
  assert.equal(
    verifyComputedRecord({ ...record, recordDigest: "00" }, { value: 1 }, options).ok,
    false,
  );
  const recordErrorRule = must(
    RuleSet.create(
      [
        {
          id: "record.error",
          version: "1.0.0",
          phases: ["record"],
          defaultSeverity: "error",
          evaluate: () => [{ messageKey: "record.error" }],
        },
      ],
      DEFAULT_LIMITS,
    ),
  );
  assert.equal(
    computeRecord(
      {
        contextId: "ctx",
        recordId: "record-error",
        payload: {},
        profile: profile(),
        algorithm: "sha-256",
      },
      { ...options, rules: recordErrorRule },
    ).ok,
    false,
  );
  const raw = hashRecord(
    {
      contextId: "ctx",
      recordId: "raw-record",
      payload: new Uint8Array([1, 2, 3]),
      profile: { id: "dev.noeos.raw-bytes", version: "1.0.0" },
      algorithm: "sha-256",
    },
    options,
  );
  assert.equal(raw.ok, true);
  assert.throws(() => {
    new ProfileRegistry([jcsProfile]);
  });

  const invalidLinks = [
    { ...chain.first, protocolVersion: 2 },
    { ...chain.first, sequenceId: "" },
    { ...chain.first, position: -1 },
    { ...chain.first, previous: { kind: "digest", value: "00".repeat(32) } },
    { ...chain.second, previous: { kind: "none" } },
    { ...chain.second, previous: null },
    { ...chain.second, previous: { kind: "digest", value: "00" } },
    { ...chain.second, linkDigest: "00" },
    { ...chain.first, previous: { kind: "other" } },
  ];
  for (const candidate of invalidLinks)
    assert.equal(code(parseLinkEvidence(candidate, DEFAULT_LIMITS)), "EVIDENCE_INVALID");

  const empty = {
    $schema: "urn:noeos:verification-engine:chain-summary:1",
    protocolVersion: 1,
    contextId: "ctx",
    sequenceId: "sequence",
    profile: profile(),
    algorithm: "sha-256",
    count: 0,
    boundaries: { start: "not-applicable", end: "not-applicable" },
    status: "valid",
    diagnostics: { errors: 0, warnings: 0, info: 0, truncated: false },
  };
  assert.ok(parseChainSummaryEvidence(empty, DEFAULT_LIMITS).ok);
  assert.ok(parseEvidence(empty, DEFAULT_LIMITS).ok);
  const nonEmpty = {
    ...empty,
    count: 1,
    firstPosition: 0,
    lastPosition: 0,
    firstLinkDigest: chain.first.linkDigest,
    finalLinkDigest: chain.first.linkDigest,
  };
  assert.ok(parseChainSummaryEvidence(nonEmpty, DEFAULT_LIMITS).ok);
  const invalidSummaries = [
    { ...empty, count: 0, firstPosition: 0 },
    { ...empty, count: 1 },
    { ...nonEmpty, firstPosition: 2, lastPosition: 1 },
    { ...empty, boundaries: { start: "bad", end: "verified" } },
    { ...empty, status: "bad" },
    { ...empty, diagnostics: { errors: -1, warnings: 0, info: 0, truncated: false } },
    { ...empty, diagnostics: { errors: 0, warnings: 0, info: 0, truncated: "no" } },
    { ...empty, extra: true },
    { ...empty, protocolVersion: 2 },
    { ...empty, contextId: "" },
    { ...empty, sequenceId: "" },
    { ...empty, profile: {} },
    { ...empty, algorithm: "md5" },
    { ...empty, count: -1 },
    { ...empty, boundaries: null },
    { ...empty, boundaries: { start: "verified", end: "verified", extra: true } },
    { ...empty, status: undefined },
    { ...empty, diagnostics: undefined },
    { ...nonEmpty, firstPosition: -1 },
    { ...nonEmpty, lastPosition: -1 },
    { ...nonEmpty, firstLinkDigest: "00" },
    { ...nonEmpty, finalLinkDigest: "00" },
    { ...nonEmpty, contentDigest: "00" },
  ];
  for (const candidate of invalidSummaries)
    assert.equal(code(parseChainSummaryEvidence(candidate, DEFAULT_LIMITS)), "EVIDENCE_INVALID");
  assert.equal(
    createDiagnostic("RULE_FAILED", "record", { details: { "bad key": "redacted" } }).details,
    undefined,
  );
  assert.equal(createDiagnostic("RULE_FAILED", "record", { path: "bad path" }).path, undefined);
  assert.equal(createDiagnostic("RULE_FAILED", "record", { path: "/field/" }).path, undefined);

  const failingProfile = {
    id: { value: "dev.noeos.failing" },
    version: { value: "1.0.0" },
    inputKind: "json",
    validate: () => ({ ok: false, diagnostics: [] }),
    normalize: () => ({ ok: true, value: { byteLength: 0 }, diagnostics: [] }),
  };
  const customProfiles = new ProfileRegistry();
  assert.equal(customProfiles.register(failingProfile).ok, true);
  const resolvedFailing = customProfiles.resolve(failingProfile.id, failingProfile.version);
  assert.equal(resolvedFailing.ok, true);
  assert.equal(resolvedFailing.value.normalize({}, {}, DEFAULT_LIMITS).ok, false);
});

void test("phase 5 and 6 exercise parser and duplicate invariant guards", () => {
  assert.equal(
    code(parseJsonText(new Uint8Array([123]), { ...DEFAULT_LIMITS, maxPayloadBytes: 0 })),
    "INPUT_LIMIT_EXCEEDED",
  );
  assert.equal(code(parseJsonText('{"a" 1}', DEFAULT_LIMITS)), "JSON_SYNTAX_INVALID");
  assert.equal(code(parseJsonText("[1 2]", DEFAULT_LIMITS)), "JSON_SYNTAX_INVALID");
  assert.equal(code(parseJsonText('"\ud800"', DEFAULT_LIMITS)), "JSON_SYNTAX_INVALID");
  assert.equal(code(parseJsonText("1.", DEFAULT_LIMITS)), "JSON_SYNTAX_INVALID");

  const chain = makeChain();
  const observed = observedLink(chain.first);
  const nextObserved = observedLink(chain.second);
  const recordCounterBroken = createDuplicateDetector({ kind: "window", size: 1 }, DEFAULT_LIMITS);
  recordCounterBroken.commit(observed);
  Reflect.set(recordCounterBroken, "recordIds", new Map());
  assert.throws(() => {
    recordCounterBroken.commit(nextObserved);
  });

  const forkCounterBroken = createDuplicateDetector({ kind: "window", size: 1 }, DEFAULT_LIMITS);
  forkCounterBroken.commit(observed);
  Reflect.set(forkCounterBroken, "forks", new Map());
  assert.throws(() => {
    forkCounterBroken.commit(nextObserved);
  });
});

void test("phase 5 record pipeline captures normalization rule failures without changing bytes", () => {
  const rules = must(
    RuleSet.create(
      [
        {
          id: "normalization.error",
          version: "1.0.0",
          phases: ["normalization"],
          defaultSeverity: "error",
          evaluate: () => [{ messageKey: "normalization.error" }],
        },
      ],
      DEFAULT_LIMITS,
    ),
  );
  const result = computeRecord(
    {
      contextId: "ctx",
      recordId: "normalization",
      payload: { value: 1 },
      profile: profile(),
      algorithm: "sha-256",
    },
    { ...options, rules },
  );
  assert.equal(result.ok, false);
});

void test("phase 5 verifier executes link rules and external duplicate policies", () => {
  const chain = makeChain();
  const seen: string[] = [];
  const rules = [
    {
      id: "link.rule",
      version: "1.0.0",
      phases: ["link"],
      defaultSeverity: "warning",
      evaluate: () => {
        seen.push("link");
        return [{ messageKey: "link.notice" }];
      },
    },
  ];
  const input = {
    ...verificationBase([{ payload: { value: 1 }, evidence: chain.first }]),
    mode: "internal",
    rules,
    duplicatePolicy: {
      kind: "external",
      index: { observe: () => ({ ok: true, value: [], diagnostics: [] }) },
    },
  };
  const result = verifyChain(input, options);
  assert.equal(result.status, "valid");
  assert.ok(result.evidence);
  assert.equal(result.evidence.diagnostics.warnings, 1);
  assert.deepEqual(seen, ["link"]);

  const matchedFragment = verifyChain(
    {
      ...verificationBase([{ payload: { value: 1 }, evidence: chain.first }]),
      mode: "fragment",
      startPosition: 0,
      expectedPrevious: { kind: "none" },
      expectedFinalLinkDigest: chain.first.linkDigest,
    },
    options,
  );
  assert.equal(matchedFragment.boundaries.start, "verified");
  assert.equal(matchedFragment.boundaries.end, "verified");
  const mismatchedFragmentEnd = verifyChain(
    {
      ...verificationBase([{ payload: { value: 1 }, evidence: chain.first }]),
      mode: "fragment",
      expectedFinalLinkDigest: "00".repeat(32),
    },
    options,
  );
  assert.ok(
    mismatchedFragmentEnd.diagnostics.some(
      (item: { code: string }) => item.code === "FINAL_LINK_MISMATCH",
    ),
  );

  const duplicate = verifyChain(
    {
      ...input,
      duplicatePolicy: {
        kind: "external",
        index: {
          observe: () => ({
            ok: true,
            value: [{ kind: "link-digest", key: "same" }],
            diagnostics: [],
          }),
        },
      },
    },
    options,
  );
  assert.equal(duplicate.status, "invalid");
  const failed = verifyChain(
    {
      ...input,
      duplicatePolicy: {
        kind: "external",
        index: { observe: () => ({ ok: false, diagnostics: [] }) },
      },
    },
    options,
  );
  assert.equal(failed.status, "invalid");
});

function makeChain(): { readonly first: LinkEvidence; readonly second: LinkEvidence } {
  const builder = must(
    ChainBuilder.create(
      { contextId: "ctx", sequenceId: "sequence", profile: profile(), algorithm: "sha-256" },
      options,
    ),
  );
  const first = must<LinkEvidence>(
    builder.append({
      recordId: "record-1",
      payload: { value: 1 },
      position: 0,
      previous: { kind: "none" },
    }),
  );
  const second = must<LinkEvidence>(
    builder.append({
      recordId: "record-2",
      payload: { value: 2 },
      position: 1,
      previous: { kind: "digest", value: first.linkDigest },
    }),
  );
  return { first, second };
}

function verificationBase(records: readonly unknown[]): Record<string, unknown> {
  return {
    contextId: "ctx",
    sequenceId: "sequence",
    profile: profile(),
    algorithm: "sha-256",
    mode: "internal",
    records,
  };
}

function profile(): { id: string; version: string } {
  return { id: "dev.noeos.jcs", version: "1.0.0" };
}

function must<T>(result: OperationResult<T>): T {
  if (!result.ok) throw new Error(JSON.stringify(result.diagnostics));
  return result.value;
}

function code(result: unknown): string | undefined {
  if (typeof result !== "object" || result === null || !("diagnostics" in result)) return undefined;
  const diagnostics = result.diagnostics;
  if (!Array.isArray(diagnostics)) return undefined;
  const first = diagnostics[0];
  if (typeof first !== "object" || first === null || !("code" in first)) return undefined;
  const codeValue: unknown = first.code;
  return typeof codeValue === "string" ? codeValue : undefined;
}
