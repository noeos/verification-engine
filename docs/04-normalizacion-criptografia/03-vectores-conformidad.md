# Vectores de prueba y conformidad

Estado: **normativo**

## Objetivo

Los vectores son el árbitro ejecutable de normalización, framing, digests y evidencias. Una implementación que no los reproduce no es conforme, aunque sus pruebas internas pasen.

## Distribución

```text
vectors/
  manifest.json
  hashing.json
  framing.json
  evidence.json
  invalid.json
reference/
  noeos_ve_reference.py
```

`manifest.json` declara schema, versión del conjunto, licencia, archivos, SHA-256 de cada archivo y fuentes externas. Se publica en el paquete bajo export `vectors` y como artifact de release. Los archivos actuales cierran hash, framing, evidencia y fallos estructurales; los vectores de registros, cadenas y compatibilidad se añadirán al implementar esas capacidades, sin alterar casos válidos existentes.

## Categorías mínimas

### Normalización

- RFC 8785 oficiales y casos adicionales auditados.
- Objetos con orden de inserción distinto.
- Escaping, controles, Unicode BMP/no BMP.
- Surrogates inválidos y claves duplicadas.
- `-0`, fronteras binaria64, exponentes, números inválidos.
- Arrays/objetos vacíos y profundidad límite.
- Bytes vacíos y todos los valores 0x00–0xff para raw.

### Hash

- Vectores NIST de SHA-256, SHA-384 y SHA-512.
- Mensaje vacío, corto, bloques exactos y multibloque.
- Actualización en todas las particiones de chunks relevantes.

### Framing

- Hex completo de cada frame.
- Longitudes 0, 1, 255, 256 y límites de uint.
- Diferencias de tipo, tag, longitud, orden y dominio.
- Truncamiento en cada byte de cabecera/campo.

### Cadena

- Génesis y cadenas de 1, 2, 100 y gran streaming.
- SHA-256/384/512.
- Cambio de payload, ID, secuencia, contexto, posición, anterior y perfil, verificando las tres capas de digest.
- Omisión, duplicado, reordenación, fork y cola truncada con/sin final esperado.
- Fragmentos con cero, una o dos fronteras.

### Evidencia y compatibilidad

- Round-trip schema/JCS.
- ESM, CommonJS y CLI idénticos.
- Lectura de todas las versiones históricas soportadas.
- Campos/versiones desconocidos y longitudes de digest incorrectas.

## Formato de caso

Cada caso contiene:

- ID permanente;
- propósito;
- requisito cubierto;
- input codificado inequívocamente;
- configuración completa;
- bytes normalizados en hex cuando proceda;
- frame en hex;
- digest/evidencia esperada;
- diagnósticos y estado esperados;
- fuente/licencia si deriva de tercero.

Para no convertir los límites de framing en miles de caracteres opacos, un campo de bytes de un vector puede declarar `repeat`: un entero entre 1 y 1.000.000 que repite su `value` hexadecimal antes de formar el frame. Es una notación del *fixture*, no una extensión del protocolo ni de la API. Los bytes expandidos, el hex completo del frame y su digest se conservan y verifican como resultado esperado.

## Independencia

La referencia `reference/noeos_ve_reference.py` usa únicamente biblioteca estándar de Python y no importa código TypeScript, generadores ni módulos del motor. Reproduce hash, framing y errores estructurales centrales. No comparte serializador ni framing con el producto. Las discrepancias se resuelven contra especificación y fuentes, no por mayoría.

## Cambios

- Un vector válido nunca cambia dentro de su versión.
- Corrección requiere nuevo ID y nota de errata; el archivo anterior se conserva marcado.
- Todo bug de producción añade un vector de regresión antes del fix.
- El digest del vector set se registra en cada release.
