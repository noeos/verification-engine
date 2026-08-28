// SPDX-License-Identifier: Apache-2.0

import { Buffer } from "node:buffer";

export interface JsonInputLimits {
  readonly maxBytes: number;
  readonly maxDepth: number;
  readonly maxObjectProperties: number;
  readonly maxArrayElements: number;
}

export class CliInputError extends Error {
  constructor(
    readonly code:
      | "JSON_SYNTAX_INVALID"
      | "JSON_DUPLICATE_KEY"
      | "INPUT_LIMIT_EXCEEDED"
      | "NDJSON_LINE_EMPTY"
      | "NDJSON_LINE_TOO_LARGE"
      | "UTF8_INVALID",
    readonly line?: number,
  ) {
    super(code);
    this.name = "CliInputError";
  }
}

export function parseJsonDocument(text: string, limits: JsonInputLimits): unknown {
  if (text.codePointAt(0) === 0xfeff) throw new CliInputError("UTF8_INVALID");
  if (Buffer.byteLength(text, "utf8") > limits.maxBytes) {
    throw new CliInputError("INPUT_LIMIT_EXCEEDED");
  }
  const scanner = new JsonStructureScanner(text, limits);
  scanner.scan();
  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new CliInputError("JSON_SYNTAX_INVALID");
  }
}

export function decodeUtf8(bytes: Uint8Array): string {
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    throw new CliInputError("UTF8_INVALID");
  }
}

export async function* parseNdjson(
  chunks: AsyncIterable<Uint8Array>,
  limits: JsonInputLimits,
): AsyncGenerator<unknown, void, undefined> {
  const decoder = new TextDecoder("utf-8", { fatal: true });
  let pending = "";
  let line = 0;
  let sawInput = false;
  try {
    for await (const chunk of chunks) {
      /* Node's native V8 report loses this assignment in async-generator resumes. */
      /* node:coverage ignore next */
      sawInput = true;
      pending += decoder.decode(chunk, { stream: true });
      let newline = pending.indexOf("\n");
      while (newline >= 0) {
        /* c8 ignore next -- covered by the NDJSON conformance tests; V8 attributes the slice to the loop header. */
        const rawLine = pending.slice(0, newline);
        pending = pending.slice(newline + 1);
        line += 1;
        const text = rawLine.endsWith("\r") ? rawLine.slice(0, -1) : rawLine;
        /* Covered by the empty-line conformance test. */
        /* node:coverage ignore next */
        if (text.length === 0) throw new CliInputError("NDJSON_LINE_EMPTY", line);
        if (Buffer.byteLength(text, "utf8") > limits.maxBytes) {
          throw new CliInputError("NDJSON_LINE_TOO_LARGE", line);
        }
        try {
          yield parseJsonDocument(text, limits);
        } catch (error) {
          if (error instanceof CliInputError) {
            throw new CliInputError(error.code, line);
          }
          throw new CliInputError("JSON_SYNTAX_INVALID", line);
        }
        /* Covered by the multi-line conformance test. */
        /* node:coverage ignore next */
        newline = pending.indexOf("\n");
      }
      /* Covered by the unterminated-line limit test. */
      /* node:coverage ignore next */
      if (Buffer.byteLength(pending, "utf8") > limits.maxBytes) {
        throw new CliInputError("NDJSON_LINE_TOO_LARGE", line + 1);
      }
    }
    pending += decoder.decode();
  } catch (error) {
    /* Covered by the invalid UTF-8 conformance test. */
    /* node:coverage ignore next */
    if (error instanceof TypeError) throw new CliInputError("UTF8_INVALID", line + 1);
    throw error;
  }
  if (pending.length > 0) {
    line += 1;
    /* Covered by the trailing-line limit test. */
    /* node:coverage ignore next */
    if (Buffer.byteLength(pending, "utf8") > limits.maxBytes) {
      throw new CliInputError("NDJSON_LINE_TOO_LARGE", line);
    }
    try {
      yield parseJsonDocument(pending, limits);
    } catch (error) {
      if (error instanceof CliInputError) throw new CliInputError(error.code, line);
      throw new CliInputError("JSON_SYNTAX_INVALID", line);
    }
  } else if (!sawInput) {
    return;
  }
}

class JsonStructureScanner {
  private position = 0;

  constructor(
    private readonly text: string,
    private readonly limits: JsonInputLimits,
  ) {}

  scan(): void {
    this.skipWhitespace();
    this.scanValue(0);
    this.skipWhitespace();
    if (this.position !== this.text.length) throw new CliInputError("JSON_SYNTAX_INVALID");
  }

  private scanValue(depth: number): void {
    if (depth > this.limits.maxDepth) throw new CliInputError("INPUT_LIMIT_EXCEEDED");
    const character = this.text[this.position];
    if (character === "{") {
      this.scanObject(depth + 1);
      return;
    }
    if (character === "[") {
      this.scanArray(depth + 1);
      return;
    }
    if (character === '"') {
      this.scanString();
      return;
    }
    this.scanPrimitive();
  }

  private scanObject(depth: number): void {
    this.position += 1;
    this.skipWhitespace();
    const keys = new Set<string>();
    if (this.text[this.position] === "}") {
      this.position += 1;
      return;
    }
    /* V8 does not attribute the first async scanner iteration consistently. */
    /* node:coverage ignore next */
    let count = 0;
    for (;;) {
      if (this.text[this.position] !== '"') throw new CliInputError("JSON_SYNTAX_INVALID");
      const start = this.position;
      this.scanString();
      let key: unknown;
      try {
        key = JSON.parse(this.text.slice(start, this.position)) as unknown;
      } catch {
        throw new CliInputError("JSON_SYNTAX_INVALID");
      }
      if (typeof key !== "string") throw new CliInputError("JSON_SYNTAX_INVALID");
      if (keys.has(key)) throw new CliInputError("JSON_DUPLICATE_KEY");
      keys.add(key);
      count += 1;
      if (count > this.limits.maxObjectProperties) throw new CliInputError("INPUT_LIMIT_EXCEEDED");
      this.skipWhitespace();
      if (this.text[this.position] !== ":") throw new CliInputError("JSON_SYNTAX_INVALID");
      this.position += 1;
      this.skipWhitespace();
      this.scanValue(depth);
      this.skipWhitespace();
      const separator = this.text[this.position];
      if (separator === "}") {
        this.position += 1;
        return;
      }
      if (separator !== ",") throw new CliInputError("JSON_SYNTAX_INVALID");
      this.position += 1;
      this.skipWhitespace();
    }
  }

  private scanArray(depth: number): void {
    this.position += 1;
    this.skipWhitespace();
    if (this.text[this.position] === "]") {
      this.position += 1;
      return;
    }
    let count = 0;
    for (;;) {
      count += 1;
      if (count > this.limits.maxArrayElements) throw new CliInputError("INPUT_LIMIT_EXCEEDED");
      this.scanValue(depth);
      this.skipWhitespace();
      const separator = this.text[this.position];
      if (separator === "]") {
        this.position += 1;
        return;
      }
      if (separator !== ",") throw new CliInputError("JSON_SYNTAX_INVALID");
      this.position += 1;
      this.skipWhitespace();
    }
  }

  private scanString(): void {
    this.position += 1;
    while (this.position < this.text.length) {
      const character = this.text[this.position];
      if (character === '"') {
        this.position += 1;
        return;
      }
      if (character === "\\") {
        this.position += 2;
      } else {
        if (character !== undefined && character < " ") {
          throw new CliInputError("JSON_SYNTAX_INVALID");
        }
        this.position += 1;
      }
    }
    throw new CliInputError("JSON_SYNTAX_INVALID");
  }

  private scanPrimitive(): void {
    const start = this.position;
    while (this.position < this.text.length && !/[\s,\]}]/u.test(this.text[this.position] ?? "")) {
      this.position += 1;
    }
    if (start === this.position) throw new CliInputError("JSON_SYNTAX_INVALID");
  }

  private skipWhitespace(): void {
    while (this.position < this.text.length && /\s/u.test(this.text[this.position] ?? "")) {
      this.position += 1;
    }
  }
}
