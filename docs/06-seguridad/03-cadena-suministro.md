# Seguridad de la cadena de suministro

Estado: **normativo**

## Objetivo

Un consumidor debe poder vincular el tarball npm a una fuente revisada, un workflow identificado y una versión, además de conocer componentes y licencias.

## Fuentes y CI

- GitHub es origen público autoritativo.
- Actions fijadas por SHA completo.
- `GITHUB_TOKEN` usa permisos `{contents: read}` por default; permisos adicionales por job.
- `pull_request_target` prohibido para ejecutar código de PR.
- Caches no se restauran en release; los builds de release parten limpios.
- Jobs de análisis que suben resultados usan permisos separados y no reciben secretos innecesarios.
- Artefactos entre jobs llevan digest y retención limitada.

## Dependencias

- Lockfile obligatorio y actualizado solo en PR visible.
- Cero runtime en engine; CLI solo engine.
- Inventario transitivo, licencias, scripts y binarios.
- Dependabot/OSV y `npm audit` se complementan.
- Advisory ignorado requiere VEX con justificación, evidencia, propietario y fecha de revisión.
- Typosquatting se reduce mediante scope `@noeos`, nombres exactos y registry explícito.

## SLSA

Objetivo de release: SLSA Build L3 cuando el builder soportado permita demostrarlo; mínimo aceptable para 1.0: provenance SLSA verificable generado por plataforma hospedada, build aislado, parámetros identificados y fuentes protegidas. No se declara un nivel superior sin evaluación formal de todos sus requisitos.

También se aplica Source track: historial, identidad, controles continuos y revisión de dos partes donde haya capacidad organizativa.

## npm

- Trusted publisher OIDC ligado a repositorio, workflow y environment exactos.
- Tokens tradicionales deshabilitados para publicación.
- Cuentas de mantenedores con 2FA/passkey.
- Publicación por etapas: CI crea stage; mantenedor distinto cuando sea posible revisa manifest, provenance y diff, y aprueba con 2FA.
- Provenance automática y publish attestation.
- Paquete público con repository URL exacta y acceso explícito.
- Owners mínimos; revisión mensual.

## Artefactos por release

1. tarballs de ambos paquetes;
2. SHA-256 y SHA-512;
3. provenance/attestations;
4. SBOM CycloneDX 1.7 JSON;
5. SPDX 3.0;
6. license report y NOTICE;
7. API report;
8. vector manifest y digest;
9. resultados de gates y benchmarks;
10. changelog y security impact statement.

## Reproducibilidad

Dos builds limpios del mismo commit, runtime y lockfile deben producir contenido funcional idéntico. Se permiten diferencias solo en metadata inevitable y documentada; el objetivo es byte-identidad. Un job compara árbol desempaquetado y hashes normalizados. Una diferencia no explicada bloquea release.

## Verificación del consumidor

La documentación enseña a:

- comprobar versión y engines;
- ejecutar verificación de signatures/attestations de npm;
- comparar provenance con repositorio/workflow esperado;
- revisar SBOM;
- fijar versión y lockfile;
- suscribirse a advisories.

## Compromiso de suministro

Ante sospecha: congelar publicación, revocar accesos/tokens residuales, preservar logs, identificar versiones, avisar en advisory, deprecar versiones afectadas sin borrarlas salvo necesidad de registry, publicar versión limpia desde entorno recuperado y documentar indicadores. Nunca se sobrescribe un tag o versión para ocultar el incidente.
