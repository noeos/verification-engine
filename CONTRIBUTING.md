# Contributing

Noeos accepts changes that preserve the normative requirements in `docs/`, include their evidence, and keep every required gate green. Security reports must use the private process in `SECURITY.md`, never a public issue.

## Before changing the repository

1. Open an issue or discussion for a non-trivial change.
2. Link the affected requirement and identify security, compatibility, legal, and performance impact.
3. Add an ADR before changing an approved architectural decision.
4. Keep one reviewable responsibility per pull request.

## Required local checks

Use the pinned Node and npm versions, then run:

```sh
npm ci --ignore-scripts
npm run ci
```

Do not bypass a failing check, weaken a threshold, regenerate expected output without reviewing its diff, or retry an unexplained flaky failure until it passes.

## Developer Certificate of Origin

Every commit must certify the [Developer Certificate of Origin 1.1](https://developercertificate.org/) with a sign-off line:

```text
Signed-off-by: Your Name <your-email@example.com>
```

Create it with `git commit --signoff`. By signing off, the contributor certifies that they have the right to submit the work under this project's Apache-2.0 license, identify third-party material, and have not included secrets, personal customer data, or incompatible content.

## Reviews and merge policy

- Pull requests are mandatory; direct and force pushes to `main` are prohibited.
- CODEOWNERS routes sensitive changes.
- Critical changes wait at least 24 hours after the final push while the project has one maintainer.
- CI, conversations, DCO, signatures, generated-output checks, and required evidence must be complete.
- Squash merge is used while preserving contributor attribution.
- Security, protocol, dependency, API, legal, and performance changes follow the additional requirements in `docs/00-gobierno/05-mantenimiento-contribuciones.md`.

## Third-party material

Record source, version, copyright, SPDX license, modifications, distribution obligations, and approval before adding code, data, vectors, text, or assets created by others. Unknown or incompatible licenses block inclusion.
