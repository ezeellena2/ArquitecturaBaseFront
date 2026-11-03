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
| **CW2-A · En su propia página** (elegida) | «Nueva respuesta» en `/formularios/{id}/cargar`, con el formulario en las migas. «Volver» lleva a «Formularios» o a la planilla, según de dónde vino. Cancelar y Enviar en la banda; en el celular, Enviar fijo al pie. Se valida al enviar: cada error en su pregunta y el foco en la primera; después, en vivo. Salir con algo cargado pide confirmar. Mientras sube, el botón dice «Enviando… 64 %». Desde el 2026-11-02 tiene también «Mantener las respuestas para la siguiente» ([AR2-A](#mantener-lo-cargado-en-la-página-ar2-a--2026-11-02)). |
| **CW2-B · En un panel junto a la planilla** (elegida) | «Agregar respuesta» en el encabezado de la planilla abre el panel al costado, como D2, sólo en escritorio; en el celular abre la página. Una columna; al enviar, el aviso dice el número y la planilla se relee con la respuesta marcada. «Mantener las respuestas para la siguiente» conserva todo menos los archivos. «Pantalla completa» pasa lo cargado a la página. |
| **CW3 · Las listas** | Una pregunta de catálogo es siempre una lista con búsqueda en el servidor, de 50 en 50, con los filtros fijos y por persona de quien carga. Muestra el total, la descripción de cada opción y «Mostrar 50 más». La única opción que dejan los filtros viene elegida. En el celular, la lista ocupa la pantalla, con la búsqueda arriba y «Listo» al pie al elegir varias. Sin el dato de la persona, la página lo dice y Enviar queda apagado con el motivo. |
| **CW4 · Fotos y documentos** | Miniaturas o archivos con «Agregar» y el contador; viajan con el envío, así que quitar no pide confirmación. Tipo, tamaño y cantidad se revisan antes de enviar. En el celular, «Tomar foto» primero y «Quitar» en rojo. |
| **CW5 · Después de enviar** | La página muestra «Enviada» con lo que se mandó, el número y el estado, con «Cargar otra», «Volver a Formularios» y, para quien ve respuestas, «Ver en la planilla». Una versión nueva se ofrece con «Pasar a la versión nueva», conservando lo cargado; un formulario dado de baja ya no se carga. Con «Mantener las respuestas para la siguiente» marcada no se muestra: el formulario queda listo para la siguiente ([AR2-A](#mantener-lo-cargado-en-la-página-ar2-a--2026-11-02)). |
| **CW6-A · La planilla de siempre** (elegida) | La respuesta cargada es una fila más: «Cargó» es quien la cargó y «Canal» dice App o WhatsApp, con su filtro rápido, el chip y «Limpiar todo». El detalle dice «Recibida · … · en la app, la cargó Ana Pérez» en el lugar del origen de WhatsApp. El Excel no cambia: el canal ya salía siempre. |

Cómo se arma un formulario (2026-10-30):

| Tablero | Qué define |
| --- | --- |
| CW12 · Cómo se arma un formulario | El autor decide el contenido y la app la forma, con una tabla fija por tipo de pregunta: texto corto con el ancho de su largo máximo, texto largo de 2 a 6 renglones, número y fecha angostos, «Sí \| No» sin nada marcado, hasta cinco opciones cortas en fila (si no, lista desplegable), elegir varias con una casilla por renglón y «Elegí hasta N», catálogo con la lista de CW3 y archivos con CW4. Desde el 2026-11-02, [AR1-A](#dos-anchos-ar1-a--2026-11-02) pone las casillas en columnas y las opciones en fila sin mirar su largo. |
| **CW13-A · Unidades en la etiqueta** (elegida) | La unidad la escribe el autor en la etiqueta, «Densidad (kg/ha)», igual en todos lados; el campo no la muestra adentro. |
| **CW16 · Hasta tres por renglón y zonas plegables** (elegida) | Cada zona es una grilla de tres columnas en escritorio, dos en tableta y una en el celular y en el panel, en el orden del editor; una pregunta que no entra baja de renglón, con una línea entre renglones. Una columna: número, fecha, sí o no, texto corto de hasta 30 y lista desplegable; dos: catálogo, opciones en fila y texto corto de hasta 80; el renglón entero: texto largo, texto corto de más de 80, elegir varias, fotos y documentos. Las zonas se pliegan, arrancan abiertas y, plegadas, dicen cuántas preguntas se respondieron; al enviar, una zona plegada con algo para corregir se abre sola. Desde el 2026-11-02, [AR1-A](#dos-anchos-ar1-a--2026-11-02) deja dos anchos, una columna o el renglón entero, y el panel con sus zonas. |

Quedan para etapas siguientes, con su tablero en el mismo lienzo: la vista propia de quien sólo completa (Etapa 2), corregir
(CW10-A) y anular (CW11-A) en la Etapa 3, las listas dependientes (CW7) en la Etapa 4 y los títulos de sección (CW15-B) en la
Etapa 5.

## Cómo se arma cada pregunta

Reglas elegidas por el usuario el 2026-10-30, con CW16 como referencia y las reglas fijas de CW12. CW16 manda sobre cómo están
dibujadas las preguntas en CW2-A y CW2-B.

1. **Zonas plegables.** Las preguntas van en «Datos», en el orden del editor, y las fotos y los documentos al final, en «Fotos y
   documentos». Cada zona es un `CollapsibleSection`, con la flecha en la banda; todas arrancan abiertas y, plegadas, dicen
   «N de M respondidas». Al enviar con errores, una zona plegada que los tiene se abre sola y el foco va a la primera pregunta
   con error.
2. **Grilla de hasta tres por renglón.** Tres columnas en escritorio, dos en tableta y una en el celular y en el panel de CW2-B.
   Las preguntas no se reordenan: una que no entra baja de renglón, y hay una línea entre cada renglón visible. Los renglones se
   arman con las columnas en uso y el ancho de cada pregunta se recorta a ellas, así en el celular cada pregunta es un renglón.
3. **El ancho sale del tipo; el autor no lo elige.**

   | Ocupa | Tipos de pregunta |
   | --- | --- |
   | Una columna | Número, fecha, sí o no, texto corto con largo máximo de hasta 80, elegir una y elegir de un catálogo (una o varias) |
   | El renglón entero | Texto largo, texto corto de más de 80 o sin largo máximo, elegir varias con opciones propias, foto y documento |

   Son los dos anchos de [AR1-A](#dos-anchos-ar1-a--2026-11-02) (2026-11-02): las dos columnas que tenían el catálogo, las
   opciones en fila y el texto corto de hasta 80 pasaron a una.

4. **Controles por tipo (CW12 y AR1-A).** Número y fecha, angostos: en la página, dentro de su celda y a lo ancho en una
   columna; en el panel, como en CW2-B, salvo en el celular. Sí o no, un `SegmentedControl` sin valor inicial; elegir una,
   hasta cinco opciones en fila aunque sean largas (las que no entran bajan, y en el celular van apiladas) y si no una lista
   desplegable; elegir varias, casillas en las columnas de la zona, de arriba abajo, con «hasta N» en la etiqueta; catálogo,
   la lista con búsqueda de CW3; fotos y documentos, como en CW4. El texto largo crece de 2 a 6 renglones con su largo
   máximo.
5. **Unidades en la etiqueta (CW13-A).** «Densidad (kg/ha)»: sin sufijo dentro del campo ni dato «Unidad» nuevo.
6. **Títulos de sección, en una etapa posterior (CW15-B).** Serán un elemento nuevo del editor: en la app, una zona por título;
   en WhatsApp, un subtítulo. En la Etapa 1 sólo existen «Datos» y «Fotos y documentos», y la página dibuja la lista de zonas
   que recibe (`entryZones`), así los títulos suman zonas sin rehacerla.

## Decisiones de diseño

- **Una sola forma de armar las preguntas.** `entryZones` arma las zonas, `entryQuestionSpan` da el ancho por tipo y
  `entryRows`, los renglones con las columnas en uso, sin reordenar. Las columnas salen del ancho de la zona y no del de la
  pantalla (`entryColumns`: tres desde 46 rem, dos desde 30 rem y una debajo), porque en una tableta los paneles del menú
  ocupan parte del ancho: con el panel de Formularios abierto, una tableta tiene lugar para una columna. En una columna de la
  página, número y fecha también van a lo ancho. El panel usa las mismas zonas y controles en una columna, con número y
  fecha angostos salvo en el celular, como en CW2-B, y las casillas de elegir varias en dos columnas. El largo de las
  opciones no cuenta desde AR1-A; el texto largo suma un renglón cada 100 caracteres de largo máximo, entre 2 y 6.
- **Lo cargado vive en su dueño.** El borrador es de la página o del panel: nunca va a la URL, el storage ni la caché de
  consultas. «Pantalla completa» lo pasa en memoria. Repetir un envío con las mismas respuestas conserva su identificador, así
  que un reintento tras un corte devuelve el primer número; cualquier cambio arma otro envío.
- **Los errores se leen donde se corrigen.** Un faltante o un formato marca su pregunta; si una opción se dio de baja entre
  abrir y enviar, su pregunta dice que «Lote 4» ya no está disponible; un corte deja un aviso que pide volver a tocar Enviar.
  La versión nueva y la baja llegan como aviso arriba, sin perder lo cargado.
- **Quien sólo completa no lee respuestas.** «Enviada» se arma con lo que la persona cargó y el número, estado y hora del envío;
  no pide la respuesta guardada. Las migas muestran el formulario como texto, sin enlace a una planilla que no puede abrir.
- **Las migas miden la barra.** En «Nueva respuesta» y en el detalle de una respuesta, con la barra superior de menos de
  40 rem (el celular, o una tableta con un panel del menú abierto) quedan sólo el formulario y la hoja: «Siembra / Nueva
  respuesta». Decide el ancho de la barra (`@container` en `Topbar`) y no el de la pantalla, así no quedan segmentos vacíos
  ni la hoja cortada.

## Diferencias con el dibujo

- Los textos de las listas son genéricos («58 opciones», «Ninguna opción coincide con «Ombú».») en lugar del sustantivo del
  tablero («58 lotes»): el catálogo no guarda cómo se llaman sus opciones.
- Los mensajes de validación son los del tipo de pregunta («Completá esta respuesta.», «Elegí una opción.») y no los propios
  del dibujo («Elegí un lote.», «Escribí los milímetros.»), que el formulario no tiene.
- Plegada, la banda de «Fotos y documentos» dice las fotos y archivos agregados («1 foto»), como la dibuja CW16; sin archivos,
  «0 de 1 respondidas», como las demás zonas.
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
verificación final aprobó 3.560/3.560 tests del front en 327 archivos, el lint con 51/51 reglas de diseño, el build sin
advertencias y 775/775 pruebas visuales; las 30 escenas `formEntries` se compararon con sus tableros en es/en a 1440, 390 y
320. Los contratos se calificaron con los 17 cuerpos de `forms-entries-http`, de la corrida conjunta del backend que aprobó
6.548/6.548 tests y exportó las 24 cohortes.

El recorrido en el navegador integrado se hizo sobre el catálogo visual y, con un arnés local que no quedó en el repositorio,
con la API real y PostgreSQL y Azurite de prueba: la búsqueda en un catálogo de 58 lotes, una foto que viajó con el envío,
«Enviada», la planilla con «Canal: App» y el origen en D2, el panel con «Mantener las respuestas para la siguiente» y quien
sólo completa, en el celular y en inglés. Quedan la cámara de un celular real y pasar los tableros al lienzo del sistema
visual.

## Dos anchos, AR1-A — 2026-11-02

Mirando «Registro de aplicación», el usuario preguntó si había que estandarizar los formularios: como son dinámicos, le
daba la sensación de que no iban a quedar todos bien. Ya están estandarizados: el autor decide el contenido y el orden, y la
app decide la forma por el tipo de cada pregunta. Lo que se ajusta es esa regla. En el lienzo provisorio
[Formularios desde la app](https://claude.ai/artifact/Kvbr5KFJrGT951JLiu8i4M) (fila «Formularios · armado»), AR0 dibuja tres
formularios con las reglas de hoy (uno largo con muchas preguntas de elegir, uno corto y uno con fotos y documentos) y marca
dónde quedan mal:

- renglones a medias: cuatro de nueve en el largo;
- casillas apiladas en una columna alta;
- preguntas parecidas que caen en fila o en lista desplegable según el largo de sus opciones;
- una sola zona larga;
- el panel sin zonas.

De tres opciones eligió **A**: B dejaba los tres anchos de hoy con las piezas arregladas y C volvía a una columna. Quedó
programada el mismo día; la escena `formEntries` suma a «Siembra» una pregunta de elegir varias con siete opciones para
mostrar las casillas en columnas.

- **Dos anchos.** Lo que tiene un solo valor ocupa una columna: número, fecha, sí o no, texto corto de hasta 80, elegir una
  y elegir de un catálogo, de una o de varias. Lo que necesita espacio ocupa el renglón entero: texto largo, texto corto sin
  largo máximo o de más de 80, elegir varias con opciones propias, fotos y documentos. Se van las «dos columnas» de la tabla
  de la regla 3: un catálogo, las opciones en fila y el texto corto de hasta 80 pasan a una. La grilla sigue siendo de tres
  en la compu, dos en la tableta y una en el celular y en el panel, sin reordenar.
- **Casillas en columnas.** Elegir varias reparte sus casillas en tres columnas en la compu, dos en la tableta y en el panel
  y una en el celular, de arriba abajo, con «hasta N» en la etiqueta.
- **Opciones en fila, siempre.** Elegir una con hasta cinco opciones las muestra en fila aunque sean largas; las que no
  entran siguen abajo, dentro de su columna. Con más de cinco, una lista desplegable. Deja de contar el largo de cada opción
  (los 20 caracteres de hoy).
- **El panel con sus zonas.** Junto a la planilla (CW2-B), «Datos» y «Fotos y documentos» se pliegan como en la página, en una
  columna, con las fotos y los documentos al final y no donde los puso el autor. Número y fecha siguen angostos.

Con A, los tres formularios del tablero llenan sus renglones, salvo uno en el de fotos y documentos: la cuarta pregunta de un
valor antes de un texto largo queda sola. Para ordenar un formulario largo están los títulos de sección (CW15-B), que siguen
en la Etapa 5 del plan.

## Mantener lo cargado en la página, AR2-A — 2026-11-02

Cargando «Recepción de insumos» desde «Cargar», el usuario no encontró «Mantener las respuestas para la siguiente» en la
página «Nueva respuesta»: sólo estaba en el panel junto a la planilla (CW2-B). Cargó un renglón del remito y no pudo seguir
con los otros con lo mismo. De dos tableros del lienzo provisorio (fila «La carga en la página · mantener lo cargado para la
siguiente»: A la misma casilla que el panel, B «Cargar otra con lo mismo» en «Enviada») eligió **A**. Se suma a AR1-A y quedó
programada el mismo día.

- **La misma casilla que el panel,** con el mismo texto, en la banda de «Nueva respuesta», antes de Cancelar y Enviar. En el
  celular va en el pie fijo, arriba de Enviar.
- **Marcada, el formulario sigue.** Al enviar, el aviso común dice el número («Se guardó REC-000123.») y el formulario queda
  con las respuestas para la siguiente, sin pasar por «Enviada»; el foco vuelve a la primera pregunta. Sin marcar, se ve
  «Enviada», como hoy (CW5).
- **Los archivos no se mantienen,** como en el panel: las fotos y los documentos arrancan vacíos.
- **No se recuerda:** vale mientras se carga. Al volver a entrar, la casilla arranca sin marcar y el formulario, vacío. Cada
  envío arma un pedido nuevo, así que no repite el número del anterior, y salir con algo cargado sigue pidiendo confirmación.
  Programándolo apareció que, con las mismas respuestas mantenidas y sin archivos, el envío siguiente repetía el pedido del
  anterior y recibía su número; ahora un envío que llegó suelta su pedido, en la página y en el panel, y sólo un reintento
  después de un corte lo repite.
