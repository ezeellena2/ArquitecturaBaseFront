# Auth: sesión y permisos compartidos

Contiene configuración y proveedor OIDC, sesión actual, renovación, guards, permisos, nombre de cuenta y preferencia de idioma. Las pantallas de acceso viven en `features/auth`.

## Al modificar

- Los tokens viven en memoria; no guardar credenciales en almacenamiento del navegador.
- Una recuperación silenciosa se intenta una vez por montaje del proveedor; los 401 concurrentes coordinan una sola renovación desde el cliente HTTP.
- El cierre de sesión espera la revocación del servidor y limpia consultas y sesión. No reutilizar un refresh token.
- Los permisos del front controlan la experiencia; el backend vuelve a autorizar cada petición.
- Cuenta sin correo y sincronización del idioma tienen helpers comunes; no duplicar fallbacks en el menú o las pantallas.

## Referencias

- [Sesión, idioma y cuentas](../../docs/architecture.md).
- [Renovación de peticiones](../shared/api/httpClient.ts).
- [Contrato de identidad del backend](../../../ArquitecturaBase/docs/features/identidad.md).
