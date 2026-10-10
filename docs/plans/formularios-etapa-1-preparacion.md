# Formularios por WhatsApp — preparación del frontend, Etapa 1

**Paso 1 A–E/D5 implementado, 2026-10-10.** Listado con facetas del servidor, alta/editor bilingüe, guardado/recuperación propios y revisión explícita por idioma/identidad. Nombre, preguntas, ayudas, opciones y botón usan mapas es/en: se guarda con secundario pendiente, sin autotraducción; el original siempre es obligatorio.

El contenido del paso 1 separado de publicación pasó build, lint y 1110 pruebas unitarias (`npm run test -- --maxWorkers=2`), más 14 recorridos de navegador. La ejecución sin límite de procesos tuvo un timeout de 5 segundos en la prueba de dependencias; la suite completa con dos procesos conservó todas las assertions y tolerancias. La prueba SPA/API/DB real del coordinador conservó PRB1010 (01a12616-01df-7394-8947-a41c7481048c), sus tres revisiones y comprobantes protegidos; verificó ambos idiomas y relectura. Las fuentes vigentes son la arquitectura, la guía local business-forms y el contrato de borrador del backend. Publicación y chat pertenecen a los incrementos siguientes.

## Preparación histórica

Fecha: **2026-10-09**. Estado: **incremento 0 relevado; propuesta para revisión del coordinador**.
No implementa UI, API, permisos, contratos ni tableros nuevos. La elección de variantes faltantes y la revisión
del contrato preceden a su código. Este plan permanece abierto hasta incorporar esas decisiones y entregar
los incrementos; no se consolida como comportamiento productivo.

Ámbito exclusivo: `ArquitecturaBaseFront`, en `main`, sin ramas, commits ni push. Se conserva el trabajo
ajeno acumulado en el árbol. Base observada: `976a97321bf406529bc554a9bd6d2a7ea89b0e21`.
Coordinación: chat `01a10cf6-23c4-7641-b084-a486091df430`; frontend
`01a120d4-1415-7ca1-a73d-cabbfa72e695`; backend `01a120d3-7f84-7471-ae4f-fa71986768f5`.
El coordinador transmite observaciones; este relevamiento no modifica archivos del backend ni la demo.

## Fuentes y autoridad

Se leyeron las instrucciones de raíz, docs, src, app, layouts, features/whatsapp, shared/UI/API/hooks/i18n/lib,
auth, locales y tests/visual/architecture; la [arquitectura](../architecture.md), el
[fundamento visual](../design/visual-baseline.md), las [premisas](../guides/premisas-de-desarrollo.md), el
[estándar aplicado](../guides/estandar-visual.md), el [contrato de mensajes](../guides/mensajes-y-estados.md)
y el [mapa de instrucciones](../mapa-de-instrucciones.md). La documentación sigue las rutinas compartidas de
[validación](../../../ArquitecturaBase/docs/guides/validar-un-cambio.md) y
[auditoría documental](../../../ArquitecturaBase/docs/guides/auditar-documentacion.md).

Fuentes funcionales leídas:

- [Diseño elegido](../design/formularios-whatsapp.md), completo, y sus doce capturas inspeccionadas visualmente.
- [Arranque por incrementos](../../../ArquitecturaBase/docs/plans/formularios-etapa-1-arranque.md).
- [Plan principal](../../../ArquitecturaBase/docs/plans/2026-10-07-formularios-dinamicos-y-whatsapp-flows.md), completo.
- [Acuerdos del 2026-10-08](../../../ArquitecturaBase/docs/plans/formularios-modelo-demo/acuerdos-2026-10-08.md), completos.

El diseño del 8 de octubre reemplaza las maquetas HTML del 7/8 como autoridad de pantallas. No se modifican
ni promueven esos prototipos. Las cuatro capturas s1–s4 siguen como propuestas de sugerencias de una etapa
posterior. Catálogos, planilla, aprobación, PDF, IA, sugerencias, grupos, captura web, correcciones y stock
no forman parte de esta primera etapa.

Confirmaciones del 2026-10-09 que el front debe reflejar: prefijo editable hasta aceptar la primera publicación
durable y bloqueado también tras fallos; apertura estándar «Abrir formulario» separada del botón final personalizado;
`fieldId`/`choiceId` definitivos asignados por servidor al guardar y provisionales locales antes; valores de respuesta
requieren `forms.records.read` además de `whatsapp.read`. Una empresa, empleados y una conexión WhatsApp ya
compartida: no hay credenciales Meta por formulario u operador. Las propuestas restantes del plan no se consideran
aprobadas por escribir este documento.

## Código existente y encaje

| Superficie | Evidencia del código actual | Extensión pertinente |
| --- | --- | --- |
| Rutas | `src/app/routes.tsx`: `/whatsapp/chat` lazy con `whatsapp.read`; administración/perfil/ingreso existentes; no hay rutas Formularios | Nuevas hojas de diseño y edición en español, lazy y con permisos/capacidad revisados; sin rutas de planilla |
| Navegación | `src/layouts/navigation.ts`: paneles estáticos WhatsApp y Administración; `navigationLinks`, `parentLinkOf`, `branchOf` y reconocimiento de sección | Panel Formularios con sólo Diseñar formularios en Etapa 1; mismos datos para menú, ruta activa y migas |
| Panel/caparazón | `Sidebar.tsx`: `PanelTrigger`, panel único abierto según ruta, permiso por enlace; `AppLayout`/`HomeLayout` conservan sesión y geometría | Reutilizar panel de 224 px y cajón móvil. La discriminación admin/whatsapp hoy es explícita; incorporar Formularios en esa coordinación, sin segundo Sidebar |
| Borradores de chat | `WhatsAppChatPage.tsx`: borradores por contacto, guarda de salida y montaje por actor | Preservar texto al abrir/cerrar/enviar formulario; aislar el nuevo borrador del diálogo y limpiarlo por cambio de cuenta |
| Encabezado de conversación | `ChatThread.tsx`: nombre/teléfono, modo y acciones; `api/chat.ts` no trae cuenta vinculada | Consumir resumen de vínculo confirmado del servidor; nunca resolverlo por coincidencia de teléfono/correo desde el front |
| Compositor | `ChatComposer.tsx`: permiso, Manual, 24 h, número y ausencia de Pending/Sending/Uncertain; requestId/cuerpo conservados, consulta de resultado y retry=false | Botón pequeño outline a la izquierda de Enviar; elegibilidad adicional del destinatario; misma coordinación de bloqueo entre Text y Flow |
| Consultas/historial | `useChatThread.ts`, `useChatHistoryViewport.ts`, `lib/history.ts`: polling visible, cursor de historia, merge, lectura/ancla | Ampliar metadata y variantes manteniendo paginado, scroll y lectura; consultas no producen envíos |
| Línea de tiempo | `lib/timeline.ts` mezcla mensajes y operaciones; hoy fuerza `kind: "Text"` para operaciones. `ChatTimeline.tsx` sólo adapta texto/Access | Unión tipada acordada para Flow/FlowReply y captura; no adivinar por body, título o kind desconocido; evitar dos burbujas al confirmar salida |
| Presentación de chat | `MessageBubble` acepta `text: string`; `children` va debajo de metadata en `message-details`, fuera del cuerpo de la burbuja | La tarjeta elegida vive dentro del cuerpo. Requiere una ampliación neutral revisada de la pieza compartida; usar children actual sin cambio no reproduce e1-3 |
| Preview de bandeja | `lib/messagePresentation.ts`: Access por metadata; resto body o texto retirado | «Respondió…» desde metadata autorizada, sin inspeccionar texto ni interpolar valores privados |

El contrato actual `src/features/whatsapp/api/chat.ts` tiene Chat/Thread/ChatMessage/Outgoing de texto,
sin vínculo de cuenta, formulario ni estado de captura. No acredita soporte Flow. `findOutgoing` y
`reviewOutgoing` ya consumen las rutas de recuperación existentes; no crear una recuperación paralela.
El compositor de texto tiene límite 4096: no trasladarlo al mensaje interactivo sin perfil Meta acordado.
La presentación actual tras un 404 de consulta de envío de texto no prueba rollback de una nueva operación;
la recuperación Flow debe seguir el contrato revisado, sin reenvío automático.

No hay feature `business-forms`, renderer de preguntas, preview de formularios ni reordenamiento accesible
reutilizable identificado en `shared/ui`. El set `icons.tsx` tiene Editar/Quitar/Copiar/Agregar/flechas,
pero falta formulario/portapapeles y arrastre. No se propone una dependencia de drag-and-drop en este incremento.

## Mapa de piezas reutilizadas y brechas

| Necesidad | Pieza que se reutiliza | Límite o preparación |
| --- | --- | --- |
| Cabecera/migas/editor | Page con backTo/status; useBreadcrumbLeaf; useUnsavedChangesGuard | Definir salida/descartar y conducta de Guardar antes de programar |
| El formulario/Preguntas | Surface con banda y padded | Distribución y contenido de feature, mismos tokens Campo/Public Sans |
| Nombre/prefijo/botón final/preguntas/opciones | FormField + Input/Textarea/NativeSelect; CheckboxField | Límites/errores del contrato, IDs internos invisibles y error asociado al control |
| Lista y filtros | FilterBar, SearchInput, SegmentedControl, FilterChip; DataTable, Pagination, RowActions, Badge | page/pageSize/sort/search/filtros con usePagination/useFilters/useQueryUpdate; conteos separados del backend |
| Vacío/error/permisos | EmptyState embedded, Skeleton/Spinner y ForbiddenPage | No convertir falla de carga en colección vacía; conservar datos en refetch fallido |
| Descartar/eliminar | ConfirmDialog | Consecuencia concreta, retorno de foco; no confundir descarte local con DELETE |
| Publicar | Dialog compartido | ConfirmDialog actual sólo acepta description string; no alcanza para diff y tres pasos sin ampliación deliberada o composición de Dialog |
| Selección de formulario para enviar | RadioGroupField + Dialog + Pagination | RadioGroupField actual es fila simple: el contorno/selección de las tarjetas de e1-2 necesita variante de biblioteca elegida; paginación todavía sin tablero |
| Condición de versión/ventana | Dato/ayuda/estado duradero; Banner sólo si corresponde a esa condición | Resultados y causas operativas van al único Toaster, nunca un Banner de resultado |
| Tarjeta enviada/recibida | MessageHistory/MessageBubble/MessageDateDivider; Surface/table para contenido neutral cuando corresponda | Revisar slot de cuerpo estructurado y nueva pieza común; el adaptador de WhatsApp conserva permisos/metadata |
| Feedback y transporte | shared/api/httpClient, ApiError, errorFeedback; notifications; createQueryClient | Un dueño por hecho; QueryCache por defecto o dueño local explícito, sin toast duplicado ni silent que oculte fallos |
| Idioma/fechas | i18next es/en y shared/lib/dateTime | Cultura de contenido y fallback deben venir acordados; DateOnly/decimal requieren presentación sin pérdida ni desplazamiento de día |

No se importa `business-forms` desde WhatsApp ni al revés. La feature formularios mantiene su editor/API;
WhatsApp mantiene chatForms y sus adaptadores. Shared sólo recibe piezas neutrales con consumidores reales;
app compone rutas/capacidades y navegación. La sección dinámica Respuestas se entrega en su etapa, sin
consulta ni links ficticios ahora. Al crear la feature se agregan AGENTS/CLAUDE y el mapa; este documento no
crea ámbitos vacíos ni cambia los cuatro pendientes ajenos de mapa/anclas informados por el coordinador.

## Doce capturas: alcance elegido y límites

| Captura inspeccionada | Elección que conserva | Aplicación en Etapa 1 |
| --- | --- | --- |
| 01-idea | Una empresa, vínculo necesario, confirmación humana e historia preservada | Explicación del modelo; no es una nueva pantalla |
| 02-disenar-listado | Tabla/búsqueda/estado/acciones y navegación propia | Falta variante inicial sin Respuestas/Ver respuestas y con estados completos |
| 03-editor | Editor único con preview, preguntas inline y sección de reglas separada | e1-1 es el recorte inicial; no montar IA/reglas/catálogos |
| 04-publicar | Diff, tres pasos y Publicando/Publicado/Falló/Sin confirmar | Falta primera publicación, error global, recuperación y detalle de acciones |
| 05-celular | Recorrido completo, asistente/casos posteriores | e1-4 delimita el recorrido manual inicial |
| 06-respuestas | Planilla por formulario | Posterior; sus números ilustrativos no sustituyen PagedResult |
| 07-una-respuesta | Historial, versión/origen, aprobación/PDF/corrección | Posterior; no crear detalle de respuesta aparte en Etapa 1 |
| 08-versiones | Cambios conservan historia; renombre frente a tipo nuevo | Regla del modelo/contrato, sin pantalla Versiones nueva |
| e1-1-editor | Nombre, botón final, prefijo visible/editable, preguntas y opciones inline, preview | Control editable ya dibujado; falta bloqueo al aceptar durable y errores/copia/colisión. No afirmar que el prefijo nunca fue dibujado |
| e1-2-chat-enviar | Botón, diálogo, elegibles, mensaje y ventana; cuenta vinculada | Falta CTA confirmado, paginado, variantes del vínculo y estados operativos |
| e1-3-chat-respuesta | Tarjeta enviada, respuesta histórica numerada, preview de bandeja | Falta sin valores por permiso y captura pending/rejected; CTA del dibujo se actualiza |
| e1-4-celular | Operador manda; empleado completa/confirma; no guardar al cerrar | Meta es autoridad del celular; cambiar apertura a «Abrir formulario» en lienzo, conservar botón final |

Hay una discrepancia documental observable: la sección de pendientes del diseño/plan dice agregar el prefijo,
pero e1-1 ya lo muestra y acuerdos §8 lo registra ajustado. La brecha precisa es su bloqueo y estados tras la
aceptación durable del 9 de octubre. No se modifica la fuente visual ajena para resolver esa discrepancia aquí.

## Inventario revisable de variantes pendientes en el mismo lienzo

Las filas indican qué debe dibujarse y elegirse, sin afirmar que ya está aprobado su contenido final.

| ID / incremento | Variante faltante | Dato, canal y recuperación a representar |
| --- | --- | --- |
| L1 / 1 | Panel Formularios inicial; tabla 02 sin destino Ver respuestas ni sección Respuestas | Manage y read/capacidad según contrato; resolver contador real, crear vacío/copiar/eliminar y acciones por permiso |
| L2 / 1 | Lista loading, vacío inicial, sin coincidencias, error inicial, refetch fallido, forbidden | DataTable/EmptyState; crear o limpiar según vacío; lectura reintentable y causa de QueryCache; conservar datos; 403 sin toast |
| E1 / 1 | Alta vacía/sin preguntas; seis tipos, ayuda/límites, listas vacías/duplicadas/largas | FormField/grupo y primer campo inválido; no prometer capacidades group/catalog ni traducción automática |
| E2 / 1–2 | Prefijo sugerido/editado/ocupado/copia, bloqueo durable y fallo/recuperación posterior | Ejemplo de numeración y razón visible de readOnly; locked debe venir del servidor, no inferido de ActiveVersionId o status Published |
| E3 / 1 | Guardando, éxito, fallo de campo/general, resultado incierto, 409/relectura/comparación | Borrador y baseline separados; error junto a campo o único Toaster; no sobrescribir ni combinar por índice; decisión explícita antes de aplicar datos ajenos |
| E4 / 1 | Descartar/salir/Atrás/recarga, cambio o pérdida de permiso y guardado tardío | Guarda y ConfirmDialog, retorno de foco, callbacks ligados a actor/editor; definir destino tras Guardar |
| E5 / 1 | Orden de preguntas y opciones con teclado, pregunta quitada/tipo cambiado y foco | Acción accesible equivalente al arrastre, posición anunciada, foco en vecino; identidad nueva frente a identidad conservada según contrato |
| P1 / 2 | Publicar versión 1 sin anterior y versión siguiente, check vencido/409, local activation pendiente | Diff del servidor, aceptación durable 202, snapshot y prefijo fijo; no anunciar publicación completa antes de activar |
| P2 / 2 | Rechazo de pregunta frente a fallo general, Sin confirmar/consulta/revisión, proveedor no disponible | Campo si identificable; error general en Toaster y estado persistente; consulta por requestId antes de repetir; versión anterior usable |
| P3 / 2 | Preview orientativa frente a oficial: loading/expirada/CSP/iframe/permiso | URL temporal en memoria, expiración y Abrir vista oficial; no llamar oficial a preview local |
| C1 / 3 | Cuenta vinculada: con correo, sin correo, no vinculada, inactiva, vínculo revocado/cambiado | Cuenta sin correo ya existe en producto; no crear identidad ni vínculo. El DTO debe separar operador/destinatario y elegibilidad |
| C2 / 3 | Diálogo paginado loading/vacío/error/forbidden y selección entre páginas | Sólo elegibles del servidor, pageSize/configuración y orden estable; conservar mensaje/selección al refetch, resolver elegida que desaparece y foco al paginar |
| C3 / 3 | «Abrir formulario» separado de botón final, validación/límite del mensaje acompañante | Actualizar notas y tarjetas de e1-2/e1-3/e1-4; límite interactivo del perfil, no 4096 por copia |
| C4 / 3 | Ventana cierra/permiso se revoca/modo cambia/otro envío inicia durante diálogo | Datos/razón persistentes junto a acción; revalidación servidor; no perder el borrador de texto ni permitir envío duplicado |
| C5 / 3 | Enviando, 202/en cola, envío fallido/Sin confirmar/consultando/revisión | Congelar UUID y cuerpo, sin retry automático; misma cola Text/Flow; aceptar/revisar no equivale a Delivered/Read |
| R1 / 4 | Respuesta recibida procesando, rechazada/no reconocida y confirmada | Sólo commit confirmado muestra Guardada como; estado persistente, historial de versión; no respuesta automática al empleado |
| R2 / 4 | Chat permitido sin forms.records.read y revocación después de cargar | Tarjeta sin valores; metadata mínima autorizada; limpiar cache/DOM privado y preview, sin strings sensibles en nombres accesibles/toasts |
| R3 / 4 | Tarjeta larga/tipos false–0–ausente/decimal/DateOnly y cuerpo WhatsApp purgado | Etiquetas/opciones históricas, formato sin pérdida; purga no destruye registro guardado; scroll/ancla/lectura intactos |
| T1 / cada uno | es/en, 1440/390/320, zoom, teclado, foco, contraste global y notificaciones con Dialog | Misma jerarquía y piezas; el móvil se elige antes del código, sin inventar composición al implementar |

### Acceso al lienzo y procedimiento pendiente

Destino exacto: página **«Formularios por WhatsApp»** dentro de
[Sistema visual — ArquitecturaBase](https://claude.ai/artifact/HPbmDPLnr8JZ9TxevtTqJJ).
Biblioteca: [ArquitecturaBase UI](https://claude.ai/artifact/Ew763kqorVHSYeUqE8CZ7h), plantillas y componentes
AB del lienzo. `visual-baseline.md` ubica fuentes en `components/src/`, instrucciones en
`components/src/COMO-SE-ARMA.txt` y paquete instalado en `project/ds/ab/`.

La lectura web de ambos enlaces devolvió «not accessible via this tool». La comprobación de superficies
de navegador (`cua.getState`) agotó su timeout y reinició el kernel; no devolvió inventario ni una sesión
editable verificada. Los conectores disponibles no aportan editor de ese Artifact de Claude. Esto no
demuestra que el usuario no tenga acceso: falta verificar una sesión autenticada con edición del Artifact
original y su biblioteca. No se creó HTML/Figma/Artifact sustituto ni se editó el lienzo.

Para continuar, quien tenga ese acceso incorpora L1–E5 primero y después P/C/R según incremento, reutiliza
la biblioteca (sincronización Campo/componentes todavía pendiente), registra la elección explícita y congela
capturas en la misma carpeta de evidencia. No reutiliza capturas de la maqueta reemplazada como aprobación.

## Propuesta concreta del mínimo incremento crear/editar

**Secuencia propuesta para revisión, no autorización de implementación:** lista de diseño + alta/edición y
guardado de borrador de seis tipos, con recarga que prueba identidad y revisión. Publicar, envío y respuesta
se integran en los incrementos siguientes del arranque, con sus propios tableros elegidos.

1. Revisar contrato y elegir L1/L2/E1–E5/T1. Cerrar permisos read/manage, capability, límites, IDs provisionales,
   revisiones, cultura/fallback, copia/eliminación y recuperación de guardar incierto; aclarar Guardar permanece
   en editor frente a premisa común de retorno al listado.
2. Feature `src/features/business-forms`: lista, editor, composición de preguntas/opciones/preview local y
   coordinación de borrador. Nombres de rutas y DTOs sólo tras revisión; el plan orienta rutas en español,
   sin inventariar aquí otras que no estén acordadas.
3. Guardar nombre/prefijo/botón final/preguntas/orden juntos; respuesta canónica reinicia baseline sólo de la
   operación confirmada, sin pisar ediciones posteriores. Mantener mapeo local→canónico y pertenencia; renombre/
   reordenado conserva identidad, tipo/copia crea nueva. Nada interno se muestra al usuario.
4. Listado del servidor y facetas separadas, orden/página/tamaño/filtros en URL mediante hooks comunes.
   Invalidate list/count/detail después del guardado; cache por actor/cultura/permiso y limpieza al perder acceso.
   Mensajes, preguntas, opciones y borradores no van en URL/storage/logs. Los datos de QueryCache son confirmados;
   UUID/cuerpo congelados ante incertidumbre viven en el editor activo, sin conservar el mensaje privado en MutationCache.
5. Pruebas desde contrato acordado: crear→guardar→recargar y editar→409→releer sin pérdida; identidad de
   preguntas/opciones en renombre/reorden/copia/tipo, límites y campos anidados, facetas/paginado y permisos.
   Los dobles de MSW sólo validan consumo/UX; integración real depende del incremento del backend.

## Puntos para la revisión del contrato

Al relevar, el archivo específico `ArquitecturaBase/docs/plans/formularios-etapa-1-contrato.md` todavía no
estaba presente. Las rutas de §12.1 del plan son **propuestas**, no sustituyen DTOs/ejemplos aprobados. No
se generaron tipos, payloads ni endpoints consumidores. Revisar el archivo cuando el backend lo entregue:

| Tema | Lo que necesita el front para no inferir reglas |
| --- | --- |
| Capacidades/permisos | Clave instalada de BusinessForms/Flows y comportamiento módulo ausente; read y manage separados, combinación requerida para panel/ruta/acciones; lista elegible sin permisos administrativos |
| Lista/facetas | PagedResult y campos ordenables/default; semántica exacta de Todos/Publicados/Borradores cuando hay versión activa y cambios/operación fallida; conteos excluyendo dimensión propia, no sobre página |
| Crear/copiar/guardar | Body y respuesta completos, identidad de operación y recuperación incierta (especialmente crear sin id devuelto), expectedDraftRevision y consumo por publicación; mapa de provisionales anidados/ChoiceId y errores atribuibles a controles |
| Prefijo | Regla de candidato, normalización/largo/caracteres/reserva/colisión; indicador durable de bloqueo incluso con ActiveVersionId null tras fallo; contador de ejemplo y nuevo prefijo en copia |
| Esquema/validación | Seis discriminadores reales; required/ayuda/límites de texto, decimal string sin pérdida y precisión/escala, DateOnly sin conversión UTC, false/0/ausente, opciones duplicadas/retiradas; group/catalog reservados pero no habilitados |
| Cultura | Diferenciar cultura de edición, nombre/etiqueta de negocio y textos UI; fallback explícito. No forzar dos traducciones ni traducir contenido automáticamente sin superficie elegida |
| Guardar/409 | Code y forma de errores por pregunta/opción; revisión actual para comparar; qué relectura autoriza recuperar tras red/5xx, sin falso rollback ni merge por índice; guardado tardío con editor cambiado |
| Publicar | Check/diff calculado en servidor, snapshot/cuerpo/hash/requestId, estados y polling GET; qué se consulta/recupera después de 404; primera versión/fallo general/campo/activación local y bloqueo de otro publish |
| Preview | URL autorizada, caducidad, variante/cultura y lista de hosts admitidos/CSP; sin secretos ni link durable en caches/storage; conservar distinción oficial/local |
| Cuenta/elegibles | Resumen con email nullable y fallback autorizado; active/linked y elegibilidad no inferidas del rol; paginado y selección entre páginas, versión que quedó vieja, pérdida de vínculo/permiso durante diálogo |
| Cola/historia | Unión Text/Flow/FlowReply de Outgoing y Message, correlación de operación y mensaje confirmado, receipt/captura; estados nuevos no mapeados a Sent; mismo bloqueo/dedup de Text/Flow |
| Lectura privada | DTO sin valores con whatsapp.read sin forms.records.read, metadata permitida y preview; no body crudo/response_json en cache ni valores ocultados sólo por CSS; revocación y limpieza de páginas históricas |
| Envío | Campo y límite calificado del body interactivo, CTA estándar vs submitLabel, expectedModeRevision y versión elegida; 202 cola, 409/429/Sin confirmar y recuperación existente |

Estas son observaciones para el coordinador/backend, no nuevos nombres de endpoints ni una ampliación de
alcance. Las contradicciones «WhatsApp aprueba», «nunca se publica dos veces», permisos por rol, TTL y
Guardar permanece son del plan y deben resolverse allí/por elección; este front no las cambia unilateralmente.

## Evidencia y siguiente paso

Revisión realizada: fuentes completas indicadas, doce imágenes, código de rutas/panel/chat/transporte/cache/UI
y límites de composición. No se ejecutó un recorrido de formularios en navegador, no hay mock de esta feature
y no se probó API/Meta/Docker. El acceso externo al lienzo no quedó verificado. Único archivo de autoría de
este incremento: este plan; el build regeneró outputs ignorados. Los checks de base del front no acreditan
funcionalidad de formularios ausente:

| Check ejecutado | Resultado y límites |
| --- | --- |
| npm run build | Correcto. Aviso PLUGIN_TIMINGS de Rolldown: hooks del plugin ocupan 20% del build, vite:build-html transform superpuesto; diagnóstico de rendimiento, sin suprimirlo ni cambiar configuración |
| npm run lint, primer intento en sandbox | Oxlint no informó errores; Vitest pasó 44 tests y no pudo cargar una suite de arquitectura por ENOENT en un archivo de cliente temporal del sandbox |
| npm run test, primer intento en sandbox | 95 suites no pudieron cargarse por ENOENT de ese temporal; una suite/31 tests pasaron. No se informa como suite verde ni como regresión funcional reproducida |
| npm run lint, repetición con aprobación del entorno fuera del sandbox | Correcto, tres archivos y 48 pruebas de arquitectura; mismo código/configuración, sin silenciar avisos |
| npm run test, repetición con aprobación del entorno fuera del sandbox | Correcto, 96 archivos y 1014 pruebas. Vitest imprimió un diagnóstico de costo de aislamiento/96 workers; no se cambió isolate ni el arnés |
| git diff --check y revisión del documento nuevo | Sin errores de whitespace; Git informa conversión futura LF→CRLF en el árbol previo y este Markdown, sin cambiar esa configuración |
| Revisión visual | Doce PNG elegidos inspeccionados; no test:visual ni capturas nuevas, porque no se modificó ninguna superficie del producto |

La repetición fuera del sandbox resolvió el error de carga temporal sin modificar producto/arnés. No se
ejecutaron los checks del backend por este alcance exclusivo. Los cuatro pendientes documentales ajenos
informados por el coordinador siguen fuera del encargo.

El incremento siguiente requiere contrato disponible y revisado, elección de variantes de crear/editar en
el mismo lienzo y correcciones del coordinador. Publicación y chat esperan después sus propias variantes.
Al implementar: TDD donde haya lógica; `npm run build`, `npm run lint`, `npm run test`, navegador y
`npm run test:visual`; inspección de capturas es/en/responsive/teclado/contraste, sin silenciar avisos ni
actualizar snapshots para esconder diferencias. Servidores que se levanten se detienen al finalizar;
esta preparación no levantó Aspire ni Vite.
