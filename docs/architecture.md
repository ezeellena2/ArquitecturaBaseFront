# ArquitecturaBaseFront: arquitectura y convenciones

Esta es la fuente canónica compartida por cualquier agente. Las rutas de archivo de este documento se expresan desde la raíz del repositorio. Antes de cambiar una pantalla, leé también las [premisas de desarrollo](guides/premisas-de-desarrollo.md) y el [contrato visual](design/visual-baseline.md).

Las premisas fijan las decisiones comunes vigentes de interacción. Si una descripción anterior de una pantalla en esta guía difiere de una premisa actualizada, prevalece la premisa; los contratos funcionales del backend y la accesibilidad conservan su prioridad. Actualizá los resúmenes locales cuando cambie esa decisión.

Para mensajes y estados, la fuente única es el [contrato transversal](guides/mensajes-y-estados.md).
No hay una política distinta por pantalla. Su regla vigente y la adopción pendiente del código se
distinguen en el [plan de unificación](plans/2026-09-30-unificacion-mensajes.md).

SPA de la plantilla base. El backend vive en `../ArquitecturaBase` y el diseño funcional aprobado, en `../ArquitecturaBase/docs/specs/2026-09-18-arquitectura-base-design.md` (sección 7). El contrato visual versionado vive en `docs/design/visual-baseline.md`; es la misma base que deben usar Claude y Codex para continuar pantallas. Los planes por fase, ya históricos, están en `../ArquitecturaBase/docs/history/plans/`; los planes en curso compartidos, en `../ArquitecturaBase/docs/plans/`, y los exclusivos del front, en `docs/plans/`.

## Forma de trabajo

- Se trabaja directo en `main`. No crear ramas ni hacer push sin un pedido explícito.
- Commits chicos, en español, con conventional commits.
- Antes de dar algo por terminado: `npm run build`, `npm run lint` y `npm run test`, los tres limpios.

## Diseño visual

- **Las premisas de desarrollo de todas las pantallas están en [`docs/guides/premisas-de-desarrollo.md`](guides/premisas-de-desarrollo.md).** Se leen antes de tocar una pantalla: definen las piezas comunes, filtros y tablas, checks y formularios, botones, modales, errores y notificaciones. Las notificaciones usan el único `Toaster` global, abajo a la derecha; una feature no crea otro ni cambia su ubicación.
- **Una pantalla nueva se dibuja antes de programarse.** El tablero va en el Artifact [Sistema visual — ArquitecturaBase](https://claude.ai/artifact/HPbmDPLnr8JZ9TxevtTqJJ) —uno por pantalla, siempre en ese Artifact— y muestra la funcionalidad completa: layout, carga, vacío, sin coincidencias, error, sin permiso, el recorrido de diálogos y qué vive en la URL. Se programa después de que el usuario elija. El detalle está en `docs/design/visual-baseline.md`, en “Pantalla nueva: primero el tablero”.
- **El tablero arranca de una plantilla y se arma con la biblioteca [ArquitecturaBase UI](https://claude.ai/artifact/Ew763kqorVHSYeUqE8CZ7h)**, que tiene las piezas de `shared/ui` con los mismos nombres y medidas. No se dibujan botones, campos ni tablas a mano. Un cambio de aspecto va a la biblioteca y a `shared/ui` a la vez. El cómo, en “La biblioteca de piezas” de `visual-baseline.md`.
- Antes de crear o rediseñar una pantalla, leer `docs/design/visual-baseline.md`. El enlace al Artifact de Claude está registrado allí como procedencia; las reglas locales versionadas son la fuente operativa si el enlace cambia o requiere sesión.
- Una decisión visual no queda cerrada hasta expresarse en tokens de `src/index.css`, componentes de `src/shared/ui` y, cuando sea verificable, tests de accesibilidad o comportamiento.
- **Paleta vigente: Jade equilibrado (2026-09-30).** Los tonos se asignan por función en `src/index.css`: navegación, barra superior, encabezado de página y tabla, filtros y controles. Toda pantalla usa los layouts y las piezas compartidas; los filtros se envuelven con `FilterBar` y los selectores nativos usan `NativeSelect`. No agregar paletas por ruta ni valores hex en las features. Los controles y portales heredan el tema global. El mapa y la sincronización pendiente de la biblioteca están en `visual-baseline.md`.
- Las propuestas todavía no elegidas viven fuera del código productivo, en un laboratorio bajo `design-lab/` que no entra al build. **Se borra cuando la decisión se toma**: un laboratorio que sobrevive a su pregunta no se distingue de una propuesta vigente. Las decisiones ya cerradas están en la tabla "Comparaciones cerradas" del fundamento visual.
- La skill `variant` es explícita: usar `/variant` en Claude Code o `$variant` en Codex. Cada ronda compara una sola pieza, tres variantes y un solo eje; el usuario elige la ganadora.

## Comandos

- Desarrollo: `aspire run` desde `../ArquitecturaBase` levanta Postgres, Redis, la Api y este front en `https://localhost:5173`.
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

- **Acceso público (2026-09-30):** `/` ofrece solo crear cuenta e iniciar sesión; con sesión muestra el tablero.
  `HomeLayout` conserva `AppLayout` entre las rutas privadas. La recuperación silenciosa se intenta una
  sola vez por montaje del proveedor; las rutas privadas conservan `ProtectedRoute`. `/registro` prepara
  el mismo OIDC que `/login`, con `screen_hint=signup`, sin salir del SPA.
  `/registro/codigo` comparte verificación, reenvíos y bloqueos con `/login/codigo`. `register` distingue
  intención en el backend; el nombre viaja en el estado de la ruta y se guarda solo al crear la cuenta.
  `registrationOpen` de `/account/login-methods` controla la oferta pública; el servidor vuelve a
  comprobar su política al verificar. El diseño aprobado y su tema claro están en `visual-baseline.md`.

- Las rutas del SPA están **en español** (`/usuarios`, `/login/codigo`, `/sin-permiso`), porque son parte de la interfaz. Viven todas juntas en `src/app/routes.tsx`; `router.tsx` solo las monta.
- Las pantallas de administración son `/usuarios` (`users.read`), `/roles` (`roles.read`), `/roles/nuevo` y `/roles/{id}` (`roles.manage`), y `/configuracion/{idioma,zona-horaria,listados,registro}` (`settings.manage`), con redirección desde `/configuracion` a Idioma. El permiso se pide en `routes.tsx` con `<ProtectedRoute permission="..." />` y se repite en `navigation.ts` para el menú. Son dos lugares a propósito: uno decide si la ruta se abre, el otro si el ítem se ve.
- **Una ruta hija no tiene ítem propio en el menú.** `/roles/nuevo` y `/roles/{id}` cuelgan de “Roles y permisos”: `parentLinkOf` y `branchOf` (`navigation.ts`) las reconocen por prefijo, así el menú despliega su grupo y las migas llegan a cuatro niveles (`Inicio / Gestión de usuarios / Roles y permisos / {hoja}`), con el padre como enlace. `/roles/nuevo` va declarada antes que `/roles/:roleId` solo por legibilidad: react-router rankea las rutas y un segmento estático le gana a uno dinámico en cualquier orden, así que "nuevo" nunca se lee como un id.
- **El ingreso prepara OIDC sin recargar la página.** Si falta un `returnUrl` válido, `createSigninReturnUrl` usa `OidcClient` con la configuración y el almacén de estado del proveedor para generar PKCE y el pedido de `/connect/authorize`. Lo guarda en la query reemplazando la entrada actual. Ese valor se pasa al código y a Google; el servidor lo valida y devuelve al verificar, y recién entonces se completa la navegación OIDC. `authorizeReturnUrl` rechaza destinos distintos. El cierre de sesión usa un POST de formulario a `/connect/logout`, espera la revocación del servidor, cancela consultas, limpia la sesión local y navega a `/login` dentro del SPA. La renovación silenciosa conserva la pantalla ya autenticada; los namespaces se precargan para evitar parpadeos al abrir una sección.
- `/perfil` es la pantalla del perfil propio y se entra desde "Mi perfil", en el menú del usuario. No pide permiso: alcanza con tener sesión, porque cada quien edita el suyo. Son **dos superficies**: "Medios de ingreso" (el correo y el WhatsApp, ver más abajo) y "Datos del perfil" (nombre, idioma y zona horaria). `PUT /api/me` **reemplaza** los tres campos del perfil, así que se mandan siempre los tres, aunque se haya tocado uno solo.
- `/ingresar` es la entrada con el enlace que manda el bot de WhatsApp. Cuelga de `AuthLayout`, como `/login` y `/login/codigo`, y va sin `lazy` por el mismo motivo. El detalle, más abajo.

## Ingreso con WhatsApp

Se puede entrar con un código que llega por WhatsApp, o con un enlace que el bot manda al chat. El plan es `../ArquitecturaBase/docs/history/plans/2026-09-22-ingreso-whatsapp.md` y los tableros son los seis "WhatsApp · …" del Artifact del sistema visual.

- **El servidor dice qué medios ofrecer**, no una constante del front. `getLoginMethods` (`shared/api/loginMethods.ts`, `GET /account/login-methods`) trae `google`, `whatsapp`, `whatsappCountries` y `whatsappNumber`. Vive en `shared` porque lo piden dos features: el ingreso y el perfil, que solo ofrece vincular WhatsApp si está prendido y con esos países. Con WhatsApp apagado el selector de `/login` no aparece y el perfil no ofrece vincular: no hay que esconder nada a mano.
- **`/login` tiene un selector Correo | WhatsApp** debajo de Google y del separador. Arranca en Correo. Cada rama es su propio formulario (`EmailCodeForm` y `WhatsAppCodeForm`), y las dos navegan a `/login/codigo` pasando el canal en el estado de la ruta (`{ channel, email }` o `{ channel, phone, maskedPhone }`, más `resendAfterSeconds`). La pantalla del código no vuelve a preguntar de dónde viene: lee el estado o vuelve a `/login`.
- **El país del número se elige al lado del campo.** `PhoneField` (`shared/ui`) toma la lista de `whatsappCountries` y arranca en el primero; los nombres salen de `shared/lib/countries`. El número se manda como `{ country, number }` y lo interpreta el backend: el front no normaliza números ni depende de una librería de teléfonos.
- **Los errores de un código se deciden por `code` y siguen el contrato común.** `shared/api/codeErrors.ts` comparte sus reglas entre ingreso y perfil: `phoneFieldError` ata al campo los códigos `Users.Phone.Invalid` y `Auth.WhatsApp.CountryNotSupported`, que pueden llegar sin `errors`. El código incorrecto corresponde al grupo de código; agotado o consumido corresponde al estado del flujo; red y rechazo general usan el aviso operativo. `codeRequestErrorMessage` conserva hoy el texto compartido, pero su comentario y algunos consumidores todavía siguen la ubicación anterior: se migran según el plan, no se usa ese patrón como referencia para código nuevo.
- **Hay errores que cortan el intento.** `Auth.Account.NotInvited` y `Auth.Account.Disabled` deshabilitan Verificar y el reenvío y ofrecen volver a `/login`: reintentar con el mismo código solo cambiaría el mensaje a "ya se usó", que es peor explicación que la verdadera.
- **El error de Google cruza el redirect por `sessionStorage`.** Cuando el ingreso con Google falla, el backend manda a `/login?error=<código>` **sin** `returnUrl`, y sin `returnUrl` la pantalla arranca el redirect de OIDC en vez de dibujarse. Por eso `loginRedirectError` (`features/auth/lib`) guarda **solo el código** en `arquitecturabase.login-error`, lo muestra una vez y lo borra. Si alguna vez el backend manda también el `returnUrl`, el front ya soporta las dos formas y esto se puede sacar.
- **`/ingresar` es la entrada con el enlace del chat** (tablero "WhatsApp · El enlace del chat"). Cuelga de `AuthLayout` y va sin `lazy`, como el resto del ingreso. El token viene en el **fragmento** (`/ingresar#t=…`), se lee **en el primer render** y se borra de la barra con `history.replaceState`: en un efecto no sobreviviría al doble montaje de `StrictMode`, porque el segundo montaje ya encontraría la barra limpia. Después vive solo en memoria. La vista previa (`preview`) no gasta el enlace; **Continuar** sí (`redeem`), una sola vez aunque se toque dos, y después viene el `signinRedirect` de siempre. `loginLinkFailureOf` (`features/auth/errors.ts`) decide qué pantalla mostrar: "Este enlace ya no sirve", "No podés entrar" (deshabilitada o bloqueada) o un reintento que respeta `retryAfter`. "Volver a WhatsApp" aparece solo si hay `whatsappNumber`.
- **Una cuenta puede no tener correo.** `/api/me` trae `email` opcional, `phoneNumber`, `formattedPhoneNumber`, `maskedPhoneNumber`, `emailConfirmed`, `phoneNumberConfirmed` y `hasGoogleLogin`. El nombre y la inicial que se muestran en el menú y en la barra lateral los arma `src/auth/accountName.ts` (`displayName ?? email ?? phoneNumber`, y la inicial es la primera letra o cifra, o "?"): no se vuelve a hacer un `initialOf(user.displayName ?? user.email)` suelto, que con `email: null` se cae. El número siempre se muestra **formateado por el backend** (`formattedPhoneNumber`), nunca en E.164.
- **`/perfil` son dos superficies: "Medios de ingreso" y "Datos del perfil".** `LoginMethodsCard` muestra la fila del correo y la de WhatsApp, cada una con su insignia `VerificationBadge` y su acción; si es el único medio, en lugar de **Desvincular** va la ayuda que lo explica (el backend responde `409 Users.User.LastLoginMethod`, y ante ese error se vuelve a pedir `/api/me`). Agregar un correo y vincular un número usan **el mismo** `VerifyDestinationDialog`, con dos configuraciones (`whatsapp` y `email`): el destino primero y el código después, en el mismo diálogo, como el paso 3 del ingreso. El `409` de otra cuenta se muestra con su texto propio, que dice a quién pedirle que libere el dato.
- **El alta de un usuario puede llevar invitación.** `UserFormDialog` (alta) y `UserEditDialog` (edición) están separados a propósito: la edición no crea identidades, muestra los medios de ingreso ya cargados. En el alta, la invitación pide canal (`RadioGroupField`) y consentimiento, y **Por correo** queda deshabilitado si no se cargó un correo. Lo que carga un admin queda **Sin verificar**, y esa insignia tiene su explicación alcanzable por teclado, no solo al pasar el mouse.

### Lo que subió a `shared`

Una feature nunca importa de otra, así que lo que el ingreso y el perfil comparten vive arriba. Al tocar cualquiera de estos, acordate de que hay dos pantallas del otro lado:

| Pieza | Dónde vive | Quiénes la usan |
| --- | --- | --- |
| `PhoneField`, `OtpInput` | `shared/ui` | `/login`, `/login/codigo`, `/perfil`, `/usuarios` |
| `countries` | `shared/lib/countries.ts` | `PhoneField` |
| `codeErrors` | `shared/api/codeErrors.ts` | el ingreso y el perfil |
| `getLoginMethods` | `shared/api/loginMethods.ts` | el ingreso, `/ingresar` y el perfil |

Sus textos viven en `common.json`, no en `auth.json`.

### Piezas nuevas de `shared/ui`

Salieron del ingreso con WhatsApp, pero son del sistema: se usan desde donde haga falta y **su aspecto se cambia también en la biblioteca del Artifact**, nunca solo acá.

- **`Banner`** existe en el código y los tableros anteriores. Sus usos se auditan por significado: una condición duradera se modela junto al dato o como estado del flujo; un resultado, error general, warning o info operativo va al Toaster. No es una alternativa al canal común ni justifica un párrafo de error general en el formulario. Ver el inventario de adopción.
- **`RadioGroupField`**, para elegir una opción entre pocas y mutuamente excluyentes, con su etiqueta, su ayuda y su error, como `FormField`.
- **`VerificationBadge`**, la insignia **Verificado** / **Sin verificar** de un correo o un número. La usan el perfil y el listado de usuarios: es el mismo hecho y tiene que leerse igual en los dos lados.
- **`SegmentedControl` suma `fullWidth`**, que es lo que usa el selector Correo | WhatsApp de `/login`.
- **Tokens nuevos en `src/index.css`:** `--color-success-50` y `--color-success-700` (la insignia "Verificado") y `--color-warning-50` y `--color-warning-700` (el `Banner` de atención). Un color que hace falta se agrega como token, nunca suelto en una pantalla.

## Listados

- **La paginación y los filtros viven en la URL**, no en `useState`: `usePagination` lee y escribe `page`, `pageSize`, `sort` y `search`; `useFilters` (los dos en `shared/hooks`) hace lo mismo con los filtros de cada listado. Así el listado filtrado se puede compartir y el botón atrás funciona.
- **Los dos escriben con `useQueryUpdate`**, que es el único lugar que toca la query string. Ojo con una trampa comprobada: `setParams((previous) => …)` de react-router recibe la query string **confirmada**, no la que dejó pendiente la llamada anterior, así que **dos llamadas en el mismo tick se pisan**. Todo lo que tiene que viajar junto va en una sola llamada —`setFilter` manda el filtro y el reset de página en el mismo objeto—, y hay un test en `useFilters.test.tsx` que se pone en rojo si react-router lo cambia.
- **Un listado filtrable usa `useFilters`**, no estado propio. La pantalla le pasa las claves que acepta el backend (para usuarios, `userFilterKeys` en `features/users/api/users.ts`), y `clear()` saca los filtros y la búsqueda pero **deja el orden**: el orden no cambia qué filas hay, solo en qué orden.
- **Cada opción de un filtro muestra cuántas filas traería**, y ese número lo calcula el backend con los demás filtros puestos e ignorando el propio (`GET /api/users/filter-counts`). La opción que da cero queda deshabilitada: el número ya dice por qué, y dejarla apretable es ofrecer un camino que no lleva a ningún lado. La consulta de conteos cuelga del mismo prefijo que el listado (`usersQueryKeyRoot`), así una mutación invalida las dos.
- **El vacío distingue dos casos:** "todavía no hay nada cargado" no se arregla igual que "ninguno coincide con lo que filtraste". `DataTable` recibe `emptyTitle`, `emptyDescription` y `emptyAction`, y con filtros puestos la acción es limpiarlos.
- Escribe con `replace: true` y omite los valores por defecto, para no llenar el historial ni la URL.
- Cambiar la búsqueda o el orden vuelve a la primera página.
- Los nombres de los parámetros son los que espera el backend (`PagedRequest`), y `sort` usa el mismo formato: `campo` ascendente, `-campo` descendente. Un campo que no esté en la whitelist del backend da 400.

## Mensajes, errores y estados: un contrato para todo el front

El [contrato de mensajes y estados](guides/mensajes-y-estados.md) define significado, ubicación,
duración, cierre, acciones, interpretación de ProblemDetails, dueño del aviso y accesibilidad.
Vale en el acceso público, administración, perfil, listados y diálogos.

- El transporte transforma el error; no notifica. Las reglas de negocio pueden variar por feature;
  la política técnica de red, 5xx, fallback y presentación se comparte.
- Un Toaster en AppProviders recibe resultados operativos abajo a la derecha. Campo inválido,
  decisión y estado de contenido usan sus piezas comunes; no se inventa un canal por pantalla.
- Cada hecho tiene un dueño. El manejador local y QueryCache no notifican la misma causa.
  Conservar datos previos, foco y borrador; una escritura incierta se revisa antes de repetirla.
- Una pantalla se cierra con pruebas del canal y el recorrido, no solo del texto. Las pruebas de
  arquitectura deberán impedir saltear el emisor común y montar otro Toaster.

**Estado real:** el Toaster global ya existe; el emisor común, los límites automáticos y la migración
completa todavía no. El [plan auditado](plans/2026-09-30-unificacion-mensajes.md) fija las etapas y
pruebas pendientes. Las pantallas actuales que se apartan del contrato son deuda inventariada,
no una segunda norma vigente.

## Reglas

- TypeScript estricto: nada de `any` ni de `@ts-ignore`. Los tipos se importan con `import type` (`verbatimModuleSyntax`).
- Todo texto que ve el usuario sale de i18next. Español rioplatense con voseo e inglés, siempre los dos. Un texto nuevo va en el namespace de su módulo (`src/locales/<idioma>/<módulo>.json`, que se pide con `useTranslation("<módulo>")`) y en los dos idiomas; `parity.test.ts` se pone en rojo si una clave está en uno y no en el otro. A `common.json` sube solo lo que usa más de un módulo.
- **El idioma tiene dos niveles.** Sin sesión, `PublicPresentationDefaults` aplica el idioma general salvo que exista una elección explícita del navegador, guardada con `changePublicLanguage` en su clave propia. Con sesión abierta, el cambio pasa por `useLanguagePreference().change` (`src/auth`), que además lo guarda en el perfil con `PUT /api/me` y, si ese guardado falla, devuelve la interfaz al idioma anterior y lo avisa: la interfaz y la cuenta nunca quedan diciendo cosas distintas. **Cuando los dos valores difieren, gana el de la cuenta:** `useProfileLanguageSync`, montado en `AppLayout`, lo aplica apenas llega `/api/me`, así entrar desde otro navegador respeta lo que la persona guardó. `changeLanguage` es la pieza compartida que aplica el idioma; no registra por sí sola una elección pública. El idioma sigue viajando en `Accept-Language`, así que los errores del servidor también vienen traducidos. El `lang` del documento lo sigue mediante `languageChanged`: no se toca a mano.
- Los datos del servidor se piden con TanStack Query; no hay `useEffect` con `fetch`.
- Todas las llamadas al backend pasan por `shared/api/httpClient`, que agrega el token, el idioma y convierte los errores en `ApiError`.
- Los tokens viven en memoria. Nunca en `localStorage` ni en `sessionStorage`.
- Los permisos del front son solo para la experiencia de uso: quien decide es el backend.
- Estilos con Tailwind y los tokens de marca de `index.css`. Los componentes de `shared/ui` no traen colores propios.
- **Un `fieldset` que necesita un rótulo con estilo propio deja el `legend` en `sr-only` y dibuja la banda visible aparte, con `aria-hidden`.** Un `legend` no acepta `display` como cualquier elemento, pero es de donde el `fieldset` saca su nombre accesible: si se lo borra, el grupo se queda sin nombre. En la tabla del selector de permisos (`PermissionPicker`), cada área es un `tbody` con `aria-labelledby` apuntando al nombre de la sección, esté abierta o cerrada; `PermissionPicker.test.tsx` verifica esos grupos de filas accesibles. No usar `fieldset` dentro de una tabla.
- **Los desplegables de Radix se abren con teclado en los tests** (foco en el trigger y `{Enter}`), no con `userEvent.click`: hay una descoordinación conocida con su `pointerdown`. Está documentado en `UserMenu.test.tsx` y se repite en los tests de la barra de filtros.
- **`src/test/setup.ts` tapa lo que jsdom no implementa**, y hay que mirarlo antes de pelearse con un test que falla por el entorno: además de `matchMedia` y `ResizeObserver`, está `Element.prototype.scrollIntoView`, que el `Select` de Radix llama al abrirse para traer a la vista la opción elegida. Sin el stub, todo test que abra un `Select` —el país de `PhoneField`, entre otros— revienta por una razón que no tiene nada que ver con lo que estaba probando.
- Los archivos en minúscula de `shared/ui` los genera la CLI de shadcn (`npx shadcn@4.21.0 add <componente> --yes`) y se editan lo mínimo, porque un `add` los vuelve a escribir. Los nuestros van en PascalCase. Si volvés a generar uno, revisá si traía texto en inglés: `dialog.tsx` es un caso conocido (el "Close" del botón de cerrar y el del lector de pantalla están traducidos a mano, y `dialog.i18n.test.tsx` se pone en rojo si vuelven), y `sonner.tsx`, otro (sonner trae en inglés el nombre de la región de los avisos, "Notifications", y el del botón de cerrar uno, "Close toast"; van traducidos con `containerAriaLabel` y `toastOptions.closeButtonAriaLabel`, y `sonner.i18n.test.tsx` se pone en rojo si vuelven). Revisá también si sigue el tema del sistema, porque la app tiene uno solo, el claro: `sonner.tsx` es el caso conocido (la CLI lo ata a `useTheme` de `next-themes`; el `Toaster` va con `theme="light"` fijo, `next-themes` no es una dependencia aunque un `add sonner` la vuelva a instalar, y `sonner.theme.test.tsx` se pone en rojo si el aviso vuelve a seguir al sistema). Por eso `.oxlintrc.json` apaga `react/only-export-components` solo para los generados: exportan su `cva` al lado del componente y es su forma, no un descuido. En los nuestros la regla sigue activa.
- Para combinar clases hay una sola función, `cn`, que viene del paquete `cn` (de shadcn) y se reexporta desde `shared/lib/utils`. No volver a agregar `clsx` ni `tailwind-merge`.
- Tests con Vitest y Testing Library, consultando por rol y texto accesible, no por clases CSS. Las llamadas HTTP se simulan con MSW.
- Las fechas del backend vienen en UTC y se muestran en la zona horaria del perfil, nunca la cadena cruda. Hay **dos** formateadores y los dos viven en `shared/lib/dateTime`: `formatDateTimeInZone` (con hora, para un detalle) y `formatDateInZone` (sin hora, para una columna de listado, donde la hora no aporta al barrer con la vista y ocupa el doble). No se agrega un tercero ni se formatea a mano en una pantalla: es lo que hace que las mismas fechas se vean distinto en dos lugares.
- **Los tooltips son del front y reciben texto traducido.** `ActionTooltip` es la pieza común para tablas, navegación, flechas, chips y cierres; usa el único `TooltipProvider` de la app. Se abre con hover y foco, se cierra con Escape y ajusta la posición al viewport. `IconButton` lo incorpora por defecto; sus controles deshabilitados conservan una ayuda alcanzable por teclado, con `disabledLabel` cuando hay un motivo concreto. No usar `title` nativo ni tooltips CSS locales para acciones. Los botones con texto visible ya explican su acción y no duplican ese texto en una ayuda.
- **Toda columna de acciones usa `RowActions`** (`shared/ui`): ícono, `ActionTooltip` compartido con portal para evitar recortes por overflow y el nombre accesible con el dato de la fila ("Eliminar a ana@ejemplo.com"). Sin ese dato, veinte filas dan veinte botones llamados igual. El orden lo decide el componente —las inocuas primero y la destructiva última, todas en un grupo— y una acción sin permiso se pasa con `hidden`, no deshabilitada: un botón deshabilitado no recibe foco, así que con teclado no hay forma de llegar a saber por qué está apagado.
- **Toda pantalla se envuelve en `Page`** (`shared/ui`), que dibuja el título, las acciones y el cuerpo con su padding. El encabezado queda adherido en escritorio y se acomoda en filas sin adherirse en móvil; usa el token `page-header` de Jade y no lleva ícono de sección. No recibe descripción: el grupo ya se lee en el menú y en las migas. El padding del cuerpo lo pone `Page` y no cada pantalla. Una pantalla hija pasa `backTo` para volver, y puede pasar `status` para un estado separado del nombre, como “Cambios sin guardar”.
- **`AppLayout` tiene la raíz en `h-svh`, no en `min-h-svh`, y el que scrollea es `<main>`**, no el documento. Es lo que hace que la banda de `Page` quede adherida: con `min-h-svh` la raíz crecía con el contenido, `main` nunca desbordaba y el `sticky` de la banda quedaba pegado a un contenedor que no se movía. Así estuvo desde la Fase 5 hasta el rol en pantalla propia, con la banda "adherida" en los documentos y en ninguna pantalla. `main` además es `relative`: un `sr-only` es `absolute` y, sin un ancestro posicionado, estira el documento y vuelve a scrollear la página entera. Y lleva `scroll-pt-14`, el alto de la banda: sin eso, el navegador da por visible un control que la banda adherida tapa entero, y con Shift+Tab el foco quedaba detrás de ella sin que `main` se moviera (WCAG 2.4.11). Al imprimir, la raíz y `main` vuelven a crecer con el contenido (`print:h-auto`, `print:overflow-visible`): con el alto de una pantalla, de un listado largo salía solo la primera hoja. **jsdom no maqueta**, así que ningún test lo detecta: un cambio en el caparazón se mira en un navegador.
- **Las fechas de un listado usan `formatDateInZone`** (sin hora) y las de un detalle, `formatDateTimeInZone`. Los dos viven en `shared/lib/dateTime` y son los únicos: un formateador suelto en una pantalla es lo que hace que las mismas fechas se vean distinto en dos lugares.
- **Un formulario corto va en un diálogo; uno largo o seccionado tiene ruta propia.** El alta de un usuario y la edición de sus roles van en un `Dialog` sobre el listado; el alta y la edición de un rol, que con veinte áreas de permisos no tendrían dónde crecer en un diálogo, en su pantalla (`/roles/nuevo` y `/roles/{id}`, `RoleEditorPage`). Lo que no se puede deshacer va siempre en `ConfirmDialog` diciendo qué se pierde.
- **Una pantalla de formulario propia se arma con tres piezas:** `backTo` en `Page`, para volver a la sección; `useUnsavedChangesGuard` (`shared/hooks`), que con cambios frena la salida por un enlace, las migas, el menú o el Atrás del navegador y la pantalla pregunta con su `ConfirmDialog` (recargar o cerrar la pestaña lo pregunta el navegador); y `useBreadcrumbLeaf` (`shared/hooks`), que pone el último nivel de las migas, porque solo la pantalla sabe cómo se llama lo que está editando. Ojo con una trampa comprobada: el `reset()` de `useBlocker` pisa el `"proceeding"`, y `ConfirmDialog` llama a `onConfirm` y a `onOpenChange(false)` en el mismo clic; por eso `stay()` no hace nada después de un `leave()`, y sin eso "Descartar" con el Atrás del navegador vuelve a abrir el diálogo. Mientras se guarda, la guarda se apaga (`isDirty && !mutation.isPending`: lo cambiado ya salió), y la vuelta al listado va en el `onSuccess` de `mutate(...)` y no en el de `useMutation`, para no traer de vuelta a quien se fue mientras guardaba.
- Una pantalla monta su diálogo solo mientras está abierto, así los campos arrancan con los valores correctos sin resetearlos a mano. Todos pasan `onCloseAutoFocus={useRestoreFocusOnClose()}` (`shared/hooks`): Radix solo le devuelve el foco a un `DialogTrigger` propio, y los nuestros los abre un `Button` cualquiera, así que sin eso el foco cae en `<body>` al cerrar.
- **Los errores del backend se deciden por el `code`, nunca por el texto.** Cada feature tiene su `errors.ts` con un `switch` sobre `ApiError.code`, que traduce los códigos que merecen un texto propio (los que explican cómo destrabar la situación, como `Users.LastAdmin`) y deja pasar el `detail` del servidor para el resto. `Roles.Role.HasUsers` es la excepción a propósito: el `detail` del backend es genérico, pero el ProblemDetails trae `userCount` como extensión (se lee con `ApiError.problem`), y el texto con el número se arma en el front, que es quien sabe pluralizar en el idioma de la interfaz. Una clave con `{{count}}` necesita sus formas `_one` y `_other`: sin ellas i18next cae a la base y escribe "1 usuarios".
- Los resultados de mutaciones, errores generales, warning e info usan el único Toaster abajo
  a la derecha, también cuando nacen en un formulario. Solo los errores de campo van junto al
  control. El borrador y el diálogo de edición se conservan ante un fallo. No duplicar en Banner
  ni encima de la botonera; seguir [el contrato común de mensajes](guides/mensajes-y-estados.md).
- Lo que consume más de una feature sube a `shared/api`: el catálogo de roles (`shared/api/roles.ts`) lo usan la pantalla de roles y el diálogo que asigna roles a un usuario.
- Las mutaciones son `useMutation` e invalidan lo que corresponde: el listado por su prefijo (`usersQueryKeyRoot`), el detalle por su clave, y `currentUserQueryKey` cuando el cambio puede haber tocado los permisos de quien está usando la pantalla.

## Rendimiento

- Las páginas de cada módulo se cargan con `lazy()` desde el router: cada ruta es su propio trozo del bundle. Excepción: las pantallas de ingreso van estáticas, porque son lo primero que ve alguien sin sesión y un trozo aparte agrega una vuelta de red antes de mostrar nada.
- Una ruta `lazy` no pinta nada hasta que su import se resuelve, y eso nunca es sincrónico. Un test que consulta apenas termina el `render()` va a ver la pantalla vacía: usá `findBy*` o `waitFor`, no saques el `lazy`.
- No se definen componentes adentro de otros componentes: se remonta todo el subárbol en cada render.
- El estado derivado se calcula durante el render, no con un `useEffect` que copia datos a otro estado.
- En condicionales de JSX se usa ternario, no `&&`, para no renderizar un `0` o un `""` sin querer.
- En `localStorage` va lo mínimo y con clave propia (`arquitecturabase.*`). Nunca tokens ni datos del usuario.


## Configuración general (2026-09-30)

Configuración es un grupo del menú de Administración con cuatro destinos, cada uno con su Page,
un solo ajuste, borrador local y guardado explícito. Settings exige settings.manage en ruta y menú.
Registro usa RadioGroupField y ConfirmDialog; idioma, zona y tamaño usan NativeSelect/FormField.
Los valores y la revisión se leen de /api/settings. El PATCH manda solo el campo activo y expectedRevision.
Una revisión obsoleta y una escritura incierta obligan a consultar el estado actual y comparar antes
de volver a guardar. La validación visible queda en el campo; los resultados usan notifications.ts.
Una carga fallida tiene una superficie de recuperación y un único aviso del QueryCache.

shared/api/presentation.ts consume la proyección pública /api/settings/presentation para todas las
áreas. Usuarios y roles esperan esa lectura si su URL omite tamaño; usePagination fija pageSize en
URL al abrir el listado y lo conserva ante cambios generales. Pagination ofrece 10/20/50/100 y
vuelve a página 1 al cambiar tamaño; el catálogo de roles para selectores conserva /api/roles completo.

AuthLayout monta PublicPresentationDefaults. Una elección pública explícita usa su propia clave
arquitecturabase.public-language; la preferencia de una cuenta anterior no decide el idioma público.
La cuenta vuelve a tener prioridad al sincronizar el perfil. Configurar la instalación no modifica
el idioma o la zona de la sesión actual. El formateador de fechas compartido conserva su responsabilidad.

El emisor común, el clasificador de errores y la fábrica de QueryClient están implementados. App y
arnés de pruebas comparten callbacks; errorOwner local evita duplicación durante una recuperación.
Persisten consumidores heredados con Sonner directo y meta.silent: su migración sigue el plan transversal.
