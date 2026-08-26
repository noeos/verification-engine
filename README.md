# Noeos Verification Engine

`verification-engine` is the TypeScript and Node.js implementation of the deterministic Noeos verification protocol. The repository is currently in its reproducible-foundation phase: package boundaries, governance, build, tests, security controls, and supply-chain evidence are implemented; the product protocol is not yet implemented or published.

The source is public from the foundation phase to make design decisions, security controls, and release history independently reviewable. Public visibility does not imply that the unfinished repository is ready for production use.

## Repository status

- No stable release exists.
- Neither workspace package is publishable.
- The engine intentionally exports no product API yet.
- The CLI intentionally exposes no executable yet.
- The normative product plan is maintained in [`docs/`](./docs/README.md).

## Requirements

- Node.js 24.19.0 for the primary development environment.
- Node.js 22.14.0 or newer within the Node 22 release line for secondary compatibility.
- npm 11.5.1 or newer within npm 11.

## Local verification

```sh
npm ci --ignore-scripts
npm run ci
```

The aggregated command checks repository policy, documentation, formatting, lint, strict TypeScript, tests and coverage, API drift, licenses, vulnerabilities, registry signatures and attestations, package contents, clean consumers, reproducibility, and SBOM generation.

## Packages

- `@noeos/verification-engine`: future zero-runtime-dependency engine, prepared for ESM and CommonJS.
- `@noeos/verification-engine-cli`: future Node.js CLI, allowed to depend only on the engine.

## Security and contributions

Read [`SECURITY.md`](./SECURITY.md) before reporting a vulnerability and [`CONTRIBUTING.md`](./CONTRIBUTING.md) before proposing changes. All contributions require Developer Certificate of Origin sign-off.

## License

Apache License 2.0. See [`LICENSE`](./LICENSE) and [`NOTICE`](./NOTICE).
