# `@noeos/verification-engine`

Deterministic, offline-first TypeScript engine for normalizing records, producing integrity evidence, building hash-linked chains, and verifying results with structured diagnostics.

[![CI](https://github.com/noeos/verification-engine/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/noeos/verification-engine/actions/workflows/ci.yml)
[![npm](https://img.shields.io/npm/v/@noeos/verification-engine?logo=npm)](https://www.npmjs.com/package/@noeos/verification-engine)
[![License](https://img.shields.io/badge/license-Apache--2.0-blue.svg)](https://github.com/noeos/verification-engine/blob/main/LICENSE)

## Install

```sh
npm install @noeos/verification-engine
```

The package has zero runtime dependencies and supports the reviewed Node.js 22.14+ and 24.x toolchains. It exposes ESM and CommonJS entry points, public TypeScript declarations, versioned schemas, normalization profiles, and conformance vectors.

## Quick start

```ts
import { createEngine } from "@noeos/verification-engine";

const result = createEngine().hashRecord({
  contextId: "example.context",
  recordId: "record-001",
  payload: { amount: 42, currency: "EUR" },
  profile: { id: "dev.noeos.jcs", version: "1.0.0" },
  algorithm: "sha-256",
});

if (!result.ok) throw new Error(result.diagnostics.map(({ code }) => code).join(", "));
console.log(result.value.recordDigest);
```

Operations return explicit results rather than throwing for ordinary invalid input. Consumers can inspect diagnostics, use the streaming chain API, provide duplicate policies and limits, and abort long-running streams.

## Public subpaths

```ts
import { SCHEMA_ASSETS } from "@noeos/verification-engine/schemas";
import { BUILTIN_PROFILES } from "@noeos/verification-engine/profiles";
import { VECTOR_SET } from "@noeos/verification-engine/vectors";
```

The normative contracts and complete API reference are maintained in the [documentation](https://github.com/noeos/verification-engine/tree/main/docs), including the [public API](https://github.com/noeos/verification-engine/blob/main/docs/03-contratos/01-api-publica.md), [evidence model](https://github.com/noeos/verification-engine/blob/main/docs/02-dominio/02-cadena-evidencias.md), and [formats and limits](https://github.com/noeos/verification-engine/blob/main/docs/03-contratos/02-esquemas-formatos.md).

## Compatibility and verification

The stable package is built from the signed release tag and published through GitHub Actions with npm provenance. The [v1.0.1 release](https://github.com/noeos/verification-engine/releases/tag/v1.0.1) contains the release notes, checksums, attestations, SBOM, and verification evidence.

Read the [main README](https://github.com/noeos/verification-engine#readme) for the support matrix, local verification command, security boundaries, legal scope, and contribution policy. Report vulnerabilities privately through the [security policy](https://github.com/noeos/verification-engine/blob/main/SECURITY.md).

## License

Apache License 2.0. See the [license](https://github.com/noeos/verification-engine/blob/main/LICENSE) and [third-party notices](https://github.com/noeos/verification-engine/blob/main/NOTICE).
