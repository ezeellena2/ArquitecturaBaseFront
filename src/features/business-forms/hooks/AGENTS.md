# Hooks: dueños de lecturas, borradores y operaciones de formularios

Cada hook es dueño de un estado privado: fija su clave de consulta, cuándo se limpia y qué respuestas tardías descarta. Contiene las lecturas y su limpieza (`useFormQueries`, `useCatalogQueries`, `useResponseQueries`, `useApprovalQueries`, `useUnobservedQueryCleanup`), el borrador del formulario (`useFormDraftEditor`), la publicación (`useFormPublicationCheck`, `useFormPublication`), el borrador de catálogos (`useCatalogDraftEditor`) y el espacio de respuestas (`useResponseRouteQuery`, `useResponseWorkspace`, `useResponseWorkflow`, `useResponsePanelNavigation`, `useResponseDocumentDownloads`). Las funciones HTTP están en `api/`; la lógica pura que usan (`draftSession`, `editorModel`, `validationPaths`, `catalogDraft`, `catalogItemEdits`, `catalogFilterDraft`, `workflow`) está en la raíz de la feature y sigue esta guía.

## Al modificar

### Lecturas y limpieza

- `formScopeKey` y `catalogScopeKey` ordenan permisos y suman cultura al actor; respuestas y aprobaciones usan un dueño de usuario, idioma y permisos, y `useResponseScope` suma el estado `denied` del espacio. Una lectura nueva declara su clave por dueño y su limpieza.
- `usePrivateQueryCleanup` cancela y retira al desmontar: listado y detalle de formularios, baja, reglas, sugerencias y diseño PDF. `useUnobservedQueryCleanup` espera una microtarea y retira sólo consultas sin observadores: catálogos, respuestas, aprobaciones y faltantes; desmontar una pregunta no corta la lectura de otra. La retirada inmediata por pérdida de permiso queda en su dueño.
- Listados y opciones de filtros conservan la última lectura exitosa del mismo dueño durante otra consulta y su fallo; `placeholderData` sólo reutiliza datos de la misma raíz. Las facetas de formularios dependen sólo de `search`: cuentan antes de filtrar por estado.
- Lo privado usa `gcTime: 0`, y los detalles que inicializan un editor `staleTime: 0`. Si la pantalla interpreta el error, la consulta declara `meta.errorOwner: "local"`; el selector de catálogos y el nombre de la pregunta dejan el único aviso a QueryCache (`"global"`). Una lectura cancelada no anuncia fallo; cancelar una escritura puede dejarla incierta.
- `app/FormResponsesNavigation` consume `useResponseNavigation` y `useApprovalCount` al entrar en Formularios o abrir el panel: su firma es contrato con `app`.

### Borrador del formulario

- `useFormDraftEditor` escribe sin MutationCache. Actor, instancia (`editorId` nuevo por montaje) e intento (`requestId`) son identidades distintas: no se aplican callbacks de otro actor, editor o intento, ni un resultado duplicado a otro intento. Perder la sesión o la lectura, o cambiar de actor o cultura, limpia el estado y exige otro montaje.
- Se monta con la lectura exitosa del montaje actual o con un alta nueva; un refetch nunca entra al borrador.
- Guardar congela cuerpo y UUID (`beginDraftSave`). El servidor asigna FieldId, ChoiceId y key: `bindResult` liga preguntas por `localId` y opciones por `fieldLocalId` + `localId`, nunca por etiqueta, índice ni `localId` suelto, y compara tipo, fuente de catálogo y archivos con el intento congelado. El mapa y el snapshot confirmados se aplican juntos; si no cierran, el intento queda sin confirmar.
- Respuestas al guardar: 400 vuelve a edición con errores ligados al cuerpo congelado (`draftFieldIssues`); 409 con motivo conocido pasa a revisión, salvo `RequestConflict`, que conserva UUID y cuerpo; 403 bloquea escribir y conserva la recuperación mientras siga Read; 404 `Forms.Definition.NotFound` en un PUT es definitivo (eliminado), sin intento pendiente y con el valor editado intacto.
- Cualquier otro fallo deja el intento sin confirmar. `recover` lee por GET la ruta reconstruida con el UUID propio, nunca una URL del payload. 404 `Forms.Draft.ChangeNotFound` puede ser una escritura en vuelo: sólo una acción explícita repite exactamente UUID y cuerpo; 410 bloquea esa repetición. Recargar sin UUID ni cuerpo no recupera por similitud.
- Un `currentRevision` mayor exige relectura y decisión y no habilita sobrescribir: `useCurrent` adopta el snapshot leído; `resolveReview` aplica una vez las diferencias conservables y deja todas visibles en el editor. Ninguno guarda, mezcla ni revive identidades retiradas.
- `confirmRevision` acepta sólo la revisión siguiente de una baja propia y conserva valor y baseline; `lockPrefix` fija el prefijo al confirmarse una publicación.

### Publicación

- El chequeo y la publicación exigen Read + Publish, sin Manage, y pertenecen al editor: el chequeo usa sólo la revisión y el cuerpo guardados.
- Aceptar congela otro UUID, cuerpo y ticket. El 202 confirma la aceptación y el prefijo, no la publicación ni el borrador. Un 400 o un 409 de `rejectedCodes` es rechazo definitivo; `RevisionConflict` y `DraftMustBeSaved` llevan a la revisión del borrador.
- El estado se consulta por la ruta reconstruida con el UUID propio. Sólo ese GET se repite solo, según `nextCheckAtUtc` (entre 1 s y 5 min; 30 s sin dato), y se detiene en Published, Failed o Uncertain. Uncertain consulta sin otra aceptación. Un 404 `Forms.Publication.NotFound` de un intento sin confirmar habilita sólo la repetición explícita del mismo UUID, cuerpo y ticket.
- `resume` retoma la operación propia de la proyección sólo si su `recoveryPath` coincide, sin reconstruir cuerpo ni habilitar repetición; el doble montaje reanuda ese mismo GET. Se descartan otra versión u operación, un estado que retrocede desde Published y una respuesta más vieja.
- Published sale del estado confirmado o de la versión activa de la proyección, nunca del borrador, que sigue editable.

### Catálogos

- `useCatalogDraftEditor` sirve a Manual y Filters. Su dueño combina actor, cultura, catálogo y origen, más una época que separa callbacks del baseline anterior. Perder Manage deja el borrador sólo lectura mientras siga Read; un guardado confirmado o una adopción reinician el baseline.
- Manual conserva originales, delta y movimientos entre páginas (`catalogDraft`, `catalogItemEdits`). Los ítems nuevos tienen LocalId sin ItemId ni posición y el servidor los agrega al final; las flechas encolan ItemId y dirección para el mismo Guardar, sin autosave ni lecturas extra.
- Filters activo prueba con la persona elegida antes de guardar y no escribe si excede 200; dado de baja guarda sin persona ni prueba. `catalogFiltersBody` retira los `localId`. Cambiar condiciones limpia el resultado anterior. Una propuesta pendiente sólo se aprueba (con persona) o se descarta.
- Un 409 conserva el borrador hasta releer y adoptar; red o 5xx permite otro Guardar con la misma revisión. Un alta fallida sin ID permite otro intento sin ofrecer releer.

### Respuestas, aprobaciones y documentos

- `useResponseRouteQuery` lleva a la URL sólo página, tamaño, orden, versiones y columnas. Búsqueda, personas, condiciones y estado viven en `useResponseWorkspace`, por dueño y formulario.
- `useResponseWorkflow` relee cada 2 s sólo mientras haya acciones Waiting o Running. Consultar, Reintentar y la revisión de un destinatario son POST explícitos sobre el mismo RunId y exigen `formrules.manage`; `workflowNextAction` nunca ofrece repetir lo hecho o no aplicable. Tras red, 5xx o 409 en una revisión se relee antes de permitir otro POST. Un 403 de control quita la recuperación y relee; sólo un 403 de lectura retira valores. `observeApproval` actualiza la tarea ya leída sólo si su revisión no retrocede.
- `useResponsePanelNavigation` aplica una página tardía sólo al mismo contexto. `useResponseDocumentDownloads` posee una descarga por respuesta, compartida por el menú y la pestaña PDF: cerrar el menú no la aborta; cambiar de dueño, perder lectura o desmontar sí. Respeta la espera de un 429.
- `useApprovalQueries` exige `formapprovals.decide` y conserva datos previos sólo del mismo dueño.

## Referencias

- Tests: `useFormDraftEditor.test.tsx`, `useFormPublication.test.ts`, `useFormPublicationCheck.test.ts`, `useCatalogDraftEditor.test.tsx`, `useCatalogQueries.test.tsx`, `useUnobservedQueryCleanup.test.tsx` y, en la raíz, `draftSession.test.ts`, `editorModel.test.ts`, `catalogDraft.test.ts`, `workflow.test.ts`.
- Regla funcional: [guardado y recuperación](../../../../../ArquitecturaBase/docs/features/formularios.md#un-guardado-y-recuperación-exacta) y [publicación](../../../../../ArquitecturaBase/docs/features/formularios.md#aceptación-durable--primer-corte-2b-2026-10-10).
- [Editores privados](../../../../docs/architecture.md#reglas) y [un dueño por hecho](../../../../docs/guides/mensajes-y-estados.md#un-dueño-por-hecho).
