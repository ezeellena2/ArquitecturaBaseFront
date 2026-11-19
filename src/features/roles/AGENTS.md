# Roles: permisos y editor

Contiene catálogo/listado, alta y edición en ruta propia y los permisos de un rol, en áreas plegables.

## Al modificar

- Las páginas de edición usan `backTo`, guarda de cambios y hoja de migas; durante guardado desactivan la guarda. Guardar se habilita solo con cambios y se deshabilita mientras guarda: el encabezado no dice «Cambios sin guardar».
- Los datos del rol viven en `Surface padded` y los permisos en su propia superficie, sin barra de filtros entre las dos.
- Los permisos son las áreas plegables RO3-D ([diseño](../../../docs/design/roles-y-permisos.md)): una tabla de una columna, «Permiso», igual en escritorio y en el celular. Cada área es un `tbody` con `aria-labelledby` y su banda (`TableRow tone="section"`) con la flecha, la casilla del área, el nombre, que también abre y cierra, y su (i). Abierta, un permiso por fila con su casilla y su nombre entero; en el celular, 44 px por fila. No usar `fieldset` dentro de una tabla.
- La banda no es `TableSectionToggle`, porque lleva la casilla al frente, pero usa sus tokens y medidas. Debajo de `sm`, la flecha y la casilla del área tienen cada una su zona de 44 × 44, sin pisarse, y cada permiso se corre con la casilla ([la excepción y sus medidas](../../../docs/design/roles-y-permisos.md#la-banda-una-excepción-a-tablesectiontoggle)). El esqueleto usa `PermissionAreaLoading`, con las mismas zonas.
- Al entrar se abren las áreas con algo guardado o elegido (`areaStartsOpen`); el selector sólo guarda las que la persona abrió o cerró. Sin buscador, filtros, cuentas ni descripciones a la vista.
- La casilla del área (vacía, parcial o completa) la lleva toda área, también la de un solo permiso, y actúa sobre toda el área. Qué permite cada permiso va en la (i) del área, un permiso por renglón, y es la descripción accesible de su casilla: nunca una leyenda en la fila.
- Un permiso incluye a otros (`includes` del catálogo; el front no repite la lista). Marcarlo marca lo incluido y lo deja apagado con `aria-disabled` y su motivo en `DisabledReason`, que nombra a todos los marcados que lo incluyen; quitarlo deja lo incluido marcado. El editor siembra, compara y guarda lo que el rol permite (`allowedPermissions`): un rol viejo con «Administrar» y sin «Ver» abre sin cambios.
- Admin se lee: sin casillas ni botones, la banda sin tilde ni casilla y sus áreas cerradas; abierta, una tilde por permiso. El porqué va en la (i) del título. User conserva el nombre de sólo lectura con el porqué en la (i) de «Nombre».
- Los roles del sistema y los asignados conservan sus restricciones; ocultá acciones sin permiso.
- Editar manda la `revision` del rol sembrado (`expectedRevision`, N2). Ante `409 Roles.Role.RevisionConflict` el editor relee el rol: con el mismo nombre, descripción y permisos que lo sembrado guarda una sola vez más con la revisión releída. Si difieren o vuelve a chocar, el borrador queda y se revisa como en `/configuracion`: «Revisar valores actuales» en la banda, Guardar con su motivo y la comparación con el nombre, la descripción y cada permiso distinto; conservar los cambios mezcla los permisos de a uno (quedan los que sumó el borrador y se van los que sacó), y «Mi borrador» muestra lo que quedaría al conservar. Si eso es justo lo releído (otro sumó lo que incluye lo que el borrador sacó), se adopta sin comparar.
- Un permiso que el catálogo cargado no declara no tiene casilla y se descarta al guardar, después de nombrarlo en un `ConfirmDialog` (B2): cancelar no guarda.
- `Roles.Role.HasUsers` usa `userCount` de ProblemDetails y pluralización del front. Las mutaciones invalidan catálogo, detalle y permisos propios cuando corresponde.

## Referencias

- [Editor, permisos y errores](../../../docs/architecture.md).
- [Formulario en ruta propia](pages/RoleEditorPage.tsx).
- [Las áreas plegables y sus estados (RO3-D)](../../../docs/design/roles-y-permisos.md).
- [Contrato de roles](../../../../ArquitecturaBase/docs/features/administracion.md).
