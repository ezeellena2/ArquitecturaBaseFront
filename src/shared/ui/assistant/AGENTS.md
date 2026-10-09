# Assistant UI: presentación compartida

Compone primitivas @assistant-ui/react con Button/IconButton y ActionTooltip comunes.
La referencia obligatoria es la composición original elegida, `assistant-ui-empty/answer-*.png`
en design-lab/history/home-assistant-comparison-2026-10-04/evidence. No sustituirla por un formulario.
El marco ocupa el área disponible; hilo de 704 px con padding de 16 px (contenido de 672 px),
bienvenida/editor centrados en vacío, sugerencias debajo y editor al pie tras el primer turno.
ComposerPrimitive.Input conserva su forma propia, label accesible, ayuda oculta y error asociado;
no FormField/Surface ni textarea rectangular dentro del editor. Radios/colores viven en index.css.
Una condición durable va junto al editor, sin panel punteado exterior. No agregar adjuntos,
regeneración o controles sin capacidad productiva para imitar una demo.
No conoce sesión, contratos HTTP, proveedor ni features. La feature aporta textos, estado confirmado,
fuentes, acciones y borrador. No incorporar HTML, Markdown arbitrario, imágenes ni tools ejecutables.
Enter agrega línea; Ctrl/Meta+Enter envían y respetan IME. Scroll no roba la posición de lectura.
No habilitar edición, branching, regeneración ni cola por añadir controles genéricos.

Fuentes: [arquitectura](../../../../docs/architecture.md), [diseño](../../../../docs/design/inicio-asistente-propuesta.md).

AssistantWorkspace compone panel plegable de 256 px y Dialog móvil compartido. AssistantConversationList usa ThreadList/Item/More nativos para una línea, grupos y menú con foco; ConversationActions contiene sólo callbacks de presentación. No gestionar aquí paginado HTTP, permisos, creación o borrado. Delete nativo del runtime no reemplaza la confirmación de la feature. La referencia elegida del panel está archivada en design-lab/history/home-assistant-conversations-2026-10-05; regresiones productivas en src/test/visual/screenshots/assistant-conversations-*.png.
