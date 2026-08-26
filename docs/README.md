# Noeos Verification Engine · especificación maestra

Estado: **normativo, aprobado para implementación**
Edición documental: **1.0.0-plan**
Fecha de referencia: **2026-08-26**

Este directorio es la fuente de verdad para construir y operar Noeos Verification Engine. No se autoriza implementar una capacidad cuyo comportamiento, riesgo, contrato y criterio de prueba no estén definidos aquí. Una fase ordena trabajo; nunca reduce el producto a un MVP.

## Resultado exigido

El producto terminado será una biblioteca pública TypeScript para Node.js y una CLI independiente, publicadas en npm, capaces de normalizar, encadenar y verificar registros genéricos, detectar anomalías, producir evidencias reproducibles y procesar secuencias extensas sin almacenamiento propio. Será seguro por defecto, determinista, observable por el consumidor, compatible mediante contratos versionados y operable durante todo su periodo de soporte.

El motor no conocerá facturas, impuestos, clientes, usuarios, organismos, certificados ni regulación. VERI*FACTU será un consumidor externo y conservará toda la semántica regulatoria.

## Mapa documental

| Área | Fuente normativa |
|---|---|
| Gobierno y precedencia | [`00-gobierno/01-autoridad-documental.md`](00-gobierno/01-autoridad-documental.md) |
| Índice completo | [`00-gobierno/00-indice.md`](00-gobierno/00-indice.md) |
| Decisiones cerradas | [`00-gobierno/02-decisiones.md`](00-gobierno/02-decisiones.md) |
| Vocabulario | [`00-gobierno/03-glosario.md`](00-gobierno/03-glosario.md) |
| Trazabilidad de requisitos | [`00-gobierno/04-trazabilidad-requisitos.md`](00-gobierno/04-trazabilidad-requisitos.md) |
| Producto, alcance y casos de uso | [`01-producto/`](01-producto/) |
| Modelo de dominio | [`02-dominio/`](02-dominio/) |
| API, formatos, CLI y errores | [`03-contratos/`](03-contratos/) |
| Normalización, framing y hash | [`04-normalizacion-criptografia/`](04-normalizacion-criptografia/) |
| Arquitectura y estructura física | [`05-arquitectura/`](05-arquitectura/) |
| Seguridad y privacidad | [`06-seguridad/`](06-seguridad/) |
| Rendimiento | [`07-rendimiento/`](07-rendimiento/) |
| Pruebas y calidad | [`08-calidad/`](08-calidad/) |
| Legalidad, licencias y cumplimiento | [`09-legalidad/`](09-legalidad/) |
| Publicación, operación y soporte | [`10-entrega-operacion/`](10-entrega-operacion/) |
| Secuencia de construcción y cierre | [`11-roadmap/`](11-roadmap/) |
| Fuentes y matrices | [`anexos/`](anexos/) |

## Reglas de lectura

- **DEBE**, **NO DEBE**, **DEBERÍA**, **NO DEBERÍA** y **PUEDE** tienen el sentido normativo de RFC 2119/RFC 8174.
- Un requisito lleva un identificador estable. El código, las pruebas, los esquemas y las incidencias deberán referenciarlo.
- Los ejemplos de contratos se convertirán en vectores o pruebas antes de implementar el comportamiento.
- Una contradicción documental bloquea la implementación y se resuelve mediante una decisión registrada; no se interpreta silenciosamente.
- Las leyes, runtimes y estándares con ciclo externo se revisan en cada release y en las fechas del registro legal.

## Estado de aprobación

La planificación fue aprobada formalmente por el propietario de Noeos el 2026-08-26. El registro vinculante está en [`00-gobierno/06-aprobacion-plan.md`](00-gobierno/06-aprobacion-plan.md). Cualquier cambio posterior seguirá el gobierno documental y podrá exigir una nueva aprobación proporcionada a su impacto.
