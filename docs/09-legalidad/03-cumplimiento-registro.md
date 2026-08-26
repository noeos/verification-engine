# Registro y evidencias de cumplimiento

Estado: **normativo**

## Expediente por release

Cada release estable conserva:

- commit/tag, identidad y aprobaciones;
- requisitos y decisiones vigentes;
- evaluación de riesgos y threat model versionados;
- resultados CI, tests, coverage, mutation, fuzz y benchmarks;
- auditorías, hallazgos y cierres;
- SBOM CycloneDX/SPDX, license report y NOTICE;
- tarball, file manifest, hashes y reproducibility report;
- provenance y publish attestation;
- API report, schemas y vector digest;
- changelog, instrucciones, soporte y EOL;
- legal applicability review y declaración/conformidad cuando aplique;
- security impact statement y vulnerabilidades conocidas/evaluadas.

Retención conservadora: al menos 10 años desde puesta en mercado o durante soporte + 5 años, lo que sea mayor, sujeta a ajuste jurídico. Evidencias con datos personales se minimizan y separan.

## Registro de obligaciones

| ID | Obligación | Estado de diseño | Evidencia | Revisión |
|---|---|---|---|---|
| L-CRA-01 | Clasificar rol/ámbito CRA | escenario fabricante asumido | dictamen antes de 1.0 | trimestral |
| L-CRA-02 | Riesgo y secure lifecycle | cubierto | threat model, SSDF, tests | release |
| L-CRA-03 | Vulnerability handling/reporting | cubierto técnicamente | policy, logs, simulacro | semestral |
| L-CRA-04 | Soporte/updates | 5 años por major | support matrix, advisories | release |
| L-CRA-05 | Conformidad/CE/docs si aplica | gate legal | expediente y declaración | antes de mercado |
| L-CRA-06 | Vectores, esquemas y referencia independientes | implementado como control preventivo | manifest SHA-256, CI Node/Python, fixtures | cada cambio de protocolo |
| L-PLD-01 | Responsabilidad software/updates | cubierto en ciclo | QA, support, warnings | anual |
| L-DP-01 | Privacy by design | cubierto | data flow y controles | release |
| L-DP-02 | Soporte/reportes con datos | organizativo | registro tratamiento/procedimiento | anual |
| L-IP-01 | Derechos sobre código | DCO/licencia | Git, DCO, LICENSE | PR/release |
| L-IP-02 | Licencias de terceros | inventario/SBOM | report y NOTICE | PR/release |
| L-IP-03 | Procedencia de vectores externos | implementado | manifest con fuente, revisión y licencia | cada cambio de vector |
| L-NIS2-01 | Aplicabilidad entidad | monitor | análisis jurídico | trimestral |
| L-ENS-01 | Uso sector público | condicionado | perfil contractual si activa | por contrato |
| L-EXP-01 | Exportación/sanciones | monitor | análisis de distribución | anual/cambio |

## Vigilancia normativa

Fuentes oficiales revisadas:

- EUR-Lex y Comisión Europea para CRA, GDPR, NIS2 y responsabilidad de producto;
- BOE para transposición y legislación española;
- AEPD para protección de datos;
- autoridades CRA/CSIRT designadas cuando estén operativas;
- npm/GitHub para condiciones de distribución.

La revisión registra fecha, persona, fuente, cambio y acción. Una alerta no se cierra con “sin impacto” sin explicación.

## Cambios regulatorios

1. abrir issue confidencial/público según riesgo;
2. identificar fecha de aplicación y versiones afectadas;
3. consultar asesoría cuando la interpretación sea material;
4. actualizar requisitos, diseño, contratos y comunicación;
5. implementar/probar antes del plazo;
6. conservar evidencia de decisión.

## Afirmaciones de conformidad

Solo se publica conformidad si existe criterio objetivo, alcance, versión, evidencia y autorización. “Alineado con” se usa para marcos voluntarios; “conforme” requiere evaluación completa. El expediente debe poder demostrar qué estaba vigente al publicar cada versión.
