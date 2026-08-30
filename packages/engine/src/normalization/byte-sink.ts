// SPDX-License-Identifier: Apache-2.0

import { copyBytes } from "../domain/byte-view.js";

const UTF8_ENCODER = new TextEncoder();

export interface ByteSink {
  readonly byteLength: number;
  write(value: Uint8Array): void;
}

export class ByteArraySink implements ByteSink {
  private buffer = new Uint8Array(0);

  private written = 0;

  constructor(
    private readonly maximum: number,
    initialCapacity = 0,
  ) {
    if (!Number.isSafeInteger(initialCapacity) || initialCapacity < 0) {
      throw new RangeError("invalid initial sink capacity");
    }
    const capacity = Math.min(maximum, Math.max(0, initialCapacity));
    if (capacity > 0) this.buffer = new Uint8Array(capacity);
  }

  get byteLength(): number {
    return this.written;
  }

  write(value: Uint8Array): void {
    this.ensureCapacity(value.length);
    this.buffer.set(value, this.written);
    this.written += value.length;
  }

  writeByte(value: number): void {
    if (!Number.isInteger(value) || value < 0 || value > 0xff)
      throw new RangeError("byte value out of range");
    this.ensureCapacity(1);
    this.buffer[this.written++] = value;
  }

  writeAscii(value: string): void {
    this.ensureCapacity(value.length);
    for (let index = 0; index < value.length; index += 1) {
      const code = value.charCodeAt(index);
      if (code > 0x7f) throw new RangeError("non-ASCII value");
      this.buffer[this.written++] = code;
    }
  }

  writeText(value: string): void {
    this.write(UTF8_ENCODER.encode(value));
  }

  toBytes(): Uint8Array {
    return copyBytes(this.buffer.subarray(0, this.written));
  }

  /** Internal ownership transfer; the returned view is never exposed to callers. */
  takeBytes(): Uint8Array {
    const bytes = this.buffer.subarray(0, this.written);
    this.buffer = new Uint8Array(0);
    this.written = 0;
    return bytes;
  }

  private ensureCapacity(additional: number): void {
    if (additional > this.maximum - this.written) throw new RangeError("byte sink limit exceeded");
    const required = this.written + additional;
    if (required <= this.buffer.length) return;
    let capacity = Math.max(256, this.buffer.length);
    while (capacity < required) capacity = Math.min(this.maximum, capacity * 2);
    const expanded = new Uint8Array(capacity);
    expanded.set(this.buffer.subarray(0, this.written));
    this.buffer = expanded;
  }
}
