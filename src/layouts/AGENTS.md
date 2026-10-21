# Layouts: caparazón y navegación

Define layouts de acceso, inicio y aplicación autenticada, además de barra, menú, sidebar y migas.

## Al modificar

- WhatsApp, Formularios y Administración comparten el trigger y geometría del panel. El detalle del Sidebar, las migas y el menú de usuario está en [components](components/AGENTS.md). Solo uno se abre a la vez; la ruta abre su sección y los permisos filtran sus destinos. En móvil se despliegan dentro del cajón.
- Inicio muestra su HomeIcon también expandido y en móvil. WhatsApp lleva encima la misma línea de Administración; se dibuja sólo junto a su sección visible, también contraída.

- Ruta y menú mantienen los mismos permisos mediante `PermissionRequirement` y `usePermissions.has`, incluidas las alternativas OR. Las rutas hijas usan la sección padre; la pantalla aporta la hoja de sus migas.
- Al cerrar sesión, HomeLayout conserva la transición de AppLayout aunque OIDC ya haya quitado el usuario. UserMenu confirma `/login` con `flushSync` antes de liberarla: un cierre voluntario nunca guarda la ruta privada anterior como destino del próximo ingreso. Playwright lo verifica desde Inicio, Usuarios y Configuración.
- `AppLayout` tiene alto `h-svh` y scroll en `main`, con posición relativa y espacio de scroll para el encabezado adherido. Preservá impresión y foco visible.
- No agregar scroll de página que rompa `Page`; un cambio de geometría se verifica en navegador porque jsdom no maqueta.
- Los controles usan `ActionTooltip` e `IconButton` compartidos y textos traducidos. La preferencia de idioma se sincroniza con la cuenta.

## Referencias

- [Navegación, scroll y accesibilidad](../../docs/architecture.md).
- [Caparazón aprobado](../../docs/design/visual-baseline.md).
- [Encabezado y cuerpo compartidos](../shared/ui/Page.tsx).

Formularios compone «Respuestas» dinámicas con la navegación fija de diseño/catálogos. `formsNavigation` es neutral; layouts informa si el panel está abierto y app aporta resultados HTTP y recuperación. Layouts no importa composición de app. «Ver todos» aparece si el backend informa más páginas; nunca fijar formularios por nombre o ID en navigation.ts.

Las migas de respuesta leen número y nombre del padre aportados por el detalle mediante el hook neutral; el listado paginado de navegación no es fuente del nombre confirmado.

Las migas del diseño PDF usan el nombre confirmado que aporta su pantalla: Inicio / formulario / Diseño del PDF. El formulario enlaza al editor sólo con formtemplates.read; RulesManage por sí solo conserva el nombre como texto.

«Formularios que faltan» es un destino fijo de Formularios, debajo de Catálogos, con formtemplates.manage exacto. Sus migas usan la entrada propia y no enlazan al listado de diseño sin permiso de lectura.
