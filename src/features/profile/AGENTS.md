# Profile: cuenta propia

Muestra los datos del perfil, los medios de ingreso y el chat de WhatsApp del número, como tres zonas apiladas igual que Configuración (tablero PF1-A, 2026-11-03). Comparte verificación de destinos con acceso y conserva reglas del último medio de ingreso.

## Al modificar

- `PUT /api/me` reemplaza nombre, idioma y zona: enviá los tres aunque cambie uno. Guardar se apaga sin cambios.
- Guardar de «Datos del perfil» actúa sobre toda la zona: va en las acciones de su `Surface`, al borde derecho de la banda y a la altura del título, y envía el formulario por su id (`form={formId}`), sin pie. Los campos miden lo de Configuración y, en el celular, todo el ancho.
- Medios de ingreso y chat se leen en `AccountRows` (`shared/ui`), la misma pieza que «Editar usuario». El último ingreso es un dato de los medios, no un campo.
- Correo y número usan verificación por destino con el diálogo común; la oferta de agregar el número depende del backend. Un número sin verificar ofrece «Verificar» con el número ya escrito.
- Cada medio verificado confirma los cambios del otro (N11, «cada medio confirma», [identidad](../../../../ArquitecturaBase/docs/features/identidad.md)). «Agregar correo» con el número verificado pide también el código que confirma el cambio, mandado a ese número (`POST /api/me/whatsapp/confirmation-code`, va como `phoneCode`); «Agregar número» o «Verificar» con el correo verificado, el mandado a ese correo (`POST /api/me/email/confirmation-code` con `LinkPhone`, va como `emailCode`). Lo resuelve el diálogo común con el perfil de la sesión: un segundo campo con su texto, su error y su propio reenvío; cada código se pide y se reenvía por separado, y que falle uno no vuelve atrás ni gasta el otro. Si el servidor pide un código que el perfil a la vista no conocía, se relee el perfil y un aviso lo dice. Si WhatsApp no manda códigos, «Agregar correo» queda apagado con el porqué. «Desvincular» con un correo verificado pide el código de ese correo (`UnlinkPhone`, `UnlinkWhatsAppCodeDialog`); sin él, la confirmación de siempre. Un 409 de estas rutas no es de un código: va a un aviso, cierra el diálogo y relee el perfil. El perfil no cambia un correo ni un número verificados.
- El único medio de ingreso no se desvincula. Ante el conflicto correspondiente, volvé a consultar el perfil. «Desvincular» va en rojo (`destructive-outline`).
- El chat (`GET /api/me/whatsapp`, sólo con WhatsApp prendido y el número verificado) dice si está vinculado y hasta cuándo llegan los avisos. Se vincula confirmando el número con un código; un mensaje nunca vincula. Sin chat, «Abrir el chat» lleva a `wa.me`; al volver a la pestaña se relee.
- Conservá formato de teléfono, estados de verificación y mensajes para destino ocupado; no inferir una cuenta solo desde correo.
- Los cambios refrescan usuario actual y preferencia de idioma. No modificar la sesión por un desvínculo que debe conservarla.

## Referencias

- [Perfil y medios de ingreso](../../../docs/architecture.md).
- [Contrato de perfil](../../shared/api/profile.ts).
- [Verificación e identidad](../../../../ArquitecturaBase/docs/features/identidad.md) y [el chat del número](../../../../ArquitecturaBase/docs/features/whatsapp.md).
- [Diseño elegido](../../../docs/design/visual-baseline.md#mi-perfil-y-el-chat-de-whatsapp--2026-11-03).
