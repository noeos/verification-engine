// SPDX-License-Identifier: Apache-2.0

/** Algorithms available to protocol 1 creation and verification. */
/** @public */
export type AlgorithmId = "sha-256" | "sha-384" | "sha-512";

export const ALGORITHM_IDS: readonly AlgorithmId[] = ["sha-256", "sha-384", "sha-512"];
