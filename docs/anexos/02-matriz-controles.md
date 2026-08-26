# Matriz maestra de controles

Estado: **normativo**

| ID | Control | Previene/detecta | Evidencia de cierre |
|---|---|---|---|
| C-01 | IDs ASCII/tipos opacos | confusión Unicode/tipos | unit/property tests |
| C-02 | Parser JSON con claves únicas | interpretación diferencial | vectors/fuzz |
| C-03 | Límites antes de allocation | DoS | abuse tests/bench |
| C-04 | JCS RFC 8785 | JSON no determinista | RFC vectors/cross impl |
| C-05 | Perfiles versionados | drift semántico | manifest/vectors |
| C-06 | TLV + domain separation | concatenación/context confusion | review/vectors/mutation |
| C-07 | SHA allowlist | algoritmo débil | NIST vectors/negative tests |
| C-08 | Timing-safe digest compare | oracle/bypass | code review/test |
| C-09 | Posición/anterior/fronteras | reorder/omit | chain vectors |
| C-10 | `indeterminate` | falsa validez | contract tests |
| C-11 | Evidencia sin payload | fuga | schema/privacy review |
| C-12 | No red/storage/telemetry | exfiltración/side effects | import/static review |
| C-13 | No plugin/eval | RCE | CLI tests/SAST |
| C-14 | Backpressure/abort | resource exhaustion | stress tests |
| C-15 | Diagnósticos acotados | memory amplification | limit tests |
| C-16 | Cero runtime deps core | supply chain | package manifest/SBOM |
| C-17 | Lock + ignore scripts | install compromise | CI logs/policy |
| C-18 | Actions por SHA/permisos mínimos | CI compromise | workflow scan |
| C-19 | Branch protection/CODEOWNERS | cambio no revisado | repo settings evidence |
| C-20 | FIDO2/least privilege | account takeover | access review |
| C-21 | OIDC/stage/2FA | npm token/publish compromise | attestation/release log |
| C-22 | Provenance/reproducibility | artifact substitution | SLSA/double-build report |
| C-23 | CycloneDX/SPDX | componente/licencia desconocido | SBOM validation |
| C-24 | SAST/secret/license/dependency scans | defect/supply issue | CI reports |
| C-25 | Property/fuzz/mutation | bugs no anticipados | reports/corpus |
| C-26 | Auditoría independiente | error sistémico | report/retest |
| C-27 | SLA/advisory/simulacro | respuesta tardía | incident records |
| C-28 | Backup/restore | pérdida/compromiso | drill record |
| C-29 | Legal register/gate | incumplimiento | counsel sign-off |
| C-30 | Docs ejecutables/versionadas | uso inseguro/drift | docs CI |

## Regla de cierre

Cada control tendrá owner, implementación, test automático cuando sea posible y evidencia por release. Si no puede automatizarse, se usa checklist firmado con fuente y fecha. Un control “configurado” sin prueba de efecto no está cerrado.
