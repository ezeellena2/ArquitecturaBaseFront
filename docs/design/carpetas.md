# Carpetas: tableros elegidos

Fecha: **2026-11-11**. Las carpetas ordenan formularios y catálogos en un solo árbol, con subcarpetas, y un mismo elemento
puede estar en varias. El usuario eligió **CP1-A, CP2-A, CP3-A y CP5-A** el 2026-11-03 y el 2026-11-04; CP4 son los
estados. El backend está programado desde el 2026-11-09 y el front desde el 2026-11-11; lo que se fijó al programar está abajo.

Origen: el lienzo provisorio [Formularios desde la app](https://claude.ai/artifact/Kvbr5KFJrGT951JLiu8i4M), filas
«Carpetas» (CP1 a CP4) y CP5 a su derecha. El Sistema visual es de otra cuenta, así que, como en renglones, la IA y el motor
para documentos, este documento congela lo elegido. Alcance, permisos y contratos:
[plan de carpetas](../../../ArquitecturaBase/docs/plans/2026-11-03-carpetas-de-formularios-y-catalogos.md) y
[regla funcional](../../../ArquitecturaBase/docs/features/formularios.md#carpetas--cp1-a-a-cp5-a-2026-11-09).

## CM1 a CM6: las carpetas son menús (aprobado el 2026-11-20, sin programar)

El usuario lo pidió y aprobó los tableros el 2026-11-20. Reemplaza:
- CP1-A en los listados, y CP3-A y CP5-A;
- el límite de cinco niveles;
- lo que dicen de eso las secciones de más abajo, que siguen describiendo el código de hoy hasta que se programe.

Origen: el lienzo [Carpetas en el menú lateral](https://claude.ai/artifact/Ae5jKLH9BkQbgG2X7P8GLe), revisado contra las
capturas reales y la lista de chequeo. Alcance, contratos y pruebas: el
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

## Los tableros

| Tablero | Qué define |
| --- | --- |
| **CP1-A · El árbol a la izquierda** (elegido) | Un panel «Carpetas» a la izquierda de Formularios (`/formularios/respuestas`), Diseñar formularios (`/formularios`) y Catálogos (`/catalogos`); «Formularios que faltan» no lo lleva. Arriba, «Todos» y «Sin carpeta»; debajo, las carpetas en orden alfabético, con sus subcarpetas plegadas y la abierta desplegada, sin cantidades. Elegir una muestra lo que está en ella y en sus subcarpetas; la búsqueda y los demás filtros se aplican adentro. La carpeta va en la dirección (`?carpeta=`). Quien sólo carga o aprueba ve el mismo árbol sin el + ni los «…», y no ve las carpetas sin nada para él. En el celular el árbol pasa a un selector arriba de la lista, que abre las carpetas en una hoja. |
| CP1-B · Entrar como en una unidad de archivos | Descartado. |
| CP1-C · Un filtro y una columna | Descartado. |
| **CP2-A · «Carpetas…» con casillas** (elegido) | «Carpetas…» en el menú de la fila (Diseñar formularios y Catálogos) y en el encabezado del formulario y del catálogo, desde el 2026-11-11 dentro de su ⋮ ([AC1-A](acciones-del-encabezado.md)). Abre «Carpetas de «Artículos»» con el árbol y una casilla por carpeta; destildar todas lo deja en «Sin carpeta». «Agregar carpeta» crea una ahí mismo. Guarda al tocar «Guardar». |
| CP2-B · Arrastrar y etiquetas | Descartado. |
| **CP3-A · Se administran en el mismo panel** (elegido) | El + de la banda «Carpetas» agrega una en el primer nivel. El «…» de cada carpeta aparece al pasar el mouse o con el foco: «Agregar subcarpeta», «Renombrar» (en el lugar), «Mover a…», «En el menú…» y «Borrar». «Mover a…» abre el árbol con un radio por carpeta y «Arriba de todo»; la carpeta misma y sus subcarpetas no se eligen. «Borrar» confirma y cuenta lo que se pierde: «También se borran sus 2 subcarpetas. Los 9 formularios y catálogos que tenían quedan en sus otras carpetas o en «Sin carpeta»». Nunca se borra un formulario ni un catálogo. |
| CP3-B · Una pantalla «Carpetas» | Descartado. |
| **CP5-A · Cada carpeta elige si va al menú** (elegido) | «En el menú…», entre «Mover a…» y «Borrar», abre «Repartos en el menú» con cuatro opciones: fuera del menú, un menú propio, adentro de «Gestión de formularios» o adentro de «Administración». Un menú propio elige además su ícono entre doce genéricos (la carpeta por defecto), con una (i) que dice que es lo que se ve con el menú contraído. Guarda con «Guardar». Toda carpeta arranca fuera del menú. |
| CP5-B · Una pantalla «Menú» en Configuración | Descartado. |
| CP5-C · Cada carpeta del primer nivel es un menú | Descartado. |

## El menú lateral (CP5-A)

- **Un menú propio** va debajo de Inicio, con los demás menús propios en orden alfabético, y abre su panel como
  Administración: arriba sus formularios y, debajo, un grupo por subcarpeta con todo lo que está debajo de ella. Nunca
  pasa de dos niveles.
- **Adentro de un panel**, la carpeta es un grupo más, después de lo que el panel ya tiene: en «Gestión de formularios»,
  después de «Formularios que faltan»; en Administración, después de «Configuración». Varias van en orden alfabético.
- **Qué aparece:** sólo formularios activos que la persona puede abrir, en orden alfabético, como los manda el servidor.
  Un menú o un grupo sin nada no aparece, y un panel se ve si se ve algo adentro.
- **Qué abre:** a quien ve o aprueba respuestas, la planilla (`/formularios/{id}/respuestas`); a quien sólo carga, la
  carga (`/formularios/{id}/cargar`). Si se entró desde el menú, su panel queda abierto con el formulario marcado y las
  migas lo nombran («Repartos / Hoja de ruta»); desde un enlace o desde «Formularios», todo sigue como hoy.
- **Celular:** cada menú propio es un grupo del cajón con sus subcarpetas como grupos adentro; una carpeta puesta en un
  panel queda adentro del grupo de ese panel. **Contraído:** el ícono del menú propio, con su tooltip, abre el panel.
- **Estados:** mientras se lee, los menús propios no ocupan lugar y aparecen al leerse: un bloque de carga desaparecería
  cuando no hay ninguno, lo común, y haría subir al resto («Lo que carga no mueve lo que ya se ve», 2026-11-05, que es
  posterior a CP5-A y gana; ajustado el 2026-11-11). Si no se pudo leer, el aviso que
  el menú ya tiene, con «Reintentar», y lo demás sigue andando. El cambio se ve enseguida para quien lo hizo.

## Estados (CP4)

| Estado | Qué se ve |
| --- | --- |
| Todavía no hay carpetas | Sólo «Todos» y «Sin carpeta», con «Agregar carpeta» para quien administra |
| Carpeta vacía | «No hay catálogos en «Siembra y cosecha»» (o formularios, según el listado) |
| Búsqueda sin coincidencias | «No hay coincidencias en «Facturación»», con «Buscar en todas», que conserva lo escrito |
| Sin permiso para administrar | El árbol sin el + ni los «…», y sin «Carpetas…» en la fila |
| Una carpeta sin nada para esa persona | No aparece |
| Nombre repetido | El error junto al nombre que se está editando |
| Borrar | La confirmación con subcarpetas y elementos |
| Lo que llega de ARCA o de la biblioteca | Una carpeta que se crea sola y es como cualquier otra |
| No se pudieron leer las carpetas | El error en el panel con «Reintentar». El listado sigue andando con «Todos» |
| Una carpeta que ya no existe | Si la carpeta de la dirección se borró, vuelve a «Todos» con un aviso |
| Quinto nivel | «Agregar subcarpeta» se apaga con su motivo. Mover tampoco deja pasar de cinco |

## Lo que se fijó al programar

- **El panel** es una `Surface` «Carpetas» de 14 rem con el + en su banda, desde 1024 px; más angosto (el celular, una
  tableta con un panel del menú abierto) es el selector «Carpeta: Todos» arriba de los filtros, que abre la misma lista en un
  diálogo a pantalla completa en el celular. La carpeta abierta lleva el tinte de la marca y la barra al inicio (OE1-A).
- **Agregar y renombrar** son un campo en el mismo renglón: Enter guarda, Escape cancela y el error va debajo. La carpeta
  nueva se abre y queda elegida en el árbol del diálogo de CP2-A.
- **Mover a…** lista las carpetas en orden de árbol, cada una con su carpeta madre debajo, en gris («En Repartos»); las que
  no se pueden elegir (la carpeta, sus subcarpetas y las que pasarían de cinco niveles) quedan apagadas con su motivo (MA1-A).
- **El ícono de un menú propio** se elige en un desplegable con el dibujo y el nombre de cada uno: es un valor de una lista.
- **Lo vacío en una carpeta:** sin búsqueda ni filtros, el título solo; con alguno, «Buscar en todas» y «Limpiar filtros».
- **Desde el menú** se recuerda por qué carpeta se entró mientras se siga en las pantallas de ese formulario (la planilla, lo
  que cuelga de ella y la carga); al salir, todo vuelve a como era. Las migas nombran el menú en la planilla y en la carga.
- **La dirección:** `?carpeta=<id>` o `?carpeta=sin-carpeta`. Elegir vuelve a la página 1 y conserva búsqueda y filtros.
- **Conflictos:** un 409 de revisión (`Forms.Folder.RevisionConflict`) o de conjunto cambiado (`Forms.Folder.SetChanged`)
  conserva lo elegido o escrito y avisa abajo con «Volver a leer».
- **Los doce íconos** son genéricos y viven en `shared/ui/menuIcons`: carpeta, camión, paquete, recibo, personas,
  calendario, portapapeles, gráfico, llave, negocio, hoja y archivo.

## Correspondencia con `shared/ui`

`Surface` (panel), `ActionsMenu` («…»), `IconButton` (+), `Input` en el renglón (como `CatalogInlineInput`),
`TreeList` (la lista con niveles del panel y de la hoja, nueva), `CheckboxField` (CP2-A), `RadioGroupField` con
`disabledReason` (mover y lugar en el menú), `Select` (el ícono), `DialogContent mobileFullscreen` (hoja del celular),
`Button outline` con su flecha, como un filtro (selector), `EmptyState` (vacíos), `Skeleton` (carga) y el aviso común
(resultados y errores). En el caparazón, el menú propio usa `PanelTrigger` y los grupos, `NavBranch`, como Administración.
