# Privacidad y manejo de datos

Estado: **normativo**

## Diseño de minimización

La biblioteca y CLI funcionan offline, no crean cuentas, no envían telemetría y no persisten payloads. El consumidor decide qué datos procesa y es responsable de base jurídica, finalidad, retención y derechos cuando haya datos personales.

## Flujo

```text
input del consumidor → memoria del proceso → bytes/digests/evidencia → output del consumidor
```

No existe flujo hacia Noeos durante ejecución. Instalar desde npm y consultar GitHub sí involucra a esos proveedores bajo sus propias condiciones, fuera del tratamiento del motor.

## Datos en resultados

- Evidencia: IDs, versiones, tamaños y digests; payload excluido.
- Diagnósticos: códigos, fases y ubicaciones; valores redactados.
- Estadísticas: conteos; sin timestamps, hostname, username o ruta absoluta.
- CLI human: basename/redacción por defecto.

Los IDs pueden ser datos personales si el consumidor introduce nombres, correos u otros identificadores. La documentación exige IDs opacos/pseudónimos y prohíbe ejemplos con datos reales.

## Memoria

- Procesar por streaming y liberar referencias pronto.
- No copiar payload salvo necesidad de validación/canonicalización.
- No prometer secure erase en JavaScript/V8.
- Consumidores con datos altamente sensibles deben aislar proceso, limitar core dumps/swap y controlar memoria a nivel operativo.

## Logs y soporte

No hay logs globales. El callback de eventos está redactado y desactivado por default. El soporte pide reproducciones sintéticas y hashes; transferencia de datos reales requiere proceso separado, autorización, minimización, cifrado y retención definida.

## Derechos y retención

El motor no conserva datos, por lo que no puede ejecutar acceso, rectificación o borrado. La evidencia puede seguir siendo dato personal pseudonimizado y su retención pertenece al consumidor. Hashing no anonimiza automáticamente si el espacio de entrada puede adivinarse.

## Evaluación de impacto

No se requiere una EIPD por la biblioteca en abstracto. El consumidor debe evaluar su tratamiento, especialmente si procesa datos sensibles, gran escala, vigilancia o decisiones con efectos. Noeos evaluará sus propios canales de seguridad/soporte y mantendrá registro de tratamiento cuando aplique.

## Incidentes de datos

Si un reporte o soporte expone datos personales: limitar acceso, preservar hechos, evaluar riesgo, seguir el procedimiento organizativo RGPD/LOPDGDD y cumplir plazos aplicables. El paquete nunca realiza notificaciones automáticamente.
