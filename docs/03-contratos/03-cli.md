# Especificación de la CLI

Estado: **normativo**

Binario: `noeos-ve`
Paquete: `@noeos/verification-engine-cli`

## Comandos

```text
noeos-ve record hash
noeos-ve record verify
noeos-ve chain build
noeos-ve chain verify
noeos-ve evidence inspect
noeos-ve evidence digest
noeos-ve vectors verify
noeos-ve schema print
noeos-ve version
```

Cada comando tiene `--help` y `--output json|ndjson|human`. El default es `human` solo cuando stdout es TTY; en pipe debe exigirse formato o elegir `ndjson` documentadamente. Para evitar sorpresas, automatizaciones DEBEN pasar `--output`.

## Entradas

- `--input <path>` o `-` para stdin; no ambos.
- `--evidence <path>` cuando la operación lo requiera.
- `--profile <id@version>` obligatorio salvo que el envelope lo declare.
- `--algorithm` obligatorio para creación si no está en configuración; no se infiere por longitud.
- `--context`, `--sequence` y límites explícitos según operación.
- `--config` acepta JSON local estricto; nunca JS, YAML, URL o directorio.

Las rutas se resuelven desde cwd, se abren sin seguir una segunda resolución generada por contenido y nunca se escriben salvo `--output-file`. Un output existente requiere `--force`; la escritura usa archivo temporal en el mismo directorio, `fsync` y rename atómico cuando la plataforma lo permite.

## Streams

stdin/stdout soportan NDJSON. stderr contiene progreso o texto humano. `--quiet` elimina progreso, no errores. No se imprime payload en errores. `SIGINT` inicia cancelación limpia; una segunda señal puede terminar inmediatamente con código 130.

## Códigos de salida

| Código | Significado |
|---:|---|
| 0 | operación completada y válida |
| 1 | verificación inválida |
| 2 | uso/argumentos inválidos |
| 3 | input o formato inválido |
| 4 | resultado indeterminado |
| 5 | presupuesto de recursos excedido |
| 6 | error de E/S |
| 7 | perfil/algoritmo/versión no soportado |
| 70 | fallo interno del software |
| 130 | cancelación por SIGINT |

El código más grave observado gobierna un stream, con prioridad 70, 6, 5, 7, 3, 2, 1, 4, 0.

## Configuración y precedencia

1. flags de CLI;
2. archivo JSON pasado explícitamente;
3. defaults seguros compilados.

No se leen dotfiles de usuario, variables de entorno ni configuración global para semántica criptográfica. `NO_COLOR` solo afecta presentación humana.

## Seguridad

- No shell-out.
- No eval, imports dinámicos de usuario ni scripts de hooks.
- No red.
- Permisos de archivos de salida restrictivos cuando la plataforma los soporte.
- Symlinks de input se permiten como elección del usuario; outputs sensibles pueden usar `--no-follow-output-symlink`, activado por defecto.
- Los mensajes de error redactan rutas a basename salvo `--verbose` local.

## Paridad

Cada comando llama a exports públicos de la biblioteca. Fixtures E2E comparan CLI, ESM y CommonJS. Una diferencia de digest, código o esquema bloquea release.
