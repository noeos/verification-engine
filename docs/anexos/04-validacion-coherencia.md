# Registro de validación de coherencia

Estado: **registro**
Fecha: **2026-08-26**
Alcance: corpus completo previo a implementación.

## Comprobaciones ejecutadas

- todos los Markdown son no vacíos, UTF-8, tienen H1 y estado;
- enlaces Markdown locales resuelven;
- no existen marcadores explícitos de trabajo pendiente;
- no existen IDs de requisito duplicados;
- catálogo de códigos no contiene duplicados;
- registro contiene 30 decisiones numeradas;
- digest domains y frame kinds están alineados;
- lenguaje/runtime/paquetes/licencia/soporte coinciden entre decisiones, arquitectura, legalidad y release;
- límites de payload/NDJSON/diagnósticos coinciden entre contratos y seguridad;
- statuses y códigos CLI coinciden con resultados y catálogo;
- fuentes externas principales son oficiales y se consultaron en la fecha de corte.

Resultado automático final: **correcto, código de salida 0**.

## Revisión semántica

Durante la revisión se sustituyó el diseño de dos capas por:

1. `contentDigest`: perfil + contenido normalizado;
2. `recordDigest`: contexto + identidad + perfil + longitud + contenido;
3. `linkDigest`: secuencia + posición + anterior + registro.

La separación evita traslado de evidencia entre identidades/contextos y conserva detección de contenido duplicado. Glosario, dominio, schemas, framing, vectors, rendimiento y decisiones fueron actualizados en conjunto.

## Puertas posteriores que no son decisiones abiertas

- Dictamen jurídico profesional antes de comercializar/`1.0.0`.
- Auditorías independientes y evidencias de gates antes de `1.0.0`.

La aprobación del propietario de Noeos para comenzar implementación fue recibida y registrada el 2026-08-26. Las puertas restantes validan hechos externos y ejecución futura; no dejan alternativas de diseño sin resolver.

## Repetición

La misma validación se ejecutará en CI. Cualquier cambio documental invalida este registro hasta nueva corrida y revisión semántica proporcionada al riesgo.
