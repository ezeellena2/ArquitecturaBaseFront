# WhatsApp/api: contratos HTTP del chat

Funciones que llaman a `/api/whatsapp/chats/...` con `shared/api/httpClient` y guards zod que convierten cada respuesta en un tipo del área o la rechazan. Nadie fuera de esta carpeta arma rutas ni interpreta cuerpos.

| Responsabilidad | Archivos |
|---|---|
| Bandeja, hilo, lectura, modo, texto, consulta y revisión de una salida | `chat` (`chatKey`) |
| Formularios para enviar: listado, preparación, envío y recuperación | `forms`, `formMetadata` |
| Respuestas de formularios recibidas | `formReplies` |
| Sugerencias del asistente | `assistant` |
| Audio recibido: transcripción y bytes | `audio` |
| Consumidores de cuerpos exportados por el backend | `*HttpContract.test.ts`, `httpContract.test.ts`, `formRepliesHttp.test.ts` |

## Al modificar

- **Contratos cerrados.** Los cuerpos nuevos se validan con `z.strictObject`: una clave desconocida es un error genérico (`Unsupported chat response`, `UnsupportedChatFormResponse`) que no retiene issues ni payload. Un contrato todavía no publicado se ajusta junto con el backend, sin alias ni compatibilidad.
- **Propio del área.** `formMetadata` es el único decoder de la metadata sellada y lo comparten formularios, asistente y línea de tiempo. No se importa `business-forms` ni otra feature.
- **Hilo.** `getThread` rechaza el hilo si audio, disponibilidad del asistente (incluido `notInstalled`), puntero de sugerencia, `origin` (Conversation, FormAction, Assistant), explicación o respuestas rápidas no cumplen su contrato; después aplica `readThreadFormReplies`, de modo que lo privado se retira antes de llegar a QueryCache.
- **Modo.** `changeMode` manda `expectedRevision` y sólo acepta un 200 con el mismo modo, revisión igual o siguiente y `assistantSendInProgress` tal como lo observó el servidor. Bot y Manage no existen.
- **Textos sellados.** Nombre y botón final son mapas con sólo `es`/`en`, al menos un texto no blanco y secundario ausente o vacío admitido. La metadata histórica exige además nombre no blanco en su cultura efectiva.
- **Selector y preparación.** El listado trae página más cultura y revisión del destinatario (ambas presentes si hay ítems). La preparación trae la cultura completa del formulario, la revisión real de la cuenta, conteos por pregunta de catálogo y problemas seguros (código, catálogo, cantidad inválida); nunca opciones. `canSend` equivale a no tener problemas. Las opciones no viajan en el POST.
- **Recibo de formulario.** `parseFormOutgoing` exige Flow, `origin` Conversation, sin explicación ni respuestas rápidas, el mismo `requestId`, definición y versión, y operador igual al actor. Si la apertura no se editó, el cuerpo debe ser un texto no blanco (la predeterminada del servidor, sin compararla con la vista previa); si se editó, igual a su `trim`. `recoveryPath` es nulo o la ruta propia `outgoing/{requestId}`; el POST lo exige. No se sigue `Location` ni URLs del cuerpo. Los avisos FormAction no usan este contrato.
- **Sugerencias.** El puntero es `{requestId, sourceMessageId, state}`. Cada estado es coherente: Ready trae propuesta, Sent trae recibo y los demás ninguno; la respuesta debe corresponder a la fuente o pedido consultado. `proposalId` es requerido nullable: `null` es una sugerencia configurada sin atribución de IA. El recibo Sent conserva al operador que lo inició (no se compara con el actor) y una ruta de recuperación propia o nula. GET usa `no-store`; enviar manda sólo `requestId` e `includedFieldIds`. El recibo manual ordinario sigue siendo Conversation con `assistant: null`.
- **Respuestas recibidas.** `readFormReply` discrimina por estado. Completed trae `recordId`, número `PREFIJO-dígitos` como texto (sin conversión numérica) y valores históricos tipados (decimal como texto canónico, fecha sin hora, opción con su etiqueta histórica y, si es de catálogo, nombre y detalle; un par value/valueType opcional y cerrado se conserva sin mostrarlo); multiChoice conserva lista ordenada, null para una respuesta omitida y [] explícito; hasta 20 opciones distintas, sin archivos. Los demás estados no traen registro, número ni valores. Archivos: metadatos cerrados (tipo, tamaño, miniatura sólo en fotos), sin URLs ni claves. Sin permiso, los valores se descartan antes de validar: nunca se inspecciona un privado mal formado. Con permiso, un Completed sin valores es una proyección inválida. `formReply` sólo se lee en un `FlowReply` entrante fuera de Access, y el `body` de un `FlowReply` siempre queda nulo.
- **Audio.** `Message.audio` es requerido nullable y no existe en salidas. `reasonCode` admite sólo `tooLarge`, nulo o ausencia, sin normalizar. La transcripción es un POST con `AbortSignal`; los bytes usan `api.blob` (`no-store`) y deben ser `audio/ogg` no vacío.
- **Cuerpos reales.** Los consumidores leen las cohortes de `src/test/httpCohort` (formularios, catálogos, avisos, asistente, audio y archivos) sin modificar bytes ni serializar DTOs a mano, y se ejecutan después del export conjunto. Un cuerpo real con proveedor simulado no acredita Meta, el modelo ni la entrega.

## Referencias

- Contrato funcional: [chat](../../../../../ArquitecturaBase/docs/features/whatsapp.md#chat-de-atención--2026-10-02), [formularios](../../../../../ArquitecturaBase/docs/features/whatsapp.md#envío-durable-de-formularios), [respuestas](../../../../../ArquitecturaBase/docs/features/whatsapp.md#recepción-de-respuestas-de-flow), [catálogos](../../../../../ArquitecturaBase/docs/features/whatsapp.md#catálogos-de-formularios--k7), [sugerencias](../../../../../ArquitecturaBase/docs/features/whatsapp.md#sugerencias-al-operador-y-explicación--etapa-5) y [audio](../../../../../ArquitecturaBase/docs/features/whatsapp.md#audio-recibido--etapa-5-h6).
- [Cohortes y variables de entrada](../../../test/AGENTS.md); [idioma preparado](../../../../../ArquitecturaBase/docs/features/formularios.md#idioma-original-y-traducción-opcional--2026-10-19).
- Tests: `chatMode.test.ts`, `forms.test.ts`, `formReplies.test.ts`, `assistant.test.ts`, `audio.test.ts`; `httpContract.test.ts` incluye la cuenta en inglés con formulario sólo original.
