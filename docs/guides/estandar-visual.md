# Estándar visual aplicado

Vigente desde el 2026-09-30. Conserva el diseño de los componentes y aplica los colores
Campo elegidos el 2026-10-02, según el
[fundamento visual](../design/visual-baseline.md), con las
[premisas de interacción](premisas-de-desarrollo.md). Es la misma biblioteca para todas las features.

## Refinar el diseño existente

El usuario confirmó el 2026-10-01 que le gusta el diseño actual. Se conservan Public Sans,
la escala compacta, el menú y el caparazón. El alcance es transversal: cada pantalla existente
y cada formulario nuevo componen las mismas piezas. Multitenant puede aportar una idea de
organización; sus radios, tamaños y layout no reemplazan el sistema de ArquitecturaBase.
La elección de Campo del 2026-10-02 cambia únicamente los colores globales.

Antes de agregar una pieza, buscarla en `shared/ui` y probar su variante en el catálogo local.
Una necesidad de apariencia compartida se resuelve en esa biblioteca; la feature decide los
datos, anchos, distribución y comportamiento funcional. Mejorar la separación por tema no
exige cambiar de colores ni generar una copia visual para cada formulario.

El usuario eligió la agrupación de Configuración el 2026-10-01. Está implementada en
`/configuracion` con layouts, tokens y controles reales; las cuatro URLs previas redirigen allí.
El laboratorio se retiró al promover la elección. El PATCH guarda el conjunto de campos cambiados.

## Qué compone una pantalla

| Necesidad | Pieza común | Responsabilidad de la pantalla |
|---|---|---|
| Cabecera, acciones y margen | `Page` | Título, estado y acciones |
| Búsqueda y filtros | `FilterBar`, `SearchInput`, `Picker trigger="button"`, `FilterChip` | Opciones, permisos y estado de URL; sin cantidades por opción (2026-11-22) |
| Listado | `Surface` con `DataTable` y `Pagination` | Columnas, datos y estados |
| Tabla especial | `Surface` y primitivos `table` | Columnas y semántica; `TableRowHeader` identifica filas de una comparación |
| Columnas de números | `numeric` en `TableHead` y `TableCell` o en la columna de `DataTable`; la línea entre columnas la pone la biblioteca en toda tabla | Cuáles columnas son números (cantidades, medidas, importes, número de fila) |
| Secciones de una tabla | `TableSectionToggle` | Estado abierto, nombre, descripción y selección |
| Superficie con título | `Surface` | Título y contenido; `headingLevel` conserva la jerarquía y `titleRef` permite devolver el foco |
| Formulario | `FormField`, `Input`, `Textarea`, `Picker`, campos especializados | Valores, reglas y errores de campo |
| Formulario corto | `DialogContent`, `DialogHeader`, `DialogFooter` | Campos y acciones; conservar `useRestoreFocusOnClose` |
| Decisión extensa en móvil | `DialogContent mobileFullscreen`, cuerpo desplazable y `DialogFooter` fuera del scroll | Variante optativa; conserva el diálogo predeterminado en otros usos |
| Decisión previa | `ConfirmDialog` | Consecuencia y acción concreta |
| Un sí o no suelto | `CheckboxField`, `Checkbox` para tablas | Estado y validación; elegir entre alternativas es `Picker` (2026-11-22), y `RadioGroupField` queda para las vistas previas que imitan WhatsApp |
| Elegir una o varias opciones de una lista, en un campo o en el botón de una barra | `Picker`, la única pieza; la zona horaria, con la lista `timeZoneOptions` | Las opciones (su descripción, su motivo si están apagadas), la primera («Todas», «Sin …»), lo vacío, el tope y, si busca el servidor, la búsqueda, la cantidad, la carga y el error; nunca un select, un combo ni un menú propios. Todo lo que se elige va en la pieza (2026-11-22, por decisión del usuario): también dos a cuatro opciones fijas, un Sí o No, los filtros de los listados, sin cantidades, la carga de un formulario y «Correo | WhatsApp» del acceso; nunca radios, un segmentado ni una lista de casillas ([elegir de una lista](../design/visual-baseline.md#elegir-de-una-lista), DS1-A y DS2-A) |
| Opción elegida | `SegmentedControl` (rellena), `Picker` (tilde a la izquierda; en varias, la casilla), `DropdownMenuRadioItem` (tilde, en un menú de acciones), `DataTable selectedRowKey` (barra y tinte) | Cuál está elegida o abierta; la biblioteca la marca con algo más que un tinte (OE1-A) |
| Lectura de algo que pasa en orden (una regla, una sugerencia) | `StepList` | Un paso por parte con su ícono; palabras que unen en gris y datos en negrita ([lecturas](../design/visual-baseline.md#lecturas), LR1-A) |
| Datos de un registro, sin editar | `DataList` | Rótulos y valores ya formateados, en dos columnas; nunca «Rótulo: valor» en un renglón |
| Lo que se lee de una cuenta: medios de ingreso, el chat de su número, el último ingreso | `AccountRows` y `AccountRow` | Ícono, dato, valor ya formateado, estado (`VerificationBadge`, con `hint` si hay un porqué) y acción; la lista elige un renglón, el dato arriba del valor o la acción junto al dato según el ancho de su contenedor (PF1-A) |
| Dos versiones comparadas (una revisión antes de guardar, los cambios de una importación) | `ComparisonTable` | Qué cambió, cada dato una vez y las dos versiones en su columna, sólo lo distinto; en el celular, apilada sin desplazar ([lecturas](../design/visual-baseline.md#lecturas), LR2-A) |
| Íconos y acciones | `shared/ui/icons`, `IconButton`, `RowActions` | Nombre traducido, permiso y operación; en una fila de tabla, sólo íconos, nunca un botón con texto ([regla](../design/visual-baseline.md#íconos-y-acciones), 2026-11-20) |
| Ayuda contextual | `ActionTooltip` | Texto y control alcanzable con teclado; sin `title` nativo |
| Explicación de un campo, una sección o una opción | `InfoTip`, `help` de `FormField`, `Surface`, `Page`, `CheckboxField` y `RadioGroupField` | La (i) con su tooltip; nunca un texto debajo o al costado (`hint` y `description`, sólo datos) |
| Acción que tarda | `Button`/`IconButton` con `pending`, `ConfirmDialog` con `pending`, `Table`/`DataTable` con `refreshing` | Aro y gerundio en el botón, confirmación abierta hasta la respuesta, filas atenuadas con la línea que corre; nunca sólo apagar el botón |
| Gráficos de un tablero (DOC7-A) | `StatCard`, `BarChart`, `BarList` y `ChartRefreshing` (`shared/ui/charts`) | El número y su variación ya escritos, los baldes o las opciones con sus valores y fechas formateados, el título de la tarjeta y «Ver como tabla»; los colores salen de `--chart-1..5`, `--chart-quiet` y `--chart-track` |
| Motivo de un deshabilitado | `DisabledReason`, `disabledReason` de `CheckboxField` y de una opción de `RadioGroupField`, y `disabledLabel` de `IconButton` | Motivo traducido, sólo si no es obvio, sobre el mismo control: se abre con el mouse, el foco, un clic o un toque; sin íconos ni textos al lado ni debajo (MA1-A) |
| Conversación | `MessageHistory`, `MessageBubble`, `MessageDateDivider` | Orden/origen de los mensajes, día del perfil, formato común, estado confirmado y acciones permitidas |

`Surface` no recibe clases ni estilos de apariencia. Su banda puede crecer con el título en móvil.
`DataTable` vive en esa superficie; sus vacíos y errores usan `EmptyState embedded`, sin otro borde dentro.
Configuración reúne preferencias regionales, listados y registro en tres `Surface` con banda y margen interno, y una única cabecera con guardado explícito. La revisión compara los cuatro ajustes con la tabla común. Roles separa los datos del rol y sus permisos en dos `Surface`, sin barra de filtros entre ellas.
El pedido del 2026-10-01 delimita los campos con borde y margen interno, sin exigir una banda
ni repetir el título de Page. El cuerpo de las tablas alterna blanco y el tono Campo suave con
`table-row-alternate`; `table-row-hover` marca la interacción y selección/bandas mantienen prioridad. Los permisos de un
rol son áreas plegables, iguales en escritorio y en el celular (RO3-D, 2026-11-19, en
[roles y permisos](../design/roles-y-permisos.md)): cada área es una banda `TableRow tone="section"` con
`highlightExpanded=false` y, abierta, sus permisos blancos debajo (`TableBody striped=false`), como eligió el usuario el
2026-10-03 para la tabla anterior. En el celular, cada fila mide 44 px.
Mi perfil se arma como Configuración (PF1-A, 2026-11-03): sus zonas una debajo de la otra, con `Surface`, los campos del
ancho de lo que llevan (en el celular, todo el ancho) y Guardar en la banda, apagado sin cambios. Los medios de ingreso y el
chat de WhatsApp se leen en `AccountRows`, la misma pieza que «Editar usuario».

## Medidas y variantes

Los valores se definen en `src/index.css` y se consumen desde la biblioteca.
Las cabeceras de `DataTable`, del editor y de comparaciones comparten `TableHead`.

| Uso | Valor común |
|---|---|
| Tipografía | Public Sans; cuerpo 14 px, detalle 12 px, rótulo 11 px |
| Controles y botón común | 30 px; variante chica 26 px |
| Tabla de administración | Fila mínima 36 px, cabecera 32 px |
| Radios | Control 5 px, superficie y diálogo 6 px |
| Acceso público aprobado | Botones desde 44 px, campos desde 46 px |

Las filas pueden crecer cuando el contenido ocupa varias líneas. Los controles de selección de permisos
conservan sus blancos táctiles de 44 px en móvil. Un mínimo no recorta contenido para forzar una altura exacta.

`Button` ofrece variantes principal, secundaria, terciaria, destructiva, destructiva con borde (`destructive-outline`, para quitar algo antes de confirmarlo) y enlace; `size="inline"`
es la acción de texto de filtros y `size="touch"` permite el tamaño táctil aprobado.
`SegmentedControl` tiene una sola forma, compacta, con la elegida rellena con el tono de los enlaces y su tinta, el foco
por fuera y 44 × 44 px por opción en el celular ([OE1-A](../design/visual-baseline.md#opción-elegida--2026-11-03)). Desde
el 2026-11-22 sólo lo usa la vista previa de un catálogo; `appearance="public"`, la selección subrayada del acceso, quedó
sin consumidores cuando «Ingresar con» pasó a la pieza y se retiró el 2026-11-23 con las demás variantes sin uso.
`Input` y `Textarea` definen el aspecto de solo lectura.
Una feature elige variantes y distribuye contenido; no cambia fondo, texto, radio o alto de un control.

Para el rótulo tipográfico se usa `text-[length:var(--text-caption)]`: la pista `length` evita que
el combinador de clases interprete el nombre como color y elimine el tamaño al combinarlo con el tono.
La prueba con navegador verifica el tamaño calculado, además de comparar la captura.
Los colores del logo de Google pertenecen a la marca externa y están encapsulados en `shared/ui/GoogleIcon`.

## Controles que se ejecutan

`npm run lint` ejecuta Oxlint y las reglas de diseño. `npm run test` también incluye esas reglas.
`npm run test:design` permite ejecutarlas por separado. Inspeccionan la sintaxis TypeScript de las features:

- Controles y tablas nativos deben usar la biblioteca compartida.
- Colores de otra paleta, tamaños de texto y radios numéricos propios no se permiten.
- Una feature no aporta estilos inline ni archivos CSS, SCSS o Less.
- Botones, campos y cabeceras eligen variantes; no sobrescriben su apariencia con clases.
- Checks, switches, desplegables, superficies de modal y tooltips tampoco reciben otra apariencia desde una feature. Los tamaños de diálogo, scroll y distribución necesarios para su contenido sí pertenecen a su composición.
- Las features consumen íconos desde `shared/ui/icons`, sin SVG ni imports de otro set por pantalla. El acceso público conserva sus dibujos Lucide aprobados a través del mismo módulo; no se cambia su aspecto para centralizar el import.
- Los tooltips usan `ActionTooltip` e incluyen teclado. Un `title` nativo en un dato o acción no cumple ese contrato.
- Una fila no redefine su densidad. Los listados usan `Surface` y no duplican su caja.
- El Toaster se monta una sola vez en los providers; su adaptador no expone props de apariencia.

Los anchos, columnas, alineación y distribución que dependen del contenido siguen perteneciendo a la pantalla.
Esto no prueba toda la percepción visual ni toda la accesibilidad: completa las pruebas de comportamiento
y la revisión con navegador. Un requisito nuevo se resuelve en la biblioteca, no relajando el control
para copiar una variante local.

## Catálogo y revisión con navegador

`npm run catalog` abre el [catálogo local](../../src/test/visual/index.html) en el puerto 5178.
Su entrada, datos ficticios y sesión simulada viven en `src/test/visual`; no se incluyen en las entradas
del build ni agregan rutas productivas. No requiere una API ni hace escrituras reales.
Muestra los componentes reales con sus variantes, campos normales e inválidos, carga, vacío y recuperación.
Incluye Input, Textarea, radios, checks, búsqueda y segmentados,
además de botones con ícono, tooltips de acciones deshabilitadas (con ícono y con texto, `DisabledReason`)
y un formulario corto en Dialog.
La variante `?scenario=mobile-dialog` muestra `mobileFullscreen`: al abrir el formulario, el cuerpo se desplaza y el pie conserva sus acciones en móvil.
Los diálogos de baja, reactivación y eliminación de formularios aplican esta variante en móvil, con el cuerpo desplazable y el pie fuera del scroll.
La variante `?scenario=item-table` muestra la tabla de ítems de un bloque y sus recuadros (RG2-A): vacía, con el máximo, con errores y en una columna.
La variante `?scenario=pickers` muestra la pieza para elegir (DS1-A y DS2-A): una y varias, con «y N más», «Sin …» primero, un tope con una opción apagada, la zona horaria, el botón de una barra y una búsqueda del servidor; `pickers.spec.ts` la abre en es/en a 1440, 390 y 320 px, sin referencia versionada.
La variante `?scenario=assistant-attachment` muestra el clip y el archivo del asistente (IA4): elegido en el editor con su X, mientras viaja y en un mensaje con sus filas.
La variante `?scenario=charts` muestra las piezas de un tablero (DOC7-A): el número con su variación, con «—» y su motivo y mientras carga; las barras por día con los días sin respuestas y sus fechas, y cuatrocientos días en una tarjeta; los repartos, los estados y sus tablas; vacío y mientras vuelve a leer.
También permite revisar rutas existentes con `?screen=/usuarios`, `?screen=/roles/support` o `?screen=/perfil`.

Preparación en otra instalación:

```powershell
npm ci
npx playwright install chromium
npm run test:visual
```

La suite levanta Vite, lo detiene al terminar y compara capturas con los
[archivos versionados](../../src/test/visual/screenshots/). Hay una escena por área (86 archivos `*.spec.ts`):
administración, perfil, acceso público, catálogo, Inicio, IA, WhatsApp, formularios, catálogos, documentos y ARCA, por lo
general en es/en a 1440, 390 y 320 px, con scroll de tabla, foco con cabecera adherida, teclado, diálogos y comparaciones.
Algunas escenas sólo dejan evidencia en `test-results`, sin referencia versionada; su encabezado lo dice.
La base se revisó en Windows con el Chromium instalado por la versión de Playwright del lockfile.
Un cambio de navegador o plataforma puede requerir una nueva revisión de la rasterización de fuentes.

Una diferencia falla con `npm run test:visual`. Para una decisión visual autorizada, revisar el resultado
y recién después ejecutar `npm run test:visual:update`; no actualizar capturas para esconder una falla.
`test-results/visual` conserva diagnóstico y trazas de fallos, sin entrar en Git.

## Alcance del cierre

Las piezas, medidas, consumidores y controles de este estándar están aplicados. La sincronización del
Artifact privado y la migración completa de mensajes siguen en sus registros existentes:
[fundamento visual](../design/visual-baseline.md) y [plan de mensajes](../plans/2026-09-30-unificacion-mensajes.md).
Fijar el aspecto del Toaster y su montaje no demuestra canal, dueño, duplicación o recuperación de todos
los errores. La revisión de geometría usa datos ficticios; las verificaciones con API real siguen en el
[registro compartido](../../../ArquitecturaBase/docs/plans/verificacion-y-produccion.md).

Apariencia también usa Page, Surface, FormField, Input, FilterBar y DataTable reales.
La elección del 2026-10-01 suma capturas es/en a 1440/390/320 px y pruebas de borrador,
guardado, restauración y contraste de filas oscuras/acciones/portales.

Inicio usa shared/ui/assistant: composición propia elegida de assistant-ui, con Button/IconButton y
ActionTooltip comunes. El marco llena el área disponible; en vacío, bienvenida/editor centrados y
sugerencias debajo; en conversación, respuesta a la izquierda, burbuja a la derecha y editor al pie.
ComposerPrimitive.Input usa nombre accesible y error asociado, sin volver a convertir el chat en
FormField/Surface. Su radio de 16 px y burbuja de 20 px son tokens específicos de esta pieza,
sin cambiar formularios ni el caparazón. Disponibilidad junto al editor, sin caja punteada exterior.
La feature aporta fuentes, traducciones y estado confirmado; ninguna primitiva compartida
conoce API, sesión o proveedor. Enter conserva múltiples líneas, Ctrl/Meta+Enter envía respetando
IME; los diálogos usan acciones táctiles y restauran foco. Texto plano escapado y
destinos lógicos autorizados evitan HTML, Markdown arbitrario o URLs del modelo. Los tests
assistant.spec cubren los estados y ambos idiomas; el tablero elegido queda documentado en el baseline.
