# Modelo de dominio

Estado: **normativo**

## Principios

- Todos los valores son inmutables una vez validados.
- Los tipos opacos impiden mezclar IDs, digests y versiones.
- Ninguna entidad contiene objetos empresariales.
- La construcción valida antes de asignar un tipo de dominio.
- La serialización pública no expone estructuras internas.

## Valores fundamentales

### Identificadores

`RecordId`, `SequenceId` y `ContextId` son ASCII, sensibles a mayúsculas, de 1 a 128 bytes y cumplen:

```text
^[A-Za-z0-9][A-Za-z0-9._:/-]{0,127}$
```

No se normalizan. Los consumidores que partan de identificadores Unicode deben transformarlos fuera del motor y conservar esa regla en su perfil.

### Versiones e IDs técnicos

- `ProfileId`: nombre DNS inverso o namespace npm estable, máximo 128 ASCII; ejemplos `dev.noeos.jcs`, `es.noeos.verifactu.record`.
- `ProfileVersion`: SemVer completo sin rango.
- `ProtocolVersion`: entero positivo cerrado por la biblioteca.
- `AlgorithmId`: unión cerrada `sha-256 | sha-384 | sha-512` para creación 1.x.
- `Position`: entero entre `0` y `Number.MAX_SAFE_INTEGER`; génesis es `0`.

### JSON admisible

`JsonValue` admite `null`, boolean, string Unicode válido, número finito compatible con I-JSON, arrays y objetos con claves únicas. Rechaza `undefined`, `bigint`, funciones, símbolos, `NaN`, infinitos, ciclos, propiedades heredadas, accesores, instancias de clase, sparse arrays y claves duplicadas detectadas al parsear texto.

El parser seguro de la CLI debe detectar duplicados antes de construir el objeto; `JSON.parse` por sí solo no es suficiente para esa garantía.

### Bytes

`ByteView` se copia al entrar en operaciones duraderas o se consume de forma inmediata bajo contrato documentado. Ninguna salida comparte memoria mutable con la entrada.

## Agregados

### `NormalizationProfile`

Contiene ID, versión, tipo de entrada, límites propios y una función determinista `input -> bytes | diagnostics`. Un perfil registrado es inmutable. Dos perfiles con igual ID y versión deben ser byte a byte equivalentes; registrar una implementación diferente es error terminal.

Perfiles incorporados:

- `dev.noeos.raw-bytes@1.0.0`: identidad de bytes.
- `dev.noeos.jcs@1.0.0`: JSON Canonicalization Scheme RFC 8785.

### `HashAlgorithm`

Describe ID, longitud de digest y operación incremental. Las implementaciones incorporadas delegan en `node:crypto`; no se implementan primitivas hash manualmente.

### `RecordInput`

```text
contextId   obligatorio
recordId    obligatorio
payload     JSON o bytes, coherente con el perfil
profile     ID + versión exacta
algorithm   ID exacto
```

El contenido produce `contentDigest`. `recordDigest` compromete `contextId`, `recordId`, perfil, longitud y `contentDigest`. Así una evidencia de registro no puede trasladarse silenciosamente a otra identidad/contexto, mientras `contentDigest` permite reconocer contenido idéntico bajo identidades distintas.

### `RecordEvidence`

Incluye protocolo, algoritmo, perfil, `contentDigest`, `recordDigest`, tamaños e IDs. No incluye payload ni bytes normalizados. Puede incluir un `metadataDigest` solo si un perfil futuro lo define; 1.x no lo emite.

### `ChainLinkInput`

Añade `sequenceId`, `position`, `previousLinkDigest` y `RecordEvidence`. Para posición cero el anterior es el discriminante `none`; para cualquier otra posición debe existir y tener longitud correcta.

### `LinkEvidence`

Incluye todos los valores necesarios para verificar el enlace, `recordDigest` y `linkDigest`. No duplica payload.

### `ChainState`

Estado encapsulado con configuración inmutable, siguiente posición, enlace anterior, contadores y estructuras acotadas de detección. Después de error terminal o cancelación no puede reutilizarse.

### `VerificationResult`

```text
status: valid | invalid | indeterminate | aborted
diagnostics: lista ordenada
evidence: evidencia solo si la fase correspondiente terminó
stats: contadores exactos sin tiempo de reloj
boundaries: fronteras realmente verificadas
```

`valid` exige cero diagnósticos `error` y suficiente información para la afirmación solicitada. `indeterminate` no es éxito parcial.

## Invariantes

1. IDs y versiones siempre son explícitos.
2. No existe algoritmo o perfil implícito dentro de una evidencia.
3. Un digest tiene longitud exacta para su algoritmo.
4. Posiciones son contiguas y empiezan en cero dentro de una cadena nueva.
5. Un estado pertenece a una única secuencia, contexto, algoritmo y perfil.
6. Toda salida puede congelarse profundamente sin perder funcionalidad.
7. Ningún resultado contiene referencias a buffers mutables de entrada.
8. Una evidencia desconocida puede conservarse como datos, pero no declararse válida.
