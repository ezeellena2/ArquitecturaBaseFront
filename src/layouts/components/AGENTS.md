# Layouts/components: menú lateral, barra, migas y menú de usuario

`Sidebar` dibuja el modelo de `../navigation.ts` (Inicio y los paneles Administración, WhatsApp y Formularios) como barra, barra contraída o cajón; `Topbar` aloja migas, menú de usuario y el botón del cajón; `Breadcrumbs` y `UserMenu` completan la barra. Rutas, permisos y paneles se declaran en `navigation.ts`, no en estos componentes.

## Al modificar

- **Un panel abierto.** `openPanel` sigue a la sección: entrar o recargar en una ruta de un panel lo abre y salir lo cierra; adentro se abre y cierra a mano. En escritorio el panel va al costado, expandido aunque la barra esté contraída, y oculta la flecha de contraer. En el teléfono no hay panel: cada uno es un grupo más del cajón con los mismos controles.
- **Permisos sin saltos.** Un destino se ve con su permiso (el mismo de `routes.tsx`) y un grupo o panel, si se ve algún hijo. Mientras los permisos no llegan, lo que depende de uno reserva su lugar con `Skeleton` (un grupo, sólo si todos sus hijos dependen); un error de carga muestra el aviso y Reintentar en lugar de achicar el menú en silencio.
- **Contraída** (sólo escritorio, recordada en `arquitecturabase.sidebar`): los grupos se aplanan en íconos con tooltip y los paneles siguen siendo botones. El grupo activo se despliega calculado en el render; el plegado manual no se recuerda.
- **Formularios.** Su panel combina los destinos fijos con `FormsResponseNavigationContext`, que aporta app: «Por aprobar» sale de la lista fija y lo dibuja `ApprovalLink` sólo con `canApprove` (cantidad, carga y reintento); las respuestas, sólo con `canRead`, con «Ver todos» si hay más páginas o ninguna. `setActive` avisa cuándo el panel está a la vista para que app lea a demanda. La línea sobre Formularios o WhatsApp se dibuja sólo si su sección tiene algo visible.
- **Cajón** (menos de 768 px): se cierra al navegar y con Escape; el ☰ de `Topbar` existe sólo en el teléfono, con nombre fijo y `aria-expanded`.
- **Migas.** Inicio, el grupo como texto (no enlace) y la pantalla. Una ruta hija enlaza a la pantalla de la que cuelga y termina en la hoja que fija la pantalla con `useBreadcrumbLeaf`; hasta entonces el enlace queda último sin `aria-current`. La barra final no cambia la pantalla y una ruta del menú ignora una hoja que haya quedado.
- **Menú de usuario.** Nombre, correo o número formateado (`accountName`); el idioma se aplica y se guarda en el perfil, y vuelve atrás si falla. El cierre de sesión sigue la regla del caparazón ([guía padre](../AGENTS.md)).

## Referencias

- [Navegación aprobada](../../../docs/design/visual-baseline.md#navegación) y [rutas y menú](../../../docs/architecture.md#rutas-y-sesión).
- Tests: `Sidebar.test.tsx`, `Breadcrumbs.test.tsx`, `Topbar.test.tsx`, `UserMenu.test.tsx`; geometría en `src/test/visual` (`design.spec`, `session.spec`).
