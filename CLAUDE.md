# ArquitecturaBaseFront: guía para agentes

SPA de la plantilla base. El backend vive en `../ArquitecturaBase` y el diseño aprobado, en `../ArquitecturaBase/docs/specs/2026-09-18-arquitectura-base-design.md` (sección 7). Los planes por fase están en `../ArquitecturaBase/docs/plans/`.

## Forma de trabajo

- Se trabaja directo en `main`. No crear ramas ni hacer push sin un pedido explícito.
- Commits chicos, en español, con conventional commits.
- Antes de dar algo por terminado: `npm run build`, `npm run lint` y `npm run test`, los tres limpios.

## Comandos

- Desarrollo: `aspire run` desde `../ArquitecturaBase` levanta Postgres, la Api y este front en `https://localhost:5173`.
- Solo el front: `npm run dev`. Necesita la Api levantada aparte, y queda en `http://localhost:5173`: el certificado se lo pasa Aspire, así que por http el ingreso real no anda (las redirect URIs registradas son `https`). Sirve para trabajar en una pantalla suelta.
- Tests: `npm run test`; en modo watch, `npm run test:watch`.

## Estructura

- `src/app`: composición (router y providers).
- `src/auth`: sesión OIDC, rutas protegidas y permisos.
- `src/shared`: lo que usa todo el proyecto (cliente HTTP, hooks, i18n, componentes de `ui`).
- `src/layouts`: AuthLayout, AppLayout y el menú.
- `src/features/<módulo>`: páginas, componentes y llamadas al backend de cada módulo.
- `src/locales/<idioma>/<módulo>.json`: traducciones, un namespace por módulo.

Una feature nunca importa de otra feature: lo común sube a `shared`.

## Rutas y sesión

- Las rutas del SPA están **en español** (`/usuarios`, `/login/codigo`, `/sin-permiso`), porque son parte de la interfaz. Viven todas juntas en `src/app/routes.tsx`; `router.tsx` solo las monta.
- Las pantallas de administración son `/usuarios` (`users.read`), `/roles` (`roles.read`) y `/configuracion` (`settings.manage`). El permiso se pide en `routes.tsx` con `<ProtectedRoute permission="..." />` y se repite en `navigation.ts` para el menú. Son dos lugares a propósito: uno decide si la ruta se abre, el otro si el ítem se ve.
- **El ingreso arranca siempre en `/login`, y el `returnUrl` lo manda el servidor.** Si se entra a `/login` sin `returnUrl` en la query, la pantalla no muestra nada: dispara el redirect de OIDC y el backend vuelve a mandar a `/login`, esta vez con el `returnUrl` que hay que devolver al terminar. Ese valor se pasa tal cual a `/login/codigo` y al botón de Google, y al verificar el código se navega al `returnUrl` que responde el backend. No se inventa ni se reescribe del lado del front. Un `returnUrl` que no sea un pedido de `/connect/authorize` (una URL tipeada, un favorito viejo) no lo va a aceptar el backend: `authorizeReturnUrl` (`features/auth/lib`) lo trata como si no estuviera, y se vuelve a `/login` sin query para que el ingreso arranque de nuevo.
- `/perfil` es la pantalla del perfil propio (nombre, idioma y zona horaria) y se entra desde "Mi perfil", en el menú del usuario. No pide permiso: alcanza con tener sesión, porque cada quien edita el suyo. `PUT /api/me` **reemplaza** los tres campos, así que se mandan siempre los tres, aunque se haya tocado uno solo.

## Listados

- **La paginación vive en la URL**, no en `useState`: `usePagination` (`shared/hooks`) lee y escribe `page`, `pageSize`, `sort` y `search` en la query string. Así el listado se puede compartir y el botón atrás funciona.
- Escribe con `replace: true` y omite los valores por defecto, para no llenar el historial ni la URL.
- Cambiar la búsqueda o el orden vuelve a la primera página.
- Los nombres de los parámetros son los que espera el backend (`PagedRequest`), y `sort` usa el mismo formato: `campo` ascendente, `-campo` descendente. Un campo que no esté en la whitelist del backend da 400.

## Reglas

- TypeScript estricto: nada de `any` ni de `@ts-ignore`. Los tipos se importan con `import type` (`verbatimModuleSyntax`).
- Todo texto que ve el usuario sale de i18next. Español rioplatense con voseo e inglés, siempre los dos. Un texto nuevo va en el namespace de su módulo (`src/locales/<idioma>/<módulo>.json`, que se pide con `useTranslation("<módulo>")`) y en los dos idiomas; `parity.test.ts` se pone en rojo si una clave está en uno y no en el otro. A `common.json` sube solo lo que usa más de un módulo.
- **El idioma tiene dos niveles.** `changeLanguage` (`shared/i18n`) lo cambia en la interfaz y lo recuerda en `localStorage`: es lo único que puede hacer la pantalla de ingreso, donde todavía no hay cuenta a la que guardárselo. Con sesión abierta, el cambio pasa por `useLanguagePreference().change` (`src/auth`), que además lo guarda en el perfil con `PUT /api/me` y, si ese guardado falla, devuelve la interfaz al idioma anterior y lo avisa: la interfaz y la cuenta nunca quedan diciendo cosas distintas. **Cuando los dos valores difieren, gana el de la cuenta:** `useProfileLanguageSync`, montado en `AppLayout`, lo aplica apenas llega `/api/me`, así entrar desde otro navegador respeta lo que la persona guardó. El idioma sigue viajando en `Accept-Language`, así que los errores del servidor también vienen traducidos.
- Los datos del servidor se piden con TanStack Query; no hay `useEffect` con `fetch`.
- Todas las llamadas al backend pasan por `shared/api/httpClient`, que agrega el token, el idioma y convierte los errores en `ApiError`.
- Los tokens viven en memoria. Nunca en `localStorage` ni en `sessionStorage`.
- Los permisos del front son solo para la experiencia de uso: quien decide es el backend.
- Estilos con Tailwind y los tokens de marca de `index.css`. Los componentes de `shared/ui` no traen colores propios.
- Los archivos en minúscula de `shared/ui` los genera la CLI de shadcn (`npx shadcn@4.21.0 add <componente> --yes`) y se editan lo mínimo, porque un `add` los vuelve a escribir. Los nuestros van en PascalCase. Si volvés a generar uno, revisá si traía texto en inglés: `dialog.tsx` es el caso conocido (el "Close" del botón de cerrar y el del lector de pantalla están traducidos a mano, y `dialog.i18n.test.tsx` se pone en rojo si vuelven). Por eso `.oxlintrc.json` apaga `react/only-export-components` solo para los generados: exportan su `cva` al lado del componente y es su forma, no un descuido. En los nuestros la regla sigue activa.
- Para combinar clases hay una sola función, `cn`, que viene del paquete `cn` (de shadcn) y se reexporta desde `shared/lib/utils`. No volver a agregar `clsx` ni `tailwind-merge`.
- Tests con Vitest y Testing Library, consultando por rol y texto accesible, no por clases CSS. Las llamadas HTTP se simulan con MSW.
- Las fechas del backend vienen en UTC y se muestran con `formatDateTimeInZone` (`shared/lib/dateTime`), en la zona horaria del perfil. Es el único formateador de fecha y hora del front: si aparece un segundo, las mismas fechas se ven distinto en dos pantallas.
- **Las acciones se resuelven en diálogos, no en pantallas de detalle.** El alta y la edición van en un `Dialog` sobre el listado, y lo que no se puede deshacer, en `ConfirmDialog` diciendo qué se pierde. La pantalla monta el diálogo solo mientras está abierto, así los campos arrancan con los valores correctos sin resetearlos a mano.
- **Los errores del backend se deciden por el `code`, nunca por el texto.** Cada feature tiene su `errors.ts` con un `switch` sobre `ApiError.code`, que traduce los códigos que merecen un texto propio (los que explican cómo destrabar la situación, como `Users.LastAdmin`) y deja pasar el `detail` del servidor para el resto. `Roles.Role.HasUsers` quiso ser la excepción —el backend manda `userCount` como extensión del ProblemDetails, que el front puede leer con `ApiError.problem`— pero **hoy no está enganchado**: no hay caso para ese código, así que se muestra el `detail` genérico, sin el número. Ver el pendiente 3 del resultado de la Fase 4.
- Un error de una mutación que nace en un `ConfirmDialog` va a un aviso (`toast`), no a un cartel adentro del diálogo: el diálogo se cierra al confirmar, así que cuando llega la respuesta ya no está. Los de un formulario sí van adentro, en un `<p role="alert">`, y el diálogo queda abierto.
- Lo que consume más de una feature sube a `shared/api`: el catálogo de roles (`shared/api/roles.ts`) lo usan la pantalla de roles y el diálogo que asigna roles a un usuario.
- Las mutaciones son `useMutation` e invalidan lo que corresponde: el listado por su prefijo (`usersQueryKeyRoot`), el detalle por su clave, y `currentUserQueryKey` cuando el cambio puede haber tocado los permisos de quien está usando la pantalla.

## Rendimiento

- Las páginas de cada módulo se cargan con `lazy()` desde el router: cada ruta es su propio trozo del bundle. Excepción: las pantallas de ingreso van estáticas, porque son lo primero que ve alguien sin sesión y un trozo aparte agrega una vuelta de red antes de mostrar nada.
- Una ruta `lazy` no pinta nada hasta que su import se resuelve, y eso nunca es sincrónico. Un test que consulta apenas termina el `render()` va a ver la pantalla vacía: usá `findBy*` o `waitFor`, no saques el `lazy`.
- No se definen componentes adentro de otros componentes: se remonta todo el subárbol en cada render.
- El estado derivado se calcula durante el render, no con un `useEffect` que copia datos a otro estado.
- En condicionales de JSX se usa ternario, no `&&`, para no renderizar un `0` o un `""` sin querer.
- En `localStorage` va lo mínimo y con clave propia (`arquitecturabase.*`). Nunca tokens ni datos del usuario.
