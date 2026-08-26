# Sistema de documentación

Estado: **normativo**

## Audiencias

- Evaluador: qué resuelve, garantías, límites y seguridad.
- Integrador: instalación, API, perfiles, formatos, errores y migración.
- Operador/auditor: CLI, vectores, provenance, evidencia y troubleshooting.
- Contribuidor: arquitectura, setup, pruebas, decisiones y release.
- Seguridad/legal: threat model, lifecycle, disclosures, SBOM y expediente.

## Capas

| Lugar | Contenido |
|---|---|
| README raíz | propósito, quickstart real, estado, seguridad, links |
| `docs/` | especificación y planificación autoritativa cercana al código |
| API generada | exports y tipos desde source |
| schemas/vectors | contratos ejecutables |
| repo central `docs` | arquitectura global y guías entre productos |
| noeos.dev | presentación navegable/versionada |

No se copian manualmente contratos. Sitio y repo central consumen versiones publicadas o enlaces permanentes.

## Idiomas

- Código, tipos, schemas, códigos y API reference: inglés.
- Planificación interna: español.
- README, guías de integración, seguridad, CLI y límites: inglés y español.
- Contenido bilingüe comparte snippets/schemas generados y marca idioma canónico por sección para evitar divergencia.

## Documentos públicos mínimos para 1.0

1. visión y límites;
2. instalación/verificación de paquete;
3. quickstart API ESM/CommonJS;
4. CLI completa;
5. conceptos de integridad/cadenas;
6. perfiles y creación de perfil confiable;
7. schemas/evidence;
8. streaming y límites;
9. errores/troubleshooting;
10. seguridad y disclosure;
11. privacidad;
12. rendimiento y benchmarks;
13. versionado/migración/support matrix;
14. integración para `verifactu` sin semántica fiscal;
15. licencias/SBOM/provenance.

## Verificación

- Todos los snippets compilan y ejecutan en CI.
- Outputs se comparan con vectores.
- Links y anchors se comprueban.
- API docs se generan y diff se revisa.
- Versiones/deprecaciones se prueban.
- No se usa pseudocódigo presentado como API real.
- Ejemplos solo con datos sintéticos.

## Versionado

Docs de `latest` apuntan a release estable. Cada major soportada conserva docs navegables y banner de versión/EOL. `main` se identifica como desarrollo. Links de advisories usan permalinks.

## Estilo y seguridad

Lenguaje preciso y accesible; no depender de color; comandos copiables sin secretos. Se distinguen “must del protocolo”, recomendación y ejemplo. Las limitaciones criptográficas aparecen junto a las capacidades, no ocultas al final.

## Definition of Done documental

Una función no está terminada hasta que API, ejemplos, errores, seguridad, rendimiento, migración y operación aplicables están actualizados y verificados en el mismo cambio.
