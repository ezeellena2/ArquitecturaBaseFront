# Roles: permisos y editor

Contiene catálogo/listado, alta y edición en ruta propia y los permisos de un rol, en una matriz por área.

## Al modificar

- Las páginas de edición usan `backTo`, guarda de cambios y hoja de migas; durante guardado desactivan la guarda. Guardar se habilita solo con cambios y se deshabilita mientras guarda: el encabezado no dice «Cambios sin guardar».
- Los datos del rol viven en `Surface padded` y los permisos en su propia superficie, sin barra de filtros entre las dos.
- Los permisos son la matriz RO1-A ([diseño](../../../docs/design/roles-y-permisos.md)): una fila por área (`TableRowHeader`) con Ver (`<área>.read`), Administrar (`<área>.manage`) y «Otros permisos» (el resto, con su nombre), «—» donde el área no tiene ese permiso y la columna de otros permisos sólo si alguna área los tiene. Sin buscador, filtros ni áreas que se pliegan: con todos los módulos son 13 filas.
- Desde 768 px se ve la matriz (`useMediaQuery`); más angosto, una banda por área (`tbody` con `aria-labelledby`, `TableRow tone="section"`) con su (i) y la casilla del área a la derecha, y sus permisos debajo con el nombre entero y 44 px para tocar. No usar `fieldset` dentro de una tabla.
- La casilla del área (vacía, parcial o completa) sólo existe en áreas de dos o más permisos y actúa sobre toda el área. Qué permite cada permiso va en la (i) del área, un permiso por renglón, y es la descripción accesible de su casilla: nunca una leyenda en la fila.
- Admin se lee: una tilde donde tiene el permiso, sin casillas, sin la columna del área ni botones, y el porqué en la (i) del título. User conserva el nombre de sólo lectura con el porqué en la (i) de «Nombre».
- Los roles del sistema y los asignados conservan sus restricciones; ocultá acciones sin permiso.
- `Roles.Role.HasUsers` usa `userCount` de ProblemDetails y pluralización del front. Las mutaciones invalidan catálogo, detalle y permisos propios cuando corresponde.

## Referencias

- [Editor, permisos y errores](../../../docs/architecture.md).
- [Formulario en ruta propia](pages/RoleEditorPage.tsx).
- [La matriz y sus estados (RO1-A)](../../../docs/design/roles-y-permisos.md).
- [Contrato de roles](../../../../ArquitecturaBase/docs/features/administracion.md).
