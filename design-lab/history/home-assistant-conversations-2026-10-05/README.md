# Panel interno de conversaciones: archivo histórico

Elegido explícitamente y promovido al código productivo el 2026-10-05. Se conserva este archivo
porque las fuentes y la evidencia del tablero aún no tenían otra copia versionada. `index.html.reference`
preserva la entrada anterior como texto inactivo; las rutas y comandos siguientes son procedencia,
no instrucciones para un laboratorio vigente. La referencia de regresión está en
`src/test/visual/screenshots/assistant-conversations-*.png`, recorrida por `assistant-conversations.spec.ts`.
Títulos autorizados, paginado y navegación están implementados en el producto.

## Registro previo a la promoción

Propuesta para revisar antes de promover. Reutiliza AppLayout, Page y el chat assistant-ui
productivo aprobado. Las conversaciones, consultas, borrado y respuestas sólo existen en memoria.

Entrada sobre un Vite del repositorio:
`/design-lab/home-assistant/conversations/index.html?lang=es&scene=empty`.

`scene`: empty, answer, loading, error, noHistory, blocked, expired, active, uncertain, denied.
`panel=closed` empieza plegado en escritorio. `review=1` oculta los controles del laboratorio.
El botón de conversaciones abre un drawer en móvil. Español e inglés; datos ficticios.
Pagination compartida con dos páginas de seis fixtures; `page` queda en URL.
La implementación propuesta conserva el tamaño productivo de 20, no seis.

No se instala ningún paquete ni se modifica la ruta de Inicio. Los títulos de muestra no
acreditan una implementación backend. El plan compartido define su derivación autorizada.

Plan: ../../../../ArquitecturaBase/docs/plans/2026-10-04-panel-conversaciones-inicio.md.

Verificación reproducible: `node design-lab/home-assistant/conversations/verify.mjs` desde el front,
con Vite en 5182 o `CONVERSATIONS_PREVIEW_ORIGIN` apuntando al servidor de laboratorio.
Capturas y resultado en `evidence/`; la simulación no acredita títulos, borrado o generación reales.

Verificación del 2026-10-04: 34 recorridos, es/en, 1440/390/320, abierto/plegado,
drawer con Escape/foco, borrador, eliminación, envío local, paginado y aceptación incierta.
Sin overflow horizontal, errores sin manejar, avisos de consola ni llamadas al asistente.
TypeScript del tablero, build y lint del front en verde; Vitest: 95 archivos, 1.009 pruebas.
Se corrigieron dos selectores del runner (nombre localizado/rol de Dialog) y el remount del
provider del laboratorio que desconectaba el formulario al crear la primera conversación.
Las capturas revisadas no acreditan sincronización del Artifact privado.

## Refinamiento solicitado del panel

El usuario pidió una base similar a Codex/Claude. assistant-ui publica
[ThreadList](https://www.assistant-ui.com/elements/thread-list) y
[ThreadListSidebar](https://www.assistant-ui.com/elements/thread-list-sidebar).
La maqueta usa ThreadListPrimitive, ThreadListItemPrimitive y More nativos de la versión
instalada, con botones/tokens del proyecto. No se afirma usar la biblioteca interna de esos productos
ni haber instalado el template completo. Sidebar claro de 256 px, una línea por conversación,
sin fechas repetidas; acciones «…» en hover/foco/selección o siempre en táctil.
La confirmación de borrado sigue siendo de la aplicación; no hay Rename/Archive sin contratos.

`ConversationRow.tsx` presenta filas/grupos nativos; `conversationActions.ts` transporta la acción
de confirmación. Se derivan los índices desde el snapshot del runtime, evitando el scope inválido
al aceptar la primera conversación. Antes de abrir ConfirmDialog se devuelve el foco al disparador
persistente de la fila: el item del menú desaparece. La aceptación ficticia es asincrónica.

El adaptador de listado ExternalStore está marcado experimental/deprecated en 0.15.23; la versión
permanece fijada y la integración productiva requiere una frontera y regresiones propias, detalladas
en el plan. No se agregaron paquetes, llamadas al proveedor, rutas ni tablas.

Verificación final de esta revisión: **36 recorridos** es/en/responsive, incluidos teclado nativo,
Escape, cancelación de borrado con foco/borrador y menú dentro del drawer móvil; consola limpia.
TypeScript/build/lint y **1.009 pruebas** del front en verde. La suite visual productiva confirmó
**191 casos** sin cambiar sus referencias. Su teardown de Vite quedó esperando en Windows;
se detuvo exclusivamente su PID 2496, identificado por el log de esta ejecución, y terminó con
exit 0. Los Vite previos del laboratorio y la instancia del usuario se conservaron.
El warning de NO_COLOR/FORCE_COLOR pertenece al lanzador de Playwright; no se suprimió.
