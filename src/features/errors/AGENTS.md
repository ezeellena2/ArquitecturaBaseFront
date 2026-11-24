# Errors: páginas de navegación fallida

Contiene la página de ruta inexistente: con sesión se ve adentro del caparazón, con la forma del error de una ruta (SP1-B). La falta de permiso vive en `shared/ui/ForbiddenPage`: la muestran en su lugar `ProtectedRoute` y las pantallas que reciben un 403.

## Al modificar

- Usá texto traducido y layout compartido. Una falla de una consulta se presenta en su feature, no redirigiendo toda la app a esta carpeta.
- No reemplazar 401 por sin permiso: la sesión se recupera o se vuelve al ingreso mediante el mecanismo compartido.
- Conservá foco, navegación y opciones de volver en los escenarios sin acceso.

## Referencias

- [Decisión de acceso](../../auth/ProtectedRoute.tsx).
- [Rutas y errores](../../../docs/architecture.md).
