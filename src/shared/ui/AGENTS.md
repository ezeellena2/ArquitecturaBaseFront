# UI: biblioteca compartida

Reúne primitivas generadas por shadcn y componentes propios de formularios, tablas, diálogos, navegación y presentación. Toda pantalla usa esta biblioteca y los tokens globales.

## Al modificar

- Los archivos en minúscula son generados y se editan lo mínimo; los propios usan PascalCase. Al regenerar, preservá traducciones y tema claro de Dialog y Sonner.
- Usá `Page`, `RowActions`, `ActionTooltip`, `IconButton`, `FilterBar` y campos comunes. No agregar variantes locales de un mismo control.
- `ForbiddenPage` presenta el estado compartido de falta de permiso: lo usan la ruta `/sin-permiso` y las áreas que reciben un 403. Conservá la misma traducción y presentación en todos sus consumidores.
- Conservá Public Sans y las formas actuales al refinar consumidores; desde el 2026-10-02 los colores iniciales son Campo, sin cambios de medidas ni componentes. `icons` es el punto común del set; expone también los dibujos Lucide ya aprobados para el acceso público, sin cambiar su apariencia. El catálogo muestra los campos, selección, modales y tooltips reales.
- Listados y tablas especiales usan `Surface`; las superficies con banda también se componen allí. `TableHead` define tipografía y `TableRow` la densidad. Los filtros usan `FilterMenuTrigger` y `FilterChip`; las secciones, `TableSectionToggle`. Cambiá la biblioteca y sus consumidores juntos.
- Las zonas de campos se delimitan con `Surface padded`; filtros y tablas mantienen bloques separados. El cuerpo alterna blanco y `table-row-alternate`; hover, selección y bandas de sección conservan prioridad, sin reglas por feature. Por aclaración del 2026-10-03, Roles usa TableBody striped=false para permisos blancos y TableRow tone="section" con highlightExpanded=false para encabezados de área suaves; conservar el encabezado de tabla más marcado. Los tokens table-section y su foreground se adaptan a la paleta global.
- Conservá nombre accesible, foco, teclado, portales y ayuda de acciones deshabilitadas. Textos compartidos van en `common`.
- Surface admite acciones en su encabezado común; se acomodan en filas sin recortar títulos. FormField admite una etiqueta compuesta con decoración aria-hidden, conservando asociación y nombre accesible. ConfirmDialog admite focusFallback del consumidor cuando el disparador se elimina; el hook común verifica conexión/habilitación antes de enfocar. PhonePreview presenta controles de orientación y conserva acción final deshabilitada; no conoce API ni permite enviar.
- MessageHistory, MessageBubble y MessageDateDivider son presentación compartida: fondo/scroll,
  dirección, cuerpo, metadatos y entrega con texto/ícono. No conocen contratos, estados HTTP ni
  WhatsApp; el consumidor adapta sus datos. Toda fecha se formatea antes de pasarse a la pieza.
  MessageBubble admite un attachment dentro del cuerpo y conserva revisión/recuperación después de los metadatos; MessageCard presenta título, descripción e ícono sin contratos de una feature. RadioGroupField ofrece filas simples o cards con el mismo control accesible. EmbeddedPreview sólo presenta un iframe con título accesible y sandbox/referrerPolicy; el consumidor valida URL, permisos, idioma y vencimiento.
- Un cambio visual se contrasta con la biblioteca y el contrato aprobado. Las decisiones nuevas pasan por tablero y elección antes de implementarse.
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
