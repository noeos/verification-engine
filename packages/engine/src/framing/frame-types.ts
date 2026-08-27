// SPDX-License-Identifier: Apache-2.0

export type FrameKind = "content" | "record" | "link" | "evidence";
export type FrameFieldType = "bytes" | "utf8" | "uint64" | "none";

export type FrameField =
  | { readonly tag: number; readonly type: "bytes"; readonly value: Uint8Array }
  | { readonly tag: number; readonly type: "utf8"; readonly value: string }
  | { readonly tag: number; readonly type: "uint64"; readonly value: number }
  | { readonly tag: number; readonly type: "none" };

export interface FrameInput {
  readonly kind: FrameKind;
  readonly fields: readonly FrameField[];
}

export interface ParsedFrame {
  readonly kind: FrameKind;
  readonly protocolVersion: 1;
  readonly fields: readonly FrameField[];
}
