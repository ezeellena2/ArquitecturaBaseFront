# App: composición y rutas

Monta providers, router y árbol de rutas. `routes.tsx` declara rutas y guards; `router.tsx` crea el router.

## Al modificar

- Las rutas del SPA están en español. Un permiso de administración se declara en la ruta y en la navegación.
- Las páginas de módulos se cargan con `lazy`; el acceso público conserva carga estática. Sus tests esperan el render asíncrono.
- Conservá providers únicos de sesión, consultas, traducción y tooltips; no crear uno distinto por pantalla.
- El único Toaster productivo va en AppProviders; su política no varía por ruta. La adopción
  del emisor y las pruebas de arquitectura sigue el plan transversal de mensajes.
- `HomeLayout` mantiene `AppLayout` entre rutas privadas; no forzar un remount del caparazón al navegar.

## Referencias

- [Rutas y sesión](../../docs/architecture.md).
- [Menú y jerarquía de rutas](../layouts/navigation.ts).
- [Guard compartido](../auth/ProtectedRoute.tsx).
- [Contrato de mensajes y estados](../../docs/guides/mensajes-y-estados.md).
