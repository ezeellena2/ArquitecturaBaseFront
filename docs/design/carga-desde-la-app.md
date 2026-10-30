# Carga desde la app: tableros elegidos

Fecha: **2026-10-29**, con las reglas de cómo se arma un formulario (CW12, CW13-A y CW16) agregadas el **2026-10-30**.
Estado al **2026-10-30**: Etapa 1 implementada localmente en el backend y el front. Las reglas vigentes están en
[formularios](../../../ArquitecturaBase/docs/features/formularios.md#carga-desde-la-app--etapa-1-2026-10-30) y el alcance y las
decisiones, en el [plan](../../../ArquitecturaBase/docs/plans/2026-10-29-cargar-formularios-desde-la-app.md).

Origen: el lienzo provisorio [Cargar formularios desde la app](https://claude.ai/artifact/Kvbr5KFJrGT951JLiu8i4M). Se armó
aparte porque el [Sistema visual](https://claude.ai/artifact/HPbmDPLnr8JZ9TxevtTqJJ) no se abre desde la cuenta de Claude Code;
según el plan, los tableros elegidos pasan a ese lienzo al cerrar la Etapa 1. Como el lienzo es privado y puede cambiar fuera
de Git, este documento congela lo elegido. Las pantallas, la navegación y los textos salen de acá; el alcance, del plan.

## Cómo leer los tableros

- Están dibujados a mano con los tokens de `src/index.css` y la escala de escritorio al 75 %. Cada parte se arma con su pieza
  de `src/shared/ui` (tabla abajo), no copiando el dibujo.
- Los círculos naranjas numerados son notas del tablero, explicadas en la columna de la derecha. No son UI.
- Los datos (Ana Pérez, Marcos Gil, Siembra, Lluvia, Aplicación, LLU-000321) son ficticios.
- CW16 manda sobre el dibujo de las preguntas en CW2: grilla de tres, zonas plegables y la unidad en la etiqueta.

## Los tableros de la Etapa 1

| Tablero | Qué define |
| --- | --- |
| **CW1-B · Desde «Formularios»** (elegida) | «Cargar» al final de cada fila de MF1 para quien tiene «Completar formularios», salvo en los dados de baja. Quien sólo completa ve «Formularios» con los nombres sin enlace, sin «Por aprobar», «Respuestas», «Última respuesta» ni el segmento de estado. En el celular, «Cargar» queda al final de la tabla, con su desplazamiento contenido. La vista propia («Mis cargas») es de la Etapa 2. |
| **CW2-A · En su propia página** (elegida) | «Nueva respuesta» en `/formularios/{id}/cargar`, con el formulario en las migas. «Volver» lleva a «Formularios» o a la planilla, según de dónde vino. Cancelar y Enviar en la banda; en el celular, Enviar fijo al pie. Se valida al enviar: cada error en su pregunta y el foco en la primera; después, en vivo. Salir con algo cargado pide confirmar. Mientras sube, el botón dice «Enviando… 64 %». |
| **CW2-B · En un panel junto a la planilla** (elegida) | «Agregar respuesta» en el encabezado de la planilla abre el panel al costado, como D2, sólo en escritorio; en el celular abre la página. Una columna; al enviar, el aviso dice el número y la planilla se relee con la respuesta marcada. «Mantener las respuestas para la siguiente» conserva todo menos los archivos. «Pantalla completa» pasa lo cargado a la página. |
| **CW3 · Las listas** | Una pregunta de catálogo es siempre una lista con búsqueda en el servidor, de 50 en 50, con los filtros fijos y por persona de quien carga. Muestra el total, la descripción de cada opción y «Mostrar 50 más». La única opción que dejan los filtros viene elegida. En el celular, la lista ocupa la pantalla, con la búsqueda arriba y «Listo» al pie al elegir varias. Sin el dato de la persona, la página lo dice y Enviar queda apagado con el motivo. |
| **CW4 · Fotos y documentos** | Miniaturas o archivos con «Agregar» y el contador; viajan con el envío, así que quitar no pide confirmación. Tipo, tamaño y cantidad se revisan antes de enviar. En el celular, «Tomar foto» primero y «Quitar» en rojo. |
| **CW5 · Después de enviar** | La página muestra «Enviada» con lo que se mandó, el número y el estado, con «Cargar otra», «Volver a Formularios» y, para quien ve respuestas, «Ver en la planilla». Una versión nueva se ofrece con «Pasar a la versión nueva», conservando lo cargado; un formulario dado de baja ya no se carga. |
| **CW6-A · La planilla de siempre** (elegida) | La respuesta cargada es una fila más: «Cargó» es quien la cargó y «Canal» dice App o WhatsApp, con su filtro rápido, el chip y «Limpiar todo». El detalle dice «Recibida · … · en la app, la cargó Ana Pérez» en el lugar del origen de WhatsApp. El Excel no cambia: el canal ya salía siempre. |

Cómo se arma un formulario (2026-10-30):

| Tablero | Qué define |
| --- | --- |
| CW12 · Cómo se arma un formulario | El autor decide el contenido y la app la forma, con una tabla fija por tipo de pregunta: texto corto con el ancho de su largo máximo, texto largo de 2 a 6 renglones, número y fecha angostos, «Sí \| No» sin nada marcado, hasta cinco opciones cortas en fila (si no, lista desplegable), elegir varias con una casilla por renglón y «Elegí hasta N», catálogo con la lista de CW3 y archivos con CW4. |
| **CW13-A · Unidades en la etiqueta** (elegida) | La unidad la escribe el autor en la etiqueta, «Densidad (kg/ha)», igual en todos lados; el campo no la muestra adentro. |
| **CW16 · Hasta tres por renglón y zonas plegables** (elegida) | Cada zona es una grilla de tres columnas en escritorio, dos en tableta y una en el celular y en el panel, en el orden del editor; una pregunta que no entra baja de renglón, con una línea entre renglones. Una columna: número, fecha, sí o no, texto corto de hasta 30 y lista desplegable; dos: catálogo, opciones en fila y texto corto de hasta 80; el renglón entero: texto largo, texto corto de más de 80, elegir varias, fotos y documentos. Las zonas se pliegan, arrancan abiertas y, plegadas, dicen cuántas preguntas se respondieron; al enviar, una zona plegada con algo para corregir se abre sola. |

Quedan para etapas siguientes, con su tablero en el mismo lienzo: la vista propia de quien sólo completa (Etapa 2), corregir
(CW10-A) y anular (CW11-A) en la Etapa 3, las listas dependientes (CW7) en la Etapa 4 y los títulos de sección (CW15-B) en la
Etapa 5.

## Decisiones de diseño

- **Una sola forma de armar las preguntas.** `entryQuestionSpan` da el ancho por tipo y `entryRows` arma los renglones de tres
  sin reordenar. El panel usa los mismos controles en una columna. «Opción corta» es de hasta 20 caracteres, el «angosto» de
  CW12; el texto largo suma un renglón cada 100 caracteres de largo máximo, entre 2 y 6.
- **Lo cargado vive en su dueño.** El borrador es de la página o del panel: nunca va a la URL, el storage ni la caché de
  consultas. «Pantalla completa» lo pasa en memoria. Repetir un envío con las mismas respuestas conserva su identificador, así
  que un reintento tras un corte devuelve el primer número; cualquier cambio arma otro envío.
- **Los errores se leen donde se corrigen.** Un faltante o un formato marca su pregunta; si una opción se dio de baja entre
  abrir y enviar, su pregunta dice que «Lote 4» ya no está disponible; un corte deja un aviso que pide volver a tocar Enviar.
  La versión nueva y la baja llegan como aviso arriba, sin perder lo cargado.
- **Quien sólo completa no lee respuestas.** «Enviada» se arma con lo que la persona cargó y el número, estado y hora del envío;
  no pide la respuesta guardada. Las migas muestran el formulario como texto, sin enlace a una planilla que no puede abrir.

## Diferencias con el dibujo

- Los textos de las listas son genéricos («58 opciones», «Ninguna opción coincide con «Ombú».») en lugar del sustantivo del
  tablero («58 lotes»): el catálogo no guarda cómo se llaman sus opciones.
- Los mensajes de validación son los del tipo de pregunta («Completá esta respuesta.», «Elegí una opción.») y no los propios
  del dibujo («Elegí un lote.», «Escribí los milímetros.»), que el formulario no tiene.
- Plegada, la banda de «Fotos y documentos» dice las fotos y archivos agregados («1 foto»); sin archivos, «0 de 1 respondidas».
- El aviso «Se guardó» del panel sale en la posición común de los avisos y puede tapar un momento el pie del panel.

## Correspondencia con `shared/ui`

| En el tablero | Pieza |
| --- | --- |
| Banda con volver, Cancelar y Enviar | `Page` con `backTo` y `actions` |
| Zonas «Datos» y «Fotos y documentos» | `CollapsibleSection` |
| Número, fecha y texto con etiqueta y ayuda | `FormField` con `Input` o `Textarea` |
| Sí o no | `SegmentedControl` |
| Opciones en fila y lista desplegable | `RadioGroupField` con `layout="row"` y `NativeSelect` |
| Casillas de elegir varias | `CheckboxField` |
| Lista de catálogo en escritorio | `Autocomplete` con `header`, `status` y `multiple` |
| Lista de catálogo en el celular | `Dialog` a pantalla completa (`placement="right"`) |
| Elegidas de un catálogo | `FilterChip` |
| Fotos y documentos | `Input` de archivo oculto, `Button` e `IconButton` |
| Avisos de versión, baja y dato faltante | `Banner` |
| Se guardó, no se guardó | `notify` |
| Enviar apagado con su motivo | `DisabledReason` |
| Salir o cerrar sin enviar | `ConfirmDialog` con `useUnsavedChangesGuard` |
| Envío con avance | `api.upload` de `shared/api/httpClient` |

## Cierre local de la Etapa 1 — 2026-10-30

CW1-B, CW2-A, CW2-B, CW3, CW4, CW5 y CW6-A están implementadas con las reglas de armado de CW12, CW13-A y CW16. La
verificación final aprobó 3.559/3.559 tests del front en 327 archivos, el lint con 51/51 reglas de diseño, el build sin
advertencias y 775/775 pruebas visuales; las 30 escenas `formEntries` se compararon con sus tableros en es/en a 1440, 390 y
320. Los contratos se calificaron con los 17 cuerpos de `forms-entries-http`, de la corrida conjunta del backend que aprobó
6.548/6.548 tests y exportó las 24 cohortes.

El recorrido en el navegador integrado se hizo sobre el catálogo visual y, con un arnés local que no quedó en el repositorio,
con la API real y PostgreSQL y Azurite de prueba: la búsqueda en un catálogo de 58 lotes, una foto que viajó con el envío,
«Enviada», la planilla con «Canal: App» y el origen en D2, el panel con «Mantener las respuestas para la siguiente» y quien
sólo completa, en el celular y en inglés. Quedan la cámara de un celular real y pasar los tableros al lienzo del sistema
visual.
