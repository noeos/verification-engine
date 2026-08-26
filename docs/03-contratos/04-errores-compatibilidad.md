# Errores, compatibilidad y evolución

Estado: **normativo**

## Clases de fallo

| Clase | Representación | Reintento |
|---|---|---|
| Entrada inválida | `OperationResult` fallido | solo tras corregir entrada |
| Verificación negativa | `VerificationResult.invalid` | no cambia sin datos distintos |
| Información insuficiente | `VerificationResult.indeterminate` | sí, aportando fronteras/expectativas |
| Presupuesto agotado | diagnóstico y fallo/aborted | sí, con input menor o límite permitido |
| Cancelación | `aborted` | sí |
| Regla externa fallida | error estructurado | tras corregir regla |
| Invariante interno | código interno + ID de incidente local | tras actualizar/corregir producto |

## Estabilidad

- `code`, `severity` por defecto y significado son API pública.
- El texto humano no es estable ni debe parsearse.
- Añadir un nuevo código puede ocurrir en minor si pertenece a un caso antes genérico y no cambia éxito por fallo.
- Cambiar estado, severidad o exit code exige major salvo corrección de vulnerabilidad documentada.
- El orden normativo de diagnósticos es estable.

## SemVer multidimensional

| Elemento | Política |
|---|---|
| Paquete npm | SemVer |
| Protocolo de framing | entero major independiente |
| Perfil | SemVer exacto |
| JSON Schema | entero major en URN |
| Vector set | versión SemVer y digest |
| Regla | SemVer exacto |

Un release declara matriz de compatibilidad. La versión del paquete no se usa como sustituto de ninguna versión de protocolo.

## Lectura de futuro

Los parsers normativos fallan cerrado ante versión major desconocida. La herramienta `evidence inspect` puede mostrar campos básicos sin afirmar validez. Campos desconocidos no se eliminan de archivos originales, pero no se copian a una evidencia nueva sin contrato.

## Deprecación

1. anunciar en minor con diagnóstico opt-in o warning de desarrollo;
2. documentar sustitución y migración;
3. mantener al menos 12 meses y dos minors, salvo riesgo crítico;
4. retirar solo en major;
5. conservar lector de evidencia histórica durante el soporte prometido cuando sea seguro.

## Algoritmo retirado

Un algoritmo comprometido pasa por estados `creation`, `verify-only`, `forbidden`. El cambio a `verify-only` puede ser de seguridad sin esperar major. Verificación exige opt-in y emite advertencia. `forbidden` rechaza incluso verificación cuando usarlo sea activamente peligroso; la excepción queda explicada en advisory.

## Reproducibilidad de errores

Los informes de soporte deben poder incluir versión, comando saneado, códigos, perfil, algoritmo, tamaños y hashes de fixtures, nunca payload por defecto. El motor no genera IDs aleatorios; el host puede correlacionar externamente.
