# Users: administración de cuentas

Muestra listado, filtros y conteos, alta, edición de roles, estado de medios de ingreso e invitaciones.

## Al modificar

- Filtros, búsqueda, orden y paginado viven en URL. El conteo ignora su propio filtro y las opciones con cero se deshabilitan.
- Alta y edición usan diálogos distintos: editar no crea identidades. Invitaciones piden canal y consentimiento según su contrato.
- La sección opcional de datos llega por `shared/hooks/userDataSectionContext`, sin importar otro módulo. Guardar confirma primero el usuario y luego sólo los datos cambiados; si éstos fallan, conserva el diálogo y la sección explica que el usuario ya se guardó. El controller de la sección vive en el diálogo, sin valores en la coordinación ni en MutationCache.
- Editar reemplaza nombre y roles juntos en un solo PUT. Reenviar una invitación espera un minuto desde que llegó el detalle y vuelve a pedir el consentimiento cada vez (`components/LastInvitationStrip.tsx`, `components/UserEditDialog.tsx`). La espera es el motivo de «Reenviar invitación» (`DisabledReason`), sin texto debajo, y el botón no cambia de lugar ni de forma: el contorno lo pide sólo una invitación que no llegó.
- Un destino cargado por admin queda sin verificar; conservá su explicación accesible y formato de teléfono del backend.
- Acciones usan permisos y `RowActions` con nombre de fila. Tras mutar invalidá listados, conteos y datos afectados.
- Resultados y errores generales usan el único Toaster abajo a la derecha; los errores de campo se muestran junto al control. Conservá borrador y diálogo de edición ante un fallo y no dupliques el aviso.

## Referencias

- [Listados e invitaciones](../../../docs/architecture.md).
- [Reglas de usuarios](../../../../ArquitecturaBase/docs/features/administracion.md).
- [Filtros y claves de consultas](api/users.ts).
- [Política común de mensajes](../../../docs/guides/premisas-de-desarrollo.md#mensajes-de-error-y-notificaciones).
