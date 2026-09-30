# Home: inicio autenticado

`DashboardPage` muestra el inicio para quien tiene sesión. La bienvenida pública vive en `features/auth` y la elección se compone en las rutas.

## Al modificar

- Reutilizá `Page`, layouts y datos de la sesión compartida.
- Una sección de negocio nueva no se agrega a este módulo por comodidad; creá su feature y definí permiso y navegación.
- Conservá separación de inicio público y autenticado sin duplicar recuperación de sesión.

## Referencias

- [Composición de inicio](../../app/AGENTS.md).
- [Inicio aprobado](../../../docs/design/visual-baseline.md).
