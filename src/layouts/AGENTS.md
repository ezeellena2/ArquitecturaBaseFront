# Layouts: caparazón y navegación

Define layouts de acceso, inicio y aplicación autenticada, además de barra, menú, sidebar y migas.

## Al modificar

- WhatsApp, Formularios, cada carpeta y Administración comparten el trigger y geometría del panel. El detalle del Sidebar, las migas y el menú de usuario está en [components](components/AGENTS.md). Solo uno se abre a la vez; la ruta abre su sección y los permisos filtran sus destinos. En móvil se despliegan dentro del cajón.
- Inicio muestra su HomeIcon también expandido y en móvil. WhatsApp lleva encima la misma línea de Administración; se dibuja sólo junto a su sección visible, también contraída.

- Ruta y menú mantienen los mismos permisos mediante `PermissionRequirement` y `usePermissions.has`, incluidas las alternativas OR. Las rutas hijas usan la sección padre; la pantalla aporta la hoja de sus migas.
- Al cerrar sesión, HomeLayout conserva la transición de AppLayout aunque OIDC ya haya quitado el usuario. `useSignOut` (de `auth`, que usa UserMenu) confirma `/login` con `flushSync` antes de liberarla: un cierre voluntario nunca guarda la ruta privada anterior como destino del próximo ingreso. Playwright lo verifica desde Inicio, Usuarios y Configuración.
- `AppLayout` tiene alto `h-svh` y scroll en `main`, con posición relativa y espacio de scroll para el encabezado adherido. Preservá impresión y foco visible.
- Las teclas que mueven una página (Re Pág, Av Pág, Inicio, Fin, Espacio y flechas) mueven `main` aunque el foco esté en el menú, en la barra o en ninguna parte: `main` es enfocable (`tabIndex={-1}`, sin contorno) y la tecla le pasa el foco. Un control que la usó, un botón con Espacio, el contenido y los diálogos se la quedan. Lo prueban `AppLayout.test.tsx` y, con la tecla real, `design.spec`.
- No agregar scroll de página que rompa `Page`; un cambio de geometría se verifica en navegador porque jsdom no maqueta.
- Los controles usan `ActionTooltip` e `IconButton` compartidos y textos traducidos. La preferencia de idioma se sincroniza con la cuenta; cambiarla con cambios sin guardar en un editor que se vuelve a montar con el idioma (hoy, el diseño del PDF) pide confirmación; los demás conservan lo escrito. Por lo mismo, un idioma de la cuenta cambiado en otra pestaña se aplica recién cuando esos editores no tienen cambios (`useProfileLanguageSync`).

## Referencias

- [Navegación, scroll y accesibilidad](../../docs/architecture.md).
- [Caparazón aprobado](../../docs/design/visual-baseline.md).
- [Encabezado y cuerpo compartidos](../shared/ui/Page.tsx).

Gestión de formularios ([FU1-B y FU2-A](../../docs/design/formularios-una-entrada.md), 2026-11-23) tiene dos grupos separados por una línea sin título: arriba lo de todos los días, «Formularios» (`/formularios`, la lista única: TemplatesRead OR RecordsRead OR ApprovalsDecide OR RecordsCreate) y «Documentos recibidos»; abajo, Catálogos, Biblioteca y Formularios que faltan. Sin nada en uno de los grupos, la línea no se dibuja (`FormsDailyLinks`). El conteo de «Formularios» sólo se muestra con Decide. «Formularios» queda marcado en todas las pantallas de un formulario (la lista, el editor, la planilla, la respuesta y la carga), no en las otras páginas del panel, que viven bajo la misma dirección. `formsOverviewNavigation` es neutral: layouts informa si el panel está abierto y app aporta conteo y recuperación. No se dibujan formularios individuales ni una bandeja global.

«Documentos recibidos» (DOC5-A) va debajo de «Formularios», en el grupo de todos los días (FU1-B); con `formdocuments.read`, y dice cuántos documentos esperan a alguien del equipo (`documents` del contexto neutral), con su bloque de carga en el mismo renglón y «Reintentar» si no se pudo leer, como «Formularios» (`ReceivedDocumentsLink`); sólo ese permiso ya muestra el panel. Las migas toman el enlace más específico (`parentLinkOf`): un documento abierto (`/formularios/documentos/{id}`) cuelga de él y no de `/formularios`, del que cuelgan el editor y la planilla.

Las migas de respuesta leen número y nombre del padre aportados por el detalle mediante el hook neutral; el listado paginado de navegación no es fuente del nombre confirmado.

Las migas del diseño PDF usan el nombre confirmado que aporta su pantalla: Inicio / formulario / Diseño del PDF. El formulario enlaza al editor sólo con formtemplates.read; RulesManage por sí solo conserva el nombre como texto.

«Formularios que faltan» es un destino fijo de Formularios, debajo de Catálogos, con formtemplates.manage exacto. Sus migas usan la entrada propia y no enlazan al listado de diseño sin permiso de lectura.

Datos de las personas es una entrada plana de Administración, con formpersondata.manage. La lectura de personas exige además users.read dentro de la pantalla; ese requisito no oculta la administración de definiciones.

Carpetas en el menú (CM1 a CM6): `folderMenuNavigation` es el contrato neutral; `app` lo llena y el menú dibuja cada carpeta del primer nivel como un panel propio, después de WhatsApp y antes de Administración, con sus formularios y un grupo por subcarpeta. A quien administra formularios el contrato le suma `act`: el menú pide crear, editar, mover, borrar o agregar formularios, con adónde vuelve el foco (lo que lo pidió o, si su carpeta dejó el menú, «Nueva carpeta»), y `app` dibuja el diálogo sin que `layouts` importe la feature; `created` le dice qué carpeta acaba de crearse, para abrirla. Un formulario abierto desde el menú (`entry`) deja su panel abierto y marcado, con su grupo abierto, y las migas dicen «Carpeta / Formulario», mientras se siga en sus pantallas.
