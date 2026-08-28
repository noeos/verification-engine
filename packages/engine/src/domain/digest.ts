// SPDX-License-Identifier: Apache-2.0

import type { AlgorithmId } from "./algorithm-id.js";
import { copyBytes } from "./byte-view.js";

const HEX = "0123456789abcdef";
const TRUSTED_BYTES = new WeakMap<Digest, Uint8Array>();

/** @public */
export class Digest {
  private constructor(
    readonly algorithm: AlgorithmId,
    private readonly bytes: Uint8Array,
  ) {}

  static fromValidated(algorithm: AlgorithmId, bytes: Uint8Array): Digest {
    const digest = new Digest(algorithm, copyBytes(bytes));
    TRUSTED_BYTES.set(digest, digest.bytes);
    Object.freeze(digest);
    return digest;
  }

  toBytes(): Uint8Array {
    return copyBytes(this.bytes);
  }

  toHex(): string {
    let output = "";
    for (const byte of this.bytes) output += HEX.charAt(byte >>> 4) + HEX.charAt(byte & 0x0f);
    return output;
  }
}

/** Internal framing access; the returned view never escapes the trusted frame writer. */
export function digestBytesForTrustedFrame(value: Digest): Uint8Array {
  return TRUSTED_BYTES.get(value) ?? value.toBytes();
}
