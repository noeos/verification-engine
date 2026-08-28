// SPDX-License-Identifier: Apache-2.0

/** @public */
export interface BuiltinProfile {
  readonly id: string;
  readonly version: string;
  readonly inputKind: "json" | "bytes";
}

/** @public */
export const BUILTIN_PROFILES: readonly BuiltinProfile[] = Object.freeze([
  Object.freeze({ id: "dev.noeos.raw-bytes", version: "1.0.0", inputKind: "bytes" }),
  Object.freeze({ id: "dev.noeos.jcs", version: "1.0.0", inputKind: "json" }),
]);
