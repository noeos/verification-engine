# Glosario normativo

Estado: **normativo**

| Término | Definición |
|---|---|
| Registro | Unidad de contenido proporcionada por un consumidor, acompañada por identidad y metadatos genéricos. |
| Payload | Contenido del registro; puede ser JSON admisible por el perfil o bytes. |
| Perfil de normalización | Contrato versionado que transforma una entrada admitida en una secuencia exacta de bytes. |
| Normalización | Transformación determinista y explícita; no significa limpiar, corregir ni inferir datos. |
| Canonicalización | Obtención de una representación única dentro de las restricciones de un formato. |
| Framing | Codificación binaria inequívoca de campos mediante etiqueta, tipo y longitud. |
| Digest | Salida binaria de una función hash. En JSON se codifica como hexadecimal minúsculo. |
| `contentDigest` | Hash del contenido normalizado y del perfil que lo interpreta; no depende de identidad ni posición. |
| `recordDigest` | Hash que compromete contexto, identidad de registro, perfil, longitud y `contentDigest`; no depende de posición. |
| `linkDigest` | Hash que enlaza `recordDigest`, secuencia, posición y enlace anterior. |
| Cadena | Secuencia ordenada de enlaces bajo un protocolo y contexto comunes. |
| Génesis | Primer enlace, que utiliza el valor anterior explícito `none`, no una cadena vacía implícita. |
| Evidencia | Documento versionado que permite reproducir o comprobar una operación y sus decisiones sin incluir necesariamente el payload. |
| Diagnóstico | Hallazgo estructurado con código, severidad, ubicación y contexto seguro. |
| Regla | Predicado determinista que analiza un valor o contexto y produce cero o más diagnósticos. |
| Perfil de cadena | Selección versionada de normalización, hash, framing, límites y reglas obligatorias. |
| Secuencia completa | Entrada cuyo inicio, final y cantidad esperada están declarados. |
| Secuencia parcial | Fragmento cuyos límites externos no pueden inferirse; sus conclusiones se restringen al fragmento. |
| Ancla | Evidencia externa que fija un digest, identidad o momento. Está fuera del núcleo. |
| Verificación | Reejecución determinista y comparación de contratos, enlaces y reglas. |
| Integridad | Capacidad de detectar diferencias respecto de una representación o cadena esperada; no equivale a autenticidad, autorización ni verdad. |
| Idempotencia | Repetir una operación con la misma entrada y configuración produce exactamente el mismo resultado observable. |
| Entrada hostil | Dato que puede estar malformado o diseñado para consumir recursos, confundir parsers o explotar errores. |
| Presupuesto | Límite cuantitativo de tamaño, tiempo, memoria o cantidad aplicado antes y durante el procesamiento. |
| Consumidor | Aplicación o persona que usa la biblioteca o CLI. |
| Mantenedor | Persona autorizada a cambiar fuente, configuración o releases. |
| Release | Conjunto inmutable de artefactos, fuentes, hashes, SBOM, provenance y notas bajo una versión. |
| Compatibilidad | Capacidad prometida de aceptar contratos anteriores sin modificar su significado. |

## Distinciones obligatorias

- Integridad **no** es autenticidad.
- Digest **no** es firma.
- Cadena **no** demuestra por sí sola fecha, autor ni ausencia de una cola eliminada.
- Normalización **no** valida semántica empresarial.
- Evidencia **no** es prueba jurídica universal; su valor depende del contexto y anclaje.
- Error de entrada **no** es excepción interna.
