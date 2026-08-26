# Visión, alcance y definición del producto

Estado: **normativo**

## Misión

Noeos Verification Engine convierte contenido genérico y reglas explícitas en evidencias de integridad reproducibles. Su valor es que dos implementaciones conformes, en máquinas distintas, obtengan los mismos bytes, digests, enlaces, resultados y códigos de diagnóstico ante la misma entrada y configuración.

## Usuarios

- Equipos que integran integridad encadenada en sus productos.
- Auditores y operadores que verifican secuencias fuera de la aplicación originaria.
- Autores de perfiles regulatorios, incluido `verifactu`.
- Pipelines que validan lotes, migraciones y archivos históricos.
- Mantenedores que investigan alteraciones con evidencias reproducibles.

## Capacidades completas

El producto DEBE:

1. aceptar registros JSON o bytes bajo perfiles explícitos;
2. normalizar de forma determinista;
3. calcular digests con algoritmos admitidos;
4. construir cadenas incrementales y por lotes;
5. verificar registros, enlaces, cadenas completas y fragmentos;
6. detectar contenido alterado, referencias inválidas, posiciones inconsistentes, duplicados y reordenaciones observables;
7. distinguir fallos, avisos, información y verificaciones inconclusas;
8. aplicar reglas incorporadas y reglas confiables proporcionadas por el host;
9. generar evidencias mínimas, portables y versionadas;
10. operar mediante API y CLI con paridad semántica;
11. procesar secuencias extensas con streaming, backpressure y memoria acotada;
12. ofrecer vectores públicos para implementaciones independientes;
13. publicar artefactos reproducibles, SBOM, provenance, documentación y política de soporte;
14. conservar seguridad, compatibilidad y operación durante su ciclo de vida.

## Fuera de alcance

El motor NO DEBE implementar:

- facturas, impuestos, numeración fiscal o modelos regulatorios;
- usuarios, organizaciones, permisos o autenticación de aplicaciones;
- almacenamiento, bases de datos, colas o cachés persistentes;
- transporte HTTP, servicios web o llamadas externas;
- firmas, certificados, PKI, sellos de tiempo o claves privadas;
- autenticidad, no repudio o atribución de autor;
- interfaz gráfica;
- corrección automática, inferencia o enriquecimiento de payloads;
- plugins descargados o ejecutados dinámicamente;
- telemetría, analytics o envío de errores;
- interpretación jurídica de una evidencia.

## Fronteras

```text
aplicación / verifactu
        │ perfiles, registros, reglas, persistencia, anclas
        ▼
@noeos/verification-engine
        │ normalización, framing, hash, cadenas, diagnóstico, evidencia
        ▼
primitivas estándar de Node.js
```

La dependencia solo apunta hacia el motor. El motor no importará, detectará ni nombrará al consumidor.

## Definición de producción completa

El producto está completo cuando todas las capacidades anteriores existen y además:

- contratos y esquemas son estables;
- amenazas y límites han sido probados;
- objetivos de rendimiento pasan en hardware de referencia;
- los dos formatos de módulo npm y la CLI pasan E2E;
- existe auditoría independiente de seguridad y criptografía de protocolo;
- la publicación puede repetirse y verificarse;
- recuperación, revocación y respuesta a vulnerabilidades han sido ensayadas;
- documentación de usuario, integración, operación y seguridad coincide con el comportamiento;
- el registro legal está revisado por profesional cuando se comercialice o distribuya bajo actividad comercial.

No existe una condición de “suficiente para demostrar”. Las prereleases solo sirven para validar el producto completo y no reducen los gates de `1.0.0`.
