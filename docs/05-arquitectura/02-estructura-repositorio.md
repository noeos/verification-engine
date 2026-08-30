# Organización de carpetas y archivos

Estado: **normativo**

## Árbol objetivo

```text
verification-engine/
├── .github/
│   ├── CODEOWNERS
│   ├── dependabot.yml
│   ├── ISSUE_TEMPLATE/
│   ├── pull_request_template.md
│   └── workflows/
├── packages/
│   ├── engine/
│   │   ├── src/
│   │   │   ├── contracts/
│   │   │   ├── api/
│   │   │   ├── domain/
│   │   │   ├── validation/
│   │   │   ├── normalization/
│   │   │   ├── framing/
│   │   │   ├── hashing/
│   │   │   ├── records/
│   │   │   ├── chains/
│   │   │   ├── rules/
│   │   │   ├── evidence/
│   │   │   ├── errors/
│   │   │   └── index.ts
│   │   ├── schemas/
│   │   ├── package.json
│   │   └── tsconfig.json
│   └── cli/
│       ├── src/
│       │   ├── commands/
│       │   ├── io/
│       │   ├── presentation/
│       │   └── main.ts
│       ├── package.json
│       └── tsconfig.json
├── contracts/
│   ├── diagnostic-codes.v1.json
│   └── schemas/
├── vectors/
│   └── manifest.json
├── reference/
│   └── noeos_ve_reference.py
├── tests/
│   ├── unit/
│   ├── property/
│   ├── contract/
│   ├── integration/
│   ├── e2e/
│   ├── compatibility/
│   ├── security/
│   ├── fuzz/
│   └── fixtures/
├── benchmarks/
│   ├── scenarios/
│   ├── baselines/
│   └── reports/
├── scripts/
├── docs/
├── security/
│   ├── threat-model/
│   ├── advisories/
│   └── audits/
├── LICENSE
├── NOTICE
├── SECURITY.md
├── CONTRIBUTING.md
├── CODE_OF_CONDUCT.md
├── CHANGELOG.md
├── README.md
├── package.json
├── package-lock.json
├── tsconfig.base.json
└── eslint.config.js
```

## Reglas de archivos

- Un archivo tiene una responsabilidad describible en una frase.
- `index.ts` solo reexporta; no contiene lógica.
- Tipos públicos viven junto a su dominio y se reexportan desde API.
- Tipos exclusivamente internos no se exportan por accidente.
- Código generado lleva encabezado, fuente y comando de regeneración; se verifica que no tenga diff tras generar.
- Fixtures de terceros conservan licencia y origen.
- Baselines de benchmark incluyen entorno; no se reemplazan sin revisión.
- Auditorías públicas se conservan con hallazgos y estado; detalles explotables pueden embargarse hasta parche.

## Nombres

- Archivos TypeScript: `kebab-case.ts`.
- Tipos/clases: `PascalCase`; funciones/valores: `camelCase`; constantes de protocolo: `SCREAMING_SNAKE_CASE` solo cuando son verdaderas constantes.
- Tests: `<subject>.<kind>.test.ts`.
- Vectores: IDs y nombres ASCII estables.
- Documentos: prefijo numérico y `kebab-case.md`.

## Ownership

`CODEOWNERS` exige revisión específica para:

- `/packages/engine/src/framing`, `/hashing`, `/normalization`: protocolo/seguridad;
- `/contracts`, `/packages/engine/schemas`, `/vectors`, `/reference`: contratos;
- `/.github/workflows`, manifests y lockfile: supply chain;
- `/docs/09-legalidad`, `LICENSE`, `NOTICE`: legal/licencias;
- `/security`: seguridad.

Si solo existe una persona mantenedora, la revisión independiente se sustituye temporalmente por branch protection, firmas verificadas, CI bloqueante, custodia de recuperación y auditoría externa antes de release estable; nunca por autopublicación inmediata.

## Prohibiciones organizativas

- No archivos “misc”, “common”, “helpers” o “utils” sin ámbito.
- No tests desactivados sin issue y fecha de expiración.
- No snapshots opacos para protocolo; se usan expectativas legibles y vectores.
- No binarios grandes en Git salvo fixtures indispensables con origen.
- No secretos, datos reales, rutas de usuarios ni payloads de clientes.
