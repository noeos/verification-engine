// SPDX-License-Identifier: Apache-2.0

import { copyBytes } from "../domain/byte-view.js";

export interface ByteSink {
  readonly byteLength: number;
  write(value: Uint8Array): void;
}

export class ByteArraySink implements ByteSink {
  private readonly chunks: Uint8Array[] = [];

  private written = 0;

  constructor(private readonly maximum: number) {}

  get byteLength(): number {
    return this.written;
  }

  write(value: Uint8Array): void {
    if (value.length > this.maximum - this.written)
      throw new RangeError("byte sink limit exceeded");
    const copy = copyBytes(value);
    this.chunks.push(copy);
    this.written += copy.length;
  }

  toBytes(): Uint8Array {
    const output = new Uint8Array(this.written);
    let offset = 0;
    for (const chunk of this.chunks) {
      output.set(chunk, offset);
      offset += chunk.length;
    }
    return output;
  }
}
