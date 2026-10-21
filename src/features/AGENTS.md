# Features: áreas del producto

Cada área contiene páginas, componentes, API y errores propios. `auth` muestra acceso; `users`, `roles`, `profile` y `settings`, gestión; `home`, inicio; `errors`, la página de ruta inexistente. El estado de falta de permiso vive en `shared/ui/ForbiddenPage` y se comparte con las áreas que reciben un 403.

`whatsapp` contiene el chat productivo de atención, con el diseño aprobado del laboratorio. `artificial-intelligence` configura/prueba la conexión compartida, mantiene información del negocio y aporta el asistente de consultas al Inicio compuesto desde app, independiente de settings y WhatsApp. WhatsApp integra modos, origen explícito y revisión manual de sugerencias con prellenados; contactos y plantillas siguen pendientes.

`business-forms` diseña, publica y gestiona los formularios por WhatsApp: editor e idiomas, catálogos, planilla y Excel, detalle y aprobaciones, reglas y PDF, sugerencias, formularios que faltan y ciclo de vida (baja, reactivación y eliminación). Su [guía](business-forms/AGENTS.md) es el índice de `api`, `hooks`, `components` y `pages`; el estado de cada tablero está en el [diseño elegido](../../docs/design/formularios-whatsapp.md).

## Al modificar

- Una feature nunca importa otra feature. Contratos, hooks o UI compartidos suben a `shared`.
- La presentación usa las composiciones y variantes del [estándar visual](../../docs/guides/estandar-visual.md). Los controles de `npm run lint` impiden controles nativos, paletas, radios, tamaños de texto y sobrescrituras locales. Una diferencia visual también se comprueba con `npm run test:visual`.
- El diseño actual se conserva. Formularios y refinamientos de todas las áreas usan las mismas piezas, incluidos checks, modales, desplegables e íconos de `shared/ui/icons`. La ayuda contextual usa `ActionTooltip`, nunca un `title` nativo. Una referencia externa no autoriza cambiar de tema.
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
