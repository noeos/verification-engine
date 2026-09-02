# `@noeos/verification-engine-cli`

Deterministic command-line interface for hashing, verifying, inspecting, and streaming Noeos integrity evidence. It emits machine-readable JSON/NDJSON, uses safe output transactions, and delegates every operation to the public verification engine.

[![CI](https://github.com/noeos/verification-engine/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/noeos/verification-engine/actions/workflows/ci.yml)
[![npm](https://img.shields.io/npm/v/@noeos/verification-engine-cli?logo=npm)](https://www.npmjs.com/package/@noeos/verification-engine-cli)
[![License](https://img.shields.io/badge/license-Apache--2.0-blue.svg)](https://github.com/noeos/verification-engine/blob/main/LICENSE)

## Install

```sh
npm install --global @noeos/verification-engine-cli
noeos-ve version --output json
```

For project-local use:

```sh
npx --yes @noeos/verification-engine-cli@1.0.1 version --output json
```

## Commands

```text
noeos-ve record hash
noeos-ve record verify
noeos-ve chain build
noeos-ve chain verify
noeos-ve evidence inspect
noeos-ve evidence digest
noeos-ve vectors verify
noeos-ve schema print
noeos-ve version
```

Every command supports `--help` and `--output json|ndjson|human`. Automation should always select an explicit output format. Inputs may come from a file or stdin; chain operations support NDJSON streaming and clean cancellation.

## Example

```sh
printf '%s\n' '{"contextId":"example.context","recordId":"record-001","payload":{"amount":42},"profile":{"id":"dev.noeos.jcs","version":"1.0.0"},"algorithm":"sha-256"}' \\
  | noeos-ve record hash --output json
```

The complete command contract, input rules, output envelopes, exit codes, limits, and security boundaries are in the [CLI specification](https://github.com/noeos/verification-engine/blob/main/docs/03-contratos/03-cli.md).

## Compatibility and verification

The package supports the reviewed Node.js 22.14+ and 24.x toolchains and depends exactly on the matching `@noeos/verification-engine` release. The [v1.0.1 release](https://github.com/noeos/verification-engine/releases/tag/v1.0.1) is published through GitHub Actions with npm provenance and includes checksums, attestations, SBOM, and release verification evidence.

Read the [main README](https://github.com/noeos/verification-engine#readme) for the support policy and repository-wide verification instructions. Report vulnerabilities privately through the [security policy](https://github.com/noeos/verification-engine/blob/main/SECURITY.md).

## License

Apache License 2.0. See the [license](https://github.com/noeos/verification-engine/blob/main/LICENSE) and [third-party notices](https://github.com/noeos/verification-engine/blob/main/NOTICE).
