# Modelo de amenazas

Estado: **normativo**
Método: STRIDE + abuso de recursos + cadena de suministro
Revisión: trimestral, antes de cada major y tras incidentes.

## Objetivos de seguridad

1. Correctitud e integridad de bytes, digests y evidencias.
2. Imposibilidad práctica de confundir contextos o campos.
3. Resistencia a entradas malformadas y consumo no acotado.
4. Autenticidad verificable de releases respecto del repositorio.
5. Mínima exposición de payloads y metadata.
6. Fallo cerrado y diagnósticos no engañosos.
7. Recuperación rápida ante compromiso o vulnerabilidad.

## Activos

- especificación de protocolo y vectores;
- código fuente e historial Git;
- ramas protegidas, tags y workflows;
- cuentas GitHub/npm y factores de autenticación;
- artefactos npm, provenance, SBOM y checksums;
- exactitud de evidencias generadas;
- disponibilidad del proceso consumidor;
- payloads procesados en memoria;
- reputación y afirmaciones públicas de Noeos.

## Adversarios y fallos

- usuario que aporta JSON/bytes hostiles;
- integrador equivocado que usa perfil o fronteras incorrectos;
- contribuidor malicioso;
- cuenta de mantenedor comprometida;
- dependencia o GitHub Action comprometida;
- registry o canal de distribución comprometido;
- atacante que sustituye una evidencia o cadena completa;
- bug accidental de normalización, framing o compatibilidad;
- operador que publica desde árbol sucio o artefactos no revisados;
- denegación de servicio por tamaño, profundidad, cardinalidad o diagnósticos.

## Límites de confianza

```text
datos hostiles ──[parser/limits]──> valores validados
perfil host ─────[registro]───────> código confiable del proceso
valores ─────────[framing]────────> bytes comprometidos
fuente Git ──────[CI aislada]─────> artefacto
artefacto ───────[OIDC/provenance]> npm/consumidor
```

## Amenazas y controles primarios

| ID | Amenaza | Impacto | Control |
|---|---|---|---|
| TH-01 | Claves JSON duplicadas con interpretación divergente | digest ambiguo | parser que rechaza duplicados |
| TH-02 | Unicode equivalente/engañoso | identidad o bytes inesperados | IDs ASCII; perfiles Unicode explícitos |
| TH-03 | Concatenación ambigua | mismos bytes estructurales | framing tag/tipo/longitud y dominios |
| TH-04 | Algoritmo débil o desconocido | integridad insuficiente | allowlist cerrada y lifecycle |
| TH-05 | Digest de longitud/timing manipulable | bypass/oracle | longitud previa y comparación constante |
| TH-06 | Reordenación/omisión/fork | historia falsa | posición, anterior, secuencia, fronteras |
| TH-07 | Regenerar toda cadena | historia alternativa | límite documentado; ancla externa consumidor |
| TH-08 | JSON profundo/grande | CPU/memoria | límites antes de normalizar y streaming |
| TH-09 | Explosión de diagnósticos/duplicados | memoria | presupuestos separados y modos acotados |
| TH-10 | Regla externa lanza o muta | proceso/resultado | inputs inmutables, captura y código confiable explícito |
| TH-11 | CLI carga configuración ejecutable | RCE | solo JSON local, sin plugins/eval |
| TH-12 | Path/symlink en output | sobrescritura | flags explícitos, temporal/rename, no-follow default |
| TH-13 | Payload en logs | fuga | no logging, redacción y evidencia mínima |
| TH-14 | Dependencia maliciosa | compromiso build | cero runtime, lock, revisión, ignore-scripts |
| TH-15 | Action mutable | compromiso CI | SHA exacto, permisos mínimos, sin secretos en PR |
| TH-16 | Token npm robado | paquete malicioso | trusted publishing OIDC, disallow tokens, stage+2FA |
| TH-17 | Maintainer comprometido | fuente/release maliciosa | phishing-resistant MFA, branch protection, reviews |
| TH-18 | Artefacto diferente al revisado | sustitución | build CI, provenance, reproducibilidad, package diff |
| TH-19 | Vulnerabilidad desconocida | daño consumidor | fuzzing, auditoría, disclosure, soporte |
| TH-20 | Resultado `valid` con datos insuficientes | falsa confianza | estado `indeterminate` y modos explícitos |

## Riesgo residual aceptado

- Un hash seguro no autentica autor ni tiempo.
- Código de regla del host comparte proceso y puede comprometerlo.
- V8 puede conservar copias de memoria; el motor no promete borrado seguro.
- Disponibilidad depende de límites elegidos y recursos del host.
- Provenance prueba origen/build, no ausencia de código malicioso.
- Un único mantenedor reduce separación humana; se compensa, no elimina.

Cada riesgo residual debe aparecer en documentación pública relevante.

## Casos de abuso obligatorios

Fuzzing y tests deben cubrir archivos truncados, longitudes máximas, claves duplicadas, getters/proxies, objetos con prototipo malicioso, arrays sparse, Unicode inválido, chunks de un byte, abort en cada fase, forks masivos, diagnósticos repetidos, EPIPE, disco lleno, permisos, señales y artifacts manipulados.
