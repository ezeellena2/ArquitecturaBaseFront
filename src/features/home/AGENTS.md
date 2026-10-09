# Home: inicio autenticado

`DashboardPage` conserva el inicio base cuando IA no está instalada o falta ai.assistant.use. La bienvenida pública vive en `features/auth`; app/AuthenticatedHome compone el inicio privado sin imports entre features.

## Al modificar

- Reutilizá `Page`, layouts y datos de la sesión compartida.
- Una sección de negocio nueva no se agrega a este módulo por comodidad; creá su feature y definí permiso y navegación.
- Conservá separación de inicio público y autenticado sin duplicar recuperación de sesión.

## Referencias

- [Composición de inicio](../../app/AGENTS.md).
- [Inicio aprobado](../../../docs/design/visual-baseline.md).
