# Auth: sesión y permisos compartidos

Contiene configuración y proveedor OIDC, sesión actual, renovación, guards, permisos, nombre de cuenta y preferencia de idioma. Las pantallas de acceso viven en `features/auth`.

## Al modificar

- Los tokens viven en memoria; no guardar credenciales en almacenamiento del navegador.
- Una recuperación silenciosa se intenta una vez por montaje del proveedor; los 401 concurrentes coordinan una sola renovación desde el cliente HTTP.
- El cierre de sesión espera la revocación del servidor y limpia consultas y sesión (`useSignOut`). Antes de dejar los tokens espera la renovación en vuelo (`waitForSessionRenewal`), que si no volvería a guardar el usuario. No reutilizar un refresh token.
- Cerrar sesión cierra las demás pestañas del mismo navegador (N12): cada una tiene su propia autorización. Recién con el cierre confirmado por el servidor, `useSignOut` avisa por un `BroadcastChannel` (`signOutChannel`), por el mismo canal en el que escucha la pestaña, que no se escucha a sí misma. Escucha `SignOutFromOtherTabs` (`useSignOutFromOtherTabs`), la raíz sin path de todas las rutas: alcanza también a `/sin-permiso`, la 404 y el error de una rama, no tiene límite de error propio y cierra el canal al desmontar la app. La que recibe el aviso revoca su autorización con su propio `id_token_hint`, deja los tokens y confirma `/login` como el cierre explícito, aunque la revocación falle, y no vuelve a avisar. Sin sesión en memoria lo ignora, salvo durante la recuperación silenciosa: cierra la sesión que traiga apenas llega, y si termina sin sesión no queda nada pendiente. Si la pestaña ya estaba cerrando, sigue la suya, y si esa falla en el servidor cierra igual de forma local, sin avisar. El aviso no se guarda (una sesión que entra después no lo recibe), cierra todas las pestañas sin distinguir la cuenta, no pregunta por cambios sin guardar y sin `BroadcastChannel` no se avisa. El vencimiento de la sesión (`onSessionExpired`) no tiene un camino común con el cierre y no avisa.
- La transición de cierre dura hasta confirmar `/login`: los guards no convierten el cierre voluntario en una recuperación hacia la pantalla de la cuenta anterior. El próximo ingreso usa Inicio; una visita anónima a una ruta privada conserva su destino.
- Los permisos del front controlan la experiencia; el backend vuelve a autorizar cada petición. `PermissionRequirement` comparte la regla entre menú y guard: un permiso exige ese valor; una lista permite cualquiera de sus alternativas y una lista vacía no autoriza.
- Cuenta sin correo y sincronización del idioma tienen helpers comunes; no duplicar fallbacks en el menú o las pantallas.
- `useProfileLanguageSync` aplica cada idioma que trae el perfil una sola vez y, si difiere del de la interfaz, espera a que ningún editor que se reinicia con el idioma tenga cambios sin guardar (`useHasUnsavedChanges`): aplicarlo antes perdería lo escrito sin preguntar.
- `components/AccountRecoveryNotice` comparte el aviso duradero de cuenta sin correo entre los dos inicios autenticados, con la misma sesión/identidad y textos auth.

## Referencias

- [Sesión, idioma y cuentas](../../docs/architecture.md).
- [Renovación de peticiones](../shared/api/httpClient.ts).
- [Contrato de identidad del backend](../../../ArquitecturaBase/docs/features/identidad.md).
