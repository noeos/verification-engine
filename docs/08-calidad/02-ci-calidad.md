# Integración continua y puertas de calidad

Estado: **normativo**

## Pipeline de pull request

1. metadata, DCO/licencia y policy checks;
2. documentación: links, IDs, términos prohibidos y snippets;
3. instalación limpia desde lockfile;
4. formato/lint;
5. TypeScript strict y API report;
6. unit + property + coverage;
7. schemas + vectors + contrato;
8. integración y E2E Linux Node primario;
9. matriz LTS soportada;
10. fuzz smoke y mutation selectivo;
11. dependency/license/secret/SAST/workflow scans;
12. build ESM/CJS/CLI;
13. `npm pack` e inspección de contenido;
14. consumer install smoke;
15. benchmark crítico.

Jobs independientes se paralelizan, pero branch protection exige todos. Node Current puede ser informativo hasta entrar en política LTS; su fallo abre issue y se analiza antes del siguiente release.

## Pipeline de `main`

Además:

- fuzz prolongado;
- mutation completo programado;
- benchmarks dedicados;
- E2E OS/arquitecturas;
- SBOM y vulnerability correlation;
- build reproducibility;
- docs generated drift;
- corpus y fixture integrity.

## Pipeline de release candidate

Se ejecuta desde tag firmado candidato sobre commit de `main`:

1. todos los gates desde cero y sin caches;
2. auditoría del changelog/API/security impact;
3. builds dobles reproducibles;
4. SBOM CycloneDX/SPDX y license report;
5. checksums y vector digest;
6. package content allowlist;
7. provenance dry-run/attestation verificable;
8. stage npm mediante OIDC;
9. instalar tarball staged en proyectos limpios ESM/CJS/CLI;
10. aprobación humana 2FA;
11. publicación/promoción;
12. verificación post-registry y creación de expediente.

## Permisos y aislamiento

- Default read-only.
- PR no confiable no tiene secrets, OIDC write ni environment de release.
- Release environment requiere reviewers.
- Concurrency lock impide dos releases simultáneas.
- Workflows reutilizables fijados y revisados.
- Logs se retienen según política y se escanean para secretos.

## Gates bloqueantes

- cualquier test/scan requerido fallido;
- vulnerabilidad Critical/High explotable sin fix;
- licencia desconocida/incompatible;
- cambio API no reflejado;
- drift de generado/lock;
- reducción de cobertura/mutation bajo umbral;
- benchmark fuera de presupuesto;
- artifact inesperado;
- provenance/SBOM incompleto;
- decisión abierta o contradicción documental;
- firma/aprobación/review ausente.

## Flakiness e infraestructura

No se marca verde reintentando hasta pasar. Se distingue fallo de infraestructura mediante job idempotente y evidencia; un rerun debe quedar registrado. Si no puede probarse que es infraestructura, se trata como producto.

## Retención

- PR logs/artifacts: mínimo 90 días.
- Release evidence: toda la vida de soporte + 5 años.
- Security-sensitive logs: acceso restringido y retención según incidente/legal.
- Resultados públicos relevantes se adjuntan a release sin datos sensibles.
