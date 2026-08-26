# Casos de uso y flujos completos

Estado: **normativo**

## CU-01 · Calcular evidencia de un registro

Entrada: payload, identidad de registro, perfil de normalización, algoritmo y contexto.
Salida: `contentDigest`, `recordDigest`, metadatos de reproducción y diagnósticos.

Flujo:

1. validar tipo y presupuestos;
2. resolver perfil por ID y versión desde un registro confiable local;
3. normalizar a bytes;
4. construir framing de registro;
5. calcular digest;
6. devolver evidencia sin payload.

Falla cerrada si cualquier valor es ambiguo, no finito, excede límites o usa un perfil desconocido.

## CU-02 · Añadir un registro a una cadena

Entrada adicional: `sequenceId`, posición exacta y enlace anterior o génesis.
Salida: evidencia de registro y enlace, siguiente estado de cadena.

La posición debe ser el entero seguro esperado. El enlace anterior debe coincidir byte a byte. No se permite “saltar” posiciones ni inferir un anterior ausente.

## CU-03 · Verificar un registro

El consumidor aporta payload y evidencia esperada. El motor recompone la evidencia con la versión declarada y compara algoritmo, perfil, contexto y digest. Devuelve `valid`, `invalid` o `indeterminate`; nunca solo un booleano.

## CU-04 · Verificar una secuencia completa

La declaración incluye inicio, fin, número esperado y, cuando exista, digest final anclado externamente. El motor verifica cada registro, continuidad, posiciones, duplicados y final esperado. Puede afirmar completitud solo respecto de esa declaración.

## CU-05 · Verificar un fragmento

Se procesa un intervalo que puede incluir enlace anterior de frontera y enlace siguiente esperado. El resultado marca explícitamente qué bordes se comprobaron. Sin ambos bordes no se afirma completitud global.

## CU-06 · Procesar NDJSON por CLI

La CLI lee UTF-8 estricto desde archivo o stdin, procesa línea a línea y escribe NDJSON a stdout. Mensajes humanos van a stderr. Un error de una línea se representa según `--error-mode`; jamás se mezcla texto humano con salida máquina.

## CU-07 · Aplicar reglas

Reglas incorporadas o registradas explícitamente por el host reciben valores inmutables y contexto acotado. Producen diagnósticos ordenados de forma determinista. Una regla del consumidor se considera código confiable del proceso y no recibe sandboxing del motor.

## CU-08 · Verificación independiente

Un tercero instala una versión concreta de CLI, obtiene vectores/esquemas, verifica provenance del paquete y reproduce evidencias sin la aplicación originaria ni acceso a su base de datos.

## CU-09 · Migración controlada

El consumidor verifica secuencias con un perfil antiguo y genera una nueva cadena bajo un perfil nuevo. Nunca se cambia la evidencia antigua. La relación entre ambas se conserva externamente o mediante metadata de migración definida por el consumidor.

## CU-10 · Investigación de alteración

El motor identifica el primer punto observado de divergencia, conserva diagnósticos posteriores sin asumir una única causa y devuelve ubicaciones seguras. No incluye payloads completos en diagnósticos.

## Matriz de actores y autoridad

| Decisión | Motor | Consumidor |
|---|---:|---:|
| Bytes exactos bajo perfil incorporado | responsable | selecciona perfil |
| Semántica del payload | no | responsable |
| Algoritmo admitido | valida/ejecuta | selecciona según su contrato |
| Persistencia y retención | no | responsable |
| Anclaje, firma y fecha | no | responsable |
| Límites inferiores a defaults | aplica | puede endurecer |
| Relajar máximos duros | no | no en API pública 1.x |
| Interpretación legal | no | responsable con asesoramiento |
