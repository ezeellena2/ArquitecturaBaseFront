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
- Recuperar Failed de texto prepara el borrador, también desde un mensaje confirmado; nunca envía. Failed de Flow conserva su card y exige un envío nuevo explícito desde Enviar formulario; no se reutiliza como texto.
- Uncertain solo lo revisa su operador con permiso y confirmación. Reviewed no equivale a Delivered.

Referencias: `../../../docs/architecture.md`, `../../../docs/design/visual-baseline.md`, `../../../../ArquitecturaBase/docs/features/whatsapp.md`.

## Formularios C1–C5

`api/forms` consume GET chats/{id}/forms (envelope page + cultura/revisión del destinatario) y POST chats/{id}/form-messages; GET outgoing/{requestId} es la recuperación existente. Nombre y botón final son mapas es/en sellados; se lee la cultura exacta del destinatario, sin fallback. Son contratos del área, sin importaciones de business-forms ni otra cola. Cuenta vinculada/elegibilidad vienen del servidor; el chat no crea vínculos. Sin whatsapp.send conserva lectura y oculta ambas acciones de envío. GET del historial conserva whatsapp.read; sin whatsapp.send el servidor devuelve linkedAccount y formEligibility null y el encabezado no infiere falta de vínculo. Con envío autorizado muestra la cuenta; email sólo con users.read y «sin correo» sólo cuando se puede leer ese dato. Un correo oculto no deshabilita un formulario elegible. Sin cuenta activa/formulario elegible bloquea sólo formularios; correo nulo no impide una cuenta elegible. Modo Manual, ventana24h y operaciones pendientes siguen las guardas comunes de texto.

FormComposer conserva selección de versión fuera de la página/búsqueda y mensaje privado por conversación. El mensaje inicial y CTA usan el idioma de la cuenta, con ambos recursos cargados sin suspender el chat ni sus borradores durante la carga; hasta tener el idioma del destinatario se bloquea sólo el envío del formulario; cambiar contexto no traduce ni pierde texto editado. Validar texto obligatorio y1024 sin recortarlo; diferenciar Abrir formulario del botón final. Paginado, campos, RadioGroupField cards y devolución de foco usan las piezas compartidas.

Congelar UUID/definitionId/versionId/revisión de modo/revisión opaca de destinatario/mensaje fuera de MutationCache, storage, URL y logs. No enviar cuenta o cultura como autoridad. El recibo reconoce el mensaje normalizado por Trim sin modificar el intento congelado. POST202 valida recoveryPath contra la ruta propia; no requiere Location ni sigue URLs del cuerpo. RequestConflict conserva el intento y exige consultar su GET antes de repetirlo. Respuesta incierta conserva exactamente ese intento, requiere GET y permite repetición explícita tras404; si se había cerrado, ese404 reabre el diálogo existente con el intento congelado y Repetir. No hay POST automático.429 respeta Retry-After tanto en envío como en consultas/listado, sin repetir pedidos al vencer la espera; acciones y notificaciones consultan el plazo actual. Contexto cambiado, formulario retirado, modo/ventana/permisos/pendiente bloquean sin perder texto.403 oculta metadata y retira consultas propias; errores de guard no retienen issues/payloads de Zod.

Historial conserva kind del servidor: Flow sólo si viene explícito, con metadata validada; nunca inferir por el cuerpo ni sustituir Access. MessageCard es presentación compartida dentro de MessageBubble.202 sigue en cola; Reviewed no es entregado; Uncertain se revisa mediante la acción existente del propio operador. API, sesión, cola e historial están integrados: Pending, confirmado, Failed y Uncertain conservan la metadata sellada, incluso tras recarga. El consumidor se prueba con cuerpos HTTP reales sin modificar y el recorrido SPA/API/PostgreSQL/Redis aislado verifica selección, envío, recarga, cultura es/en del destinatario con interfaz española, sólo lectura y estados. Su identidad de pruebas, fuente neutral de formularios y proveedor Meta de pruebas no acreditan entrega real. El preview de FlowReply en bandeja y contacto es un texto fijo traducido del servidor, sin valores ni un discriminante nuevo en el DTO. R1–R3 está integrado: el guard consume DTO y cuerpos HTTP actuales, Number visible se copia literalmente y las etiquetas/opciones son históricas. Decimales conservan la escala del string recibido; false, cero, ausencia y DateOnly no se confunden. CanReadFormRecords del servidor manda: al revocar, se cancelan páginas anteriores sin rollback y se retiran valores de todo QueryCache antes de publicar la proyección sin acceso. El piloto real del coordinador confirmó envío, captura de seis tipos y recarga; el QA móvil aislado usa identidad y puertos neutrales. Los faltantes de la revisión y el decimal físico están delimitados en [el diseño](../../../docs/design/formularios-whatsapp.md); los pendientes menores se trasladaron a Etapa 2 por decisión del usuario al cerrar Etapa 1, conservando sus límites de comprobación.

K7: la selección sellada indica HasCatalogQuestions; el diálogo lee la preparación del servidor por contacto/versión, cultura y revisión del destinatario. Conserva texto ante bloqueos y no pone opciones en el POST. Ofertas en QueryCache por actor/contexto/cultura UI, retiradas al perder permiso o salir del contexto. La tarjeta consume referencia histórica (texto/detalle/catálogo), nunca busca el catálogo actual. Rechazo por baja Manual nombra sólo la pregunta; Mandar de nuevo abre el compositor y exige confirmar otro envío, respetando permisos, modo y ventana.
