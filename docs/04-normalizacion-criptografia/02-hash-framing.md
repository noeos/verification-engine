# Hash, separación de dominio y framing binario

Estado: **normativo de protocolo 1**

## Algoritmos

| ID | Node | Digest |
|---|---|---:|
| `sha-256` | `sha256` | 32 bytes |
| `sha-384` | `sha384` | 48 bytes |
| `sha-512` | `sha512` | 64 bytes |

Primitivas proceden de `node:crypto`. Creación predeterminada: SHA-256. SHA-384/512 requieren selección explícita. No se truncan digests. Comparaciones de digests de igual longitud usan operación de tiempo constante; longitud se valida antes.

## Objetivos del framing

- Ninguna pareja de listas de campos distintas produce los mismos bytes estructurales.
- Tipo, etiqueta, longitud y valor quedan comprometidos.
- No depende de JSON, locale, endianness de host ni concatenación textual.
- Se puede emitir incrementalmente sin construir un buffer completo.

## Cabecera

Cada frame comienza:

```text
magic        8 bytes ASCII: NOEOSVE1
kind         uint8: 0x01 content, 0x02 record, 0x03 link, 0x04 evidence
protocol     uint16 big-endian: 0x0001
fieldCount   uint16 big-endian
```

Cada campo, en tag ascendente:

```text
tag          uint16 big-endian
type         uint8: 0x01 bytes, 0x02 UTF-8, 0x03 uint64, 0x04 none
length       uint64 big-endian
value        exactamente length bytes
```

- `uint64` tiene longitud 8 y valor big-endian; la API 1.x limita posición/contador a entero seguro.
- `none` tiene longitud 0 y ningún valor.
- UTF-8 debe ser válido y su longitud es de bytes, no caracteres.
- Tags desconocidos no se aceptan en protocolo 1.
- Repetir, omitir o desordenar tags es error.

## Frame de contenido `0x01`

| Tag | Tipo | Valor |
|---:|---|---|
| 1 | UTF-8 | `algorithmId` |
| 2 | UTF-8 | `profileId` |
| 3 | UTF-8 | `profileVersion` |
| 4 | bytes | contenido normalizado |

`contentDigest = H(contentFrame)`.

## Frame de registro `0x02`

| Tag | Tipo | Valor |
|---:|---|---|
| 1 | UTF-8 | `algorithmId` |
| 2 | UTF-8 | `contextId` |
| 3 | UTF-8 | `recordId` |
| 4 | UTF-8 | `profileId` |
| 5 | UTF-8 | `profileVersion` |
| 6 | uint64 | longitud normalizada |
| 7 | bytes | `contentDigest` |

`recordDigest = H(recordFrame)`.

## Frame de enlace `0x03`

| Tag | Tipo | Valor |
|---:|---|---|
| 1 | UTF-8 | `algorithmId` |
| 2 | UTF-8 | `contextId` |
| 3 | UTF-8 | `sequenceId` |
| 4 | uint64 | posición |
| 5 | UTF-8 | `recordId` |
| 6 | bytes | `recordDigest` |
| 7 | none/bytes | anterior |

`linkDigest = H(linkFrame)`.

Aunque la cabecera y `kind` ya separan dominios, los nombres conceptuales `NOEOS-VE-CONTENT`, `NOEOS-VE-RECORD` y `NOEOS-VE-LINK` se documentan como dominios. No se añade otra cadena redundante; la combinación magic+kind+protocol es su representación normativa.

## Frame de evidencia `0x04`

| Tag | Tipo | Valor |
|---:|---|---|
| 1 | UTF-8 | algoritmo usado para digerir la evidencia |
| 2 | UTF-8 | URN de schema |
| 3 | bytes | JSON JCS completo de evidencia |

Se usa solo por `digestEvidence`. No altera la evidencia ni forma parte del chain.

## Validación y recursos

Longitudes se validan contra límites antes de reservar memoria. Al leer un frame externo:

- se rechazan longitudes fuera de rango o que excedan bytes restantes;
- suma usa aritmética protegida contra overflow;
- no se aceptan frames concatenados salvo contenedor explícito;
- un frame parcial es inválido;
- parser consume incrementalmente y conserva offset de error.

## Evolución criptográfica

- Un nuevo algoritmo seguro puede añadirse en minor si no cambia defaults ni uniones exhaustivas públicas; si la unión es cerrada, requiere major.
- Un nuevo frame/protocolo usa nuevo valor de protocolo y vectores; nunca cambia protocolo 1.
- Agilidad criptográfica no significa aceptar algoritmos arbitrarios.
- Si NIST retira o revisa una recomendación, se activa el proceso de algoritmo retirado.

## Revisión especializada

Antes de `1.0.0`, una revisión independiente debe comprobar separación de dominio, framing, vectores, comparaciones, uso de primitivas y afirmaciones. No se diseña criptografía propia: solo protocolo de composición alrededor de hashes estándar.
