# Inicio con asistente: elección y procedencia

2026-10-04. Pedido de estudiar el Inicio autenticado como chat que consulta el sistema.
**assistant-ui elegido por el usuario; front productivo implementado y verificación automática local completada.**
El piloto operativo continúa pendiente. La portada pública aprobada conserva su recorrido.
La [regla implementada](../../../ArquitecturaBase/docs/features/inteligencia-artificial.md) fija las propuestas
de permisos, herramientas, datos, proveedores, recuperación, archivos y pruebas.

## Elección e integración implementada — 2026-10-04

### Corrección tras el rechazo del producto

La implementación inicial sustituyó la forma original elegida por un formulario. El usuario
rechazó ese resultado; las capturas chosen-board y las pruebas verdes no acreditan aprobación
de su composición. La referencia visual vinculante son assistant-ui-empty/answer-*.png en
design-lab/history/home-assistant-comparison-2026-10-04/evidence. Se restituye esa disposición
en producto, con su editor y burbujas, manteniendo la integración funcional y los permisos.
El [fundamento visual](visual-baseline.md#inicio-composición-assistant-ui-corregida--2026-10-04)
detalla medidas/estados; el [registro](../verification/inicio-asistente-correccion-2026-10-04.md)
distingue pruebas, revisión y limitaciones.

El pedido de implementación autorizó esta dirección. Antes de programar el producto se amplió el
tablero elegido con primitivas assistant-ui reales y controles compartidos: estados durables,
disponibilidad, permisos, historial y decisiones. Evidencia local es/en a 1440/390/320:
`design-lab/history/home-assistant-comparison-2026-10-04/evidence/chosen-board-*.png`
y `chosen-history/decision-*.png` en la misma carpeta. Se preservaron intactas al archivar el comparador.
El Artifact privado siguió inaccesible; no se acredita sincronización allí. Esta evidencia local
continúa la elección ya aprobada, sin reabrir comparaciones.

La aplicación ahora compone el Inicio en app/AuthenticatedHome, con `@assistant-ui/react` 0.15.23
y estado confirmado por la API. El código del laboratorio y sus transportes no se promocionaron.
Fixtures sólo en tests acreditan la interacción/representación; la revisión conjunta del backend
registra por separado PostgreSQL, workers y handlers falsos. Los perfiles reales/proveedor facturable
y la sincronización del Artifact permanecen pendientes explícitos.

El [registro del front](../verification/inicio-asistente-2026-10-04.md) conserva comandos,
comprobación de retirada y alcance de las simulaciones. Las secciones históricas siguientes
registran la exploración previa; no describen pendientes de implementación ni alternativas vigentes.

## Dirección elegida antes del desarrollo — registro histórico

Después de revisar las cuatro maquetas, el usuario eligió assistant-ui y pidió el plan completo
de integración. ExternalStoreRuntime se adapta al estado confirmado de nuestra API MVC .NET;
la historia propia vive en PostgreSQL y el LLM usa la conexión guardada de la instalación.
La primera entrega propuesta comunica etapas y muestra la respuesta completa validada con fuentes.
No se promociona todavía código del laboratorio ni se acredita generación/persistencia reales.

El plan identifica archivos nuevos/modificados/reutilizados de ambos repositorios, la composición
del Inicio desde app, UI compartida, permisos, fuentes, cultura es/en, TimeProvider/UTC, zona
del perfil, timer común, recuperación, cuotas, retención, proveedores y verificaciones por fase.
Antes del desarrollo se completa el tablero de estados de la biblioteca elegida con las piezas
reales del sistema. La banda Conversación rechazada no forma parte de la elección.

## Comparación de bibliotecas — registro histórico del 2026-10-04

El usuario rechazó el maquetado manual y pidió ver las cuatro bibliotecas mencionadas. La entrada
anterior redirigía al comparador en `design-lab/home-assistant/libraries/`, puerto 5184.
La comparación está archivada en `design-lab/history/home-assistant-comparison-2026-10-04`;
la entrada vigente redirige al tablero elegido, sin selector de bibliotecas.
Pestañas: assistant-ui, AI Elements, CopilotKit y ChatKit. `scene=empty/answer`, `lang=es/en`.
La banda Conversación de la propuesta anterior se retira de esta comparación. Un borde discreto
delimita toda la vista; cada biblioteca compone bienvenida, hilo y editor con sus piezas reales.

Se conservan AppLayout, Public Sans y Campo; las diferencias propias de controles/forma se muestran
únicamente dentro del laboratorio, por el pedido explícito. El mismo ejemplo consulta tres cuentas
activas y una inactiva; enviar una pregunta o repregunta usa respuestas ficticias locales. Historial,
Nueva conversación y confirmaciones externas usan los controles compartidos. Esa ronda no promovió
ninguna; la elección posterior de assistant-ui está registrada arriba.

| Biblioteca | Pieza mostrada |
| --- | --- |
| assistant-ui | Thread oficial del registro, sus componentes y ExternalStoreRuntime con estado local. |
| AI Elements | Conversation, Message/MessageResponse y PromptInput del registro oficial. |
| CopilotKit | CopilotChatView v2 con proveedor, labels y CSS publicados; sin runtime de agentes. |
| ChatKit | Wrapper React y componente/iframe oficiales del CDN; API local ficticia JSON/SSE. |

Dependencias/lockfile propios, fuera del package.json y del bundle productivos. Los componentes
copiados conservan fuentes/licencias en `vendor/`; sólo ese código externo queda fuera de Oxlint.
Se verifican sus tipos y la UI montada. ChatKit carga su UI y fuente desde orígenes públicos; se
observaron avisos de settings/telemetría externos sin impedir el chat. La prueba intercepta Datadog.
Esto se estudia antes de adopción, sin alterar las políticas del iframe ni llamar a un LLM.

Verificación del comparador: **48 combinaciones** (cuatro bibliotecas, vacío/conversación, es/en,
1440/390/320), sin overflow; envío, repregunta, limpieza del editor, historial/Escape y cancelar
Nueva conversación pasaron en las cuatro. TypeScript y build del laboratorio correctos; el build
completo del comparador avisa chunks grandes por sus renderers incluidos. Build/lint del producto
limpios, 949 pruebas en 88 archivos y 116 visuales en verde. El cierre de Vite de las pruebas volvió
a demorarse en Windows; se cerró únicamente su servidor identificado en 5178. No se tocó backend.
Se probó también CDN fallido aislado con recuperación del selector y un único aviso; la entrada
previa redirige correctamente. La respuesta compartida muestra las cantidades como lista para
mantenerlas legibles a 320 px en todos los renderers.

[Recorrido y dependencias](../../design-lab/history/home-assistant-comparison-2026-10-04/README.md),
[evidencia](../../design-lab/history/home-assistant-comparison-2026-10-04/evidence/verification.json),
[assistant-ui](../../design-lab/history/home-assistant-comparison-2026-10-04/evidence/assistant-ui-answer-es-1440.png),
[AI Elements](../../design-lab/history/home-assistant-comparison-2026-10-04/evidence/ai-elements-answer-es-1440.png),
[CopilotKit](../../design-lab/history/home-assistant-comparison-2026-10-04/evidence/copilotkit-answer-es-1440.png) y
[ChatKit](../../design-lab/history/home-assistant-comparison-2026-10-04/evidence/chatkit-answer-es-1440.png).

Las secciones siguientes conservan el diseño y la evidencia de la propuesta manual inicial,
rechazada posteriormente; no se presentan como la alternativa elegida.

## Dirección visual y composición

Conservar Campo, Public Sans Variable, caparazón, medidas y controles existentes. Tokens de referencia
del sistema: canvas/surface `#fff`, nav-surface `#24352b`, topbar `#ecf1e8`, brand `#285a3d`,
content `#1e2b21`, surface-muted `#f2f5f3`; en código se consumen sus roles, no hex por pantalla.
La configuración de Apariencia sigue gobernando el producto.

Inicio mantiene Page y cabecera sin descripción. Acciones: Historial y Nueva conversación. Un ancho
central de lectura deja aire sin llenar la portada de métricas que nadie pidió. Bienvenida de 26 px
en escritorio y 22 px móvil; cuerpo 14–15 px y metadatos 12 px. La pieza distintiva es una respuesta
legible con datos y fuentes comprobables; sin ilustración, degradados, selector de modelo o KPI de relleno.

Se comparó conceptualmente el historial a demanda, un carril permanente y una lista de recientes.
Se propone a demanda: la aplicación ya tiene navegación lateral y sumar un carril produciría tres
columnas. El campo mantiene etiqueta visible, Enter para línea y Ctrl+Enter para enviar como el chat
existente. El tablero no promociona nuevas medidas o componentes al sistema visual por anticipación.

El usuario pidió después **enmarcar la conversación**: se compone Surface con título Conversación,
borde y banda del sistema alrededor de bienvenida/hilo/compositor. Historial y Nueva conversación
permanecen en Page. Este cambio se aplica al tablero local; no introduce una nueva pieza visual.
La evaluación de bibliotecas ([ADR 0017](../../../ArquitecturaBase/docs/decisions/0017-inicio-asistente-y-operaciones-durables.md))
propone assistant-ui con primitivas y ExternalStoreRuntime, conservando nuestra biblioteca y .NET.

## Tablero local revisable

Entrada: `design-lab/home-assistant/index.html`, fuera del router/build productivos.
Por Vite: `/design-lab/home-assistant/index.html?lang=es&scene=empty`.
Idioma `es/en`; estados `empty`, `answer`, `loading`, `paused`, `missing`, `denied`, `uncertain`, `failure`.

Compone AppLayout, Page, Button, FormField, Textarea, NativeSelect, EmptyState, Spinner,
Dialog/ConfirmDialog, Table y notifications reales. CSS sólo organiza composición; no redibuja
controles ni modifica tokens productivos. La barra «Propuesta · datos ficticios» y selector de
escenarios pertenecen al laboratorio y no se promueven.

El contenido y operaciones viven en memoria. Las sugerencias preparan una pregunta; Enviar simula
una consulta y respuesta. Texto distinto pide precisar la pregunta: no es inferencia del LLM.
Consultar estado recupera un fixture; generar otra respuesta confirma posible costo; cancelar
no acredita detener un proveedor. Historial/fuentes/borrado son simulados, no persisten una conversación.
La salida de configuración sólo señala su destino: no abre un formulario ni modifica credenciales.

No se pudo leer el Artifact privado mediante la herramienta web. La propuesta local **no acredita**
sincronización allí ni sustituye silenciosamente la norma de tablero previo. Antes de promoción se
requiere elección explícita y resolver el registro del tablero según visual-baseline/AGENTS.

## Estados y recorridos del contrato elegido

| Hecho | Presentación/recuperación | Dueño del mensaje |
| --- | --- | --- |
| Sin conversación | Bienvenida y ejemplos según capacidades/permisos; ninguna llamada al LLM. | Contenido |
| Carga inicial | Spinner/estado accesible; no confundir con vacío. | Contenido |
| Carga fallida | EmptyState/Reintentar y un toast con causa; conservar borrador. | QueryCache o dueño local, uno |
| Conexión ausente/pausada | Estado persistente; destino configuración sólo con permiso correspondiente. | Contenido |
| Sin ai.assistant.use | Sin chat, ejemplos ni historial; Inicio conserva navegación habilitada. | Contenido/guard |
| Sin acceso a una fuente | No ofrecerla; respuesta explica alcance sin revelar existencia/datos restringidos. | Contenido |
| Pregunta vacía/larga | Error asociado al campo; foco cuando corresponde. | FormField |
| Pending/Running | Estado y Detener; el borrador siguiente no envía otro turno hasta cerrar éste. | Estado del turno |
| Completed | Texto + datos de proyección + fuentes y momento; no toast por cada respuesta normal. | Hilo |
| Failed | Estado del turno y un toast operativo con recuperación permitida. | Acciones/estado, sin duplicar causa |
| Uncertain | Estado persistente, Consultar estado y generación nueva con ConfirmDialog. | Estado + único aviso cuando ocurra |
| 429 | Espera visible en acción y toast común; no repetir automáticamente. | Dueño de acción |
| Nueva conversación con borrador | ConfirmDialog explica pérdida; conservar al cancelar. | Decisión |
| Conversación activa al salir | Consultable en historial; no cancelar por desmontaje/Abort. | Estado durable |
| Eliminar | ConfirmDialog, confirmación de API, retiro del historial, cancelación pedida. | Decisión + acción |
| Pérdida de permiso | Limpiar datos de sesión y bloquear turnos afectados también en servidor. | Guard/estado |

En el tablero, el selector no altera permisos de la cuenta ficticia del caparazón; dibuja el estado
local del asistente. No se infiere autorización real de esa vista. El producto filtra tanto las
acciones de configuración como cada herramienta y fuente.

## URL, memoria, foco y tamaños

URL productiva: `/` o `/?conversacion=<id>`; nunca pregunta/clave/texto. Historia paginada
por página/tamaño, sin búsqueda de contenido sensible en URL. El historial es privado por propietario.
Borrador sólo en editor; resultado confirmado en caché de sesión y servidor, con limpieza común.

Esc y botones cierran diálogos; devolver foco al disparador. Una respuesta no roba el foco al compositor.
Anunciar etapas/final a lectores de pantalla sin leer tokens continuamente ni explicar razonamiento interno.
En móvil, controles apilados, texto envuelto y compositor sin quedar bajo el teclado. No encoger letra
para hacer caber un texto largo. Confirmaciones y Toaster respetan la biblioteca.

## Verificación histórica de la maqueta — 2026-10-04, antes de implementar

Después de enmarcar la conversación, `verify.mjs` pasó las 48 combinaciones de ocho estados,
es/en y anchos 1440/390/320, sin overflow horizontal ni errores de página. También verificó que
las sugerencias preparan el borrador, cancelar Nueva conversación lo conserva, Enviar responde,
las fuentes cierran con Escape, cancelar el borrado conserva historial y Reintentar conserva texto.
Capturas y resultados: [evidence](../../design-lab/home-assistant/evidence/verification.json).

TypeScript del laboratorio y build/lint del producto pasaron. La suite del front pasó 940 pruebas
en 87 archivos; la visual del producto, 116. Su servidor temporal demoró el cierre en Windows:
se identificó por comando/puerto y se cerró sólo ese proceso; Playwright terminó con código 0.
El servidor del tablero en 5182 quedó disponible para revisión.

El backend compiló sin advertencias ni errores en un ArtifactsPath aislado para evitar los DLL
bloqueados por la aplicación ya abierta. La suite completa con Docker terminó con 2169 pruebas
correctas y seis fallidas de integración; Domain, Application y Architecture pasaron. Se observó
un 429 al preparar autenticación en pruebas de invitaciones. No se modificó código del backend
ni se diagnosticó la causa de todas las fallas: queda pendiente una ejecución completa verde.

Estas verificaciones acreditan la maqueta y el estado de las suites ejecutadas; no acreditan
generación, consultas reales o persistencia de conversaciones, que todavía no se implementaron.

