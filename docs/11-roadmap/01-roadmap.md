# Roadmap completo de construcción

Estado: **normativo**

Las fases ordenan dependencias. No crean un MVP ni autorizan publicar un producto parcial como estable.

## Bloques de ejecución

Las fases se ejecutan en los siguientes bloques para coordinar trabajo relacionado sin reducir alcance, alterar dependencias ni sustituir los gates individuales de cada fase:

1. **Bloque 1 · Fundamentos verificables:** fases 3 y 4.
2. **Bloque 2 · Motor de integridad:** fases 5 y 6.
3. **Bloque 3 · Streaming y superficies de distribución:** fases 7, 8 y 9.
4. **Bloque 4 · Seguridad, supply chain y rendimiento:** fases 10 y 11.
5. **Bloque 5 · Preparación operativa y legal:** fase 12.
6. **Bloque 6 · Auditoría y publicación:** fase 13.

Las fases 0, 1 y 2 son prerrequisitos ya cerrados antes de iniciar estos bloques. Agrupar fases permite planificarlas y construirlas de forma coordinada, pero cada fase conserva todos sus entregables, evidencias y criterios de cierre. Un bloque solo se cierra cuando todas las fases que contiene han superado sus gates sin excepciones ni trabajo diferido.

Esta agrupación es un cambio organizativo motivado por coordinar capacidades con dependencias próximas. Afecta únicamente a la ejecución del roadmap: no modifica requisitos, decisiones cerradas, API, formatos, seguridad, rendimiento, legalidad, pruebas, documentación exigible ni compatibilidad.

## Fase 0 · Cierre de planificación

Entregables: este corpus, decisiones, requisitos, fuentes y revisión de coherencia.
Gate: `02-criterios-cierre.md` apartado planificación, cero decisiones abiertas.

## Fase 1 · Gobierno y esqueleto reproducible

- Inicializar repo, licencias, DCO, CODEOWNERS y políticas.
- npm workspaces, TypeScript strict, lint, tests base y CI.
- Branch/security settings, trusted publishing configurado sin publicar latest.
- Repositorio público autoritativo desde la base, con estado incompleto declarado sin ambigüedad.
- Generación de SBOM, docs checks y artifact allowlist.

Gate: build limpio reproducible, PR protegido, secretos/permissions auditados y tarballs vacíos controlados.

## Fase 2 · Contratos ejecutables y vectores independientes

- JSON Schemas y registros de códigos.
- Manifest/vector format.
- Herramienta independiente mínima para framing/digests centrales.
- Consumer type fixtures y API report esperado.

Gate: schemas y vectores revisados; protocolo de bytes congelado para implementación 1.

## Fase 3 · Valores, validación y presupuestos

- Tipos opacos, plain-object validation, JSON duplicate parser para CLI.
- IDs, versiones, digests, límites y diagnóstico.
- Tests unit/property/fuzz de fronteras.

Gate: todos los inputs hostiles definidos se rechazan sin crash/OOM y cobertura crítica completa.

## Fase 4 · Normalización, framing y algoritmos

- raw bytes, JCS, sinks incrementales.
- TLV protocolo 1 y parsers.
- adapters SHA-256/384/512.
- record/evidence frames y vectores RFC/NIST/Noeos.

Gate: reproducción cruzada byte a byte, mutation ≥95% y revisión criptográfica interna.

## Fase 5 · Registros, cadenas y verificación

Estado de ejecución: completada como parte del Bloque 2, con implementación, pruebas negativas y gates de alteración/frontera/duplicado.

- record/link evidence, génesis, builder y resumen.
- completa, fragmento y consistencia interna.
- duplicados none/window/full/external.
- errores, abort y transacciones de estado.

Gate: matriz completa de alteraciones, omisiones, reordenación, forks y límites.

## Fase 6 · Reglas y evidencias

Estado de ejecución: completada como parte del Bloque 2, con RuleSet determinista, parsers estrictos, digest de evidencia, schema y vector independiente.

- RuleSet, fases, orden determinista y captura.
- schemas finales, parsers de versiones y `digestEvidence`.
- compatibilidad y diagnósticos generados.

Gate: reglas no pueden cambiar bytes; schemas/vectors/docs sincronizados.

## Fase 7 · Streaming y resistencia

- sync iterable, async iterable, backpressure, NDJSON y cancelación.
- memoria acotada, error modes y atomic output.
- stress/soak/fuzz prolongado.

Gate: 1 GiB/10M escenarios, memoria y handles estables, cancelación correcta.

## Fase 8 · API y empaquetado

- exports públicos ESM/CommonJS, tipos y subpaths.
- engine tarball sin runtime dependencies.
- consumer projects y compatibilidad.

Gate: paridad total y package allowlist/reproducibilidad.

## Fase 9 · CLI completa

- todos los comandos, exit codes, formatos, señales y filesystem seguro.
- E2E multiplataforma desde tarball.

Gate: automatización sin texto mezclado, seguridad de paths y paridad con API.

## Fase 10 · Hardening de seguridad y supply chain

- SAST, fuzz continuo, mutation, secret/workflow scans.
- incident runbooks, vulnerability reporting y simulacros.
- OIDC staged publishing, provenance, SBOM y recovery drill.

Gate: matriz SEC completa y cero Critical/High.

## Fase 11 · Rendimiento y fiabilidad

- benchmarks dedicados, perfiles CPU/heap y optimización segura.
- regresiones CI, soak y escenarios negativos.

Gate: todos los presupuestos absolutos y relativos pasan sin cambiar vectors.

## Fase 12 · Documentación, legalidad y operación

- documentación bilingüe pública y API generada.
- expediente CRA/product liability/privacy/licencias.
- soporte, EOL, ownership, backups y restore.

Gate: revisión jurídica profesional, docs ejecutables y continuidad ensayada.

## Fase 13 · Auditoría independiente y release 1.0.0

- Auditorías de protocolo, código, supply chain, legal y rendimiento.
- Remediación/retest total.
- RC desde proceso real, instalación externa y verificación de attestations.
- Publicación 1.0.0 y expediente.

Gate: todos los criterios de cierre, sin excepciones temporales.

## Trabajo posterior

Mantenimiento no es “fase opcional”: monitorización de vulnerabilidades/leyes, updates, soporte, benchmarks, compatibilidad y auditorías continúan durante mínimo cinco años por major.
