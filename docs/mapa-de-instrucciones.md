# Mapa de instrucciones del front

Relevamiento del 2026-10-02, reorganizado el 2026-10-21. Hay **44 ámbitos** con `AGENTS.md` y su `CLAUDE.md`, incluidos el laboratorio de chat y el workflow de despliegue conjunto. Cada enlace abre la guía del ámbito; el archivo de Claude importa esa misma fuente con `@AGENTS.md`.

Codex combina las guías desde la raíz hasta la carpeta en la que trabaja con un límite de 32 KiB y corta lo que sobra. Por eso cada cadena se mantiene por debajo de 30 KB: una guía de área es un índice corto y el detalle vive en la guía de la subcarpeta donde está el código ([receta](../../ArquitecturaBase/docs/guides/instrucciones-por-carpeta.md#tamaño-de-las-guías)).


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
| [`src/app/`](../src/app/AGENTS.md) | Monta providers, router y rutas; MF1 compone el conteo global de pendientes por contexto neutral y las entradas OR, sin lecturas del menú dinámico anterior. RouterProvider de DOM confirma la salida voluntaria a login; compone la sección opcional de Datos por contrato neutral. |
| [`src/auth/`](../src/auth/AGENTS.md) | Contiene configuración y proveedor OIDC, sesión actual, renovación, guards y requisito de permisos compartido entre rutas y menú, nombre de cuenta y preferencia de idioma. |
| [`src/features/`](../src/features/AGENTS.md) | Cada área contiene páginas, componentes, API y errores propios. |
| [`src/features/artificial-intelligence/`](../src/features/artificial-intelligence/AGENTS.md) | Conexión, catálogo/prueba y editor guiado del negocio; asistente autorizado de consultas con historial privado y recuperación durable. Catálogo/Places sólo en el editor; claves fuera de caches/storage; asistente adapta estado confirmado y conserva UUID/body en aceptación incierta. |
| [`src/features/auth/`](../src/features/auth/AGENTS.md) | Compone la landing pública aprobada con PublicLanding, ingreso, registro, código, enlace de un solo uso y callback. |
| [`src/features/business-forms/`](../src/features/business-forms/AGENTS.md) | Índice de Formularios: alcance, lectura obligatoria e invariantes transversales (permisos propios, claves por actor/permisos/cultura, datos privados en memoria, revisión y 409, idioma original, contratos estrictos, tableros). |
| [`src/features/business-forms/api/`](../src/features/business-forms/api/AGENTS.md) | Clientes HTTP y guards zod por familia; tests que consumen las cohortes exportadas mediante `httpCohort`. |
| [`src/features/business-forms/hooks/`](../src/features/business-forms/hooks/AGENTS.md) | Lecturas y limpieza, Overview con acceso OR, tareas por formulario, borrador con UUID y recuperación, publicación, catálogos y dueño reutilizable del detalle, anclaje full y workspace privado de respuestas; también la lógica pura del borrador y los catálogos. |
| [`src/features/business-forms/components/`](../src/features/business-forms/components/AGENTS.md) | Piezas por tema: editor y vista previa, publicación, ciclo de vida, catálogos, planilla y Excel, contenido de detalle e historia única de aprobación, PDF fijado a su acción con mini vista privada, reglas y sugerencias. |
| [`src/features/business-forms/pages/`](../src/features/business-forms/pages/AGENTS.md) | Rutas de formularios, catálogos y /datos-de-personas: permisos, URL, guardas, diálogos y foco; D2 y full comparten dueño y retorno privado. |
| [`src/features/errors/`](../src/features/errors/AGENTS.md) | Contiene la página de ruta inexistente; falta de permiso es compartida en shared/ui/ForbiddenPage. |
| [`src/features/home/`](../src/features/home/AGENTS.md) | `DashboardPage` conserva el inicio base; app/AuthenticatedHome compone el asistente según módulo/permisos. |
| [`src/features/profile/`](../src/features/profile/AGENTS.md) | Muestra medios de ingreso y datos del perfil. |
| [`src/features/roles/`](../src/features/roles/AGENTS.md) | Contiene catálogo/listado, alta y edición en ruta propia y selector de permisos por área. El botón global abre/pliega áreas del catálogo sin modificar selección, incluso en Admin y con filtros. |
| [`src/features/settings/`](../src/features/settings/AGENTS.md) | Muestra y modifica los ajustes funcionales publicados por el backend. |
| [`src/features/users/`](../src/features/users/AGENTS.md) | Muestra listado, filtros y conteos, alta, roles, medios e invitaciones; aloja una sección opcional de datos por contrato neutral y coordina su guardado separado. |
| [`src/features/whatsapp/`](../src/features/whatsapp/AGENTS.md) | Índice del chat: permisos, modo, frontera, página (bandeja, `?conversacion=`, borradores por conversación) y entrada a las guías de `api`, `lib`, `hooks` y `components`. |
| [`src/features/whatsapp/api/`](../src/features/whatsapp/api/AGENTS.md) | Contratos HTTP cerrados del hilo, modo, texto, formularios, preparación, respuestas, sugerencias y audio; consumidores de cohortes exportadas. |
| [`src/features/whatsapp/lib/`](../src/features/whatsapp/lib/AGENTS.md) | Reglas puras: línea de tiempo y autoría por origen, guarda común de respuesta, intentos congelados, valores históricos y retiro privado. |
| [`src/features/whatsapp/hooks/`](../src/features/whatsapp/hooks/AGENTS.md) | Lecturas por actor, cultura y permisos, gate de valores con revocación del servidor, envío de formularios con consulta antes de repetir, sugerencias y transcripción. |
| [`src/features/whatsapp/components/`](../src/features/whatsapp/components/AGENTS.md) | Cabecera y modo, historial y tarjetas (formulario, respuesta, aviso automático, audio), compositor y diálogo de formularios y sugerencias. |
| [`src/layouts/`](../src/layouts/AGENTS.md) | Define layouts, barra, menú, sidebar y migas; conserva la transición del cierre hasta confirmar login, sin arrastrar la ruta privada a otra cuenta. |
| [`src/layouts/components/`](../src/layouts/components/AGENTS.md) | Sidebar con paneles de Administración, WhatsApp y Formularios, permisos sin saltos, barra contraída y cajón; migas con hoja de la pantalla; menú de usuario. |
| [`src/locales/`](../src/locales/AGENTS.md) | Los JSON de `es` y `en` comparten un namespace por módulo. |
| [`src/shared/`](../src/shared/AGENTS.md) | Contiene cliente y contratos HTTP comunes, hooks, utilidades, i18n y sistema de UI. |
| [`src/shared/api/`](../src/shared/api/AGENTS.md) | `httpClient` agrega token e idioma, coordina renovación y transforma ProblemDetails en `ApiError`. |
| [`src/shared/hooks/`](../src/shared/hooks/AGENTS.md) | Agrupa URL, paginado, filtros, foco, migas, temporizadores, guardas, visibilidad y miniaturas privadas; define el contrato neutral de la sección opcional de datos de cuenta. |
| [`src/shared/i18n/`](../src/shared/i18n/AGENTS.md) | Configura i18next, carga namespaces y aplica idioma, preferencia local y `lang` del documento. |
| [`src/shared/lib/`](../src/shared/lib/AGENTS.md) | Contiene formato de fechas por zona, nombres de países, `cn` y derivación de apariencia con contraste. |
| [`src/shared/ui/`](../src/shared/ui/AGENTS.md) | Reúne primitivas generadas por shadcn y componentes propios de formularios, tablas, diálogos, navegación y presentación. Delimita zonas con Surface/FilterBar y define el alternado común de filas. MessageCard/attachment y RadioGroupField cards son presentación; EmbeddedPreview no decide permisos ni caducidad; Surface comparte acciones de encabezado, FormField etiquetas decoradas y ConfirmDialog foco alternativo. |
| [`src/shared/ui/assistant/`](../src/shared/ui/assistant/AGENTS.md) | Primitivas assistant-ui con UI común; no conoce API/sesión/features. Hilo, compositor y mensajes confirmados aportados por la feature. |
| [`src/test/`](../src/test/AGENTS.md) | `setup.ts` prepara Vitest/jsdom y MSW; `mocks` contiene servidor y contratos simulados; `utils` renderiza con providers y router de la app. fixtures/forms-http y fixtures/whatsapp-forms-http conservan cuerpos reales sintéticos con hashes; los consumidores de contrato también leen salidas nuevas del productor. |
| [`src/test/architecture/`](../src/test/architecture/AGENTS.md) | Verifica con TypeScript independencia entre features y de shared, límites de uso del sistema visual y montaje único del Toaster. |
| [`src/test/visual/`](../src/test/visual/AGENTS.md) | Catálogo y Playwright con componentes reales y dobles explícitos: servidor compilado en 5178 sin API, preparación antes de afirmar, orígenes externos estrictos, capturas solo con decisión autorizada y escenas por área. |

## Carpetas cubiertas por su ámbito padre

El [laboratorio de Inicio](../design-lab/home-assistant/AGENTS.md) conserva la procedencia del chat;
el [panel interno de conversaciones archivado](../design-lab/history/home-assistant-conversations-2026-10-05/AGENTS.md) conserva la propuesta elegida y promovida el 2026-10-05. La implementación vive en la feature IA y shared/ui/assistant. [`chosen`](../design-lab/home-assistant/chosen/AGENTS.md) conserva el formulario
rechazado y no acredita aprobación visual;
el comparador cerrado y sus fuentes/evidencia se preservan en [`design-lab/history/home-assistant-comparison-2026-10-04`](../design-lab/history/home-assistant-comparison-2026-10-04/AGENTS.md).
Ese archivo histórico no es una entrada activa ni depende del bundle productivo.

El laboratorio de WhatsApp también conserva la propuesta pendiente
[`?screen=ubicacion-lugar`](design/ubicacion-por-lugar.md): búsqueda externa por nombre y
enlace de ficha, sin cambios en el contrato o guardado productivos.

Las páginas, API, componentes y utilidades internas de una feature siguen su guía de área cuando no tienen guía propia: `whatsapp/pages`, `artificial-intelligence/{hooks,pages}`, `auth/pages` y `users/components` siguen la de su área. Los componentes individuales de UI siguen shared/ui; los idiomas siguen locales. Los documentos de diseño y las recetas siguen docs/AGENTS.md.

No se crean pares en `bin`, `obj`, `node_modules`, `dist`, `artifacts`, archivos individuales ni carpetas vacías. Un subámbito nuevo se justifica por una responsabilidad o riesgo que el padre no explica suficientemente.

## Mantenimiento

Cuando agregues un área, adaptador o cambio de responsabilidad, actualizá su guía y este mapa en el mismo desarrollo. Seguí la [receta de instrucciones por carpeta](../../ArquitecturaBase/docs/guides/instrucciones-por-carpeta.md). La enumeración es un punto de entrada, no un inventario de cada método.

Una guía no es la bitácora de las etapas: al cerrar una etapa, su regla se integra en la guía de la carpeta que corresponde, y su historia queda en la fuente funcional y en Git. Si una cadena se acerca a 30 KB, la guía de área se divide por subcarpeta.
