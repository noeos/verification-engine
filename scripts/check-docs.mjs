// SPDX-License-Identifier: Apache-2.0

import { access, readFile } from "node:fs/promises";
import { dirname, extname, resolve } from "node:path";

import { containsUnresolvedMarker } from "./policy-rules.mjs";
import { assertProjectRoot, listRepositoryFiles, projectRoot, toPosix } from "./project.mjs";

await assertProjectRoot();

const files = (await listRepositoryFiles()).filter((path) => extname(path) === ".md");
const failures = [];
const documents = new Map();
const definitionFiles = new Map([
  [resolve(projectRoot, "docs/00-gobierno/02-decisiones.md"), /^\|\s*(D-\d{3})\s*\|/gmu],
  [
    resolve(projectRoot, "docs/03-contratos/05-catalogo-codigos.md"),
    /^\|\s*(`?[A-Z][A-Z0-9_-]+`?)\s*\|/gmu,
  ],
]);

for (const file of files) {
  const source = await readFile(file, "utf8");
  const anchors = new Set();
  const headings = new Set();
  if (source.trim().length === 0) {
    failures.push(`${toPosix(file)} is empty`);
  }
  if (containsUnresolvedMarker(source)) {
    failures.push(`${toPosix(file)} contains an unresolved-work marker`);
  }

  for (const match of source.matchAll(/^#{1,6}\s+(.+)$/gmu)) {
    const heading = match[1].trim().toLocaleLowerCase("en");
    const anchor = markdownAnchor(match[1]);
    if (headings.has(heading) || anchors.has(anchor)) {
      failures.push(`${toPosix(file)} has duplicate heading: ${match[1]}`);
    }
    headings.add(heading);
    anchors.add(anchor);
  }
  documents.set(file, { anchors, source });
}

for (const [file, document] of documents) {
  for (const match of document.source.matchAll(/!?(?:\[[^\]]*\])\(([^)]+)\)/gu)) {
    const rawTarget = match[1].trim().replace(/^<|>$/gu, "");
    if (rawTarget.length === 0 || /^(?:https?:|mailto:)/u.test(rawTarget)) {
      continue;
    }

    const separator = rawTarget.indexOf("#");
    const rawPath = separator >= 0 ? rawTarget.slice(0, separator) : rawTarget;
    const rawFragment = separator >= 0 ? rawTarget.slice(separator + 1) : "";
    let target;
    let fragment;
    try {
      target = rawPath.length === 0 ? file : resolve(dirname(file), decodeURIComponent(rawPath));
      fragment = decodeURIComponent(rawFragment).toLocaleLowerCase("en");
    } catch {
      failures.push(`${toPosix(file)} contains malformed link encoding: ${rawTarget}`);
      continue;
    }

    try {
      await access(target);
    } catch {
      failures.push(`${toPosix(file)} links to missing path: ${rawTarget}`);
      continue;
    }

    if (fragment.length > 0 && extname(target) === ".md") {
      const targetDocument = documents.get(target);
      if (targetDocument === undefined || !targetDocument.anchors.has(fragment)) {
        failures.push(`${toPosix(file)} links to missing heading: ${rawTarget}`);
      }
    }
  }

  const definitionPattern = definitionFiles.get(file);
  if (definitionPattern !== undefined) {
    const identifiers = new Set();
    for (const match of document.source.matchAll(definitionPattern)) {
      const identifier = match[1].replaceAll("`", "");
      if (identifier === "Código" || identifier === "Code") {
        continue;
      }
      if (identifiers.has(identifier)) {
        failures.push(`${toPosix(file)} defines ${identifier} more than once`);
      }
      identifiers.add(identifier);
    }
  }
}

const decisionDefinitions = definitionsFrom(
  documents.get(resolve(projectRoot, "docs/00-gobierno/02-decisiones.md"))?.source,
  /^\|\s*(D-\d{3})\s*\|/gmu,
);
const requirementDefinitions = definitionsFrom(
  documents.get(resolve(projectRoot, "docs/00-gobierno/04-trazabilidad-requisitos.md"))?.source,
  /^\|\s*([A-Z]{3}-\d{3})\s*\|/gmu,
);
const controlDefinitions = definitionsFrom(
  documents.get(resolve(projectRoot, "docs/anexos/02-matriz-controles.md"))?.source,
  /^\|\s*(C-\d{2})\s*\|/gmu,
);
const requirementPrefixes = [...new Set([...requirementDefinitions].map((id) => id.slice(0, 3)))];

for (const [file, document] of documents) {
  verifyReferences(file, document.source.matchAll(/\bD-\d{3}\b/gu), decisionDefinitions);
  verifyReferences(file, document.source.matchAll(/\bC-\d{2}\b/gu), controlDefinitions);
  if (requirementPrefixes.length > 0) {
    const pattern = new RegExp(`\\b(?:${requirementPrefixes.join("|")})-\\d{3}\\b`, "gu");
    verifyReferences(file, document.source.matchAll(pattern), requirementDefinitions);
  }
}

if (failures.length > 0) {
  throw new AggregateError(
    failures.map((failure) => new Error(failure)),
    "Documentation checks failed",
  );
}

console.log(
  `Documentation checks passed for ${files.length} Markdown files and all governed references.`,
);

function definitionsFrom(source, pattern) {
  return new Set(
    source === undefined ? [] : [...source.matchAll(pattern)].map((match) => match[1]),
  );
}

function markdownAnchor(heading) {
  return heading
    .trim()
    .toLocaleLowerCase("en")
    .replace(/[`*_~]/gu, "")
    .replace(/[^\p{L}\p{N}\s_-]/gu, "")
    .replace(/\s+/gu, "-");
}

function verifyReferences(file, matches, definitions) {
  for (const match of matches) {
    const identifier = match[0];
    if (!definitions.has(identifier)) {
      failures.push(`${toPosix(file)} references undefined identifier: ${identifier}`);
    }
  }
}
