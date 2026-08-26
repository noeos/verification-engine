# Plantilla de decisión arquitectónica

Estado: **informativo; formato obligatorio para nuevas decisiones**

```markdown
# ADR-NNN · Título

Estado: proposed | accepted | superseded | rejected
Fecha: YYYY-MM-DD
Responsables:
Requisitos: IDs
Sustituye / sustituida por:

## Contexto

Hechos, restricciones y por qué debe decidirse.

## Opciones evaluadas

Para cada opción: comportamiento, seguridad, rendimiento, compatibilidad,
operación, legalidad, coste y reversibilidad.

## Decisión

Una elección inequívoca, defaults, límites y alcance.

## Consecuencias

Positivas, negativas, riesgos residuales y migración.

## Verificación

Tests, benchmarks, revisión, evidencia y fecha de reevaluación.
```

## Criterios

- No se crea ADR para repetir una decisión existente.
- No se aceptan opciones abiertas en `accepted`.
- Una decisión crítica incluye threat/legal/performance impact.
- Sustituir conserva la anterior y enlaza ambas.
- El registro compacto `00-gobierno/02-decisiones.md` se actualiza en el mismo cambio.
