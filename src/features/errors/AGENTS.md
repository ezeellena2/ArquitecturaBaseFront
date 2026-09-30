# Errors: páginas de navegación fallida

Contiene pantallas de sin permiso y ruta inexistente. Presenta el estado y un camino de salida dentro del SPA.

## Al modificar

- Usá texto traducido y layout compartido. Una falla de una consulta se presenta en su feature, no redirigiendo toda la app a esta carpeta.
- No reemplazar 401 por sin permiso: la sesión se recupera o se vuelve al ingreso mediante el mecanismo compartido.
- Conservá foco, navegación y opciones de volver en los escenarios sin acceso.

## Referencias

- [Decisión de acceso](../../auth/ProtectedRoute.tsx).
- [Rutas y errores](../../../docs/architecture.md).
