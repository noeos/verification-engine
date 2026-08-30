# Bloque 4 · matriz de amenazas y controles

Estado: registro de verificación del commit que cierre las fases 10 y 11.

Este registro aplica STRIDE, abuso de recursos y supply chain al engine, CLI,
workflows, paquetes y evidencias de release. Todos los ejemplos son sintéticos.

| Amenaza                    | Frontera                | Control preventivo                            | Verificación exigida           | Evidencia       |
| -------------------------- | ----------------------- | --------------------------------------------- | ------------------------------ | --------------- |
| JSON ambiguo               | parser → valores        | claves únicas, plain objects y UTF-8 estricto | fuzz, property y negativos     | CI/fuzz         |
| Frames ambiguos            | valores → bytes         | TLV ordenado, tipos y dominio                 | vectors, mutation y round-trip | vectors         |
| Algoritmo débil            | selección → hashing     | allowlist y lifecycle versionado              | negativos y advisory drill     | contracts       |
| Recursos no acotados       | input → proceso         | límites antes de allocation/hash              | abuso, 1 GiB y 10M             | benchmark       |
| Diagnósticos amplificados  | proceso → output        | collector acotado y orden estable             | cardinalidad máxima y fuzz     | tests           |
| Regla hostil               | host → engine           | copia, captura y contrato explícito           | throws, mutación y red         | security tests  |
| CLI ejecutable             | argumentos → proceso    | configuración JSON, sin eval/plugins          | SAST e2e negativo              | CodeQL          |
| Output inseguro            | proceso → filesystem    | no-follow, force explícito y atomicidad       | symlink, EPIPE y permisos      | e2e             |
| Fuga de payload            | proceso → evidencia/log | minimización y eventos redactados             | revisión de campos y logs      | privacy tests   |
| Dependencia comprometida   | registry → build        | lock, zero-runtime, signatures y scans        | audit, OSV, inventory          | security CI     |
| Action mutable             | source → CI             | SHA completo y permisos mínimos               | policy/workflow scan           | policy          |
| Artefacto sustituido       | build → consumidor      | doble build, hashes y provenance              | tamper test y consumer install | attestation     |
| Cuenta comprometida        | identidad → Git/npm     | mínimo privilegio, MFA y OIDC                 | recovery drill                 | private record  |
| Vulnerabilidad desconocida | producto → consumidor   | fuzz, mutation, SAST y disclosure             | incident drill                 | advisory record |
| Resultado engañoso         | fragmento → afirmación  | `indeterminate` y fronteras explícitas        | boundary matrix                | contracts       |

## Condiciones de cierre

- Ningún caso puede producir crash, OOM, hang, resultado `valid` engañoso ni
  diagnóstico que revele payload.
- Los resultados deben ser reproducibles con commit, runtime, seed y fixture.
- Todo hallazgo Critical/High bloquea el cierre.
- Todo control automatizable debe tener un gate; el resto debe tener registro
  fechado, responsable y hash de evidencia.
- La matriz no convierte provenance, hashes o Scorecard en prueba de ausencia
  de código malicioso.
