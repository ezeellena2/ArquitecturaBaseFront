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

`routes` compone `FormResponsesShell` alrededor de AppLayout, sin desmontar el caparazón entre rutas. El shell entrega un contexto neutral y carga la lectura de navegación con un import dinámico al abrir el panel o entrar a Formularios. `ResponseWorkspaceLayout` mantiene el alcance privado de filtros y archivos sólo entre las rutas de respuestas.

D2 anida `:recordId` bajo la planilla y `:taskId` bajo Por aprobar para conservar el listado montado. Cada página compone un único panel; la bandeja activa ResponseWorkspaceProvider con formId explícito sólo si existe RecordsRead. No hay contexto de navegación global ni acceso a valores por el permiso de decidir.

La ruta estática /formularios/faltantes exige formtemplates.manage independientemente de formtemplates.read. El alta /formularios/nuevo conserva Read+Manage; su semilla de nombre no concede permisos ni escribe el pedido.
