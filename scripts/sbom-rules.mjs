// SPDX-License-Identifier: Apache-2.0

const cycloneDxAlgorithms = new Map([
  ["sha1", "SHA-1"],
  ["sha256", "SHA-256"],
  ["sha384", "SHA-384"],
  ["sha512", "SHA-512"],
]);

export function componentName(component) {
  return typeof component.group === "string" && component.group.length > 0
    ? `${component.group}/${component.name}`
    : component.name;
}

export function declaredLicenseExpressions(component) {
  const expressions = [];
  for (const entry of component.licenses ?? []) {
    if (typeof entry.expression === "string" && entry.expression.length > 0) {
      expressions.push(entry.expression);
    } else if (typeof entry.license?.id === "string" && entry.license.id.length > 0) {
      expressions.push(entry.license.id);
    } else if (typeof entry.license?.name === "string" && entry.license.name.length > 0) {
      expressions.push(entry.license.name);
    }
  }
  return [...new Set(expressions)].sort((left, right) => left.localeCompare(right, "en"));
}

export function hashesFromSri(integrity) {
  if (typeof integrity !== "string" || integrity.length === 0) {
    return [];
  }

  const hashes = [];
  for (const token of integrity.split(/\s+/u)) {
    const separator = token.indexOf("-");
    if (separator <= 0) {
      continue;
    }
    const sourceAlgorithm = token.slice(0, separator).toLocaleLowerCase("en");
    const algorithm = cycloneDxAlgorithms.get(sourceAlgorithm);
    const encoded = token.slice(separator + 1).split("?", 1)[0];
    if (algorithm === undefined || !/^[A-Za-z0-9+/]+={0,2}$/u.test(encoded)) {
      continue;
    }
    const content = Buffer.from(encoded, "base64").toString("hex");
    if (content.length > 0) {
      hashes.push({ alg: algorithm, content });
    }
  }
  return hashes;
}

export function spdxHashAlgorithm(cycloneDxAlgorithm) {
  const normalized = cycloneDxAlgorithm.toLocaleLowerCase("en").replaceAll("-", "");
  if (!new Set(["sha1", "sha256", "sha384", "sha512"]).has(normalized)) {
    throw new Error(`Unsupported SPDX hash algorithm: ${cycloneDxAlgorithm}`);
  }
  return normalized;
}
