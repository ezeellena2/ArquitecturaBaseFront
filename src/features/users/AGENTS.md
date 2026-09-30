# Users: administración de cuentas

Muestra listado, filtros y conteos, alta, edición de roles, estado de medios de ingreso e invitaciones.

## Al modificar

- Filtros, búsqueda, orden y paginado viven en URL. El conteo ignora su propio filtro y las opciones con cero se deshabilitan.
- Alta y edición usan diálogos distintos: editar no crea identidades. Invitaciones piden canal y consentimiento según su contrato.
- Un destino cargado por admin queda sin verificar; conservá su explicación accesible y formato de teléfono del backend.
- Acciones usan permisos y `RowActions` con nombre de fila. Tras mutar invalidá listados, conteos y datos afectados.
- Resultados y errores generales usan el único Toaster abajo a la derecha; los errores de campo se muestran junto al control. Conservá borrador y diálogo de edición ante un fallo y no dupliques el aviso.

## Referencias

- [Listados e invitaciones](../../../docs/architecture.md).
- [Reglas de usuarios](../../../../ArquitecturaBase/docs/features/administracion.md).
- [Filtros y claves de consultas](api/users.ts).
- [Política común de mensajes](../../../docs/guides/premisas-de-desarrollo.md#mensajes-de-error-y-notificaciones).
