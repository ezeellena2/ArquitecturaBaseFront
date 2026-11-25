# Assistant UI: presentación compartida

Compone primitivas @assistant-ui/react con Button/IconButton y ActionTooltip comunes.
La referencia obligatoria es la composición original elegida, `assistant-ui-empty/answer-*.png`
en design-lab/history/home-assistant-comparison-2026-10-04/evidence. No sustituirla por un formulario.
El marco ocupa el área disponible; hilo de 704 px con padding de 16 px (contenido de 672 px),
bienvenida/editor centrados en vacío, sugerencias debajo y editor al pie tras el primer turno.
ComposerPrimitive.Input conserva su forma propia, label accesible, ayuda oculta y error asociado;
no FormField/Surface ni textarea rectangular dentro del editor. Radios/colores viven en index.css.
Una condición durable va junto al editor, sin panel punteado exterior. No agregar regeneración o
controles sin capacidad productiva para imitar una demo. La grabación y los adjuntos ya la tienen (IA4):
`AssistantRecorder` muestra «Grabando · 0:12» con «Descartar» y «Detener» o el audio listo con `PrivateAudio`; el
compositor suma el micrófono (`record`) a la izquierda de la flecha, el grabador arriba del texto (`recorder`) y, con un
audio listo o un archivo elegido, la flecha y Ctrl/Meta+Enter los mandan por el dueño (`onSendMedia`), aun sin texto y
fuera del runtime; `AssistantMessage.media` pone el audio y su transcripción, o el archivo, dentro de la burbuja. Grabar
es de `useAudioRecorder`. `AssistantAttach` es el clip (`attach`, a la izquierda del micrófono) con su `input` de archivo
oculto, que el dueño también abre desde una sugerencia (`inputRef`); con un archivo elegido el clip se esconde
(`showButton`). `AssistantFile` es el archivo con su nombre y lo que lo describe, que escribe el dueño: en el editor
(`attachment`, arriba del texto) con la X, apagada mientras viaja, y en un mensaje sin ella. El motivo de uno que no
sirve va en `error`, debajo del editor. Una regla de index.css para un botón de ícono no puede depender sólo de
`data-slot=button`: habilitado, el disparador de su tooltip lo cambia por `tooltip-trigger` (el micrófono, el clip, la
flecha y la X cubren los dos). En el celular los cuatro se tocan en 44 px y el dibujo sigue de 30. El foco no cae al
`body`: al elegir el archivo el dueño lo pasa a la X (`removeRef`) y al quitarlo, de vuelta al clip (`buttonRef`).
No conoce sesión, contratos HTTP, proveedor ni features. La feature aporta textos, estado confirmado,
fuentes, acciones y borrador. No incorporar HTML, Markdown arbitrario, imágenes ni tools ejecutables.
Enter agrega línea; Ctrl/Meta+Enter envían y respetan IME. Scroll no roba la posición de lectura.
Mientras la pregunta viaja (`sending`), el aro de `IconButton pending` reemplaza la flecha; «Enviando…» lo aporta la feature en `sendLabel`.
No habilitar edición, branching, regeneración ni cola por añadir controles genéricos.

Fuentes: [arquitectura](../../../../docs/architecture.md), [diseño](../../../../docs/design/inicio-asistente-propuesta.md).

AssistantWorkspace compone panel plegable de 256 px y Dialog móvil compartido. AssistantConversationList usa ThreadList/Item/More nativos para una línea, grupos y menú con foco; ConversationActions contiene sólo callbacks de presentación. No gestionar aquí paginado HTTP, permisos, creación o borrado. Delete nativo del runtime no reemplaza la confirmación de la feature. La referencia elegida del panel está archivada en design-lab/history/home-assistant-conversations-2026-10-05; regresiones productivas en src/test/visual/screenshots/assistant-conversations-*.png.

`AssistantProposalCard` (IA1-A) es la propuesta bajo la respuesta que la trajo: la banda con el tipo y las acciones, el nombre y el cuerpo que aporta el módulo: sus datos en `DataList` y una colección en una tabla dentro de `assistant-proposal-table`, los dos de borde a borde, y `footer`, el pie del tono de la banda que la cierra (TC1-B y TC2-B, 2026-11-25); reemplazada o creada, se pliega a una línea con su estado y, si hay, el enlace a lo creado. Las fuentes verificadas de una respuesta usan la misma tarjeta (TC4-A). Usa `Badge` y `Button`, no conoce sesión, HTTP ni módulos, y está en el catálogo local abierta y plegada.
