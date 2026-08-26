# Requisitos no funcionales

Estado: **normativo**

## Prioridades

Ante conflicto se aplica este orden:

1. corrección y seguridad;
2. determinismo y compatibilidad;
3. integridad de evidencias;
4. disponibilidad controlada y resistencia a abuso;
5. rendimiento;
6. ergonomía.

No se acepta una optimización que cambie bytes o debilite validaciones.

## Determinismo

- Mismos bytes de entrada, configuración y versión DEBEN producir salida byte a byte idéntica.
- Locale, zona horaria, reloj, orden de concurrencia, plataforma y variables de entorno no pueden afectar resultados.
- Los diagnósticos se ordenan por posición, fase, código y ubicación.
- Los objetos de salida no incluyen timestamps generados por el motor. Un timestamp del consumidor se trata como dato explícito y no confiable.

## Fiabilidad

- Ningún error de entrada debe terminar el proceso salvo que el consumidor elija modo fail-fast.
- Toda operación incremental tiene estado válido o error terminal; no existe estado parcialmente comprometido reutilizable.
- La cancelación no produce una evidencia final aparente.
- El proceso no muta entradas ni buffers propiedad del consumidor.
- Un digest solo se expone cuando la operación completa correspondiente ha terminado.

## Portabilidad

- Linux x64/arm64, macOS x64/arm64 y Windows x64 dentro de versiones soportadas.
- Node LTS soportado según política de release.
- Endianness y codificación están fijados por protocolo, nunca por plataforma.
- ESM y CommonJS devuelven resultados idénticos.

## Mantenibilidad

- Complejidad ciclomática máxima recomendada 10 y bloqueante 15, salvo justificación revisada.
- Archivos de producción objetivo ≤400 líneas; excepciones generadas o tablas con revisión.
- Funciones críticas de protocolo pequeñas, puras y con vectores directos.
- Cobertura de ramas del núcleo ≥95%; líneas y funciones ≥98%; 100% para framing, selección de algoritmo, validación de digest y transiciones de cadena.
- Cero dependencias runtime en el núcleo y presupuesto explícito para cualquier dependencia futura.

## Usabilidad

- Tipos públicos documentados y sin `any`.
- Mensajes accionables sin revelar payloads.
- Códigos estables y referencia enlazable.
- Defaults seguros; toda relajación explícita.
- CLI automatizable, sin prompts fuera de operaciones humanas de publicación.

## Accesibilidad e internacionalización

La CLI usa texto claro, no depende solo de color y respeta `NO_COLOR`. Los códigos y campos son ingleses estables; mensajes humanos pueden localizarse fuera del contrato. Las salidas máquina no cambian con locale.

## Sostenibilidad operativa

- Builds y tests reproducibles.
- Soporte de seguridad mínimo de cinco años por major.
- Riesgos y deuda no pueden ocultarse en comentarios; se registran con responsable y plazo.
- Toda funcionalidad pública incluye documentación, pruebas y runbook de soporte aplicable.
