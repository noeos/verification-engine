# Auditoría técnica y expediente de release 1.0.0

Estado: **registro operativo de release completado**
Fecha de auditoría interna: **2026-09-02**

## Alcance auditado

La auditoría cubre el workspace `@noeos/verification-engine-workspace` 1.0.0, los paquetes `@noeos/verification-engine` y `@noeos/verification-engine-cli`, sus contratos, vectores, CLI, workflows, políticas de GitHub, cadena de suministro, documentación pública y proceso de publicación.

La etiqueta firmada `v1.0.0` fija el commit `3624a68c1f66e489cba5d7758b92aadc9734b56d`; la release pública, sus hashes, SBOM, provenance y evidencias de CI están disponibles en GitHub y npm. Ningún resultado de este documento sustituye una revisión profesional o independiente cuando la obligación aplicable la exija.

## Hallazgo corregido durante auditoría

Se añadió una prueba E2E de subprocess para la CLI publicada: entrada JSON por stdin, salida NDJSON y código de salida deben llegar completos antes de que el proceso termine. El entrypoint ESM ahora espera explícitamente el resultado de `runCli`, y la prueba se ejecuta fuera del sandbox de herramientas cuando este no permite transportar stdin a procesos hijo.

El benchmark P-07/P-08 también conserva stderr, escenario e índice si una invocación de CLI falla. La reproducción inicial con código 3 se debió al sandbox de ejecución, que entrega EOF a procesos hijo incluso en un programa Node mínimo; la misma prueba E2E pasa con Node 24.20.0 fuera de ese sandbox.

## Evidencia reproducible ejecutada

| Control | Resultado |
| --- | --- |
| Toolchain | Node 24.20.0 y npm 11.19.0 verificados |
| Tests | 78/78 correctos |
| Vectores | 18/18 reproducidos por Node y referencia Python |
| Cobertura engine | 98,36 % líneas; 95,45 % ramas; 98,59 % funciones |
| Cobertura CLI | 97,65 % líneas; 90,17 % ramas; 100 % funciones |
| Mutation testing | 16/16 mutantes; 15/15 críticos eliminados |
| Fuzzing ampliado | chain, json, frame, JCS, evidence y NDJSON sin crash ni divergencia |
| Dependencias | `npm audit`: 0 vulnerabilidades; 154 firmas y 32 attestations verificadas |
| Licencias | 288 ocurrencias bloqueadas revisadas |
| SBOM | CycloneDX 1.7 y SPDX 3.0.1 reproducibles generados |
| GitHub | política remota, ramas/tags protegidos, scanning y entornos npm auditados |
| Paquetes | allowlist, consumidores limpios, recuperación y reproducibilidad incluidos en CI |
| CI agregado | `npm run ci` completo superado con Node 24.20.0 / npm 11.19.0 |

El simulacro de recuperación produjo `@noeos/verification-engine` con SHA-256 `cd0baebad2f863f38d2b93789092046e7cfcfbf40dd31ac9937b7c484adf4228` y `@noeos/verification-engine-cli` con SHA-256 `8f72f9af3920d079fae28dad90a82c4fb035e4e414bbd083dc6a7dbb21ec3835`; la manipulación deliberada del tarball fue detectada.

## Superficie pública y publicación

- Los paquetes usan versión estable 1.0.0, son explícitamente publicables y la CLI depende de la versión exacta del engine.
- El API report incluye todos los exports públicos revisados y no contiene `ae-forgotten-export`.
- El repositorio público expone README estable, licencia, NOTICE, seguridad, soporte, aviso legal, privacidad, issue templates, DCO y políticas de contribución.
- GitHub exige commits y tags firmados, checks requeridos, acciones fijadas por SHA, escaneo de secretos, CodeQL, OSV, Dependabot y reporting privado.
- `npm-production` exige aprobación, impide autoaprobación y bypass administrativo, y acepta solo tags `v*.*.*`.
- El workflow estable publica exclusivamente tarballs construidos y attestados en CI mediante OIDC/provenance; no acepta `NPM_TOKEN`.

## Gate de rendimiento oficial

El benchmark oficial se ejecutó en el runner nativo Arch `noeos-performance-arch-lenovo`, con Linux x86_64, Intel Core i7-13620H, 16 CPUs, 16.437.305.344 bytes de RAM, governor `performance`, microcode `0x6134`, Node 24.20.0 y Python 3.13.15. El [workflow oficial de Performance evidence](https://github.com/noeos/verification-engine/actions/runs/33631914713) terminó correctamente sobre `main` en el commit `db2f055c5b63ec7b0b5871cfa68f02bf35e003b5`.

| ID | Resultado oficial | Límite | Estado |
| --- | ---: | ---: | --- |
| P-01 | 76.059,925 records/s | ≥45.000 | pasado |
| P-02 | 35.647,691 records/s | ≥20.000 | pasado |
| P-03 | 22.927,637 links/s | ≥10.000 | pasado |
| P-04 | 0,043318 ms p95 | ≤0,5 ms | pasado |
| P-05 | 23.740.416 bytes RSS | ≤134.217.728 | pasado |
| P-06 | 1 pending | ≤2 | pasado |
| P-07 | 99,854 ms p95 | ≤250 ms | pasado |
| P-08 | 99,893 ms p95 | ≤500 ms | pasado |
| P-09 | ratio 1,020248 | ≤2 | pasado |
| P-10 | 0,015341 ms | ≤100 ms | pasado |

El artifact `performance-db2f055c5b63ec7b0b5871cfa68f02bf35e003b5` conserva el reporte, perfiles CPU/heap y perfil de fase 10/11: [descargar evidencia](https://github.com/noeos/verification-engine/actions/runs/33631914713/artifacts/9848830815). El SHA-256 del reporte es `7614ce1ed27cc60ed20dc1726909c15c3fddac03972f3138ace1035676d2fc4d`.

## Registro npm y provenance

Los dos paquetes están publicados en npm con versión `1.0.0`, `latest` apunta a `1.0.0`, y el tag temporal `bootstrap` conserva `0.0.0`. La publicación estable se realizó mediante el trusted publisher de GitHub Actions, workflow `release.yml`, entorno `npm-production`, OIDC y provenance; no se usó `NPM_TOKEN`. Véanse [`@noeos/verification-engine`](https://www.npmjs.com/package/@noeos/verification-engine) y [`@noeos/verification-engine-cli`](https://www.npmjs.com/package/@noeos/verification-engine-cli).

La verificación independiente [Release verification](https://github.com/noeos/verification-engine/actions/runs/33631984688) comprobó el tag, ancestría, metadata npm, provenance, attestations, tarballs, hashes, manifests, ESM, CommonJS, TypeScript, CLI y firmas npm.

## Gate de autoridad externa

La clasificación regulatoria, las declaraciones o evaluaciones de conformidad que resulten exigibles y la auditoría realmente independiente solo pueden ser emitidas por los responsables y profesionales competentes. El repositorio deja el alcance, la evidencia técnica, los límites y las preguntas de revisión listos en [`09-legalidad/`](../09-legalidad/) y [`08-calidad/03-auditoria-lanzamiento.md`](../08-calidad/03-auditoria-lanzamiento.md); no simula una firma, dictamen o certificación que no exista.
