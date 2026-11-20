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
  El límite privado de ProtectedRoute conserva AppLayout; el de la rama de la sesión cubre la carga inicial.
- Todas las ramas cuelgan de una raíz sin path (`SignOutFromOtherTabs`, de `auth`) que escucha el cierre de sesión de
  otra pestaña en cualquier pantalla. No lleva límite de error: el de cada rama se dibuja adentro sin cerrar el canal.
- `HomeLayout` mantiene `AppLayout` entre rutas privadas; no forzar un remount del caparazón al navegar.
- El RouterProvider productivo viene de `react-router/dom`, para confirmar `/login` con `flushSync` antes de liberar la transición del cierre de sesión.

## Referencias

- [Rutas y sesión](../../docs/architecture.md).
- [Menú y jerarquía de rutas](../layouts/navigation.ts).
- [Guard compartido](../auth/ProtectedRoute.tsx).
- [Contrato de mensajes y estados](../../docs/guides/mensajes-y-estados.md).

- `SystemTheme`, bajo QueryClientProvider, aplica la apariencia pública a documentElement.
  Abarca acceso público y portales; no guarda preferencias locales ni depende de una feature.

`routes` compone `FormOverviewShell` alrededor de AppLayout, sin desmontar el caparazón entre rutas. El contexto neutral aporta el conteo global de aprobaciones y, en `documents`, el de «Documentos recibidos» (DOC5-A, los que esperan a alguien del equipo, `ReceivedDocumentsCount`); cada lectura lazy se monta al abrir Gestión de formularios o entrar en el área, la de aprobaciones sólo con Decide y la de documentos sólo con «Ver documentos recibidos». MF1 no monta la navegación dinámica anterior. `ResponseWorkspaceLayout` conserva filtros, navegación y archivos entre las rutas de un formulario. `/formularios/documentos` exige `formdocuments.read` y su hija `:documentId` no dibuja nada: la página queda montada con sus filtros en memoria mientras se abre y se cierra un documento.

MF1 y el espacio por formulario exigen RecordsRead OR ApprovalsDecide OR RecordsCreate con el requisito común del menú. Los valores y el detalle exigen RecordsRead o, sólo lo propio, RecordsCreate (CW6-C): quien sólo decide ve tareas y decisión, sin lecturas de respuestas o workflow. `approval=TaskId` selecciona el pendiente; `:recordId` conserva la selección de planilla. El contexto de navegación es privado del workspace, sin callbacks ni filtros en history.state.

La ruta estática /formularios/faltantes exige formtemplates.manage independientemente de formtemplates.read. El alta /formularios/nuevo conserva Read+Manage; su semilla de nombre no concede permisos ni escribe el pedido.

La ruta /formularios/:formId/respuestas/:recordId/completa exige RecordsRead o RecordsCreate (lo propio) y comparte el workspace del formulario con D2. En celular, la entrada D2 con lectura redirige allí; la decisión sin lectura conserva su marco de metadata. El enlace completo lleva sólo orden, pregunta de orden y versiones públicos; filtros privados y origen permanecen en memoria.

`UserDataSectionShell` aporta la sección lazy de Datos sólo con forms en installedFeatures y UsersManage. El contrato neutral no conserva valores. La carga de la sección tiene su Suspense local, sin desmontar AppLayout. La tabla del módulo abre el editor de usuario por id mediante app. Mientras la persona carga (y mientras llega el editor lazy), el diálogo «Editar usuario» muestra la carga, «No tenés permiso» ante un 403 u otro error con Reintentar, y Cerrar en el pie; al cerrar, el foco vuelve al botón que lo abrió. El `onClosed` de `openUser` se guarda con el editor abierto y se llama una sola vez al cerrarlo (guardado o cancelado), sin nombrar claves del módulo. /datos-de-personas exige FormPersonDataManage; UsersRead se controla sólo para la tabla de personas.

AuthenticatedHome provee `AssistantProposalContext` con la tarjeta de formularios cargada con lazy, sólo con `forms` instalado. `acceptsProposal` sale de un archivo liviano del módulo (`assistantProposalCapabilities`) para no cargarlo antes de que haya una propuesta. La extensión se arma dentro de `FormsProposals`, con `useTranslation("forms")`, porque el namespace del módulo carga perezoso: suma la sugerencia y el texto del editor vacío para quien diseña formularios (IA4), la sugerencia «Armame un catálogo con una planilla» (con `attach`) para quien administra catálogos y el grupo de reemplazo del módulo (el catálogo y la importación se reemplazan entre sí).

`FormMenuShell` (CM1 a CM6) envuelve AppLayout: con `forms` instalado y un permiso que abre formularios o `formtemplates.manage` monta `FormMenuReader` (lazy, con `useFormMenu` del módulo) y aporta al contrato neutral el menú, su carga y su Reintentar, y recuerda el formulario abierto desde el menú hasta que se dejan sus pantallas. A quien administra formularios le suma `act`: cada pedido del menú (crear, crear una subcarpeta, editar, mover, borrar o agregar formularios) abre su diálogo en `FormMenuDialogs`, cargado con lazy la primera vez, con las carpetas del menú (`menuFolders`) y la del pedido tal como está en el menú; si deja el menú con el diálogo abierto, queda la última hasta cerrarlo. Al cerrarse, el foco va adonde dice el menú, que lo lee entonces (`returnFocus`): lo que lo pidió (a ⋮ también, aunque su ítem ya no esté) o, si ya no está en el documento porque su carpeta dejó el menú, el renglón «Nueva carpeta»; y la carpeta creada vuelve en `created` para que el menú la abra. Lo pedido, el formulario abierto y la carpeta creada son del dueño del momento.
