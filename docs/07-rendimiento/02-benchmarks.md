# Metodología de benchmarks y regresiones

Estado: **normativo**

## Suite

Cada escenario tiene generador determinista, seed registrada, fixture hash, warm-up, duración mínima, muestras y unidad. Se miden por separado:

- validación;
- JCS/raw normalization;
- framing;
- SHA-256/384/512;
- record completo;
- link/cadena;
- reglas y diagnósticos;
- parsing NDJSON;
- CLI startup/E2E;
- memoria y GC.

## Datos

Fixtures sintéticos cubren:

- 0 B, 64 B, 1 KiB, 16 KiB, 1 MiB y 16 MiB;
- objetos planos, profundos, arrays, claves largas, Unicode y bytes;
- casos válidos e inválidos tempranos/tardíos;
- cadenas cortas y 10 millones streaming;
- políticas de duplicados none/window/full/external simulado.

No se usan datos de clientes.

## Procedimiento

1. verificar commit y árbol limpio;
2. instalar con `npm ci --ignore-scripts` salvo allowlist;
3. compilar release;
4. registrar entorno y calibración;
5. ejecutar correctness tests antes y después;
6. warm-up hasta estabilización;
7. ejecutar muestras aleatorizando orden de escenarios;
8. conservar raw data y resumen;
9. comparar con baseline de misma serie;
10. firmar/adjuntar informe al release.

## Estadística

- Throughput: mediana e intervalo bootstrap 95%.
- Latencia: p50, p95, p99 y máximo observado.
- Memoria: RSS, heap used, external y peak.
- Se eliminan outliers solo por criterio predefinido y se conserva dato bruto.
- Una máquina inestable invalida corrida; no se selecciona el mejor resultado.

## Gates de regresión

- >5% de degradación con intervalo que no solape: warning y análisis.
- >10%: bloqueo de merge/release.
- >5% de aumento de peak memory: análisis; >10% bloqueo.
- Incumplir un objetivo absoluto siempre bloquea 1.0/release estable.
- Mejora que cambie resultados es bug aunque sea más rápida.

Una excepción temporal requiere causa, perfil afectado, issue, mitigación y expiración ≤30 días; no se permite para 1.0.0.

## PR y jobs programados

- PR: microbenchmarks críticos con tolerancia amplia y detección de cambios grandes.
- `main` nocturno: suite completa en runner dedicado.
- Release candidate: suite completa repetida en Node primario y smoke en secundario.
- Trimestral: macOS/Windows y arm64 para detectar anomalías, sin comparar cifras entre hardware.

## Profiling

Optimización solo tras perfil CPU/heap. Los informes no incluyen paths o datos sensibles. Se investiga allocation, GC, copias, ordenación y parsing. No se introduce native addon/WASM sin ADR, threat model, portability, benchmarks y plan de supply chain.

## Publicación

Se publica un resumen reproducible con hardware, Node, escenarios, commit y límites. Los datos completos permanecen como artifact. Marketing no puede extrapolar cifras a hardware o payloads distintos.
