# Features: áreas del producto

Cada área contiene páginas, componentes, API y errores propios. `auth` muestra acceso; `users`, `roles`, `profile` y `settings`, gestión; `home`, inicio; `errors`, pantallas de navegación fallida.

## Al modificar

- Una feature nunca importa otra feature. Contratos, hooks o UI compartidos suben a `shared`.
- Antes de una pantalla nueva, leé el contrato visual y armá el tablero funcional para la elección del usuario.
- Registrá ruta, permiso y navegación en sus puntos comunes. Los datos van por TanStack Query y la API común.
- Conservá estados de carga, vacío, error, permisos, filtros y diálogos; probá comportamiento con el arnés compartido.
- Los mensajes siguen el contrato transversal: la feature aporta códigos/campos de negocio, no
  ubicación, duración ni fallbacks técnicos propios. Probar canal, cantidad y borrador; los
  desvíos actuales se migran por el inventario, no se copian a una pantalla nueva.
- Una área nueva agrega su guía local, textos en ambos idiomas y entrada en el mapa de instrucciones.

## Referencias

- [Convenciones de features](../../docs/architecture.md).
- [Pantalla nueva: tablero primero](../../docs/design/visual-baseline.md).
- [Mapa de áreas](../../docs/mapa-de-instrucciones.md).
- [Premisas de desarrollo de pantallas](../../docs/guides/premisas-de-desarrollo.md).
- [Contrato de mensajes y estados](../../docs/guides/mensajes-y-estados.md).
