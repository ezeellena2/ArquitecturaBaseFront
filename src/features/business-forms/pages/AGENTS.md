# Pages: rutas de formularios y catálogos

Una página por ruta. Cada una arma el alcance (`FormReadScope`, `CatalogReadScope` o el dueño de respuestas), lee con su hook, decide carga, vacío, error y falta de permiso, y coordina URL, guarda de salida, diálogos y foco. Las rutas se registran en `src/app/routes.tsx` con su `ProtectedRoute` y el ítem del menú lo compone `app`; la página vuelve a comprobar el permiso y muestra `ForbiddenPage` ante un 403.

| Ruta | Página | Permiso | Tablero |
|---|---|---|---|
| `/formularios` | `FormsPage` | `formtemplates.read` | A, BA1-A |
| `/formularios/nuevo`, `/formularios/:formId` | `FormEditorPage` | read; alta con manage | e1-1, B–D, I1–I3, P1–P3, F1, K6, G1, s2, BA2–BA4, BA6 |
| `/catalogos`, `/catalogos/nuevo`, `/catalogos/:catalogId` | `CatalogsPage`, `CatalogEditorPage` (Filters en `CatalogFiltersEditorPage`) | `formcatalogs.read`; alta con manage | K1–K4, H4 |
| `/formularios/respuestas` | `ResponseFormsPage` | `formrecords.read` | T1 |
| `/formularios/:formId/respuestas/:recordId?` | `FormResponsesPage` y `FormResponseDetailPage` | `formrecords.read` | T1–T5, D2, s4 |
| `/formularios/por-aprobar/:taskId?` | `ApprovalInboxPage` | `formapprovals.decide` | G3, G4 en D2 |
| `/formularios/:formId/pdf` | `FormPdfDesignPage` | `formrules.manage` | G2 |
| `/formularios/faltantes` | `MissingFormsPage` | `formtemplates.manage` | H7 |

Cada ruta exige sólo su permiso: respuestas no dependen de leer plantillas ni catálogos, el diseño PDF no lee valores y Formularios que faltan no exige leer plantillas.

## Al modificar

### Diseñar formularios: listado, editor y ciclo de vida

- `FormsPage` filtra Activos (predeterminado), Publicados, Borradores y Dados de baja con facetas del servidor; búsqueda, orden, página y filtro viven en la URL. La tabla y el segmentado conservan su desplazamiento en el celular. El nombre usa el idioma de la interfaz o, si está vacío, el otro, igual que la búsqueda y el orden del servidor. Una operación fallida no toma el número de la versión activa anterior, que se muestra aparte. La deprecación sólo se rotula en dados de baja; la cantidad de respuestas null se muestra como «—».
- Acciones de fila: Editar con manage; Dar de baja y Reactivar con publish y la capacidad del servidor; Eliminar con manage, oculto si no se puede eliminar. Reactivar navega al editor con una intención efímera en el `state` que abre el chequeo normal, sin publicar sola; el formulario sigue dado de baja hasta que se confirma la versión nueva.
- `FormEditorPage` monta el editor sólo con la lectura exitosa del montaje actual (o un alta nueva, que acepta la semilla de faltantes sólo del mismo actor) y lo reinicia al cambiar actor, cultura o formulario. Un detalle inexistente (404) muestra ausencia sin aviso operativo. Guardar queda en el editor; un alta nueva reemplaza la URL por la del formulario. Volver lleva al listado.
- La guarda de salida cubre borrador, reglas y sugerencias sin guardar, guardado en curso y publicación incierta. Descartar sin cambios sale directo; un guardado o una publicación sin confirmar deshabilitan descartar; mientras guarda sólo se puede esperar o seguir; en revisión se ofrece Revisar.
- El selector «Textos en» cambia sólo el idioma del contenido y cuenta los faltantes en gris. El prefijo se edita sólo desde el original y respeta `prefixLocked`. `offerWhen` se edita en «El formulario» y viaja con el guardado del borrador; vacío queda null y apaga la oferta; no entra al chequeo ni a la aceptación.
- Un error de validación selecciona el idioma, expande la pregunta y enfoca el primer control marcado; «Ir a la pregunta» hace lo mismo desde el chequeo o el estado de publicación. Quitar una pregunta enfoca la vecina o Agregar.
- Baja desde el editor: `confirmRevision` adopta sólo la revisión que devolvió la baja y conserva cambios sin guardar; el menú conserva un disparador vivo para el retorno del foco. Eliminar invalida listado y detalle y vuelve al listado con la guarda autorizada. Un guardado rechazado porque el formulario fue eliminado avisa sin ofrecer recuperar.

### Catálogos

- `CatalogsPage` lleva origen (`kind`) y estado (Active, Inactive, Unavailable) a la URL con `useFilters`; los conteos por origen son del servidor y no cuentan filas de la página. «Nuevo» abre `CatalogOriginDialog` (Manual o Filters). El motivo de no disponible se muestra traducido, sin códigos.
- `CatalogEditorPage` delega Filters (detalle o `?kind=Filters`) a `CatalogFiltersEditorPage`. El paginado y los filtros de ítems no descartan cambios pendientes.
- `CatalogFiltersEditorPage` busca personas de ejemplo con 300 ms de espera, paginadas y explícitas; una búsqueda pendiente no deshabilita el control ni pierde el foco; cambiar de persona o de condiciones limpia la prueba, que marca sin recortar las filas que no se pueden enviar; un fallo de la prueba deja la configuración editable. Sin manage se ve la configuración sin personas ni prueba.
- Una propuesta del asistente muestra solicitante, fechas, decisión y limitaciones, sin identificadores del modelo ni consultas a IA. `originalProposal` no se edita; sólo «Aprobar y activar» o «Descartar propuesta» (con confirmación) la resuelven, con read y manage. Su original es obligatorio también después de resolverla y la traducción ausente queda vacía.

### Respuestas, aprobación y PDF

- `ResponseFormsPage` lista por HTTP paginado los formularios publicados que la persona puede consultar. `FormResponsesPage` mantiene montada la planilla y abre el panel por RecordId en la ruta anidada; la pestaña del panel (`tab`) va en la URL. Cerrar devuelve el foco a su fila o a otra disponible; volver a activar la misma fila pide foco en el marco, ordenar o filtrar no.
- `FormResponseDetailPage` muestra el estado confirmado del workflow (PendingApproval y tarea Open como Por aprobar), los momentos y las pestañas Respuesta, Fotos, Actividad y PDF; es el único dueño de avisos de valores, workflow y navegación. Las migas toman el nombre confirmado de la planilla. Mientras llega otra respuesta, el detalle anterior queda visible y ocupado; decidir y descargar se bloquean hasta confirmar el destino.
- Un 403 retira filas, valores, conteos y visor; un fallo recuperable conserva lo anterior con Reintentar. Columnas por FieldId en orden actual y retiradas al final; el Estado aparece sólo con `hasApproval`. `hasPdf` marca la fila sin leer workflow por fila y abre la pestaña PDF; los bytes requieren una acción.
- `ApprovalInboxPage` lleva «Para mí»/«Todas» (`view`), formulario y página a la URL, de la más vieja a la más nueva; «Para mí» excluye las propias y «Todas» las muestra sin poder decidir. Sin `formrecords.read` el panel muestra sólo metadata y decisión, sin pedir valores, workflow ni PDF; con lectura reutiliza `FormResponseDetailPage`. Perder Decide retira metadata y controles, no la lectura de respuestas.
- `FormPdfDesignPage` usa `rules/options`; nombre y pie exigen el original cuando se cargan. Guarda su propia revisión sin publicar; la vista previa es un POST explícito que no persiste y se retira al editar o cambiar de idioma. Una pregunta nueva queda desmarcada si ya existe un diseño; una seleccionada que se retiró conserva su identidad con etiqueta genérica.
- `MissingFormsPage` busca, filtra Pendientes o Descartados, ordena y pagina en el servidor, sin nombres ni mensajes de solicitantes. Descartar usa la revisión del tema; un 403 retira los datos de inmediato. «Crear formulario» abre el alta normal con nombre y cultura en el `state` del actor, sin resolver el tema.

## Referencias

- Tests de página: `FormsPage.test.tsx`, `FormLifecycle.test.tsx`, `FormDeletion.test.tsx`, `FormPublicationBudgetHttp.test.tsx` (cuerpos HTTP reales del presupuesto de publicación), `FormResponsesPage.test.tsx`, `ResponsePanel.test.tsx`, `ApprovalInboxPage.test.tsx`, `FormSuggestionsRoute.test.tsx`, `CatalogProposalPage.test.tsx`, `MissingFormsPage.test.tsx`.
- Escenas: `src/test/visual/forms.spec.ts`, `formLifecycle.spec.ts`, `catalogFilters.spec.ts`, `responses.spec.ts`, `formApprovals.spec.ts`, `forms-missing.spec.ts`.
- [Premisas de pantallas](../../../../docs/guides/premisas-de-desarrollo.md#modales-y-formularios-con-ruta-propia) y [tableros](../../../../docs/design/formularios-whatsapp.md#los-tableros).
