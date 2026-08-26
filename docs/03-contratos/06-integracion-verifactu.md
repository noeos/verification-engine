# Contrato de integración con VERI*FACTU

Estado: **normativo de frontera**

## Regla

`verifactu` depende de una versión compatible de `@noeos/verification-engine`. Verification Engine no importa, detecta, menciona en tipos ni adapta comportamiento interno a `verifactu`.

## Responsabilidad de `verifactu`

- Modelos y campos regulatorios.
- Fuentes oficiales y versiones normativas.
- Orden/selección de campos y perfil de normalización.
- Reglas fiscales y catálogos.
- Firma, certificados, QR, XML, comunicaciones, reintentos y estados.
- Persistencia, custodia, anclas y trazabilidad de negocio.
- Interpretación de errores para usuario/AEAT.

## Responsabilidad del motor

- Contrato de perfiles y bytes.
- SHA-256 y algoritmos admitidos.
- content/record/link digests y verificación.
- Reglas genéricas, diagnósticos y evidencias.
- Streaming, límites y compatibilidad.

## Integración técnica

`verifactu` define un perfil namespaced, por ejemplo `es.noeos.verifactu.record@X.Y.Z`, compilado dentro de su producto. Lo registra al crear `Engine`. El perfil traduce un modelo regulatorio ya validado a bytes exactos; el motor no recibe un objeto “factura” tipado por su API pública.

La cadena usa `contextId` estable de regulación/sistema definido por `verifactu`, `sequenceId` sin datos personales directos y `recordId` opaco. El perfil regulatorio elige SHA-256 cuando lo exija su especificación.

## Tests de contrato cruzados

- `verifactu` consume package tarball, no source interno.
- Ejecuta vectors del motor y sus propios vectors regulatorios.
- Fija matriz de paquete/protocolo/perfil.
- PRs del motor ejecutan consumer test público contra una versión compatible de `verifactu` cuando sea viable, sin crear dependencia runtime inversa.
- Un cambio de motor no se acepta por “hacer pasar verifactu” si rompe contrato genérico.

## Errores

El motor devuelve códigos genéricos. `verifactu` los envuelve con contexto regulatorio sin cambiar su significado ni exponer payload. Errores oficiales de AEAT jamás se añaden al catálogo del motor.

## Evolución

- Upgrade de package sin cambio de perfil: comprobar vectors/compatibilidad.
- Cambio de bytes regulatorios: nueva versión del perfil y estrategia de historia/migración.
- Cambio de framing del motor: nueva versión de protocolo y compatibilidad explícita.
- Evidencias antiguas permanecen verificables durante soporte.

## Criterio de independencia

Debe ser posible sustituir `verifactu` por un consumidor de otro dominio usando únicamente API pública, y probar el motor sin instalar `verifactu`. Debe ser posible probar `verifactu` contra el tarball oficial sin acceso a módulos internos.
