# Noeos Verification Engine

[![CI](https://github.com/noeos/verification-engine/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/noeos/verification-engine/actions/workflows/ci.yml)
[![Security](https://github.com/noeos/verification-engine/actions/workflows/security.yml/badge.svg?branch=main)](https://github.com/noeos/verification-engine/actions/workflows/security.yml)
[![Performance evidence](https://github.com/noeos/verification-engine/actions/workflows/performance.yml/badge.svg?branch=main)](https://github.com/noeos/verification-engine/actions/workflows/performance.yml)
[![Release verification](https://github.com/noeos/verification-engine/actions/workflows/release-verification.yml/badge.svg?branch=main)](https://github.com/noeos/verification-engine/actions/workflows/release-verification.yml)
[![Release](https://img.shields.io/github/v/release/noeos/verification-engine?display_name=tag&sort=semver)](https://github.com/noeos/verification-engine/releases)
[![npm engine](https://img.shields.io/npm/v/@noeos/verification-engine?logo=npm)](https://www.npmjs.com/package/@noeos/verification-engine)
[![npm CLI](https://img.shields.io/npm/v/@noeos/verification-engine-cli?logo=npm)](https://www.npmjs.com/package/@noeos/verification-engine-cli)
[![OpenSSF Scorecard](https://api.scorecard.dev/projects/github.com/noeos/verification-engine/badge)](https://scorecard.dev/viewer/?uri=github.com/noeos/verification-engine)

Noeos Verification Engine is a deterministic, offline-first TypeScript library and CLI for data-integrity evidence. It normalizes records, computes framed cryptographic digests, builds verifiable hash-linked chains, and reports structured diagnostics without sending payloads to a service.

The repository combines the public protocol contracts, runtime implementation, CLI, conformance vectors, security controls, release evidence, and reproducible build system into one independently auditable project.

The protocol is designed for offline-first verification of data-integrity evidence, deterministic normalization, framed hashing, linked evidence chains, and stable machine-readable diagnostics. The normative contract lives in [`docs/`](./docs/README.md); implementation cannot silently override it.

## Quick start

Install the library in an application:

```sh
npm install @noeos/verification-engine@1.0.1
```

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

Use the CLI for shell pipelines and NDJSON streams:

```sh
npx --yes @noeos/verification-engine-cli@1.0.1 version --output json
printf '%s\n' '{"contextId":"example.context","recordId":"record-001","payload":{"amount":42},"profile":{"id":"dev.noeos.jcs","version":"1.0.0"},"algorithm":"sha-256"}' \\
  | npx --yes @noeos/verification-engine-cli@1.0.1 record hash --output json
```

Start with the [engine package](https://www.npmjs.com/package/@noeos/verification-engine), [CLI package](https://www.npmjs.com/package/@noeos/verification-engine-cli), [API contract](./docs/03-contratos/01-api-publica.md), or [CLI contract](./docs/03-contratos/03-cli.md).

## Stable release

Version `1.0.0` is the designated first stable release line. Integrate it only after the signed release tag and its matching npm package are available; do not rely on an untagged checkout for production evidence.

```sh
npm install @noeos/verification-engine@1.0.1
npm install --save-dev @noeos/verification-engine-cli@1.0.1
```

The [latest release](https://github.com/noeos/verification-engine/releases/latest) is built from a signed tag and published through GitHub Actions with npm Trusted Publishing/OIDC. Its evidence includes the API report, contracts, vector manifest, SBOM, package hashes, provenance, reproducibility result, security checks, performance report, attestations, and release notes.

## Repository guarantees

- Strict TypeScript with no implicit unsafe fallbacks.
- Zero runtime dependencies in the verification engine.
- Exact development dependencies and reviewed lockfile integrity.
- Exact Node/npm pairs verified on Linux, macOS, and Windows.
- GitHub Actions fixed to reviewed commit digests.
- Tests, coverage, API drift, licenses, vulnerabilities, package contents, clean consumers, reproducibility, and SBOM evidence enforced together.
- Signed changes and release tags, protected branches and tags, DCO sign-off, private vulnerability reporting, and full-history secret scanning.

These controls describe the repository and release process. Product guarantees apply only to a version explicitly published with its corresponding evidence.

## Workspaces

- [`@noeos/verification-engine`](./packages/engine/): offline-first engine boundary, prepared for ESM and CommonJS with no runtime dependencies.
- [`@noeos/verification-engine-cli`](./packages/cli/): Node.js command-line boundary, restricted to the engine and standard Node APIs.
- [`docs/`](./docs/README.md): normative contracts, limits, security, operations, and integration guidance.

## What it verifies

- Deterministic raw-byte and JCS normalization.
- Domain-separated content, record, and link digests.
- Streaming evidence chains with bounded memory and cancellation.
- Duplicate policies, limits, structured diagnostics, schemas, and public vectors.
- ESM, CommonJS, TypeScript, JSON, and NDJSON consumer boundaries.

The engine is intentionally domain-neutral. It does not provide tax, legal, identity, signature, certificate, hosting, storage, or regulatory-compliance services; those semantics belong to the integrating product.

## Supported toolchains

| Role                         | Node.js | Bundled npm |
| ---------------------------- | ------: | ----------: |
| Primary                      | 24.20.0 |     11.19.0 |
| Node 22 minimum              | 22.14.0 |      10.9.2 |
| Node 22 latest               | 22.23.2 |      10.9.8 |
| Current compatibility signal |  26.7.0 |     11.19.0 |

The exact, reviewed mapping is stored in [`security/runtime-toolchain.json`](./security/runtime-toolchain.json). npm is used from the corresponding official Node distribution; CI does not replace it globally.

The independent vector-reference gate in CI uses Python 3.13.15 exclusively; it is a verification tool, not a supported product runtime. Its reviewed source is recorded in [`security/reference-toolchain.json`](./security/reference-toolchain.json).

## Local verification

Use the primary toolchain, then run:

```sh
npm ci --ignore-scripts --omit=optional
npm run ci
```

The aggregated command verifies the active toolchain before running every local quality, security, packaging, reproducibility, and evidence gate. Repository administrators can additionally compare the declared GitHub configuration with the live private and public settings:

```sh
npm run github:audit
```

That command is read-only and requires an authenticated GitHub CLI session with repository administration access.

## Security and contributions

Read [`SECURITY.md`](./SECURITY.md) before reporting a vulnerability and [`CONTRIBUTING.md`](./CONTRIBUTING.md) before proposing a change. Public issues must never contain credentials, customer records, tax data, personal data, or embargoed vulnerability details.

## Información en español

Noeos Verification Engine es un motor determinista y offline-first para verificar evidencias de integridad, normalización, hashes encadenados y diagnósticos estructurados. No interpreta normativa fiscal, no firma documentos, no certifica identidades o contenidos y no sustituye asesoramiento legal ni los componentes operativos del producto consumidor.

La documentación normativa, los límites, la seguridad, la operación, la continuidad y el expediente de release se encuentran en [`docs/`](./docs/README.md). El engine se publica como componente técnico autónomo: su instalación no convierte al producto consumidor en un sistema fiscal, de firma, identidad o asesoramiento jurídico.

## Legal and privacy

The public legal notice is in [`LEGAL.md`](./LEGAL.md); the privacy statement is in [`PRIVACY.md`](./PRIVACY.md). The engine does not provide fiscal, legal, identity, signature, certificate, storage, hosting, or remote-processing services.

## License

Apache License 2.0. See [`LICENSE`](./LICENSE) and [`NOTICE`](./NOTICE).
