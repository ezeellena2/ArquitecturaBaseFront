# UI: biblioteca compartida

Reúne primitivas generadas por shadcn y componentes propios de formularios, tablas, diálogos, navegación y presentación. Toda pantalla usa esta biblioteca y los tokens globales.

## Al modificar

- Los archivos en minúscula son generados y se editan lo mínimo; los propios usan PascalCase. Al regenerar, preservá traducciones y tema claro de Dialog y Sonner.
- Usá `Page`, `RowActions`, `ActionTooltip`, `IconButton`, `FilterBar` y campos comunes. No agregar variantes locales de un mismo control.
- `ForbiddenPage` presenta el estado compartido de falta de permiso: lo usan la ruta `/sin-permiso` y las áreas que reciben un 403. Conservá la misma traducción y presentación en todos sus consumidores.
- Conservá Public Sans y las formas actuales al refinar consumidores; desde el 2026-10-02 los colores iniciales son Campo, sin cambios de medidas ni componentes. `icons` es el punto común del set; expone también los dibujos Lucide ya aprobados para el acceso público, sin cambiar su apariencia. El catálogo muestra los campos, selección, modales y tooltips reales.
- Listados y tablas especiales usan `Surface`; las superficies con banda también se componen allí. `TableHead` define tipografía y `TableRow` la densidad. Los filtros usan `FilterMenuTrigger` y `FilterChip`; las secciones, `TableSectionToggle`. Cambiá la biblioteca y sus consumidores juntos.
- Las zonas de campos se delimitan con `Surface padded`; filtros y tablas mantienen bloques separados. El cuerpo alterna blanco y `table-row-alternate`; hover, selección y bandas de sección conservan prioridad, sin reglas por feature. Por aclaración del 2026-10-03, Roles usa TableBody striped=false para permisos blancos y TableRow tone="section" con highlightExpanded=false para encabezados de área suaves; conservar el encabezado de tabla más marcado. Los tokens table-section y su foreground se adaptan a la paleta global.
- Badge ofrece success, warning y danger con la paleta semántica común; el consumidor conserva el texto del estado y no lo anuncia como un error operativo.
- Banner reserva un ancho útil al grupo de ícono y texto; la acción queda a la derecha cuando cabe y baja a otra fila cuando el contenedor es estrecho. Sin acción, el texto ocupa el ancho disponible. Roles, tono y medidas de los controles se conservan.
- Conservá nombre accesible, foco, teclado, portales y ayuda de acciones deshabilitadas. MultiSelect.disabled bloquea el disparador y las opciones incluso si el menú ya estaba abierto; el consumidor conserva valores por identidad. Textos compartidos van en `common`.
- Surface admite acciones en su encabezado común; se acomodan en filas sin recortar títulos. FormField admite una etiqueta compuesta con decoración aria-hidden, conservando asociación y nombre accesible. ConfirmDialog admite focusFallback del consumidor cuando el disparador se elimina; el hook común verifica conexión/habilitación antes de enfocar. PhonePreview presenta controles de orientación y conserva acción final deshabilitada; no conoce API ni permite enviar.
- MessageHistory, MessageBubble y MessageDateDivider son presentación compartida: fondo/scroll,
  dirección, cuerpo, metadatos y entrega con texto/ícono. No conocen contratos, estados HTTP ni
  WhatsApp; el consumidor adapta sus datos. Toda fecha se formatea antes de pasarse a la pieza.
  MessageBubble admite un attachment dentro del cuerpo y conserva revisión/recuperación después de los metadatos; MessageCard presenta título, descripción e ícono sin contratos de una feature. RadioGroupField ofrece filas simples o cards con el mismo control accesible. EmbeddedPreview sólo presenta un iframe con título accesible y referrerPolicy; conserva sandbox por defecto para una vista externa. La variante kind=pdf retira sandbox para el visor PDF nativo y recibe sólo una URL blob privada creada desde bytes PDF validados; el consumidor valida URL, permisos, idioma y vencimiento. Su className permite ajustar la altura de una mini vista sin cambiar ese contrato ni crear otro visor.
- Un cambio visual se contrasta con la biblioteca y el contrato aprobado. Las decisiones nuevas pasan por tablero y elección antes de implementarse.
- SegmentedControl conserva su variante compacta predeterminada; wrapLabels permite etiquetas en varias líneas y alto mínimo dentro del ancho disponible. I1 lo usa para mostrar completo el conteo de traducciones en móvil, sin CSS de la feature.
- Button.size="sm-wrap" conserva la densidad pequeña y envuelve el texto dentro del ancho disponible; usalo para acciones largas en contenedores estrechos, sin variantes locales.
- Tests consultan por rol y texto; los de i18n y tema evitan regresiones de componentes generados.
- El único Toaster se monta en AppProviders y fija la política común. No promover un FormError
  general ni usar Banner para resultados operativos. Comprobar avisos desde Dialog con teclado,
  sin cambiar la modalidad ni crear otro Toaster.

`PublicLanding` presenta título, descripción, acciones y capacidades de una portada pública.
Sus textos e íconos los aporta el consumidor; colores y curvas usan los roles globales `public-*`.

`LocationMap` es un selector genérico de coordenadas, sin contratos ni estado de una feature.
El consumidor lo carga de forma diferida en un Dialog. Leaflet/OSM conserva atribución visible,
caché del navegador y referrer por imagen limitado al origen, sin cambiar encabezados globales.
No agregar búsquedas ficticias, geolocalización del dispositivo, descargas offline ni claves.
La indisponibilidad se comunica desde el consumidor con el Toaster único y una alternativa manual.

## Referencias

Autocomplete compone Input/tokens comunes, sin red ni proveedor. Admite teclado, Escape,
selección sin submit y foco conservado con puntero. El consumidor controla consultas,
atribución (footer no seleccionable y visible en el desplegable), carga/vacío, permisos y mensajes.
La lista vive en un portal (Radix Popover anclado al campo), así no la recorta una tabla ni un diálogo con scroll;
el foco sigue en el campo y Escape cierra solo la lista.

- [Biblioteca y decisiones visuales](../../../docs/design/visual-baseline.md).
- [Reglas de componentes y accesibilidad](../../../docs/architecture.md).
- [Compatibilidad de Radix con jsdom](../../test/setup.ts).
- [Premisas de desarrollo de pantallas](../../../docs/guides/premisas-de-desarrollo.md).
- [Contrato de mensajes y estados](../../../docs/guides/mensajes-y-estados.md).
- [Estándar aplicado y catálogo](../../../docs/guides/estandar-visual.md).

- `AppearancePreview` aplica el borrador en su propio contexto, sin cambiar la raíz.
  Encabezados usan surface-header-foreground; filas oscuras adaptan contenido y conservan
  contraste en grupos de acciones, hover y selección. Portales consumen el tema global.

Sonner sólo se importa en notifications.ts y sonner.tsx; arquitectura verifica el límite sin excepciones de features. Dialog registra un host manual de capa superior para el único Toaster: conserva foco modal, posición y scroll del panel. Al regenerar ambos adaptadores, conservar esta integración y sus pruebas de navegador.

`PhotoViewer` presenta el Dialog común, navegación por flechas/Escape y retorno del foco. `PhotoThumbnail` fija la variante de miniatura. `PrivateImage` mantiene su URL Blob sólo mientras existe el elemento y la revoca al cambiar/desmontar; ninguna pieza conoce una feature, credenciales o rutas.

`FormRecordFiles` compone miniaturas, visor y descargas privadas para chat y planilla/detalle. Recibe actor, respuesta, metadatos y callbacks de acceso; no importa features. El nombre del documento conserva ancho útil; Descargar baja cuando no cabe a su lado. Variante compacta: primera foto/cantidad; galería puede abarcar todas las fotos de la respuesta. `DialogContent` admite placement right para el panel de filtros y mobileFullscreen optativo para decisiones con cuerpo desplazable y pie fuera del scroll en móvil. Conserva foco, host de notificaciones y variante predeterminada; el consumidor compone el cuerpo y el pie con las piezas comunes.

`Tabs`, `TabsList`, `TabsTrigger` y `TabsContent` comparten pestañas subrayadas con tokens del sistema sobre Radix. Conservan asociación entre pestaña/panel, selección controlada o inicial, foco y navegación por teclado; el consumidor aporta nombres, valores y contenido. No conocen rutas, permisos ni consultas. El catálogo las muestra con `?scenario=tabs`.

`DataTable.selectedRowKey` marca una identidad con el estado visual y accesible de selección; `onRowClick` permite abrirla desde una celda sin controles. Las filas conservan su semántica de tabla y el enlace de número aporta la navegación por teclado. Controles internos, contenido editable, clics modificados y eventos ya prevenidos conservan su dueño; sin estas props el listado mantiene su comportamiento.

PrivateAudio recibe sólo Blob, etiqueta y una intención explícita de reproducir. Presenta audio nativo con controles y crea una URL local durante su montaje; pausa, retira src y revoca al cambiar/desmontar. No conoce ruta, credenciales, proveedor ni transcripción; el dueño valida acceso y contenido.

`CollapsibleSection` compone Surface y el botón de flecha común: open/onOpenChange pertenecen al consumidor, que aporta título, rótulos traducidos, metadata abierta y resumen plegado. Vincula aria-expanded/aria-controls con una identidad estable; conserva el cuerpo montado y oculto al plegar, sin mover el foco ni enviar el formulario. No conoce respuestas, actividad, permisos ni lecturas. El dueño de la pantalla retira su contenido privado al perder el alcance.

`WideTable` reutiliza Table con una región de desplazamiento nombrada y alcanzable por teclado. `WideTableHead` y `WideTableCell` fijan opcionalmente la celda exterior de cada lado, heredando el fondo de su fila para conservar alternado, hover y selección; no conocen columnas de una feature. El consumidor mantiene el encabezado y las celdas de la misma columna fijos juntos. La geometría se verifica en navegador, no con clases en jsdom.
