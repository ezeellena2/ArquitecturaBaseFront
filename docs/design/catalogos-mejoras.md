# Mejoras de catálogos: tableros elegidos

Fecha: **2026-10-21**. **Elegidos CA1-A y CA2–CA6** de la versión 102 del lienzo; por programar.

Origen: la sección «Catálogos» de la página «Formularios por WhatsApp» del Artifact
[Sistema visual — ArquitecturaBase](https://claude.ai/artifact/HPbmDPLnr8JZ9TxevtTqJJ). Como el Artifact es privado
y puede cambiar fuera de Git, este documento y sus capturas congelan lo elegido. El alcance y las decisiones están en el
[plan](../../../ArquitecturaBase/docs/plans/formularios/catalogos-carga-tipo-y-varias.md); las pantallas, los textos y
los estados salen de acá. Para recorrerlo tocando, el [prototipo navegable](https://claude.ai/artifact/2noVifPc2MX33UnNvT2jhY)
tiene siete recorridos en su sección «Catálogos».

## Los tableros

CA1 tenía dos conceptos de dónde viven las acciones nuevas: A, todo a la vista; B, un menú «Cargar de una vez» y una
vista de planilla. **Se eligió CA1-A**; B queda en el lienzo como la alternativa que no se eligió. CA2–CA6 valen para el
concepto elegido.

| Captura | Qué define |
| --- | --- |
| [CA1-A · Todo a la vista](evidence/catalogos-mejoras/ca1-a-todo-a-la-vista.png) | **Elegido el 2026-10-21.** El editor de un catálogo escrito a mano. Agregar opción y el lápiz, que abre la opción entera debajo de su fila, quedan como hoy. En la barra de Opciones, a la vista: Pegar desde Excel, Importar, Exportar y «⋯» (descargar la plantilla, ordenar de la A a la Z, que se aplica al guardar, y generar los códigos que faltan desde el texto). En pantallas anchas la tabla se edita en el lugar: el texto cuenta hasta 30 y avisa si se repite; un código repetido no deja guardar y dice dónde está el otro. Una casilla por fila y otra para las de la página: la barra da de baja o reactiva las elegidas, solo de esa página; los cambios grandes se hacen exportando e importando. Al costado, el desplegable de WhatsApp con lo que se está editando; en la cabecera, «Usado en N formularios», solo el número. En un catálogo nuevo, pegar e importar aparecen apagados con su motivo. En el celular no hay tabla editable: se edita por opción, y pegar, importar y exportar están en «⋯». Exportar y la plantilla piden «Ver catálogos»; lo demás, «Administrar catálogos». |
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

## Lo que no entra

- Filtrar por persona con «Proveedores de mi zona», que muestra el prototipo en el recorrido 5: depende de los campos
  tipados del plan (un campo de papel «filtro»), que todavía no tienen tablero.
