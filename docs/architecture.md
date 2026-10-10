# ArquitecturaBaseFront: arquitectura y convenciones

Places agrega búsqueda efímera mediante el cliente HTTP común, fuera de QueryCache/MutationCache
para cumplir condiciones del proveedor; clave sólo en servidor y PlaceId persistido con datos
manuales. [Operación](../../ArquitecturaBase/docs/guides/configurar-google-places.md).

Información del negocio vive en artificial-intelligence, /configuracion/negocio, con
ai.business.read y ai.business.manage, independiente de la conexión y WhatsApp. Contrato
implementado en [Inteligencia artificial](../../ArquitecturaBase/docs/features/inteligencia-artificial.md#información-del-negocio--2026-10-03).

Esta es la fuente canónica compartida por cualquier agente. Las rutas de archivo de este documento se expresan desde la raíz del repositorio. Antes de cambiar una pantalla, leé también las [premisas de desarrollo](guides/premisas-de-desarrollo.md) y el [contrato visual](design/visual-baseline.md).

Las premisas fijan las decisiones comunes vigentes de interacción. Si una descripción anterior de una pantalla en esta guía difiere de una premisa actualizada, prevalece la premisa; los contratos funcionales del backend y la accesibilidad conservan su prioridad. Actualizá los resúmenes locales cuando cambie esa decisión.

Para mensajes y estados, la fuente única es el [contrato transversal](guides/mensajes-y-estados.md).
No hay una política distinta por pantalla. Su regla vigente y la adopción pendiente del código se
distinguen en el [plan de unificación](plans/2026-09-30-unificacion-mensajes.md).

SPA de la plantilla base. El backend vive en `../ArquitecturaBase`; sus [features](../../ArquitecturaBase/docs/features/)
fijan contratos funcionales y el diseño inicial conserva valor de referencia. El contrato visual
versionado está en [visual-baseline.md](design/visual-baseline.md). Las [premisas compartidas](../../ArquitecturaBase/docs/architecture/premisas-de-la-plantilla.md)
enlazan decisiones implementadas y el [índice de pendientes](../../ArquitecturaBase/docs/plans/README.md)
ubica propuestas y adopción parcial. Los planes cumplidos se retiraron con [procedencia en Git](../../ArquitecturaBase/docs/history/README.md)
siguiendo la [auditoría documental](../../ArquitecturaBase/docs/guides/auditar-documentacion.md).

## Forma de trabajo

Cada cambio sigue la [rutina compartida de revisión y validación](../../ArquitecturaBase/docs/guides/validar-un-cambio.md).
Se parte de las piezas existentes, se justifica cualquier responsabilidad o dependencia nueva y
se revisa el diff contra el pedido y los contratos. La entrega distingue pruebas automáticas,
revisión y pendientes. Los hallazgos se registran sin relajar reglas ni silenciar avisos del arnés.

El despliegue Azure dev conserva un solo origen: el workflow del backend verifica ambos repositorios, copia todo `dist/` a `wwwroot/` y publica React con la API en una imagen. El workflow del front solicita esa ejecución cuando cambia `main`; su resultado exitoso confirma la solicitud, no la publicación. Variables, token entre repositorios y validación externa pendiente están en la [guía compartida Azure dev](../../ArquitecturaBase/docs/deploy/azure-dev.md).

- Se trabaja directo en `main`. No crear ramas ni hacer push sin un pedido explícito.
- Commits chicos, en español, con conventional commits.
- Antes de dar algo por terminado: `npm run build`, `npm run lint` y `npm run test`, los tres limpios.

## Diseño visual

El usuario confirmó el 2026-10-01 que el diseño actual se conserva y que los refinamientos
deben mantener sus formas en todas las áreas. Una referencia de Multitenant no reemplaza
Public Sans, la densidad ni la navegación. El 2026-10-02 eligió los colores Campo, conservando
el diseño de los componentes. Cada formulario, filtro, tabla, ícono,
modal, campo, desplegable y tooltip compone `shared/ui`, según el estándar enlazado abajo.

El [estándar aplicado](guides/estandar-visual.md) lleva el diseño aprobado a composiciones y variantes
de biblioteca. `Surface` define las cajas; `TableHead` y `TableRow` definen tipografía y densidad;
los filtros usan sus controles comunes. `npm run lint` incluye los límites de arquitectura visual;
`npm run test:visual` prueba capturas, medidas y teclado. El catálogo vive en una entrada de pruebas,
fuera del build y las rutas productivas.

- **Las premisas de desarrollo de todas las pantallas están en [`docs/guides/premisas-de-desarrollo.md`](guides/premisas-de-desarrollo.md).** Se leen antes de tocar una pantalla: definen las piezas comunes, filtros y tablas, checks y formularios, botones, modales, errores y notificaciones. Las notificaciones usan el único `Toaster` global, abajo a la derecha; una feature no crea otro ni cambia su ubicación.
- **Una pantalla nueva se dibuja antes de programarse.** El tablero va en el Artifact [Sistema visual — ArquitecturaBase](https://claude.ai/artifact/HPbmDPLnr8JZ9TxevtTqJJ) —uno por pantalla, siempre en ese Artifact— y muestra la funcionalidad completa: layout, carga, vacío, sin coincidencias, error, sin permiso, el recorrido de diálogos y qué vive en la URL. Se programa después de que el usuario elija. El detalle está en `docs/design/visual-baseline.md`, en “Pantalla nueva: primero el tablero”.
- **El tablero arranca de una plantilla y se arma con la biblioteca [ArquitecturaBase UI](https://claude.ai/artifact/Ew763kqorVHSYeUqE8CZ7h)**, que tiene las piezas de `shared/ui` con los mismos nombres y medidas. No se dibujan botones, campos ni tablas a mano. Un cambio de aspecto va a la biblioteca y a `shared/ui` a la vez. El cómo, en “La biblioteca de piezas” de `visual-baseline.md`.
- Antes de crear o rediseñar una pantalla, leer `docs/design/visual-baseline.md`. El enlace al Artifact de Claude está registrado allí como procedencia; las reglas locales versionadas son la fuente operativa si el enlace cambia o requiere sesión.
- Una decisión visual no queda cerrada hasta expresarse en tokens de `src/index.css`, componentes de `src/shared/ui` y, cuando sea verificable, tests de accesibilidad o comportamiento.
- **Paleta vigente: Campo (2026-10-02), solo colores.** Los tonos se asignan por función en `src/index.css`: navegación, barra superior, encabezado de página y tabla, filtros y controles. Toda pantalla usa los layouts y las piezas compartidas; los filtros se envuelven con `FilterBar` y los selectores nativos usan `NativeSelect`. No agregar paletas por ruta ni valores hex en las features. Los controles y portales heredan el tema global. El mapa y la sincronización pendiente de la biblioteca están en `visual-baseline.md`.
- Las propuestas todavía no elegidas viven fuera del código productivo, en un laboratorio bajo `design-lab/` que no entra al build. **Se borra cuando la decisión se toma**: un laboratorio que sobrevive a su pregunta no se distingue de una propuesta vigente. Las decisiones ya cerradas están en la tabla "Comparaciones cerradas" del fundamento visual.
- La skill `variant` es explícita: usar `/variant` en Claude Code o `$variant` en Codex. Cada ronda compara una sola pieza, tres variantes y un solo eje; el usuario elige la ganadora.

## Comandos

- Desarrollo: `aspire run` desde `../ArquitecturaBase` levanta Postgres, Redis, la Api y este front en `https://localhost:5173`.
- Solo el front: `npm run dev`. Necesita la Api levantada aparte, y queda en `http://localhost:5173`: el certificado se lo pasa Aspire, así que por http el ingreso real no anda (las redirect URIs registradas son `https`). Sirve para trabajar en una pantalla suelta.
- Tests: `npm run test`; en modo watch, `npm run test:watch`.

## Estructura

La feature `artificial-intelligence` aporta `/configuracion/ia` con `ai.read`, edición/prueba
con `ai.manage` adicional y navegación Administración → Configuración. No importa settings
ni WhatsApp. Consulta metadatos por TanStack Query; operaciones con claves se ejecutan desde
el editor sin variables en MutationCache ni reintentos automáticos. Comprobantes y revisión
resuelven guardados inciertos; un 404 no demuestra rollback. El [contrato funcional](../../ArquitecturaBase/docs/features/inteligencia-artificial.md)
y sus instrucciones locales fijan limpieza de secretos, cooldown y prueba por borrador.

- `src/app`: composición (router y providers).
- `src/auth`: sesión OIDC, rutas protegidas y permisos.
- `src/shared`: lo que usa todo el proyecto (cliente HTTP, hooks, i18n, componentes de `ui`).
- `src/layouts`: AuthLayout, AppLayout y el menú.
- `src/features/<módulo>`: páginas, componentes y llamadas al backend de cada módulo.
- `src/locales/<idioma>/<módulo>.json`: traducciones, un namespace por módulo.

Una feature nunca importa de otra feature: lo común sube a `shared`, que tampoco depende de
features. `featureDependencies.test.ts`, ejecutado por `npm run lint` y `npm run test`, inspecciona
imports de valores y tipos, reexports e imports dinámicos literales por alias o ruta relativa,
con casos positivos y negativos. `ForbiddenPage` vive en `shared/ui`: la ruta `/sin-permiso`
y las áreas que reciben un 403 consumen la misma presentación. `features/errors` conserva la
página de ruta inexistente.

## Rutas y sesión

El Inicio autenticado se compone en `src/app/AuthenticatedHome.tsx`: obtiene la presentación
pública y el perfil mediante los providers comunes; carga `AiAssistantPage` sólo cuando
`installedFeatures` contiene `assistant` y la cuenta tiene `ai.assistant.use`. La ausencia
conserva `DashboardPage`; un fallo de lectura ofrece Reintentar. `home` no importa IA.
La URL conserva únicamente `conversacion` y el paginado del historial; ningún texto entra en URL/storage.

`@assistant-ui/react` 0.15.23 vive detrás de `shared/ui/assistant` (hilo, mensaje y compositor)
y del adaptador `ExternalStoreRuntime` de la feature. Sólo recibe turnos confirmados por
servidor; PostgreSQL conserva operación/resultado. TanStack Query lee y consulta etapas por
GET; ninguna recarga, cambio de idioma o refetch invoca generación. El borrador y cuerpo/UUID
congelados viven en el editor, fuera de MutationCache. Ante aceptación incierta, recuperar
por UUID precede a repetir explícitamente el mismo cuerpo; un 404 no acredita rollback.

La composición visual sigue las capturas originales de assistant-ui elegidas, como fija el
fundamento visual. Page viewport permite ocupar el área restante sin alterar otras pantallas.
ComposerPrimitive.Input tiene nombre accesible, ayuda oculta y error asociado; los tokens del
chat viven en index.css. No reemplazarlo por una tarjeta de formulario.

Cancelar/eliminar son peticiones durables; desmontar aborta lecturas, no cancela al proveedor.
Las respuestas tardías se ignoran por generación de sesión y se retiran los caches privados.
Los destinos de evidencia se resuelven mediante lista lógica y permisos actuales; nunca URLs
elegidas por el modelo. Fuentes tipadas, fechas UTC y zona del perfil usan los formatters comunes.
El [contrato backend](../../ArquitecturaBase/docs/features/inteligencia-artificial.md) define
propiedad, publicación, revisión, cuotas, retención y recuperación; la UI no los reemplaza.

RouteErrorPage es el límite estático traducido para fallos de import/render de las rutas.
Recargar es una acción explícita que inicia un documento nuevo; no se repiten escrituras.
ProtectedRoute conserva el caparazón ante un fallo de una hoja privada y el límite raíz cubre
la carga inicial. Un error de carga no se interpreta como falta de permiso o datos vacíos.

- **Acceso público (landing aprobada el 2026-10-02):** `/` muestra marca genérica, introducción y tres capacidades,
  con Iniciar sesión como acción principal y Crear una cuenta solo si el servidor permite el registro.
  `PublicLanding` compone la portada; los colores claros se derivan del tema global. Con sesión muestra el tablero.
  `HomeLayout` conserva `AppLayout` entre las rutas privadas. La recuperación silenciosa se intenta una
  sola vez por montaje del proveedor; las rutas privadas conservan `ProtectedRoute`. `/registro` prepara
  el mismo OIDC que `/login`, con `screen_hint=signup`, sin salir del SPA.
  `/registro/codigo` comparte verificación, reenvíos y bloqueos con `/login/codigo`. `register` distingue
  intención en el backend; el nombre viaja en el estado de la ruta y se guarda solo al crear la cuenta.
  `registrationOpen` de `/account/login-methods` controla la oferta pública; el servidor vuelve a
  comprobar su política al verificar. El diseño aprobado y su tema claro están en `visual-baseline.md`.

- Las rutas del SPA están **en español** (`/usuarios`, `/login/codigo`, `/sin-permiso`), porque son parte de la interfaz. Viven todas juntas en `src/app/routes.tsx`; `router.tsx` solo las monta.
- Las pantallas de administración son `/usuarios` (`users.read`), `/roles` (`roles.read`), `/roles/nuevo` y `/roles/{id}` (`roles.manage`), y `/configuracion` y `/configuracion/apariencia` (`settings.manage`). Las cuatro URLs anteriores de ajustes redirigen a Configuración. El permiso se pide en `routes.tsx` con `<ProtectedRoute permission="..." />` y se repite en `navigation.ts` para el menú. Son dos lugares a propósito: uno decide si la ruta se abre, el otro si el ítem se ve.
- **Una ruta hija no tiene ítem propio en el menú.** `/roles/nuevo` y `/roles/{id}` cuelgan de “Roles y permisos”: `parentLinkOf` y `branchOf` (`navigation.ts`) las reconocen por prefijo, así el menú despliega su grupo y las migas llegan a cuatro niveles (`Inicio / Gestión de usuarios / Roles y permisos / {hoja}`), con el padre como enlace. `/roles/nuevo` va declarada antes que `/roles/:roleId` solo por legibilidad: react-router rankea las rutas y un segmento estático le gana a uno dinámico en cualquier orden, así que "nuevo" nunca se lee como un id.
- **El ingreso prepara OIDC sin recargar la página.** Si falta un `returnUrl` válido, `createSigninReturnUrl` usa `OidcClient` con la configuración y el almacén de estado del proveedor para generar PKCE y el pedido de `/connect/authorize`. Lo guarda en la query reemplazando la entrada actual. Ese valor se pasa al código y a Google; el servidor lo valida y devuelve al verificar, y recién entonces se completa la navegación OIDC. `authorizeReturnUrl` rechaza destinos distintos. El cierre de sesión usa un POST de formulario a `/connect/logout`, espera la revocación del servidor, cancela consultas, limpia la sesión local y navega a `/login` dentro del SPA. La renovación silenciosa conserva la pantalla ya autenticada; los namespaces se precargan para evitar parpadeos al abrir una sección.
- `/perfil` es la pantalla del perfil propio y se entra desde "Mi perfil", en el menú del usuario. No pide permiso: alcanza con tener sesión, porque cada quien edita el suyo. Son **dos superficies**: "Medios de ingreso" (el correo y el WhatsApp, ver más abajo) y "Datos del perfil" (nombre, idioma y zona horaria). `PUT /api/me` **reemplaza** los tres campos del perfil, así que se mandan siempre los tres, aunque se haya tocado uno solo.
- `/ingresar` conserva el canje de enlaces históricos pendientes. Cuelga de `AuthLayout`, como `/login` y `/login/codigo`, y va sin `lazy` por el mismo motivo. El canal WhatsApp actual usa códigos solicitados desde la web; el detalle, más abajo.

El cierre voluntario de sesión conserva la transición de `AppLayout` desde `HomeLayout`, incluso
después de quitar el usuario OIDC. `UserMenu` confirma `/login` con `flushSync` antes de liberar
esa transición; `RouterProvider` viene de `react-router/dom` para aplicarlo. Así los guards no
guardan la ruta privada de la cuenta anterior como destino del siguiente ingreso, que empieza
en Inicio. Una visita anónima a una ruta privada conserva su `returnTo`. La regresión de
Playwright (`session.spec.ts`) ejerce logout, código, PKCE, callback y permisos con providers
y rutas reales y respuestas HTTP ficticias, desde Inicio, Usuarios y Configuración.

## Ingreso con WhatsApp

Se ingresa con un código solicitado desde la web, recibido por WhatsApp y verificado allí, independientemente del modo Manual del chat. Las invitaciones conservan WANT_TO_ENTER y orientan a `/login`; los enlaces históricos pendientes siguen disponibles en `/ingresar`. El bot que los emitía fue retirado.
El contrato vigente está en [WhatsApp](../../ArquitecturaBase/docs/features/whatsapp.md) y los
tableros y su adopción, en el fundamento visual. El módulo sigue siendo opcional en el backend.

- **El servidor dice qué medios ofrecer**, no una constante del front. `getLoginMethods` (`shared/api/loginMethods.ts`, `GET /account/login-methods`) trae `google`, `whatsapp`, `whatsappCountries` y `whatsappNumber`. Vive en `shared` porque lo piden dos features: el ingreso y el perfil, que solo ofrece vincular WhatsApp si está prendido y con esos países. Con WhatsApp apagado el selector de `/login` no aparece y el perfil no ofrece vincular: no hay que esconder nada a mano.
- **`/login` tiene un selector Correo | WhatsApp** debajo de Google y del separador. Arranca en Correo. Cada rama es su propio formulario (`EmailCodeForm` y `WhatsAppCodeForm`), y las dos navegan a `/login/codigo` pasando el canal en el estado de la ruta (`{ channel, email }` o `{ channel, phone, maskedPhone }`, más `resendAfterSeconds`). La pantalla del código no vuelve a preguntar de dónde viene: lee el estado o vuelve a `/login`.
- **El país del número se elige al lado del campo.** `PhoneField` (`shared/ui`) toma la lista de `whatsappCountries` y arranca en el primero; los nombres salen de `shared/lib/countries`. El número se manda como `{ country, number }` y lo interpreta el backend: el front no normaliza números ni depende de una librería de teléfonos.
- **Los errores de un código se deciden por `code` y siguen el contrato común.** `shared/api/codeErrors.ts` comparte sus reglas entre ingreso y perfil: `phoneFieldError` ata al campo los códigos `Users.Phone.Invalid` y `Auth.WhatsApp.CountryNotSupported`, que pueden llegar sin `errors`. El código incorrecto corresponde al grupo de código; agotado o consumido corresponde al estado del flujo; red y rechazo general usan el aviso operativo. `codeRequestErrorMessage` conserva hoy el texto compartido, pero su comentario y algunos consumidores todavía siguen la ubicación anterior: se migran según el plan, no se usa ese patrón como referencia para código nuevo.
- **Hay errores que cortan el intento.** `Auth.Account.NotInvited` y `Auth.Account.Disabled` deshabilitan Verificar y el reenvío y ofrecen volver a `/login`: reintentar con el mismo código solo cambiaría el mensaje a "ya se usó", que es peor explicación que la verdadera.
- **El error de Google conserva la intención y el pedido OIDC.** `ExternalLoginController.Callback` devuelve a `/login` o `/registro` con `error` y el `returnUrl` válido cuando recibió `register` explícito. Solo el contrato antiguo, que omite `register`, vuelve sin `returnUrl`. `LoginPage` prepara el pedido faltante con `createSigninReturnUrl` dentro del SPA, sin una navegación completa. `loginRedirectError` conserva compatibilidad guardando únicamente el código en `arquitecturabase.login-error`; el aviso usa primero la query, se borra del almacenamiento cuando el pedido está listo y se descarta al volver a enviar. No guardar tokens ni datos de la cuenta en ese almacenamiento.
- **`/ingresar` canjea enlaces históricos** (tablero original "WhatsApp · El enlace del chat"). Cuelga de `AuthLayout` y va sin `lazy`, como el resto del ingreso. El token viene en el **fragmento** (`/ingresar#t=…`), se lee **en el primer render** y se borra de la barra con `history.replaceState`: en un efecto no sobreviviría al doble montaje de `StrictMode`, porque el segundo montaje ya encontraría la barra limpia. Después vive solo en memoria. La vista previa (`preview`) no gasta el enlace; **Continuar** sí (`redeem`), una sola vez aunque se toque dos, y después viene el `signinRedirect` de siempre. `loginLinkFailureOf` (`features/auth/errors.ts`) decide qué pantalla mostrar: "Este enlace ya no sirve", "No podés entrar" (deshabilitada o bloqueada) o un reintento que respeta `retryAfter`. "Volver a WhatsApp" aparece solo si hay `whatsappNumber`. El procesamiento entrante ya no emite esos enlaces.
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
- **`SegmentedControl` ofrece `fullWidth` para la variante compacta y `appearance="public"` para acceso.** `/login` usa la segunda, subrayada y con blanco táctil desde 44 px; la administración usa la compacta.
- **Tokens nuevos en `src/index.css`:** `--color-success-50` y `--color-success-700` (la insignia "Verificado") y `--color-warning-50` y `--color-warning-700` (el `Banner` de atención). Un color que hace falta se agrega como token, nunca suelto en una pantalla.

## Listados

- **La paginación y los filtros viven en la URL**, no en `useState`: `usePagination` lee y escribe `page`, `pageSize`, `sort` y `search`; `useFilters` (los dos en `shared/hooks`) hace lo mismo con los filtros de cada listado. Así el listado filtrado se puede compartir y el botón atrás funciona.
- **Los dos escriben con `useQueryUpdate`**, que es el único lugar que toca la query string. Ojo con una trampa comprobada: `setParams((previous) => …)` de react-router recibe la query string **confirmada**, no la que dejó pendiente la llamada anterior, así que **dos llamadas en el mismo tick se pisan**. Todo lo que tiene que viajar junto va en una sola llamada —`setFilter` manda el filtro y el reset de página en el mismo objeto—, y hay un test en `useFilters.test.tsx` que se pone en rojo si react-router lo cambia.
- **Un listado filtrable usa `useFilters`**, no estado propio. La pantalla le pasa las claves que acepta el backend (para usuarios, `userFilterKeys` en `features/users/api/users.ts`), y `clear()` saca los filtros y la búsqueda pero **deja el orden**: el orden no cambia qué filas hay, solo en qué orden.
- **Cada opción de un filtro muestra cuántas filas traería**, y ese número lo calcula el backend con los demás filtros puestos e ignorando el propio (`GET /api/users/filter-counts`). La opción que da cero queda deshabilitada: el número ya dice por qué, y dejarla apretable es ofrecer un camino que no lleva a ningún lado. La consulta de conteos cuelga del mismo prefijo que el listado (`usersQueryKeyRoot`), así una mutación invalida las dos.
- **El vacío distingue dos casos:** "todavía no hay nada cargado" no se arregla igual que "ninguno coincide con lo que filtraste". `DataTable` recibe `emptyTitle`, `emptyDescription` y `emptyAction`, y con filtros puestos la acción es limpiarlos.
- Escribe con `replace: true`; omite página 1 y filtros ausentes. **El tamaño se fija explícitamente** en `pageSize` al resolver la configuración general, aunque coincida con el valor inicial: así un listado abierto no cambia de tamaño cuando cambia la instalación.
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
  arquitectura impiden saltear el emisor común y montar otro Toaster.

**Estado real:** el Toaster global, el emisor común, la fábrica de QueryClient y el control de montaje
único existen. Los consumidores operativos usan el emisor y los imports se verifican mediante AST. La cobertura específica de recuperación queda inventariada en el plan.
El [plan auditado](plans/2026-09-30-unificacion-mensajes.md) fija las etapas y
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
- Las fechas del backend vienen en UTC y se muestran en la zona horaria del perfil, nunca la cadena cruda. `shared/lib/dateTime` concentra `formatDateTimeInZone` para detalles, `formatDateInZone` para columnas y separadores de día, y `formatTimeInZone` para la hora de un mensaje. `calendarDateInZone` obtiene la identidad estable del día local para agrupar instantes, independiente del idioma. No se agregan formateadores locales por pantalla; las pruebas comunes verifican zona y agrupación.
- **Los tooltips son del front y reciben texto traducido.** `ActionTooltip` es la pieza común para tablas, navegación, flechas, chips y cierres; usa el único `TooltipProvider` de la app. Se abre con hover y foco, se cierra con Escape y ajusta la posición al viewport. `IconButton` lo incorpora por defecto; sus controles deshabilitados conservan una ayuda alcanzable por teclado, con `disabledLabel` cuando hay un motivo concreto. No usar `title` nativo ni tooltips CSS locales para acciones. Los botones con texto visible ya explican su acción y no duplican ese texto en una ayuda.
- **Toda columna de acciones usa `RowActions`** (`shared/ui`): ícono, `ActionTooltip` compartido con portal para evitar recortes por overflow y el nombre accesible con el dato de la fila ("Eliminar a ana@ejemplo.com"). Sin ese dato, veinte filas dan veinte botones llamados igual. El orden lo decide el componente —las inocuas primero y la destructiva última, todas en un grupo— y una acción sin permiso se pasa con `hidden`, no deshabilitada: un botón deshabilitado no recibe foco, así que con teclado no hay forma de llegar a saber por qué está apagado.
- **Las pantallas dentro de `AppLayout` usan `Page`** (`shared/ui`), que dibuja título, acciones y cuerpo con su padding. Acceso y estados de navegación conservan su composición propia. El encabezado queda adherido en escritorio y se acomoda en filas sin adherirse en móvil; usa `page-header` de la paleta global y no lleva ícono de sección. No recibe descripción: el grupo ya se lee en menú y migas. Una pantalla hija pasa `backTo` para volver y puede pasar `status` para un estado separado del nombre, como “Cambios sin guardar”.
- **`AppLayout` tiene la raíz en `h-svh`, no en `min-h-svh`, y el que scrollea es `<main>`**, no el documento. Es lo que hace que la banda de `Page` quede adherida: con `min-h-svh` la raíz crecía con el contenido, `main` nunca desbordaba y el `sticky` de la banda quedaba pegado a un contenedor que no se movía. Así estuvo desde la Fase 5 hasta el rol en pantalla propia, con la banda "adherida" en los documentos y en ninguna pantalla. `main` además es `relative`: un `sr-only` es `absolute` y, sin un ancestro posicionado, estira el documento y vuelve a scrollear la página entera. Y lleva `scroll-pt-14`, un margen de scroll de 56 px que supera los 48 px mínimos de la banda: sin eso, el navegador da por visible un control que la banda adherida tapa entero, y con Shift+Tab el foco quedaba detrás de ella sin que `main` se moviera (WCAG 2.4.11). Al imprimir, la raíz y `main` vuelven a crecer con el contenido (`print:h-auto`, `print:overflow-visible`): con el alto de una pantalla, de un listado largo salía solo la primera hoja. **jsdom no maqueta**, así que ningún test lo detecta: un cambio en el caparazón se mira en un navegador.
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
- Formularios manuales conserva su cuerpo privado/UUID en el editor, fuera de MutationCache, como los otros editores privados. `business-forms/api` usa el transporte común y valida las seis respuestas del [borrador durable](../../ArquitecturaBase/docs/features/formularios.md); `hooks` coordina comandos sin retries automáticos, lecturas en QueryCache por actor/permisos/cultura y limpieza al perder el contexto. La recuperación usa UUID propio, snapshot/mapa originales y exige revisión si currentRevision es mayor; relectura no sobrescribe el borrador. Router, menú y pantallas /formularios implementan los tableros elegidos A–E: listado con facetas del servidor, alta, editor en memoria y preview orientativa. La revisión compara textos por idioma y estructura por identidad, exige una decisión por diferencia y nunca guarda automáticamente ni revive identidades retiradas. El [contrato D5 confirmado](../../ArquitecturaBase/docs/reviews/2026-10-10-formularios-d5-contrato.md) usa name, label, help, opciones y botón como mapas es/en: original obligatorio, secundario pendiente permitido, ayuda ausente null. El selector de contenido es independiente de la UI y nunca sustituye el texto faltante al editar o guardar; sólo la preview marca una referencia al original. Sus controles de plataforma se traducen al idioma del contenido. Listado, búsqueda y orden usan el nombre de la cultura de la UI, con respaldo al original si está vacío. Prefijo, tipos, obligatoriedad, identidades y orden son compartidos; el prefijo se edita desde el original y respeta el bloqueo confirmado. Errores operativos tienen un dueño en el Toaster común; la validación selecciona el idioma y enfoca el campo. Las pruebas MSW y de navegador acreditan este consumidor; el recorrido SPA/API/DB real se comprueba aparte. Publicación, chat y respuestas quedan fuera de este incremento. La preparación previa es evidencia histórica.

## Rendimiento

- Las páginas de cada módulo se cargan con `lazy()` desde el router: cada ruta es su propio trozo del bundle. Excepción: las pantallas de ingreso van estáticas, porque son lo primero que ve alguien sin sesión y un trozo aparte agrega una vuelta de red antes de mostrar nada.
- Una ruta `lazy` no pinta nada hasta que su import se resuelve, y eso nunca es sincrónico. Un test que consulta apenas termina el `render()` va a ver la pantalla vacía: usá `findBy*` o `waitFor`, no saques el `lazy`.
- No se definen componentes adentro de otros componentes: se remonta todo el subárbol en cada render.
- El estado derivado se calcula durante el render, no con un `useEffect` que copia datos a otro estado.
- En condicionales de JSX se usa ternario, no `&&`, para no renderizar un `0` o un `""` sin querer.
- En `localStorage` va lo mínimo y con clave propia (`arquitecturabase.*`). Nunca tokens ni datos del usuario.


## Configuración general (2026-09-30)

Por elección del usuario del 2026-10-01, Configuración es un único destino `/configuracion`
con tres superficies: preferencias regionales, listados y registro, una Page y Guardar/Descartar
comunes. Las cuatro URLs anteriores redirigen acá. Settings exige settings.manage en ruta y menú.
`SettingsForm` compone los campos en Surface y `SettingsReview` la comparación de los cuatro
ajustes; la página coordina el borrador y sus estados. Filtros y tablas conservan sus contenedores; las tablas alternan blanco y
el tono alternado desde la biblioteca común. Configuración agrupa General y Apariencia.
`/configuracion/apariencia` edita la paleta global de cuatro colores con vista previa local
en `AppearancePreview`, restauración de los colores iniciales Campo y guardado conjunto con revisión.
`AppProviders` monta `SystemTheme` una vez; la proyección pública aplica variables a la
raíz para todas las pantallas y portales. `shared/lib/appearance` valida el formato y deriva
texto/foco/hover legibles sin modificar los colores semánticos. No se persiste en localStorage.
Registro usa RadioGroupField y ConfirmDialog; idioma, zona y tamaño usan NativeSelect/FormField.
Los valores y la revisión se leen de /api/settings. El PATCH manda los campos cambiados y expectedRevision
en un pedido; el backend valida todo antes de modificar y confirma una transacción y una revisión.
Registro pide confirmación solo cuando cambió, antes de guardar el conjunto. Una revisión aceptada
incorpora los cambios ajenos en campos no editados, conservando las ediciones explícitas.
Una revisión obsoleta y una escritura incierta obligan a consultar el estado actual y comparar antes
de volver a guardar. La validación visible queda en el campo; los resultados usan notifications.ts.
Una carga fallida tiene una superficie de recuperación y un único aviso del QueryCache.

Al entrar a Configuración, el editor espera la lectura exitosa del montaje actual para iniciar
valores y revisión, aunque haya datos en caché. Las consultas posteriores conservan el borrador
y su revisión de partida; un refetch fallido no desmonta el editor ni borra lo escrito.

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
Sonner directo sólo existe en los dos adaptadores; meta.silent queda en consultas auditadas con interpretación local o fallback funcional. El plan conserva la revisión específica de cada recuperación.

El chat separa consultas/lectura (`useChatThread`), acciones/confirmaciones (`useChatThreadActions`)
y scroll/paginación (`useChatHistoryViewport`). `lib/timeline` adapta mensajes y operaciones,
ordenados por instante e identidad, sin reemplazar el estado del servidor. `ChatTimeline` compone
MessageHistory, MessageBubble y MessageDateDivider; esas piezas no importan la feature ni
conocen HTTP. Tokens/íconos/formato de fechas son comunes. La geometría, estados y recuperación
se comprueban en la ruta real y el catálogo; no se importa ni se conserva el laboratorio promovido.

## Acceso y atención de WhatsApp — 2026-10-02

El chat conserva MessageBubble y ChatTimeline de la maqueta aprobada. `lib/timeline` adapta
propósito/evento del servidor y `lib/messagePresentation` localiza resumen y preview seguros.
Access lleva etiqueta, fecha y estado real, sin renderizar su cuerpo ni ofrecerlo como borrador.
Sin metadata se conserva Unclassified; ningún texto clasifica autenticación. Bot significa
«Automatización sin configurar» y solo ofrece tomar Manual con la revisión actual; Manual
no ofrece activar el bot retirado. Lecturas, paginado, borradores e incertidumbre mantienen
sus hooks y contratos. [Regla backend](../../ArquitecturaBase/docs/features/whatsapp.md#propósito-migración-y-recorridos--2026-10-02).

Si se pierde la respuesta de un envío, `ChatComposer` consulta su `requestId` antes de
repetirlo. La consulta se puede iniciar desde el editor o desde la notificación; ambas
acciones leen el estado actual de la operación y evitan consultas simultáneas, aunque
la notificación conserve el callback de un render anterior.

El panel interno de Inicio elegido el 2026-10-05 usa AssistantWorkspace/AssistantConversationList compartidos y AssistantConversationPanel de IA. RuntimeProvider mantiene una sola instancia al aceptar/cambiar y adapta el listado confirmado; la API experimental de threadList 0.15.23 queda aislada allí. La feature coordina decisiones y paginado, sin importación del laboratorio. Inicio `/` queda vacío y la URL sólo restaura un historial elegido. Títulos autorizados provienen de la API; agrupación por fecha usa la zona del perfil. Plegar/abrir/paginar no llama al modelo.
