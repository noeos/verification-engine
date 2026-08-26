# Gobierno y autoridad documental

Estado: **normativo**
Responsable: **mantenedores de Noeos Verification Engine**

## Jerarquía de fuentes

Cuando dos textos parezcan incompatibles, se aplica esta precedencia:

1. Legislación obligatoria vigente y condiciones vinculantes de los servicios utilizados.
2. Registro de decisiones de este repositorio.
3. Contratos públicos, esquemas y vectores de conformidad aprobados.
4. Especificaciones de seguridad, legalidad, rendimiento y calidad.
5. Arquitectura interna y roadmap.
6. Guías, tutoriales y ejemplos.

Una fuente inferior no puede ampliar, reinterpretar ni debilitar una superior. Si una obligación externa cambia, se abre una revisión de impacto, se actualizan en la misma entrega todos los documentos afectados y se registra la decisión.

## Tipos de documento

- **Normativo:** define comportamiento o control obligatorio.
- **Registro:** conserva decisiones, riesgos, evidencias o resultados sin reescribir la norma.
- **Informativo:** explica una norma; no la sustituye.
- **Generado:** deriva de código o esquemas y nunca se edita manualmente.

Todos los documentos de este directorio son normativos salvo que indiquen expresamente otra cosa. Los informes de pruebas, benchmarks, auditorías, SBOM y releases serán registros.

## Gestión de cambios

Todo cambio normativo DEBE:

1. indicar motivo y requisito afectado;
2. identificar impacto en API, formatos, seguridad, rendimiento, legalidad, pruebas y documentación;
3. añadir o modificar una decisión cuando cambie una elección cerrada;
4. conservar compatibilidad o activar el proceso SemVer correspondiente;
5. actualizar enlaces, matrices y ejemplos en el mismo pull request;
6. obtener revisión de dos personas para criptografía, publicación, seguridad o contratos cuando exista más de un mantenedor habilitado;
7. no dejar marcadores de trabajo o decisión pendiente ni alternativas sin resolución en la rama protegida.

## Identificadores

| Prefijo | Área |
|---|---|
| `PROD` | producto y alcance |
| `DOM` | dominio y semántica |
| `API` | contratos públicos |
| `FMT` | formatos y esquemas |
| `CRY` | normalización, framing y hash |
| `ARC` | arquitectura |
| `SEC` | seguridad |
| `PRV` | privacidad |
| `PERF` | rendimiento |
| `TST` | pruebas |
| `LEG` | legalidad y licencias |
| `REL` | publicación y operación |
| `DOC` | documentación |

Los identificadores no se reutilizan. Si un requisito desaparece, queda marcado como retirado con su motivo y versión.

## Control de contradicciones

La CI documental DEBE comprobar enlaces, encabezados, IDs duplicados, marcadores pendientes, esquemas y fragmentos ejecutables. La revisión humana DEBE comprobar semántica y precedencia. Una contradicción conocida tiene severidad bloqueante.

## Revisión periódica

- Antes de cada release: runtimes, dependencias, npm, vulnerabilidades, licencias y contratos.
- Trimestralmente: amenazas, fuentes legales, soporte y riesgos.
- Anualmente: arquitectura, objetivos de rendimiento, periodo de soporte y continuidad.
- Inmediatamente: incidente, vulnerabilidad crítica, cambio normativo o ruptura de un estándar externo.
