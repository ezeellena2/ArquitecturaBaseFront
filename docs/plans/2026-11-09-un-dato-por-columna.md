# Un dato por columna (UD)

Fecha: **2026-11-09**. Estado: **regla y excepciones elegidas; faltan el visto bueno a los tableros y al plan, y un
momento con el front quieto**.

El usuario pidió el 2026-11-09 que una columna no junte varios datos, y que sea una premisa. La regla está en el
[fundamento visual](../design/visual-baseline.md#un-dato-por-columna--2026-11-09), en las
[premisas del front](../guides/premisas-de-desarrollo.md#tablas) y en el
[índice de premisas](../../../ArquitecturaBase/docs/architecture/premisas-de-la-plantilla.md). Los tableros están en el
lienzo aparte [Un dato por columna](https://claude.ai/artifact/AbCaxVuSGySAjFkpx9gNzB). Este plan lleva a la regla las
columnas, encabezados y bandas que hoy la rompen.

## Antes de empezar

- El mismo día el usuario respondió las excepciones de UD6: «A sí, B no, C sí, D no, E no, F sí». Los tableros UD1 a UD5
  ya las aplican.
- Sólo cambia el front. Todos los datos ya llegan en las respuestas del backend: no hay contratos nuevos ni ejemplos HTTP
  que exportar.

## Qué tiene que quedar

Igual a los tableros. Las columnas de cada vista, en orden:

| Vista | Columnas | Tablero |
| --- | --- | --- |
| Formularios: Activos y Dados de baja | Formulario, Por aprobar, Respuestas, Última respuesta, Recibida, Estado, Cargar | UD1 |
| Formularios: «Con algo por aprobar» | Formulario, Estado del formulario, Por aprobar, Respuestas, Última respuesta, Recibida, Estado, Cargar | UD1 |
| Formularios: quien sólo carga | Formulario, Mis cargas, Mi última carga, Recibida, Cargar | UD1 |
| Diseñar formularios: Activos, Publicados y Borradores | Formulario, Preguntas, En WhatsApp, Versión activa, Respuestas, Último cambio, Cambió, Acciones | UD2 |
| Diseñar formularios: Dados de baja | Formulario, Preguntas, En WhatsApp, Deprecación, Versión activa, Respuestas, Último cambio, Cambió, Acciones | UD2 |
| Catálogos | Nombre, De dónde salen, Opciones, Uso, Estado, Acciones | UD3 |
| Opciones de un catálogo, también sin permiso para editar y en el celular | #, Texto, Código, los campos, Valor, Detalle, Estado, Acciones | UD3 |
| Planilla de respuestas | Número, Corregida, Recibida, Cargó, Canal, Estado, PDF y una por pregunta | UD4 |
| Usuarios | Correo, WhatsApp, Verificado, Nombre, Roles, Creado, Acciones | UD5 |
| Datos de las personas | Dato, Estado, Clave, Tipo, Catálogo, Lo usan, Editar | UD5 |
| Formularios que faltan: Pendientes | Tema, Pedidos, Personas, Último pedido, Acciones | UD5 |
| Formularios que faltan: Descartados | Tema, Descartó, Descartado, Pedidos, Personas, Último pedido, Acciones | UD5 |
| Rol: permisos | Permiso, Descripción, Asignado; en la banda de un área, «2 de 5» va en «Asignado», junto a su casilla | UD6, E |

En cada celda va un dato. Sin dato, «—». En la planilla, el bloque dice «3 ítems», los documentos «2 documentos» y el
encabezado de una pregunta nueva no lleva «(desde v3)», que sigue en «Columnas». «Estado del formulario» y «Corregida»
aparecen sólo cuando la vista los tiene, como hoy «Estado» y «PDF» en la planilla.

## Las excepciones elegidas

| Excepción | Respuesta | Qué queda o qué cambia |
| --- | --- | --- |
| A · texto secundario en gris debajo | Sí | Quedan la descripción debajo del tema y el detalle debajo del valor de una opción en la planilla. Un estado, una fecha o una persona no van debajo: un dato de las personas dado de baja lleva su «Estado» en una columna y quién descartó un tema, y cuándo, van en las suyas. «Usuarios, con filtros» podría quedar debajo de «De la base», pero UD3 lo saca porque es igual en todas las filas. |
| B · etiqueta junto al dato | No | «Corregida» va en su columna (cambia CW10-A), «Sin verificar» pasa a «Verificado» y «Dado de baja», en «Con algo por aprobar», a «Estado del formulario». |
| C · el punto de Usuarios | Sí | El punto delante del correo, como hoy. |
| D · resumen de otra tabla | No | El bloque dice «3 ítems» (cambia RG4-A) y los documentos, «2 documentos». |
| E · encabezados y bandas | No | «(desde v3)» sale del encabezado de la planilla y «2 de 5» pasa a «Asignado» (tarea 6). |
| F · listas que no son tablas | Sí | Siguen como están «Campos de…», las opciones en su diálogo, el chat, las tarjetas de «Enviar formulario», los documentos, las revisiones y la actividad de una respuesta (TL3-A). |

## Tareas

Cada tarea arranca con su test en rojo y cierra con tipos, lint y los tests de lo que toca, sin `test:visual`. Una tarea,
un commit.

1. **Formularios (UD1).** `FormOverviewPage.tsx`: «Última respuesta» deja sólo el número con su enlace; «Recibida» (fecha
   y hora, en el color del texto) y «Estado» (la etiqueta de hoy) son columnas. Quien sólo carga ve «Mi última carga» y
   «Recibida». Sin respuestas, «—» en las tres, porque el 0 de «Respuestas» ya lo dice. El nombre va sin «Dado de baja»;
   con `pendingOnly` se suma «Estado del formulario» (Activo o Dado de baja). Tests: `FormOverviewPage.test.tsx`.
2. **Diseñar formularios (UD2).** `FormsPage.tsx`: «En WhatsApp» dice sólo el estado (textos sin «· versión N»);
   «Versión activa» muestra `activeVersionNumber`, a la derecha; «Último cambio», la fecha, y «Cambió», la persona. En
   «Dados de baja», «En WhatsApp» dice cómo va la deprecación (Deprecado, Pendiente, Sin confirmar, Requiere atención,
   Reactivando) y «Deprecación», `deprecatedAtUtc` o, si está pendiente, `lastOpenSessionExpiresAtUtc`:
   `lifecyclePresentation.ts` devuelve el estado y la fecha por separado. Salen los renglones grises: «La versión N
   publicada sigue activa.» lo dice «Versión activa», y «Reactivando…» pasa a ser el estado. Tests: `FormsPage.test.tsx`.
3. **Catálogos y sus opciones (UD3).** `CatalogListTable.tsx`: «De dónde salen» con un solo valor («Escritas a mano» o
   «De la base»), sin «Usuarios, con filtros». `catalogColumns.ts`: `catalogTableColumns` deja de juntar el código en el
   texto y se retira `textAndCode`; `CatalogItemsTable.tsx` muestra «Código» también sin permiso para editar y en el
   celular, con «Texto» fijo al desplazar. Una opción que se elimina al guardar dice «Se elimina al guardar» en «Estado»,
   en rojo, y en «Acciones» queda «Restaurar». Tests: `CatalogListTable.test.tsx`, `catalogColumns.test.ts`,
   `CatalogItemDeletion.test.tsx` y `CatalogItemsDialog.test.tsx`.
4. **Planilla de respuestas (UD4).** `FormResponsesPage.tsx`: «Corregida» es una columna, con «Sí» o «—», que aparece si
   alguna fila de la página está corregida. `ResponseValue.tsx`, sólo en la planilla y no en el detalle: el bloque dice
   «N ítems» con el enlace a la respuesta y los documentos, «N documentos». El detalle de una opción sigue debajo del
   valor (A). Tests: `FormResponsesPage.test.tsx`, `FormResponsesPage.rows.test.tsx` y `ResponseValue.test.tsx`.
5. **Usuarios, Datos de las personas y Formularios que faltan (UD5).** `users/columns.tsx`: «Usuario» se parte en
   «Correo» (con el punto; ordena por correo, como hoy) y «WhatsApp» (el número formateado), más «Verificado» (Sí, No o
   —); sale el ícono «También entra con WhatsApp». `PersonDataPage.tsx`: «Estado» (Activo o Dado de baja) y «Catálogo»
   (el de origen o —). `MissingFormsPage.tsx`: la descripción sigue debajo del tema (A); en «Descartados», «Descartó» y
   «Descartado» son columnas. Tests: `UsersPage.test.tsx`, `PersonDataPage.test.tsx` y `MissingFormsPage.test.tsx`.
6. **Encabezados y bandas (E).** `FormResponsesPage.tsx`: el encabezado de una pregunta nueva no lleva «(desde v3)», que
   sigue en «Columnas» (`ResponseColumnsMenu.tsx`), y una respuesta anterior a esa versión muestra «—», como hoy.
   `PermissionPicker.tsx`: «2 de 5» pasa de la banda del área a su celda de «Asignado», junto a la casilla. Tests:
   `FormResponsesPage.test.tsx`, `ResponseColumnsMenu.test.tsx` y `PermissionPicker.test.tsx`.
7. **Textos.** Se reusan las claves que ya existen («Recibida», «Estado», «Código», «Corregida») y se suman, en español y
   en inglés, «Estado del formulario», «Versión activa», «Cambió», «Deprecación» y sus estados, «Correo», «WhatsApp»,
   «Verificado», «Catálogo», «Descartó» y «Descartado». Se quitan las que dejan de usarse, como
   `catalogs.items.textAndCode`, `publication.previousActive`, `lifecycle.state`, `missing.discardedBy`,
   `identity.alsoWhatsApp` y las frases de `lifecycle.deprecation`. La paridad la controla `locales/parity.test.ts`.
8. **Un control para lo nuevo.** Evaluar en `src/test/architecture/designRules.ts` una regla, como `legend`, que marque la
   celda de una columna que arma «a · b» con dos valores, con casos positivos y negativos. Si da falsos positivos, queda
   a cargo de la revisión de cada cambio, como los párrafos sueltos.
9. **Escenas visuales.** Cambian las referencias de las pantallas tocadas: `users-*`, `roles-*` y `editor-*` (la banda
   del área), `catalog-*`, `responses-rows-*`, la eliminación de opciones (`catalogItemDeletion`), la planilla con
   correcciones (`formAmendments`) y las de formularios, faltantes y datos de las personas que las muestren. Se revisan
   una por una y se actualizan sólo las que cambian por esta regla.
10. **Docs.** El estado en `visual-baseline.md` (programada), este plan, su fila en el índice de planes del backend y la
    premisa del backend. Los `AGENTS.md` de `business-forms`, `users` y `roles`, si nombran columnas.
11. **Cierre.** Una sola vez: lint, build, `vitest` completo y `test:visual`, con la PC quieta o en tandas si está
    cargada. La prueba manual es guiada: Formularios en sus tres vistas, Diseñar formularios en Activos y Dados de baja,
    un catálogo sin permiso para editar y en el celular, la planilla de un formulario con bloque, documentos y una
    pregunta nueva, un rol, Usuarios, Datos de las personas y Formularios que faltan.

## Dónde se rompe hoy

Relevamiento del 2026-11-09 en `src/features/`, con las excepciones elegidas:

| Archivo y línea | Columna o encabezado | Junta |
| --- | --- | --- |
| `business-forms/pages/FormOverviewPage.tsx:56` | Última respuesta | número, fecha y hora, estado |
| `business-forms/pages/FormOverviewPage.tsx:61` | Mi última carga | número, fecha y hora |
| `business-forms/pages/FormOverviewPage.tsx:52` | Formulario | nombre, «Dado de baja» |
| `business-forms/pages/FormsPage.tsx:79` | En WhatsApp | estado, versión y hasta tres renglones grises |
| `business-forms/pages/FormsPage.tsx:81` | Último cambio | fecha, persona |
| `business-forms/components/CatalogListTable.tsx:47` | De dónde salen | origen, «Usuarios, con filtros» |
| `business-forms/components/CatalogItemsTable.tsx:99` y `catalogColumns.ts:34` | Texto y código | texto, código |
| `business-forms/components/CatalogItemsTable.tsx:110` | Acciones | «Se elimina al guardar», Restaurar |
| `business-forms/pages/FormResponsesPage.tsx:162` | Número | número, «Corregida» |
| `business-forms/pages/FormResponsesPage.tsx:193` | Encabezado de una pregunta nueva | pregunta, «(desde v3)» |
| `business-forms/components/ResponseValue.tsx:56` | Bloque de renglones | cantidad, primeros valores |
| `business-forms/components/ResponseValue.tsx:70` | Documentos | cantidad, formatos |
| `users/columns.tsx:86` | Usuario | estado, correo o número, WhatsApp, «Sin verificar» |
| `business-forms/pages/PersonDataPage.tsx:69` | Dato | nombre, «Dado de baja» |
| `business-forms/pages/PersonDataPage.tsx:69` | Tipo | tipo, catálogo |
| `business-forms/pages/MissingFormsPage.tsx:83` | Tema | tema, quién y cuándo lo descartó |
| `roles/components/PermissionPicker.tsx:65` | Banda de un área | área, «2 de 5» |

Quedan como están por las excepciones: el detalle de una opción en la planilla (`ResponseValue.tsx:123`) y la descripción
de un tema (A), el punto de Usuarios (C) y las listas que no son tablas (F). En `CatalogListTable.tsx:53` el estado puede
llevar un motivo en gris, pero no aparece nunca: `FormCatalogReader` del backend manda `Active` o `Inactive` y el motivo
en `null`. No cambia.

## Cuándo

Toca nueve pantallas y sus capturas. Con la app levantada, Vite recarga la página de quien prueba: va después del visto
bueno del usuario a los tableros y al plan, en un momento con el front quieto, acordado con el chat que coordina la
prueba integral. Puede ir de a una pantalla, en el orden de las tareas.
