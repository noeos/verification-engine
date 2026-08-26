# Concurrencia, streaming y recursos

Estado: **normativo**

## Modelo

Una cadena es secuencial porque cada enlace depende del anterior. El motor no intenta paralelizar enlaces. Normalización/hash de payloads podrían prepararse en paralelo por el consumidor, pero la API estándar procesa en orden para mantener memoria y fallos predecibles.

## Async iterable

- Se solicita como máximo un elemento adelantado por default.
- El elemento se valida, normaliza, hashea y enlaza antes de pedir el siguiente.
- El productor controla backpressure mediante la resolución de `next()`.
- Errores del iterable se convierten en `INPUT_STREAM_FAILED` con causa redactada.
- `return()` se invoca al abortar cuando existe.

Una opción futura de prefetch solo podrá ser 0–16, mantendrá orden y presupuesto total; no forma parte del default 1.x hasta demostrar beneficio sin ampliar riesgo.

## Chunks de bytes

Los perfiles streaming reciben chunks sin asumir fronteras semánticas. UTF-8 puede dividirse entre chunks; el decoder estricto conserva estado y falla ante secuencia incompleta al final. NDJSON limita buffer a una línea máxima.

## Cancelación

`AbortSignal` se comprueba:

1. antes de iniciar;
2. antes y después de cada lectura;
3. después de normalización costosa;
4. antes de emitir evidencia/finalizar.

Cancelación limpia buffers temporales alcanzables, cierra handles de CLI y devuelve estado `aborted`. No promete borrado físico de memoria administrada por V8.

## Thread safety

- `Engine` es reutilizable en concurrencia porque es inmutable.
- `ChainBuilder` no es concurrente; llamadas solapadas devuelven `CONCURRENT_USE_FORBIDDEN`.
- Un builder pertenece a un solo worker/thread.
- Transferir buffers puede invalidar propiedad y no está permitido mientras una operación los use.
- Worker threads son responsabilidad del consumidor; resultados se combinan solo mediante protocolo explícito.

## Memoria

- Buffers temporales se liberan por registro.
- JCS requiere ordenar claves de cada objeto, por lo que memoria depende del registro individual, no de toda la secuencia.
- Diagnósticos y detección de duplicados tienen límites separados.
- No se acumulan evidencias salvo que el consumidor elija API de lote materializado; para grandes volúmenes se usa callback/iterable de salida.

## Fallos parciales

En modo stream, cada evidencia emitida antes de un fallo es válida para su operación, pero no existe resumen final válido. El envelope final declara fallo y última posición completada. CLI que escribe archivo usa un manifest lateral/final para distinguir salida completa; si se solicita atomicidad total, usa archivo temporal con el coste de disco correspondiente.

## Recursos externos

La biblioteca no abre archivos ni sockets. La CLI limita descriptores a entradas/salidas declaradas, cierra en `finally` y no mantiene daemon. No hay pools, threads persistentes ni tareas flotantes al terminar.
