# Licencias, propiedad intelectual y contribuciones

Estado: **normativo**

## Licencia del repositorio

- Código, schemas, vectores y ejemplos propios: Apache License 2.0.
- Documentación propia: Apache License 2.0 para evitar ambigüedad de reutilización, salvo archivo con licencia explícita distinta.
- `LICENSE` contiene texto oficial completo.
- `NOTICE` contiene avisos requeridos propios y de terceros.
- `package.json#license` usa `Apache-2.0`.
- Archivos generados declaran origen y licencia.

## Patentes y marca

Apache-2.0 incluye concesión de patentes bajo sus términos. Los mantenedores no harán promesas adicionales. “Noeos”, nombres de producto y logos son marcas/identidad y no se licencian implícitamente; se publicará política de marca antes de uso por terceros si es necesaria.

## Contribuciones

Modelo inicial: Developer Certificate of Origin (`Signed-off-by`) y contribución bajo la licencia del proyecto. `CONTRIBUTING.md` lo explica. No se exige CLA mientras no exista necesidad jurídica concreta; cambiar modelo requiere revisión y no altera derechos ya concedidos.

Contribuidor confirma que:

- tiene derecho a aportar;
- identifica trabajo de terceros;
- no incluye secretos/datos/contratos incompatibles;
- acepta distribución bajo Apache-2.0.

## Terceros

Antes de incorporar código, datos, vectores, textos o assets:

1. identificar fuente, autor y versión;
2. registrar licencia SPDX exacta;
3. comprobar compatibilidad y obligaciones;
4. conservar copyright/NOTICE;
5. evitar copiar si un enlace o generación independiente basta;
6. documentar modificaciones;
7. incluir en SBOM/license report.

No se admiten dependencias o contenido con licencia desconocida. Copyleft fuerte en runtime requiere decisión jurídica y arquitectura explícita; no se mezcla accidentalmente. Herramientas dev se analizan según distribución real de outputs.

## Vectores y estándares

Vectores NIST, RFC y Unicode conservan fuente y condiciones. No se asume que “estándar público” equivale a dominio público. Si una licencia impide redistribución, el test descarga/verifica en job controlado o se crean casos propios sin copiar expresión protegida, según asesoría.

## SBOM y attribution

Cada release genera CycloneDX 1.7 y SPDX 3.0 con componentes directos/transitivos, hashes, licencias y relación. Un license report humano identifica obligaciones. SBOM no sustituye revisión legal.

## Copyright

Encabezados SPDX se aplican según política automatizada, sin ruido innecesario. La atribución inicial será `Copyright 2026 Noeos contributors`; cualquier cambio a una entidad jurídica requiere confirmar titularidad y no elimina atribuciones existentes. Historial Git y DCO conservan autoría.

## Paquete npm

Incluye solo archivos allowlisted: dist, tipos, schemas, licencia, NOTICE, README, changelog relevante y package manifest. Licencias deben estar disponibles offline tras instalar. No se publica material interno, auditorías embargadas ni configuración con datos.

## Revisión

- En cada PR de dependencia/contenido.
- En cada release mediante scans y revisión del diff de SBOM.
- Anual por asesoría o ante cambio de modelo comercial/licencia.
- Un conflicto bloquea distribución, aunque el código funcione.
