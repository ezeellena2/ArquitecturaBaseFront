# Carpetas: tableros elegidos

Fecha: **2026-11-11**. Las carpetas ordenan formularios y catálogos en un solo árbol, con subcarpetas, y un mismo elemento
puede estar en varias. El usuario eligió **CP1-A, CP2-A, CP3-A y CP5-A** el 2026-11-03 y el 2026-11-04; CP4 son los
estados. El backend está programado desde el 2026-11-09 y este documento registra el diseño antes de programar el front.

Origen: el lienzo provisorio [Formularios desde la app](https://claude.ai/artifact/Kvbr5KFJrGT951JLiu8i4M), filas
«Carpetas» (CP1 a CP4) y CP5 a su derecha. El Sistema visual es de otra cuenta, así que, como en renglones, la IA y el motor
para documentos, este documento congela lo elegido. Alcance, permisos y contratos:
[plan de carpetas](../../../ArquitecturaBase/docs/plans/2026-11-03-carpetas-de-formularios-y-catalogos.md) y
[regla funcional](../../../ArquitecturaBase/docs/features/formularios.md#carpetas--cp1-a-a-cp5-a-2026-11-09).

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
