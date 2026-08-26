# Mantenimiento y contribuciones

Estado: **normativo**

## Roles

- **Product owner:** alcance, prioridades, afirmaciones y aceptación de release.
- **Protocol owner:** normalización, framing, digests, vectors y compatibilidad.
- **Security owner:** amenazas, controles, vulnerabilidades e incidentes.
- **Release owner:** CI, npm, provenance, SBOM y recuperación.
- **Legal/privacy owner:** registro, licencias, privacidad y asesoría.
- **Documentation owner:** coherencia, versiones e internacionalización.

Una persona puede cubrir varios roles, pero cada responsabilidad y suplencia queda registrada antes de GA. Ningún rol elimina los reviews obligatorios.

## Tipos de cambio

| Tipo | Requisitos adicionales |
|---|---|
| Protocolo/bytes | ADR, vectores, compatibilidad, protocol+security review |
| API/schema/error | API report, consumer tests, SemVer review |
| Seguridad/CI/release | threat model, CODEOWNER, dry-run y recovery impact |
| Dependencia | admission review, licencia, SBOM diff |
| Rendimiento | perfil, benchmark y correctness equivalence |
| Legal/docs públicas | owner y fuente oficial/profesional aplicable |

## Flujo de contribución

1. issue/discusión para cambio no trivial;
2. ADR si altera decisión;
3. rama desde `main`;
4. cambio pequeño y trazado a requisito;
5. tests/docs/evidencia en mismo PR;
6. DCO sign-off;
7. CI y CODEOWNERS;
8. squash/merge según política, conservando atribución;
9. changelog cuando afecta usuario.

Contribuciones de seguridad siguen canal privado. No se pide PoC destructiva ni datos reales.

## Backlog

No se almacenan decisiones en conversaciones. Issues llevan tipo, impacto, requisitos, aceptación, owner y estado. “Future idea” no forma parte del compromiso 1.x hasta ADR aceptada. Deuda técnica tiene coste/riesgo y fecha; no se oculta en TODOs.

## Cadencia

No hay releases por calendario si faltan gates. Security patches se priorizan por SLA. Dependencias/leyes se revisan según frecuencia aunque no haya features. Reunión/revisión trimestral registra riesgos, soporte, vulnerabilidades, roadmap y capacidad.

## Conducta y comunidad

Código de conducta y proceso de moderación públicos. Decisiones se basan en requisitos y evidencia. No se aceptan cambios que creen privilegios para productos internos de Noeos.

## Bus factor

Antes de 1.0 se documentan y ensayan onboarding, build, release, incident, npm/GitHub recovery y legal contacts. Al menos una segunda persona o proveedor custodiado debe poder recuperar el proyecto sin workstation ni memoria informal del autor principal.
