# Gestión de vulnerabilidades e incidentes

Estado: **normativo**

## Recepción

- Canal primario: GitHub private vulnerability reporting.
- Canal alternativo: correo de seguridad publicado con instrucciones y clave cuando exista.
- `SECURITY.md` lista versiones soportadas, alcance, cifrado opcional y expectativas.
- No se exige NDA al investigador para aceptar un reporte de buena fe.

## Triage

1. confirmar recepción;
2. preservar datos con acceso restringido;
3. reproducir en entorno aislado;
4. clasificar CVSS 4.0 y contexto de producto;
5. determinar versiones, vectores y exposición;
6. asignar responsable y deadline;
7. evaluar obligaciones legales/reporting;
8. coordinar fix, advisory y release.

## Objetivos de respuesta

| Severidad | Acuse | Triage inicial | Mitigación objetivo | Fix objetivo |
|---|---:|---:|---:|---:|
| Critical | 4 h | 24 h | 48 h | 7 días |
| High | 1 día hábil | 2 días hábiles | 7 días | 30 días |
| Medium | 2 días hábiles | 5 días hábiles | según riesgo | 90 días |
| Low | 5 días hábiles | 10 días hábiles | backlog priorizado | siguiente minor razonable |

Son objetivos máximos, no espera mínima. Si una obligación legal exige menos, prevalece. Imposibilidad justificada se comunica y registra.

## Severidad contextual

CVSS se acompaña de:

- alcance real del paquete/CLI;
- explotación conocida;
- integridad de evidencias afectada;
- exposición de datos;
- disponibilidad;
- facilidad de actualización;
- uso downstream crítico;
- obligaciones regulatorias.

## Embargo y divulgación

Detalles explotables se limitan hasta disponibilidad del fix. Se acuerda fecha con reporter, normalmente ≤90 días, reducida ante explotación. Advisory contiene CVE cuando corresponda, versiones, impacto, mitigación, fix, créditos y CVSS vector completo.

## Incidente

Se declara incidente si afecta fuente, CI, credenciales, npm, artefactos, confidencialidad de reportes o integridad de resultados. Roles:

- incident commander;
- técnico/investigación;
- comunicación;
- legal/regulatorio;
- continuidad/publicación.

Una persona puede acumular roles, pero las decisiones quedan registradas y las acciones destructivas requieren confirmación cuando no haya urgencia.

## Fases

1. detectar y abrir timeline inmutable;
2. contener sin destruir evidencia;
3. erradicar causa y rotar accesos;
4. recuperar desde fuente/entorno verificado;
5. comprobar paquetes publicados y consumidores;
6. comunicar con precisión;
7. postmortem sin culpa con acciones, responsables y fechas;
8. añadir tests/controles que impidan recurrencia.

## Simulacros

Semestrales: paquete npm malicioso, clave/cuenta comprometida, bug de framing y vulnerabilidad DoS. Anual: ejercicio completo con release de emergencia y restauración de publicación. Los resultados son privados si contienen detalles sensibles, pero se registra cierre de acciones.
