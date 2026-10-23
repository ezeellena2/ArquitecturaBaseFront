# Mejoras de catálogos: tableros elegidos

Fecha: **2026-10-21**. **Elegidos CA1-A y CA2–CA6** de la versión 102 del lienzo; la 110 suma el ajuste de claridad de
la vista previa (abajo). E1 implementado y verificado localmente, con code review cerrado; el piloto real se reúne con E2 después de su review.

Origen: la sección «Catálogos» de la página «Formularios por WhatsApp» del Artifact
[Sistema visual — ArquitecturaBase](https://claude.ai/artifact/HPbmDPLnr8JZ9TxevtTqJJ). Como el Artifact es privado
y puede cambiar fuera de Git, este documento y sus capturas congelan lo elegido. El alcance y las decisiones están en las
[reglas vigentes](../../../ArquitecturaBase/docs/features/formularios.md#catálogos-base-de-la-etapa-e1--2026-10-21); las pantallas, los textos y
los estados salen de acá. Para recorrerlo tocando, el [prototipo navegable](https://claude.ai/artifact/2noVifPc2MX33UnNvT2jhY)
tiene siete recorridos en su sección «Catálogos».

## Los tableros

CA1 tenía dos conceptos de dónde viven las acciones nuevas: A, todo a la vista; B, un menú «Cargar de una vez» y una
vista de planilla. **Se eligió CA1-A**; B queda en el lienzo como la alternativa que no se eligió. CA2–CA6 valen para el
concepto elegido.

| Captura | Qué define |
| --- | --- |
| [CA1-A · Todo a la vista](evidence/catalogos-mejoras/ca1-a-todo-a-la-vista.png) | **Elegido el 2026-10-21.** El editor de un catálogo escrito a mano. Agregar opción y el lápiz, que abre la opción entera debajo de su fila, quedan como hoy. En la barra de Opciones, a la vista: Pegar desde Excel, Importar, Exportar y «⋯» (descargar la plantilla, ordenar de la A a la Z, que se aplica al guardar, y generar los códigos que faltan desde el texto). En pantallas anchas la tabla se edita en el lugar: el texto cuenta hasta 30 y avisa si se repite; un código repetido no deja guardar y dice dónde está el otro. Una casilla por fila y otra para las de la página: la barra da de baja o reactiva las elegidas, solo de esa página; los cambios grandes se hacen exportando e importando. Al costado, «Así lo ve el empleado», con lo que se está editando: por defecto, el campo cerrado, con «Elegí una opción»; al tocarlo, la lista con los círculos de una sola opción, que se cierra al elegir o con «Volver», y el campo muestra lo elegido. Arriba, «Una opción / Varias»: lo decide cada pregunta del formulario. En la cabecera, «Usado en N formularios», solo el número. En un catálogo nuevo, pegar e importar aparecen apagados con su motivo. En el celular no hay tabla editable: se edita por opción, y pegar, importar y exportar están en «⋯». Exportar y la plantilla piden «Ver catálogos»; lo demás, «Administrar catálogos». |
| [CA2 · Importar y pegar](evidence/catalogos-mejoras/ca2-importar-y-pegar.png) | **Elegido el 2026-10-21.** Pegar desde Excel e importar un archivo son el mismo recorrido, en tres pasos: el archivo, hecho con la plantilla del catálogo (una columna por campo, si es obligatoria y una fila de ejemplo), o las filas pegadas; revisar; y aplicar. La revisión dice cuántas filas leyó y muestra, en pestañas, las altas, los cambios, las bajas y las filas con errores, por fila y columna («Fila 37 · Código: repetido»); las filas con errores no entran. Lo que no viene en la planilla se da de baja, no se borra, y vuelve si aparece en otra. Piden confirmar una planilla vacía, una que daría de baja una parte grande o una con muchos errores; la misma planilla no se aplica dos veces. Si otra persona guardó mientras se revisaba (409), se revisa de nuevo. Solo sobre un catálogo guardado y sin cambios pendientes. Exportar baja todas las opciones, activas y dadas de baja, con las columnas de la plantilla. |
| [CA3 · Tipo de valor](evidence/catalogos-mejoras/ca3-tipo-de-valor.png) | **Elegido el 2026-10-21.** El tipo de valor se elige al crear un catálogo escrito a mano (texto por defecto, entero, decimal o fecha) y no se cambia; los de la base son siempre de texto. Un catálogo tipado suma la columna «Valor», obligatoria y validada al escribir, al pegar y al importar; el código sigue siendo la identidad. El editor de formularios muestra el tipo del catálogo. La respuesta guarda el texto, el valor y su tipo: el Excel suma una columna con el valor, como número, y el PDF lo muestra junto al texto. CA3 se dibujó sobre la lista de hoy; con CA1-A, la columna Valor va en la tabla que se edita en el lugar. |
| [CA4 · Elegir varias](evidence/catalogos-mejoras/ca4-elegir-varias.png) | **Elegido el 2026-10-21.** «Elegir de un catálogo» y «Elegir una opción» suman «Permitir elegir varias», con mínimo (1 si es obligatoria) y máximo (hasta 20); por dentro es otro tipo de pregunta. Activarlo en una pregunta publicada crea una pregunta nueva, como cambiar de catálogo, y se avisa antes. WhatsApp muestra hasta 20 opciones en una pregunta de varias (200 en una de una sola): la comprobación de publicar lo frena y dice qué hacer, filtrar por persona o esperar la búsqueda en vivo; con un catálogo de la base, el envío se bloquea con un aviso si a una persona le tocarían más. La lista de preguntas dice «varias, hasta 3» y la vista previa muestra casillas, con «Elegí hasta 3». En el primer corte, sin prellenado del asistente. |
| [CA5 · Las respuestas con varias](evidence/catalogos-mejoras/ca5-respuestas.png) | **Elegido el 2026-10-21.** Una pregunta de varias se lee igual en todos lados, en el orden en que se eligieron: «Frío, Ruido» en la celda de la planilla, que sigue en la línea de abajo si no entra (la columna no se ordena); el filtro «alguna de» arriba, con su chip, y en Más filtros con la cantidad de cada opción (una respuesta con dos cuenta en las dos); una opción por renglón en el detalle D2; «Frío, Ruido» en la tarjeta del chat y en el PDF; y «Frío; Ruido» en una celda del Excel. |
| [CA6 · El circuito de punta a punta](evidence/catalogos-mejoras/ca6-circuito.png) | **Elegido el 2026-10-21.** Pegar un catálogo de proveedores desde Excel, usarlo en «Pedir repuesto» con elegir varias, la respuesta en WhatsApp, y la planilla con el Excel, con lo que hacen la persona y el sistema. |

## Lo que se fijó al dibujar

El plan no lo decía; se resolvió con la opción más simple y quedó confirmado al elegir:

- el archivo: XLSX o CSV, hasta 10.000 filas, el tope de un catálogo;
- pegar e importar se apagan, con su motivo, en un catálogo nuevo y con cambios sin guardar;
- un texto de más de 30 y un código repetido no dejan guardar y dicen la fila; un texto repetido solo avisa;
- exportar y bajar la plantilla piden «Ver catálogos»;
- en el Excel, el valor de un catálogo tipado va en su propia columna, como número; el PDF lo muestra junto al texto;
- en una pregunta de varias, el mínimo es 1 si es obligatoria y el máximo, hasta 20;
- la planilla filtra una pregunta de varias con «alguna de» y un chip.

## Ajuste de claridad, 2026-10-21

La vista previa «Así lo ve el empleado» mostraba solo la lista abierta y parecía de elegir varias. La elección no cambia;
el tablero CA1-A (versión 110 del lienzo) y el navegable ya lo muestran, y la captura de arriba es la ajustada:

- por defecto se ve el campo cerrado, como en el formulario: la etiqueta, «Elegí una opción» y la flecha del desplegable;
- al tocarlo, la lista con los círculos de una sola opción; «Volver» o elegir una la cierran, y el campo muestra lo elegido;
- arriba, «Una opción / Varias»: «Una opción» es el desplegable; «Varias», las casillas cuadradas con «Elegí hasta N», como
  en CA4. Debajo dice «Lo decide cada pregunta del formulario»: el selector cambia solo la vista previa, no el catálogo.

En el navegable, la vista previa se toca: el campo abre la lista, una opción la cierra elegida y el selector cambia de una a
varias.

## Lo que no entra

- Filtrar por persona con «Proveedores de mi zona» no entraba en E1. Se implementó después en E2, según los
  tableros elegidos de [campos extra](catalogos-campos-extra.md) (CE4-A), donde el filtro va en la pregunta.

## Recorrido local de E1 — 2026-10-22

El navegador recorrió las piezas CA1-A y CA2–CA6 en español e inglés, a 1440, 390 y 320 × 900 px, con componentes y rutas productivos sobre transporte y datos sintéticos. Se comprobaron tabla con desplazamiento contenido, editor por opción, revisión de filas y confirmaciones, foco con teclado, formato decimal, identidad nueva al cambiar la multiplicidad, rango, casillas propias, filtro «alguna de» y listas históricas en detalle y chat. El texto de cancelación de Descartar se corrigió usando la traducción compartida existente, con regresión es/en que conserva borrador, ruta y foco.

CA6 encadena piezas de escenas independientes; este recorrido no prueba propagación de datos entre ellas, persistencia ni entrega a Meta. Los XLSX/PDF múltiples se comprueban con la integración y los cuerpos HTTP reales del backend, no con el PDF de muestra del navegador. La [verificación local de E1](../../../ArquitecturaBase/docs/features/formularios.md#verificación-local-de-catálogos-e1--2026-10-22) quedó completa; el [piloto real](../../../ArquitecturaBase/docs/plans/verificacion-y-produccion.md#formularios-catálogos-e1) queda para después del code review.

Las capturas son JPEG nativos, con dimensiones comprobadas y sin procesar. Las referencias elegidas de arriba conservan sus archivos originales.

El recorrido móvil se repitió después del reinicio, en es/en a 390 y 320 px: se renovaron sus treinta JPEG. Las doce capturas de escritorio conservaron sus bytes; las referencias elegidas CA1-A y CA2–CA6 permanecen intactas.

| Vista | es · 1440 | en · 1440 | es · 390 | en · 390 | es · 320 | en · 320 |
| --- | --- | --- | --- | --- | --- | --- |
| CA1-A · tabla y editor | [Ver](evidence/catalogos-mejoras/e1-ca1-es-1440.jpg) | [Ver](evidence/catalogos-mejoras/e1-ca1-en-1440.jpg) | [Ver](evidence/catalogos-mejoras/e1-ca1-es-390.jpg) | [Ver](evidence/catalogos-mejoras/e1-ca1-en-390.jpg) | [Ver](evidence/catalogos-mejoras/e1-ca1-es-320.jpg) | [Ver](evidence/catalogos-mejoras/e1-ca1-en-320.jpg) |
| CA2 · revisión de importación | [Ver](evidence/catalogos-mejoras/e1-ca2-es-1440.jpg) | [Ver](evidence/catalogos-mejoras/e1-ca2-en-1440.jpg) | [Ver](evidence/catalogos-mejoras/e1-ca2-es-390.jpg) | [Ver](evidence/catalogos-mejoras/e1-ca2-en-390.jpg) | [Ver](evidence/catalogos-mejoras/e1-ca2-es-320.jpg) | [Ver](evidence/catalogos-mejoras/e1-ca2-en-320.jpg) |
| CA3 · valor decimal | [Ver](evidence/catalogos-mejoras/e1-ca3-es-1440.jpg) | [Ver](evidence/catalogos-mejoras/e1-ca3-en-1440.jpg) | [Ver](evidence/catalogos-mejoras/e1-ca3-es-390.jpg) | [Ver](evidence/catalogos-mejoras/e1-ca3-en-390.jpg) | [Ver](evidence/catalogos-mejoras/e1-ca3-es-320.jpg) | [Ver](evidence/catalogos-mejoras/e1-ca3-en-320.jpg) |
| CA4 · mínimo y máximo | [Ver](evidence/catalogos-mejoras/e1-ca4-es-1440.jpg) | [Ver](evidence/catalogos-mejoras/e1-ca4-en-1440.jpg) | [Ver](evidence/catalogos-mejoras/e1-ca4-es-390.jpg) | [Ver](evidence/catalogos-mejoras/e1-ca4-en-390.jpg) | [Ver](evidence/catalogos-mejoras/e1-ca4-es-320.jpg) | [Ver](evidence/catalogos-mejoras/e1-ca4-en-320.jpg) |
| CA5 · respuesta completa | [Ver](evidence/catalogos-mejoras/e1-ca5-es-1440.jpg) | [Ver](evidence/catalogos-mejoras/e1-ca5-en-1440.jpg) | [Ver](evidence/catalogos-mejoras/e1-ca5-es-390.jpg) | [Ver](evidence/catalogos-mejoras/e1-ca5-en-390.jpg) | [Ver](evidence/catalogos-mejoras/e1-ca5-es-320.jpg) | [Ver](evidence/catalogos-mejoras/e1-ca5-en-320.jpg) |
| CA5 · tarjeta del chat | [Ver](evidence/catalogos-mejoras/e1-chat-es-1440.jpg) | [Ver](evidence/catalogos-mejoras/e1-chat-en-1440.jpg) | [Ver](evidence/catalogos-mejoras/e1-chat-es-390.jpg) | [Ver](evidence/catalogos-mejoras/e1-chat-en-390.jpg) | [Ver](evidence/catalogos-mejoras/e1-chat-es-320.jpg) | [Ver](evidence/catalogos-mejoras/e1-chat-en-320.jpg) |

La vista previa de opciones propias en inglés: [390 px](evidence/catalogos-mejoras/e1-ca4-preview-en-390.jpg) y [320 px](evidence/catalogos-mejoras/e1-ca4-preview-en-320.jpg). El catálogo conserva el aviso de preparación por destinatario, sin inventar opciones: [390 px](evidence/catalogos-mejoras/e1-ca4-preview-es-390.jpg) y [320 px](evidence/catalogos-mejoras/e1-ca4-preview-es-320.jpg). La planilla filtrada conserva el scroll dentro de su tabla: [390 px](evidence/catalogos-mejoras/e1-ca5-sheet-es-390.jpg) y [320 px](evidence/catalogos-mejoras/e1-ca5-sheet-es-320.jpg).

## Cierre del review E1 — 2026-10-22

El [review de E1](../../../ArquitecturaBase/docs/reviews/2026-10-22-code-review-catalogos-e1.md#cierre-local) queda cerrado sobre `e78a946`: 2.959 tests, build productivo sin advertencias, lint limpio, 49 controles de arquitectura y 677 visuales. Las 127 referencias y los seis tableros elegidos conservan sus SHA. Se inspeccionaron las 114 capturas E1, incluidos los valores de Altas/Cambios y Error/Aviso con encabezado real y fila relacionada. El título de importación reserva el espacio del cierre; la geometría se verifica en las seis combinaciones de idioma y ancho.

El recorrido visible verificó CA1-A, CA2, CA3 y la tarjeta CA5 en es/en a 390 y 320 × 900 px: tabla con scroll contenido y editor por opción; límite 20 para Varias; valores localizados, encabezados, confirmaciones, pie fijo y título sin superposición; decimal inválido con mensaje y Guardar apagado, y formato válido por idioma; elecciones históricas en el chat. Los cambios locales del editor se descartaron. Son 28 JPEG de la matriz y dos de contraste es320, todos nativos, sin procesar y con dimensiones comprobadas.

| Vista | es · 390 | en · 390 | es · 320 | en · 320 |
| --- | --- | --- | --- | --- |
| CA1-A · vista previa hasta 20 | [Ver](evidence/catalogos-mejoras/e1-review-ca1-preview-es-390.jpg) | [Ver](evidence/catalogos-mejoras/e1-review-ca1-preview-en-390.jpg) | [Ver](evidence/catalogos-mejoras/e1-review-ca1-preview-es-320.jpg) | [Ver](evidence/catalogos-mejoras/e1-review-ca1-preview-en-320.jpg) |
| CA2 · altas con valor | [Ver](evidence/catalogos-mejoras/e1-review-ca2-added-es-390.jpg) | [Ver](evidence/catalogos-mejoras/e1-review-ca2-added-en-390.jpg) | [Ver](evidence/catalogos-mejoras/e1-review-ca2-added-es-320.jpg) | [Ver](evidence/catalogos-mejoras/e1-review-ca2-added-en-320.jpg) |
| CA2 · cambios con valor | [Ver](evidence/catalogos-mejoras/e1-review-ca2-changed-es-390.jpg) | [Ver](evidence/catalogos-mejoras/e1-review-ca2-changed-en-390.jpg) | [Ver](evidence/catalogos-mejoras/e1-review-ca2-changed-es-320.jpg) | [Ver](evidence/catalogos-mejoras/e1-review-ca2-changed-en-320.jpg) |
| CA2 · errores y fila relacionada | [Ver](evidence/catalogos-mejoras/e1-review-ca2-error-es-390.jpg) | [Ver](evidence/catalogos-mejoras/e1-review-ca2-error-en-390.jpg) | [Ver](evidence/catalogos-mejoras/e1-review-ca2-error-es-320.jpg) | [Ver](evidence/catalogos-mejoras/e1-review-ca2-error-en-320.jpg) |
| CA2 · aviso y encabezado real | [Ver](evidence/catalogos-mejoras/e1-review-ca2-warning-es-390.jpg) | [Ver](evidence/catalogos-mejoras/e1-review-ca2-warning-en-390.jpg) | [Ver](evidence/catalogos-mejoras/e1-review-ca2-warning-es-320.jpg) | [Ver](evidence/catalogos-mejoras/e1-review-ca2-warning-en-320.jpg) |
| CA3 · validación decimal | [Ver](evidence/catalogos-mejoras/e1-review-ca3-invalid-es-390.jpg) | [Ver](evidence/catalogos-mejoras/e1-review-ca3-invalid-en-390.jpg) | [Ver](evidence/catalogos-mejoras/e1-review-ca3-invalid-es-320.jpg) | [Ver](evidence/catalogos-mejoras/e1-review-ca3-invalid-en-320.jpg) |
| CA5 · tarjeta histórica | [Ver](evidence/catalogos-mejoras/e1-review-ca5-chat-es-390.jpg) | [Ver](evidence/catalogos-mejoras/e1-review-ca5-chat-en-390.jpg) | [Ver](evidence/catalogos-mejoras/e1-review-ca5-chat-es-320.jpg) | [Ver](evidence/catalogos-mejoras/e1-review-ca5-chat-en-320.jpg) |

Los PNG es320 con letras recortadas se contrastaron en el navegador: [planilla](evidence/catalogos-mejoras/e1-review-ca5-sheet-es-320.jpg) y [detalle](evidence/catalogos-mejoras/e1-review-ca5-detail-es-320.jpg) muestran sus cabeceras completas y la tabla desplaza su contenido dentro del contenedor. La validación de Valor se llevó al viewport para ver el campo y su mensaje completos.

El transporte y los datos son sintéticos; CA6 encadena escenas independientes y no acredita propagación ni entrega a Meta. La escena del chat no contiene catálogo ni detalles: la presentación de esos metadatos se acredita con sus tests unitarios. El piloto real sigue pendiente. Se cerraron la pestaña y el servidor propios, se restableció el viewport y se ejecutó aspire stop.


## Convivencia con E2 — 2026-10-23

E2 conserva CA1-A y CA2–CA6 y suma los [campos extra, la presentación y el filtro por persona](catalogos-campos-extra.md#cierre-local-de-e2--2026-10-23). La última VRT conjunta aprobó 719/719 pruebas, incluidos los recorridos de E1, sin reescribir sus referencias elegidas. La evidencia física pendiente de ambos se reúne en el [único piloto posterior al review de E2](../../../ArquitecturaBase/docs/plans/verificacion-y-produccion.md#formularios-piloto-único-con-meta-después-de-e2).
