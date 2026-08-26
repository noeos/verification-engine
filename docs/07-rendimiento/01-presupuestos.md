# Presupuestos y objetivos de rendimiento

Estado: **normativo**

## Principio

Corrección y seguridad no se sacrifican por velocidad. Los objetivos son gates del producto en entorno de referencia, no garantías para hardware del consumidor.

## Entorno de referencia

- Linux x86_64 de 64 bits, runner dedicado.
- 4 vCPU físicas/lógicas asignadas de forma estable, 8 GiB RAM.
- Node 24 LTS actualizado al último patch aprobado.
- CPU governor de rendimiento, sin otros workloads relevantes.
- Repositorio limpio, build release, telemetría externa desactivada.
- Versión de kernel, CPU, microcode, Node y commit guardados con cada informe.

Antes de fijar baseline inicial se ejecuta calibración criptográfica y CPU; cambiar hardware crea nueva serie, no reescribe historia.

## Escenarios y gates

| ID | Escenario | Objetivo mínimo/máximo |
|---|---|---|
| P-01 | `raw-bytes`, SHA-256, content+record digests, payload 1 KiB | ≥80.000 registros/s |
| P-02 | JCS, objeto plano ~1 KiB, SHA-256, content+record digests | ≥45.000 registros/s |
| P-03 | JCS + content+record+link digests ~1 KiB | ≥30.000 enlaces/s |
| P-04 | Registro JCS ~1 KiB individual | p95 ≤0,5 ms; p99 ≤1 ms |
| P-05 | Stream de 1 GiB, registros 1 KiB, sin detección global | RSS incremental ≤128 MiB |
| P-06 | Stream de 10 millones de registros vacíos/raw | memoria estable tras warm-up; pendiente ≤2 registros |
| P-07 | CLI `version` | p95 inicio+salida ≤250 ms |
| P-08 | CLI primer registro NDJSON | p95 ≤500 ms sin incluir lectura de red |
| P-09 | Verificación negativa primer enlace, fail-fast | no más de 2× coste del caso válido equivalente |
| P-10 | Abort signal entre registros | respuesta ≤100 ms salvo operación síncrona actual |

La implementación debe superar gates en mediana de al menos 10 muestras válidas. Para latencias se usan al menos 10.000 operaciones tras warm-up.

## Complejidad obligatoria

| Operación | Tiempo | Memoria adicional |
|---|---|---|
| Hash raw | O(bytes) | O(1) por chunk |
| JCS | O(bytes + claves log claves por objeto) | O(tamaño del registro/objeto actual) |
| Enlace | O(tamaño frame) | O(1) |
| Cadena streaming | O(total bytes) | O(registro máximo + diagnósticos + política duplicados) |
| Duplicados full | O(n) esperado | O(n) explícito |
| Duplicados window | O(n) | O(window) |

Una degradación asintótica requiere rediseño, no excepción de benchmark.

## Límites de protección

Los máximos de formatos son controles de seguridad. Además:

- normalización síncrona individual no admite payload >16 MiB;
- CLI usa streaming para archivos;
- tiempo no se corta dentro de una operación síncrona mediante reloj, porque dañaría determinismo; se limita tamaño antes;
- consumers pueden usar worker/process timeout para aislamiento fuerte;
- `maxDiagnostics`, duplicados y buffers tienen presupuestos independientes.

## Rendimiento de algoritmos

No se presupone que SHA-512 sea más lento o rápido en todas las plataformas. Cada algoritmo se mide. El default no cambia por benchmark; SHA-256 permanece por contrato.

## Optimización permitida

- sinks incrementales;
- evitar copias demostrablemente seguras;
- precomputar cabeceras constantes inmutables;
- reutilizar buffers internos no observables y acotados;
- especializar validación tras pruebas equivalentes.

Prohibido: saltar validación, usar comparación no constante, depender del orden de objeto, mantener caches globales, cambiar bytes o emitir evidencia antes de completar.
