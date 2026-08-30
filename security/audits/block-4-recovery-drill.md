# Registro de simulacros del Bloque 4

Este documento define el expediente y su ejecución reproducible. El comando
`npm run security:drill` reconstruye los paquetes en un directorio temporal,
aplica la política de empaquetado, compara hashes, altera un archivo de forma
controlada y exige que el hash cambie. También vuelve a ejecutar vectores y
mutación. Su salida JSON es evidencia efímera: no debe contener secretos,
tokens, payloads ni detalles explotables.

## Escenarios obligatorios

1. Tamper local de un tarball: checksum y attestation deben rechazarlo.
2. Compromiso simulado de workflow: una Action o permiso no permitido debe
   bloquear policy y no recibir secretos.
3. Bug de framing: un mutante debe ser detectado por vectors, tests y mutation.
4. DoS: entradas de tamaño, profundidad, cardinalidad y stream adversos deben
   terminar por límite o abort, sin crecimiento no acotado.
5. Recuperación: reconstruir desde mirror/tag verificado en un entorno limpio,
   regenerar paquetes y comparar hashes.
6. Staging OIDC: generar provenance y consumir el paquete desde un proyecto
   limpio sin promoverlo al canal estable.

## Registro de ejecución

| Campo                 | Valor                                                      |
| --------------------- | ---------------------------------------------------------- |
| Campo                 | Fuente de evidencia                                        |
| ---                   | ---                                                        |
| Commit y runtime      | JSON de `security:drill` y run de CI                       |
| Escenario y resultado | entrada `scenarios` del JSON                               |
| Artefactos y hashes   | entrada `archives` del JSON; solo hashes, nunca contenido  |
| RPO/RTO               | expediente de recuperación del entorno autorizado          |
| Fallos y acciones     | issue/advisory enlazado, con acceso restringido si procede |

Un escenario fallido no se marca como mitigado por repetición. Se corrige la
causa, se conserva la evidencia del fallo y se repite desde un entorno limpio.
