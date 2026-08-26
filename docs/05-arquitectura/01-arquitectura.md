# Arquitectura lógica

Estado: **normativo**

## Estilo

Arquitectura de núcleo funcional con puertos explícitos. El dominio no depende de Node, CLI, JSON Schema ni tooling; las primitivas criptográficas se acceden por un puerto cerrado implementado con `node:crypto`.

```text
API pública ──────────────────────────────────────────────┐
  │                                                       │
  ├── validación → normalización → framing → hash         │
  │                                   │                   │
  ├── reglas ─────────────────────────┤                   │
  │                                   ▼                   │
  └── cadenas → verificación → evidencias → resultados ──┘

CLI → API pública (nunca módulos internos)
```

## Capas

### `domain`

Tipos opacos, invariantes y estados. No importa adaptadores ni realiza E/S.

### `validation`

Convierte `unknown` en tipos válidos, aplica presupuestos baratos primero y produce diagnósticos.

### `normalization`

Perfiles y sinks de bytes. No conoce cadenas.

### `framing`

Única implementación de protocolo binario. No conoce JSON empresarial ni CLI.

### `hashing`

Registro cerrado de algoritmos y adaptador Node. No selecciona defaults de producto fuera de config.

### `records`

Orquesta validación, normalización y frames para `contentDigest` y `recordDigest`.

### `chains`

Estado incremental, enlaces, fronteras y duplicados. Consume records, no normalizadores internos.

### `rules`

Registro, orden y ejecución de reglas deterministas.

### `evidence`

Construcción, parsing, schema versions y canonicalización de artefactos.

### `api`

Fachada, mapeo de errores y exports. Ninguna lógica criptográfica duplicada.

### `cli`

Paquete separado: parseo de argumentos, archivos/streams y presentación. Solo importa API pública.

## Dirección de dependencias

```text
domain
  ↑
validation  normalization  hashing  framing
  ↑             ↑             ↑       ↑
records ───────────────────────────────┘
  ↑
chains ← rules
  ↑
evidence
  ↑
api
  ↑
cli
```

No hay ciclos. Una regla automatizada valida imports por capa. `domain` solo puede importar biblioteca estándar sin E/S y tipos internos de dominio.

## Fronteras de confianza

1. `unknown -> validated`: todo dato externo.
2. `profile -> normalized bytes`: código confiable registrado, datos hostiles.
3. `bytes -> hash primitive`: límites validados.
4. `library -> CLI I/O`: rutas, streams y errores del sistema.
5. `source -> release`: CI, identidad y registry.

Cada frontera tiene validación, tests negativos y redacción de errores.

## Gestión de estado

No existe estado global mutable. Engines y builders son instancias. Caches permitidas:

- tablas constantes congeladas;
- cache local de UTF-8/frames dentro de una operación y con límite;
- ninguna cache entre tenants o procesos;
- ningún weak global cache que afecte resultados o memoria impredecible.

## Invariantes arquitectónicos

- Cero acceso de red en paquetes publicados.
- Cero acceso a filesystem en el paquete engine.
- CLI no importa `src` ni subpaths internos.
- Esquemas y vectores se generan/validan desde fuentes únicas.
- No existe carpeta genérica `utils`; cada función pertenece a una responsabilidad nombrada.
- Los adapters no pueden cambiar semántica del dominio.
