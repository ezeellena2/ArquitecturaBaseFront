# API: contratos HTTP de formularios

Funciones HTTP de la feature y los guards que validan cada respuesta antes de que llegue a un hook. Todo pasa por `shared/api/httpClient`; ningún otro archivo de la feature arma rutas, salvo la exportación a Excel, que usa la descarga común desde `ResponseExportDialog`.

Familias:

- Formularios, ciclo de vida y publicación: `forms.ts` (listado y facetas, detalle, alta, guardado, recuperación del guardado, chequeo, aceptación y estado de la publicación, vista oficial, impacto y baja, eliminación) con sus guards en `response.ts`.
- Catálogos: `catalogs.ts` (listado, detalle, ítems, Manual, opciones y prueba de Filters, alta y guardado Filters, aprobar o descartar una propuesta) con guards en `catalogResponse.ts`.
- Tabla MF1: `overview.ts` consume `/api/forms/overview`, con página y facetas hermanas. Los contadores privados son nullable requeridos: null no se convierte en cero ni habilita columnas. El guard es estricto también en cada fila, última respuesta y facetas; no conserva los issues ni su contenido al rechazar.
- Planilla y detalle de respuestas: `responses.ts` (búsqueda POST, anclaje de vecinos por RecordId, detalle y conteos por filtro).
- Reglas y PDF: `rules.ts` (configuración, opciones, revisiones) y `pdf.ts` (diseño, vista previa y copias fijas en bytes).
- Workflow y aprobaciones: `workflow.ts` (estado, consultar, reintentar, revisar un destinatario) y `approvals.ts` (tareas por formulario, cantidad, tarea y decisión).
- Sugerencias y formularios que faltan: `suggestions.ts` y `missingRequests.ts`.

## Al modificar

### Forma de un cliente

- Cada respuesta pasa por un `z.strictObject` cerrado y un `read` que lanza un error genérico (`UnsupportedFormResponse`, `UnsupportedCatalogResponse` o un `Error` del contrato) sin conservar los issues de zod: pueden contener contenido privado del borrador. Rechaza lo no representable sin descartar traducciones.
- Los identificadores se validan (`formId`, `catalogId`) antes de componer la ruta. Las rutas de recuperación se reconstruyen (`recoveryPath`, `publicationPath`) y se comparan con las del payload; nunca se sigue una URL recibida.
- Además del esquema, el guard comprueba la coherencia que el hook necesita: identidad y revisión esperadas en recibos, baja (`revision === lifecycle.revision`), catálogos guardados (revisión mayor y mapa de identidad exacto para los LocalId nuevos), propuestas y temas faltantes (revisión siguiente y estado esperado).
- Las lecturas privadas que hoy declaran `cache: "no-store"` lo conservan (vista oficial, impacto de baja, respuestas, workflow, aprobaciones, reglas, sugerencias, PDF, faltantes). Las escrituras no reintentan.
- Un contrato nuevo o ampliado se valida primero contra el cuerpo exportado; no se aceptan formas viejas con adaptadores ni se completan valores ausentes.

### Formularios y publicación

- El detalle es `{ definition, lifecycle, capabilities, audit, publication }`. `lifecycle` es metadata hermana del borrador: no participa del guardado ni de la revisión, y `responseCount` null es desconocido, nunca cero.
- La definición guardada exige nombre de hasta 120 caracteres sin espacios sobrantes, textos del idioma original no vacíos, ids únicos, `key = field_<FieldId sin guiones>`, hasta 40 preguntas y 50 opciones. `maxLength` sólo en textos; `options` u `source` sólo en una lista y mutuamente excluyentes; `files` sólo en Foto o Documento, con `required` igual a `minFiles > 0` y origen sólo en Foto. Los snapshots anteriores a archivos omiten `files`, sin inventar valores. `help` es null o trae textos no vacíos. `offerWhen` es null o hasta 1000 caracteres recortados y no viaja en el chequeo ni en la aceptación.
- La proyección separa versión activa y operación actual: sólo con `canPublish` la operación trae `requestId` y su ruta propia; `canPreview` exige versión activa. Alta y guardado devuelven el commit con mapa de identidad; la recuperación envuelve el resultado original junto a `currentRevision`.
- El chequeo valida que cada diagnóstico apunte a una pregunta u opción del cuerpo enviado, que `canAccept` venga con ticket y vencimiento (y sin ellos cuando no se acepta) y que definición y revisión coincidan. El estado exige `issues` y `cultures` como arrays.
- La vista oficial pide `culture` explícita y `no-store`, exige HTTPS sin credenciales y rechaza una URL vencida (`ExpiredFormPreview`).

### Catálogos

- Los catálogos comunes exigen nombre y descripción en es y en; uno propuesto por el asistente exige sólo su original. La opción exige texto en español, admite inglés y detalle opcionales; `usageCount` e `itemsCount` null son desconocidos. `filters` siempre viaja, null en Manual.
- Manual manda metadatos, delta de ítems y movimientos; Filters, nombre, descripción y filtros. Al actualizar suman `expectedRevision` e `isActive` para dar de baja o reactivar. La persona de ejemplo sólo viaja a la prueba y a la aprobación de una propuesta.

### Respuestas, reglas, PDF, workflow y faltantes

- La planilla valida que cada fila tenga una celda por columna con su tipo y una versión declarada; la celda distingue NotAsked, Unanswered y Answered. El anclaje de navegación usa POST sobre la respuesta y el mismo cuerpo de búsqueda: devuelve sólo sus vecinos, posición desde uno y total del conjunto, con guard estricto que exige límites coherentes e identidad esperada. No busca páginas de valores ni agrega filtros privados a la URL.
- Cada documento del workflow exige `runId`, el identificador persistido de la acción que lo generó. La historia relaciona por esa identidad; no se reconstruye el origen por fecha, idioma ni posición. Los escenarios sintéticos lo declaran y las capturas HTTP sólo se renuevan con el export del productor.
- Los bytes de PDF exigen `application/pdf` y `Content-Language` es o en, que indica el idioma real de la copia.
- Reglas y sugerencias comparten la gramática de condiciones de la planilla y validan las preguntas con `canonicalFormFieldSchema`. `rules/options` trae preguntas, roles y opciones de condición bajo `formrules.manage`, sin exigir leer roles, catálogos ni respuestas. Las opciones de sugerencias son versiones publicadas: `destinations` son los destinos elegibles y `unavailableDestinations` conserva nombre y estado de los dados de baja o eliminados.

### Tests de contrato

- Cada familia tiene su `*HttpContract.test.ts` (y `catalogFilters.test.ts`, `formFileDraftHttpContract.test.ts`) que lee cuerpos sin modificar mediante `httpCohort("<familia>")` de `src/test/httpCohort.ts`. El helper verifica tamaño y SHA256 contra el `provenance.json` del exportador; la variable de entrada que declara para cada familia (por ejemplo `FORMS_HTTP_CONTRACT_INPUT`) apunta a una salida nueva del productor sin copiarla.
- `stage4HttpProvenance.test.ts` exige que las cohortes que enumera vengan de una misma corrida conjunta. La cohorte Manual histórica (`catalogHttpContract.test.ts`, `fixtures/catalogs-http/manual`) es inmutable y rechaza la ausencia de los campos nuevos.
- Estos tests acreditan controller, serializer y guards, no Meta. Las fixtures de comportamiento se nombran como sintéticas y no se presentan como respuesta del productor.

## Referencias

- [Regla funcional](../../../../../ArquitecturaBase/docs/features/formularios.md) y [ciclo de vida](../../../../../ArquitecturaBase/docs/features/formularios.md#dar-de-baja-reactivar-y-eliminar--2026-10-21).
- [Cohortes HTTP](../../../test/httpCohort.ts) y [guía del arnés](../../../test/AGENTS.md).
- Ejemplos: `response.ts` (guard completo), `lifecycleHttpContract.test.ts`, `httpContract.test.ts`, `catalogCurrentHttpContract.test.ts`.
