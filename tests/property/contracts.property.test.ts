// SPDX-License-Identifier: Apache-2.0

import assert from "node:assert/strict";
import { test } from "node:test";

import fc from "fast-check";

import { encodeFrame } from "../../scripts/protocol-reference.mjs";

void test("framing is deterministic and changes when any committed UTF-8 field changes", () => {
  fc.assert(
    fc.property(
      fc.stringMatching(/^[A-Za-z0-9._:/-]{1,24}$/u),
      fc.stringMatching(/^[A-Za-z0-9._:/-]{1,24}$/u),
      (left, right) => {
        fc.pre(left !== right);
        const common = {
          kind: "content",
          fields: [
            { tag: 1, type: "utf8", value: "sha-256" },
            { tag: 2, type: "utf8", value: left },
          ],
        } as const;
        const changed = {
          ...common,
          fields: [
            { tag: 1, type: "utf8", value: "sha-256" },
            { tag: 2, type: "utf8", value: right },
          ],
        } as const;
        assert.deepEqual(encodeFrame(common), encodeFrame(common));
        assert.notDeepEqual(encodeFrame(common), encodeFrame(changed));
      },
    ),
    { numRuns: 250 },
  );
});

void test("framing encodes zero, one, 255, and 256 byte lengths without ambiguity", () => {
  const lengths = [0, 1, 255, 256];
  const frame = encodeFrame({
    kind: "content",
    fields: lengths.map((length, index) => ({
      tag: index + 1,
      type: "bytes",
      value: "00".repeat(length),
    })),
  });
  let offset = 13;
  for (const length of lengths) {
    assert.equal(frame.readBigUInt64BE(offset + 3), BigInt(length));
    offset += 11 + length;
  }
  assert.equal(offset, frame.length);
});
