# Protocolo de cadena y evidencias

Estado: **normativo**

## Capas de digest

### Digest de contenido

`contentDigest` compromete:

- dominio `NOEOS-VE-CONTENT`;
- versión de protocolo;
- algoritmo;
- ID y versión del perfil;
- bytes normalizados exactos.

No compromete `recordId`, `contextId`, secuencia ni posición. Por ello el mismo contenido bajo el mismo perfil y algoritmo produce el mismo digest y permite detectar contenido repetido.

### Digest de registro

`recordDigest` compromete:

- dominio `NOEOS-VE-RECORD`;
- versión de protocolo y algoritmo;
- `contextId` y `recordId`;
- ID y versión del perfil;
- longitud normalizada;
- `contentDigest`.

Una evidencia de registro queda ligada a su identidad/contexto sin volver a hashear el payload.

### Digest de enlace

`linkDigest` compromete:

- dominio `NOEOS-VE-LINK`;
- versión de protocolo;
- algoritmo;
- `contextId`;
- `sequenceId`;
- posición;
- `recordId`;
- `recordDigest`;
- anterior (`none` o digest exacto).

Modificar identidad, orden, contexto, secuencia, contenido o anterior cambia el enlace.

## Construcción

1. Validar límites e identificadores.
2. Normalizar payload y calcular `contentDigest`.
3. Crear `recordDigest` ligado a identidad/contexto.
4. Validar que posición y anterior coincidan con el estado.
5. Crear frame de enlace y calcular `linkDigest`.
6. Emitir evidencia.
7. Avanzar estado solo después de completar todo correctamente.

El paso 7 es transaccional en memoria. Una excepción interna conserva el estado anterior y marca el builder como fallido para impedir reintentos ambiguos.

## Génesis

La posición cero usa un campo anterior con tipo `none`. No se sustituye por bytes cero ni digest vacío. El primer enlace sigue comprometiendo contexto y secuencia.

## Cierre de cadena

`ChainSummaryEvidence` incluye:

- algoritmo, protocolo, perfil y contexto;
- secuencia;
- cantidad procesada;
- primer y último `linkDigest`;
- posiciones inicial/final;
- estado de fronteras;
- resumen de diagnósticos;
- estado final.

El resumen no añade un hash nuevo en 1.x: el último enlace ya compromete toda la historia observada. Un consumidor puede firmar o anclar ese valor externamente.

## Modos de verificación

### Completa

Requiere `expectedCount`, inicio cero y uno de:

- `expectedFinalLinkDigest`; o
- manifiesto externo confiable equivalente.

Solo este modo puede afirmar que la secuencia observada coincide completamente con la declaración.

### Fragmento

Declara posición inicial y opcionalmente anterior esperado/final esperado. Cada frontera se marca `verified | unverified | not-applicable`. El estado global es `indeterminate` si la consulta pedía completitud fuera del fragmento.

### Consistencia interna

Comprueba únicamente enlaces presentes. Puede devolver `valid` para “internamente consistente”, pero la afirmación y `verificationMode` deben aparecer en el resultado para evitar confundirla con completitud.

## Detecciones

| Alteración | Condición |
|---|---|
| Payload cambiado | `contentDigest` y `recordDigest` recompuestos difieren. |
| Identidad/contexto cambiado | `recordDigest` y `linkDigest` difieren. |
| Reordenación | posición/anterior/link no coincide. |
| Omisión intermedia | ruptura de posición o anterior. |
| Omisión final | count o final esperado no coincide; sin ellos es indeterminada. |
| Duplicado de identidad | mismo `recordId` observado en alcance configurado. |
| Duplicado de contenido | mismo `contentDigest` observado; warning por defecto. |
| Duplicado de enlace | mismo `linkDigest`; error. |
| Mezcla de perfiles | metadata distinta a configuración de cadena. |
| Fork | dos enlaces para misma secuencia/posición/anterior; detectable al verificar ambas ramas. |

## Memoria para duplicados

La detección exacta global requiere memoria proporcional a la cantidad o un índice externo. El API ofrece:

- `none`: sin detección global;
- `window(n)`: detección exacta en ventana acotada;
- `external(index)`: interfaz proporcionada por el consumidor;
- `full(maxRecords)`: conjunto en memoria bajo máximo explícito.

No se usará Bloom filter para emitir errores porque sus falsos positivos romperían corrección. Puede existir en herramientas analíticas futuras, fuera del resultado normativo.

## Evidencia y custodia

Las evidencias son JSON canónico para transporte, pero su digest no se calcula automáticamente. Si se requiere integridad de la evidencia como documento, el consumidor debe almacenar su hash o anclarla. El motor ofrece una operación explícita `digestEvidence`, con dominio diferente, sin convertirla en firma.
