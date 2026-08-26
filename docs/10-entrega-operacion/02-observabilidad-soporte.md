# Observabilidad, diagnósticos y soporte

Estado: **normativo**

## Observabilidad embebible

El motor no exporta logs ni métricas. Devuelve:

- diagnósticos estructurados;
- estadísticas deterministas (`recordsSeen`, `bytesNormalized`, `errors`, `warnings`);
- fases y posiciones;
- eventos opcionales mediante callback local.

No incluye duración porque depende del reloj; el host puede medir externamente.

## Eventos

Allowlist inicial:

```text
operation.started
record.validated
record.hashed
link.created
diagnostic.emitted
operation.completed
operation.aborted
```

Payload: operación, contadores, IDs opcionales configurados y códigos; nunca contenido, bytes, digest completo por default, stack, ruta o entorno. El callback es síncrono, no puede alterar resultado y sus excepciones se capturan como `OBSERVER_FAILED` según política configurada. Para no afectar rendimiento, está desactivado por defecto.

## Métricas recomendadas al host

- operaciones/resultados por status;
- bytes y registros;
- códigos de diagnóstico;
- latencia externa por operación;
- budget exceeded/abort;
- versión/perfil/algoritmo sin IDs de negocio;
- colas y recursos del proceso consumidor.

Cardinalidad se controla; record/sequence IDs no son labels.

## Paquete de soporte seguro

Herramienta/guía genera localmente:

- versiones de paquete/Node/OS genérico;
- tipo de módulo y comando saneado;
- configuración sin rutas/IDs sensibles;
- códigos y counts;
- hash de fixture, no fixture;
- manifest de paquete/provenance status.

El usuario revisa antes de compartir. No se envía automáticamente.

## Niveles de soporte

- Seguridad: canal privado y SLA de vulnerabilidades.
- Bugs: issue público con reproducción sintética.
- Integración: documentación/contrato; soporte comercial separado si existe.
- Semántica regulatoria: repositorio `verifactu`, no este motor.

## Triage de bugs

1. validar versión soportada;
2. reproducir desde tarball oficial;
3. clasificar input/contrato/bug/seguridad;
4. minimizar fixture sin datos;
5. añadir vector/test;
6. corregir y documentar compatibilidad;
7. cerrar con versión y evidencia.

Un posible fallo que acepte cadena inválida se trata como seguridad hasta descartarlo.

## SLO del proyecto

- CI de `main` verde ≥99% excluyendo fallos externos confirmados.
- Releases no permanecen con provenance/SBOM faltante.
- Issues Critical/High según SLA de seguridad.
- Documentación de latest coincide con paquete latest; docs versionadas disponibles para soportadas.

No se promete disponibilidad de servicio porque el producto no opera un servicio remoto.
