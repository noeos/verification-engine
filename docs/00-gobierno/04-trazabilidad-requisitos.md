# Catálogo y trazabilidad de requisitos

Estado: **normativo**

Esta tabla fija cobertura mínima. La implementación añadirá columnas de módulo, test, versión y evidencia sin cambiar los IDs.

| ID | Requisito resumido | Fuente detallada | Verificación obligatoria |
|---|---|---|---|
| PROD-001 | Motor independiente de cualquier dominio empresarial o regulación. | `01-producto/01-vision-alcance.md` | revisión de dependencias y API |
| PROD-002 | Biblioteca y CLI operables de forma autónoma. | `01-producto/02-casos-uso.md` | E2E de ambos paquetes |
| PROD-003 | Sin almacenamiento, red ni telemetría en el núcleo. | `01-producto/01-vision-alcance.md` | análisis estático y tests |
| DOM-001 | Registros, perfiles, cadenas, reglas, resultados y evidencias tipados. | `02-dominio/01-modelo-dominio.md` | tests de construcción e invariantes |
| DOM-002 | Detectar alteración, enlace inválido, duplicado y reordenación. | `02-dominio/02-cadena-evidencias.md` | vectores negativos |
| DOM-003 | Comunicar límites para omisiones no observables y fragmentos. | `01-producto/04-limitaciones-garantias.md` | docs y tests de estado inconcluso |
| API-001 | API pública pequeña, inmutable, funcional y versionada. | `03-contratos/01-api-publica.md` | API Extractor/compatibilidad |
| API-002 | CLI sin lógica divergente ni carga de código. | `03-contratos/03-cli.md` | E2E y revisión |
| API-003 | Errores esperables como resultados estructurados. | `03-contratos/04-errores-compatibilidad.md` | cobertura exhaustiva de códigos |
| FMT-001 | JSON estricto y NDJSON con esquemas versionados. | `03-contratos/02-esquemas-formatos.md` | validación de esquemas y fixtures |
| FMT-002 | Hexadecimal minúsculo y longitud validada para digests. | `03-contratos/02-esquemas-formatos.md` | property tests |
| CRY-001 | Normalización determinista y perfil explícito. | `04-normalizacion-criptografia/01-normalizacion.md` | vectores cruzados |
| CRY-002 | Framing inequívoco y separación de dominio. | `04-normalizacion-criptografia/02-hash-framing.md` | análisis y vectores de colisión estructural |
| CRY-003 | SHA-256/384/512; algoritmos débiles rechazados. | `04-normalizacion-criptografia/02-hash-framing.md` | vectores NIST |
| CRY-004 | Vectores públicos positivos, negativos y de frontera. | `04-normalizacion-criptografia/03-vectores-conformidad.md` | runner de conformidad |
| ARC-001 | Capas sin dependencias inversas y cero ciclos. | `05-arquitectura/01-arquitectura.md` | regla de arquitectura |
| ARC-002 | Repositorio y ownership definidos antes de código. | `05-arquitectura/02-estructura-repositorio.md` | auditoría de árbol |
| ARC-003 | Streaming incremental con backpressure y cancelación. | `05-arquitectura/04-concurrencia-streaming.md` | integración y estrés |
| SEC-001 | Entrada hostil, límites seguros y fallo cerrado. | `06-seguridad/01-modelo-amenazas.md` | abuso, fuzzing y revisión |
| SEC-002 | Desarrollo conforme a controles SSDF trazables. | `06-seguridad/02-controles.md` | matriz y auditoría de release |
| SEC-003 | Publicación OIDC, 2FA, provenance y SBOM. | `06-seguridad/03-cadena-suministro.md` | attestations verificadas |
| SEC-004 | Divulgación coordinada y SLA de respuesta. | `06-seguridad/04-vulnerabilidades-incidentes.md` | simulacro anual |
| PRV-001 | Minimización, sin logs ni payload en evidencias por defecto. | `06-seguridad/05-privacidad.md` | revisión de flujos |
| PERF-001 | Presupuestos de latencia, throughput y memoria medidos. | `07-rendimiento/01-presupuestos.md` | benchmark bloqueante |
| PERF-002 | Regresiones estadísticas controladas. | `07-rendimiento/02-benchmarks.md` | CI dedicada |
| TST-001 | Pirámide completa: unidad, propiedad, contrato, integración, E2E, fuzz, rendimiento y recuperación. | `08-calidad/01-estrategia-pruebas.md` | informe de cobertura por riesgo |
| TST-002 | CI reproducible y sin release si falla un gate. | `08-calidad/02-ci-calidad.md` | branch protection |
| TST-003 | Auditoría independiente antes de 1.0.0. | `08-calidad/03-auditoria-lanzamiento.md` | informe y remediación |
| LEG-001 | Registro España/UE revisado y no sustituido por afirmaciones comerciales. | `09-legalidad/01-marco-legal.md` | revisión trimestral/jurídica |
| LEG-002 | Licencia, NOTICE, attribution y dependencias compatibles. | `09-legalidad/02-licencias-pi.md` | escaneo y revisión humana |
| LEG-003 | Evidencias de cumplimiento conservadas por release. | `09-legalidad/03-cumplimiento-registro.md` | expediente de release |
| REL-001 | SemVer, soporte y retirada definidos. | `10-entrega-operacion/01-versionado-publicacion.md` | pruebas de compatibilidad |
| REL-002 | Operación sin telemetría, soporte reproducible. | `10-entrega-operacion/02-observabilidad-soporte.md` | runbooks y simulacro |
| REL-003 | Releases recuperables y revocables sin reescribir versiones. | `10-entrega-operacion/03-recuperacion-continuidad.md` | ensayo de recuperación |
| DOC-001 | Referencia, guías y ejemplos sincronizados con código. | `10-entrega-operacion/04-documentacion.md` | snippets ejecutables |

## Condición global

Ningún requisito puede declararse cumplido solo por revisión visual. Debe existir una evidencia automática o un registro de revisión humana independiente proporcionado a su riesgo.
