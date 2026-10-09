# WhatsApp: bandeja de atención

Promueve el chat aprobado en `design-lab/whatsapp-chat`; no importa el prototipo.
API exclusiva en `api`, coordinación en hooks, componentes y página separados.

La presentación del historial está en `ChatTimeline`: el adaptador puro `lib/timeline`
ordena mensajes/operaciones y conserva su origen; los estados desconocidos no se convierten
en Sent. Usa MessageHistory/MessageBubble/MessageDateDivider, tokens globales e íconos comunes.
`useChatHistoryViewport` mantiene lectura/scroll; `useChatThreadActions`, acciones y confirmaciones.
El laboratorio de burbujas se retiró al integrar la elección; no mantener dos implementaciones.

- Una instalación comparte un WhatsApp. No hay claves ni configuración por operador.
- Permisos `whatsapp.read`, `whatsapp.send`, `whatsapp.manage`; el backend decide.
- Lectura por operador, modo compartido y revisión por versión. Manual es el default y habilita al operador. Bot se conserva como automatización sin configurar; la UI solo permite tomar Manual. Un envío iniciado puede terminar.
- Un envío conserva su requestId y texto ante una respuesta incierta. No se reenvía automáticamente. 202 significa en cola, no entregado.
- Polling cada cinco segundos mientras la pestaña está visible, sin leyenda del intervalo ni del atajo.
  Ctrl+Enter sigue enviando y Enter agrega una línea. Historial paginado sin saltar al recibir;
  borradores por conversación y guarda de salida.
- Textos es/en, UI compartida, fechas por zona del perfil. IA, contactos y plantillas se desarrollan después.
- Purpose/evento vienen del servidor. Access usa resumen es/en y etiqueta de acceso en la burbuja aprobada, sin cuerpo, secreto ni recuperación a borrador. Sin metadata, Unclassified; no inferir por palabras. El acceso por código y las invitaciones no dependen del modo.
- Fecha agrupada por día local, hora/estado fuera del cuerpo; formatos solo en shared/lib/dateTime.
- Recuperar Failed prepara un borrador vacío, también desde un mensaje confirmado; nunca envía.
- Uncertain solo lo revisa su operador con permiso y confirmación. Reviewed no equivale a Delivered.

Referencias: `../../../docs/architecture.md`, `../../../docs/design/visual-baseline.md`, `../../../../ArquitecturaBase/docs/features/whatsapp.md`.
