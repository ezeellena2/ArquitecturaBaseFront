# Formularios por WhatsApp — preparación del frontend, Etapa 1

Preparación inicial: **2026-10-09**. Registro histórico del paso 1 actualizado el **2026-10-10**; nota de cierre del **2026-10-11**.
Estado actual: **Etapa 1 cerrada; pendientes menores trasladados a Etapa 2**. El [cierre vigente](../design/formularios-whatsapp.md#cierre-y-comprobaciones-de-etapa-1-2026-10-11) distingue pruebas, revisión visual y límites pendientes. El cuerpo siguiente conserva la preparación y sus resultados históricos; las cifras y restricciones de ese momento no describen el cierre actual.

## Evidencia histórica del paso 1

D5 consume directamente los mapas es/en confirmados: original obligatorio, traducciones pendientes guardables, sin autotraducción ni respaldo al guardar. Se adoptaron A–E, prefijo compartido/fijo según confirmación del servidor, identidades estables y recuperación/revisión explícita en memoria. Las decisiones implementadas están en [arquitectura](../architecture.md) y [la guía del área](../../src/features/business-forms/AGENTS.md). Lo que sigue conserva el relevamiento previo; las menciones a consumidores no visuales, espera de diseño, nombre escalar o compatibilidad pendiente son históricas.

Build sin diagnósticos, lint limpio y **1110 pruebas automáticas** aprobadas. Las **14 pruebas visuales de Formularios** cubren es/en a 1440/390/320 px, teclado/foco, relectura, traducciones pendientes y precisión/ausencia/DateOnly. La suite visual general se verificó por separado; los avisos NO_COLOR/FORCE_COLOR pertenecen al entorno y no se suprimieron.

El coordinador comprobó el recorrido real con sesión normal, fixture PRB1010 (`01a12616-01df-7394-8947-a41c7481048c`): alta revisión 1 con inglés pendiente; actualización 2 completa es/en; recarga; edición en inglés y actualización 3; nueva recarga con ambos contadores en cero. La DB conservó los tres comprobantes protegidos y la auditoría. Captura: backend `.test-artifacts/formularios/2026-10-10/paso1-real-en.jpg`. El coordinador alineó las proyecciones y la historia de la DB local con la inicial regenerada, conservando la fixture y sus comprobantes; comprobó también listado, búsqueda vacía y facetas después del reinicio. P1 real quedó verificado con la revisión3 y sin operaciones de publicación.

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
requieren `formrecords.read` además de `whatsapp.read`. Permisos técnicos aprobados: `formtemplates.read/manage/publish`
y `formrecords.create/read`, con la misma semántica. Guardar permanece en el editor con notificación común;
Volver lleva al listado. LongText comienza en 600 según e1-1, sin controles nuevos de precisión/rangos.
Una empresa, empleados y una conexión WhatsApp ya
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

`business-forms` incorpora modelos, transiciones puras, API/guard y hooks no visuales del borrador. No hay renderer de preguntas,
preview de formularios ni reordenamiento accesible reutilizable identificado en `shared/ui`.
El set `icons.tsx` tiene Editar/Quitar/Copiar/Agregar/flechas,
pero falta formulario/portapapeles y arrastre. No se propone una dependencia de drag-and-drop en este incremento.

## Mapa de piezas reutilizadas y brechas

| Necesidad | Pieza que se reutiliza | Límite o preparación |
| --- | --- | --- |
| Cabecera/migas/editor | Page con backTo/status; useBreadcrumbLeaf; useUnsavedChangesGuard | Guardar permanece, Volver al listado; representar salida/descartar con la guarda existente |
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
consulta ni links ficticios ahora. La lógica real agrega AGENTS/CLAUDE y entrada del mapa; no se crean ámbitos
vacíos ni se cambian los cuatro pendientes ajenos de mapa/anclas informados por el coordinador.

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

Las filas inventarían escenarios que deben quedar resueltos, sin afirmar que ya está aprobado su contenido
final. **No equivalen a un tablero nuevo por estado.** L1/L2/E1–E5 se concretan abajo: los estados comunes
se componen con la biblioteca elegida; sólo las composiciones nuevas y decisiones funcionales requieren
elección. P/C/R conservan el inventario previo y esperan su incremento, sin desarrollo adicional en esta ronda.

| ID / incremento | Variante faltante | Dato, canal y recuperación a representar |
| --- | --- | --- |
| L1 / 1 | Panel Formularios inicial; tabla 02 sin destino Ver respuestas ni sección Respuestas | Manage y read/capacidad según contrato; contador real y acciones por permiso. Alta local vacía, sin persistencia previa; copiar/eliminar quedan para después |
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
| R2 / 4 | Chat permitido sin formrecords.read y revocación después de cargar | Tarjeta sin valores; metadata mínima autorizada; limpiar cache/DOM privado y preview, sin strings sensibles en nombres accesibles/toasts |
| R3 / 4 | Tarjeta larga/tipos false–0–ausente/decimal/DateOnly y cuerpo WhatsApp purgado | Etiquetas/opciones históricas, formato sin pérdida; purga no destruye registro guardado; scroll/ancla/lectura intactos |
| T1 / cada uno | es/en, 1440/390/320, zoom, teclado, foco, contraste global y notificaciones con Dialog | Misma jerarquía y piezas; el móvil se elige antes del código, sin inventar composición al implementar |

### Acceso al lienzo: reintento acotado del 9 de octubre

Destino exacto: página **«Formularios por WhatsApp»** dentro de
[Sistema visual — ArquitecturaBase](https://claude.ai/artifact/HPbmDPLnr8JZ9TxevtTqJJ).
Biblioteca: [ArquitecturaBase UI](https://claude.ai/artifact/Ew763kqorVHSYeUqE8CZ7h), plantillas y componentes
AB del lienzo. `visual-baseline.md` ubica fuentes en `components/src/`, instrucciones en
`components/src/COMO-SE-ARMA.txt` y paquete instalado en `project/ds/ab/`.

El intento del incremento 0 falló por timeout. **El reintento de esta ronda sí abrió el original en Chrome,
con la sesión existente, sin iniciar sesión.** Se verificaron las tres páginas y los 17 tableros de
Formularios por WhatsApp; su enlace directo observado es
[la página original](https://claude.ai/artifact/HPbmDPLnr8JZ9TxevtTqJJ#page-d3eb1eee3e2f), y el editor elegido es
[Etapa 1 · el editor justo para empezar](https://claude.ai/artifact/HPbmDPLnr8JZ9TxevtTqJJ#artboard-4516fc9ef6e2).

La interfaz ofrece capas, selección, texto, figuras, Artboard, propiedades y un panel Code de **CSS and
attributes del elemento**, no un editor de la composición HTML ni un importador AB observado. El botón
Artboard activó la herramienta de dibujo sin mostrar selector de biblioteca/plantilla. La conexión se
interrumpió una vez y se recuperó la misma pestaña; el intento de menú contextual agotó el despacho de
entrada y la observación posterior no mostró un menú de composición. No se cambiaron valores ni contenido.

La comprobación posterior abrió los menús del Artifact y de la página: el primero expone exportación,
duplicación y administración; el segundo, renombrar/eliminar. Ninguno mostró autoría de fuentes ni importación
AB. La biblioteca original también abrió: Overview sigue declarando Inter y los colores observados son
azules; Files muestra sus 175 archivos con lectura/Download, sin editor de fuentes observado. Esta evidencia
confirma acceso a lectura y propiedades, no composición AB en la página de Formularios.

La lectura final de esta ronda volvió a abrir esa página original y confirmó en los contenedores visibles
de los tableros los nombres de fuente `FWA-Listado.dc.html` y `FWA-E1-Editor.dc.html` (Help del lienzo).
No son nombres de archivos locales ni URLs durables del iframe: el destino estable sigue siendo el
Artifact/página/editor enlazado. El proyecto original debe exponer autoría de esas composiciones y montaje
de la biblioteca; lectura del tablero no acredita ese acceso de escritura.

El bloqueo preciso no es autenticación ni falta de lectura: **no quedó disponible/verificado un mecanismo
de autoría de fuentes `.dc.html` y montaje de componentes AB en el proyecto de este Artifact** mediante los
controles expuestos y las herramientas disponibles. No se puede acreditar la composición pedida sólo
dibujando figuras o editando CSS de los tableros elegidos. Tampoco se comprobó la escritura durable.
La nota existente del lienzo declara que las piezas están dibujadas porque la biblioteca conserva azul/Inter;
concuerda con la sincronización Campo pendiente documentada, pero no autoriza reemplazarla ni usar Jade.

Acceso concreto necesario para continuar: autoría del proyecto original que contiene `FWA-Listado.dc.html`
y `FWA-E1-Editor.dc.html`, creación de variantes en **esa página** y composición desde `project/ds/ab/`
siguiendo `components/src/COMO-SE-ARMA.txt`; resolver antes la sincronización Campo/Public Sans de la
biblioteca si aún difiere. El paquete de abajo queda listo para esa autoría y para elección. No se envió
un pedido a Claude, no se cambió el uso compartido y no se creó HTML/Figma/Artifact sustituto.

### Paquete concreto L1/L2/E1–E5 para el primer incremento

Los textos siguientes son propuestas es/en de interfaz, no nuevas claves de API ni traducción automática
del contenido del negocio. `{name}`, `{max}`, `{position}` y `{count}` representan datos autorizados del
contrato revisado; sus presupuestos no acreditan validadores/HTTP implementados. Default largo600 según la
corrección recibida. El error de negocio del servidor
conserva su traducción; estos textos fijan la explicación/acción del front y ejemplos para el tablero.

**Paquete mínimo para elegir en la misma página:** (A) recorte del listado de Etapa 1 sin Respuestas,
(B) alta dentro del editor e1-1 elegido y salida/Guardar, (C) prefijo bloqueado con la explicación durable,
(D) conflicto/relectura sin sobreescritura. Son variantes de las composiciones existentes, no seis pantallas
nuevas. Loading, vacío, error inline por colisión, botones busy, aviso de salida y ConfirmDialog aplican
recetas compartidas. El guardado incierto se anota en B/D según el contrato recuperable; orden, opciones y
configuración de los seis tipos se conservan en el editor elegido, con controles compartidos, sin otra
elección de estilo. Escritorio y adaptación a 320 px/es/en verifican la misma variante; 390 px no agrega
una decisión de producto. Tweaks puede representar variantes si el proyecto lo soporta.

Pasos concretos para la autoría original cuando esté disponible:

1. Abrir la página y el editor enlazados arriba; conservar los tableros elegidos y trabajar sus variantes.
   A parte de la plantilla de listado AB; B/C/D parten de `FWA-E1-Editor.dc.html` y su disposición inline.
2. Componer con `project/ds/ab/` y la receta `components/src/COMO-SE-ARMA.txt`. A usa Page/FilterBar/
   DataTable/Pagination/RowActions; B/C usan FormField/Input/NativeSelect/Button; D reutiliza la comparación
   de Configuración, Surface y los mismos controles. Resolver la sincronización Campo/Public Sans de AB
   antes de acreditar las piezas; no redibujarlas a mano ni cambiar la guía desde este encargo.
3. En A, retirar Respuestas y acciones futuras; en B, dibujar el alta sin persistencia previa y un único
   Guardar con todo el contenido; en C, mostrar editable con colisión inline y bloqueado tras aceptación
   durable aun sin versión activa; en D, contrastar borrador actual/cambios locales y releer sin guardar.
   C sólo representa el dato recibido: no añade una operación de publicación en este incremento.
4. Anotar en B/D la salida con cambios, permanencia tras Guardar confirmado y recuperación del intento sin
   respuesta. Reusar guarda/diálogo/toasts existentes; no aprobar por separado cada estado rutinario.
5. Elegir únicamente el recorte A/B, la explicación C y la interacción de revisión D; salida usa la guarda
   común. Guardar permanece con notificación común y Volver lleva al listado: ya aprobado por el usuario.
   El alta completa con un solo commit ya fue decidida por el coordinador. Las seis clases
   de respuesta y la edición inline ya están elegidas; cerrar sus propiedades en el contrato no las
   convierte en nuevas pantallas. Registrar elección en el original antes de consumidores.

| ID | Propuesta concreta y piezas compartidas | Canal, dueño y recuperación | Elección o aplicación rutinaria |
| --- | --- | --- | --- |
| L1 | Conservar marco/panel de e1-1 y tabla 02 con Formulario, Preguntas, En WhatsApp, Último cambio y Acciones. Quitar columna/links de Respuestas. Nombre abre editor; Nuevo formulario abre alta vacía. FilterBar/SearchInput/SegmentedControl, DataTable/Pagination/RowActions/Badge y Page. Contadores/filtros salen del servidor | Datos confirmados, no toast al navegar. Cache de listado/facetas con QueryCache. Sin manage, ocultar escritura; sin read, página de acceso. No inferir que manage implica read | A: nueva composición recortada. Copiar/eliminar se muestran sólo cuando haya contrato y operación en alcance; no botones ficticios en el incremento crear/listar/obtener/guardar |
| L2 | Carga inicial en cuerpo de DataTable, cabecera/filtros conservados; EmptyState embedded para cero formularios o cero coincidencias. Refetch fallido conserva incluso una lista vacía conocida. ForbiddenPage ante acceso revocado | Lectura: QueryCache notifica causa una vez; EmptyState identifica superficie + Reintentar. Refetch: un toast error, sin vaciar ni mover página. Sin datos, no mostrar contador cero durante fallo/carga. 401/403 por flujo común sin toast adicional | Recetas existentes de Usuarios/Roles; valores de textos contextualizados abajo. Sin nuevo tablero por cada estado |
| E1 | Alta con El formulario arriba (nombre, botón final, prefijo existente) y Preguntas debajo; EmptyState embedded con Agregar pregunta. Agregar abre pregunta inline y enfoca su etiqueta. FormField/Input/Textarea/NativeSelect y CheckboxField. Preview orientativa debajo en móvil, a la derecha en escritorio | Dato/ayuda junto al control. Errores del servidor por control/grupo; expandir pregunta inválida y enfocar primer error, sin toast genérico duplicado. Listo cierra la edición inline y conserva el borrador local; no guarda | B: variante alta del editor elegido. Un único Guardar envía contenido completo con un commit; no crear un borrador vacío invisible al entrar. Invalid/busy/disabled y los seis tipos se conservan; cotas/configuración se cierran en contrato |
| E2 | Prefijo sugerido a partir del nombre hasta que la persona lo edite; después no reemplazarlo al renombrar. Ejemplo VIS-000001. Colisión bajo FormField. Prefijo locked legible/readOnly con razón, incluso si no hay versión activa y falló publicación. Copia comienza con propuesta nueva, sin reutilizar IDs/contador | Colisión/invalid: campo, sin toast duplicado. Bloqueo: dato durable, no aviso al render. Si llega PrefixLocked durante guardado, conservar los otros cambios y revisar dato actual antes de repetir. La propuesta local no garantiza reserva | C: bloqueo/fallo nuevo; control editable ya elegido. Algoritmo de sugerencia, unicidad y copia dependen del contrato. No alterar prefijo automáticamente al recuperar |
| E3 | Page con Cambios sin guardar y Guardar borrador/Descartar; al enviar, Guardando… y bloqueo del segundo submit. Éxito sólo con respuesta confirmada. Borrador/base separados y correlación por identidades, nunca índice. Comparación de 409 muestra nombre/prefijo/botón y preguntas/opciones cambiadas, no JSON/IDs | Mutación: un dueño local usa errorFeedback/notifications. Campos: inline. General: único toast error y conserva valores. 409: toast error con Revisar + estado pendiente visible; GET antes de comparar. Incierto: estado Sin confirmar y Consultar guardado; no Reintentar escritura a ciegas | D adapta la comparación existente de Configuración a preguntas/opciones; incertidumbre se anota en B/D, sin pantalla E nueva. Elegir sólo interacción de revisión según mapa/IDs recuperable; no crear Banner de fallo ni modal informativo |
| E4 | useUnsavedChangesGuard y ConfirmDialog para salida/Atrás/Descartar; seguir editando vuelve al control anterior. Recarga/cierre usa aviso nativo del navegador. Aplicar callback sólo al actor, definición e intento que lo originó | Descartar es decisión local, no DELETE ni toast éxito. Resultado tardío confirmado identifica contexto sin reabrir editor ni pisar edición nueva. 401/403 limpia datos/acciones privadas y sigue acceso común. Sin confirmar no equivale a fallo ni descarte seguro | Confirmación/guarda rutinaria. **Aprobado:** Guardar permanece en el editor con notificación común; Volver lleva al listado. No requiere otra elección |
| E5 | Botones outline/ghost pequeños Subir/Bajar en cada fila de pregunta y opción, usando flechas compartidas; primero/último disabled. No exigir drag para completar tarea. Crear lista inline de opciones con Agregar/Quitar y error de grupo. Quitar/tipo usan ConfirmDialog cuando haya contenido significativo | Reordenar conserva identidad y foco en la misma fila; anuncio polite de posición. Quitar enfoca vecino o Agregar. Tipo nuevo vacía configuración incompatible, crea nueva identidad canónica al guardar y no modifica historia; cancelar conserva todo | Anotación del editor B con botones/diálogo existentes, sin pantalla F ni decisión estética adicional. Renombre/orden mismo tipo mantiene IDs; tipo/copia los reemplaza. La copia queda para un incremento posterior |

#### L1/L2: textos y acciones de listado

| Situación/canal | Español | English | Acción y conservación |
| --- | --- | --- | --- |
| Cabecera/dato | Diseñar formularios · Nuevo formulario | Design forms · New form | Alta vacía; el panel sólo contiene Diseñar formularios |
| Búsqueda y filtro/dato | Buscar por nombre · Estado · Todos · Publicados · Borradores | Search by name · Status · All · Published · Drafts | Orden/filtros/página en URL común; facetas no cuentan filas visibles |
| Columnas/dato | Formulario · Preguntas · En WhatsApp · Último cambio · Acciones | Form · Questions · In WhatsApp · Last change · Actions | lastChangedAtUtc efectivo del servidor; autor nullable muestra guion, sin fecha/nombre inventado |
| Vacío inicial/EmptyState | Todavía no hay formularios. Creá el primero para empezar. | No forms yet. Create the first one to get started. | Nuevo formulario / New form sólo con capacidad de escritura |
| Vacío filtrado/EmptyState | No encontramos formularios con estos filtros. | No forms match these filters. | Limpiar filtros / Clear filters; conserva búsqueda hasta acción explícita |
| Carga inicial/dato | Cargando formularios… | Loading forms… | Spinner común; no aviso operativo al iniciar lectura |
| Error inicial/EmptyState | No pudimos cargar los formularios. | We couldn't load the forms. | Reintentar / Retry repite lectura; causa la notifica QueryCache |
| Refetch/toast error | No pudimos actualizar los formularios. | We couldn't refresh the forms. | Lectura reintentable; texto común de red/5xx si esa es la causa; datos anteriores visibles |
| Sin acceso/página | Sin permiso | No permission | ForbiddenPage común; sin crear/copiar/guardar, sin toast repetido |

#### E1/E2: autoría, tipos y validación

| Control o estado | Español propuesto | English proposed | Composición/recuperación |
| --- | --- | --- | --- |
| Alta/secciones | Nuevo formulario · El formulario · Preguntas · Vista previa | New form · Form details · Questions · Preview | Page + Surface; preview dice que es orientativa, sin prometer validación de Meta |
| Datos iniciales | Nombre · Texto del botón final · Prefijo de numeración | Name · Submit button text · Numbering prefix | Nombre vacío; texto final propuesto Enviar / Submit; prefijo sugerido cuando haya nombre |
| Ayuda del botón | Es lo que toca el empleado al terminar. | What the employee taps when finished. | FormField hint; distinto de Abrir formulario / Open form (apertura, posterior) |
| Prefijo editable | Las respuestas se numeran {example}. Podés cambiar el prefijo hasta iniciar la primera publicación. | Responses are numbered {example}. You can change the prefix until the first publication starts. | Ejemplo ilustrativo, no reserva ni próximo contador confirmado |
| Prefijo bloqueado | El prefijo quedó fijo al iniciar la primera publicación, aunque no se haya completado. | The prefix was locked when the first publication started, even if it hasn't completed. | Ayuda durable del control readOnly; aceptación debe venir confirmada del servidor |
| Colisión/campo | Ya hay un formulario con ese prefijo. Elegí otro. | A form already uses this prefix. Choose another. | FormField del prefijo; servidor decide normalización/unicidad |
| Cero preguntas/EmptyState | Todavía no agregaste preguntas. | You haven't added any questions yet. | Agregar pregunta / Add question enfoca la nueva etiqueta |
| Edición inline | Pregunta · Tipo de respuesta · Ayuda para el empleado · Obligatoria · Listo | Question · Answer type · Help for the employee · Required · Done | Ayuda opcional; CheckboxField explica Se puede enviar sin completarla / Can be submitted without answering cuando no es obligatoria |
| Tipos del selector | Texto corto · Texto largo · Número · Fecha · Sí o no · Elegir de una lista | Short text · Long text · Number · Date · Yes or no · Choose from a list | Seis opciones; discriminantes técnicos sólo desde contrato. Elegir tipo no convierte respuestas anteriores |
| Texto | Máximo de caracteres · Hasta {max} caracteres | Maximum characters · Up to {max} characters | Input de cota sólo para texto; sin fijar valor arbitrario ni contar bytes como caracteres |
| Número/fecha/sí o no | Número con decimales · Fecha sin hora · Sí o no | Decimal number · Date without time · Yes or no | Sin settings nuevos de precisión/rango hasta contrato; ejemplos orientativos sin parseo que pierda decimal o cambie día |
| Lista | Opciones · Agregar opción · Quitar opción | Options · Add option · Remove option | Una opción editable por fila; nombre accesible con posición si está vacía. Lista manual, sin catálogo ni selección múltiple inferida |
| Opción vacía/campo | Escribí el texto de la opción. | Enter the option text. | Error asociado a esa fila; foco, sin toast duplicado |
| Lista vacía/grupo | Agregá las opciones de esta pregunta. | Add the options for this question. | Ejemplo condicionado a validación acordada; action Agregar opción. No inventar mínimo 2 |
| Duplicado/campo | Esta opción está repetida. | This option is duplicated. | Ejemplo sólo si contrato prohíbe duplicados; no deduplicación silenciosa ni comparación por índice |
| Texto demasiado largo/campo | Usá hasta {max} caracteres. | Use up to {max} characters. | Error de control; política Unicode/largo del servidor. No cortar contenido silenciosamente |
| Preview/ayuda | Vista previa orientativa. La vista oficial de WhatsApp estará disponible al publicar. | Indicative preview. The official WhatsApp preview will be available when published. | Sólo representación local; no consulta de publicación en incremento 1 |

**Referencia de configuración en B, conservando los seis tipos elegidos:** misma fila resumen (posición, etiqueta, tipo,
obligatoriedad, editar/quitar/orden) y panel inline con etiqueta/tipo/ayuda/obligatoriedad. Texto corto/largo
añaden cota; lista añade opciones. Número/fecha/sí o no mantienen esos controles comunes hasta que el
contrato concrete sus propiedades. Son anotaciones de controles compartidos, no otra elección de pantalla.
Los ejemplos es/en traducen interfaz, no nombres/etiquetas escritos por una persona.
Una pregunta sin nombre se resume como Pregunta {position} / Question {position}, sin exponer localId.

#### E3/E4/E5: guardar, decidir y ordenar

| Evento/canal | Español propuesto | English proposed | Acción/recuperación y piezas |
| --- | --- | --- | --- |
| Dirty/dato | Cambios sin guardar | Unsaved changes | Page status; no toast por cada tecla |
| Submit/botón | Guardar borrador · Guardando… | Save draft · Saving… | Button busy + Spinner; mismo intento, sin segundo submit |
| Confirmado/toast éxito | Guardamos el borrador de {name}. | Saved the draft of {name}. | Sólo después de respuesta canónica; baseline/IDs juntos. Permanece en el editor; Volver al listado |
| Fallo general/toast error | No pudimos guardar el borrador. | We couldn't save the draft. | errorFeedback conserva causa común; no afirmar rollback si resultado incierto |
| 409/toast error con acción | El formulario cambió mientras lo editabas. Revisá la versión guardada. | The form changed while you were editing it. Review the saved version. | Revisar / Review relee; no sobrescribe borrador local |
| Comparación/dato y decisión | Revisión del borrador · Guardado actualmente · Mis cambios | Review draft · Currently saved · My changes | Surface/table en escritorio y pares apilados en móvil; cambios de preguntas/opciones por identidad |
| Decisión de comparación/botones | Usar borrador actual · Conservar mis cambios | Use current draft · Keep my changes | Actual descarta local con consecuencia clara; conservar no guarda ni fuerza overwrite. Identidades retiradas/reemplazadas requieren reconciliación revisada |
| Incierto/toast error con acción | No pudimos confirmar el guardado. Consultá antes de volver a guardar. | We couldn't confirm the save. Check before saving again. | Consultar guardado / Check save consulta evidencia acordada, no repetir creación/PUT automáticamente |
| Incierto/dato durable | Guardado sin confirmar · Consultando guardado… | Save unconfirmed · Checking save… | Estado visible al cerrar toast; requestId/cuerpo/localIds inmóviles en memoria. Consulta devuelve snapshot/mapa del intento; currentRevision más nueva exige revisión |
| Descartar/ConfirmDialog | Descartar los cambios · Vas a perder los cambios que todavía no guardaste. | Discard changes · You'll lose the changes you haven't saved yet. | Seguir editando / Keep editing; Descartar cambios / Discard changes. Guarda común y retorno de foco |
| Quitar pregunta/ConfirmDialog | Quitar la pregunta · Dejará de pedirse en el borrador. Las respuestas anteriores se conservan. | Remove question · It will no longer be asked in the draft. Previous responses are preserved. | Cancelar / Cancel; Quitar pregunta / Remove question. No borrar respuesta histórica ni confirmar cada fila nueva vacía |
| Cambiar tipo/ConfirmDialog | Cambiar el tipo de respuesta · Esta será una pregunta nueva. Las respuestas anteriores conservan el tipo original. | Change answer type · This will be a new question. Previous responses keep their original type. | Cancelar / Cancel; Cambiar tipo / Change type; datos incompatibles se detallan antes de decidir |
| Orden/botones y anuncio | Subir pregunta · Bajar pregunta · Pregunta en posición {position} de {count}. | Move question up · Move question down · Question at position {position} of {count}. | Button con íconos compartidos y nombre accesible; anuncio polite, foco permanece en pregunta |
| Opciones/orden | Subir opción · Bajar opción · Opción en posición {position} de {count}. | Move option up · Move option down · Option at position {position} of {count}. | Mismo patrón neutral, IDs intactos y sin toast operativo por movimiento local |
| Resultado tardío/toast contextual | Guardamos el borrador de {name}. | Saved the draft of {name}. | Si actor sigue autorizado, un solo aviso sin reabrir. Si es respuesta superada/cancelación, no se anuncia fallo ni se modifica editor nuevo |

Para el 409, D propone comparación por cambios de negocio y **ningún merge automático**. «Conservar mis
cambios» mantiene intención local para revisión; no autoriza asignar un ID ajeno, resucitar pregunta retirada
ni repetir contra una revisión nueva sin resolver propiedad/reemplazo. Si el backend no entrega base/mapa
suficientes, esa acción permanece pendiente en la propuesta; no se entrega una recuperación ficticia.
Para la anotación de guardado incierto en B/D, releer una representación igual no prueba por sí sola que el
intento confirmó: se necesita evidencia de operación/revisión/identidad acordada. Crear con id desconocido
necesita recuperación específica.

**Elecciones funcionales concretas que siguen abiertas:** interacción de relectura/conservación tras 409 con
identidades retiradas y explicación del prefijo bloqueado sin activa, dentro de A/B/C/D en el original.
Guardar/salida aplica la decisión aprobada y la guarda común. Recuperación propia por actor/requestId devuelve
snapshot/mapa del intento aun tras otro guardado, con payload protegido recuperable por 30 días.
Un 404 de recuperación no prueba rollback ni autoriza UUID nuevo; recarga sin UUID/cuerpo no se recupera
por parecido. Resume de metadata persistida no se implementa ni se promete en este bloque en memoria.
La creación ya está decidida: todo el contenido en un único Guardar/commit, dentro del editor elegido.
No se propone un paso previo persistido ni un nuevo recorrido. Orden, tipos y estados rutinarios se anotan
con piezas existentes; no son otra tanda de pantallas por elegir.
La sincronización Campo de AB es preparación de biblioteca, no permiso para inventar estilo. Estado invalid,
busy, EmptyState, ConfirmDialog y Toaster usan el sistema existente sin pedir otra aprobación de su aspecto.

## Propuesta concreta del mínimo incremento crear/editar

**Secuencia propuesta para revisión, no autorización de implementación:** lista de diseño + alta/edición y
guardado de borrador de seis tipos, con recarga que prueba identidad y revisión. Publicar, envío y respuesta
se integran en los incrementos siguientes del arranque, con sus propios tableros elegidos.

1. Contrato de borrador revisado abajo; elegir las variantes A/B/C/D, aplicando L1/L2/E1–E5/T1 como recetas
   y verificaciones. Aplicar permisos/capability, presupuestos, IDs/revisiones, cultura/fallback y recuperación
   acordados; copia/eliminación quedan después. Guardar permanece: decisión cerrada.
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

En el relevamiento inicial el contrato no estaba presente. **Apareció durante esta segunda ronda y se leyó
completo**: [contrato propuesto del backend](../../../ArquitecturaBase/docs/plans/formularios-etapa-1-contrato.md),
estado PROPUESTA del 2026-10-09. La revisión concreta de crear/listar/obtener/guardar queda abajo.
Las rutas de §12.1 del plan y los ejemplos de ese contrato siguen como propuestas, no DTOs aprobados.
No se generaron tipos, payloads ni endpoints consumidores. Esta tabla conserva las preguntas de etapas
posteriores sin convertirlas en requisito para iniciar el recorte mínimo:

| Tema | Lo que necesita el front para no inferir reglas |
| --- | --- |
| Capacidades/permisos | Clave instalada de BusinessForms/Flows y comportamiento módulo ausente; read y manage separados, combinación requerida para panel/ruta/acciones; lista elegible sin permisos administrativos |
| Lista/facetas | PagedResult y campos ordenables/default; semántica exacta de Todos/Publicados/Borradores cuando hay versión activa y cambios/operación fallida; conteos excluyendo dimensión propia, no sobre página |
| Crear/copiar/guardar | Body y respuesta completos, identidad de operación y recuperación incierta (especialmente crear sin id devuelto), expectedDraftRevision y consumo por publicación; mapa de provisionales anidados/ChoiceId y errores atribuibles a controles |
| Prefijo | Regla de candidato, normalización/largo/caracteres/reserva/colisión; indicador durable de bloqueo incluso con ActiveVersionId null tras fallo; contador de ejemplo y nuevo prefijo en copia |
| Esquema/validación | Seis discriminadores reales; required/ayuda/límites de texto, decimal string sin pérdida y precisión/escala, DateOnly sin conversión UTC, false/0/ausente, opciones duplicadas/retiradas; group/catalog reservados pero no habilitados |
| Cultura / revisión anterior reemplazada por D5 | E exige autoría es/en y publicación completa sin fallback. Preview orientativa con original marcado; contrato/recibos pendientes en la revisión vigente enlazada al inicio |
| Guardar/409 | Code y forma de errores por pregunta/opción; revisión actual para comparar; qué relectura autoriza recuperar tras red/5xx, sin falso rollback ni merge por índice; guardado tardío con editor cambiado |
| Publicar | Check/diff calculado en servidor, snapshot/cuerpo/hash/requestId, estados y polling GET; qué se consulta/recupera después de 404; primera versión/fallo general/campo/activación local y bloqueo de otro publish |
| Preview | URL autorizada, caducidad, variante/cultura y lista de hosts admitidos/CSP; sin secretos ni link durable en caches/storage; conservar distinción oficial/local |
| Cuenta/elegibles | Resumen con email nullable y fallback autorizado; active/linked y elegibilidad no inferidas del rol; paginado y selección entre páginas, versión que quedó vieja, pérdida de vínculo/permiso durante diálogo |
| Cola/historia | Unión Text/Flow/FlowReply de Outgoing y Message, correlación de operación y mensaje confirmado, receipt/captura; estados nuevos no mapeados a Sent; mismo bloqueo/dedup de Text/Flow |
| Lectura privada | DTO sin valores con whatsapp.read sin formrecords.read, metadata permitida y preview; no body crudo/response_json en cache ni valores ocultados sólo por CSS; revocación y limpieza de páginas históricas |
| Envío | Campo y límite calificado del body interactivo, CTA estándar vs submitLabel, expectedModeRevision y versión elegida; 202 cola, 409/429/Sin confirmar y recuperación existente |

Estas son observaciones para el coordinador/backend, no nuevos endpoints ni ampliación de alcance.
Guardar permanece y los nombres de permisos ya están aprobados. Las observaciones de publicación/TTL
pertenecen a sus incrementos; este front no modifica plan ni contrato del backend.

### Revisión K1–K9 del contrato corregido completo

Se releyó **completo** el contrato revisado (POST/201, PUT/200, GET actual, recuperación histórica,
protección/retención, permisos, lista/facetas, errores y límites de implementación). El coordinador habilitó
el bloque backend con Definition/DraftChanges y recuperación protegida de 30 días. El subconjunto de borrador,
identidad y baseline queda validado para la lógica pura del front. No acredita rutas HTTP/persistencia entregadas.
Las decisiones comunicadas por el coordinador prevalecen sobre los textos desactualizados del contrato:
permisos técnicos y Guardar aprobados; longText default **600**, no 2000; sin UI de configuración nueva.

| ID / estado de revisión | Contrato actual y decisión vigente | Límite o siguiente verificación |
| --- | --- | --- |
| K1 / cerrado en contrato | POST completo + requestId, un commit, 201 con snapshot/mapa/Location; no GET obligatorio ni borrador previo invisible | Probar commit/recarga con API real cuando esté entregada; creación explícita de cero preguntas permitida |
| K2 / cerrado en protocolo | Actor/requestId, comprobante protegido con resultado/mapa original, GET propio aun después de otro guardado; ventana 30 días y tombstone contra replay vencido | Verificar backend 404 en vuelo, 410/retención, autorización y claves. Front congela intento; currentRevision mayor exige revisión; sin UUID tras refresh no hay recuperación por contenido |
| K3 / cerrado | fieldId/replacesFieldId excluyentes; key sólo salida; mapa completo; opciones por fieldLocalId + localId; retirada/reemplazo sin resurrección | Lógica pura prueba el enlace por identidad y snapshot; reconciliación de retiradas tras 409 espera elección D, sin merge automático |
| K4 / cerrado para el contrato anterior; reabierto por D5 | Help nullable/localizado, idioma base/fallback y preservación de mapas; seis tipos manuales. Texto largo default600; sin precision/scale/rangos editables nuevos | Contrato actual distingue default600 de ejemplos con límite explícito2000 válido. El guard conserva ambos idiomas y la cota explícita; no hay editor de idiomas ni UI nueva de configuración |
| K5 / cerrado por usuario | formtemplates.read/manage/publish y formrecords.create/read aprobados; Read+Manage al escribir, Read al listar/leer/recuperar propio; capability forms sólo con recorrido real | Confirmar entrega del bootstrap/permisos/DI antes de rutas. Revocar Manage bloquea escritura; Read sigue permitiendo recuperación propia. Lectura privada futura suma whatsapp.read |
| K6 / cerrado en contrato | Query/whitelist/facetas completas; lastChangedAtUtc efectivo no null, autor autorizado nullable con guion; sin recordCount/Respuestas | Lista real y conteos esperan consumidor A/API; no inferir Published del badge ni simular filtros sobre página |
| K7 / cerrado en contrato | Paths indexados al cuerpo congelado con localIds de ese intento; ProblemDetails y 409 diferenciados; GET actual para RevisionConflict | Integrar errorFeedback común al montar; nunca aplicar índices a otro orden/editor ni tratar RequestConflict como revisión vieja |
| K8 / cerrado baseline/destino; D pendiente | Descartar vuelve al baseline local; releer es otra acción. Guardar permanece con notificación común; Volver al listado. Draft siempre presente en este recorte | Elegir comparación/relectura D y representar guarda de salida en B; no reconfirmar destino. draft=null/publicación pertenecen a otra etapa |
| K9 / cerrado | Seis combinaciones propuestas: crear/listar/facetas/obtener/guardar/recuperar; sin copiar/eliminar/publicar | Este bloque no llama endpoints ni monta UI; operaciones posteriores siguen fuera |

**Brechas reales restantes:** montar/elegir A/B/C/D en el Artifact original e integrar el consumidor en sus
superficies. El backend cerró sus seis rutas con la evidencia final enlazada abajo; HTTP/retención ya no se
consideran inexistentes. Persistir metadata para resume tras refresh queda sin implementar; no es
una recuperación prometida por la lógica en memoria. No sigue abierta la creación completa, el mapa recuperable,
el permiso ni el destino de Guardar. Meta, publicación/chat/captura y pools físicos siguen fuera de este bloque.

## Primer bloque no visual: evidencia de lógica pura

Esta sección registra el incremento anterior al cliente/hooks. `src/features/business-forms/model.ts` expresa el subconjunto revisado de contenido/localIds, snapshot canónico
y resultado con mapa/recuperación. `draftSession.ts` contiene transiciones puras; no cliente HTTP, hook, router
ni dependencia de otra feature. La responsabilidad queda en el área, porque sólo formularios conoce estas
identidades y reemplazos; no se mueve un mecanismo específico a shared por anticipación. AGENTS/CLAUDE,
la guía padre y el mapa ubican el nuevo código real.

- Alta parte de un baseline local; al guardar congela requestId y contenido completo. Edición incluye la
  revisión confirmada y definición conocidas, con key sólo en snapshot, sin mandarla como entrada.
- El mapa se comprueba contra las preguntas/opciones del intento, parent localId, IDs y key canónicos.
  Snapshot/mapa/baseline se aplican juntos; copia profunda conserva mapas de idioma y opciones. Reemplazo
  recibe FieldId nuevo y elimina replacesFieldId del siguiente guardado confirmado.
- Actor/editor/requestId deben coincidir. Callback de otro actor/montaje/intento o respuesta duplicada no
  modifica el editor ni un guardado posterior. El dueño futuro deberá crear editorId por montaje y retirar
  referencias al perder lectura/sesión/desmontarse; este bloque no monta ese ciclo React ni lo acredita.
- Saving/Unconfirmed impiden edición, otro Guardar y descarte. Resultado/mapa inconsistente conserva
  incertidumbre. Recuperar revisión original con currentRevision mayor establece ReviewRequired, sin
  usar la revisión más nueva para sobrescribir. La reconciliación/merge sigue sin implementar hasta D.
- Rechazo explícito de validación conserva lo escrito/baseline y permite corregir; RevisionConflict,
  IdentityRetired y PrefixLocked exigen revisión; RequestConflict conserva el intento original. No se
  interpreta 404, cancelación o falla de transporte como rechazo definitivo. No hay retries automáticos.

Estos valores sólo viven en memoria. El código no escribe storage, URL, logs ni MutationCache; tampoco
emite feedback propio. No implementa todavía presupuestos finales, sugerencia de prefijo, render/preview,
QueryCache de lecturas ni transporte. Reutilizará shared/api/query/MSW al montar el consumidor acordado,
sin usar dobles para presentar como existente una API aún no entregada. La restauración tras refresh
sin UUID/cuerpo permanece fuera de la garantía.

| Verificación de esta ronda de código | Resultado y límites |
| --- | --- |
| TDD inicial | Test escrito antes de implementación; primera ejecución falla al resolver draftSession ausente. Implementación posterior pasa 19 pruebas |
| TDD de rechazos | Cinco casos nuevos fallan por rejectDraftSave ausente; tras implementarlo, 24/24 pasan |
| npm run build | Correcto, TypeScript + Vite. Aviso PLUGIN_TIMINGS: 1,1 s de 4,1 s (28%); hooks Tailwind/CSS/build-html superpuestos. Misma configuración/dependencias y superficies; no se suprime ni se atribuye a una falla funcional |
| npm run lint en sandbox | Oxlint sin errores; 44 tests pasan y una suite no carga por ENOENT del cliente temporal de Vitest. No se declara verde |
| npm run test en sandbox | 96 suites no cargan por ese temporal; una suite/60 tests pasan. No se confunde con regresión reproducida ni suite verde |
| npm run lint repetido con aprobación del entorno | Mismo código/arnés fuera del sandbox: tres archivos, 48 pruebas de arquitectura, correcto |
| npm run test repetido con aprobación del entorno | Mismo código/arnés: 97 archivos, 1038 pruebas, correcto. Vitest informa costo jsdom/aislamiento (97 entornos); no se modifica isolate/pool ni se silencia |
| Revisión manual | Límites de dependencia, formas del contrato, mapa por identidad, snapshot/revisión y scope de callbacks; sin montaje ni IO de contenido privado. Suites no acreditan HTTP, permisos, persistencia, cifrado o limpieza del futuro ciclo React |
| Visual/navegador | Lectura final en Chrome del original confirma fuentes de listado/editor en Help del lienzo. Sin cambios de UI: no test:visual, nuevas capturas ni servidor. Autoría AB sigue pendiente del acceso descrito |

## Segundo bloque no visual: cliente HTTP y hooks

Se releyeron el contrato actual completo, la guía funcional, controllers/contratos HTTP/modelos reales,
validadores/policy/códigos del backend y las [decisiones consolidadas del borrador durable](../../../ArquitecturaBase/docs/features/formularios.md).
La evidencia backend declara build0warnings y 2404/2404 con Docker después de corregir title410; migración
generada y probada, no aplicada a una base local/desplegada. No se ejecutaron sus checks desde este chat.

- `api/forms.ts` implementa lista, facetas, detail, creación, actualización y recuperación propia sobre
  httpClient. Lista usa PagedResult directo; detail conserva definition/capabilities/audit y guardados
  devuelven commit directo. Recuperación conserva kind/status/committedAtUtc/currentRevision/result original.
- `api/response.ts` usa Zod existente, sin dependencia nueva: valida formato1, seis tipos, IDs/revisiones,
  cultura/mapas, configuración nullable real .NET y ruta propia. Sólo retira maxLength/options nulos fuera
  del tipo aplicable; rechaza campos/tipos desconocidos, traducción base ausente e identidades duplicadas.
  No captura issues con contenido privado. maxLength2000 explícito sigue válido; default largo600 está
  probado mediante entrada null y snapshot canónico600, sin reemplazo global de valores.
- `useFormQueries` conserva transporte/QueryClient comunes y claves de actor/permisos/cultura/filtros.
  Cancela/limpia lecturas privadas; no notifica antes del dueño visual. `useFormDraftEditor` crea editorId
  por montaje, aplica mapa/snapshot/baseline juntos y conserva intento congelado sólo en memoria, fuera
  de MutationCache/storage/URL/logs. Cambiar actor/cultura o perder Read limpia; quitar Manage bloquea
  escrituras y permite recuperación con Read. Resultados de montajes anteriores no afectan el nuevo.
- Transporte/5xx/cancelación de escritura conservan incertidumbre. 404 propio puede estar en vuelo; sólo
  replay explícito tras ese 404 repite el mismo UUID/cuerpo. 410 conserva estado vencido y bloquea replay.
  El hook no sigue recovery.path del payload. Recuperación de revisión anterior confirma su baseline
  original y bloquea escritura si currentRevision es mayor; readCurrent prepara comparación sin merge,
  adopción automática ni sustitución de baseline. La decisión visual D continúa pendiente.
- `validationPaths` sólo liga paths conocidos a handles del cuerpo congelado: localId de pregunta y
  opción junto a su padre. Se conservan códigos reales PrefixTaken/IdentityInvalid y los cuatro409.
  Cancelación de lecturas/callback superado no emite error; validación conserva todas las traducciones.
- La revisión de lint corrigió efectos que provocaban renders adicionales y dependencias incompletas,
  sin supresión. StrictMode desconecta/reconecta efectos antes de interacción: active bloquea callbacks
  al instante y una microtarea libera la referencia tras desmontaje real, sin romper la reconexión.

La responsabilidad se mantiene en la feature: el protocolo de identidades/borrador sólo lo consume
Formularios. No se creó transporte, proveedor de caché, política de notificaciones ni mecanismo de
storage alternativo. Las escrituras privadas siguen el patrón existente de editores sin MutationCache;
los hooks sólo entregan estados/códigos/campos hasta montar errorFeedback/notifications en el dueño visual.

| Verificación de este incremento | Resultado y límites |
| --- | --- |
| TDD cliente | Primero falla import forms ausente; luego 11/11. Ampliación detectó en rojo traducción base ausente e IDs duplicados; ambos corregidos sin descartar contenido |
| TDD hooks | Primero falla import useFormDraftEditor ausente. StrictMode en raíz falla y pasa con corrección del ciclo de vida. El 410 de escritura falla como uncertain y pasa como expired, conservando intento y bloqueo de replay |
| Pruebas enfocadas finales | 71/71 en tres archivos: 24 puras, 15 API/MSW y 32 hooks/MSW; cuerpos exactos POST/PUT, página/facetas, parent map, paths congelados, incertidumbre/in-flight404/410 en lectura y escritura, replay explícito, revisión histórica, permiso/actor/cultura/montaje y QueryCache/MutationCache |
| Entorno | Focus y lint en sandbox fallaron al cargar un temporal cliente de Vitest (ENOENT); mismos comandos/arnés fuera del sandbox superaron ese bloqueo. No se silenció consola ni cambiaron tolerancias, handlers, isolate/pool |
| npm run build final | Correcto, TypeScript y Vite, sin advertencias. Dos builds aprobados posteriores producen el mismo CSS main-BGwGEi1A (83,01 kB); no cambios en index.css/vite.config. El build inicial en sandbox había informado 130,21 kB; no se conserva su salida para comparación byte a byte ni se atribuye la diferencia a una modificación visual |
| npm run lint final | Oxlint sin advertencias; 48/48 pruebas de arquitectura en tres archivos, fuera del sandbox tras el ENOENT documentado |
| npm run test final | 1085/1085 en 99 archivos, 52,73 s; incluye el 410 de escritura. Vitest informa costo de aislamiento de 99 workers; no se cambió isolate/pool ni se silenció el diagnóstico |
| git diff --check | Correcto; avisos habituales de futura conversión LF→CRLF, sin cambiar configuración. Revisión de fuentes y rutas afectadas: sólo front, sin cambios en router/menú/UI ni backend |
| Revisión manual | Wrappers/códigos y nulabilidad .NET contra código real; alcance exclusivo front, fronteras de imports, ruta propia y memoria privada; no rutas/menú/UI ni nuevos paquetes |
| Visual/integración | Sin cambios visuales: no navegador/test:visual/capturas nuevas. MSW acredita el consumidor, no un recorrido real SPA/API/DB. No Aspire/Vite ni llamadas Meta/publicación |

## Evidencia acumulada y siguiente paso

Revisión realizada: fuentes completas indicadas, doce imágenes, código de rutas/panel/chat/transporte/cache/UI
y límites de composición. La ronda acotada añadió recetas L1/L2/E1–E5, textos es/en y revisión completa del
contrato propuesto. Esta continuación relee el contrato completo, cierra K1–K9 con las decisiones recibidas
y añade lógica pura, cliente/guard HTTP y hooks con instrucciones/mapa. La comprobación previa del Artifact,
sus menús y AB conserva el bloqueo de autoría exacto indicado arriba; no se declara escritura de tableros.
No se montaron superficies. Los nuevos fixtures MSW reflejan el contrato backend entregado con datos
ficticios; no se probó el recorrido real SPA/API/DB ni Meta desde este chat. Los checks se distinguen por ronda;
las rondas anteriores de sólo Markdown no repitieron suites.
Los checks **anteriores del incremento 0** se conservan como evidencia de base, no acreditan formularios:

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

El siguiente paso de esta preparación anterior quedó reemplazado por el estado vigente del inicio:
A–E ya están elegidos; la integración parcial se conserva detenida hasta resolver D5 y su contrato.
La evidencia HTTP/hooks anterior no acredita el editor actual ni la adaptación bilingüe.
Al montar las superficies: TDD donde haya lógica; `npm run build`, `npm run lint`, `npm run test`, navegador y
`npm run test:visual`; inspección de capturas es/en/responsive/teclado/contraste, sin silenciar avisos ni
actualizar snapshots para esconder diferencias. Servidores que se levanten se detienen al finalizar;
esta preparación no levantó Aspire ni Vite.
