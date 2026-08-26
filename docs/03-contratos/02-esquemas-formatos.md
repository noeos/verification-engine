# Esquemas y formatos de intercambio

Estado: **normativo**

## Reglas JSON

- Codificación UTF-8 estricta sin BOM para archivos nuevos.
- Objetos con claves únicas.
- Sin comentarios ni trailing commas.
- Números finitos dentro de semántica I-JSON/IEEE-754 binaria64.
- Digests como hexadecimal ASCII minúsculo sin `0x`.
- IDs y enums sensibles a mayúsculas.
- Campos desconocidos se rechazan en operaciones normativas.
- Orden de campos no es significativo al parsear; la salida canónica usa JCS.

## URNs de esquema

```text
urn:noeos:verification-engine:record-evidence:1
urn:noeos:verification-engine:link-evidence:1
urn:noeos:verification-engine:chain-summary:1
urn:noeos:verification-engine:diagnostic:1
urn:noeos:verification-engine:vector-set:1
```

Los JSON Schema se distribuirán en el paquete y repositorio. `$id` usa la URN; una copia navegable puede publicarse en noeos.dev sin cambiar identidad.

## `RecordEvidence` v1

Campos obligatorios:

```json
{
  "$schema": "urn:noeos:verification-engine:record-evidence:1",
  "protocolVersion": 1,
  "contextId": "example.context",
  "recordId": "record-0001",
  "profile": { "id": "dev.noeos.jcs", "version": "1.0.0" },
  "algorithm": "sha-256",
  "normalizedByteLength": 123,
  "contentDigest": "<64 lowercase hex chars>",
  "recordDigest": "<64 lowercase hex chars>"
}
```

`normalizedByteLength` es entero seguro no negativo. La evidencia representa una operación exitosa; diagnósticos pertenecen al resultado, no alteran el artefacto criptográfico.

## `LinkEvidence` v1

Añade:

```json
{
  "$schema": "urn:noeos:verification-engine:link-evidence:1",
  "protocolVersion": 1,
  "contextId": "example.context",
  "sequenceId": "sequence-2026",
  "position": 0,
  "recordId": "record-0001",
  "profile": { "id": "dev.noeos.jcs", "version": "1.0.0" },
  "algorithm": "sha-256",
  "normalizedByteLength": 123,
  "contentDigest": "<hex>",
  "recordDigest": "<hex>",
  "previous": { "kind": "none" },
  "linkDigest": "<hex>"
}
```

Para posición mayor que cero, `previous` es `{ "kind": "digest", "value": "<hex>" }`.

## `ChainSummaryEvidence` v1

Incluye `sequenceId`, perfil, algoritmo, `count`, `firstPosition`, `lastPosition`, `firstLinkDigest`, `finalLinkDigest` y `boundaries`. Para cadena vacía, `count` es cero y no existen digests/posiciones; solo puede producirse si `allowEmpty` fue explícito.

## NDJSON

- Una entidad JSON completa por línea LF; se acepta CRLF al leer.
- Línea vacía prohibida salvo al final del archivo.
- Máximo predeterminado por línea: 1 MiB de bytes UTF-8.
- El parser es incremental y reporta número de línea y byte offset.
- Un fallo de sintaxis no concatena líneas siguientes para “recuperar”.
- Output siempre LF y termina en LF.

## Envelopes CLI

La salida máquina usa:

```json
{"kind":"result","operation":"hash-record","ok":true,"value":{}}
```

o

```json
{"kind":"result","operation":"verify-chain","ok":false,"status":"invalid","diagnostics":[]}
```

Cada línea es autocontenida. Las estadísticas finales usan `kind: "summary"`.

## Límites predeterminados

| Valor | Default | Máximo duro 1.x |
|---|---:|---:|
| Payload/registro | 1 MiB | 16 MiB |
| Profundidad JSON | 64 | 128 |
| Propiedades por objeto | 10.000 | 100.000 |
| Elementos por array | 100.000 | 1.000.000 |
| Longitud string UTF-8 | 1 MiB | 16 MiB |
| Línea NDJSON | 1 MiB | 16 MiB |
| Diagnósticos | 1.000 | 10.000 |
| Registros modo `full` | 1.000.000 | 5.000.000 |

Los consumidores pueden reducir límites. Aumentar por encima del máximo duro requiere una nueva major o API interna explícitamente no soportada.

## Evolución

Cada esquema conserva sus fixtures válidos e inválidos. La versión del esquema cambia solo si cambia interpretación o estructura. Una major de paquete puede leer varias versiones de evidencia; nunca reescribe evidencia antigua silenciosamente.
