# Inicio con assistant-ui: verificación del front

2026-10-04. Trabajo sobre main, sin ramas, commits ni push. Se conservaron los cambios anteriores.
El registro conjunto está en [backend](../../../ArquitecturaBase/docs/reviews/2026-10-04-inicio-asistente.md).

## Implementación y revisión

La composición vive en `src/app/AuthenticatedHome.tsx`; la lógica y el adaptador HTTP tipado,
en `src/features/artificial-intelligence/{api/assistant.ts,hooks,assistant,pages/AiAssistantPage.tsx}`.
La biblioteca usa `src/shared/ui/assistant` y el estado confirmado de la API. No se copiaron
transportes, selector ni autenticación del laboratorio. Se reutilizan SessionProvider/httpClient,
TanStack Query, Surface/Button/FormField/ConfirmDialog, notificaciones y formateadores comunes.

TDD cubre envío inmutable/UUID, aceptación incierta, relectura tras conflicto, renovación de sesión,
respuestas tardías tras cambiar de cuenta, permisos actuales, limpieza de caché, teclado/IME,
cancelación solicitada tras recarga, carrera Completed/cancel y avisos únicos bajo StrictMode.
La cancelación esperada se muestra como estado; no produce un toast de error operativo.

Playwright usa las rutas/componentes productivos con contratos ficticios exclusivos de tests.
Once estados × es/en × 1440/390/320, más dos recorridos de aceptación/cooldown y uno de lectura,
GET fallido y confirmación de borrado: 69 casos de Inicio. Se verifica ausencia de desborde, fuentes,
foco al cerrar diálogos, Enter/Ctrl+Enter y preservación de la posición al leer mensajes anteriores.

Las capturas `src/test/visual/screenshots/assistant-*.png` se revisaron manualmente para respuesta
es1440/es320, bloqueo en320 y cancelación solicitada en320. El tablero completo precedió al producto:
`design-lab/history/home-assistant-comparison-2026-10-04/evidence/chosen-*.png`, conservadas
intactas al archivar el comparador. No se pudo sincronizar el Artifact privado.

## Comandos y resultados

La instalación local de npm en PATH tenía un wrapper roto. Se ejecutaron los scripts mediante
`node 'C:/Program Files/nodejs/node_modules/npm/bin/npm-cli.js' run <script>`, sin modificarlo.

| Comando | Resultado final observado |
| --- | --- |
| build | tsc y Vite correctos; 3072 módulos, Vite 1.01 s, sin advertencias del build; chunk AiAssistantPage 339.38 kB |
| lint | oxlint y 48 pruebas de arquitectura correctos; Vitest 3.53 s |
| test -- --maxWorkers=1 | 1003/1003 pruebas, 95 archivos, 297.92 s |
| test:visual | 185/185 casos, 3.0 min, código de salida 0; test-results/visual/.last-run.json: status passed y failedTests [] |

La ejecución serial de unitarios conserva aserciones y timeouts: las corridas paralelas bajo
contención con backend tuvieron timeouts de transform/carga en pantallas existentes. Se precargaron
los módulos reales de página en sus tests sin alterar los límites de espera. La suite serial completa
pasó. Una primera visual final tuvo 184/185: el caso previo de contraste dark-palette no instalaba
el handler falso de renovación anónima que usan los otros seis casos públicos. Se movió ese mismo
handler a beforeEach para cubrir los siete casos, sin alterar el producto, contraste ni timeout.
La repetición junto a build/lint tuvo ocho timeouts iniciales en session.html, sin errores JavaScript:
la hidratación de las rutas no llegó a pedir /api/me. La siguiente corrida visual aislada pasó todos
los casos, incluidos esos ocho, sin cambios de producto ni arnés de sesión/WhatsApp. La concurrencia
es una explicación probable, no una causa demostrada. No se alteraron timeouts o aserciones.

## Retirada en copia aislada

Se copió src/public y los archivos de build a una carpeta sin .env, certificados, secretos ni .git.
node_modules es una junction a las dependencias instaladas, no una copia ni una mutación del original.
Se quitaron la feature artificial-intelligence, las primitivas assistant, sus tres namespaces,
rutas, navegación, composición del módulo y dependencia @assistant-ui/react del manifiesto/lockfile.
Inicio quedó compuesto sólo con DashboardPage. El catálogo visual completo se excluyó de esta copia.

Build correcto sin módulos/chunks IA, lint con 48 pruebas de arquitectura y 104 pruebas base en
11 archivos correctos (35.70 s): Home, layouts, ajustes, timer y sus consumidores. Una ejecución
del build registró una advertencia de medición de tiempo de plugin por carga de CPU; no hubo
advertencias TypeScript. No se corrió la suite visual en la copia ni se hizo una nueva instalación
desde cero. La copia recuperable está en `../ArquitecturaBase/artifacts/front-without-ai`; para
repetir lint debe ubicarse fuera de artifacts, porque las reglas originales excluyen ese directorio.

## Laboratorio y límites de la evidencia

El tablero activo contiene sólo la biblioteca elegida en `design-lab/home-assistant/chosen`.
Su TypeScript pasó. Comparación, lockfile, vendor, dist y evidencia original se movieron intactos
a `design-lab/history/home-assistant-comparison-2026-10-04`. En la ubicación previa permanece
la caché node_modules por un archivo en uso; no se borró ni se detuvo un proceso desconocido.

Datos, cuentas, API y proveedores visuales son simulaciones. Estos tests no acreditan acceso
facturable a OpenAI/Anthropic, perfiles de producción, restauración operativa ni sincronización
del Artifact. PostgreSQL/Redis, handlers de ambos proveedores y concurrencia entre hosts se
verifican por separado en el registro backend. No se levantó Aspire desde este trabajo del front.
Los servidores Vite propios se identificaron por PID/comando antes de cerrarlos; el último PID 63900
se cerró después de completar los 185 casos, porque el teardown demoraba en Windows. Playwright
terminó con código 0. No queda un servidor iniciado por este trabajo ni se detuvieron procesos ajenos.
