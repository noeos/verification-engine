// SPDX-License-Identifier: Apache-2.0

const profileVersionBrand = Symbol("ProfileVersion");

export class ProfileVersion {
  readonly [profileVersionBrand] = true;

  private constructor(readonly value: string) {}

  static fromValidated(value: string): ProfileVersion {
    return Object.freeze(new ProfileVersion(value));
  }
}
