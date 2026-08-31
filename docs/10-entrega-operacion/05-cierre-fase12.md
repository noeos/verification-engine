# Expediente operativo de cierre de fase 12

Estado: **normativo; readiness para fase 13**

Este documento es el índice operativo de la fase 12. No declara una revisión externa realizada: identifica la evidencia local, los controles que deben ejecutarse con el toolchain aprobado y las aprobaciones que solo pueden emitir sus responsables legítimos.

## Resultado esperado

La fase 12 entrega documentación pública, API generada, registro legal, operación de soporte, continuidad ensayada y un expediente reproducible para la auditoría independiente de la fase 13. La publicación estable no pertenece a este expediente.

## Matriz de cierre

| Área | Evidencia local | Verificación externa | Criterio de salida |
|---|---|---|---|
| API pública | `packages/engine/etc/engine.api.md`, `npm run api:check` | revisión de compatibilidad por auditor | sin `ae-forgotten-export` ni drift no revisado |
| Documentación | `docs/`, README y snippets ejecutables | revisión bilingüe independiente | links, anchors, ejemplos y límites coherentes |
| Seguridad | `security/`, `SECURITY.md`, workflows y scripts | revisión de código/supply chain | hallazgos críticos y altos cerrados |
| Licencias | `LICENSE`, `NOTICE`, SBOM e inventarios | asesoría de PI | procedencia y obligaciones identificadas |
| Legalidad | `docs/09-legalidad/` y registro por release | asesoría España/UE | dictamen CRA, responsabilidad, privacidad y términos |
| Soporte | `SUPPORT.md`, `SECURITY.md`, docs de operación | responsables nominados | canal, SLA y escalado operativos |
| Continuidad | `docs/10-entrega-operacion/03-recuperacion-continuidad.md` y drill | ejercicio con custodios | restore reproducido y evidenciado |
| Rendimiento | `benchmarks/reports/`, presupuestos y perfil | reproducción independiente | baseline del bloque 4 aceptado y transparente |
| CI | `.github/workflows/` y `npm run ci` | configuración live de GitHub | todos los required checks verdes |
| Paquetes | `pack:check`, consumers, checksums y provenance | npm/GitHub owners | tarballs allowlisted, reproducibles y attestados |

## Secuencia de verificación

1. Usar el par de runtime descrito en `security/runtime-toolchain.json`.
2. Instalar desde `package-lock.json` con scripts ignorados y opcionales omitidos.
3. Ejecutar `npm run ci` desde checkout limpio.
4. Ejecutar la matriz de Node y sistemas operativos del workflow de CI.
5. Ejecutar el benchmark oficial en el runner gobernado; conservar perfiles y metadatos.
6. Ejecutar el recovery drill y revisar sus hashes, tarballs y consumidores.
7. Comparar el API report, SBOM, licencias, vectores y contratos con el commit candidato.
8. Registrar cada resultado, fecha, commit, entorno, responsable y hash en el expediente de release.
9. Obtener las revisiones profesional e independiente exigidas antes de fase 13.

## Reglas de evidencia

- Un control automático fallido conserva su salida y no se convierte en verde mediante reintentos opacos.
- Una limitación de WSL o del runner local se identifica como limitación de entorno, nunca como cumplimiento del benchmark oficial.
- Una decisión legal solo se considera cerrada con una revisión profesional identificable.
- La aceptación del baseline de rendimiento del bloque 4 queda documentada como decisión explícita, con sus resultados originales y su alcance.
- Los datos de soporte y auditoría usan fixtures sintéticos y minimizan cualquier dato personal.
- Los artefactos de release se conservan con hashes, provenance y el periodo definido en `docs/09-legalidad/03-cumplimiento-registro.md`.

## Registro de ejecución local

En la ejecución de fase 12 con Node 24.20.0 y npm 11.19.0 se obtuvo:

- CI agregado completo: **pasado**.
- 77 tests: **pasados**.
- Cobertura engine: 98,14% de líneas y 95,17% de ramas.
- Cobertura CLI: 97,65% de líneas y 90,17% de ramas.
- Vectores: 18, verificados con Node y Python.
- Fuzz smoke: cinco objetivos, más de 200.000 iteraciones por objetivo.
- Mutation: 16/16 mutantes y 15/15 mutantes críticos eliminados.
- Recovery drill: reconstrucción, empaquetado, consumidor limpio, tamper y vectores **pasados**.
- Licencias, audit npm, signatures, paquetes, consumidores, reproducibilidad y SBOM: **pasados**.
- Benchmark smoke: **pasado**.
- Benchmark official local: P-07 finalizó con código CLI 3 durante la repetición de 10.000 invocaciones y no generó un informe official completo.

La última línea no se etiqueta como éxito. El rendimiento del bloque 4 permanece cerrado y aceptado según la decisión de alcance de esta fase, con el resultado conservado para revisión independiente. No se modifica el producto para maquillar el resultado ni se autoriza `1.0.0` desde este documento. La auditoría de fase 13 debe reproducir P-07 en el runner gobernado, clasificar la causa y decidir si el baseline es aceptable para el release.

## Handoff a fase 13

La fase 13 recibe este expediente junto con:

- commit/tag candidato y firma verificable;
- API report actualizado;
- resultados completos de CI y compatibilidad;
- SBOM CycloneDX/SPDX y license report;
- tarballs, manifests y checksums;
- threat model y recovery drill;
- benchmarks y baseline aceptado;
- registro legal y dictamen profesional;
- lista de hallazgos, respuestas, retests y aprobaciones;
- notas de release y matriz de soporte.

La auditoría independiente conserva autoridad para rechazar el readiness si encuentra un incumplimiento material, una evidencia no reproducible o una afirmación que exceda el alcance real del engine.
