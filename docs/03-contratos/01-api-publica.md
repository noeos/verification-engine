# Contrato de API pública

Estado: **normativo para 1.x**

## Paquete

`@noeos/verification-engine` expone únicamente rutas declaradas en `package.json#exports`:

```text
@noeos/verification-engine
@noeos/verification-engine/profiles
@noeos/verification-engine/schemas
@noeos/verification-engine/vectors
```

Importar `dist/*`, `src/*` o cualquier ruta no exportada carece de compatibilidad.

## Superficie conceptual

Las firmas finales conservarán estos nombres y significados:

```ts
createEngine(options?: EngineOptions): Engine

Engine.hashRecord(input: RecordInput): OperationResult<RecordEvidence>
Engine.verifyRecord(input: VerifyRecordInput): VerificationResult<RecordEvidence>
Engine.createChain(config: ChainConfig): ChainBuilder
Engine.verifyChain(input: VerifyChainInput): VerificationResult<ChainSummaryEvidence>
Engine.verifyStream(input: VerifyStreamInput): Promise<VerificationResult<ChainSummaryEvidence>>
Engine.digestEvidence(input: Evidence): OperationResult<Digest>

ChainBuilder.append(input: ChainRecordInput): OperationResult<LinkEvidence>
ChainBuilder.appendAll(input: Iterable<ChainRecordInput>): OperationResult<ChainSummaryEvidence>
ChainBuilder.appendStream(input: AsyncIterable<ChainRecordInput>, options?: StreamOptions): Promise<OperationResult<ChainSummaryEvidence>>
ChainBuilder.snapshot(): ChainSnapshot
ChainBuilder.finalize(): OperationResult<ChainSummaryEvidence>
ChainBuilder.abort(reason?: string): void
```

No se exportan constructores de tipos validados; se crean mediante funciones de parseo/fábrica.

## Resultados

```ts
type OperationResult<T> =
  | { ok: true; value: T; diagnostics: readonly Diagnostic[] }
  | { ok: false; diagnostics: readonly Diagnostic[] };

type VerificationStatus = "valid" | "invalid" | "indeterminate" | "aborted";
```

Errores esperables nunca requieren `try/catch`. Excepciones públicas quedan limitadas a uso inválido del ciclo de vida que no puede representarse como entrada —por ejemplo, usar un builder finalizado— y llevan un `code` estable. Errores internos se capturan en fronteras públicas, se convierten en `INTERNAL_INVARIANT_BROKEN` y permiten diagnóstico local mediante `cause` solo bajo opción de desarrollo que jamás activa la CLI de producción.

## Configuración

`EngineOptions` contiene:

- perfiles adicionales registrados explícitamente;
- algoritmos de solo verificación legado aprobados explícitamente;
- reglas confiables;
- límites iguales o más estrictos que defaults;
- política de duplicados;
- callback opcional de eventos estructurados y redactados.

No acepta URLs, rutas de módulo, código fuente, secretos ni nombres de plugins.

## Inmutabilidad

- Inputs no se mutan.
- Outputs son `readonly` y profundamente congelables.
- Digests de API son copias `Uint8Array` o tipos opacos que solo exponen copia/hex.
- Perfiles y reglas se registran al crear `Engine`; no pueden cambiarse después.
- `ChainBuilder` es el único objeto con estado y no es seguro para llamadas concurrentes.

## Sincronía

- Registro y lotes iterables: síncronos.
- `AsyncIterable`: asíncrono y secuencial por defecto.
- Hash de un enlace nunca se paraleliza porque depende del anterior.
- Normalización previa puede paralelizarse fuera del motor; el consumidor debe preservar orden y presupuestos.

## Abort y backpressure

Métodos async aceptan `AbortSignal`. Se comprueba antes de leer, después de cada registro y antes de finalizar. El motor solicita el siguiente elemento solo tras terminar el actual. Una cancelación devuelve `aborted`, no evidencia final válida.

`StreamOptions.onEvidence`, si existe, recibe cada `LinkEvidence` y puede devolver `Promise<void>`; el motor la espera antes de pedir el siguiente input. Su fallo termina la operación con `OUTPUT_SINK_FAILED`. Esto proporciona salida incremental y backpressure sin acumular evidencias.

## Estabilidad de tipos

- Añadir un campo obligatorio es breaking.
- Añadir variante a una unión exhaustiva es breaking salvo que el contrato declare extensibilidad.
- Campos futuros en JSON se rechazan en inputs estrictos y se preservan solo en operación de inspección.
- La API usa `unknown` en fronteras de parseo y nunca `any`.

## Prohibiciones

La API pública no expone:

- hashes de Node directamente;
- buffers internos;
- serializadores no versionados;
- singletons mutables;
- logging global;
- métodos que acepten nombres arbitrarios de algoritmo;
- defaults dependientes del entorno.
