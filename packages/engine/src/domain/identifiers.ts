// SPDX-License-Identifier: Apache-2.0

const recordIdBrand = Symbol("RecordId");
const sequenceIdBrand = Symbol("SequenceId");
const contextIdBrand = Symbol("ContextId");
const profileIdBrand = Symbol("ProfileId");

export class RecordId {
  readonly [recordIdBrand] = true;

  private constructor(readonly value: string) {}

  static fromValidated(value: string): RecordId {
    return Object.freeze(new RecordId(value));
  }
}

export class SequenceId {
  readonly [sequenceIdBrand] = true;

  private constructor(readonly value: string) {}

  static fromValidated(value: string): SequenceId {
    return Object.freeze(new SequenceId(value));
  }
}

export class ContextId {
  readonly [contextIdBrand] = true;

  private constructor(readonly value: string) {}

  static fromValidated(value: string): ContextId {
    return Object.freeze(new ContextId(value));
  }
}

export class ProfileId {
  readonly [profileIdBrand] = true;

  private constructor(readonly value: string) {}

  static fromValidated(value: string): ProfileId {
    return Object.freeze(new ProfileId(value));
  }
}
