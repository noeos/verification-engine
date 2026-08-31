# Security policy

## Reporting a vulnerability

Use [GitHub private vulnerability reporting](https://github.com/noeos/verification-engine/security/advisories/new) as the primary channel. If that channel is unavailable, email `security@noeos.es`. Do not open a public issue, include real customer data, or perform destructive testing.

Include affected versions or commit, impact, reproducible conditions, and a minimal non-destructive demonstration when safe. Encrypt especially sensitive evidence only after agreeing a protected transfer method; no public encryption key is currently asserted by this repository.

## Response targets

| Severity | Acknowledgement |   Initial triage | Mitigation target |            Fix target |
| -------- | --------------: | ---------------: | ----------------: | --------------------: |
| Critical |         4 hours |         24 hours |          48 hours |                7 days |
| High     |  1 business day |  2 business days |            7 days |               30 days |
| Medium   | 2 business days |  5 business days |        risk-based |               90 days |
| Low      | 5 business days | 10 business days |           backlog | next reasonable minor |

These are maximum response objectives, not a promise to delay mitigation. Legal
or regulatory obligations take precedence.

Targets are not a guarantee of a specific fix date. Noeos will preserve evidence, coordinate disclosure, publish an advisory when appropriate, and credit reporters who request and can safely receive credit.

## Supported versions

`1.x` is supported through 2031-08-31. Each supported major follows the five-year support policy in the normative documentation; unsupported versions may be deprecated with an actionable migration notice.

## Scope and safe harbor

Good-faith research must avoid privacy violations, service disruption, social engineering, credential attacks, persistence, data destruction, and access beyond what is necessary to demonstrate the issue. Contact the security channel before testing ambiguous or high-impact scenarios.
