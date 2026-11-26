# Motor para documentos: tableros elegidos

Fecha: **2026-11-09**. Es la etapa 2 de ARCA: lo que el formulario necesita para armar una factura, sin emitir. El usuario
eligió las cuatro recomendadas: **CA1-A, RE1-A, BI1-A y CO1-A**. Programado en el backend del 2026-11-09 al 2026-11-11 y en el
front el 2026-11-11; faltan la prueba integral y las capturas del backend en los tests de contrato.

Origen: el lienzo aparte [ARCA · motor para documentos](https://claude.ai/artifact/JPwMtoM9TqM8fyqGCr9QVP), una fila por
pregunta con la recomendada primero. El Sistema visual es de otra cuenta y el lienzo provisorio lo comparten a la vez las
sesiones de las etapas 3 a 6, así que, como en renglones, carpetas, la IA y «Formularios sólo en la app», este documento
congela lo elegido. Las reglas y el backend están en [formularios](../../../ArquitecturaBase/docs/features/formularios.md#cálculos--ca1-a-2026-11-09),
de «Cálculos» a «Biblioteca de estándares»; las carpetas siguen su propio
[diseño](../../../ArquitecturaBase/docs/features/formularios.md#carpetas--cp1-a-a-cp5-a-2026-11-09) (CP2-A y CM1 a CM6).

## Los tableros

| Tablero | Qué define |
| --- | --- |
| **CA1-A · El cálculo es una pregunta más** (elegido) | «Cálculo» es un tipo de pregunta en «Agregar pregunta». Su zona tiene «Qué calcula», un segmentado con Multiplicar, Sumar y Porcentaje, y los datos: dos desplegables con las preguntas de número anteriores para multiplicar (cantidad × precio) y para porcentaje (base y alícuota; la alícuota también puede ser una elección de un catálogo con valor numérico), y fichas con «+ Agregar» para sumar («Importe · todos los ítems», o varias preguntas de afuera). Dentro del bloque lleva «Se carga varias veces», como las demás. Al cargar se ve en gris, sin poder escribirse, y se actualiza al escribir: en la tabla del bloque es una columna más, alineada a la derecha; en el panel y el celular, una línea del recuadro de cada ítem; afuera del bloque, un campo de una columna. Su (i) dice cómo se calcula («Suma de Importe de todos los ítems»). En la planilla, «Filtros», el Excel, el PDF, las reglas y los avisos es un número más. Por WhatsApp no se ve: la respuesta llega calculada. |
| CA1-B · Columnas calculadas y totales al pie | Descartado: columnas calculadas en el bloque y una zona «Totales» al pie, fuera de las preguntas. |
| **RE1-A · Una zona en la respuesta** (elegido) | Lo que devuelve una acción externa (en ARCA, «Emitir comprobante en ARCA»: comprobante, código de autorización y su vencimiento) es una zona con el nombre de la acción, arriba de «Datos», en la pestaña «Respuesta» de la vista rápida, la pantalla completa y el celular, con sus datos a la vista (etiqueta en gris arriba, valor debajo, en tres columnas). Sin resultado, la zona no aparece; el estado de la emisión es de la etapa 3. En la planilla, una columna por dato después de las preguntas, que se oculta y se muestra en «Columnas»; sin resultado, «—». El Excel trae las mismas columnas y la copia PDF, la misma zona arriba de las respuestas. En el editor de reglas, «Agregar dato» suma el grupo «De «Emitir comprobante en ARCA»» sólo en los avisos que van después de esa acción en la misma regla; el dato se completa al mandar el aviso. |
| RE1-B · En la actividad | Descartado: el comprobante junto al número de la respuesta y todo en el momento de la emisión, con una sola columna. |
| **BI1-A · El candado en cada pregunta** (elegido) | La pantalla «Biblioteca» es la de DOC1 ([documentos](documentos.md)) sin la lectura de documentos: una fila por estándar con su nombre, descripción, «Versión 1 · ARCA · En 1 formulario» en gris y «Agregar». Aparece en Gestión de formularios cuando un módulo instalado trae un estándar y pide «Diseñar formularios». «Agregar «Factura»» pide nombre, prefijo de numeración (el del estándar; si ya está usado, con un número) y carpeta (la del estándar, por defecto), crea el borrador y abre el editor. En el editor, el encabezado suma en gris «· De la biblioteca: Factura, versión 1» y cada pregunta atada lleva un candado al lado de su nombre en la lista, con su (i): se cambian el texto, la ayuda y el orden. Adentro, el tipo, el catálogo, las opciones, el cálculo, «Obligatoria» y «Quitar» quedan apagados, cada uno con su motivo sobre el mismo control (MA1-A): «La necesita la emisión en ARCA: no se puede quitar». |
| BI1-B · La lista en «El formulario» | Descartado: un párrafo fijo en «El formulario» con las preguntas atadas, sin marca en la lista. |
| **CO1-A · La condición en cada pregunta** (elegido) | La zona de una pregunta suma «Se muestra», un segmentado con «Siempre» y «Según otra respuesta»; con la segunda, «Si» (un desplegable con las preguntas anteriores de elegir una, propia o de catálogo, o de sí o no, de afuera del bloque) y «es» (fichas con las respuestas que la muestran). En la lista, debajo del nombre y en gris, «Si Concepto es Servicios o…». Al cargar, al cambiar la respuesta las preguntas que dependen aparecen o desaparecen en su lugar, y lo escrito en una oculta no se manda. «Obligatoria» vale sólo cuando se ve. Un título de sección sin preguntas a la vista también se oculta. Por WhatsApp, el Flow la muestra con la misma condición. Ni el bloque ni sus preguntas llevan condición en esta etapa. |
| CO1-B · La condición en el título de sección | Descartado: la condición en el título, que muestra u oculta la zona entera. |

## Lo que se fijó al dibujar

- Un cálculo se redondea a 2 decimales y no puede ser obligatorio.
- Los datos de un cálculo y la pregunta de una condición van antes, así no hay ciclos.
- La biblioteca no trae un estándar propio en esta etapa: el primero es la factura, que llega con la etapa 3.

## En el código (front, 2026-11-11)

- CA1-A: «Cálculo» en «Tipo de respuesta» y «Qué calcula» en `CalculationSettings`; la vista previa de la carga en `calculations.ts`
  (`entryCalculations`), con decimales exactos y el redondeo half-even del servidor. Una alícuota de un catálogo con valores se
  calcula con el `value` que trae su opción; en uno sin valores, el campo queda vacío hasta enviar.
- CO1-A: «Se muestra» en `ConditionSettings`, la línea de la lista en `ConditionLine` y lo que se oculta al cargar en
  `conditions.ts` (`entryHiddenQuestions`). En un formulario que va por WhatsApp, una pregunta de catálogo toma una sola
  respuesta (el buscador queda apagado con su motivo) y una cuarta condición en cadena (`conditionDepth`) lo dice debajo, con
  «Sólo en la app» como salida: es lo que el canal no publica.
- BI1-A (la parte del editor): el encabezado con el estándar (`useFormStandardName`), el candado y los controles apagados con
  su motivo en `QuestionEditor` (`boundQuestions.ts`). El motivo dice «el estándar de la biblioteca», sin nombrar el módulo.
- BI1-A (la pantalla): «Biblioteca» en Gestión de formularios sólo con `form-library` instalado. `FormLibraryPage` muestra en
  la compu una tabla con un dato por columna («Estándar», «Versión», «Origen», «Formularios» y «Acciones»), porque el tablero es
  anterior a esa premisa (UD1); en el celular, una tarjeta por estándar con la línea en gris y «Agregar» de todo el ancho.
  `FormStandardAddDialog` pide nombre, prefijo (el que sugiere el servidor, `suggestedPrefix`, que mira los prefijos en uso) y
  carpeta («La del estándar» o una de Diseñar formularios). Escena en `src/test/visual/forms-library.spec.ts`.
- RE1-A: la zona `ResponseResults`, dentro de la zona de la emisión (`ResponseIssuance`, EM1-A), que va primera en el detalle y en la pantalla completa, y una columna por dato en la planilla, agrupadas por acción en
  «Columnas» (`responseResultColumnId`). El grupo «De «Emitir comprobante en ARCA»» de «Agregar dato» lo sumó la etapa 4 con
  su acción.
- Escenas sin golden en `src/test/visual/formEngine.spec.ts`. Faltan la prueba manual y las capturas del backend.
