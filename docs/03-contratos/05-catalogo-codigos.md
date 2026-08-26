# Catálogo completo de códigos 1.x

Estado: **normativo**

Todos los códigos son ASCII `SCREAMING_SNAKE_CASE`. El mensaje humano no es contrato. Esta tabla es fuente de generación para tipos, schemas, referencia y exit mapping.

## Entrada y límites

| Código | Severidad | Significado |
|---|---|---|
| `INPUT_REQUIRED` | error | falta input obligatorio |
| `INPUT_TYPE_INVALID` | error | tipo no admitido |
| `INPUT_LIMIT_EXCEEDED` | error | tamaño/cardinalidad supera límite |
| `IDENTIFIER_INVALID` | error | ID no cumple formato/longitud |
| `VERSION_INVALID` | error | versión no es exacta/válida |
| `JSON_SYNTAX_INVALID` | error | JSON no parseable |
| `JSON_DUPLICATE_KEY` | error | clave repetida |
| `JSON_VALUE_UNSUPPORTED` | error | valor fuera de JsonValue estricto |
| `JSON_NUMBER_UNSAFE` | error | número no finito/no seguro |
| `UTF8_INVALID` | error | secuencia UTF-8 inválida/incompleta |
| `NDJSON_LINE_EMPTY` | error | línea vacía no final |
| `NDJSON_LINE_TOO_LARGE` | error | línea excede límite |

## Perfil, algoritmo y framing

| Código | Severidad | Significado |
|---|---|---|
| `PROFILE_UNKNOWN` | error | perfil no registrado |
| `PROFILE_VERSION_UNSUPPORTED` | error | versión no soportada |
| `PROFILE_VERSION_CONFLICT` | error | misma clave, implementación distinta |
| `PROFILE_INPUT_KIND_MISMATCH` | error | bytes/JSON incorrecto para perfil |
| `NORMALIZATION_FAILED` | error | perfil no pudo normalizar |
| `ALGORITHM_UNKNOWN` | error | ID no reconocido |
| `ALGORITHM_FORBIDDEN` | error | algoritmo retirado/prohibido |
| `ALGORITHM_VERIFY_ONLY` | warning | permitido solo para historia |
| `DIGEST_ENCODING_INVALID` | error | hex no canónico |
| `DIGEST_LENGTH_INVALID` | error | longitud no coincide con algoritmo |
| `FRAME_MAGIC_INVALID` | error | magic incorrecto |
| `FRAME_VERSION_UNSUPPORTED` | error | protocolo desconocido |
| `FRAME_KIND_UNKNOWN` | error | kind desconocido |
| `FRAME_FIELD_UNKNOWN` | error | tag no admitido |
| `FRAME_FIELD_MISSING` | error | falta tag obligatorio |
| `FRAME_FIELD_DUPLICATE` | error | tag repetido |
| `FRAME_FIELD_ORDER_INVALID` | error | tags desordenados |
| `FRAME_FIELD_TYPE_INVALID` | error | tipo incorrecto |
| `FRAME_LENGTH_INVALID` | error | longitud imposible/truncada |
| `FRAME_TRAILING_DATA` | error | bytes extra no admitidos |

## Evidencia, registro y cadena

| Código | Severidad | Significado |
|---|---|---|
| `EVIDENCE_SCHEMA_UNKNOWN` | error | URN/version no soportada |
| `EVIDENCE_INVALID` | error | estructura inválida |
| `CONTENT_DIGEST_MISMATCH` | error | contenido no coincide |
| `RECORD_DIGEST_MISMATCH` | error | identidad/contexto/registro no coincide |
| `RECORD_ID_DUPLICATE` | error | identidad repetida |
| `CONTENT_DUPLICATE` | warning | contenido repetido según política default |
| `LINK_DIGEST_DUPLICATE` | error | enlace repetido |
| `POSITION_MISMATCH` | error | posición no esperada |
| `PREVIOUS_LINK_MISMATCH` | error | anterior incorrecto |
| `LINK_DIGEST_MISMATCH` | error | enlace recompuesto difiere |
| `CHAIN_CONFIGURATION_MISMATCH` | error | contexto/secuencia/perfil/algoritmo mezclado |
| `CHAIN_FORK` | error | ramas incompatibles observadas |
| `EXPECTED_COUNT_MISMATCH` | error | cantidad difiere |
| `FINAL_LINK_MISMATCH` | error | final esperado difiere |
| `BOUNDARY_UNVERIFIED` | warning | frontera no comprobable |
| `EMPTY_CHAIN_FORBIDDEN` | error | cadena vacía sin opt-in |

## Reglas, stream y ciclo de vida

| Código | Severidad | Significado |
|---|---|---|
| `RULE_FAILED` | error | predicado no satisfecho |
| `RULE_EXECUTION_FAILED` | error | regla externa lanzó/falló |
| `RULE_VERSION_CONFLICT` | error | regla duplicada incompatible |
| `DIAGNOSTIC_LIMIT_REACHED` | warning | salida de diagnósticos truncada |
| `INPUT_STREAM_FAILED` | error | productor async falló |
| `OUTPUT_SINK_FAILED` | error | consumidor de evidencia falló |
| `OPERATION_ABORTED` | info | cancelación solicitada |
| `RESOURCE_BUDGET_EXCEEDED` | error | memoria/cantidad/presupuesto agotado |
| `CONCURRENT_USE_FORBIDDEN` | error | builder usado simultáneamente |
| `BUILDER_FINALIZED` | error | operación tras finalize |
| `BUILDER_FAILED` | error | reutilización tras fallo terminal |
| `OBSERVER_FAILED` | warning | callback de observabilidad falló |
| `IO_READ_FAILED` | error | CLI no pudo leer |
| `IO_WRITE_FAILED` | error | CLI no pudo escribir/commit |
| `OUTPUT_EXISTS` | error | destino existe sin `--force` |
| `INTERNAL_INVARIANT_BROKEN` | error | defecto interno no atribuible a input |

## Mapeo

- Entrada/format/frame/evidence inválido: CLI 3.
- Perfil/algoritmo/versión: CLI 7.
- Presupuesto: CLI 5.
- E/S/output: CLI 6.
- Verificación mismatch/duplicate/fork: CLI 1.
- Solo fronteras insuficientes: CLI 4.
- Uso de argumentos: CLI 2.
- Invariante interno: CLI 70.
- Abort SIGINT: CLI 130.

Una regla de dominio externa usa IDs namespaced propios y no puede reutilizar códigos reservados. Añadir código reservado sigue la política de compatibilidad.
