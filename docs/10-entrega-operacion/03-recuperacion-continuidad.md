# Recuperación y continuidad

Estado: **normativo**

## Objetivos

- RPO de fuente y configuración aprobada: 0 commits protegidos perdidos.
- RTO para restaurar capacidad de build/test: 24 h.
- RTO para release de seguridad Critical: dentro del SLA, objetivo 48 h de mitigación.
- Artefactos publicados permanecen verificables durante soporte.

## Copias autoritativas

- GitHub y clon/mirror offline cifrado y actualizado de repositorio completo, refs/tags incluidos.
- Expedientes de release en almacenamiento separado, cifrado e inmutable cuando sea posible.
- npm contiene distribución, no sustituye fuente/expediente.
- Configuración de GitHub/npm documentada sin secretos; recovery codes separados.

Backup se verifica trimestralmente y restauración completa se ensaya semestralmente. “Existe copia” sin restore exitoso no cuenta.

## Escenarios

### Pérdida de workstation

Revocar sesión/keys, recuperar desde Git protegido, verificar firmas/tags, instalar desde lockfile y reconstruir. Ningún estado necesario debe existir solo localmente.

### Pérdida/compromiso GitHub

Congelar release/npm, usar contactos de recuperación, preservar evidencia, restaurar desde mirror verificado, rotar identidades, auditar commits/workflows/tags desde último punto confiable y comunicar.

### Compromiso npm

Revocar owners/sesiones/tokens, bloquear trusted publisher, deprecar versiones afectadas, comparar tarballs con expedientes, coordinar con npm, publicar advisory y recuperar OIDC con workflow nuevo revisado.

### Build no reproducible

No publicar. Comparar entorno, lock, timestamps, orden y generated files. Conservar ambos artifacts. Corregir causa y repetir desde cero.

### Algoritmo/protocolo comprometido

Pasar creación a bloqueada, advisory, modo verify-only cuando sea seguro, diseñar migración versionada y facilitar reanclaje al consumidor. Evidencia histórica no se reescribe.

### Mantenedor indisponible

Al menos dos identidades organizativas o plan de custodia/recuperación externo antes de GA. Documentación de releases, dominios, npm, GitHub y asesoría accesible bajo mínimo privilegio.

## Revocación y comunicación

No existe revocación técnica universal de un paquete ya descargado. Se usan advisory, npm deprecation, dist-tag, GitHub Security Advisory/CVE, web/docs y contacto contractual. El mensaje incluye versiones, hashes, impacto, mitigación y sustitución.

## Ensayos

- Trimestral: verificar mirror y expediente aleatorio.
- Semestral: restaurar repo/build en entorno limpio.
- Anual: recuperar publicación completa sin token persistente.
- Tras cambios de plataforma/owners: ensayo inmediato.

Acciones encontradas se tratan como requisitos con responsable y fecha; un fallo material bloquea release.
