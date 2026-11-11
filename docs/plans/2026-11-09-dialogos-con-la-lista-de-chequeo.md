# Diálogos con la lista de chequeo

Fecha: **2026-11-09**. Estado: **elegidas las recomendadas el 2026-11-11 y programadas el mismo día (tareas 1 a 7; la 8
no se agregó); falta el cierre**.

El [diseño](../design/dialogos-con-la-lista-de-chequeo.md) rehace el diálogo «Exportar respuestas a Excel» con la
[lista de chequeo de diseño](../design/visual-baseline.md#lista-de-chequeo-de-diseño) y propone cómo quedan los demás
diálogos con el mismo problema. Los tableros están en el lienzo aparte
[Diálogos con la lista de chequeo](https://claude.ai/artifact/NUTGFtcXh7QPq8wnpJ6K6c). Este plan supone EX1-A y EX2-A,
las recomendadas; si el usuario elige otras, cambian las tareas 3 y 4.

## Antes de empezar

- **Elecciones del usuario:** EX1 (A, B o C), EX2 (A, B o C), los «así» del tablero DL (todos o uno por uno), las cinco
  confirmaciones dudosas y las reglas RF1 a RF3. Lo que no elija queda como está.
- **El front quieto:** sin la prueba integral en curso ni otra sesión editando `src`. Las tareas 1 y 2 tocan
  `shared/ui`, que usa toda la app.
- **Después de MA1-A.** El [plan del motivo de lo apagado](2026-11-09-motivo-de-lo-apagado.md) cambia `DisabledReason`,
  `CheckboxField` y la (i). Este plan usa ese motivo en una opción de radio: va después, o en la misma tanda.
- **Con UD.** El estado «Se elimina al guardar» de las opciones de un catálogo lo resuelve
  [Un dato por columna](2026-11-09-un-dato-por-columna.md) (UD3) en la tabla; el diálogo de la opción lo sigue.
- **Con formularios sólo en la app.** Su [plan](../../../ArquitecturaBase/docs/plans/2026-11-09-formularios-solo-en-la-app.md)
  cambia lo que dicen la baja («No se carga más en la app»; chat y asistente sólo con WhatsApp), la eliminación (la
  advertencia sólo si alguna versión se publicó en WhatsApp) y «Qué se publica» (la fila «Dónde se completa»). Este plan
  cambia cómo se leen. El que se programe segundo parte de lo que dejó el otro.
- Sin cambios en el backend ni en el contrato.

## Qué tiene que quedar

Igual a los tableros EX1-A, EX2-A y EX3, y a la columna «Así» de DL. La lista de chequeo es el criterio de cierre: cada
diálogo tocado la pasa entera, y la revisión lo compara con su tablero elemento por elemento.

## Tareas

Cada tarea arranca con su test en rojo (`vitest`) y cierra con `tsc`, `lint` y los tests de lo que toca.

1. **Un título de grupo común.** El rótulo de un grupo con su (i), del nivel de letra de un rótulo, en `shared/ui`. Lo
   dibuja `RadioGroupField` cuando recibe un título (hoy su `label` es sólo el nombre accesible), con `help` para la
   (i), y lo usan los grupos que hoy lo arman a mano: «Columnas a exportar», los dos de «Nuevo catálogo», «Datos que van
   prellenados» del envío de un formulario y los grupos de «Dar de baja». El grupo se llama como su título.
2. **Dos piezas chicas.**
   - `FilterChip` sin `onRemove` se lee igual y no tiene la cruz: los filtros de un diálogo no se quitan ahí.
   - Una opción de `RadioGroupField` apagada da su motivo, con el mecanismo de MA1-A.
3. **El filtro de una pregunta del bloque (EX2-A).** `responseFilterLabels` (`responses.ts`) suma «(en algún ítem de
   Artículo)» a la condición de una pregunta del bloque, con un texto nuevo en español y en inglés. Se ve en los chips
   de la planilla y en el diálogo. Test con una pregunta del bloque, un rango y varios valores.
4. **El diálogo de exportar (EX1-A).** `ResponseExportDialog`:
   - `DataList` con «Respuestas» y «Filtros» (los chips sin la cruz, o «Ninguno»).
   - «Columnas» con el título del grupo y su (i). «Solo las visibles» se apaga con «Se ven todas las columnas.» cuando
     da lo mismo que «Todas las preguntas».
   - «Incluir las anuladas» con su (i); marcada, «Respuestas» dice «N y las anuladas». Con un estado elegido no aparece
     (CW11-A).
   - `DataList` con «Archivo» y «Filas», como sale el Excel elegido (XL1-A, del
     [plan del Excel](../../../ArquitecturaBase/docs/plans/2026-11-09-excel-de-respuestas-en-una-hoja.md)): «Una por ítem
     de Artículo», o «Una por respuesta» sin bloque o con el bloque fuera de «Solo las visibles», con la (i) «Los datos de
     cada respuesta se repiten en sus ítems. Una respuesta sin ítems ocupa una fila. Hasta 100.000 filas.». El backend ya
     arma el Excel así desde el 2026-11-09, con el tope de 100.000 filas que eligió el usuario; si se pasa, el error
     `Forms.Record.ExportTooManyRows` trae el motivo.
   - El cuerpo de la petición no cambia. Tests con los estados de EX3; escena visual del diálogo en es y en, a 1440,
     390 y 320, con referencias nuevas revisadas una por una.
5. **Los cuatro dibujados en DL.**
   - «Dar de baja»: dos grupos en `DataList` con su título y un solo aviso, el de WhatsApp. La explicación del
     asistente, en su (i).
   - «Eliminar»: una frase con lo que se afecta y el aviso de WhatsApp sólo con una versión publicada.
   - «Resolver el envío»: «Destinatario» en `DataList`; la frase gris pasa a ser el motivo de las opciones apagadas.
   - «Revisión del catálogo»: un solo diálogo para las dos páginas, con `ComparisonTable` (Nombre, Descripción y, en
     los de filtros, Filtros) y sin la leyenda.
6. **El resto de DL, en este orden:** el envío de un formulario (`FormComposer`); publicar en WhatsApp (`DataList` en
   lugar de `SummaryRow`); un dato de las personas; importar opciones; cambiar el tipo de un campo; nuevo catálogo;
   aprobar; la foto; la fecha especial; elegir opciones en el celular; opciones y campos de un catálogo; verificar y
   nuevo usuario. Cada uno con su test y, si tiene escena visual, sus referencias revisadas.
7. **Las confirmaciones dudosas**, sólo las que el usuario apruebe.
8. **Control automático (a decidir con el usuario).** Una regla en `designRules.ts` que marque viñetas y párrafos
   sueltos con datos dentro de un `DialogContent` de una feature, con casos permitidos y prohibidos, como pide la
   revisión. Si da falsos positivos que no se pueden acotar, no se agrega.

## Avance (2026-11-11)

El usuario eligió las recomendadas por medio del chat que coordina la tanda final. Todo en el front:

- **Tareas 1 y 2:** `GroupLabel`, `ActionsMenu`, `RadioGroupField` con título, (i) y motivo por opción, y `FilterChip` sin
  cruz (3bb07370).
- **Tareas 3 y 4:** el filtro de una pregunta del bloque (1e71a5b8), el diálogo de exportar (1b9a9eda y 05998a09) y una
  ubicación contada como tres columnas (e28d0ff2).
- **Tarea 5:** dar de baja (31ed74c2), eliminar (a0b5cf15), resolver el envío (5fb2ae1d) y la revisión del catálogo
  (f8a1c98a).
- **Tarea 6:** publicar (3dace410), el envío de un formulario (d1aef7b9), un dato de las personas (63f6e0e0), importar
  opciones (3e36fc87), cambiar el tipo y opciones y campos (41c40d44), nuevo catálogo (1933d623), aprobar (52c89b99), la foto
  (e87f2b2c), la fecha especial (73f6f08d), elegir opciones en el celular (8fb3b9ff), verificar (c23ea2f3) y nuevo usuario
  (95e1b614). Las diferencias con los tableros están en el [diseño](../design/dialogos-con-la-lista-de-chequeo.md#cómo-quedó-2026-11-11).
- **Tarea 7:** las cinco confirmaciones dudosas, en una frase con lo que se afecta (bdc810f1).
- **Tarea 8:** no se agregó: la sintaxis no distingue una viñeta con datos de una lista de cosas (diez archivos con listas
  legítimas dentro de un diálogo), así que los falsos positivos no se acotan. RF1 a RF3 quedaron en `visual-baseline.md`.
- **test:visual de estas escenas** (una copia de HEAD, en otro puerto): nueve referencias regeneradas y revisadas una por
  una (0977a90f), con «1 de 2 ↑ ↓» juntos en la pantalla completa (c738e0a5); las escenas de evidencia de los editores, los
  catálogos y la carga pasan (259 de 259).
- Cada commit pasó `tsc`, oxlint y vitest de lo tocado, con los tests de arquitectura y la paridad de idiomas. El cierre de
  abajo va en la verificación conjunta de la tanda.

## Cierre

- `npm run build`, `npm run lint` y `npm run test` completos; `npm run test:visual` con cada referencia que cambie
  revisada y explicada; el recorrido en el navegador sobre el catálogo local, con teclado, en es y en, a 1440, 390 y
  320.
- La decisión pasa a `visual-baseline.md` (la sección del diseño deja de ser propuesta) y, si se aprueban, RF1 a RF3 van
  a sus secciones. T5 queda marcado como reemplazado en `formularios-whatsapp.md`, y las guías de
  `src/features/business-forms/components` dicen lo que hace el código final.
- Pasar los tableros al lienzo del sistema visual y retirar este plan con la
  [auditoría documental](../../../ArquitecturaBase/docs/guides/auditar-documentacion.md).
