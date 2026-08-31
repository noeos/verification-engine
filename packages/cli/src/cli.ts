// SPDX-License-Identifier: Apache-2.0

import { Buffer } from "node:buffer";
import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { Writable } from "node:stream";

import {
  createEngine,
  type AlgorithmId,
  type ChainConfig,
  type DuplicatePolicy,
  type ChainRecordInput,
  type Evidence,
  type ProfileReference,
  type PreviousLink,
  type RecordInput,
  type VerifyChainInput,
  type VerifyRecordInput,
} from "@noeos/verification-engine";
import { SCHEMA_ASSETS } from "@noeos/verification-engine/schemas";
import { VECTOR_SET } from "@noeos/verification-engine/vectors";
import { CliInputError, decodeUtf8, parseJsonDocument, parseNdjson } from "./io/json-input.js";
import { openLineWriter, type LineWriter, type OutputFormat } from "./io/output.js";

const DEFAULT_JSON_MAX_BYTES = 16 * 1024 * 1024;
const DEFAULT_NDJSON_MAX_BYTES = 1 * 1024 * 1024;
const JSON_LIMITS = {
  maxBytes: DEFAULT_JSON_MAX_BYTES,
  maxDepth: 128,
  maxObjectProperties: 100_000,
  maxArrayElements: 1_000_000,
};
const NDJSON_LIMITS = { ...JSON_LIMITS, maxBytes: DEFAULT_NDJSON_MAX_BYTES };

interface CliStreams {
  readonly stdin: AsyncIterable<Uint8Array>;
  readonly stdout: Writable & { readonly isTTY?: boolean };
  readonly stderr: Writable;
}

interface CliArgs {
  readonly command: readonly string[];
  readonly values: ReadonlyMap<string, string>;
  readonly flags: ReadonlySet<string>;
  readonly format: OutputFormat;
  readonly outputPath?: string;
  readonly force: boolean;
  readonly atomic: boolean;
  readonly quiet: boolean;
}

class CliError extends Error {
  constructor(
    readonly code: string,
    readonly exitCode: number,
  ) {
    super(code);
    this.name = "CliError";
  }
}

export async function runCli(argv: readonly string[], streams: CliStreams): Promise<number> {
  let args: CliArgs;
  try {
    args = parseArguments(argv, streams.stdout);
  } catch (error) {
    /* Argument-reporting fallback is covered by the CLI negative matrix. */
    /* node:coverage disable */
    await writeError(streams.stderr, error);
    return error instanceof CliError ? error.exitCode : 2;
    /* node:coverage enable */
  }
  if (args.flags.has("help")) {
    await writeText(streams.stdout, help(args.command));
    return 0;
  }
  const outputOptions =
    args.outputPath === undefined
      ? { force: args.force, atomic: args.atomic }
      : { path: args.outputPath, force: args.force, atomic: args.atomic };
  let writer: LineWriter;
  try {
    writer = await openLineWriter(args.format, outputOptions, streams.stdout);
  } catch {
    await writeError(streams.stderr, new CliError("IO_WRITE_FAILED", 6));
    return 6;
  }
  let succeeded = false;
  let resultCode: number;
  try {
    resultCode = await dispatch(args, streams, writer);
    succeeded = resultCode === 0;
  } catch (error) {
    await writeError(streams.stderr, error);
    resultCode = cliErrorExitCode(error);
  } finally {
    try {
      await writer.close(succeeded);
    } catch (error) {
      await writeError(streams.stderr, new CliError("IO_WRITE_FAILED", 6), error);
      resultCode = 6;
    }
  }
  return resultCode;
}

async function dispatch(args: CliArgs, streams: CliStreams, writer: LineWriter): Promise<number> {
  if (args.command.length === 0 || args.command[0] === "version") {
    await writer.write({
      kind: "result",
      operation: "version",
      ok: true,
      value: { version: await cliVersion() },
    });
    return 0;
  }
  if (args.command[0] === "record" && args.command[1] === "hash")
    return recordHash(args, streams, writer);
  if (args.command[0] === "record" && args.command[1] === "verify")
    return recordVerify(args, streams, writer);
  if (args.command[0] === "chain" && args.command[1] === "build")
    return chainBuild(args, streams, writer);
  if (args.command[0] === "chain" && args.command[1] === "verify")
    return chainVerify(args, streams, writer);
  if (args.command[0] === "evidence" && args.command[1] === "inspect")
    return evidenceInspect(args, streams, writer);
  if (args.command[0] === "evidence" && args.command[1] === "digest")
    return evidenceDigest(args, streams, writer);
  if (args.command[0] === "vectors" && args.command[1] === "verify")
    return vectorsVerify(args, streams, writer);
  if (args.command[0] === "schema" && args.command[1] === "print")
    return schemaPrint(args, streams, writer);
  throw new CliError("INPUT_TYPE_INVALID", 2);
}

async function recordHash(args: CliArgs, streams: CliStreams, writer: LineWriter): Promise<number> {
  const input = await readJsonInput(args, streams);
  const record = decodeRecordInput(input, args);
  const engine = createEngine();
  const result = engine.hashRecord(record);
  await writer.write({
    kind: "result",
    operation: "record-hash",
    ok: result.ok,
    ...(result.ok ? { value: result.value } : {}),
    diagnostics: result.diagnostics,
  });
  return result.ok ? 0 : highestExit(result.diagnostics);
}

async function recordVerify(
  args: CliArgs,
  streams: CliStreams,
  writer: LineWriter,
): Promise<number> {
  const input = await readJsonInput(args, streams);
  const evidencePath = requiredValue(args, "evidence");
  const evidence = await readJsonFile(evidencePath);
  const verifyInput: VerifyRecordInput = { payload: decodePayload(input), evidence };
  const result = createEngine().verifyRecord(verifyInput);
  await writer.write({
    kind: "result",
    operation: "record-verify",
    ok: result.status === "valid",
    status: result.status,
    evidence: result.evidence,
    diagnostics: result.diagnostics,
    stats: result.stats,
  });
  return statusExit(result.status, result.diagnostics);
}

async function chainBuild(args: CliArgs, streams: CliStreams, writer: LineWriter): Promise<number> {
  const config = decodeChainConfig(await readConfig(args, streams), args);
  const engine = createEngine();
  const builder = engine.createChain(config);
  const abort = installAbortController();
  const source = decodeChainRecords(parseNdjson(inputChunks(args, streams), NDJSON_LIMITS));
  const result = await builder.appendStream(source, {
    signal: abort.signal,
    onEvidence: async (evidence) => {
      await writer.write({ kind: "result", operation: "chain-build", ok: true, value: evidence });
    },
  });
  abort.dispose();
  if (result.ok) {
    await writer.write({
      kind: "summary",
      operation: "chain-build",
      ok: true,
      value: result.value,
      diagnostics: result.diagnostics,
    });
    return 0;
  }
  await writer.write({
    kind: "summary",
    operation: "chain-build",
    ok: false,
    diagnostics: result.diagnostics,
  });
  return highestExit(result.diagnostics);
}

async function chainVerify(
  args: CliArgs,
  streams: CliStreams,
  writer: LineWriter,
): Promise<number> {
  const config = decodeVerifyConfig(await readConfig(args, streams), args);
  const abort = installAbortController();
  const source = decodeVerifyRecords(parseNdjson(inputChunks(args, streams), NDJSON_LIMITS));
  const result = await createEngine().verifyStream({
    ...config,
    records: source,
    signal: abort.signal,
  });
  abort.dispose();
  await writer.write({
    kind: "result",
    operation: "chain-verify",
    ok: result.status === "valid",
    status: result.status,
    evidence: result.evidence,
    diagnostics: result.diagnostics,
    stats: result.stats,
  });
  return statusExit(result.status, result.diagnostics);
}

async function evidenceInspect(
  args: CliArgs,
  streams: CliStreams,
  writer: LineWriter,
): Promise<number> {
  const input = await readJsonInput(args, streams);
  const schema = objectField(input, "$schema");
  const known = typeof schema === "string" && SCHEMA_ASSETS.some((asset) => asset.id === schema);
  const safeFields = inspectFields(input);
  const evidence = isEvidence(input) ? input : undefined;
  await writer.write({
    kind: "inspection",
    operation: "evidence-inspect",
    recognized: known,
    valid: evidence !== undefined && createEngine().digestEvidence(evidence).ok,
    fields: safeFields,
  });
  return 0;
}

async function evidenceDigest(
  args: CliArgs,
  streams: CliStreams,
  writer: LineWriter,
): Promise<number> {
  const input = await readJsonInput(args, streams);
  const result = createEngine().digestEvidence(evidenceValue(input));
  await writer.write({
    kind: "result",
    operation: "evidence-digest",
    ok: result.ok,
    ...(result.ok
      ? { value: { algorithm: result.value.algorithm, digest: result.value.toHex() } }
      : {}),
    diagnostics: result.diagnostics,
  });
  return result.ok ? 0 : highestExit(result.diagnostics);
}

async function vectorsVerify(
  _args: CliArgs,
  _streams: CliStreams,
  writer: LineWriter,
): Promise<number> {
  const vectorDirectory = resolve(enginePackageRoot(), "vectors");
  for (const asset of VECTOR_SET.files) {
    const bytes = await readFile(resolve(vectorDirectory, asset.path));
    const digest = createHash("sha256").update(bytes).digest("hex");
    if (digest !== asset.sha256) throw new CliError("EVIDENCE_INVALID", 3);
    parseJsonDocument(bytes.toString("utf8"), JSON_LIMITS);
  }
  await writer.write({ kind: "result", operation: "vectors-verify", ok: true, value: VECTOR_SET });
  return 0;
}

async function schemaPrint(
  args: CliArgs,
  _streams: CliStreams,
  writer: LineWriter,
): Promise<number> {
  const requested = args.values.get("schema") ?? args.values.get("name");
  const asset = SCHEMA_ASSETS.find(
    (candidate) => candidate.name === requested || candidate.id === requested,
  );
  if (asset === undefined) throw new CliError("EVIDENCE_SCHEMA_UNKNOWN", 7);
  const schema = parseJsonDocument(
    decodeUtf8(await readFile(resolve(enginePackageRoot(), "schemas", asset.path))),
    JSON_LIMITS,
  );
  await writer.write({ kind: "result", operation: "schema-print", ok: true, value: schema });
  return 0;
}

function parseArguments(
  argv: readonly string[],
  stdout: Writable & { readonly isTTY?: boolean },
): CliArgs {
  const values = new Map<string, string>();
  const flags = new Set<string>();
  const valueFlags = new Set([
    "input",
    "evidence",
    "config",
    "profile",
    "algorithm",
    "context",
    "sequence",
    "mode",
    "output",
    "output-file",
    "expected-count",
    "expected-final-link-digest",
    "expected-previous",
    "start-position",
    "schema",
    "name",
    "error-mode",
  ]);
  const booleanFlags = new Set([
    "help",
    "force",
    "atomic-output",
    "quiet",
    "allow-empty",
    "fail-fast",
  ]);
  const command: string[] = [];
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === undefined) continue;
    if (!token.startsWith("-")) {
      command.push(token);
      continue;
    }
    const key = token.replace(/^-+/u, "");
    if (key.length === 0 || (!valueFlags.has(key) && !booleanFlags.has(key)))
      throw new CliError("INPUT_TYPE_INVALID", 2);
    if (values.has(key) || flags.has(key)) throw new CliError("INPUT_TYPE_INVALID", 2);
    if (booleanFlags.has(key)) flags.add(key);
    else {
      const value = argv[index + 1];
      if (value === undefined || (value.startsWith("-") && value !== "-")) {
        throw new CliError("INPUT_TYPE_INVALID", 2);
      }
      values.set(key, value);
      index += 1;
    }
  }
  const formatValue = values.get("output");
  const format = formatValue ?? (stdout.isTTY ? "human" : "ndjson");
  if (format !== "json" && format !== "ndjson" && format !== "human")
    throw new CliError("INPUT_TYPE_INVALID", 2);
  const outputPath = values.get("output-file");
  return Object.freeze({
    command: Object.freeze(command),
    values,
    flags,
    format,
    ...(outputPath === undefined ? {} : { outputPath }),
    force: flags.has("force"),
    atomic: flags.has("atomic-output"),
    quiet: flags.has("quiet"),
  });
}

function decodeRecordInput(value: unknown, args: CliArgs): RecordInput {
  const object = requireObject(value);
  requireAllowedKeys(object, ["contextId", "recordId", "profile", "algorithm", "payload"]);
  if (!Object.hasOwn(object, "contextId") && args.values.get("context") === undefined)
    throw new CliError("INPUT_TYPE_INVALID", 3);
  if (!Object.hasOwn(object, "profile") && args.values.get("profile") === undefined)
    throw new CliError("INPUT_TYPE_INVALID", 3);
  if (!Object.hasOwn(object, "algorithm") && args.values.get("algorithm") === undefined)
    throw new CliError("INPUT_TYPE_INVALID", 3);
  if (!Object.hasOwn(object, "recordId") || !Object.hasOwn(object, "payload"))
    throw new CliError("INPUT_TYPE_INVALID", 3);
  return {
    contextId: stringOverride(object, "contextId", args.values.get("context")),
    recordId: stringField(object, "recordId"),
    profile: profileOverride(object, args.values.get("profile")),
    algorithm: algorithmOverride(object, args.values.get("algorithm")),
    payload: decodePayload(objectField(object, "payload")),
  };
}

function decodeChainConfig(value: unknown, args: CliArgs): ChainConfig {
  const object = requireObject(value);
  requireAllowedKeys(object, [
    "contextId",
    "sequenceId",
    "profile",
    "algorithm",
    "duplicatePolicy",
    "allowEmpty",
  ]);
  const duplicatePolicy = objectField(object, "duplicatePolicy");
  const allowEmpty = objectField(object, "allowEmpty");
  return {
    contextId: stringOverride(object, "contextId", args.values.get("context")),
    sequenceId: stringOverride(object, "sequenceId", args.values.get("sequence")),
    profile: profileOverride(object, args.values.get("profile")),
    algorithm: algorithmOverride(object, args.values.get("algorithm")),
    ...(duplicatePolicy === undefined
      ? {}
      : { duplicatePolicy: duplicatePolicyField(duplicatePolicy) }),
    ...(args.flags.has("allow-empty") || allowEmpty !== undefined
      ? {
          allowEmpty: booleanField(args.flags.has("allow-empty") ? true : allowEmpty, "allowEmpty"),
        }
      : {}),
  };
}

function decodeVerifyConfig(value: unknown, args: CliArgs): Omit<VerifyChainInput, "records"> {
  const object = requireObject(value);
  requireAllowedKeys(object, [
    "contextId",
    "sequenceId",
    "profile",
    "algorithm",
    "mode",
    "expectedCount",
    "expectedFinalLinkDigest",
    "expectedPrevious",
    "startPosition",
    "allowEmpty",
    "duplicatePolicy",
  ]);
  const expectedCount = objectField(object, "expectedCount");
  const expectedFinalLinkDigest = objectField(object, "expectedFinalLinkDigest");
  const expectedPrevious = objectField(object, "expectedPrevious");
  const startPosition = objectField(object, "startPosition");
  const allowEmpty = objectField(object, "allowEmpty");
  const duplicatePolicy = objectField(object, "duplicatePolicy");
  const expectedCountFlag = args.values.get("expected-count");
  const expectedFinalFlag = args.values.get("expected-final-link-digest");
  const expectedPreviousFlag = args.values.get("expected-previous");
  const startPositionFlag = args.values.get("start-position");
  const expectedPreviousValue =
    expectedPreviousFlag === undefined
      ? expectedPrevious
      : parseJsonDocument(expectedPreviousFlag, JSON_LIMITS);
  const expectedCountValue =
    expectedCountFlag === undefined ? expectedCount : parseCliInteger(expectedCountFlag);
  const startPositionValue =
    startPositionFlag === undefined ? startPosition : parseCliInteger(startPositionFlag);
  return {
    contextId: stringOverride(object, "contextId", args.values.get("context")),
    sequenceId: stringOverride(object, "sequenceId", args.values.get("sequence")),
    profile: profileOverride(object, args.values.get("profile")),
    algorithm: algorithmOverride(object, args.values.get("algorithm")),
    mode: modeFieldValue(args.values.get("mode") ?? modeField(object, "mode")),
    ...(expectedCountValue === undefined
      ? {}
      : { expectedCount: safeIntegerField(expectedCountValue, "expectedCount") }),
    ...((expectedFinalFlag ?? expectedFinalLinkDigest) === undefined
      ? {}
      : {
          expectedFinalLinkDigest: stringValue(
            expectedFinalFlag ?? expectedFinalLinkDigest,
            "expectedFinalLinkDigest",
          ),
        }),
    ...(expectedPreviousValue === undefined
      ? {}
      : { expectedPrevious: previousField(expectedPreviousValue) }),
    ...(startPositionValue === undefined
      ? {}
      : { startPosition: safeIntegerField(startPositionValue, "startPosition") }),
    ...(args.flags.has("allow-empty") || allowEmpty !== undefined
      ? {
          allowEmpty: booleanField(args.flags.has("allow-empty") ? true : allowEmpty, "allowEmpty"),
        }
      : {}),
    ...(duplicatePolicy === undefined
      ? {}
      : { duplicatePolicy: duplicatePolicyField(duplicatePolicy) }),
  };
}

function decodePayload(value: unknown): unknown {
  if (!isObject(value)) return value;
  const kind = objectField(value, "kind");
  if (kind === "json" && Object.keys(value).length === 2) return objectField(value, "value");
  if (kind === "bytes" && Object.keys(value).length === 2)
    return decodeHex(stringField(value, "hex"));
  return value;
}

function decodeHex(value: string): Uint8Array {
  if (!/^(?:[0-9a-f]{2})*$/u.test(value)) throw new CliError("DIGEST_ENCODING_INVALID", 3);
  return Uint8Array.from(Buffer.from(value, "hex"));
}

async function readJsonInput(args: CliArgs, streams: CliStreams): Promise<unknown> {
  const path = requiredValue(args, "input");
  const bytes = path === "-" ? await readAll(streams.stdin) : await readFile(path);
  return parseJsonDocument(decodeUtf8(bytes), JSON_LIMITS);
}

async function readJsonFile(path: string): Promise<unknown> {
  return parseJsonDocument(decodeUtf8(await readFile(path)), JSON_LIMITS);
}

async function readConfig(args: CliArgs, streams: CliStreams): Promise<unknown> {
  const path = args.values.get("config");
  if (path === undefined) return Object.freeze({});
  return path === "-"
    ? parseJsonDocument(decodeUtf8(await readAll(streams.stdin)), JSON_LIMITS)
    : readJsonFile(path);
}

async function* decodeChainRecords(
  values: AsyncIterable<unknown>,
): AsyncGenerator<ChainRecordInput> {
  for await (const value of values) yield decodeChainRecord(value);
}

function decodeChainRecord(value: unknown): ChainRecordInput {
  const object = requireObject(value);
  requireExactKeys(object, ["recordId", "payload", "position", "previous"]);
  return Object.freeze({
    recordId: stringField(object, "recordId"),
    payload: decodePayload(objectField(object, "payload")),
    position: safeIntegerField(objectField(object, "position"), "position"),
    previous: previousField(objectField(object, "previous")),
  });
}

async function* decodeVerifyRecords(
  values: AsyncIterable<unknown>,
): AsyncGenerator<{ readonly payload: unknown; readonly evidence: unknown }> {
  for await (const value of values) yield decodeVerifyRecord(value);
}

function decodeVerifyRecord(value: unknown): {
  readonly payload: unknown;
  readonly evidence: unknown;
} {
  const object = requireObject(value);
  if (
    !Object.hasOwn(object, "payload") ||
    !Object.hasOwn(object, "evidence") ||
    Object.keys(object).length !== 2
  ) {
    throw new CliError("INPUT_TYPE_INVALID", 3);
  }
  return Object.freeze({ payload: decodePayload(object["payload"]), evidence: object["evidence"] });
}

function inputChunks(args: CliArgs, streams: CliStreams): AsyncIterable<Uint8Array> {
  const path = requiredValue(args, "input");
  return path === "-" ? streams.stdin : createReadStream(path);
}

async function readAll(chunks: AsyncIterable<Uint8Array>): Promise<Buffer> {
  const parts: Buffer[] = [];
  let length = 0;
  for await (const chunk of chunks) {
    const part = Buffer.from(chunk);
    length += part.length;
    if (length > DEFAULT_JSON_MAX_BYTES) throw new CliError("INPUT_LIMIT_EXCEEDED", 5);
    parts.push(part);
  }
  return Buffer.concat(parts);
}

function installAbortController(): { readonly signal: AbortSignal; dispose(): void } {
  const controller = new AbortController();
  /* Signal delivery is exercised by the OS signal gate. */
  /* node:coverage disable */
  const handler = (): void => {
    controller.abort();
  };
  /* node:coverage enable */
  process.once("SIGINT", handler);
  return { signal: controller.signal, dispose: () => process.off("SIGINT", handler) };
}

function inspectFields(value: unknown): Readonly<Record<string, unknown>> {
  if (!isObject(value)) return Object.freeze({});
  const allowed = [
    "$schema",
    "protocolVersion",
    "contextId",
    "recordId",
    "sequenceId",
    "profile",
    "algorithm",
    "normalizedByteLength",
    "contentDigest",
    "recordDigest",
    "previous",
    "linkDigest",
    "position",
    "count",
    "firstPosition",
    "lastPosition",
    "firstLinkDigest",
    "finalLinkDigest",
    "boundaries",
    "status",
    "diagnostics",
  ];
  const output: Record<string, unknown> = {};
  for (const key of allowed) {
    const field = objectField(value, key);
    if (field !== undefined) output[key] = field;
  }
  return Object.freeze(output);
}

function requireObject(value: unknown): Record<string, unknown> {
  if (!isObject(value)) throw new CliError("INPUT_TYPE_INVALID", 3);
  return value;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function objectField(value: unknown, key: string): unknown {
  return isObject(value) ? value[key] : undefined;
}

function stringField(value: Record<string, unknown>, key: string): string {
  const field = value[key];
  if (typeof field !== "string") throw new CliError("INPUT_TYPE_INVALID", 3);
  return field;
}

function stringValue(value: unknown, key: string): string {
  if (typeof value !== "string") throw new CliError("INPUT_TYPE_INVALID", 3);
  void key;
  return value;
}

function stringOverride(
  value: Record<string, unknown>,
  key: string,
  flag: string | undefined,
): string {
  return flag ?? stringField(value, key);
}

function algorithmField(value: Record<string, unknown>, key: string): AlgorithmId {
  const algorithm = stringField(value, key);
  if (algorithm !== "sha-256" && algorithm !== "sha-384" && algorithm !== "sha-512") {
    throw new CliError("ALGORITHM_UNKNOWN", 7);
  }
  return algorithm;
}

function modeField(value: Record<string, unknown>, key: string): VerifyChainInput["mode"] {
  return modeFieldValue(stringField(value, key));
}

function modeFieldValue(value: unknown): VerifyChainInput["mode"] {
  if (typeof value !== "string") throw new CliError("INPUT_TYPE_INVALID", 3);
  const mode = value;
  /* Invalid mode is covered by the CLI negative matrix. */
  /* node:coverage ignore next */
  if (mode !== "complete" && mode !== "fragment" && mode !== "internal") {
    throw new CliError("INPUT_TYPE_INVALID", 3);
  }
  return mode;
}

function algorithmOverride(value: Record<string, unknown>, flag: string | undefined): AlgorithmId {
  return flag === undefined
    ? algorithmField(value, "algorithm")
    : algorithmField({ algorithm: flag }, "algorithm");
}

function booleanField(value: unknown, key: string): boolean {
  if (typeof value !== "boolean") throw new CliError("INPUT_TYPE_INVALID", 3);
  void key;
  return value;
}

function safeIntegerField(value: unknown, key: string): number {
  /* Invalid numeric forms are covered by the CLI negative matrix. */
  /* node:coverage ignore next */
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0) {
    throw new CliError("INPUT_TYPE_INVALID", 3);
  }
  void key;
  return value;
}

function parseCliInteger(value: string): number {
  if (!/^(?:0|[1-9][0-9]*)$/u.test(value)) throw new CliError("INPUT_TYPE_INVALID", 3);
  const parsed = Number(value);
  return safeIntegerField(parsed, "cli-integer");
}

function previousField(value: unknown): PreviousLink {
  const object = requireObject(value);
  const kind = objectField(object, "kind");
  if (kind === "none" && Object.keys(object).length === 1) return Object.freeze({ kind: "none" });
  if (kind === "digest" && Object.keys(object).length === 2) {
    return Object.freeze({ kind: "digest", value: stringField(object, "value") });
  }
  /* Malformed boundary variants are covered by the CLI negative matrix. */
  /* node:coverage ignore next */
  throw new CliError("INPUT_TYPE_INVALID", 3);
}

function duplicatePolicyField(value: unknown): DuplicatePolicy {
  const object = requireObject(value);
  const kind = objectField(object, "kind");
  if (kind === "none" && Object.keys(object).length === 1) return Object.freeze({ kind: "none" });
  if (kind === "window" && Object.keys(object).length === 2) {
    return Object.freeze({
      kind: "window",
      size: safeIntegerField(objectField(object, "size"), "size"),
    });
  }
  if (kind === "full" && Object.keys(object).length === 2) {
    return Object.freeze({
      kind: "full",
      maxRecords: safeIntegerField(objectField(object, "maxRecords"), "maxRecords"),
    });
  }
  /* Malformed duplicate policies are covered by the CLI negative matrix. */
  /* node:coverage ignore next */
  throw new CliError("INPUT_TYPE_INVALID", 3);
}

function profileField(value: Record<string, unknown>): ProfileReference {
  const profile = requireObject(value["profile"]);
  requireExactKeys(profile, ["id", "version"]);
  return { id: stringField(profile, "id"), version: stringField(profile, "version") };
}

function profileOverride(
  value: Record<string, unknown>,
  flag: string | undefined,
): ProfileReference {
  if (flag === undefined) return profileField(value);
  const separator = flag.lastIndexOf("@");
  if (separator <= 0 || separator === flag.length - 1) throw new CliError("INPUT_TYPE_INVALID", 3);
  return Object.freeze({ id: flag.slice(0, separator), version: flag.slice(separator + 1) });
}

function requireAllowedKeys(value: Record<string, unknown>, allowed: readonly string[]): void {
  const allowedSet = new Set(allowed);
  for (const key of Object.keys(value)) {
    if (!allowedSet.has(key)) throw new CliError("INPUT_TYPE_INVALID", 3);
  }
}

function requireExactKeys(value: Record<string, unknown>, expected: readonly string[]): void {
  requireAllowedKeys(value, expected);
  if (Object.keys(value).length !== expected.length) throw new CliError("INPUT_TYPE_INVALID", 3);
}

function isEvidence(value: unknown): value is Evidence {
  if (!isObject(value)) return false;
  const schema = value["$schema"];
  return (
    schema === "urn:noeos:verification-engine:record-evidence:1" ||
    schema === "urn:noeos:verification-engine:link-evidence:1" ||
    schema === "urn:noeos:verification-engine:chain-summary:1"
  );
}

function evidenceValue(value: unknown): Evidence {
  if (!isEvidence(value)) throw new CliError("EVIDENCE_SCHEMA_UNKNOWN", 7);
  return value;
}

function requiredValue(args: CliArgs, key: string): string {
  const value = args.values.get(key);
  if (value === undefined) throw new CliError("INPUT_REQUIRED", 2);
  return value;
}

function statusExit(
  status: string,
  diagnostics: readonly { readonly code: string; readonly severity: string }[],
): number {
  if (status === "valid") return 0;
  return highestExit(diagnostics);
}

function highestExit(
  diagnostics: readonly { readonly code: string; readonly severity: string }[],
): number {
  if (diagnostics.length === 0) return 70;
  const priority: Record<string, number> = {
    INTERNAL_INVARIANT_BROKEN: 70,
    IO_READ_FAILED: 6,
    IO_WRITE_FAILED: 6,
    INPUT_STREAM_FAILED: 3,
    OUTPUT_SINK_FAILED: 6,
    RESOURCE_BUDGET_EXCEEDED: 5,
    PROFILE_UNKNOWN: 7,
    PROFILE_VERSION_UNSUPPORTED: 7,
    ALGORITHM_UNKNOWN: 7,
    EVIDENCE_SCHEMA_UNKNOWN: 7,
    INPUT_TYPE_INVALID: 3,
    JSON_SYNTAX_INVALID: 3,
    JSON_DUPLICATE_KEY: 3,
    BOUNDARY_UNVERIFIED: 4,
    OPERATION_ABORTED: 130,
  };
  return diagnostics.reduce(
    (highest, diagnostic) =>
      Math.max(highest, priority[diagnostic.code] ?? (diagnostic.severity === "error" ? 1 : 0)),
    0,
  );
}

/* Error rendering is an I/O recovery boundary; protocol branches are gated separately. */
/* node:coverage disable */
async function writeError(stderr: Writable, error: unknown, original?: unknown): Promise<void> {
  const code =
    error instanceof CliError
      ? error.code
      : error instanceof CliInputError
        ? error.code
        : "INTERNAL_INVARIANT_BROKEN";
  const line =
    error instanceof CliInputError && error.line !== undefined ? ` line=${String(error.line)}` : "";
  const text = `${code}${line}${original === undefined ? "" : "\n"}\n`;
  if (!stderr.write(text))
    await new Promise<void>((resolvePromise) => stderr.once("drain", resolvePromise));
}
/* node:coverage enable */

/* Human/help output backpressure is an I/O boundary; machine semantics are gated separately. */
/* node:coverage disable */
async function writeText(stdout: Writable, text: string): Promise<void> {
  if (!stdout.write(text))
    await new Promise<void>((resolvePromise) => stdout.once("drain", resolvePromise));
}
/* node:coverage enable */

async function cliVersion(): Promise<string> {
  const packageEntry = fileURLToPath(import.meta.resolve("@noeos/verification-engine-cli"));
  const manifest = parseJsonDocument(
    decodeUtf8(await readFile(resolve(dirname(packageEntry), "../../package.json"))),
    JSON_LIMITS,
  );
  /* Package-manifest fallback requires corrupting the installed package metadata. */
  /* node:coverage disable */
  return isObject(manifest) && typeof manifest["version"] === "string"
    ? manifest["version"]
    : "0.0.0-invalid";
  /* node:coverage enable */
}

function cliErrorExitCode(error: unknown): number {
  if (error instanceof CliError) return error.exitCode;
  if (error instanceof CliInputError) return 3;
  if (isNodeIoError(error)) return 6;
  return 70;
}

/* Node errno classification is exercised by platform-specific I/O gates. */
/* node:coverage disable */
function isNodeIoError(error: unknown): boolean {
  return (
    isObject(error) &&
    typeof error["code"] === "string" &&
    ["EACCES", "EEXIST", "EISDIR", "ENOENT", "ENOTDIR", "EPIPE", "EPERM"].includes(error["code"])
  );
}
/* node:coverage enable */

function enginePackageRoot(): string {
  const entry = fileURLToPath(import.meta.resolve("@noeos/verification-engine"));
  return resolve(dirname(entry), "../..");
}

function help(command: readonly string[]): string {
  return `noeos-ve ${command.join(" ")}\nUse --help with a command. Output formats: json, ndjson, human.\n`;
}
