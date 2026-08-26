// SPDX-License-Identifier: Apache-2.0

export function containsPossibleSecret(source) {
  const privateKeyHeader = ["-----BEGIN ", "PRIVATE KEY-----"].join("");
  const token = new RegExp(
    `(?:${privateKeyHeader}|AKIA[0-9A-Z]{16}|ASIA[0-9A-Z]{16}|AIza[0-9A-Za-z_-]{35}|github_pat_[A-Za-z0-9_]{30,}|npm_[A-Za-z0-9]{30,}|gh[opsur]_[A-Za-z0-9_]{30,}|sk_live_[A-Za-z0-9]{20,}|rk_live_[A-Za-z0-9]{20,}|xox[baprs]-[A-Za-z0-9-]{10,})`,
    "u",
  );
  return token.test(source);
}

export function containsUnresolvedMarker(source) {
  const names = ["TO", "DO", "FIX", "ME", "TB", "D", "CHANGE", "ME"];
  const marker = new RegExp(
    `\\b(?:${names[0]}${names[1]}|${names[2]}${names[3]}|${names[4]}${names[5]}|${names[6]}${names[7]})\\b|<place(?:holder)>`,
    "u",
  );
  return marker.test(source);
}

export function isAllowedPackedPath(path) {
  return /^(?:CHANGELOG\.md|LICENSE|NOTICE|README\.md|package\.json|dist\/(?:cjs|esm|types)\/[a-z0-9./-]+|schemas\/[a-z0-9./-]+\.json)$/u.test(
    path,
  );
}

export function isExactVersion(version) {
  return /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/u.test(version);
}

export function isPinnedAction(reference) {
  if (reference.startsWith("./") || reference.startsWith("docker://")) {
    return true;
  }
  const separator = reference.lastIndexOf("@");
  return separator >= 0 && /^[0-9a-f]{40}$/u.test(reference.slice(separator + 1));
}
