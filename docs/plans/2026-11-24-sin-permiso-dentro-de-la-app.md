# Sin permiso dentro de la app: la pantalla con su nombre y el vacío estándar (SP1-B y SP2)

Fecha: **2026-11-24**. Estado: **decidido y programado el 2026-11-24 (SP1-B)**, en una copia fuera del front. Sólo cambia
el front: ni contratos ni servidor. Faltan la corrida completa del cierre y la prueba a mano; después el plan se retira con
la auditoría documental.

## Por qué

Durante la prueba integral del 24/11, con la Hotmail (rol Agrónomo, sin `ai.business.read`), entrar a
`/configuracion/negocio` llevó a `/sin-permiso`: dos renglones sueltos arriba a la izquierda, sin barra ni menú, sin
estilos y sin un camino para volver.

Lo que hay en el código:

- `ForbiddenPage` es un `div` con un `h1` y un `p` sin clases, y la ruta `/sin-permiso` se carga fuera del caparazón
  (`src/app/routes.tsx`). Llevan ahí `ProtectedRoute` y siete archivos de IA, Información del negocio y ARCA cuando
  reciben un 403, al leer o al guardar.
- 20 pantallas devuelven la pieza en lugar de su `Page`: el texto queda pegado bajo las migas, sin banda ni margen.
- Tres lugares lo muestran adentro de otra cosa: el filtro de opciones de Respuestas (`ResponseFacetControl`, con la
  pieza entera), la vista rápida de una respuesta (`FormResponseDetailPage`, igual) y el diálogo «Editar usuario» que se
  abre desde otra pantalla (`PendingUserDialog` en `UserDataSectionShell`, con un renglón suelto).
- La 404 tiene el mismo problema: fuera del caparazón y con el título sin estilo.

Tableros: lienzo aparte [Sin permiso](https://claude.ai/artifact/VroT1cg61eWVYYTpGViWth), con «SP · Hoy» (capturas
reales), SP1-A, SP1-B, SP2 y SP3 (las dos opciones renderizadas en la app, en español e inglés, a 1440, 390 y 320 px).

## Lo que se decidió

- **SP1-B.** Descartó SP1-A (la ruta adentro del caparazón, con «No tenés permiso» en la banda).
  - La pantalla queda adentro del caparazón y con su dirección: la ruta protegida y las pantallas que reciben un 403
    muestran la pieza en su lugar. La ruta `/sin-permiso` se va.
  - La banda (`Page`) lleva el nombre de la pantalla que se quiso abrir. Si ese nombre es un dato que no se puede leer
    (un formulario, un catálogo, un rol), va el de su sección en el menú.
  - Adentro, el vacío estándar (`EmptyState`) con «No tenés permiso» y una sola acción, «Volver al inicio», con borde,
    como el error de Inicio. En Inicio va sin botón: ya está ahí.
  - Se va el renglón «No tenés el permiso necesario para ver esta pantalla»: repetía el título.
- **SP2.** Lo que se abrió adentro de una pantalla (un panel, un filtro o un diálogo) contesta en su lugar con el vacío
  embebido «No tenés permiso», sin botón: se cierra como siempre. La vista rápida conserva «Detalle», ↑ ↓ y ×.
- **La regla para toda la app.**
  - Una pantalla que no se puede ver: SP1-B.
  - Un panel, un filtro o un diálogo abierto: el vacío embebido.
  - Una zona a la vista con su propio permiso: se retira y el resto queda, como en Documentos.
  - Lo que se ve pero no se cambia: sin íconos ni botones, como Información del negocio en sólo lectura (IN3).
- **La 404** entra a la misma rama. Con sesión se ve adentro del caparazón, con la forma del error de una ruta: «No
  encontramos esta página» en la banda y «Volver al inicio» centrado. No tiene nombre de pantalla para la banda, y el
  vacío repetiría el título. Sin sesión, la misma pantalla sin el caparazón, como hoy.

## Qué tiene que quedar

Igual a [SP1-B](https://claude.ai/artifact/VroT1cg61eWVYYTpGViWth#artboard-SP1-B) (la compu, 390 y 320 px) y a las
propuestas de [SP2](https://claude.ai/artifact/VroT1cg61eWVYYTpGViWth#artboard-SP2), con los textos en inglés de
[SP3](https://claude.ai/artifact/VroT1cg61eWVYYTpGViWth#artboard-SP3). Al programar se abre cada tablero y se compara
elemento por elemento
([revisión del cambio](../../../ArquitecturaBase/docs/guides/validar-un-cambio.md#antes-de-cerrar-lo-que-más-se-repite-en-las-revisiones)).

## Tareas

1. **`ForbiddenPage`** (`src/shared/ui/ForbiddenPage.tsx`). Primero el test.
   - Recibe `title`, el nombre de la pantalla, y dibuja `Page` con ese título y, adentro, `EmptyState` con
     `errors.forbidden.title` y la acción.
   - La acción es `Button` `outline` `asChild` con `Link` a `/`. En `/` no va.
2. **`ProtectedRoute`** (`src/auth/ProtectedRoute.tsx`).
   - Sin el permiso, devuelve `ForbiddenPage` en lugar de `<Navigate to="/sin-permiso">`, con el nombre de la entrada
     del menú de la ruta (`navigationLinks`) o, si no tiene, el de su padre (`parentLinkOf`).
   - El error al leer los permisos (el `EmptyState` con «Reintentar» de hoy) va adentro del mismo `Page`.
   - Un test recorre las rutas con permiso y comprueba que todas tengan nombre.
   - Se borran la ruta `/sin-permiso` de `routes.tsx` y los comentarios que la nombran (`SignOutFromOtherTabs`).
3. **Las pantallas que navegan a `/sin-permiso`** con un 403: `ArcaSettingsPage`, `useArcaAction`, `AiSettingsPage`,
   `useAiConnectionEditor`, `BusinessInformationPage`, `useBusinessInformationEditor` y `BusinessPlaceSearch`.
   - La pantalla guarda el 403 en su estado y devuelve `ForbiddenPage` con su título.
   - Los hooks avisan con un callback en lugar de navegar; como ya no se navega, el 403 no necesita
     `guard.allowNextNavigation()`.
4. **Las 20 pantallas que devuelven la pieza** le pasan su título: `AiAssistantPage` (Inicio, sin botón),
   `CatalogEditorPage`, `CatalogFiltersEditorPage`, `CatalogsPage`, `DocumentFormProposalPage`, `FormEditorPage`,
   `FormEntryPage`, `FormLibraryPage`, `FormOverviewPage`, `FormPdfDesignPage`, `FormResponseFullPage`,
   `FormResponsesPage`, `FormResponseWorkspacePage`, `FormsPage`, `MissingFormsPage`, `PersonDataPage`,
   `ReceivedDocumentsPage`, `RoleEditorPage`, `RolesPage` y `UsersPage`. Las que se titulan con un dato usan el nombre de
   su sección en el menú, el mismo que queda último en las migas.
5. **SP2.** `ResponseFacetControl`, `FormResponseDetailPage` y `PendingUserDialog` devuelven `EmptyState embedded` con
   `errors.forbidden.title`, sin acción.
6. **La 404.** La ruta `*` pasa adentro de la rama de `HomeLayout`. `NotFoundPage` es `Page` con «No encontramos esta
   página» y «Volver al inicio» centrado, como `RouteErrorPage`.
7. **Una regla de arquitectura** en `src/test/architecture`: `ForbiddenPage` sólo la importan las pantallas (`pages/`) y
   `ProtectedRoute`.
8. **Textos es/en** (`common.json`).
   - «Volver al inicio» pasa de `errors.notFound.home` a `actions.backHome` (en inglés «Back to home»), compartido por
     la 404 y la falta de permiso.
   - Se borra `errors.forbidden.description`.
9. **Tests.**
   - `ForbiddenPage.test.tsx`, nuevo, y el de `NotFoundPage`: la banda, el vacío y el enlace.
   - Los que esperan `/sin-permiso` pasan a mirar la dirección de la pantalla y su vacío: `ProtectedRoute.test.tsx`,
     `signOutChannel.test.tsx`, `CatalogsPage.test.tsx`, `FormResponseFullPage.test.tsx`, `RoleEditorPage.test.tsx`,
     `AppearancePage.test.tsx`, `AssistantAgentPage.test.tsx` y `WhatsAppChatPage.test.tsx`.
   - El 403 del filtro, de la vista rápida y del diálogo.
   - Una escena visual nueva: una ruta protegida sin el permiso, una pantalla del menú con un 403, el filtro, la vista
     rápida y la 404, a 1440, 390 y 320 px, en español e inglés, miradas una por una. `whatsapp-flow.spec.ts`, sin
     `/sin-permiso`.
10. **Documentación.**
    - [El fundamento visual](../design/visual-baseline.md#la-falta-de-permiso--2026-11-24): la sección pasa a programada.
    - [Mensajes y estados](../guides/mensajes-y-estados.md) y las guías de `shared/ui` y `auth` que nombren
      `/sin-permiso` o `ForbiddenPage`.
    - El recorrido R9 de los [recorridos de punta a punta](../../../ArquitecturaBase/docs/plans/2026-11-17-recorridos-de-punta-a-punta.md):
      sin el permiso, la pantalla con «No tenés permiso» en su dirección.
    - Al cerrar, las fuentes de las [premisas](../../../ArquitecturaBase/docs/architecture/premisas-de-la-plantilla.md);
      el plan se retira con la auditoría documental.

## Coordinación

- **La app levantada.** Mientras el usuario prueba con Vite en vivo, no se edita el front: se programa después o en una
  copia fuera de la carpeta del front.
- **La URL.** Queda la de la pantalla que se quiso abrir; `/sin-permiso` deja de existir. Nada más vive en la URL.

## Verificación

- **Por tarea:** `npm run build`, `npm run lint` (oxlint y las reglas de arquitectura), los tests del área y la escena
  visual nueva.
- **Al cerrar:** la corrida completa
  ([validar un cambio](../../../ArquitecturaBase/docs/guides/validar-un-cambio.md#verificación-y-cierre)).
- **La prueba a mano:** en el panel del navegador de Claude, con la Hotmail (Agrónomo; el usuario ingresa una vez):
  `/configuracion/negocio`, una dirección de Catálogos escrita a mano, una 404, y lo mismo a 390 px.

## Cómo quedó (2026-11-24)

Igual a SP1-B, SP2 y SP3, con estas diferencias:

- **Trece archivos navegaban a `/sin-permiso`, no siete.** Se sumaron Configuración general, Apariencia, Configuración ›
  Formularios y › WhatsApp, y el agente del asistente (la pantalla y su editor).
- **Un 403 al guardar o probar algo no avisa con un callback: vuelve a leer lo que está a la vista**
  (`useRereadAfterForbidden`, en `src/auth`).
  - `useArcaAction` lo usan diez zonas y diálogos de ARCA: pasarles un callback a todos era invasivo.
  - Así, quien perdió sólo «Administrar» queda en sólo lectura y no pierde la pantalla; sin «Ver», la lectura de la
    pantalla recibe el 403 y muestra la pieza en su lugar.
  - En el agente del asistente, «Probar» ya releía los permisos: sin «Configurar el asistente», `ProtectedRoute` muestra
    la falta de permiso.
- **`ForbiddenPage` recibe `backTo`** en las pantallas hijas: el rol, la respuesta completa y «Armar formulario con la IA».
  La respuesta completa ya no envuelve la pieza en otra `Page`.
- **El nombre de la banda en `ProtectedRoute`** sale de `screenLinkOf` (`layouts/navigation.ts`). También toma una entrada
  exacta del menú, para las direcciones viejas que redirigen (`/configuracion/idioma` lleva a General).
- **Con un 403 en la vista rápida, la planilla entera pasa a la falta de permiso**, como ya pasaba; ahora la banda dice
  «Formularios», el nombre de su sección.
- **La escena visual** (`forbidden.spec.ts`) cubre la pantalla sin permiso (Información del negocio, escenario
  `business-denied`) y la 404. El filtro, la vista rápida y el diálogo con 403 quedan en sus tests y en las capturas de SP2.
- **Pruebas** (en la copia, sobre `05a042e2`): tipos y oxlint; los 42 archivos de tests de lo que cambió (1.091 tests) y los
  57 de arquitectura, con la regla nueva; las ocho capturas nuevas de `forbidden.spec.ts`, miradas una por una, y las
  escenas que ya pasaban por la falta de permiso (Información del negocio, el chat de WhatsApp y la respuesta revocada).
  El test de Configuración que simulaba «permiso revocado» con un 403 sin quitar el permiso pasó a quitarlo de verdad.
  Falta la corrida completa del cierre.
