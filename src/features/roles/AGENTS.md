# Roles: permisos y editor

Contiene catálogo/listado, alta y edición en ruta propia y selector de permisos por área.

## Al modificar

- Las páginas de edición usan `backTo`, guarda de cambios y hoja de migas; durante guardado desactivan la guarda.
- El selector agrupa filas con nombres accesibles. No usar `fieldset` dentro de una tabla ni perder etiquetas al plegar áreas.
- Los roles del sistema y los asignados conservan sus restricciones; ocultá acciones sin permiso.
- `Roles.Role.HasUsers` usa `userCount` de ProblemDetails y pluralización del front. Las mutaciones invalidan catálogo, detalle y permisos propios cuando corresponde.

## Referencias

- [Editor, permisos y errores](../../../docs/architecture.md).
- [Formulario en ruta propia](pages/RoleEditorPage.tsx).
- [Contrato de roles](../../../../ArquitecturaBase/docs/features/administracion.md).
