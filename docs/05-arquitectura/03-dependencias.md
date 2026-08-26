# Dependencias y herramientas

Estado: **normativo**

## Política

El núcleo tendrá cero dependencias runtime. La CLI depende únicamente del workspace engine y APIs estándar de Node. Dependencias de desarrollo deben justificar capacidad que no sea razonable mantener internamente.

## Herramientas previstas

| Función | Selección | Condición |
|---|---|---|
| Compilación | TypeScript compiler | versión exacta en lockfile |
| Tests | `node:test` + helpers propios | cero runner runtime adicional |
| Property testing | `fast-check` | solo dev, fijada y auditada |
| Lint | ESLint + typescript-eslint | configuración versionada |
| API report | `@microsoft/api-extractor` | dev, salida revisada y versionada |
| Coverage | cobertura V8 de Node | umbrales bloqueantes |
| JSON Schema | schemas propios + validador dev | runtime usa validadores propios auditados |
| SBOM | herramienta CycloneDX y SPDX | ejecutada en release |
| Vulnerabilidades | npm audit + OSV/Dependabot | resultados correlacionados, no único control |

La mención de una herramienta no autoriza su última versión automáticamente. La primera implementación registra versión, hash, licencia, mantenedor y necesidad en inventario.

## Admisión de una dependencia

Antes de añadirla se documenta:

1. necesidad y alternativas;
2. alcance runtime/dev/CI;
3. licencia y compatibilidad Apache-2.0;
4. salud del proyecto y responsables;
5. historial de vulnerabilidades y publicación;
6. árbol transitivo, scripts de instalación y binarios;
7. capacidad de fijar versión e integridad;
8. plan de sustitución;
9. impacto de privacidad/red;
10. aprobación de ownership correspondiente.

Runtime futuro requiere ADR, presupuesto máximo, revisión de seguridad y major si cambia superficie observable.

## Instalación segura

- `npm ci --ignore-scripts` es default en CI cuando la tarea lo permita.
- Excepciones a scripts se enumeran por paquete y se ejecutan en job aislado sin secretos.
- Lockfile se revisa como código.
- No rangos flotantes en acciones de CI; acciones fijadas por commit SHA y anotadas con versión humana.
- Registry configurado explícitamente y lockfile con integridad.
- Overrides temporales llevan issue, causa y caducidad.

## Actualizaciones

- Seguridad crítica: evaluación inmediata.
- Patch/minor de herramientas: PR automatizada, CI completa y revisión.
- Major: análisis de migración y comparación de artefactos.
- Dependencia abandonada o sin release seguro: reemplazo antes del siguiente release.
- No se ignora advisory sin VEX/justificación y fecha de revisión.

## Build

ESM y CommonJS se compilan desde la misma fuente con configuraciones TypeScript separadas. Declaraciones `.d.ts` se generan una vez desde superficie pública y se verifican. No se minifica la biblioteca; favorece auditoría y stack traces. La CLI puede empaquetarse solo si el artefacto conserva licencias, sourcemaps controlados y reproducibilidad.
