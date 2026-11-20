# Carpetas: tableros elegidos

Fecha: **2026-11-20**. Las carpetas ordenan formularios y catálogos en un solo árbol de dos niveles, y un mismo elemento
puede estar en varias. Cada carpeta del primer nivel es un menú del menú lateral (CM1 a CM6, elegidos el 2026-11-20) y
«Carpetas…» pone un formulario o un catálogo en ellas (CP2-A, del 2026-11-03). El backend y el front están programados; lo
que se fijó al programar está abajo.

Origen: el lienzo [Carpetas en el menú lateral](https://claude.ai/artifact/Ae5jKLH9BkQbgG2X7P8GLe) (CM1 a CM6) y, para CP2-A y
lo reemplazado, el lienzo provisorio [Formularios desde la app](https://claude.ai/artifact/Kvbr5KFJrGT951JLiu8i4M), filas
«Carpetas» (CP1 a CP4) y CP5 a su derecha. El Sistema visual es de otra cuenta, así que, como en renglones, la IA y el motor
para documentos, este documento congela lo elegido. Alcance, permisos y contratos:
[plan de carpetas](../../../ArquitecturaBase/docs/plans/2026-11-03-carpetas-de-formularios-y-catalogos.md) y
[regla funcional](../../../ArquitecturaBase/docs/features/formularios.md#carpetas--cp1-a-a-cp5-a-2026-11-09).

## CM1 a CM6: las carpetas son menús (aprobado y programado el 2026-11-20)

El usuario lo pidió y aprobó los tableros el 2026-11-20, y se programó ese mismo día. Reemplazó al panel de los listados
(CP1-A), a su administración en ese panel (CP3-A), al lugar en el menú que elegía cada carpeta (CP5-A) y al límite de cinco
niveles. Los tableros fueron revisados contra las capturas reales y la lista de chequeo. Alcance, contratos y pruebas: el
[plan](../../../ArquitecturaBase/docs/plans/2026-11-03-carpetas-de-formularios-y-catalogos.md#las-carpetas-son-menús-cm1-a-cm6-2026-11-20).

| Tablero | Qué define |
| --- | --- |
| **CM1 · El menú** | Cada carpeta del primer nivel es un menú, después de WhatsApp y antes de Administración, en orden alfabético y con su ícono, con «Nueva carpeta» al final para quien administra formularios. Abre su panel como Administración: en la banda, el ícono, el nombre y el ⋮; arriba, sus formularios activos; debajo, un grupo plegable por subcarpeta, abierto sólo el del formulario abierto; al final, «Agregar formularios». El formulario abre la planilla, la carga o el diseño, según lo que puede la persona, y las migas dicen «Repartos / Control de carga». |
| **CM2 · Crear y poner formularios** | «Nueva carpeta» abre un diálogo con el nombre y el ícono; el ícono arranca en el primero libre. La carpeta aparece abierta, con «Todavía no hay formularios en «Compras»» y «Agregar formularios». Ese botón abre «Formularios de «Compras»»: un buscador y una casilla por formulario no dado de baja, con los que ya están primero y la etiqueta «Borrador» en los borradores. Guarda los formularios de esa carpeta con la lista leída; si otro la cambió, conserva lo marcado y avisa con «Volver a leer». |
| **CM3 · Los listados y «Carpetas…»** | Los tres listados, sin panel y sin el desplegable «Carpeta: Todos». Diseñar formularios y Catálogos suman el filtro «Carpeta», como Estado: «Todas» separada, «Sin carpeta» y las carpetas con sus subcarpetas debajo, con la tilde a la izquierda y `?carpeta=`. «Carpetas…» muestra dos niveles; su «Nueva carpeta» abre el diálogo de CM2 y deja tildada la carpeta creada, y sólo la ve quien administra formularios. |
| **CM4 · Ordenar** | El ⋮ de la carpeta ofrece «Editar…», «Nueva subcarpeta…», «Mover a…» y «Borrar». Con subcarpetas, «Mover a…» queda apagado con «Tiene subcarpetas: no puede ir adentro de otra.». El ⋮ de la subcarpeta ofrece «Editar…», «Agregar formularios…», «Mover a…» y «Borrar». Mover elige entre «Al menú, como carpeta propia» y «Adentro de «X»». Borrar cuenta lo que se pierde y nunca borra un formulario ni un catálogo. |
| **CM5 · Personas y pantallas** | Quien sólo carga no ve «Nueva carpeta», ni los ⋮, ni «Agregar formularios», y no le aparece nada vacío. En el celular, las carpetas son grupos del cajón, con el ⋮ en la carpeta y en cada subcarpeta. Con el menú contraído, cada carpeta es su ícono con tooltip y abre su panel. |
| **CM6 · Estados** | Sin carpetas, error con «Reintentar», nombre repetido, 409 con «Volver a leer», subcarpeta vacía con su propio «Agregar formularios», y carpeta con sólo catálogos con «Ver sus N catálogos». Mientras se lee, no ocupan lugar. El menú se relee solo al publicar, dar de baja, reactivar o eliminar un formulario. |

**Piezas y medidas**, las de la app a 1440 px con la raíz al 75 %:
- **El panel de una carpeta:** `PanelTrigger` y el panel de 14 rem con banda de 3 rem, como Administración. Su ⋮ es un
  `ActionsMenu` de 1,5 rem, sin recuadro.
- **Los grupos:** `NavBranch`. Su ⋮ aparece al pasar el mouse o con el foco, y siempre con `@media (hover: none)`.
- **«Nueva carpeta» y «Agregar formularios»:** son renglones del menú, con su +. Es una diferencia aceptada con «Navegación»,
  porque el menú es el único lugar de las carpetas y lo escondido en un «…» fue lo que el usuario no encontró.
- **Los diálogos:** de 32 rem. El ícono se elige con el `Select` de hoy, con el dibujo y el nombre. Los formularios, con un
  buscador y `CheckboxField`.
- **El filtro «Carpeta»:** un `FilterMenuTrigger` con un `DropdownMenuRadioGroup`.

## Los tableros de antes

| Tablero | Qué define |
| --- | --- |
| CP1-A · El árbol a la izquierda | Elegido el 2026-11-03: un panel «Carpetas» a la izquierda de los tres listados. Lo reemplazaron CM1 y CM3. |
| CP1-B · Entrar como en una unidad de archivos | Descartado. |
| CP1-C · Un filtro y una columna | Descartado. |
| **CP2-A · «Carpetas…» con casillas** (elegido, sigue) | «Carpetas…» en la fila (Diseñar formularios y Catálogos) y en el ⋮ del encabezado del formulario y del catálogo ([AC1-A](acciones-del-encabezado.md)). Abre «Carpetas de «Artículos»» con las carpetas y sus subcarpetas, una casilla por carpeta; destildar todas lo deja en «Sin carpeta». Desde CM3, su «Nueva carpeta» abre el diálogo de CM2. Guarda al tocar «Guardar». |
| CP2-B · Arrastrar y etiquetas | Descartado. |
| CP3-A · Se administran en el mismo panel | Elegido el 2026-11-03: el + y el «…» de cada carpeta en el panel de los listados. Lo reemplazaron CM2 y CM4. |
| CP3-B · Una pantalla «Carpetas» | Descartado. |
| CP5-A · Cada carpeta elige si va al menú | Elegido el 2026-11-04: «En el menú…» ponía una carpeta en un menú propio o en un panel. Lo reemplazó CM1. |
| CP5-B · Una pantalla «Menú» en Configuración | Descartado. |
| CP5-C · Cada carpeta del primer nivel es un menú | Descartado el 2026-11-04; el usuario lo eligió el 2026-11-20 como CM1. |

## El menú lateral (CM1 y CM5)

- **Dónde va:** Inicio, Gestión de formularios, WhatsApp, las carpetas en orden alfabético con «Nueva carpeta» al final, y
  Administración al pie. Las carpetas van en su sección, separada con la línea de siempre.
- **Cada carpeta** es un botón de panel con su ícono, como Administración, y abre su panel: en la banda, el ícono, el nombre y
  el ⋮ para quien administra formularios; arriba, sus formularios; debajo, un grupo plegable por subcarpeta con sus
  formularios, abierto sólo el del formulario abierto; al final, «Agregar formularios» para quien administra. Nunca pasa de
  dos niveles.
- **Qué aparece:** sólo formularios activos, en orden alfabético, como los manda el servidor. A quien no administra, sólo los
  que puede abrir, sin grupos ni carpetas vacíos; a quien administra, todas las carpetas y subcarpetas, también las vacías o
  con sólo catálogos, con lo que se hace en ellas.
- **Qué abre un formulario:** a quien ve o aprueba respuestas, la planilla (`/formularios/{id}/respuestas`); a quien sólo
  carga, la carga (`/formularios/{id}/cargar`); a quien sólo administra, el diseño (`/formularios/{id}`). Si se entró desde
  el menú, su panel queda abierto con el formulario marcado y su grupo abierto, y las migas lo nombran («Repartos / Control
  de carga»); desde un enlace o desde «Formularios», todo sigue como siempre.
- **Celular:** cada carpeta es un grupo del cajón con sus subcarpetas como grupos adentro y el ⋮ en el renglón de la carpeta y
  de cada subcarpeta. **Contraído:** el ícono de la carpeta, con su nombre en el tooltip, abre el panel; «Nueva carpeta» es su +.
- **Mientras se lee,** la sección no ocupa lugar y aparece al leerse: un bloque de carga desaparecería cuando no hay ninguna
  carpeta y haría subir al resto («Lo que carga no mueve lo que ya se ve», 2026-11-05). Si no se pudo leer, el aviso que el
  menú ya tiene, con «Reintentar», y lo demás sigue andando. El cambio se ve enseguida para quien lo hizo.

## Estados (CM6)

| Estado | Qué se ve |
| --- | --- |
| Todavía no hay carpetas | En el menú, sólo «Nueva carpeta», para quien administra formularios; en el filtro, «Todas» y «Sin carpeta» |
| Carpeta vacía | En su panel, «Todavía no hay formularios en «Compras»», en gris y en `text-xs`, y «Agregar formularios» |
| Subcarpeta vacía | Su grupo, con su propio «Agregar formularios» |
| Carpeta con sólo catálogos | «Ver sus 14 catálogos» («Ver su catálogo» con uno), que abre Catálogos con esa carpeta en el filtro |
| Una carpeta sin nada para esa persona | No aparece |
| Sin permiso para administrar | El menú sin «Nueva carpeta», sin ⋮ y sin «Agregar formularios», y la fila sin «Carpetas…» |
| Mientras se lee el menú | La sección de las carpetas no ocupa lugar |
| No se pudo leer el menú | El aviso del menú, con «Reintentar», arriba de Inicio |
| Un listado filtrado por una carpeta vacía | «No hay catálogos en «Siembra y cosecha»» (o formularios, según el listado) |
| Búsqueda sin coincidencias en una carpeta | «No hay coincidencias en «Facturación»», con «Buscar en todas», que conserva lo escrito |
| No se pudieron leer las carpetas de un listado | El filtro lo dice con «Reintentar» y el listado sigue con «Todas» |
| Una carpeta de la dirección que ya no existe | El filtro vuelve a «Todas» con un aviso |
| Nombre repetido | El error debajo del nombre, en el diálogo |
| Otro la cambió | Un 409 conserva lo escrito o lo marcado y avisa con «Volver a leer» |
| Borrar | La confirmación dice de dónde sale («Sale del menú.» o «Sale de «Repartos».») y cuenta las subcarpetas que se borran y los formularios y catálogos que quedan en sus otras carpetas o sin carpeta |
| La carpeta abierta se borra o se mueve adentro de otra | Su panel se cierra y el foco va a «Nueva carpeta» |
| Lo que llega de ARCA o de la biblioteca | Una carpeta que se crea sola en el primer nivel, con el primer ícono libre, y es como cualquier otra |
| Tercer nivel | No hay: una subcarpeta no ofrece «Nueva subcarpeta…» y una carpeta con subcarpetas no puede entrar en otra |

## Lo que se fijó al programar

- **El panel de una carpeta** es el de Administración (`PanelTrigger`, 14 rem y banda de 3 rem), y su ⋮ es
  `ActionsMenu size="icon-xs"`, de 1,5 rem y sin recuadro. El ⋮ de un grupo aparece al pasar el mouse o con el foco, y siempre
  en una pantalla táctil.
- **En el cajón** cada carpeta es un `NavBranch` con lo mismo adentro, y se abre una a la vez, como los paneles.
- **Crear y editar** es un solo diálogo de 32 rem: el nombre y, en una carpeta del primer nivel, el ícono, en un `Select` con
  el dibujo y el nombre de cada uno, que en una carpeta nueva arranca en el primero libre; una subcarpeta lleva sólo el nombre.
  La carpeta creada desde el menú se abre en él; desde «Carpetas…», queda tildada.
- **«Agregar formularios»** abre «Formularios de «Compras»»: el buscador y una casilla por formulario no dado de baja, de a 50
  con «Ver más», con los que ya están primero y la etiqueta «Borrador» (el `tag` de `CheckboxField`) en los que nunca se
  publicaron. Guarda con la lista leída y conserva los dados de baja, que no lista.
- **El filtro «Carpeta»** dice «Carpeta: Todas» o la elegida (antes «Todos»). Abierto, «Todas», separada con una línea, «Sin
  carpeta» y las carpetas con sus subcarpetas debajo, con sangría y la tilde a la izquierda. Si no se pudieron leer las
  carpetas, lo dice adentro con «Reintentar», sin cerrarse, y el listado sigue con «Todas».
- **«Ver su catálogo»,** en singular, cuando la carpeta tiene uno solo.
- **El foco:** al cerrarse un diálogo del menú, vuelve a lo que lo pidió (también al ⋮, aunque su ítem ya no esté) y, si eso ya
  no está en el documento porque su carpeta dejó el menú, al renglón «Nueva carpeta», en escritorio y en el cajón.
- **Mover a…** ofrece «Al menú, como carpeta propia» y «Adentro de «X»» por cada otra carpeta del primer nivel, y arranca donde
  está la carpeta; con subcarpetas, las de adentro quedan apagadas con su motivo (MA1-A).
- **Desde el menú** se recuerda por qué carpeta se entró mientras se siga en las pantallas de ese formulario (la planilla, lo
  que cuelga de ella, la carga y el diseño); al salir, todo vuelve a como era.
- **El menú se relee solo** al publicar, dar de baja, reactivar o eliminar un formulario, al cambiar sus carpetas y al guardar
  los formularios de una carpeta.
- **La dirección:** `?carpeta=<id>` o `?carpeta=sin-carpeta`, en Diseñar formularios y Catálogos. Elegir vuelve a la página 1 y
  conserva búsqueda y filtros.
- **Conflictos:** un 409 de revisión (`Forms.Folder.RevisionConflict`) o de conjunto cambiado (`Forms.Folder.SetChanged`)
  conserva lo elegido o escrito y avisa abajo con «Volver a leer».
- **Los doce íconos** son genéricos y viven en `shared/ui/menuIcons`: carpeta, camión, paquete, recibo, personas,
  calendario, portapapeles, gráfico, llave, negocio, hoja y archivo.

## Correspondencia con `shared/ui`

En el caparazón, cada carpeta usa `PanelTrigger` y el panel de Administración; sus grupos, `NavBranch`; su ⋮, `ActionsMenu`
de 1,5 rem, con el motivo de un ítem apagado adentro; «Nueva carpeta» y «Agregar formularios» son renglones del menú con su +
(`MenuActionRow`, con `ActionTooltip` en la barra contraída), y el aviso del menú con «Reintentar» es el de siempre. En la
feature: `DialogContent` (crear y editar, los formularios de una carpeta, mover, con `mobileFullscreen`, y borrar),
`FormField` e `Input` (el nombre), `Select` (el ícono), `SearchInput` y `CheckboxField` con `tag` (los formularios),
`CheckboxField` (CP2-A), `RadioGroupField` con `disabledReason` (mover), `FilterMenuTrigger` con `DropdownMenuRadioGroup` (el
filtro), `EmptyState` (los vacíos de un listado), `Skeleton` (lo que lee un diálogo) y el aviso común (resultados y errores).
