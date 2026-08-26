# Marco legal y regulatorio

Estado: **normativo de planificación; requiere validación jurídica antes de comercialización**
Jurisdicción base: España y Unión Europea
Fecha de corte: 2026-08-26

## Regla

Este documento identifica obligaciones y controles; no sustituye asesoramiento jurídico. La clasificación final del modelo de distribución, rol de Noeos y aplicabilidad se registra antes de `1.0.0` y se revisa cuando cambien producto, ingresos, soporte o ley.

## Modelo jurídico de referencia

- Código público y paquete npm Apache-2.0.
- Noeos mantiene marca, roadmap, publicación y soporte.
- El motor es componente técnico que puede integrarse en productos comerciales propios o de terceros.
- No presta SaaS, no recibe payloads y no ejecuta tratamiento remoto.
- Puede existir actividad comercial directa o indirecta alrededor del software.

Por prudencia, no se presume la exclusión de software libre desarrollado fuera de actividad comercial. Se diseña el expediente para el escenario de fabricante bajo CRA hasta que asesoría documente otra clasificación.

## Normas principales

### Cyber Resilience Act — Reglamento (UE) 2024/2847

Fuente oficial: [EUR-Lex](https://eur-lex.europa.eu/eli/reg/2024/2847/oj/eng). Entró en vigor el 10-12-2024; reporting del artículo 14 aplica desde 11-09-2026 y disposiciones principales desde 11-12-2027 según la [Comisión Europea](https://digital-strategy.ec.europa.eu/en/policies/cra-summary).

Si el producto queda dentro del ámbito y Noeos es fabricante, el plan DEBE cubrir:

- evaluación de riesgos de ciberseguridad durante ciclo de vida;
- requisitos esenciales y secure-by-design/default;
- ausencia de vulnerabilidades explotables conocidas al mercado;
- gestión coordinada de vulnerabilidades, actualizaciones y advisory;
- periodo de soporte declarado de al menos cinco años, salvo vida útil menor jurídicamente defendible; Noeos fija cinco años por major;
- documentación técnica, información/instrucciones y contacto;
- SBOM, aunque formato/entrega exactos se validarán con actos/guías aplicables;
- evaluación de conformidad, declaración UE y marcado CE si corresponde;
- reporting de vulnerabilidades activamente explotadas e incidentes severos en plazos legales;
- conservación de expediente y cooperación con autoridades.

Open source: la Comisión distingue software FOSS puesto en mercado por fabricante y “open-source software stewards”; [orientación oficial](https://digital-strategy.ec.europa.eu/en/policies/cra-open-source). Noeos documentará ingresos, soporte y finalidad comercial para clasificar el rol; no usará la licencia gratuita como prueba suficiente de exclusión.

### Responsabilidad por productos defectuosos — Directiva (UE) 2024/2853

Fuente: [EUR-Lex](https://eur-lex.europa.eu/eli/dir/2024/2853/oj/eng). Incluye software como producto y aplica a productos puestos en mercado o servicio después del 09-12-2026; excluye FOSS desarrollado/suministrado fuera de actividad comercial. Debe transponerse y revisarse la norma española resultante.

Controles: calidad demostrable, updates de seguridad, instrucciones y límites honestos, trazabilidad de releases, conservación de tests/riesgos, soporte y seguros/contratos evaluados. Apache-2.0 no elimina obligaciones imperativas ni responsabilidad frente a terceros.

### Protección de datos

- [RGPD, Reglamento (UE) 2016/679](https://eur-lex.europa.eu/eli/reg/2016/679/oj).
- [LOPDGDD, Ley Orgánica 3/2018 consolidada](https://www.boe.es/buscar/act.php?id=BOE-A-2018-16673).
- [Privacidad desde el diseño, AEPD](https://www.aepd.es/derechos-y-deberes/cumple-tus-deberes/medidas-de-cumplimiento/proteccion-de-datos-desde-el-diseno).

El paquete local no determina por sí mismo rol de responsable/encargado. Controles: no telemetría/red/persistencia, minimización de evidencias, documentación de IDs/digests, soporte con datos sintéticos y evaluación organizativa de reportes de seguridad. Hash no equivale automáticamente a anonimización.

### Propiedad intelectual

- [Texto refundido de la Ley de Propiedad Intelectual](https://www.boe.es/buscar/act.php?id=BOE-A-1996-8930).
- Apache License 2.0 y obligaciones de copyright/NOTICE.

Se conservan autoría, licencias, provenance y contribuciones. Marcas y logos no quedan licenciados por Apache-2.0 salvo declaración separada.

## Normas de aplicabilidad condicionada

| Marco | Evaluación actual | Activador |
|---|---|---|
| NIS2, Directiva (UE) 2022/2555 | no aplica automáticamente a una biblioteca; evaluar a Noeos/clientes | entidad/servicio y transposición española |
| ENS, RD 311/2022 | no base del paquete | contrato o sistema del sector público |
| eIDAS y Ley 6/2020 | fuera del motor | firmas, sellos o servicios de confianza en `verifactu` |
| RRSIF/VERI*FACTU | fuera del motor | responsabilidad exclusiva de `verifactu` |
| DORA | no base | prestación ICT contractual a entidad financiera |
| AI Act | no aplica al motor determinista sin IA | incorporar sistema de IA |
| Data Act | no base | producto conectado/servicio de datos aplicable |
| Accesibilidad | CLI/docs aplican buenas prácticas; ley según canal/servicio | servicio al público o requisito contractual |
| Dual-use/sanciones/exportación | evaluar distribución global; motor usa hash sin cifrado | jurisdicciones, usuarios o capacidades nuevas |
| Consumo/LSSI | paquete orientado a integradores; evaluar si hay venta online/consumidores | canal comercial directo |

“No base” significa que no configura el diseño actual, no que sea imposible su aplicación futura.

## Contratos y comunicación

- README y términos describen alcance, versiones, soporte y límites.
- No se promete cumplimiento sectorial por instalar el motor.
- Integradores conservan responsabilidad de perfil, datos, anclas y operación.
- Contratos comerciales definen SLA, mantenimiento, indemnidades, límites permitidos, DPA si aplica y ley/foro con asesoría.
- Security advisories y end-of-support se comunican por canales duraderos.

## Gate jurídico

Antes de `1.0.0`, profesional competente debe emitir registro sobre CRA (rol/clase/conformidad/reporting), Directiva 2024/2853 y transposición, licencia/contribuciones, privacidad de soporte y términos comerciales. Cualquier control obligatorio se incorpora antes de release; no se difiere a una etapa posterior.
