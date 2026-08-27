# Reglas, diagnósticos y resultados

Estado: **normativo**

## Modelo de reglas

Una regla tiene:

- `id` ASCII estable y namespaced;
- versión SemVer exacta;
- fases declaradas: `input`, `normalization`, `record`, `link`, `chain`;
- severidad por defecto;
- requisitos de contexto;
- función determinista y sin efectos laterales;
- documentación y tests propios.

El motor incorpora reglas estructurales. Los consumidores registran reglas de dominio mediante construcción explícita de un `RuleSet`; no hay descubrimiento de módulos, nombres de archivo ni red.

## Contrato de ejecución

- Las entradas se presentan como vistas inmutables.
- No se entrega reloj, red, entorno ni generador aleatorio.
- Las reglas se ejecutan en orden lexicográfico por ID y versión dentro de cada fase.
- Los diagnósticos se recogen y ordenan después; el orden de registro no cambia la salida.
- Una excepción de regla externa produce `RULE_EXECUTION_FAILED`, invalida esa operación y no expone stack al resultado público.
- El motor no pretende aislar código confiable del host; el proceso consumidor es responsable de ejecutarlo.

## Diagnóstico

Campos normativos:

```text
code          código estable SCREAMING_SNAKE_CASE
severity      error | warning | info
phase         input | normalization | record | link | chain | output
messageKey    clave estable, no texto localizado
path          JSON Pointer seguro o campo de protocolo
recordId      opcional
position      opcional
details       mapa permitido y redactado
causeCode     opcional; nunca stack o excepción completa
```

No se incluyen payload, secretos, rutas absolutas, nombres de usuario, variables de entorno ni stacks por defecto.

## Taxonomía

| Familia | Ejemplos |
|---|---|
| Entrada | `INPUT_TYPE_INVALID`, `INPUT_LIMIT_EXCEEDED`, `JSON_DUPLICATE_KEY` |
| Perfil | `PROFILE_UNKNOWN`, `PROFILE_VERSION_UNSUPPORTED`, `NORMALIZATION_FAILED` |
| Algoritmo | `ALGORITHM_UNKNOWN`, `ALGORITHM_FORBIDDEN`, `DIGEST_LENGTH_INVALID` |
| Registro | `RECORD_DIGEST_MISMATCH`, `RECORD_ID_DUPLICATE`, `CONTENT_DUPLICATE` |
| Cadena | `POSITION_MISMATCH`, `PREVIOUS_LINK_MISMATCH`, `LINK_DIGEST_MISMATCH`, `CHAIN_FORK` |
| Frontera | `EXPECTED_COUNT_MISMATCH`, `FINAL_LINK_MISMATCH`, `BOUNDARY_UNVERIFIED` |
| Regla | `RULE_FAILED`, `RULE_EXECUTION_FAILED`, `RULE_VERSION_CONFLICT` |
| Operación | `OPERATION_ABORTED`, `RESOURCE_BUDGET_EXCEEDED`, `INTERNAL_INVARIANT_BROKEN` |

La lista completa está fijada en `03-contratos/05-catalogo-codigos.md`; se publicará como dato generado desde ese registro único y se comprobará contra documentación y schemas.

## Severidad y estado

- `error`: impide `valid`.
- `warning`: la operación puede ser válida, pero existe una condición que el consumidor debe evaluar.
- `info`: evidencia explicativa sin impacto.
- `indeterminate` es estado, no severidad; se usa cuando faltan datos para responder la afirmación solicitada.

## Acumulación

`maxDiagnostics` predeterminado 1.000 por operación. Al alcanzarlo se añade una única señal `DIAGNOSTIC_LIMIT_REACHED` y se detiene la recolección no esencial, manteniendo la verificación estructural si cabe en presupuesto. El resultado no finge ausencia de fallos adicionales.

## Fail-fast

La biblioteca permite `collect` y `fail-fast`. El modo solo cambia cuánto se analiza, nunca la clasificación del primer fallo ni los bytes. CLI usa `collect` por defecto y permite `--fail-fast`.
