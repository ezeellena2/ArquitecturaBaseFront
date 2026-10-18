# Mapa de instrucciones del front

El catálogo de IA del 2026-10-04 amplía `src/features/artificial-intelligence`: modelos por
proveedor/clave/revisión sólo en el editor, con NativeSelect, entrada manual y prueba separada.

Relevamiento del 2026-10-02. Hay **35 ámbitos** con `AGENTS.md` y su `CLAUDE.md`, incluidos el laboratorio de chat y el workflow de despliegue conjunto. Las propuestas de colores para campo y contraste de mensajes se retiraron al integrar sus elecciones. Cada enlace abre la guía del ámbito; el archivo de Claude importa esa misma fuente con `@AGENTS.md`.

## Cómo entrar a un desarrollo

Leé la raíz y después las guías de las carpetas que contienen los archivos que vas a cambiar, de mayor a menor alcance. Si una operación cruza áreas, leé cada área y la guía funcional enlazada. Una guía local complementa la raíz: no redefine la arquitectura.

Las reglas completas están en [architecture.md](architecture.md), las premisas de pantallas en [premisas-de-desarrollo.md](guides/premisas-de-desarrollo.md) y el contrato visual en [visual-baseline.md](design/visual-baseline.md). Antes había un ámbito en la raíz; las reglas generales de CLAUDE.md se conservaron en la guía canónica para compartirlas con cualquier agente.

Los mensajes tienen un [contrato transversal único](guides/mensajes-y-estados.md), heredado por
todas las áreas. El [plan de adopción](plans/2026-09-30-unificacion-mensajes.md) distingue la regla
vigente de la migración y los controles automáticos pendientes.

## Carpetas con guía propia

| Ámbito | Para qué sirve |
|---|---|
| [`./`](../AGENTS.md) | Reglas generales del front, lectura previa y entrada a las guías canónicas. |
| [`.github/workflows/`](../.github/workflows/AGENTS.md) | Solicita el despliegue conjunto al backend; limita el token entre repositorios y distingue solicitud de publicación completada. |
| [`docs/`](AGENTS.md) | Arquitectura del front, premisas de pantallas, contrato de mensajes, fundamento visual, planes de adopción y mapa local. Sigue la auditoría compartida del backend para consolidar decisiones y retirar planes cumplidos. |
| [`design-lab/whatsapp-chat/`](../design-lab/whatsapp-chat/AGENTS.md) | Maquetas pendientes de IA asistida, contactos, plantillas, conexión y permisos con datos ficticios. El editor del negocio y su evolución guiada se promovieron al producto; `?screen=negocio-guiado` redirige al catálogo de la página real, con datos simulados. Fuentes previas preservadas como referencia, sin importarlas en producto. [Diseño y evidencia](design/informacion-del-negocio-guiada.md). Fuera del build productivo. |
| [`design-lab/whatsapp-chat/libraries/`](../design-lab/whatsapp-chat/libraries/AGENTS.md) | Tercera ronda: WhatsAppChatPage real y sólo formas Actuales/Redondeadas, misma paleta y controles, datos en memoria. Las dos rondas de bibliotecas se rechazaron y quedan como procedencia; aviso original de Syncfusion visible en su entrada. Dependencias propias, fuera del router/build productivos. [Maquetas y límites](design/whatsapp-bibliotecas-propuesta.md). |
| [`src/`](../src/AGENTS.md) | `app` compone la aplicación; `auth` maneja sesión y permisos; `layouts` contiene el caparazón; `features` agrupa producto; `shared` comparte mecanismos y UI; `locales` traduce; `test` contiene el arnés. |
| [`src/app/`](../src/app/AGENTS.md) | Monta providers, router y árbol de rutas; RouterProvider de DOM confirma la salida voluntaria a login. |
| [`src/auth/`](../src/auth/AGENTS.md) | Contiene configuración y proveedor OIDC, sesión actual, renovación, guards, permisos, nombre de cuenta y preferencia de idioma. |
| [`src/features/`](../src/features/AGENTS.md) | Cada área contiene páginas, componentes, API y errores propios. |
| [`src/features/auth/`](../src/features/auth/AGENTS.md) | Compone la landing pública aprobada con PublicLanding, ingreso, registro, código, enlace de un solo uso y callback. |
| [`src/features/errors/`](../src/features/errors/AGENTS.md) | Contiene la página de ruta inexistente; falta de permiso es compartida en shared/ui/ForbiddenPage. |
| [`src/features/home/`](../src/features/home/AGENTS.md) | `DashboardPage` conserva el inicio base; app/AuthenticatedHome compone el asistente según módulo/permisos. |
| [`src/features/profile/`](../src/features/profile/AGENTS.md) | Muestra medios de ingreso y datos del perfil. |
| [`src/features/roles/`](../src/features/roles/AGENTS.md) | Contiene catálogo/listado, alta y edición en ruta propia y selector de permisos por área. El botón global abre/pliega áreas del catálogo sin modificar selección, incluso en Admin y con filtros. |
| [`src/features/settings/`](../src/features/settings/AGENTS.md) | Muestra y modifica los ajustes funcionales publicados por el backend. |
| [`src/features/users/`](../src/features/users/AGENTS.md) | Muestra listado, filtros y conteos, alta, edición de roles, estado de medios de ingreso e invitaciones. |
| [`src/features/whatsapp/`](../src/features/whatsapp/AGENTS.md) | Chat productivo: API, queries/lectura, acciones y viewport separados; adaptador puro de línea de tiempo por instante/día local y metadata segura de acceso/Flow, UI común, borradores y envío/revisión seguros; C1–C5 integra selección, recuperación propia e historial durable; R1–R3, proyección histórica y retirada de valores privados en todas las páginas. |
| [`src/layouts/`](../src/layouts/AGENTS.md) | Define layouts, barra, menú, sidebar y migas; conserva la transición del cierre hasta confirmar login, sin arrastrar la ruta privada a otra cuenta. |
| [`src/locales/`](../src/locales/AGENTS.md) | Los JSON de `es` y `en` comparten un namespace por módulo. |
| [`src/shared/`](../src/shared/AGENTS.md) | Contiene cliente y contratos HTTP comunes, hooks, utilidades, i18n y sistema de UI. |
| [`src/shared/api/`](../src/shared/api/AGENTS.md) | `httpClient` agrega token e idioma, coordina renovación y transforma ProblemDetails en `ApiError`. |
| [`src/shared/hooks/`](../src/shared/hooks/AGENTS.md) | Agrupa estado de URL, paginado, filtros, foco, migas, cuenta regresiva, guardas de salida, visibilidad de lecturas y el ámbito privado que retiene miniaturas de respuestas. |
| [`src/shared/i18n/`](../src/shared/i18n/AGENTS.md) | Configura i18next, carga namespaces y aplica idioma, preferencia local y `lang` del documento. |
| [`src/shared/lib/`](../src/shared/lib/AGENTS.md) | Contiene formato de fechas por zona, nombres de países, `cn` y derivación de apariencia con contraste. |
| [`src/shared/ui/`](../src/shared/ui/AGENTS.md) | Reúne primitivas generadas por shadcn y componentes propios de formularios, tablas, diálogos, navegación y presentación. Delimita zonas con Surface/FilterBar y define el alternado común de filas. MessageCard/attachment y RadioGroupField cards son presentación; EmbeddedPreview no decide permisos ni caducidad; Surface comparte acciones de encabezado, FormField etiquetas decoradas y ConfirmDialog foco alternativo. |
| [`src/shared/ui/assistant/`](../src/shared/ui/assistant/AGENTS.md) | Primitivas assistant-ui con UI común; no conoce API/sesión/features. Hilo, compositor y mensajes confirmados aportados por la feature. |
| [`src/test/`](../src/test/AGENTS.md) | `setup.ts` prepara Vitest/jsdom y MSW; `mocks` contiene servidor y contratos simulados; `utils` renderiza con providers y router de la app. fixtures/forms-http y fixtures/whatsapp-forms-http conservan cuerpos reales sintéticos con hashes; los consumidores de contrato también leen salidas nuevas del productor. |
| [`src/test/architecture/`](../src/test/architecture/AGENTS.md) | Verifica con TypeScript independencia entre features y de shared, límites de uso del sistema visual y montaje único del Toaster. |
| [`src/test/visual/`](../src/test/visual/AGENTS.md) | Catálogo local, fixtures de rutas y Playwright: readiness de HTML e imports transformados de módulos/traducciones con Vite y preparación independiente del editor, canje OIDC, perfil y shell antes de verificar comportamiento, capturas, medidas, scroll, teclado y cambio de cuenta con OIDC real y HTTP ficticio. No entra en rutas ni entradas del build productivo. Preguntas de catálogo: selección, reemplazo, permisos y foco en es/en y escritorio/móvil con store simulado. |

## Carpetas cubiertas por su ámbito padre

El [laboratorio de Inicio](../design-lab/home-assistant/AGENTS.md) conserva la procedencia del chat;
el [panel interno de conversaciones archivado](../design-lab/history/home-assistant-conversations-2026-10-05/AGENTS.md) conserva la propuesta elegida y promovida el 2026-10-05. La implementación vive en la feature IA y shared/ui/assistant. `chosen` conserva el formulario
rechazado y no acredita aprobación visual;
el comparador cerrado y sus fuentes/evidencia se preservan en `design-lab/history/home-assistant-comparison-2026-10-04`.
Ese archivo histórico no es una entrada activa ni depende del bundle productivo.

El laboratorio de WhatsApp también conserva la propuesta pendiente
[`?screen=ubicacion-lugar`](design/ubicacion-por-lugar.md): búsqueda externa por nombre y
enlace de ficha, sin cambios en el contrato o guardado productivos.

| Ámbito nuevo | Responsabilidad |
| --- | --- |
| [src/features/artificial-intelligence](../src/features/artificial-intelligence/AGENTS.md) | Conexión, catálogo/prueba y editor guiado del negocio; asistente autorizado de consultas con historial privado y recuperación durable. Catálogo/Places sólo en el editor; claves fuera de caches/storage; asistente adapta estado confirmado y conserva UUID/body en aceptación incierta. |
| [src/features/business-forms](../src/features/business-forms/AGENTS.md) | Modelo/baseline, cliente HTTP y guard de las seis rutas de borrador, hooks de lecturas por actor/permisos/cultura y editor en memoria. Intento congelado fuera de MutationCache, recuperación original y paths ligados al cuerpo. Router, menú, listado, editor bilingüe y preview A–E; revisión explícita por idioma y por identidad con diferencias retenidas, tabla/foco conservados y quita accesible. P1 comprueba con nextVersionNumber requerido y P2 acepta/consulta el intento propio y liga diagnósticos por identidad/idioma, con ticket/UUID/cuerpo privados y202 separado de Published; recarga GET desde proyección propia y listado con versión activa separada. P3 pide idioma explícito y URL efímera fuera de caché; activación y preview oficiales comprobadas por el coordinador; presupuesto HTTP y foco del diagnóstico verificados, con límites en el diseño elegido. |

Las páginas, API, componentes y utilidades internas de una feature siguen su guía de área. Los componentes individuales de UI siguen shared/ui; los idiomas siguen locales. Los documentos de diseño y las recetas siguen docs/AGENTS.md.

No se crean pares en `bin`, `obj`, `node_modules`, `dist`, `artifacts`, archivos individuales ni carpetas vacías. Un subámbito nuevo se justifica por una responsabilidad o riesgo que el padre no explica suficientemente.

## Mantenimiento

Cuando agregues un área, adaptador o cambio de responsabilidad, actualizá su guía y este mapa en el mismo desarrollo. Seguí la [receta de instrucciones por carpeta](../../ArquitecturaBase/docs/guides/instrucciones-por-carpeta.md). La enumeración es un punto de entrada, no un inventario de cada método.

WhatsApp delimita C1–C5 en su AGENTS.md: contratos de elegibilidad/form-messages, mensaje/UUID privado por chat, recuperación outgoing existente y metadata Flow explícita en Timeline. API, sesión, cola e historial están integrados y verificados con cuerpos HTTP reales; el recorrido SPA/API/PostgreSQL/Redis aislado usa identidad de pruebas, fuente neutral de formularios y proveedor Meta de pruebas. chatFormFixtures/formPublicationReads mantienen los escenarios simulados de navegador. R1–R3 consume la proyección histórica y retira valores de DOM/QueryCache ante revocación, incluidas páginas anteriores. El coordinador confirmó publicación/preview, entrega, captura de seis tipos y recarga en el piloto real del 2026-10-11. Esto no convierte los puertos neutrales del QA móvil en fuente/sink BusinessForms real. El [estado del diseño](design/formularios-whatsapp.md) conserva los pendientes trasladados a Etapa 2 y el límite de la prueba decimal física.

El ámbito [BusinessForms](../src/features/business-forms/AGENTS.md) también contiene Catálogos Manual K1–K3: rutas y panel /catalogos con permisos propios, guard DTO nullable, metadatos bilingües, delta y movimientos en memoria entre páginas, un Guardar con revisión y adopción explícita ante409. `fixtures/catalogs-http` conserva la cohorte del productor con procedencia automática; `catalogManual.spec` cubre las rutas en es/en a1440/390/320 con dobles, y el QA aislado acredita API/PostgreSQL/Redis por separado. Filters/K4 conecta el editor y preview al DTO vigente: persona explícita paginada, comprobación antes de guardar y sampleUserId fuera de la configuración. Comparte borrador/revisión/adopción con Manual; origen/estado viven en la URL y sus conteos proceden del servidor. Fuente inválida bloquea preview/escritura conservando los filtros editables. Sus cohortes actuales verifican tamaños/SHA256 del provenance automático, separadas de Manual histórico; catalogFilters.spec cubre es/en a1440/390/320 con transporte simulado. K6/K7 y el piloto Meta se completaron el 2026-10-15; el estado vigente está en el diseño elegido.

K6 amplía el mismo ámbito BusinessForms: choice con source.catalog o opciones manuales, guard/binding por identidad, reemplazo de fuente confirmado y paths de validación ligados al cuerpo. La preview no resuelve opciones. CatalogQuestionSelector compone los controles comunes y lecturas por actor/permisos/cultura, con selección inválida visible/deshabilitada y confirmación de cambio; los contratos HTTP y el recorrido con K7/Meta quedaron verificados en su cierre conjunto del 2026-10-15.

K7 amplía WhatsApp dentro de su ámbito existente: preparación de catálogos por destinatario y referencias históricas en el chat, rechazo seguro y reenvío manual. El productor exporta cuerpos intactos a fixtures/whatsapp-catalogs-http; el consumidor valida DTOs y procedencia. chatCatalogs.spec usa las rutas/componentes reales con transporte simulado, sin Meta.


Actualización K7, 2026-10-12: K6/K7 quedaron implementados y verificados localmente en ese corte; el piloto Meta se completó el 2026-10-15 y los pendientes heredados siguen delimitados en el diseño elegido. Las cohortes HTTP actuales se exportan desde el backend. El ámbito visual compila sólo sus entradas en artefactos ignorados, conserva CSS de desarrollo y sirve sin proxy a la API real; el build productivo no incorpora el laboratorio. Fuente: `src/test/visual/AGENTS.md`.

Actualización de catálogos, 2026-10-13: el ámbito `src/features/business-forms/AGENTS.md` incluye baja/reactivación en el Guardar común, revisión sólo por 409 y conservación de metadata/foco al buscar personas. `src/test/visual/AGENTS.md` cubre el nuevo recorrido `catalogReview.spec.ts`, con el mismo arnés y sin proveedores reales.

Archivos privados: `shared/api` conserva el transporte binario; `shared/hooks` su alcance y cancelación; `shared/ui` miniaturas, imagen privada y visor; `features/whatsapp` la adaptación de las respuestas históricas (guías locales respectivas).

Etapa 3 amplía BusinessForms con planilla/detalle/exportación y alcance privado de lecturas. App compone el panel mediante el contexto neutral layouts/formsNavigation y una lectura dinámica al abrirlo; ResponseWorkspaceLayout delimita los datos privados a las rutas de respuestas; shared/api agrega descarga POST, shared/hooks navegación atómica y shared/ui FormRecordFiles reutiliza F4. Sus guías locales y src/test/visual/AGENTS.md conservan los límites; la regla funcional está en formularios.md del backend.

G1 amplía el mismo editor BusinessForms con reglas e historial de revisiones independientes. api/rules valida configuración y opciones de condición autorizadas por RulesManage; el guard de salida existente contempla ambos borradores. El idioma original obligatorio se aplica sólo a los mensajes nuevos de la Etapa4.

G5 agrega workflow privado en BusinessForms: historial y recuperación explícita sobre el mismo RunId, con capacidades del servidor y RulesManage. El detalle conserva el dueño único de avisos. El hook neutral de migas acepta el nombre confirmado del padre.

G3/G4 amplía BusinessForms con bandeja/cantidad de tareas y decisión por revisión, separando metadata autorizada de los valores privados. G2 agrega diseño con revisión independiente, preview de ejemplo y descarga de copias fijas por API; los blobs del navegador se destruyen al cambiar el dueño o perder lectura. G6 adapta FormAction en WhatsApp con autor automático, documento y redacción privada antes de QueryCache. Las guías de ambas features conservan sus límites, sin imports entre áreas.

El cierre local del 2026-10-16 verificó seis cohortes y 67 capturas de Etapa 4; su [evidencia histórica](../../ArquitecturaBase/docs/features/formularios.md#verificación-de-la-etapa-4--2026-10-16) conserva el alcance de aquel visor PDF. El helper neutral `src/test/httpCohort.ts` reúne ahora diecinueve familias activas, incluidas las seis heredadas afectadas: 19 cohortes, 295 capturas —64 de WhatsApp— y 53 fuentes, con bytes y SHA idénticos al front. El [cierre actual](../../ArquitecturaBase/docs/features/formularios.md#cierre-local-de-la-etapa-5-y-del-review-de-la-etapa-4) acredita backend, front completo, visual y navegador. El [piloto físico del 2026-10-17](../../ArquitecturaBase/docs/features/formularios.md#piloto-de-aprobación-y-pdf--2026-10-17) ya confirmó español/foto/aprobación/PDF; sus [casos restantes](../../ArquitecturaBase/docs/plans/verificacion-y-produccion.md#formularios-piloto-de-aprobación-y-pdf) y el [piloto de IA/audio](../../ArquitecturaBase/docs/plans/verificacion-y-produccion.md#formularios-piloto-del-asistente-y-audios) siguen separados.

D2 (versión79) permanece en el ámbito BusinessForms: panel y rutas anidadas sobre planilla/Por aprobar, momentos de acciones capturadas, decisión única y descarga privada compartida por menú/PDF. App compone las rutas; shared/ui agrega Tabs y selección/clic opcionales de DataTable, conservando semántica y controles de cada celda. Las guías respectivas fijan propiedad, permisos, foco y cancelación.

Sugerencias entre formularios: el ámbito BusinessForms incluye FormSuggestionsSection, api/suggestions y el modelo puro de mapeos/condiciones. Es configuración privada con permiso formsuggestions.manage y revisión/historial propios; sólo comparte el guard de salida del editor. No depende de las features de WhatsApp ni IA y no reconstruye el origen de respuestas desde configuración vigente.

H1–H3 amplía el mismo ámbito WhatsApp: api/assistant valida propuesta, puntero y recibo compartido; useAssistantSuggestion conserva el preview y la selección sólo en el editor activo. ChatComposer conserva el borrador de la página y reutiliza FormComposer para confirmar prellenados. El gate de lectura existente retira las explicaciones históricas privadas junto con los valores de respuestas; no hay imports de BusinessForms o IA.

H4 reutiliza el ámbito business-forms para revisión humana de catálogos: api/catalogResponse y catalogs fijan el contrato, useCatalogDraftEditor conserva el dueño y CatalogFiltersEditorPage compone K4. src/test/httpCohort y su guía de test cubren la cohorte forms-catalog-proposals-http sin adaptar sus bytes.

H6 conserva el ámbito WhatsApp: api/audio y useChatAudioTranscription coordinan el POST idempotente Manual y los bytes privados; ChatAudio presenta estados/transcripción dentro de la burbuja. PrivateAudio es un elemento común sin rutas/credenciales, con URL Blob revocada al salir. Los contratos HTTP y el escenario visual se califican en el cierre conjunto.

H7 pertenece a business-forms (consulta agregada, descarte y semilla del alta); app compone la ruta Manage y layouts su entrada fija. No incorpora un área ni un proveedor nuevos.
