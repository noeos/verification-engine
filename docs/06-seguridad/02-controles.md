# Controles de seguridad del producto y desarrollo

Estado: **normativo**

## Gobernanza

- Política `SECURITY.md` pública y canal privado de reporte.
- Propietario y suplente para seguridad; si no hay suplente interno, proveedor externo documentado antes de 1.0.
- Inventario de activos, accesos, paquetes, dominios y cuentas revisado trimestralmente.
- Acceso mínimo; cuentas individuales; prohibidas cuentas compartidas.
- MFA resistente a phishing mediante passkey o llave FIDO2 para GitHub, npm, correo y gestor de secretos; TOTP solo recuperación temporal.
- Códigos de recuperación offline, cifrados y probados; nunca en repositorio.
- Revisión trimestral y revocación inmediata al perder necesidad.

## Fuente

- Rama `main` protegida, sin push directo ni force-push.
- Pull request obligatorio, CI bloqueante y conversaciones resueltas.
- Historial lineal o merges auditables según política común; tags de release firmados/verificables.
- CODEOWNERS para contratos, criptografía, workflows y legal.
- Commits con identidad verificada; firma obligatoria para mantenedores cuando la plataforma la soporte de forma fiable.
- Secret scanning y push protection habilitados.
- PRs de forks sin acceso a secretos ni permisos de escritura.

## Diseño e implementación

- Threat model actualizado antes de implementar una frontera.
- Validación positiva por tipo/allowlist, no listas negras.
- Presupuestos aplicados antes de allocations y hash costoso.
- TypeScript: `strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `useUnknownInCatchVariables`, `noImplicitOverride`, `noFallthroughCasesInSwitch`.
- `any`, non-null assertions, type casts de input y `@ts-ignore` prohibidos salvo excepción documentada y revisada.
- Exhaustividad de uniones comprobada.
- Objetos de input inspeccionados sin ejecutar getters; se copian desde estructuras plain validadas.
- Errores no incluyen payload, stack ni entorno en outputs de producción.
- Sin comandos shell, eval, VM, deserialización ejecutable, red o plugins.

## Criptografía

- Solo `node:crypto` en runtimes soportados.
- Vectores NIST y RFC; revisión independiente.
- Separación de dominios y framing exacto.
- Comparación constante tras longitud exacta.
- No claves, firmas, RNG ni cifrado dentro del scope.
- Registro y proceso de retirada de algoritmos.

## Pruebas de seguridad

- SAST/lint y análisis de imports en cada PR.
- Dependency, license, secret y workflow scanning.
- Property tests para invariantes.
- Fuzzing incremental en PR y prolongado programado.
- Mutation testing en framing, validación y cadenas.
- Casos de abuso de memoria/CPU/diagnósticos.
- E2E de paquete instalado desde tarball, no workspace.
- Auditoría externa antes de 1.0 y después de cambio de protocolo/criptografía.

## Build y release

- Entorno efímero y permisos mínimos.
- Instalación desde lockfile; scripts deshabilitados salvo allowlist.
- Release solo desde commit protegido y tag esperado.
- Artefacto inspeccionado (`npm pack --dry-run` equivalente), sin secretos, tests, configs locales o sourcemaps con rutas.
- OIDC, staged publish, aprobación 2FA y provenance.
- SBOM, checksums, notas, API report y vector digest.
- Verificación post-publicación desde registry limpio.
- Prohibido modificar/reutilizar una versión publicada.

## Correspondencia NIST SSDF

| SSDF | Aplicación |
|---|---|
| PO · Prepare Organization | roles, políticas, tooling, acceso y criterios |
| PS · Protect Software | rama, identidad, secrets, artifacts y provenance |
| PW · Produce Well-Secured Software | threat model, coding, reviews, pruebas, dependencias |
| RV · Respond to Vulnerabilities | intake, triage, advisories, remediación y aprendizaje |

La matriz detallada de controles conserva evidencia por release; “seguimos SSDF” nunca sustituye demostrar cada práctica aplicable.

## Excepciones

Una excepción de seguridad necesita alcance, amenaza, compensación, responsable, aprobación y fecha máxima de 30 días. Expirada bloquea CI/release. No hay excepción para secretos en Git, publicación no autenticada o vulnerabilidad crítica explotable conocida.
