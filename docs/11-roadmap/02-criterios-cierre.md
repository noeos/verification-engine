# Criterios de cierre y autorización de implementación

Estado: **normativo**

## Cierre de planificación

Antes de escribir código de producto:

- [x] propósito, alcance y exclusiones definidos;
- [x] lenguaje, runtime, paquetes, formatos y licencia decididos;
- [x] modelo de dominio e invariantes definidos;
- [x] bytes exactos del protocolo y algoritmos definidos;
- [x] API, CLI, schemas, errores y compatibilidad especificados;
- [x] amenazas, controles, privacidad y supply chain especificados;
- [x] rendimiento medible y metodología definida;
- [x] estructura de repo/dependencias definida;
- [x] pruebas, auditorías y CI definidas;
- [x] marco legal y gate profesional definidos;
- [x] publicación, soporte, recuperación y docs definidos;
- [x] roadmap y riesgos definidos;
- [x] validación automática de coherencia documental ejecutada;
- [x] revisión y aprobación final del propietario de Noeos, registrada el 2026-08-26.

La planificación está cerrada y autorizada para implementación. La aprobación queda vinculada al corpus documental identificado en `00-gobierno/06-aprobacion-plan.md`.

## Cierre de una capacidad

Para cada requisito:

1. código según arquitectura;
2. unit/property/negative tests;
3. contract/vector si afecta bytes/API;
4. threat model y abuso actualizados;
5. benchmark si afecta hot path;
6. docs pública/interna actualizada;
7. API/schema/compatibilidad revisada;
8. trazabilidad requisito-test-evidencia;
9. review de owner;
10. cero deuda/decisión oculta.

## Cierre de release estable

### Producto

- Todas las capacidades del alcance operativas.
- Sin stubs, flags incompletos ni caminos “experimental” necesarios.
- API/CLI paritarias y todos los formatos soportados.

### Correctitud

- Vectores oficiales/propios pasan en implementación independiente.
- Cobertura y mutation superan umbrales.
- ESM/CJS/CLI/OS/Node matrix pasa.
- Compatibilidad histórica y consumer fixtures pasan.

### Seguridad

- Threat model actual, controles evidenciados.
- Fuzz, soak, SAST, supply scans y auditoría pasan.
- Cero Critical/High y cero Medium material abierto.
- Canal de seguridad, owners, MFA, OIDC y simulacros operativos.

### Rendimiento

- Gates absolutos y regresión pasan.
- Memoria/handles estables.
- Informe reproducible conservado.

### Legal

- Dictamen de aplicabilidad y acciones cerradas.
- LICENSE/NOTICE/DCO/SBOM/license report completos.
- CRA/conformidad/reporting listos si aplica.
- Privacidad y términos revisados.

### Operación

- Artifacts reproducibles, provenance verificable y package allowlist.
- Backup/restore y release recovery ensayados.
- Soporte 5 años financiable y responsables designados.
- Docs bilingües ejecutables/versionadas.
- Expediente completo y retenido.

## Reglas de aprobación

- No se acepta “se hará después” para un gate.
- Una excepción normativa bloquea 1.0.0.
- El propietario de Noeos aprueba producto; owners técnicos aprueban sus áreas; asesoría aprueba conclusiones jurídicas; auditor independiente valida seguridad/protocolo.
- La aprobación identifica commit exacto y fecha.

## Resultado

Solo después de cumplir el cierre de planificación se inicia implementación. Solo después de cumplir cierre de release se publica `1.0.0` en `latest`.
