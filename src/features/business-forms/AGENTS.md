# Formularios: diseño, publicación, catálogos y respuestas

Área independiente de WhatsApp e IA. Diseña formularios bilingües y los publica, administra su ciclo de vida y los catálogos, y muestra respuestas, aprobaciones, reglas, PDF, sugerencias y formularios que faltan. Enviar desde el chat y mostrar la respuesta en la conversación pertenece a WhatsApp, que no importa esta feature.

Lectura obligatoria: la [regla funcional del backend](../../../../ArquitecturaBase/docs/features/formularios.md), los [tableros elegidos](../../../docs/design/formularios-whatsapp.md) y el [resumen de la etapa en curso](../../../../ArquitecturaBase/docs/plans/formularios/README.md). Los DTO, el OpenAPI y los ejemplos HTTP exportados fijan el contrato.

- [`api/`](api/AGENTS.md): clientes HTTP y guards zod por familia, con los tests que consumen los cuerpos exportados.
- [`hooks/`](hooks/AGENTS.md): dueños de lecturas, borradores en memoria, publicación, workflow, navegación del panel y descargas.
- [`components/`](components/AGENTS.md): piezas de pantalla por tema, compuestas con `shared/ui`.
- [`pages/`](pages/AGENTS.md): una página por ruta de `/formularios` y `/catalogos`; coordinan permisos, URL, guardas y diálogos.
- Raíz: lógica pura con su test al lado. Borrador (`model`, `draftSession`, `editorModel`, `validationPaths`, `fileQuestions`, `missingFormSeed`) y catálogos (`catalogDraft`, `catalogItemEdits`, `catalogFilterDraft`) se explican en `hooks`; `responses`, `rules`, `suggestions`, `pdfDesign`, `approvals`, `workflow*` y las presentaciones de publicación y ciclo de vida, en `components`.

## Al modificar

- No importes otra feature: `app` compone rutas y el enlace MF1 y su contador diferido (`app/FormOverviewCount` usa hooks de acá) y lo común sube a `shared`.
- Cada pantalla exige sólo sus permisos (tabla en `pages`); ninguno implica otro. Las capacidades del servidor (`canSave`, `canPublish`, `canPreview`, `canDeactivate`, `canDelete`, `canDecide`…) mandan: el front no las deduce.
- Las claves de consulta separan actor, permisos y cultura, además del formulario o catálogo. Cambiar de dueño cancela y retira lo privado; un 403 retira lo que esa lectura mostró, no alcanza con ocultarlo.
- Borradores, cuerpos y UUID congelados, tickets, URL efímeras, filtros privados y blobs viven en su dueño: nunca en MutationCache, URL, storage ni logs, y sin reintentos automáticos de escritura ([editores privados](../../../docs/architecture.md#reglas)).
- Sólo el borrador del formulario y la publicación se recuperan por UUID. Reglas, diseño PDF, sugerencias y catálogos guardan con revisión: un 409 conserva el borrador y exige releer y adoptar explícitamente; red o 5xx permiten otro Guardar con la misma revisión.
- El idioma del contenido no es el de la aplicación: original obligatorio, traducción opcional, sin autotraducción ni relleno al guardar. Los catálogos comunes siguen bilingües.
- Un único Toaster y un dueño por hecho ([contrato de mensajes](../../../docs/guides/mensajes-y-estados.md)); la validación va junto al campo.
- Los guards son `strictObject` contra los cuerpos exportados; no se completan fixtures ni se agregan capas de compatibilidad.
- Cada pantalla sigue su tablero (los ids T1, D2, BA1-A… remiten al diseño) y la [correspondencia con `shared/ui`](../../../docs/design/formularios-whatsapp.md#correspondencia-con-sharedui). Una pantalla nueva se dibuja antes ([fundamento visual](../../../docs/design/visual-baseline.md)). Fechas con los formateadores comunes y la zona del perfil.
- TDD en la lógica pura y los hooks. Un cambio de pantalla revisa su escena en `src/test/visual` (`forms*`, `form*`, `catalog*`, `responses*`).

## Referencias

- [Arquitectura: formularios](../../../docs/architecture.md#áreas-con-guía-propia) y [premisas de pantallas](../../../docs/guides/premisas-de-desarrollo.md).
- Guías hijas: [api](api/AGENTS.md), [hooks](hooks/AGENTS.md), [components](components/AGENTS.md) y [pages](pages/AGENTS.md).
- [Cohortes HTTP](../../test/httpCohort.ts) y [arnés de pruebas](../../test/AGENTS.md).
