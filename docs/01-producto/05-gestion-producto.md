# Gestión del producto y medida de éxito

Estado: **normativo**

## Propuesta de valor

Una implementación pequeña, auditable y reutilizable que separa integridad genérica de regulación. El activo comercial no es encerrar al consumidor: es reducir riesgo, acelerar integraciones y demostrar ingeniería verificable.

## Posicionamiento

- Público y open source para facilitar evaluación/adopción.
- Genérico y neutral respecto del dominio.
- npm-first para equipos TypeScript/Node.
- API y CLI con evidencias interoperables.
- Seguridad, rendimiento y lifecycle demostrados por artifacts, no claims.

## Experiencia de adopción

Un evaluador debe poder en menos de 15 minutos:

1. verificar provenance del paquete;
2. instalar versión soportada;
3. ejecutar un vector mediante CLI;
4. producir/verificar una cadena con API;
5. entender límites de integridad frente a autenticidad.

Un integrador debe encontrar tipo, schema, error, límite y ejemplo desde una única referencia versionada.

## Indicadores de calidad

| Dimensión | Indicador de aceptación |
|---|---|
| Correctitud | 100% vectors y compatibilidad soportada |
| Seguridad | cero Critical/High abiertos; auditoría y SLAs |
| Rendimiento | 100% gates absolutos y de regresión |
| Fiabilidad | cero flaky conocido; soak/restore pasan |
| Integración | ESM/CJS/CLI y consumer fixtures pasan |
| Documentación | snippets/links/schemas 100% CI |
| Legal/supply | expediente, SBOM, provenance y revisión completos |
| Soporte | cumplimiento de objetivos por severidad |

Descargas npm, stars e integraciones públicas se observan como señales de alcance, nunca como sustituto de calidad. El paquete no añade telemetría para medir adopción.

## Feedback

Issues públicos, discusiones y soporte comercial se clasifican sin incorporar datos privados al repo. Una solicitud entra en roadmap solo si respeta alcance, aporta caso, evalúa seguridad/compatibilidad y obtiene decisión. VERI*FACTU es consumidor prioritario para validar contratos, no cliente privilegiado dentro del código.

## Decisiones de cartera

- El motor no se convierte en servicio alojado dentro de este repo.
- Bindings de otros lenguajes son productos/paquetes separados y solo se prometen tras vectors conformes.
- Browser/WASM/nativo requieren producto y threat model propios; no se anuncian como “próximos” sin decisión financiada.
- Función sectorial se implementa en repositorio sectorial.

## Costo total

Cada feature estima mantenimiento durante cinco años, superficie de API, vectors, docs, soporte, security/legal y migración. Si no puede sostenerse con calidad completa, no entra en alcance; esto no es recorte MVP, sino control permanente del producto definido.
