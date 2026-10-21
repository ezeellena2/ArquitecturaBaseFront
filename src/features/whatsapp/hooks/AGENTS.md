# WhatsApp/hooks: lecturas, dueños privados y escrituras

Coordinan TanStack Query, permisos y estado en memoria del chat. Cada hook tiene un dueño identificable y retira lo que leyó cuando ese dueño cambia; la presentación queda en `components`.

| Responsabilidad | Archivos |
|---|---|
| Lectura del hilo, sondeo, marcado de leído y retiro privado | `useChatThread` (`useVisibleChat`), `useChatReadScope`, `formReplyReadGate` |
| Modo y revisión de una salida incierta | `useChatThreadActions` |
| Posición de lectura del historial | `useChatHistoryViewport` |
| Envío de un formulario | `useFormComposer` |
| Sugerencia del asistente en Atención manual | `useAssistantSuggestion` |
| Transcripción de audios recibidos | `useChatAudioTranscription` |

## Al modificar

- **Particiones de lectura.** `chatReadScopeKey` arma la clave con actor, cultura de la UI y permisos ordenados sin duplicados (reordenarlos no cambia el contexto). La bandeja y cada conversación son particiones propias; su dueño las cancela y quita al desmontar o cambiar de contexto (`useChatReadCleanup`).
- **Hilo.** Sin `whatsapp.read` no se pide nada. La última página se sondea cada 5 s mientras la ventana está visible (al perder el foco se pausa) y se relee al volver; un 403 corta el sondeo. Las páginas anteriores usan el cursor de la última y sólo se piden explícitamente.
- **Gate de valores.** Se ven valores de respuestas, explicaciones y avisos automáticos sólo con `formrecords.read` local **y** `canReadFormRecords` verdadero en una lectura fresca de la última página. Un `false` del servidor en cualquier página niega: cancela las anteriores sin rollback, limpia todas las páginas y la última antes de publicar, y una página anterior nunca vuelve a conceder. `useSyncExternalStore` hace que la revocación se vea en el mismo render. `formValuesRevoked` distingue «se retiró» de «nunca hubo permiso».
- **403 de lectura.** Un 403 del hilo, del audio o de la transcripción (`denyRead`) retira el alcance completo de la conversación sin rollback y deja el hilo vacío con error. No confundir con el 403 local de la preparación o de una sugerencia, que sólo retira lo suyo.
- **Leído.** Se marca con la ventana visible, al final del historial, sin error y con una secuencia nueva; un fallo no se reintenta solo. Invalida la bandeja.
- **Acciones del hilo.** Las mutaciones de modo y revisión no reintentan y sólo llevan modo/revisión o `requestId`, nunca explicaciones capturadas. El aviso de un envío del asistente ya iniciado sale sólo si el 200 de Manual lo informa. Un error notifica con su texto (incierto con texto propio) y relee el hilo.
- **Viewport.** Al final del historial se sigue lo nuevo; al cargar anteriores o cambiar la altura de una burbuja (`preserveViewport`) se ancla el primer mensaje visible, aunque el sondeo agregue mensajes al mismo tiempo.
- **Formulario: habilitación.** Suma la guarda común de respuesta, los recursos i18n de la cultura del destinatario, un intento pendiente y la elegibilidad: sin cuenta, cuenta inactiva o sin formularios bloquea sólo formularios. `canOpen` se comparte con el reenvío desde el historial.
- **Formulario: listado y preparación.** Claves por actor, contacto, revisión y cultura del destinatario (la preparación agrega selección y cultura de la UI); sin reintentos ni relectura por foco, con dueño local del error. Toda selección espera la preparación: su cultura decide nombre, idioma, botón y apertura predeterminada, y ambos idiomas se cargan sin suspender el chat ni sus borradores. Hasta tenerla válida sólo se bloquea el envío del formulario. Un 409 de preparación es un bloqueo; un 403 en listado, preparación, envío o consulta oculta la metadata y retira las consultas del formulario. La preparación sin observadores se quita al cambiar de selección o desmontar.
- **Formulario: borrador.** Abrir fija cultura y revisión de la cuenta (la cultura del borrador sigue siendo la de la cuenta para las guardas) y la revisión de modo. La apertura predeterminada se escribe sólo si no fue editada (`messageEdited`); `touched` alimenta la guarda de salida. Un contexto cambiado, formulario retirado, modo, ventana, permiso o pendiente bloquean sin perder texto.
- **Formulario: envío.** El intento se congela antes del POST con funciones asíncronas y refs, fuera de MutationCache, URL, storage y logs. Un resultado incierto o `RequestConflict` conserva el intento y exige Consultar; un 404 de la consulta marca no guardado, reabre el diálogo y habilita Repetir el mismo intento. No hay POST automático. Un error definitivo libera el intento conservando el texto.
- **Retry-After.** Un 429 fija la espera (1 s a 24 h; 30 s si falta) en listado, preparación, envío, consulta y sugerencias; acciones y avisos leen el plazo vigente y al vencer no se repite nada solo.
- **Sugerencia.** El dueño (armado por `ChatThread`) combina actor, conversación, cultura, permisos, revisión de modo, fuente y revisión del destinatario. Cambiarlo reinicia sólo el estado privado con un UUID nuevo, sin remontar el editor ordinario; la disponibilidad de IA no forma parte del dueño. Con puntero se consulta por GET; sin puntero y con permiso de análisis se pide una vez (el servidor deduplica). Una operación a la vez con `AbortController`; un resultado tardío de otro dueño se descarta. Enviar congela `requestId` e IDs incluidos; incierto o 409 obliga a consultar antes de repetir. Pending se consulta cada 5 s con la pestaña visible y una falla pausa ese sondeo. Un 403 retira propuesta, intento y diálogo sin tocar la lectura del chat. Nada va a QueryCache, MutationCache, URL ni storage.
- **Transcripción.** En Manual con `whatsapp.read` (sin exigir Send) pide una vez cada audio Pending cargado, sin cuerpo. Pausar la lectura aborta el transporte y conserva las identidades intentadas; sólo un dueño nuevo (actor, conversación, cultura, permisos) las olvida. Un GET del hilo que falla de forma transitoria no cancela un POST en vuelo y un resultado tardío de otro dueño se ignora. Completar no fuerza otro GET: el sondeo del hilo observa todos los audios. Un 403 llama a `denyRead`.

## Referencias

- [Editores privados y lecturas por actor](../../../../docs/architecture.md#reglas); [contrato de mensajes](../../../../docs/guides/mensajes-y-estados.md).
- [Respuesta perdida](../../../../../ArquitecturaBase/docs/features/whatsapp.md#chat-de-atención--2026-10-02) y [decisiones del asistente y audio](../../../../docs/design/formularios-whatsapp.md#implementación-local-de-etapa-5--2026-10-17).
- Tests: `useChatThread.test.tsx`, `useChatAudioTranscription.test.tsx`, `useAssistantSuggestion.test.tsx`, `useChatThreadActions.test.tsx`; el envío de formularios se prueba en `pages/WhatsAppForms.test.tsx`.
