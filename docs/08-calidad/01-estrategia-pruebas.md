# Estrategia integral de pruebas

Estado: **normativo**

## Principio de evidencia por riesgo

La cobertura de líneas no demuestra corrección criptográfica. Cada requisito tiene tests proporcionados a su modo de fallo y trazados por ID.

## Niveles

### Unidad

Validadores, codecs, framing, orden, estados y mapeo de errores. Tablas exhaustivas para enums y transiciones. Sin mockear la función bajo prueba.

### Propiedades

Con `fast-check` u herramienta aprobada:

- determinismo;
- no mutación;
- chunking invariance;
- serialización/parseo permitido;
- cambio de cualquier campo comprometido cambia frame y, salvo colisión teórica, digest observado;
- append secuencial equivale a batch/stream;
- límites exactos aceptan N y rechazan N+1;
- diagnóstico ordenado independientemente del registro de reglas.

Seeds de fallos se conservan como regresiones.

### Contrato y vectores

- JSON Schema positivos/negativos.
- API report y tipos compilados desde consumer fixtures.
- Vectores RFC/NIST/Noeos.
- ESM, CommonJS, CLI y herramienta independiente.
- Tarball instalado en proyecto vacío.

### Integración

Perfiles, hash, chain, evidencia y reglas completos; streams, abort, E/S CLI, permisos y archivos atómicos.

### E2E

Linux/macOS/Windows; Node LTS soportados; stdin/stdout, paths con espacios/Unicode, pipes, señales, disco lleno simulado y errores de permisos donde la plataforma permita.

### Compatibilidad

Cada release conserva fixtures de todas las versiones soportadas. Una suite instala versión anterior, genera evidencias y la nueva las verifica; también comprueba que API patch/minor no rompe TypeScript consumers.

### Fuzzing

Targets separados:

- parser JSON con duplicados;
- parser NDJSON;
- parser de evidence/frame;
- normalizador JCS;
- framing incremental;
- verificación de cadena;
- CLI args/config.

PR: corpus + smoke ≥60 s por target en paralelo. Nocturno: ≥30 min por target. Continuo externo cuando esté disponible. Crashes, hangs, OOM, discrepancias y asserts son fallo.

### Mutation testing

Obligatorio en validación, framing, record/link digest y state machine. Mutation score ≥95% en módulos críticos y ≥85% global del código de producción elegible. Mutantes sobrevivientes se justifican individualmente; equivalentes se documentan.

### Rendimiento/estrés

Según `07-rendimiento`. Soak streaming mínimo 2 h antes de 1.0 y cada major, observando memoria y handles.

### Recuperación

Simular release fallida, paquete comprometido, rollback de tooling, pérdida de acceso y reconstrucción desde Git/tag.

## Cobertura

- Líneas y funciones del engine ≥98%.
- Ramas engine ≥95%.
- Framing, algorithms, digest validation y chain transitions: 100% de líneas, ramas y funciones.
- CLI: líneas/funciones ≥95%, ramas ≥90%.
- Ningún archivo se excluye sin motivo y aprobación.

## Calidad de tests

- Tests deterministas, sin red ni hora real.
- Timeouts por test; recursos cerrados.
- No snapshots masivos de protocolo.
- Un test responde qué requisito y amenaza cubre.
- Tests flaky se tratan como defecto: se corrigen o bloquean; no se reintentan silenciosamente.
- `skip`, `only`, tests comentados y assertions vacías fallan CI.

## Oracles

Fuentes externas sirven de oracle solo con versión/licencia fijadas. Para protocolo propio, especificación + vectores independientes. Comparar dos caminos que comparten la misma función no cuenta como independencia.
