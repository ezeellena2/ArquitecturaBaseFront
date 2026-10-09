# Inteligencia artificial: instalación y consultas asistidas

Feature independiente de settings y WhatsApp. Lectura ai.read; editar, probar y recuperar exige también ai.manage. Ruta lazy /configuracion/ia, en Administración → Configuración. Información del negocio usa /configuracion/negocio, ai.business.read y ai.business.manage; editor y guardado propios. El asistente de consultas requiere ai.assistant.use y se compone desde app; nunca ofrece generación genérica ni credenciales de Codex.

- Componer Page y tres Surface con UI compartida y namespace artificialIntelligence es/en. No importar el bootstrap del laboratorio.
- Información del negocio usa cinco Surface y businessInformation es/en; conserva textos anteriores para revisión y agrega ubicación, horarios/fechas especiales y FAQ tipadas. Nombre y al menos un hecho confirmado; preguntas sin respuesta no cuentan. Conflicto combina grupos atómicos (ubicación, horario, FAQ); incertidumbre congela cuerpo/UUID hasta recuperar comprobante o repetir explícitamente el pedido idéntico. Hechos confirmados en QueryCache de sesión, borrador sólo en editor. Nunca llamar LLM desde este formulario.
- Ubicación usa Autocomplete compartido y BusinessPlaceSearch: POST autenticado a Places por la API, espera 400 ms/mínimo 3 caracteres, abort/ignorancia de respuestas superadas y cooldown sin retries. Etiquetas sólo en memoria, fuera de QueryCache/MutationCache/storage; excepción para no cachear contenido Google. Guardar sólo PlaceId y datos manuales. Dirección editada elimina selección; URL derivada nunca entra en PUT. Puntos antiguos legibles, sin modal de coordenadas. Atribución Google Maps y errores en Toaster único. [Configuración](../../../../ArquitecturaBase/docs/guides/configurar-google-places.md).
- Para conexión, catálogo y prueba, QueryCache sólo guarda metadatos. Las operaciones con claves son funciones asíncronas del editor, sin MutationCache ni reintentos automáticos; nunca URL, storage, logs o serialización del borrador para diagnóstico. El historial del asistente usa el caché privado confirmado descrito abajo.
- La clave candidata se conserva ante errores y se limpia al confirmar, descartar, cambiar proveedor, perder permisos o desmontar. Abort no demuestra rollback ni evita cobro.
- Modelos se consultan con la guardada al entrar o explícitamente con la candidata. Lista sólo en el editor; cambiar proveedor/clave/revisión cancela e invalida, ignorando respuestas tardías. No elegir por defecto ni borrar un modelo fuera de lista. NativeSelect con ID/nombre y alternativa Input manual (autocomplete off/nombre técnico). Un catálogo no acredita compatibilidad ni cuota: la prueba usa el modelo elegido. Clave candidata usa new-password/nombre técnico; sin configurar ambos vacíos. Verificar también el gestor de contraseñas real.
- Guardado incierto congela cuerpo/UUID. Consultar comprobante propio; 404 no prueba fallo, reintento explícito idéntico. Conflicto exige relectura/revisión. No enviar una clave candidata a otro proveedor al rebasar.
- La prueba no guarda, tiene cooldown y validez del borrador/revisión; ignorar respuestas tardías. Mensajes y acciones siguen el contrato compartido.
- TDD de reglas/interacción; fixtures inventados. Playwright 1440/390/320 es/en y regresiones. No agregar llamadas facturables ni claves reales a tests.

Fuentes: [regla funcional](../../../../ArquitecturaBase/docs/features/inteligencia-artificial.md), [seguridad/operación](../../../../ArquitecturaBase/docs/guides/configurar-ia.md), [mensajes](../../../docs/guides/mensajes-y-estados.md), [diseño](../../../docs/design/visual-baseline.md).

## Inicio autenticado con consultas

La composición vive en app/AuthenticatedHome; assistant sólo se monta con installedFeatures y ai.assistant.use.
ExternalStoreRuntime adapta turnos confirmados en QueryCache; PostgreSQL es autoridad. Sin edición/regeneración
implícita, Markdown, transporte propio ni herramientas en navegador. El borrador/pedido congelado permanecen
en el editor, fuera de MutationCache/storage/URL. GET/polling no generan. Una aceptación incierta conserva
UUID/body; 404 no prueba rollback y sólo la acción explícita repite el body idéntico. Cancelar/eliminar usan
la confirmación durable; navegación no cancela por desmontaje. Contenido blocked se retira del cache.
Todos los textos usan assistant es/en y fechas el perfil/formatters comunes; cooldown usa useCountdown.
La UI compartida está en shared/ui/assistant. Las fuentes sólo abren destinos lógicos admitidos con permiso.

El panel interno usa useAssistantConversationList con usePagination/QueryCache privado (cuenta, idioma y revisión de permisos), 20 filas por defecto y GET acotados. conversationGroups recibe ahora UTC y zona del perfil; se recalcula al abrir/reanudar, sin timer paralelo. RuntimeProvider aísla la API experimental de threadList fijada en 0.15.23; callbacks sólo piden la navegación autorizada de AiAssistantPage. Nueva conversación no escribe hasta la aceptación; list/detail son autoridad de títulos. El borrado confirmado retira título y turnos del caché y luego invalida la página.
