// SPDX-License-Identifier: Apache-2.0

import type { JsonArray, JsonObject, JsonValue } from "../domain/json-value.js";
import { types } from "node:util";
import type { Limits } from "../domain/limits.js";
import type { OperationResult } from "../domain/operation-result.js";
import { failure, success } from "../domain/operation-result.js";
import { DiagnosticCollector } from "./diagnostic-collector.js";
import { validateJsonValue } from "./json-value-validation.js";
import { decodeUtf8, encodeUtf8, hasWellFormedUnicode } from "./utf8-validation.js";
import { failureWithCode } from "./result-helpers.js";

export function parseJsonText(input: unknown, limits: Limits): OperationResult<JsonValue> {
  const source = decodeInput(input, limits);
  if (!source.ok) return source;
  const parser = new JsonTextParser(source.value, limits);
  const parsed = parser.parse();
  if (!parsed.ok) return parsed;
  return validateJsonValue(parsed.value, limits);
}

function decodeInput(input: unknown, limits: Limits): OperationResult<string> {
  if (types.isProxy(input)) return failureWithSyntax();
  if (input instanceof Uint8Array) {
    if (input.length > limits.maxPayloadBytes)
      return failureWithCode("INPUT_LIMIT_EXCEEDED", "input");
    return decodeUtf8(input);
  }
  if (typeof input !== "string") return failureWithSyntax();
  if (!hasWellFormedUnicode(input)) return failureWithSyntax();
  const encoded = encodeUtf8(input, limits.maxPayloadBytes);
  if (!encoded.ok) return encoded;
  return success(input);
}

function failureWithSyntax<T = string>(): OperationResult<T> {
  return failureWithCode("JSON_SYNTAX_INVALID", "input");
}

class JsonTextParser {
  private offset = 0;

  constructor(
    private readonly source: string,
    private readonly limits: Limits,
  ) {}

  parse(): OperationResult<JsonValue> {
    try {
      this.skipWhitespace();
      const value = this.parseValue(0, "");
      this.skipWhitespace();
      if (this.offset !== this.source.length) return this.syntaxFailure();
      return success(value);
    } catch (error) {
      if (error instanceof JsonParseFailure) {
        const collector = new DiagnosticCollector(this.limits);
        collector.addCode(error.code, "input", { path: error.path, position: this.offset });
        return failure(collector.finish());
      }
      const collector = new DiagnosticCollector(this.limits);
      collector.addCode("JSON_SYNTAX_INVALID", "input", { position: this.offset });
      return failure(collector.finish());
    }
  }

  private parseValue(depth: number, path: string): JsonValue {
    if (depth > this.limits.maxJsonDepth) this.fail("INPUT_LIMIT_EXCEEDED", path);
    const character = this.source[this.offset];
    if (character === "{") return this.parseObject(depth, path);
    if (character === "[") return this.parseArray(depth, path);
    if (character === '"') return this.parseString(path);
    if (character === "t") return this.parseLiteral("true", true);
    if (character === "f") return this.parseLiteral("false", false);
    if (character === "n") return this.parseLiteral("null", null);
    if (character === "-" || isDigit(character)) return this.parseNumber(path);
    this.fail("JSON_SYNTAX_INVALID", path);
  }

  private parseObject(depth: number, path: string): JsonObject {
    this.offset += 1;
    const output: Record<string, JsonValue> = {};
    const names = new Set<string>();
    this.skipWhitespace();
    if (this.consume("}")) return Object.freeze(output);
    let propertyCount = 0;
    while (this.offset < this.source.length) {
      if (propertyCount >= this.limits.maxObjectProperties) this.fail("INPUT_LIMIT_EXCEEDED", path);
      if (this.source[this.offset] !== '"') this.fail("JSON_SYNTAX_INVALID", path);
      const key = this.parseString(path);
      if (names.has(key)) this.fail("JSON_DUPLICATE_KEY", `${path}/${escapeJsonPointer(key)}`);
      names.add(key);
      this.skipWhitespace();
      if (!this.consume(":")) this.fail("JSON_SYNTAX_INVALID", path);
      this.skipWhitespace();
      const childPath = `${path}/${escapeJsonPointer(key)}`;
      const value = this.parseValue(depth + 1, childPath);
      Object.defineProperty(output, key, {
        configurable: false,
        enumerable: true,
        value,
        writable: false,
      });
      propertyCount += 1;
      this.skipWhitespace();
      if (this.consume("}")) return Object.freeze(output);
      if (!this.consume(",")) this.fail("JSON_SYNTAX_INVALID", path);
      this.skipWhitespace();
    }
    this.fail("JSON_SYNTAX_INVALID", path);
  }

  private parseArray(depth: number, path: string): JsonArray {
    this.offset += 1;
    const output: JsonValue[] = [];
    this.skipWhitespace();
    if (this.consume("]")) return Object.freeze(output);
    while (this.offset < this.source.length) {
      if (output.length >= this.limits.maxArrayElements) this.fail("INPUT_LIMIT_EXCEEDED", path);
      output.push(this.parseValue(depth + 1, `${path}/${String(output.length)}`));
      this.skipWhitespace();
      if (this.consume("]")) return Object.freeze(output);
      if (!this.consume(",")) this.fail("JSON_SYNTAX_INVALID", path);
      this.skipWhitespace();
    }
    this.fail("JSON_SYNTAX_INVALID", path);
  }

  private parseString(path: string): string {
    if (!this.consume('"')) this.fail("JSON_SYNTAX_INVALID", path);
    let output = "";
    while (this.offset < this.source.length) {
      const character = this.source.charAt(this.offset);
      this.offset += 1;
      if (character === '"') {
        if (!hasWellFormedUnicode(output)) this.fail("UTF8_INVALID", path);
        const encoded = encodeUtf8(output, this.limits.maxStringBytes);
        if (!encoded.ok) this.fail("INPUT_LIMIT_EXCEEDED", path);
        return output;
      }
      if (character === "\\") {
        output += this.parseEscape(path);
        continue;
      }
      if (character.charCodeAt(0) <= 0x1f) {
        this.fail("JSON_SYNTAX_INVALID", path);
      }
      output += character;
    }
    this.fail("JSON_SYNTAX_INVALID", path);
  }

  private parseEscape(path: string): string {
    const escape = this.source[this.offset];
    this.offset += 1;
    const simple: Readonly<Record<string, string>> = {
      '"': '"',
      "\\": "\\",
      "/": "/",
      b: "\b",
      f: "\f",
      n: "\n",
      r: "\r",
      t: "\t",
    };
    const simpleValue = escape === undefined ? undefined : simple[escape];
    if (simpleValue !== undefined) return simpleValue;
    if (escape !== "u") this.fail("JSON_SYNTAX_INVALID", path);
    const codePoint = this.parseHexCodeUnit(path);
    if (codePoint >= 0xd800 && codePoint <= 0xdbff) {
      if (this.source[this.offset] !== "\\" || this.source[this.offset + 1] !== "u") {
        this.fail("UTF8_INVALID", path);
      }
      this.offset += 2;
      const low = this.parseHexCodeUnit(path);
      if (low < 0xdc00 || low > 0xdfff) this.fail("UTF8_INVALID", path);
      return String.fromCodePoint(0x10000 + ((codePoint - 0xd800) << 10) + low - 0xdc00);
    }
    if (codePoint >= 0xdc00 && codePoint <= 0xdfff) this.fail("UTF8_INVALID", path);
    return String.fromCharCode(codePoint);
  }

  private parseHexCodeUnit(path: string): number {
    const value = this.source.slice(this.offset, this.offset + 4);
    if (!/^[0-9a-fA-F]{4}$/u.test(value)) this.fail("JSON_SYNTAX_INVALID", path);
    this.offset += 4;
    return Number.parseInt(value, 16);
  }

  private parseNumber(path: string): number {
    const start = this.offset;
    if (this.consume("-")) {
      if (!isDigit(this.source[this.offset])) this.fail("JSON_SYNTAX_INVALID", path);
    }
    if (this.consume("0")) {
      if (isDigit(this.source[this.offset])) this.fail("JSON_SYNTAX_INVALID", path);
    } else {
      if (!isNonZeroDigit(this.source[this.offset])) this.fail("JSON_SYNTAX_INVALID", path);
      while (isDigit(this.source[this.offset])) this.offset += 1;
    }
    if (this.consume(".")) {
      if (!isDigit(this.source[this.offset])) this.fail("JSON_SYNTAX_INVALID", path);
      while (isDigit(this.source[this.offset])) this.offset += 1;
    }
    if (this.source[this.offset] === "e" || this.source[this.offset] === "E") {
      this.offset += 1;
      if (this.source[this.offset] === "+" || this.source[this.offset] === "-") this.offset += 1;
      if (!isDigit(this.source[this.offset])) this.fail("JSON_SYNTAX_INVALID", path);
      while (isDigit(this.source[this.offset])) this.offset += 1;
    }
    const value = Number(this.source.slice(start, this.offset));
    if (!Number.isFinite(value) || (Number.isInteger(value) && !Number.isSafeInteger(value))) {
      this.fail("JSON_NUMBER_UNSAFE", path);
    }
    return value;
  }

  private parseLiteral<T extends JsonValue>(literal: string, value: T): T {
    if (this.source.slice(this.offset, this.offset + literal.length) !== literal) {
      this.fail("JSON_SYNTAX_INVALID", "");
    }
    this.offset += literal.length;
    return value;
  }

  private skipWhitespace(): void {
    while (
      this.source[this.offset] === " " ||
      this.source[this.offset] === "\n" ||
      this.source[this.offset] === "\r" ||
      this.source[this.offset] === "\t"
    ) {
      this.offset += 1;
    }
  }

  private consume(expected: string): boolean {
    if (this.source[this.offset] !== expected) return false;
    this.offset += 1;
    return true;
  }

  private fail(
    code:
      | "INPUT_LIMIT_EXCEEDED"
      | "JSON_DUPLICATE_KEY"
      | "JSON_NUMBER_UNSAFE"
      | "JSON_SYNTAX_INVALID"
      | "UTF8_INVALID",
    path: string,
  ): never {
    throw new JsonParseFailure(code, path);
  }

  private syntaxFailure(): OperationResult<JsonValue> {
    const collector = new DiagnosticCollector(this.limits);
    collector.addCode("JSON_SYNTAX_INVALID", "input", { position: this.offset });
    return failure(collector.finish());
  }
}

class JsonParseFailure extends Error {
  constructor(
    readonly code:
      | "INPUT_LIMIT_EXCEEDED"
      | "JSON_DUPLICATE_KEY"
      | "JSON_NUMBER_UNSAFE"
      | "JSON_SYNTAX_INVALID"
      | "UTF8_INVALID",
    readonly path: string,
  ) {
    super(code);
  }
}

function isDigit(value: string | undefined): boolean {
  return value !== undefined && value >= "0" && value <= "9";
}

function isNonZeroDigit(value: string | undefined): boolean {
  return value !== undefined && value >= "1" && value <= "9";
}

function escapeJsonPointer(value: string): string {
  return value.replaceAll("~", "~0").replaceAll("/", "~1");
}
