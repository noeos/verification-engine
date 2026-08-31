// SPDX-License-Identifier: Apache-2.0

/* The E2E suite invokes the freshly built CLI artifact and deliberately checks
 * machine output, exit codes, and filesystem completion markers. */
/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-type-assertion, @typescript-eslint/require-await, @typescript-eslint/no-unused-vars */

import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { Readable, Writable } from "node:stream";
import { mkdtemp, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";

import { runCli } from "../../packages/cli/dist/esm/cli.js";
import { createEngine } from "../../packages/engine/dist/esm/index.js";
import {
  decodeUtf8,
  parseJsonDocument,
  parseNdjson,
} from "../../packages/cli/dist/esm/io/json-input.js";
import { openLineWriter } from "../../packages/cli/dist/esm/io/output.js";

class Capture extends Writable {
  readonly chunks: string[] = [];

  override _write(
    chunk: Uint8Array,
    _encoding: BufferEncoding,
    callback: (error?: Error | null) => void,
  ): void {
    this.chunks.push(Buffer.from(chunk).toString("utf8"));
    callback();
  }

  text(): string {
    return this.chunks.join("");
  }
}

class BackpressuredCapture extends Capture {
  override write(
    chunk: Uint8Array | string,
    encoding?: BufferEncoding | ((error?: Error | null) => void),
    callback?: (error?: Error | null) => void,
  ): boolean {
    super.write(chunk, encoding as BufferEncoding, callback);
    queueMicrotask(() => this.emit("drain"));
    return false;
  }
}

class ThrowingCapture extends Capture {
  override write(): boolean {
    throw new Error("deliberate output failure");
  }
}

class ErrorBackpressuredCapture extends Capture {
  override write(
    chunk: Uint8Array | string,
    encoding?: BufferEncoding | ((error?: Error | null) => void),
    callback?: (error?: Error | null) => void,
  ): boolean {
    super.write(chunk, encoding as BufferEncoding, callback);
    queueMicrotask(() => this.emit("error", new Error("deliberate backpressure failure")));
    return false;
  }
}

async function invoke(
  args: readonly string[],
  input = "",
): Promise<{ code: number; stdout: string; stderr: string }> {
  const stdout = new Capture();
  const stderr = new Capture();
  const code = await runCli(args, {
    stdin: Readable.from([Buffer.from(input)]),
    stdout,
    stderr,
  });
  return { code, stdout: stdout.text(), stderr: stderr.text() };
}

async function invokeProcess(
  args: readonly string[],
  input = "",
): Promise<{ code: number | null; stdout: string; stderr: string }> {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(process.execPath, ["packages/cli/dist/esm/main.js", ...args], {
      cwd: process.cwd(),
      stdio: ["pipe", "pipe", "pipe"],
    });
    const stdout: Buffer[] = [];
    const stderr: Buffer[] = [];
    child.stdout.on("data", (chunk: Buffer) => stdout.push(chunk));
    child.stderr.on("data", (chunk: Buffer) => stderr.push(chunk));
    child.on("error", reject);
    child.on("close", (code) => {
      resolvePromise({
        code,
        stdout: Buffer.concat(stdout).toString("utf8"),
        stderr: Buffer.concat(stderr).toString("utf8"),
      });
    });
    child.stdin.end(input);
  });
}

void test("phase 9 CLI process entrypoint drains piped input and output before exit", async () => {
  const result = await invokeProcess(
    ["record", "hash", "--input", "-", "--output", "ndjson"],
    `${JSON.stringify({
      contextId: "process-context",
      recordId: "process-record",
      profile: { id: "dev.noeos.jcs", version: "1.0.0" },
      algorithm: "sha-256",
      payload: { value: 1 },
    })}\n`,
  );
  assert.equal(result.code, 0);
  assert.equal(result.stderr, "");
  assert.equal((JSON.parse(result.stdout) as { readonly ok: unknown }).ok, true);
});

void test("phase 9 CLI preserves API parity, strict input, exit codes, and safe output", async () => {
  const recordInput = JSON.stringify({
    contextId: "ctx",
    recordId: "one",
    profile: { id: "dev.noeos.jcs", version: "1.0.0" },
    algorithm: "sha-256",
    payload: { value: 1 },
  });
  const hashed = await invoke(
    ["record", "hash", "--input", "-", "--output", "ndjson"],
    recordInput,
  );
  assert.equal(hashed.code, 0);
  const hashEnvelope = JSON.parse(hashed.stdout) as { value: Record<string, unknown> };
  assert.equal(hashEnvelope.value["$schema"], "urn:noeos:verification-engine:record-evidence:1");
  const flagConfigured = await invoke(
    [
      "record",
      "hash",
      "--input",
      "-",
      "--profile",
      "dev.noeos.jcs@1.0.0",
      "--algorithm",
      "sha-256",
      "--context",
      "ctx",
      "--output",
      "ndjson",
    ],
    JSON.stringify({ recordId: "one", payload: { value: 1 } }),
  );
  assert.equal(flagConfigured.code, 0);
  const extraField = await invoke(
    ["record", "hash", "--input", "-", "--output", "ndjson"],
    JSON.stringify({ ...JSON.parse(recordInput), unexpected: true }),
  );
  assert.equal(extraField.code, 3);

  const duplicate = await invoke(
    ["record", "hash", "--input", "-", "--output", "ndjson"],
    '{"contextId":"ctx","contextId":"other"}',
  );
  assert.equal(duplicate.code, 3);
  assert.match(duplicate.stderr, /JSON_DUPLICATE_KEY/u);

  const directory = await mkdtemp(join(tmpdir(), "noeos-phase9-"));
  try {
    const engine = createEngine();
    const builder = engine.createChain({
      contextId: "ctx",
      sequenceId: "seq",
      profile: { id: "dev.noeos.jcs", version: "1.0.0" },
      algorithm: "sha-256",
    });
    const first = builder.append({
      recordId: "one",
      payload: { value: 1 },
      position: 0,
      previous: { kind: "none" },
    });
    assert.equal(first.ok, true);
    if (!first.ok) throw new Error("first link missing");
    const second = builder.append({
      recordId: "two",
      payload: { value: 2 },
      position: 1,
      previous: { kind: "digest", value: first.value.linkDigest },
    });
    assert.equal(second.ok, true);
    if (!second.ok) throw new Error("second link missing");

    const configPath = join(directory, "build-config.json");
    const inputPath = join(directory, "chain.ndjson");
    const outputPath = join(directory, "chain.out.ndjson");
    await writeFile(
      configPath,
      JSON.stringify({
        contextId: "ctx",
        sequenceId: "seq",
        profile: { id: "dev.noeos.jcs", version: "1.0.0" },
        algorithm: "sha-256",
        allowEmpty: false,
        duplicatePolicy: { kind: "window", size: 4 },
      }),
    );
    await writeFile(
      inputPath,
      [
        JSON.stringify({
          recordId: "one",
          payload: { value: 1 },
          position: 0,
          previous: { kind: "none" },
        }),
        JSON.stringify({
          recordId: "two",
          payload: { value: 2 },
          position: 1,
          previous: { kind: "digest", value: first.value.linkDigest },
        }),
      ].join("\n"),
    );
    const built = await invoke([
      "chain",
      "build",
      "--config",
      configPath,
      "--input",
      inputPath,
      "--output",
      "ndjson",
      "--output-file",
      outputPath,
      "--atomic-output",
    ]);
    assert.equal(built.code, 0);
    const builtLines = (await readFile(outputPath, "utf8"))
      .trim()
      .split("\n")
      .map((line) => JSON.parse(line) as Record<string, unknown>);
    assert.equal(builtLines.length, 3);
    assert.equal((builtLines[2]?.["value"] as Record<string, unknown>)["status"], "valid");

    const builtFromFlags = await invoke([
      "chain",
      "build",
      "--input",
      inputPath,
      "--profile",
      "dev.noeos.jcs@1.0.0",
      "--algorithm",
      "sha-256",
      "--context",
      "ctx",
      "--sequence",
      "seq",
      "--output",
      "ndjson",
    ]);
    assert.equal(builtFromFlags.code, 0);
    const failedInputPath = join(directory, "failed.ndjson");
    await writeFile(failedInputPath, "\n");
    const failedBuild = await invoke([
      "chain",
      "build",
      "--config",
      configPath,
      "--input",
      failedInputPath,
      "--output",
      "ndjson",
    ]);
    assert.equal(failedBuild.code, 3);
    assert.match(failedBuild.stdout, /"kind":"summary"/u);

    const verifyConfigPath = join(directory, "verify-config.json");
    const verifyInputPath = join(directory, "verify.ndjson");
    await writeFile(
      verifyConfigPath,
      JSON.stringify({
        contextId: "ctx",
        sequenceId: "seq",
        profile: { id: "dev.noeos.jcs", version: "1.0.0" },
        algorithm: "sha-256",
        mode: "complete",
        expectedCount: 2,
        expectedFinalLinkDigest: second.ok ? second.value.linkDigest : "",
        allowEmpty: false,
      }),
    );
    await writeFile(
      verifyInputPath,
      [
        JSON.stringify({ payload: { value: 1 }, evidence: first.value }),
        JSON.stringify({ payload: { value: 2 }, evidence: second.ok ? second.value : {} }),
      ].join("\n"),
    );
    const verified = await invoke([
      "chain",
      "verify",
      "--config",
      verifyConfigPath,
      "--input",
      verifyInputPath,
      "--output",
      "ndjson",
    ]);
    assert.equal(verified.code, 0);
    assert.equal((JSON.parse(verified.stdout) as Record<string, unknown>)["status"], "valid");

    const verifiedFromFlags = await invoke([
      "chain",
      "verify",
      "--input",
      verifyInputPath,
      "--profile",
      "dev.noeos.jcs@1.0.0",
      "--algorithm",
      "sha-256",
      "--context",
      "ctx",
      "--sequence",
      "seq",
      "--mode",
      "complete",
      "--expected-count",
      "2",
      "--expected-final-link-digest",
      second.ok ? second.value.linkDigest : "",
      "--output",
      "ndjson",
    ]);
    assert.equal(verifiedFromFlags.code, 0);
    const indeterminate = await invoke([
      "chain",
      "verify",
      "--input",
      verifyInputPath,
      "--profile",
      "dev.noeos.jcs@1.0.0",
      "--algorithm",
      "sha-256",
      "--context",
      "ctx",
      "--sequence",
      "seq",
      "--mode",
      "complete",
      "--output",
      "ndjson",
    ]);
    assert.equal(indeterminate.code, 4);
    assert.match(indeterminate.stdout, /"status":"indeterminate"/u);
    assert.equal(
      (
        await invoke([
          "chain",
          "verify",
          "--input",
          verifyInputPath,
          "--config",
          verifyConfigPath,
          "--mode",
          "bad",
        ])
      ).code,
      3,
    );
    assert.equal(
      (
        await invoke([
          "chain",
          "verify",
          "--input",
          verifyInputPath,
          "--config",
          verifyConfigPath,
          "--expected-count",
          "-1",
        ])
      ).code,
      2,
    );
    const emptyInputPath = join(directory, "empty.ndjson");
    await writeFile(emptyInputPath, "");
    const emptyChain = await invoke([
      "chain",
      "build",
      "--input",
      emptyInputPath,
      "--profile",
      "dev.noeos.jcs@1.0.0",
      "--algorithm",
      "sha-256",
      "--context",
      "ctx",
      "--sequence",
      "empty",
      "--allow-empty",
      "--output",
      "ndjson",
    ]);
    assert.equal(emptyChain.code, 0);
    const malformedVerifyInputPath = join(directory, "malformed-verify.ndjson");
    await writeFile(malformedVerifyInputPath, '{"payload":{"value":1}}\n');
    const malformedVerify = await invoke([
      "chain",
      "verify",
      "--config",
      verifyConfigPath,
      "--input",
      malformedVerifyInputPath,
      "--output",
      "ndjson",
    ]);
    assert.equal(malformedVerify.code, 3);
    const invalidVerifyConfigPath = join(directory, "invalid-verify-config.json");
    await writeFile(
      invalidVerifyConfigPath,
      JSON.stringify({
        contextId: "ctx",
        sequenceId: "seq",
        profile: { id: "dev.noeos.jcs", version: "1.0.0" },
        algorithm: "sha-256",
        mode: "complete",
        expectedCount: "two",
      }),
    );
    const invalidVerifyConfig = await invoke([
      "chain",
      "verify",
      "--config",
      invalidVerifyConfigPath,
      "--input",
      verifyInputPath,
      "--output",
      "ndjson",
    ]);
    assert.equal(invalidVerifyConfig.code, 3);
    const invalidDuplicateConfigPath = join(directory, "invalid-duplicate-config.json");
    await writeFile(
      invalidDuplicateConfigPath,
      JSON.stringify({
        contextId: "ctx",
        sequenceId: "seq",
        profile: { id: "dev.noeos.jcs", version: "1.0.0" },
        algorithm: "sha-256",
        duplicatePolicy: { kind: "invalid" },
      }),
    );
    const invalidDuplicateConfig = await invoke([
      "chain",
      "build",
      "--config",
      invalidDuplicateConfigPath,
      "--input",
      inputPath,
      "--output",
      "ndjson",
    ]);
    assert.equal(invalidDuplicateConfig.code, 3);
    const fullDuplicateConfigPath = join(directory, "full-duplicate-config.json");
    await writeFile(
      fullDuplicateConfigPath,
      JSON.stringify({
        contextId: "ctx",
        sequenceId: "seq",
        profile: { id: "dev.noeos.jcs", version: "1.0.0" },
        algorithm: "sha-256",
        duplicatePolicy: { kind: "full", maxRecords: 10 },
      }),
    );
    const fullDuplicateBuild = await invoke([
      "chain",
      "build",
      "--config",
      fullDuplicateConfigPath,
      "--input",
      inputPath,
      "--output",
      "ndjson",
    ]);
    assert.equal(fullDuplicateBuild.code, 0);

    const digest = await invoke(
      ["evidence", "digest", "--input", "-", "--output", "ndjson"],
      JSON.stringify(hashEnvelope.value),
    );
    assert.equal(digest.code, 0);
    assert.match(digest.stdout, /"digest":"[0-9a-f]+"/u);

    const fileOutput = join(directory, "record.out.ndjson");
    const written = await invoke(
      ["record", "hash", "--input", "-", "--output", "ndjson", "--output-file", fileOutput],
      recordInput,
    );
    assert.equal(written.code, 0);
    assert.deepEqual(JSON.parse(await readFile(`${fileOutput}.manifest.json`, "utf8")), {
      version: 1,
      complete: true,
      format: "ndjson",
    });
    const refused = await invoke(
      ["record", "hash", "--input", "-", "--output", "ndjson", "--output-file", fileOutput],
      recordInput,
    );
    assert.equal(refused.code, 6);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

void test("phase 9 CLI utility commands expose governed assets", async () => {
  const version = await invoke(["version", "--output", "ndjson"]);
  assert.equal(version.code, 0, JSON.stringify(version));
  const vectors = await invoke(["vectors", "verify", "--output", "ndjson"]);
  assert.equal(vectors.code, 0, JSON.stringify(vectors));
  const schema = await invoke([
    "schema",
    "print",
    "--schema",
    "record-evidence",
    "--output",
    "ndjson",
  ]);
  assert.equal(schema.code, 0, JSON.stringify(schema));
  assert.match(schema.stdout, /urn:noeos:verification-engine:record-evidence:1/u);
  const ttyStdout = new Capture() as Capture & { isTTY?: boolean };
  ttyStdout.isTTY = true;
  const ttyStderr = new Capture();
  assert.equal(
    await runCli(["version"], {
      stdin: Readable.from([]),
      stdout: ttyStdout,
      stderr: ttyStderr,
    }),
    0,
  );
  assert.match(ttyStdout.text(), /version: ok/u);
});

void test("phase 9 CLI handles help, verification, inspection, and safe path failures", async () => {
  const directory = await mkdtemp(join(tmpdir(), "noeos-cli-extra-"));
  try {
    const payloadPath = join(directory, "payload.json");
    const evidencePath = join(directory, "evidence.json");
    const outputPath = join(directory, "output.ndjson");
    const input = JSON.stringify({
      contextId: "ctx",
      recordId: "one",
      profile: { id: "dev.noeos.jcs", version: "1.0.0" },
      algorithm: "sha-256",
      payload: { value: 1 },
    });
    const hashed = await invoke(["record", "hash", "--input", "-", "--output", "ndjson"], input);
    const envelope = JSON.parse(hashed.stdout) as { value: unknown };
    await writeFile(evidencePath, JSON.stringify(envelope.value));
    await writeFile(payloadPath, JSON.stringify({ value: 1 }));
    const invalidPayloadPath = join(directory, "invalid-payload.json");
    await writeFile(invalidPayloadPath, JSON.stringify({ value: 2 }));
    const verified = await invoke([
      "record",
      "verify",
      "--input",
      payloadPath,
      "--evidence",
      evidencePath,
      "--output",
      "ndjson",
    ]);
    assert.equal(verified.code, 0);
    const inspected = await invoke([
      "evidence",
      "inspect",
      "--input",
      evidencePath,
      "--output",
      "ndjson",
    ]);
    assert.match(inspected.stdout, /"recognized":true/u);
    const unrecognizedPath = join(directory, "unrecognized.json");
    await writeFile(unrecognizedPath, "null");
    const unrecognized = await invoke([
      "evidence",
      "inspect",
      "--input",
      unrecognizedPath,
      "--output",
      "ndjson",
    ]);
    assert.equal(unrecognized.code, 0);
    assert.match(unrecognized.stdout, /"recognized":false/u);
    const invalidVerified = await invoke(
      [
        "record",
        "verify",
        "--input",
        invalidPayloadPath,
        "--evidence",
        evidencePath,
        "--output",
        "ndjson",
      ],
      JSON.stringify({ value: 2 }),
    );
    assert.equal(invalidVerified.code, 1);
    const missingEvidenceFlag = await invoke([
      "record",
      "verify",
      "--input",
      payloadPath,
      "--output",
      "ndjson",
    ]);
    assert.equal(missingEvidenceFlag.code, 2);
    const help = await invoke(["record", "hash", "--help"]);
    assert.equal(help.code, 0);
    const invalid = await invoke(["not-a-command", "--output", "ndjson"]);
    assert.equal(invalid.code, 2);
    const empty = await invoke([]);
    assert.equal(empty.code, 0);
    assert.equal((await invoke(["version", "--output", "invalid"])).code, 2);
    assert.equal((await invoke(["version", "--output"])).code, 2);
    assert.equal((await invoke(["record", "hash", "--output", "ndjson"])).code, 2);
    const written = await invoke(
      ["record", "hash", "--input", "-", "--output", "ndjson", "--output-file", outputPath],
      input,
    );
    assert.equal(written.code, 0);
    const refused = await invoke(
      ["record", "hash", "--input", "-", "--output", "ndjson", "--output-file", outputPath],
      input,
    );
    assert.equal(refused.code, 6);
    const linked = join(directory, "output-link");
    await symlink(outputPath, linked);
    const symlinkRefused = await invoke(
      ["record", "hash", "--input", "-", "--output", "ndjson", "--output-file", linked, "--force"],
      input,
    );
    assert.equal(symlinkRefused.code, 6);
    const missingEvidence = await invoke([
      "record",
      "verify",
      "--input",
      payloadPath,
      "--evidence",
      join(directory, "missing.json"),
      "--output",
      "ndjson",
    ]);
    assert.equal(missingEvidence.code, 6);
    const badDigest = await invoke(
      ["evidence", "digest", "--input", "-", "--output", "ndjson"],
      "{}",
    );
    assert.equal(badDigest.code, 7);
    const bytesInput = JSON.stringify({
      contextId: "ctx",
      recordId: "bytes",
      profile: { id: "dev.noeos.raw-bytes", version: "1.0.0" },
      algorithm: "sha-256",
      payload: { kind: "bytes", hex: "00ff" },
    });
    assert.equal(
      (await invoke(["record", "hash", "--input", "-", "--output", "json"], bytesInput)).code,
      0,
    );
    assert.equal(
      (await invoke(["record", "hash", "--input", "-", "--output", "human"], input)).code,
      0,
    );
    const unknownProfile = await invoke(
      ["record", "hash", "--input", "-", "--output", "ndjson"],
      input.replace("dev.noeos.jcs", "dev.noeos.unknown"),
    );
    assert.equal(unknownProfile.code, 7);
    const malformedProfileFlag = await invoke(
      [
        "record",
        "hash",
        "--input",
        "-",
        "--profile",
        "malformed",
        "--algorithm",
        "sha-256",
        "--context",
        "ctx",
        "--output",
        "ndjson",
      ],
      JSON.stringify({ recordId: "one", payload: { value: 1 } }),
    );
    assert.equal(malformedProfileFlag.code, 3);
    const wrappedJsonPayload = await invoke(
      ["record", "hash", "--input", "-", "--output", "ndjson"],
      input.replace('{"value":1}', '{"kind":"json","value":{"value":1}}'),
    );
    assert.equal(wrappedJsonPayload.code, 0);
    const invalidBytes = await invoke(
      ["record", "hash", "--input", "-", "--output", "ndjson"],
      bytesInput.replace('"00ff"', '"0x"'),
    );
    assert.equal(invalidBytes.code, 3);
    const badAlgorithm = await invoke(
      ["record", "hash", "--input", "-", "--output", "ndjson"],
      input.replace("sha-256", "sha-1"),
    );
    assert.equal(badAlgorithm.code, 7);
    assert.equal(
      (await invoke(["record", "hash", "--input", "-", "--output", "ndjson", "--unknown"], input))
        .code,
      2,
    );
    assert.equal(
      (await invoke(["schema", "print", "--schema", "unknown", "--output", "ndjson"])).code,
      7,
    );
    const internalFailure = await runCli(["record", "hash", "--input", "-"], {
      stdin: Readable.from([Buffer.from(input)]),
      stdout: new ThrowingCapture(),
      stderr: new Capture(),
    });
    assert.equal(internalFailure, 70);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

void test("phase 7 parsers reject malformed and oversized UTF-8/NDJSON input", async () => {
  const limits = { maxBytes: 32, maxDepth: 4, maxObjectProperties: 4, maxArrayElements: 4 };
  assert.deepEqual(parseJsonDocument('{"a":[true,null,"x"],"b":-1.2}', limits), {
    a: [true, null, "x"],
    b: -1.2,
  });
  assert.deepEqual(parseJsonDocument("{}", limits), {});
  assert.deepEqual(parseJsonDocument("[]", limits), []);
  assert.throws(() => parseJsonDocument('{"a":1,"a":2}', limits), { code: "JSON_DUPLICATE_KEY" });
  assert.throws(() => parseJsonDocument("\ufeff{}", limits), { code: "UTF8_INVALID" });
  assert.throws(() => decodeUtf8(Uint8Array.from([0xc3, 0x28])), { code: "UTF8_INVALID" });
  const parsed: unknown[] = [];
  for await (const value of parseNdjson(
    (async function* () {
      yield new TextEncoder().encode('{"x":"á"}\r\n{"y":2}\n');
    })(),
    { ...limits, maxBytes: 16 },
  ))
    parsed.push(value);
  assert.deepEqual(parsed, [{ x: "á" }, { y: 2 }]);
  const splitParsed: unknown[] = [];
  for await (const value of parseNdjson(
    (async function* () {
      yield new TextEncoder().encode('{"split"');
      yield new TextEncoder().encode(":true}");
    })(),
    limits,
  ))
    splitParsed.push(value);
  assert.deepEqual(splitParsed, [{ split: true }]);
  await assert.rejects(
    (async () => {
      for await (const _value of parseNdjson(
        (async function* () {
          yield new TextEncoder().encode("\n");
        })(),
        limits,
      )) {
        /* consume */
      }
    })(),
    { code: "NDJSON_LINE_EMPTY" },
  );
  await assert.rejects(
    (async () => {
      for await (const _value of parseNdjson(
        (async function* () {
          yield new TextEncoder().encode('{"too":"long"}\n');
        })(),
        { ...limits, maxBytes: 4 },
      )) {
        /* consume */
      }
    })(),
    { code: "NDJSON_LINE_TOO_LARGE" },
  );
  assert.throws(() => parseJsonDocument("{", limits), { code: "JSON_SYNTAX_INVALID" });
  assert.throws(() => parseJsonDocument("[]x", limits), { code: "JSON_SYNTAX_INVALID" });
  assert.throws(() => parseJsonDocument("[[[[[0]]]]]", limits), { code: "INPUT_LIMIT_EXCEEDED" });
  assert.throws(() => parseJsonDocument('{"a":1,}', limits), { code: "JSON_SYNTAX_INVALID" });
  assert.throws(() => parseJsonDocument("[1,]", limits), { code: "JSON_SYNTAX_INVALID" });
  assert.throws(() => parseJsonDocument('"unterminated', limits), {
    code: "JSON_SYNTAX_INVALID",
  });
  assert.throws(() => parseJsonDocument('"bad\\', limits), { code: "JSON_SYNTAX_INVALID" });
  assert.throws(() => parseJsonDocument('"bad\nvalue"', limits), {
    code: "JSON_SYNTAX_INVALID",
  });
  assert.throws(() => parseJsonDocument("{a:1}", limits), { code: "JSON_SYNTAX_INVALID" });
  assert.throws(() => parseJsonDocument('{"a" 1}', limits), { code: "JSON_SYNTAX_INVALID" });
  assert.throws(() => parseJsonDocument('{"a":1 "b":2}', limits), {
    code: "JSON_SYNTAX_INVALID",
  });
  assert.throws(() => parseJsonDocument("[1 2]", limits), { code: "JSON_SYNTAX_INVALID" });
  assert.throws(() => parseJsonDocument(",", limits), { code: "JSON_SYNTAX_INVALID" });
  assert.throws(() => parseJsonDocument("NaN", limits), { code: "JSON_SYNTAX_INVALID" });
  assert.throws(() => parseJsonDocument('{"\\q":1}', limits), {
    code: "JSON_SYNTAX_INVALID",
  });
  assert.throws(() => parseJsonDocument("123456", { ...limits, maxBytes: 4 }), {
    code: "INPUT_LIMIT_EXCEEDED",
  });
  assert.throws(() => parseJsonDocument('{"a":1,"b":2,"c":3,"d":4,"e":5}', limits), {
    code: "INPUT_LIMIT_EXCEEDED",
  });
  assert.throws(() => parseJsonDocument("[1,2,3,4,5]", limits), { code: "INPUT_LIMIT_EXCEEDED" });
  await assert.rejects(
    (async () => {
      for await (const _value of parseNdjson(
        (async function* () {
          yield Uint8Array.from([0xc3, 0x28]);
        })(),
        limits,
      )) {
        /* consume */
      }
    })(),
    { code: "UTF8_INVALID" },
  );
  await assert.rejects(
    (async () => {
      for await (const _value of parseNdjson(
        (async function* () {
          yield new TextEncoder().encode("{");
        })(),
        limits,
      )) {
        /* consume */
      }
    })(),
    { code: "JSON_SYNTAX_INVALID" },
  );
  await assert.rejects(
    (async () => {
      for await (const _value of parseNdjson(
        (async function* () {
          yield new TextEncoder().encode("123456789");
        })(),
        { ...limits, maxBytes: 4 },
      )) {
        /* consume */
      }
    })(),
    { code: "NDJSON_LINE_TOO_LARGE" },
  );
  const empty: unknown[] = [];
  for await (const value of parseNdjson(
    (async function* () {
      yield new Uint8Array();
    })(),
    limits,
  ))
    empty.push(value);
  assert.deepEqual(empty, []);
});

void test("phase 7 file writers mark incomplete output and render human output", async () => {
  const directory = await mkdtemp(join(tmpdir(), "noeos-output-extra-"));
  try {
    const stdout = new Capture();
    const human = await openLineWriter("human", { force: false, atomic: false }, stdout);
    await human.write({ operation: "test", ok: true });
    await human.write({});
    await human.write(null);
    await human.close(true);
    assert.equal(stdout.text(), "test: ok\noperation: error\nnull\n");
    const path = join(directory, "failed.ndjson");
    const writer = await openLineWriter("ndjson", { path, force: false, atomic: false }, stdout);
    await writer.write({ operation: "test", ok: false });
    await writer.close(false);
    assert.deepEqual(JSON.parse(await readFile(`${path}.manifest.json`, "utf8")), {
      version: 1,
      complete: false,
      format: "ndjson",
    });
    const atomicPath = join(directory, "atomic.ndjson");
    const atomic = await openLineWriter(
      "ndjson",
      { path: atomicPath, force: false, atomic: true },
      stdout,
    );
    await atomic.write({ operation: "atomic", ok: false });
    await atomic.close(false);
    await assert.rejects(readFile(atomicPath));
    const atomicSuccessPath = join(directory, "atomic-success.ndjson");
    const atomicSuccess = await openLineWriter(
      "json",
      { path: atomicSuccessPath, force: false, atomic: true },
      stdout,
    );
    await atomicSuccess.write({ operation: "atomic", ok: true });
    await atomicSuccess.close(true);
    assert.match(await readFile(atomicSuccessPath, "utf8"), /atomic/u);
    const forcedPath = join(directory, "forced.ndjson");
    await writeFile(forcedPath, "old\n");
    const forced = await openLineWriter(
      "ndjson",
      { path: forcedPath, force: true, atomic: false },
      stdout,
    );
    await forced.write({ operation: "forced", ok: true });
    await forced.close(true);
    assert.match(await readFile(forcedPath, "utf8"), /forced/u);
    const backpressured = new BackpressuredCapture();
    const streamed = await openLineWriter("ndjson", { force: false, atomic: false }, backpressured);
    await streamed.write({ operation: "backpressure", ok: true });
    await streamed.close(true);
    assert.match(backpressured.text(), /backpressure/u);
    const failedBackpressure = new ErrorBackpressuredCapture();
    const failedStream = await openLineWriter(
      "ndjson",
      { force: false, atomic: false },
      failedBackpressure,
    );
    await assert.rejects(failedStream.write({ operation: "backpressure-error", ok: true }));
    const circular: { self?: unknown } = {};
    circular.self = circular;
    await assert.rejects(streamed.write(circular));
    await assert.rejects(forced.close(true));
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
