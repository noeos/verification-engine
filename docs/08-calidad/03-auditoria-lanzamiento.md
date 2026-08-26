# Auditoría y preparación de lanzamiento

Estado: **normativo**

## Auditorías obligatorias antes de 1.0.0

### Protocolo/criptografía

Revisión independiente de normalización, framing, separación de dominio, algoritmos, comparaciones, evidencias, vectores y límites de afirmación.

### Seguridad de código

Revisión manual de fronteras hostiles, parsers, recursos, CLI, errores, dependencias, CI y release.

### Supply chain

Evaluación de GitHub/npm, identidades, trusted publisher, actions, permissions, provenance, reproducibilidad, SBOM y recuperación.

### Legal/licencias

Revisión profesional del modelo de distribución comercial/open source, CRA, responsabilidad de producto, privacidad, licencia Apache-2.0, NOTICE y dependencias.

### Rendimiento/fiabilidad

Reproducción independiente de gates, soak, cancelación y comportamiento bajo límites.

## Independencia

El auditor no debe ser autor principal del área. Puede ser externo o un mantenedor distinto con competencia demostrada; protocolo y legal requieren revisión externa antes de 1.0 si el equipo es unipersonal.

## Entregables

- alcance, versión/commit y metodología;
- hallazgos con severidad y evidencia;
- limitaciones del análisis;
- respuesta de mantenedores;
- fix, aceptación de riesgo o rechazo;
- retest y cierre;
- resumen público cuando no aumente riesgo.

## Política de hallazgos

- Critical/High: cero abiertos para release.
- Medium: cero abiertos que afecten corrección, integridad, privacidad o supply chain; otros requieren mitigación y fecha ≤30 días, pero no para 1.0.
- Low/info: registrados con responsable y priorización.
- Riesgo aceptado no puede contradecir requisito normativo o ley.

## Checklist de release readiness

- Todos los requisitos trazados a tests/evidencia.
- Cero decisiones abiertas.
- Vectores reproducidos independientemente.
- API report estable y consumer tests.
- Threat model y legal register revisados en últimos 30 días.
- Dependencias/licencias sin incógnitas.
- Soak y benchmarks pasan.
- Simulacros de incidente/release/recovery completados.
- Documentación pública completa y honesta.
- Canal de seguridad operativo.
- Soporte y ownership cubiertos durante periodo declarado.

## Reauditoría

Obligatoria ante nueva versión de protocolo, algoritmo, normalizador incorporado, parser nuevo, runtime nativo/WASM, cambio de publicación o incidente material. Major sin esos cambios requiere al menos revisión delta independiente.
