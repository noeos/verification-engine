// SPDX-License-Identifier: Apache-2.0

import type { AlgorithmId } from "./algorithm-id.js";
import { copyBytes } from "./byte-view.js";

/** @public */
export class Digest {
  private constructor(
    readonly algorithm: AlgorithmId,
    private readonly bytes: Uint8Array,
  ) {}

  static fromValidated(algorithm: AlgorithmId, bytes: Uint8Array): Digest {
    const digest = new Digest(algorithm, copyBytes(bytes));
    Object.freeze(digest);
    return digest;
  }

  toBytes(): Uint8Array {
    return copyBytes(this.bytes);
  }

  toHex(): string {
    let output = "";
    for (const byte of this.bytes) output += byte.toString(16).padStart(2, "0");
    return output;
  }
}
