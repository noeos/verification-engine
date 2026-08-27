// SPDX-License-Identifier: Apache-2.0

const positionBrand = Symbol("Position");

export class Position {
  readonly [positionBrand] = true;

  private constructor(readonly value: number) {}

  static fromValidated(value: number): Position {
    return Object.freeze(new Position(value));
  }
}
