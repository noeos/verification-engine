# Garantías, límites y afirmaciones permitidas

Estado: **normativo**

## Garantías técnicas condicionadas

Cuando el consumidor usa una versión, perfil y algoritmo admitidos, y aporta una secuencia completa correctamente declarada, el motor garantiza:

- transformación determinista conforme al perfil;
- detección de cambios de bytes respecto del digest esperado;
- detección de enlaces anteriores o posiciones inconsistentes;
- reproducibilidad de evidencia en plataformas soportadas;
- códigos de resultado estables dentro de la major;
- procesamiento dentro de presupuestos publicados o rechazo explícito.

## Lo que no puede garantizar

El motor por sí solo no prueba:

- quién creó un registro;
- que un registro sea verdadero, legal o autorizado;
- cuándo existió;
- que una secuencia sin final declarado no haya perdido registros al final;
- que una secuencia observada sea la única historia posible;
- que un atacante no haya regenerado toda una cadena sin ancla externa;
- confidencialidad del payload;
- no repudio;
- cumplimiento de una norma sectorial;
- seguridad absoluta o ausencia total de defectos.

## Omisiones

Una omisión intermedia es observable si rompe posiciones, enlaces o una cantidad/manifiesto esperado. Una omisión final solo es observable si existe final esperado, cantidad esperada o ancla posterior. Una omisión anterior al fragmento solo es observable con frontera anterior confiable.

El resultado debe ser `indeterminate` cuando falte información necesaria. Está prohibido degradarlo a `valid` por conveniencia.

## Duplicados

Se distinguen:

- identidad repetida (`recordId`);
- contenido repetido (`contentDigest`);
- enlace repetido (`linkDigest`).

El motor informa los tres. Que un contenido repetido sea válido depende del perfil de cadena; por defecto es aviso, mientras identidad o enlace repetidos son error.

## Colisiones y algoritmos

Una función hash ofrece resistencia probabilística, no unicidad matemática. Los documentos comerciales usarán “detección de alteraciones mediante hashes criptográficos” y no “imposible de alterar”. Un algoritmo retirado se conserva solo para verificar historia, bajo modo legado explícito y advertencia; nunca para crear nuevas cadenas.

## Uso de evidencias

Las evidencias son artefactos técnicos. Su valor probatorio depende de custodia, anclas, identidad, procedimiento y jurisdicción. El motor no debe emitir frases como “legalmente válido”, “certificado” o “conforme a VERI*FACTU”.

## Política de afirmaciones públicas

Toda afirmación debe enlazar a:

- versión concreta;
- capacidad probada;
- límites aplicables;
- estándar exacto cuando se declare conformidad;
- evidencia de auditoría cuando proceda.

Se prohíben “100% seguro”, “irrompible”, “sin posibilidad de fraude” y equivalentes.
