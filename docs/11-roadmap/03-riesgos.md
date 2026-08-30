# Registro de riesgos

Estado: **normativo y vivo**

Escala: probabilidad (P) e impacto (I) 1–5; exposición P×I. Responsable por rol, no nombre personal.

| ID | Riesgo | P | I | Control/mitigación | Trigger | Responsable |
|---|---|---:|---:|---|---|---|
| R-01 | Normalización divergente | 3 | 5 | RFC vectors, JCS estricto, impl. independiente | discrepancia byte | protocolo |
| R-02 | Framing ambiguo | 2 | 5 | TLV, dominios, review, mutation | dos estructuras/mismo frame | protocolo |
| R-03 | Falsa promesa de completitud | 3 | 5 | modos/fronteras/indeterminate | valid sin count/final | producto |
| R-04 | DoS por input | 4 | 4 | límites, streaming, fuzz, workers host | RSS/CPU fuera gate | seguridad |
| R-05 | Memory growth por duplicados | 3 | 4 | políticas explícitas y caps | crecimiento con n en none/window | rendimiento |
| R-06 | API demasiado amplia | 3 | 3 | exports allowlist/API report | consumer depende internal | arquitectura |
| R-07 | Dependencia comprometida | 2 | 5 | zero runtime, lock, scans | advisory/owner anomaly | supply chain |
| R-08 | Publicación npm comprometida | 2 | 5 | OIDC, stage, 2FA, provenance | artifact no esperado | release/security |
| R-09 | Cuenta mantenedor comprometida | 3 | 5 | FIDO2, least privilege, reviews | login/commit anómalo | seguridad |
| R-10 | Un solo mantenedor | 4 | 4 | custodia, auditor externo, docs, branch protection | indisponibilidad | dirección |
| R-11 | Objetivos rendimiento no alcanzados | 3 | 3 | benchmark temprano, profiling, opción ADR WASM | gate < objetivo | rendimiento |
| R-12 | Rust/WASM necesario tarde | 2 | 4 | puertos y vectors portables | TS no cumple tras optimizar | arquitectura |
| R-13 | Cambio Node altera JCS | 2 | 5 | vectors por runtime, profile version | output diferente | protocolo |
| R-14 | CRA aplica como fabricante | 4 | 5 | diseño conservador, expediente, counsel | clasificación confirmada | legal |
| R-15 | Transposición cambia obligaciones | 3 | 4 | vigilancia trimestral | BOE/guía nueva | legal |
| R-16 | Responsabilidad por defecto/updates | 3 | 5 | QA, soporte 5 años, seguro/contratos | reclamación/advisory | legal/dirección |
| R-17 | Licencia incompatible | 2 | 4 | admission policy/SBOM/review | licencia unknown/copyleft | legal |
| R-18 | Datos personales en IDs/evidencia | 3 | 4 | docs, minimización, no telemetry | ejemplo/issue real | privacidad |
| R-19 | Auditoría detecta fallo tardío | 3 | 4 | revisiones incrementales y pre-audit | hallazgo High | seguridad |
| R-20 | Docs divergen del código | 3 | 4 | generated API/snippets/vectors CI | snippet falla | docs |
| R-21 | Build no reproducible | 3 | 4 | doble build, no cache, lock | tree diff | supply chain |
| R-22 | Algoritmo retirado | 2 | 5 | agility, verify-only, migration | NIST/advisory | protocolo/security |
| R-23 | Ecosistema npm cambia | 3 | 3 | revisión release y policy abstraction | OIDC/provenance change | release |
| R-24 | Uso fuera de scope crítico | 4 | 3 | límites claros, contracts, no claims | issue integrador | producto/legal |
| R-25 | Fork completo no detectable | 3 | 5 | documentación/ancla externa | reclamación de autenticidad | producto |

## Tratamiento

- Exposición ≥15: revisión en cada PR material y release.
- 8–14: revisión mensual/trimestral según trigger.
- ≤7: revisión trimestral.
- Riesgo legal o de integridad con I=5 nunca se cierra solo por baja probabilidad.

## Cambios

Todo riesgo incluye señal medible. Al activarse: abrir incidente/issue, contener, decidir, actualizar documentos/tests y registrar residual. Riesgos no se eliminan de historia; se marcan cerrados con evidencia y versión.
