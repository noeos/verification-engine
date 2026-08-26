# Normalización y perfiles

Estado: **normativo**

## Propiedad esencial

Una normalización es una función total sobre su dominio declarado: para toda entrada válida devuelve exactamente unos bytes; para cualquier otra devuelve diagnósticos deterministas. No consulta estado externo ni corrige datos silenciosamente.

## Perfil `dev.noeos.raw-bytes@1.0.0`

- Entrada: `Uint8Array`.
- Salida: copia exacta de bytes.
- Vacío: permitido si el consumidor no lo prohíbe mediante regla.
- Límite: presupuestos globales.
- No interpreta codificación.

## Perfil `dev.noeos.jcs@1.0.0`

Implementa RFC 8785 con entrada I-JSON y salida UTF-8 de la serialización canónica.

Reglas obligatorias:

1. validar árbol antes de serializar;
2. rechazar claves duplicadas en texto de entrada;
3. rechazar `NaN`, infinitos y valores no JSON;
4. rechazar cualquier número matemáticamente entero fuera de `Number.MIN_SAFE_INTEGER..Number.MAX_SAFE_INTEGER`; otros números deben ser finitos y round-trip bajo la semántica binaria64 de JCS;
5. serializar números conforme a ECMAScript exigido por JCS; `-0` se representa como `0`;
6. ordenar propiedades por valores de unidades de código UTF-16, sin locale;
7. aplicar escaping mínimo definido por JCS/ECMAScript;
8. preservar strings: no aplicar NFC, NFKC, case-folding, trim ni conversión de saltos;
9. codificar resultado como UTF-8 estricto;
10. no incluir espacios ni BOM.

La implementación se compara con vectores RFC 8785 y una segunda implementación de referencia solo como oracle de test, nunca como dependencia runtime.

## Unicode

El motor valida strings JavaScript para rechazar surrogates no emparejados. Un perfil de dominio puede exigir NFC según Unicode UAX #15, pero debe:

- declarar versión de perfil;
- definir si normaliza o rechaza entradas no NFC;
- ejecutar tests oficiales `NormalizationTest.txt` para la versión Unicode soportada;
- congelar el resultado mediante vectores para evitar cambios invisibles de runtime.

NFKC no se utilizará como default porque puede eliminar distinciones significativas.

## Perfil externo

Contrato mínimo:

```ts
interface NormalizationProfile<I = unknown> {
  readonly id: ProfileId;
  readonly version: ProfileVersion;
  readonly inputKind: "json" | "bytes";
  validate(input: unknown, limits: Limits): OperationResult<I>;
  normalize(input: I, sink: ByteSink, limits: Limits): OperationResult<NormalizationStats>;
}
```

El uso de `ByteSink` evita exigir un buffer contiguo. La función debe escribir una única secuencia lógica; si falla, el sink se descarta.

## Registro de perfiles

- Clave `(id, version)` única.
- Incorporados no pueden sustituirse.
- Colisión con implementación diferente es `PROFILE_VERSION_CONFLICT`.
- Perfil externo debe aportar manifest con nombre, versión, hash de vectores, límites y licencia.
- CLI pública solo incluye perfiles compilados y publicados; no carga perfil desde disco.

## Evolución

Cualquier cambio que altere un byte crea nueva versión major del perfil. Optimización que produce exactamente los mismos bytes puede ser patch. Ampliar entradas aceptadas sin cambiar salidas existentes es minor, pero requiere vectores negativos anteriores para demostrar que el cambio es intencional.

## Pruebas obligatorias

- idempotencia donde aplique;
- misma salida tras parse/serialize permitido;
- independencia de orden de inserción de propiedades;
- Unicode extremo y surrogate inválido;
- números en fronteras y representaciones equivalentes;
- profundidad/tamaño exactos;
- chunks de cualquier partición producen mismos bytes;
- ningún error deja bytes reutilizables como salida válida.
