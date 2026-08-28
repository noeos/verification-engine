// SPDX-License-Identifier: Apache-2.0

import { open, rename, rm, lstat } from "node:fs/promises";
import { resolve } from "node:path";
import type { Writable } from "node:stream";

export type OutputFormat = "json" | "ndjson" | "human";

export interface OutputOptions {
  readonly path?: string;
  readonly force: boolean;
  readonly atomic: boolean;
}

export interface LineWriter {
  write(value: unknown): Promise<void>;
  close(success: boolean): Promise<void>;
}

export async function openLineWriter(
  format: OutputFormat,
  options: OutputOptions,
  stdout: Writable,
): Promise<LineWriter> {
  if (options.path === undefined) {
    return new StreamLineWriter(format, stdout);
  }
  const outputPath = resolve(options.path);
  await ensureOutputPath(outputPath, options.force);
  const target = options.atomic ? await createTemporaryPath(outputPath) : outputPath;
  const handle = await open(target, options.atomic ? "wx" : options.force ? "w" : "wx", 0o600);
  return new FileLineWriter(format, handle, outputPath, target, options.atomic);
}

class StreamLineWriter implements LineWriter {
  constructor(
    private readonly format: OutputFormat,
    private readonly stream: Writable,
  ) {}

  async write(value: unknown): Promise<void> {
    const text = formatValue(this.format, value);
    if (!this.stream.write(text)) {
      await onceDrain(this.stream);
    }
  }

  async close(): Promise<void> {
    // stdout/stderr belong to the host process and must never be closed by the CLI.
  }
}

class FileLineWriter implements LineWriter {
  constructor(
    private readonly format: OutputFormat,
    private readonly handle: Awaited<ReturnType<typeof open>>,
    private readonly outputPath: string,
    private readonly target: string,
    private readonly atomic: boolean,
    private readonly manifestPath = `${outputPath}.manifest.json`,
  ) {}

  async write(value: unknown): Promise<void> {
    await this.handle.write(formatValue(this.format, value), undefined, "utf8");
  }

  async close(success: boolean): Promise<void> {
    try {
      if (success) {
        await this.handle.sync();
        await this.handle.close();
        if (this.atomic) await rename(this.target, this.outputPath);
        else await writeCompletionManifest(this.manifestPath, true);
      } else {
        await this.handle.close();
        if (this.atomic) await rm(this.target, { force: true });
        else await writeCompletionManifest(this.manifestPath, false);
      }
      /* Defensive cleanup runs only after a second I/O failure. */
      /* node:coverage disable */
    } catch (error) {
      try {
        await this.handle.close();
      } catch {
        // Preserve the original output failure.
      }
      if (!this.atomic) {
        try {
          await writeCompletionManifest(this.manifestPath, false);
        } catch {
          // Preserve the original output failure.
        }
      }
      throw error;
    }
    /* node:coverage enable */
  }
}

function formatValue(format: OutputFormat, value: unknown): string {
  if (format === "human") return `${formatHuman(value)}\n`;
  const serialized = JSON.stringify(value);
  if (typeof serialized !== "string") throw new Error("output serialization failed");
  return `${serialized}\n`;
}

function formatHuman(value: unknown): string {
  if (typeof value !== "object" || value === null) return String(value);
  const record = value as {
    readonly operation?: unknown;
    readonly status?: unknown;
    readonly ok?: unknown;
  };
  const operationValue = record.operation;
  const statusValue = record.status;
  const okValue = record.ok;
  const operation = typeof operationValue === "string" ? operationValue : "operation";
  const status = typeof statusValue === "string" ? statusValue : okValue === true ? "ok" : "error";
  return `${operation}: ${status}`;
}

async function ensureOutputPath(path: string, force: boolean): Promise<void> {
  try {
    const current = await lstat(path);
    if (current.isSymbolicLink() || !current.isFile()) throw new Error("OUTPUT_EXISTS");
    if (!force) throw new Error("OUTPUT_EXISTS");
  } catch (error) {
    if (isMissing(error)) {
      return;
    }
    throw error;
  }
}

async function createTemporaryPath(path: string): Promise<string> {
  const base = `${path}.noeos-tmp-${String(process.pid)}`;
  for (let attempt = 0; attempt < 32; attempt += 1) {
    const candidate = `${base}-${String(attempt)}`;
    try {
      await lstat(candidate);
    } catch (error) {
      if (isMissing(error)) return candidate;
      throw error;
    }
  }
  /* Exhausting all 32 private temporary names is an operational collision. */
  /* node:coverage ignore next */
  throw new Error("IO_WRITE_FAILED");
}

async function writeCompletionManifest(path: string, complete: boolean): Promise<void> {
  const target = await createTemporaryPath(path);
  const handle = await open(target, "wx", 0o600);
  try {
    const value = JSON.stringify({ version: 1, complete, format: "ndjson" });
    await handle.write(`${value}\n`, undefined, "utf8");
    await handle.sync();
    await handle.close();
    await rename(target, path);
  } catch (error) {
    try {
      await handle.close();
    } catch {
      // Preserve the original manifest failure.
    }
    await rm(target, { force: true });
    throw error;
  }
}

function isMissing(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === "ENOENT";
}

function onceDrain(stream: Writable): Promise<void> {
  return new Promise((resolvePromise, reject) => {
    const onDrain = (): void => {
      stream.off("error", onError);
      resolvePromise();
    };
    const onError = (error: Error): void => {
      stream.off("drain", onDrain);
      reject(error);
    };
    stream.once("drain", onDrain);
    stream.once("error", onError);
  });
}
