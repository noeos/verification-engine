# Registro de decisiones cerradas

Estado: **normativo**
Regla: una modificación requiere registrar fecha, motivo, alternativas e impacto.

| ID | Decisión | Motivo principal |
|---|---|---|
| D-001 | TypeScript estricto es el lenguaje de producto. | Integración comercial mediante npm, tipado y adopción empresarial. |
| D-002 | Node.js es el runtime soportado; navegador y runtimes alternativos quedan fuera del contrato 1.x. | Evitar dos modelos criptográficos y promesas no verificadas. |
| D-003 | Node 24 LTS es referencia al 2026-08-26; Node 22 LTS es secundario y Node 26 Current se prueba de forma informativa hasta ser LTS. | Solo runtimes mantenidos y transición anticipada. |
| D-004 | Se publican `@noeos/verification-engine` y `@noeos/verification-engine-cli`. | Separar núcleo y superficie CLI. |
| D-005 | El repositorio usa npm workspaces y `package-lock.json`; los consumidores usan cualquier cliente compatible con npm. | Menor cadena de herramientas y builds repetibles. |
| D-006 | El núcleo no usa red, reloj, aleatoriedad, secretos, almacenamiento, variables de entorno ni telemetría. | Determinismo, privacidad y mínima superficie de ataque. |
| D-007 | El núcleo tendrá cero dependencias de runtime; utilizará primitivas estándar de Node. | Reducir riesgo de suministro y tamaño. |
| D-008 | API pública inmutable y funcional; builders con estado encapsulado solo para cadenas incrementales. | Razonamiento local y streaming eficiente. |
| D-009 | JSON tipado es entrada interoperable; NDJSON es formato streaming; bytes se representan como `Uint8Array` en API y hexadecimal minúsculo en JSON. | Interoperabilidad y ausencia de ambigüedad. |
| D-010 | JCS conforme a RFC 8785 es el perfil JSON incorporado. No modifica Unicode. | Canonicalización estándar y reproducible. |
| D-011 | Las normalizaciones semánticas, incluida NFC, pertenecen a perfiles explícitos del consumidor. | Evitar alterar datos sin autorización del dominio. |
| D-012 | SHA-256 es predeterminado; SHA-384 y SHA-512 están soportados; MD5 y SHA-1 se rechazan. | Compatibilidad y algoritmos seguros. |
| D-013 | Se usa framing binario propio, versionado, con longitudes y separación de dominio. | Evitar concatenaciones ambiguas y ataques entre contextos. |
| D-014 | El motor distingue `contentDigest`, `recordDigest` y `linkDigest`. | Separar contenido, identidad/contexto y posición en la cadena. |
| D-015 | Evidencias no contienen payload por defecto. | Minimización de datos y portabilidad. |
| D-016 | Firmas, certificados, sellado de tiempo, anclaje externo y regulación están fuera del motor. | Responsabilidad de VERI*FACTU u otros consumidores. |
| D-017 | La entrada se considera hostil y se aplican límites seguros antes de trabajo costoso. | Resistencia a denegación de servicio y datos malformados. |
| D-018 | La CLI no carga JavaScript, plugins ni configuración remota. | Evitar ejecución de código no confiable. |
| D-019 | ESM y CommonJS se publican mediante exports explícitos; ambos se prueban contra los mismos vectores. | Adopción npm sin bifurcar comportamiento. |
| D-020 | SemVer gobierna API, formatos y errores; los esquemas y perfiles tienen versión propia. | Evolución independiente y verificable. |
| D-021 | Apache-2.0 es la licencia del código y ejemplos; documentación propia bajo Apache-2.0 salvo indicación. | Concesión de patentes y uso comercial claro. |
| D-022 | Publicación npm mediante trusted publishing OIDC, provenance, etapa y aprobación humana 2FA; no tokens persistentes. | Máxima protección práctica del canal de release. |
| D-023 | SBOM CycloneDX 1.7 JSON y SPDX 3.0 se generan por release. | Transparencia técnica y jurídica. |
| D-024 | La seguridad sigue NIST SSDF 1.1, SLSA 1.2 y controles propios trazables. | Marco verificable, no declaración genérica. |
| D-025 | CVSS 4.0 clasifica vulnerabilidades, complementado por impacto contextual. | Priorización reproducible. |
| D-026 | Código y API están en inglés; planificación interna en español; documentación pública esencial será bilingüe desde fuente compartida. | Alcance internacional sin perder operación local. |
| D-027 | No hay logging global: resultados y eventos se devuelven al consumidor. | Evitar efectos laterales y fugas de datos. |
| D-028 | Cada major recibe al menos cinco años de soporte de seguridad desde su disponibilidad general. | Ciclo de vida empresarial y preparación CRA. |
| D-029 | `1.0.0` solo se publica después de cerrar todas las puertas de producción. | No etiquetar como estable un producto incompleto. |
| D-030 | No se afirma seguridad absoluta, inalterabilidad histórica ni cumplimiento legal por usar hashes. | Garantías honestas y límites criptográficos correctos. |
| D-031 | Los formatos de intercambio 1.x usan JSON Schema Draft 2020-12, con esquemas estrictos y URNs inmutables. | Validación interoperable y rechazo explícito de datos ambiguos o desconocidos. |
| D-032 | Los vectores centrales se verifican mediante una referencia Python de biblioteca estándar, separada del producto TypeScript. | Reducir el riesgo de que una implementación comparta el mismo defecto que el motor. |
| D-033 | Cada archivo de vectores tiene hash SHA-256, listado exhaustivo y fuentes/licencias declaradas; CI ejecuta la referencia independiente con Python exacto revisado. | Evitar corpus parcial, manipulación silenciosa y resultados dependientes de runtimes no controlados. |
| D-034 | CI ejecuta npm exclusivamente mediante un runner que valida el par Node/npm exacto y resuelve el CLI incluido en esa distribución; no se permite la resolución implícita por `PATH`. | Fijar de forma comprobable la herramienta que instala, prueba, empaqueta o publica, y prevenir regresiones de cadena de suministro. |

## Alternativas rechazadas

- Rust/WASM como núcleo inicial: coste operativo y de integración superior sin evidencia de necesidad.
- Base de datos propia: viola agnosticismo y propiedad de datos.
- Plugins descubiertos dinámicamente: superficie de ejecución y reproducibilidad inaceptables.
- YAML/CSV como formatos del núcleo: semántica ambigua y alcance impropio.
- Hash de `JSON.stringify`: orden y representación no constituyen un contrato suficiente.
- Soporte de runtimes EOL: riesgo de seguridad no aceptable.
- Publicación manual habitual o tokens npm de larga duración: riesgo evitable.
