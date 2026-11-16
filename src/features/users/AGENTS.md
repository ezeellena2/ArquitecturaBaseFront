# Users: administración de cuentas

Muestra listado, filtros y conteos, alta, edición de roles, estado de medios de ingreso e invitaciones.

## Al modificar

- Filtros, búsqueda, orden y paginado viven en URL. Rol y «Más filtros › Creado» son desplegables simples (FO1-A, 2026-11-03): una opción por renglón, sin la cantidad, con la elegida tildada y ninguna apagada; sus opciones salen de `filter-counts`, cuyas cantidades no se muestran; por eso se pide una vez, sin la búsqueda ni los filtros, y no en cada búsqueda (N30).
- Alta y edición usan diálogos distintos: editar no crea identidades. Invitaciones piden canal y consentimiento según su contrato.
- La sección opcional de datos llega por `shared/hooks/userDataSectionContext`, sin importar otro módulo. Guardar confirma primero el usuario y luego sólo los datos cambiados; si éstos fallan, conserva el diálogo y la sección explica que el usuario ya se guardó. El controller de la sección vive en el diálogo, sin valores en la coordinación ni en MutationCache.
- Editar reemplaza nombre y roles juntos en un solo PUT, con la `revision` del detalle con el que se sembró el borrador (`expectedRevision`, N2). El borrador se siembra sólo con la lectura de este montaje, nunca con la caché (`refetchOnMount: "always"` e `isFetchedAfterMount`, como el editor de roles). Ante `409 Users.User.RevisionConflict` el diálogo relee: con el mismo nombre y los mismos roles que la base (otro cambió el estado, un correo, un número) guarda una sola vez más con la revisión releída. Si difieren o vuelve a chocar, el borrador queda, «Revisar valores actuales» va en el pie antes de Cancelar, Guardar espera con su motivo y la comparación (sólo lo distinto, `ComparisonTable`) ofrece usar lo actual o conservar lo cambiado, como `/configuracion`. Conservar mezcla los roles de a uno (quedan los que sumó el borrador y se van los que sacó; uno que otro sacó y el borrador no tocó no vuelve), y «Mi borrador» muestra eso. Una relectura con otra revisión y el mismo nombre y los mismos roles (el desvínculo hecho en el diálogo, un correo) adopta la revisión sola. Reenviar una invitación espera un minuto desde que llegó el detalle y vuelve a pedir el consentimiento cada vez (`components/LastInvitationStrip.tsx`, `components/UserEditDialog.tsx`). La espera es el motivo de «Reenviar invitación» (`DisabledReason`), sin texto debajo, y el botón no cambia de lugar ni de forma: el contorno lo pide sólo una invitación que no llegó.
- Un destino cargado por admin queda sin verificar; conservá su explicación accesible (`VerificationBadge hint` en «Editar usuario», y la ayuda del «No» de «Verificado» en el listado) y formato de teléfono del backend.
- El listado lleva un dato por columna (UD5, 2026-11-09): «Correo», con el punto de estado delante (la única excepción del listado), «WhatsApp» y «Verificado».
- Los medios de ingreso de «Editar usuario» son `AccountRows`, la misma pieza que Mi perfil (PF1-A, 2026-11-03), y «Desvincular» va en rojo antes de confirmar (`destructive-outline`); la confirmación sigue diciendo qué se pierde.
- Acciones usan permisos y `RowActions` con nombre de fila. Tras mutar invalidá listados, conteos y datos afectados; activar, desactivar, eliminar y restaurar (el alta con los datos de una cuenta eliminada) avanzan la revisión, así que también el detalle (`userQueryKey`).
- Resultados y errores generales usan el único Toaster abajo a la derecha; los errores de campo se muestran junto al control. Conservá borrador y diálogo de edición ante un fallo y no dupliques el aviso.

## Referencias

- [Listados e invitaciones](../../../docs/architecture.md).
- [Reglas de usuarios](../../../../ArquitecturaBase/docs/features/administracion.md).
- [Filtros y claves de consultas](api/users.ts).
- [Política común de mensajes](../../../docs/guides/premisas-de-desarrollo.md#mensajes-de-error-y-notificaciones).
