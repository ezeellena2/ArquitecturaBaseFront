# WhatsApp/lib: reglas puras del chat

Funciones sin React, red ni caché que deciden cómo se lee el historial, cuándo se puede responder y qué se congela al enviar. Las usan `hooks` y `components`; los tipos de entrada vienen de `api`.

| Responsabilidad | Archivos |
|---|---|
| Línea de tiempo e historial | `timeline`, `history`, `messagePresentation` |
| Cuándo se puede responder | `replyAvailability` |
| Envío de formularios | `formSendSession`, `formMessage` |
| Envío de una sugerencia | `assistantSendSession` |
| Respuestas de formularios | `formReplyPresentation`, `formReplyValue` |
| Retiro de datos privados | `threadPrivacy` |

## Al modificar

- **Sin efectos.** Nada de `fetch`, QueryClient, hooks ni reloj: el instante y la función de traducción llegan por parámetro (`replyDisabledReason(..., now)`, `accessSummary(t, ...)`). Un cambio de regla se prueba acá con un test unitario antes de tocar la pantalla.
- **La línea de tiempo adapta, no corrige.** `buildTimeline` mezcla mensajes confirmados y salidas pendientes por instante, con desempate por la clave estable `message:`/`outgoing:`; deduplicar y persistir es de las consultas (`mergeMessages` reemplaza por id y conserva páginas anteriores). Los estados de entrega salen de una tabla cerrada: lo desconocido es `Unknown`, nunca `Sent`; `Reviewed` no es entregado.
- **El autor viene del origen.** Saliente con `origin` Assistant es «Asistente»; FormAction o sin operador, «Automático»; con operador, el operador real. Nunca se deduce del modo actual, del texto ni de un operador ausente. Un entrante no tiene autor ni estado de entrega.
- **El tipo es el del servidor.** La tarjeta de formulario existe sólo con `kind` Flow y metadata sellada válida (`readFormMetadata`), igual en la salida pendiente y en el mensaje confirmado, también tras recargar; nunca se infiere por el cuerpo. `FlowReply` no muestra `body`. Access anula cuerpo, tarjetas, explicación y opciones: se presenta con `accessSummary` (tipo desconocido → resumen genérico), sin deducir el propósito por palabras; sin metadata es Unclassified. Las opciones de respuesta rápida sólo salen de `Interactive` (no Access) o de una salida `QuickReplies`. Las salidas son Business.
- **Día del perfil.** `groupTimelineByDay` agrupa por día calendario en la zona del perfil con `calendarDateInZone`; los formatos viven en `shared/lib/dateTime`.
- **Una sola guarda de respuesta.** `replyDisabledReason` decide en orden: sin Send, modo distinto de Manual, ventana de 24 h vencida desde `lastInboundAtUtc`, sin número y salida sin resolver (`isUnresolved`: Pending, Sending o Uncertain). Texto, formulario y sugerencia la comparten; el análisis de una sugerencia la evalúa sin salidas.
- **Formulario congelado.** `freezeFormMessage` fija UUID, definición, versión, revisión de modo y revisión opaca del destinatario. `message` es `null` si el operador no editó la apertura (el servidor elige la predeterminada en su cultura) y su texto sin recortar si la editó. No viaja cuenta ni cultura como autoridad. `recipientChanged` compara revisión y cultura del destinatario sin tocar el texto; `selectedVersionChanged` detecta una versión reemplazada aun fuera de la página visible.
- `formOptionName` muestra el nombre en la cultura pedida o, si está en blanco, el otro idioma: es presentación y no decide el idioma de envío.
- `formMessageIssue`: texto obligatorio (con `trim`) y hasta 1024 caracteres contados sin recortar.
- `freezeAssistantSend` congela sólo `requestId` e IDs incluidos en el orden de la propuesta, filtrados contra lo ofrecido; nunca valores. Destildar todo es válido.
- **Respuestas históricas.** `toFormReplyPresentation` copia el número como texto literal y las filas autorizadas; los demás estados no tienen valores ni número. `Unavailable` es el respaldo de una proyección inválida, no un estado del servidor. `formatFormReplyValue` muestra decimal, fecha sin hora y sí/no con `shared/lib/typedValue` (el formato de las pantallas de formularios: decimal agrupado con su escala, fecha numérica), distingue cero, `false` y ausencia, usa etiquetas históricas (varias separadas por coma, con catálogo y detalle; sin proyectar el escalar tipado) y devuelve `null` ante un valor inválido para que la tarjeta no muestre contenido crudo.
- **Retiro privado.** `withoutFormReplyValues` quita valores de respuestas, cuerpo de `FlowReply` y de avisos FormAction (mensajes y salidas) y la explicación del asistente; conserva origen, autor y textos ordinarios. Se aplica a cada página, no sólo a la última.

## Referencias

- [Historial de mensajes](../../../../docs/guides/premisas-de-desarrollo.md#historial-de-mensajes-2026-10-02) y [propósito Access/Business](../../../../../ArquitecturaBase/docs/features/whatsapp.md#propósito-migración-y-recorridos--2026-10-02).
- [Estados y respuesta perdida](../../../../../ArquitecturaBase/docs/features/whatsapp.md#chat-de-atención--2026-10-02); [envío de formularios](../../../../../ArquitecturaBase/docs/features/whatsapp.md#envío-durable-de-formularios).
- Tests: `timeline.test.ts`, `history.test.ts`, `formSendSession.test.ts`, `formMessage.test.ts`, `formReplyValue.test.ts`, `formReplyPresentation.test.ts`, `assistantPrivacy.test.ts`, `assistantSendSession.test.ts`.
