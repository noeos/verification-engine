// SPDX-License-Identifier: Apache-2.0

import { types } from "node:util";

export type DataProperty = readonly [name: string, value: unknown];

export type ExactPropertyValues = readonly unknown[];

interface DataPropertyDescriptor extends PropertyDescriptor {
  readonly value: unknown;
}

export function inspectPlainObject(value: unknown): readonly DataProperty[] | undefined {
  if (!isPlainObject(value)) return undefined;
  if (Object.getOwnPropertySymbols(value).length !== 0) return undefined;

  const descriptors = Object.getOwnPropertyDescriptors(value);
  const entries: DataProperty[] = [];
  for (const [name, descriptor] of Object.entries(descriptors)) {
    if (
      descriptor.enumerable !== true ||
      descriptor.get !== undefined ||
      descriptor.set !== undefined ||
      !isDataPropertyDescriptor(descriptor)
    ) {
      return undefined;
    }
    entries.push([name, descriptor.value]);
  }
  return Object.freeze(entries);
}

/** Internal fixed-shape inspection that preserves the no-getter/no-proxy boundary. */
export function inspectExactProperties(
  value: unknown,
  names: readonly string[],
): ExactPropertyValues | undefined {
  if (!isPlainObject(value)) return undefined;
  if (Object.getOwnPropertySymbols(value).length !== 0) return undefined;
  const ownNames = Object.getOwnPropertyNames(value);
  if (ownNames.length !== names.length) return undefined;
  const descriptors = Object.getOwnPropertyDescriptors(value);
  const values: unknown[] = [];
  for (const name of names) {
    const descriptor = descriptors[name];
    if (descriptor === undefined) return undefined;
    if (
      descriptor.enumerable !== true ||
      descriptor.get !== undefined ||
      descriptor.set !== undefined ||
      !isDataPropertyDescriptor(descriptor)
    ) {
      return undefined;
    }
    values.push(descriptor.value);
  }
  return values;
}

export function isDataPropertyDescriptor(
  descriptor: PropertyDescriptor,
): descriptor is DataPropertyDescriptor {
  return "value" in descriptor;
}

export function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (typeof value !== "object" || value === null || types.isProxy(value)) return false;
  const prototype = Reflect.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}
