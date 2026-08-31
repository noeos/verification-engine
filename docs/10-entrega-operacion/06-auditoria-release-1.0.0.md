# Auditoría técnica y expediente de release 1.0.0

Estado: **registro operativo de release**
Fecha de auditoría interna: **2026-08-31**

## Alcance auditado

La auditoría cubre el workspace `@noeos/verification-engine-workspace` 1.0.0, los paquetes `@noeos/verification-engine` y `@noeos/verification-engine-cli`, sus contratos, vectores, CLI, workflows, políticas de GitHub, cadena de suministro, documentación pública y proceso de publicación.

La etiqueta firmada de release fijará el commit exacto, hashes, SBOM, provenance y evidencias de CI. Ningún resultado de este documento sustituye una revisión profesional o independiente cuando la obligación aplicable la exija.

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

El benchmark absoluto requiere un runner `self-hosted`, `noeos-performance`, `linux`, `x64`, con la serie de hardware y governor definidos en [`07-rendimiento/01-presupuestos.md`](../07-rendimiento/01-presupuestos.md). En la fecha de este registro no hay runner con esas etiquetas ni variable `PERFORMANCE_RUNNER_ENABLED` configurada en GitHub.

El workflow de release exige ahora ese job y sus perfiles antes de publicar. Para completar esta única dependencia externa debe registrarse un runner dedicado que cumpla el entorno de referencia, habilitar la variable y ejecutar `Performance evidence`; el resultado debe pasar P-01 a P-10 y conservarse como artifact. No se rebaja el umbral, no se sustituye por el WSL local y no se publica sin esa evidencia.

## Registro npm y provenance

Los dos nombres de paquete no existen aún en el registro público y la sesión local no tiene identidad npm autenticada. Es correcto para una primera publicación, pero el owner de npm debe configurar para cada paquete el trusted publisher de GitHub Actions con el repositorio `noeos/verification-engine`, el workflow `release.yml` y el entorno `npm-production`; además debe exigir 2FA y deshabilitar tokens de publicación tras verificar OIDC. El workflow no contiene ni acepta `NPM_TOKEN`, y publica con `--provenance` únicamente después de sus gates.

## Gate de autoridad externa

La clasificación regulatoria, las declaraciones o evaluaciones de conformidad que resulten exigibles y la auditoría realmente independiente solo pueden ser emitidas por los responsables y profesionales competentes. El repositorio deja el alcance, la evidencia técnica, los límites y las preguntas de revisión listos en [`09-legalidad/`](../09-legalidad/) y [`08-calidad/03-auditoria-lanzamiento.md`](../08-calidad/03-auditoria-lanzamiento.md); no simula una firma, dictamen o certificación que no exista.
