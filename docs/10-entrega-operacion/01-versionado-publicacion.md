# Versionado, publicación y ciclo de vida

Estado: **normativo**

## Versionado

SemVer estricto:

- major: ruptura de API, significado, protocolo/schema incompatible o garantías;
- minor: capacidad compatible y opt-in, nuevos diagnósticos compatibles, perfiles nuevos;
- patch: corrección compatible, seguridad, documentación y rendimiento sin cambio de bytes contratados.

Una corrección que necesariamente cambia bytes erróneos de un perfil publicado crea nueva versión del perfil y puede requerir major del paquete. Nunca se “corrige” evidencia histórica silenciosamente.

## Canales

- `next`: prereleases para validar release completo; sin garantía de API estable.
- `latest`: releases estables que pasan todos los gates.
- No hay canal “beta” usado en producción por recomendación oficial.

`1.0.0` marca contrato completo, no primera demo.

## Soporte

- Cada major estable: mínimo cinco años de actualizaciones de seguridad desde GA.
- Major actual: correcciones funcionales y seguridad.
- Major anterior dentro de soporte: seguridad Critical/High y correcciones necesarias para seguridad/compatibilidad prometida.
- Majors más antiguas dentro de compromiso: seguridad según política publicada.
- EOL se anuncia al menos 12 meses antes, salvo algoritmo/riesgo que obligue retirada rápida.

La matriz pública indica paquete, protocolo, perfiles, Node, inicio y fin. No se soportan Node EOL. Al 2026-08-26: Node 24 primario, Node 22 secundario y Node 26 Current informativo; se revisa en cada release contra calendario oficial.

## Flujo de release

1. congelar scope y generar changelog desde cambios revisados;
2. actualizar versiones/matriz y security impact;
3. ejecutar release candidate completo;
4. verificar auditorías y legal register;
5. crear tag firmado sobre commit protegido;
6. build limpio doble;
7. generar artifacts/evidencias;
8. stage npm por OIDC;
9. revisar package diff, provenance y consumer tests;
10. aprobar/promover con 2FA;
11. verificar registry y attestations;
12. publicar GitHub release y expediente;
13. monitorizar advisories/instalación inicial.

## Contenido del paquete

Exports explícitos, engines Node, type declarations, dual ESM/CJS, schemas y metadatos. No se publica source sensible, tests, benchmarks, config local, `.env`, coverage, keys, caches ni documentos internos no destinados.

## Releases de seguridad

Pueden abreviar comunicación previa, pero no tests críticos, provenance, SBOM, aprobación ni verificación post-publicación. Si el fix completo tarda, se publica mitigación/advisory y, cuando sea seguro, patch. Versiones vulnerables se marcan deprecated con mensaje accionable; no se eliminan salvo política/daño excepcional.

## Rollback

npm es inmutable: rollback significa publicar versión nueva que revierte, actualizar dist-tag y comunicar. Nunca reutilizar versión/tag. Un dist-tag puede moverse tras verificación y registro. Consumers deben fijar versiones/lockfiles.

## Compatibilidad de `verifactu`

Cada release publica matriz `verification-engine package ↔ protocol ↔ profiles`. `verifactu` fija versión exacta/rango conservador probado, ejecuta vectors y contrato en su CI. El motor no introduce código especial para ese consumidor.
