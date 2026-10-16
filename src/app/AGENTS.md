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

`FormResponsesShell` compone el contexto de navegación y el alcance privado de respuestas alrededor de AppLayout, sin desmontar el caparazón entre rutas. La feature aporta lecturas autorizadas; layouts recibe un contexto neutral.
