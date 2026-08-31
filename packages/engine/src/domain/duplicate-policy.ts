// SPDX-License-Identifier: Apache-2.0

/** @public */
export type DuplicateKind = "record-id" | "content-digest" | "link-digest" | "fork";

/** @public */
export interface DuplicateObservation {
  readonly kind: DuplicateKind;
  readonly key: string;
  readonly value?: string;
}

/** @public */
export interface ExternalDuplicateIndex {
  /** Must inspect and commit the batch atomically, with no partial write on a fatal duplicate. */
  observe(batch: readonly DuplicateObservation[]): unknown;
}

/** @public */
export type DuplicatePolicy =
  | { readonly kind: "none" }
  | { readonly kind: "window"; readonly size: number }
  | { readonly kind: "full"; readonly maxRecords: number }
  | { readonly kind: "external"; readonly index: ExternalDuplicateIndex };
