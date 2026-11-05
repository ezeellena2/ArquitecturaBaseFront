# La IA arma formularios y catálogos: tableros elegidos

Fecha: **2026-11-04**, con los tableros dibujados el 2026-11-03. Estado: **por programar**. El alcance y las decisiones
están en el [plan](../../../ArquitecturaBase/docs/plans/2026-11-04-ia-arma-formularios-y-catalogos.md) y las reglas, en el
[ADR 0024](../../../ArquitecturaBase/docs/decisions/0024-ia-arma-formularios-y-catalogos.md). Las pantallas, los textos y los
estados salen de acá.

Origen: el lienzo provisorio [Formularios desde la app](https://claude.ai/artifact/Kvbr5KFJrGT951JLiu8i4M), filas «Armar con la
IA · 0» a «· 3» (versión 73). Se armó aparte porque el [Sistema visual](https://claude.ai/artifact/HPbmDPLnr8JZ9TxevtTqJJ) no se
abre desde la cuenta de Claude Code: se volvió a probar el 2026-11-04 y dio «artifact not found». Los tableros elegidos pasan a
ese lienzo cuando se pueda abrir, y mientras tanto vale el provisorio. Como el lienzo es privado y puede cambiar fuera de Git,
este documento congela lo elegido.

## Cómo leer los tableros

- Están dibujados a mano en escritorio, con los colores de `src/index.css`. Cada parte se arma con su pieza de
  `src/shared/ui` (tabla abajo), no copiando el dibujo.
- Los círculos numerados son notas del tablero, explicadas en la columna de la derecha, como «Para comparar» en las opciones.
  No son UI.
- Los datos son ficticios: Ana Pérez, «Control de carga de camiones» (CCC) desde el PDF de una planilla en papel, «Parte de
  lluvias» (LLU) dictado por WhatsApp, el catálogo «Contratistas» desde un Excel de 86 filas, «Mi empresa» y los CUIT.
- IA2 muestra el borrador de la primera propuesta de IA1-A, con «Tara», antes del ajuste que la cambia por «Kilos netos».

## Las elecciones

El usuario eligió el 2026-11-04 las dos recomendadas: **IA1-A**, la propuesta en una tarjeta en el hilo de Inicio, e
**IA3-A**, un resumen con botones por WhatsApp. Descartó IA1-B, la propuesta en un panel al costado del hilo con las solapas
«Preguntas» y «Cómo queda», e IA3-B, crear el borrador en cuanto entiende el pedido y mandar el enlace, como hace hoy H4.
IA0, IA2 e IA4 tenían un solo concepto y valen con las elegidas.

| Tablero | Qué define |
| --- | --- |
| **IA0 · El recorrido** | Cinco pasos: la persona **pide**, en Inicio o por WhatsApp, con un texto, un archivo o un audio; la IA **entiende** que es armar y mira los nombres y los campos de lo que existe; **propone**, y se ajusta conversando; la persona **crea el borrador** con «Crear borrador» o «Crear catálogo», y **publica** en el editor de siempre, o aprueba y activa el catálogo. Dice quién puede, qué ve la IA y lo que no hace: publicar, activar, importar, mandar algo a alguien, cambiar lo que existe, crear dos veces la misma propuesta o una vieja después de un ajuste. La tabla de dónde se pide: el chat de Inicio y el asistente de WhatsApp también arman; Diseñar formularios, Catálogos y Formularios que faltan suman «Armar con la IA»; Documentos recibidos (DOC6) usa la misma propuesta y el mismo «Crear borrador». |
| **IA1-A · La propuesta en el hilo, con «Ver cómo queda»** (elegida) | El pedido muestra su archivo con el nombre, el tipo, las páginas o las filas y el tamaño. La respuesta cuenta lo que decidió («Usé el catálogo Campos, que ya existe; la empresa de transporte quedó como texto. Si querés, armo también un catálogo de transportistas.») y trae debajo la tarjeta: la banda «Formulario» con «Ver cómo queda» y «Crear borrador»; el nombre con el prefijo y la cantidad («CCC · 11 preguntas»), y cada pregunta numerada con su tipo, sus opciones o su catálogo («Campos, ya existe») y «Obligatoria». La de un catálogo lleva la banda «Catálogo» con «Crear catálogo»; el nombre con el tipo de valor, los campos y las filas («Texto · 2 campos · 86 filas»); el código, la opción y cada campo con su tipo y su columna («CUIT · columna A»), y una tabla con tres filas de muestra y «y 83 filas más». Cada ajuste («Sacá la tara y agregá los kilos netos.») trae otra tarjeta: la anterior se pliega a una línea con «Reemplazada» y sin botones, la pregunta que cambió dice «Nueva» y lo quitado lo cuenta la respuesta. «Ver cómo queda» abre el diálogo «Cómo queda · Control de carga de camiones», con la pantalla de WhatsApp de la vista previa del editor, «Cerrar» y «Crear borrador». Con una propuesta en el hilo, el editor del chat dice «Pedí un cambio o hacé otra consulta…». |
| **IA2 · Del chat al editor** | «Crear borrador» abre el editor de siempre, en Diseñar formularios: «Borrador», «Guardar borrador» y «Publicar en WhatsApp»; el nombre, el prefijo y el texto del botón; las preguntas cargadas y la vista previa. Lo demás queda como en un formulario nuevo, y el editor no suma nada por venir de la IA. «Crear catálogo» abre el catálogo inactivo con la banda «Propuesta del asistente» de H4, que dice quién lo pidió y dónde («La pidió Ana Pérez en el chat de Inicio el 3 nov 2026.»), con «Descartar propuesta» y «Aprobar y activar», los campos cargados y, sin opciones todavía, «Importar opciones» abierto con el archivo del pedido ya revisado («86 altas · 0 cambios · 0 errores»), «Cancelar» e «Importar». Lo que no cambia: un solo guardado, y dos toques no crean dos; un nombre o un prefijo en uso lo dice la tarjeta, sin crear nada; la importación es la de siempre, y desde WhatsApp el enlace abre el mismo editor, pasando por el ingreso si no hay sesión. Después de crear, la tarjeta queda plegada con «Borrador creado» y «Abrir el borrador», y no se vuelve a crear. |
| **IA4 · Las piezas** | **El editor del chat:** el clip y el micrófono, a la izquierda de la flecha. Sin permiso para diseñar formularios ni para administrar catálogos, el clip no aparece; el micrófono, sí. Vacío, dice «Preguntale al sistema o pedile que arme un formulario…». **Con un archivo:** uno por mensaje (PDF, foto JPEG o PNG, Word `.docx` o Excel `.xlsx` o `.csv`), con los topes de los documentos; se quita con la X. **Grabando:** «Grabando · 0:12», con «Descartar» y «Detener» y el tope de los audios de WhatsApp. **El audio, listo:** se escucha antes de mandarlo y se le puede sumar un texto («Agregá un texto, si querés…»). **Un archivo que no se lee** (formato viejo, con macros, con contraseña o más grande que el tope): lo dice debajo del editor («No se puede leer un Excel viejo (.xls). Guardalo como .xlsx o .csv.») y no se manda. **En el hilo:** el audio queda en el mensaje con la transcripción en gris debajo, que es lo que lee la IA. Un pedido que no queda claro pregunta y espera; importar en un catálogo que existe trae la tarjeta «Importación», cuyo botón abre la importación de ese catálogo con el archivo. Si se pide uno que ya existe, lo dice con «Abrir Recepción de insumos» y no lo cambia; sin permiso, lo dice y no arma nada. **Las entradas:** «Armar con la IA», antes de «Nuevo formulario» y de «Nuevo catálogo», abre Inicio en una conversación nueva con «Armame un formulario para » o «Armame un catálogo de » ya escrito; en Formularios que faltan va antes de «Crear formulario» en cada tema y escribe «Armame un formulario para registrar remitos de combustible». **Inicio vacío** suma las sugerencias «Armame un formulario para…» y «Armame un catálogo con una planilla». |
| **IA3-A · WhatsApp: el resumen con «Crear borrador»** (elegida) | El asistente contesta «Te propongo este formulario:» con el nombre en negrita y el prefijo («Parte de lluvias · LLU»), hasta 10 preguntas numeradas con su tipo («3. Milímetros · número»; con más, «y N preguntas más»), «¿Lo armo?» y dos botones, «Crear borrador» y «Cambiar algo». «Cambiar algo» contesta «Decime qué cambio, por escrito o con un audio.» y vuelve con otro resumen y los mismos botones. Crear contesta «Listo: armé el borrador Parte de lluvias. Revisalo y publicalo desde la app:» con el enlace. Un catálogo va en un párrafo («Te propongo el catálogo Contratistas: el código es el CUIT, cada opción la razón social y los campos Rubro y Zona. Son 86 filas. ¿Lo armo?») con «Crear catálogo» y «Cambiar algo», y el de personas con filtros (H4) pasa a contestar así. Otros casos: sin permiso, lo dice y no arma nada; un formulario que existe, «Por ahora no cambio formularios que ya existen. Lo podés cambiar desde la app:» con su enlace; un archivo que no se lee, como en DOC4; el botón de una propuesta anterior, «Esa propuesta ya cambió. Usá los botones de la última.», sin crear nada, y un pedido que no queda claro pregunta qué hacer (importar en un catálogo que existe trae el resumen con «Revisar la importación»). Todo va en el idioma de la persona. |

## Qué entra en cada etapa

| Etapa del plan | De los tableros |
| --- | --- |
| 1 · Texto y audio, proponer y crear | La tarjeta de IA1-A para un formulario y para un catálogo sin planilla, con «Ver cómo queda», «Reemplazada» y «Borrador creado»; IA2 sin la importación; IA3-A, también para H4; de IA4, el micrófono, la grabación y el audio con su transcripción, las entradas, Inicio vacío con «Armame un formulario para…» y los casos sin permiso y de uno que ya existe. |
| 2 · Planillas | El clip con Excel y CSV, en el chat y por WhatsApp, y la sugerencia «Armame un catálogo con una planilla» de Inicio vacío; la tarjeta de un catálogo con sus columnas y sus filas de muestra; «Crear catálogo» con «Importar opciones» abierto; el pedido que no queda claro con una planilla y la tarjeta «Importación» con «Revisar la importación»; el archivo que no se lee. |
| 3 · Documentos | PDF, fotos y Word en el clip y por WhatsApp, sobre la lectura del ADR 0022, y DOC6 con la misma propuesta. |

## Lo que se fijó al registrar

Los tableros no lo dicen; se resolvió con la opción más simple que cumple el plan:

- Cada sugerencia de Inicio vacío sigue a su permiso: «Armame un formulario para…», con el de diseñar formularios, y «Armame
  un catálogo con una planilla», con el de administrar catálogos.
- Un catálogo sin planilla (Etapa 1): «Crear catálogo» abre el catálogo inactivo con la banda y sin la importación.
- El pedido empezado de «Armar con la IA» viaja en el estado de la navegación, nunca en la dirección: Inicio sólo lleva
  `?conversacion=<id>` ([URL de Inicio](inicio-asistente-propuesta.md#url-memoria-foco-y-tamaños)).
- En el celular, con las piezas de hoy: la tarjeta ocupa el ancho del hilo y «Ver cómo queda» usa el `Dialog` a pantalla
  completa (`mobileFullscreen`).
- Las esperas y los errores siguen el contrato común: mientras la IA arma, los estados del turno de hoy; al crear, el botón
  con su carga; un nombre o un prefijo en uso lo dice la tarjeta (IA2), y lo demás, el aviso común.
- El micrófono aparece cuando la instalación oye lo que graba el navegador (WebM o MP4) y hay almacenamiento privado (el
  `audio` del bootstrap) y el navegador puede grabar; sin el permiso del micrófono, lo dice debajo del editor.
- Al mandar un audio, la flecha muestra la espera mientras sube, se transcribe y viaja el turno; si no se entendió, el motivo
  va debajo del editor y el audio queda para mandarlo otra vez.
- En el hilo, el audio de un mensaje se oye con «Escuchar», que baja la grabación sólo cuando la persona la quiere oír, como
  los audios del chat de WhatsApp; la transcripción en gris va siempre debajo.

## Lo que cambia de lo que hay

Al programar cada etapa se reescribe lo que hoy dice lo contrario:

- El [fundamento visual de Inicio](visual-baseline.md#inicio-composición-assistant-ui-corregida--2026-10-04) dice «Sin
  adjuntos ni regeneración»: suma el clip y el micrófono de IA4, y la regeneración sigue afuera.
- [Assistant UI](../../src/shared/ui/assistant/AGENTS.md) pide no agregar adjuntos sin capacidad productiva: los adjuntos y la
  grabación pasan a tenerla, y la tarjeta llega por un punto de extensión, sin nombrar el módulo.
- En la [IA](../../../ArquitecturaBase/docs/features/inteligencia-artificial.md), Inicio deja de sólo consultar.
- En los [catálogos propuestos (H4)](../../../ArquitecturaBase/docs/features/formularios.md#catálogos-propuestos--etapa-5-h4),
  el catálogo de personas se crea con el botón. La banda «Propuesta del asistente», que hoy dice «La pidió … por WhatsApp el
  …», nombra el canal («en el chat de Inicio») y aparece también en un catálogo Manual.

## Correspondencia con `shared/ui`

| En el tablero | Pieza |
| --- | --- |
| Hilo, mensajes y editor del chat | `AssistantThread`, `AssistantMessage` y `AssistantComposer` de `shared/ui/assistant` |
| Sugerencias de Inicio vacío | `AssistantSuggestions` |
| Conversaciones de la izquierda | `AssistantWorkspace` con `AssistantConversationList`, como hoy |
| La tarjeta de la propuesta, abierta, «Reemplazada» y «Borrador creado» | Pieza nueva de `shared/ui/assistant`, con `Badge` y `Button`; el contenido lo aporta el módulo de formularios |
| Filas de muestra de una planilla | `Table`, como la revisión de `CatalogImportDialog` |
| «Ver cómo queda» | `Dialog` con la vista previa del editor (`FormPreview`, sobre `PhonePreview`), que aporta el módulo por el punto de extensión |
| Adjuntar: el clip, el archivo en el editor y en el mensaje, el que no se lee | Pieza nueva de `shared/ui/assistant`, con `IconButton` |
| Grabar: «Grabando», «Detener», «Descartar» y el audio listo | Pieza nueva de `shared/ui/assistant`; se escucha con `PrivateAudio` |
| «Armar con la IA» | `Button` en las acciones de `Page` y en cada tema de Formularios que faltan |
| La banda «Propuesta del asistente» | La de H4: `Banner`, el estado en `Page.status` y «Descartar propuesta» y «Aprobar y activar» en las acciones |
| «Importar opciones» con el archivo | `CatalogImportDialog` |

Las tres piezas nuevas (adjuntar, grabar y la tarjeta) se suman al catálogo local del
[estándar visual](../guides/estandar-visual.md#catálogo-y-revisión-con-navegador) con sus variantes.
