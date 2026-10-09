# Auth: sesión y permisos compartidos

Contiene configuración y proveedor OIDC, sesión actual, renovación, guards, permisos, nombre de cuenta y preferencia de idioma. Las pantallas de acceso viven en `features/auth`.

## Al modificar

- Los tokens viven en memoria; no guardar credenciales en almacenamiento del navegador.
- Una recuperación silenciosa se intenta una vez por montaje del proveedor; los 401 concurrentes coordinan una sola renovación desde el cliente HTTP.
- El cierre de sesión espera la revocación del servidor y limpia consultas y sesión. No reutilizar un refresh token.
- La transición de cierre dura hasta confirmar `/login`: los guards no convierten el cierre voluntario en una recuperación hacia la pantalla de la cuenta anterior. El próximo ingreso usa Inicio; una visita anónima a una ruta privada conserva su destino.
- Los permisos del front controlan la experiencia; el backend vuelve a autorizar cada petición.
- Cuenta sin correo y sincronización del idioma tienen helpers comunes; no duplicar fallbacks en el menú o las pantallas.
- `components/AccountRecoveryNotice` comparte el aviso duradero de cuenta sin correo entre los dos inicios autenticados, con la misma sesión/identidad y textos auth.

## Referencias

- [Sesión, idioma y cuentas](../../docs/architecture.md).
- [Renovación de peticiones](../shared/api/httpClient.ts).
- [Contrato de identidad del backend](../../../ArquitecturaBase/docs/features/identidad.md).
