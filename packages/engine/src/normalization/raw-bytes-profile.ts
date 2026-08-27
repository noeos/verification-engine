// SPDX-License-Identifier: Apache-2.0

import { types } from "node:util";
import type { OperationResult } from "../domain/operation-result.js";
import { ProfileId } from "../domain/identifiers.js";
import { ProfileVersion } from "../domain/version.js";
import { success } from "../domain/operation-result.js";
import type { ByteSink } from "./byte-sink.js";
import { failureWithCode } from "../validation/result-helpers.js";
import type { Limits } from "../domain/limits.js";
import type { NormalizationProfile, NormalizationStats } from "./profile.js";

const RAW_PROFILE_ID = ProfileId.fromValidated("dev.noeos.raw-bytes");
const RAW_PROFILE_VERSION = ProfileVersion.fromValidated("1.0.0");

export const rawBytesProfile: NormalizationProfile<Uint8Array> = Object.freeze({
  id: RAW_PROFILE_ID,
  version: RAW_PROFILE_VERSION,
  inputKind: "bytes",
  validate(input: unknown, limits: Limits): OperationResult<Uint8Array> {
    if (types.isProxy(input) || !(input instanceof Uint8Array))
      return failureWithCode("INPUT_TYPE_INVALID", "input");
    if (input.length > limits.maxPayloadBytes)
      return failureWithCode("INPUT_LIMIT_EXCEEDED", "input");
    return success(Uint8Array.from(input));
  },
  normalize(input: Uint8Array, sink: ByteSink): OperationResult<NormalizationStats> {
    sink.write(input);
    return success(Object.freeze({ byteLength: input.length }));
  },
});
