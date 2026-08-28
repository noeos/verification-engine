// SPDX-License-Identifier: Apache-2.0

import { copyBytes } from "../domain/byte-view.js";

export interface ByteSink {
  readonly byteLength: number;
  write(value: Uint8Array): void;
}

export class ByteArraySink implements ByteSink {
  private buffer = new Uint8Array(0);

  private written = 0;

  constructor(private readonly maximum: number) {}

  get byteLength(): number {
    return this.written;
  }

  write(value: Uint8Array): void {
    if (value.length > this.maximum - this.written)
      throw new RangeError("byte sink limit exceeded");
    const required = this.written + value.length;
    if (required > this.buffer.length) {
      let capacity = Math.max(256, this.buffer.length);
      while (capacity < required) capacity = Math.min(this.maximum, capacity * 2);
      const expanded = new Uint8Array(capacity);
      expanded.set(this.buffer.subarray(0, this.written));
      this.buffer = expanded;
    }
    this.buffer.set(value, this.written);
    this.written += value.length;
  }

  toBytes(): Uint8Array {
    return copyBytes(this.buffer.subarray(0, this.written));
  }
}
