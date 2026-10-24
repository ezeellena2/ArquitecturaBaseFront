# App: composición y rutas

Monta providers, router y árbol de rutas. `routes.tsx` declara rutas y guards; `router.tsx` crea el router.

## Al modificar

- Las rutas del SPA están en español. Un permiso de administración se declara en la ruta y en la navegación.
- Las páginas de módulos se cargan con `lazy`; el acceso público conserva carga estática. Sus tests esperan el render asíncrono.
- Conservá providers únicos de sesión, consultas, traducción y tooltips; no crear uno distinto por pantalla.
- `AuthenticatedHome` compone Dashboard o asistente lazy según `installedFeatures` (`assistant`) y `ai.assistant.use`. La capability pública no autoriza datos. Un error de presentación ofrece recuperación; no equivale a módulo ausente. El asistente se monta por ID de usuario para aislar borradores y acciones tardías.
- El único Toaster productivo va en AppProviders; su política no varía por ruta. La adopción
  del emisor y las pruebas de arquitectura sigue el plan transversal de mensajes.
- Las rutas tienen un ErrorBoundary estático y traducido para fallos de render/importación.
  RouteErrorPage ofrece recarga explícita, sin reintentos ni descarte automático de borradores.
  El límite privado de ProtectedRoute conserva AppLayout; el raíz cubre la carga inicial.
- `HomeLayout` mantiene `AppLayout` entre rutas privadas; no forzar un remount del caparazón al navegar.
- El RouterProvider productivo viene de `react-router/dom`, para confirmar `/login` con `flushSync` antes de liberar la transición del cierre de sesión.

## Referencias

- [Rutas y sesión](../../docs/architecture.md).
- [Menú y jerarquía de rutas](../layouts/navigation.ts).
- [Guard compartido](../auth/ProtectedRoute.tsx).
- [Contrato de mensajes y estados](../../docs/guides/mensajes-y-estados.md).

- `SystemTheme`, bajo QueryClientProvider, aplica la apariencia pública a documentElement.
  Abarca acceso público y portales; no guarda preferencias locales ni depende de una feature.

`routes` compone `FormOverviewShell` alrededor de AppLayout, sin desmontar el caparazón entre rutas. El contexto neutral sólo aporta el conteo global de aprobaciones; la lectura lazy se monta al abrir Gestión de formularios o entrar en el área y sólo con Decide. MF1 no monta la navegación dinámica anterior. `ResponseWorkspaceLayout` conserva filtros, navegación y archivos entre las rutas de un formulario.

MF1 y el espacio por formulario exigen RecordsRead OR ApprovalsDecide con el requisito común del menú. Los valores y el detalle siguen exigiendo RecordsRead: quien sólo decide ve tareas y decisión, sin lecturas de respuestas o workflow. `approval=TaskId` selecciona el pendiente; `:recordId` conserva la selección de planilla. El contexto de navegación es privado del workspace, sin callbacks ni filtros en history.state.

La ruta estática /formularios/faltantes exige formtemplates.manage independientemente de formtemplates.read. El alta /formularios/nuevo conserva Read+Manage; su semilla de nombre no concede permisos ni escribe el pedido.

La ruta /formularios/:formId/respuestas/:recordId/completa exige RecordsRead y comparte el workspace del formulario con D2. En celular, la entrada D2 con Read redirige allí; la decisión sin lectura conserva su marco de metadata. El enlace completo lleva sólo orden, pregunta de orden y versiones públicos; filtros privados y origen permanecen en memoria.

`UserDataSectionShell` aporta la sección lazy de Datos sólo con forms en installedFeatures y UsersManage. El contrato neutral no conserva valores. La carga de la sección tiene su Suspense local, sin desmontar AppLayout. La tabla del módulo abre el editor de usuario por id mediante app. Mientras la persona carga (y mientras llega el editor lazy), el diálogo «Editar usuario» muestra la carga, «No tenés permiso» ante un 403 u otro error con Reintentar, y Cerrar en el pie; al cerrar, el foco vuelve al botón que lo abrió. /datos-de-personas exige FormPersonDataManage; UsersRead se controla sólo para la tabla de personas.
