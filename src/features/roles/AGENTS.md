# Roles: permisos y editor

Contiene catálogo/listado, alta y edición en ruta propia y selector de permisos por área.

## Al modificar

- Las páginas de edición usan `backTo`, guarda de cambios y hoja de migas; durante guardado desactivan la guarda.
- Los datos del rol viven en `Surface padded`, separados de `FilterBar` y la superficie de permisos.
- El selector agrupa filas con nombres accesibles. No usar `fieldset` dentro de una tabla ni perder etiquetas al plegar áreas.
- Un único Button outline alterna Expandir todo/Contraer todo según las áreas visibles; actúa sobre el catálogo completo, incluidos módulos opcionales. Sólo cambia la vista, también en Admin, sin tocar selección ni estado de guardado. Cada búsqueda/filtro nuevo abre resultados; después se pueden plegar explícitamente. Sin resultados se deshabilita; conservar aria-expanded/aria-controls y foco de teclado.
- Por aclaración del 2026-10-03, los permisos individuales quedan blancos con TableBody striped=false. El encabezado de cada área usa TableRow tone="section" y highlightExpanded=false: banda suave derivada del encabezado de tabla, independiente del estado expandido. Preservar hover y foco, sin sobrescrituras CSS por feature.
- Los roles del sistema y los asignados conservan sus restricciones; ocultá acciones sin permiso.
- `Roles.Role.HasUsers` usa `userCount` de ProblemDetails y pluralización del front. Las mutaciones invalidan catálogo, detalle y permisos propios cuando corresponde.

## Referencias

- [Editor, permisos y errores](../../../docs/architecture.md).
- [Formulario en ruta propia](pages/RoleEditorPage.tsx).
- [Contrato de roles](../../../../ArquitecturaBase/docs/features/administracion.md).
