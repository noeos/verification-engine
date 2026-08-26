# Changelog

All notable user-visible changes to this project will be documented in this file.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and released versions will follow [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Infrastructure

- Establish the governed and reproducible repository foundation.
- Verify exact Node/npm pairs from official Node distributions on every supported platform.
- Enforce a reviewed inventory for GitHub Actions and remove global package-manager replacement.
- Align release signing with the verified maintainer identity and test signed-tag rejection paths.
- Audit the live public and private GitHub configuration against a versioned source of truth.

### Contracts

- Publish versioned JSON Schemas, a generated immutable diagnostic catalog, and packageable contract assets.
- Add SHA-256-pinned vectors for SHA-2, framing, structural failures, and framing-length boundaries, verified independently in Node and Python.
- Pin the independent CI reference toolchain and validate every vector file, source, schema, and generated artifact deterministically.

No product version has been released.
