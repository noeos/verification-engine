## Change

Describe the single responsibility of this change and link its issue or approved decision.

## Traceability

- Requirement or control identifiers:
- User-visible compatibility impact:
- Security and privacy impact:
- Legal and licensing impact:
- Performance impact:

## Evidence

- [ ] `npm ci --ignore-scripts --omit=optional` succeeds from a clean tree.
- [ ] `npm run ci` succeeds without changing tracked files.
- [ ] Tests include negative and boundary cases appropriate to the change.
- [ ] Generated artifacts, API reports, schemas, vectors, and documentation are synchronized.
- [ ] Third-party material has source, SPDX license, attribution, and distribution review.
- [ ] No secrets, personal data, customer payloads, workstation paths, or embargoed findings are present.
- [ ] Every commit has DCO sign-off.

## Critical change gate

- [ ] The change does not touch a critical path; or at least 24 hours have elapsed since the final push and the critical-path job confirms it.

## Release impact

State the SemVer and changelog conclusion, including “none” when the change cannot affect consumers.
