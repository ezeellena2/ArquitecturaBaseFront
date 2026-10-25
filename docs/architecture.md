# ArquitecturaBaseFront: arquitectura y convenciones

Fuente canónica para cualquier agente; rutas desde la raíz del repo. No repite las [premisas](guides/premisas-de-desarrollo.md),
el [estándar](guides/estandar-visual.md), el [fundamento visual](design/visual-baseline.md) ni el
[contrato de mensajes](guides/mensajes-y-estados.md) ([plan](plans/2026-09-30-unificacion-mensajes.md)): leelos antes de
tocar una pantalla. Una premisa prevalece sobre esta guía; los contratos del backend y la accesibilidad, sobre ambas.

El backend vive en `../ArquitecturaBase`; sus [features](../../ArquitecturaBase/docs/features/) fijan los contratos.
Decisiones: [premisas compartidas](../../ArquitecturaBase/docs/architecture/premisas-de-la-plantilla.md); propuestas:
[pendientes](../../ArquitecturaBase/docs/plans/README.md); planes retirados: [historia](../../ArquitecturaBase/docs/history/README.md)
y [auditoría](../../ArquitecturaBase/docs/guides/auditar-documentacion.md).

## Forma de trabajo

- Cada cambio sigue la [rutina de revisión y validación](../../ArquitecturaBase/docs/guides/validar-un-cambio.md): partir de
  piezas existentes, justificar lo nuevo, revisar el diff y separar pruebas, revisión y pendientes, sin relajar reglas
  ni silenciar el arnés.
- Directo en `main`, sin ramas ni push sin pedido. Commits chicos, en español, conventional commits.
- Para terminar: `npm run build`, `npm run lint` y `npm run test` limpios (cadencia por corte en `AGENTS.md`).
- Azure dev usa un solo origen: el workflow del backend verifica ambos repos, copia `dist/` a `wwwroot/` y publica React
  con la API en una imagen. El del front pide esa ejecución al cambiar `main`; su éxito confirma el pedido, no la
  publicación. [Guía](../../ArquitecturaBase/docs/deploy/azure-dev.md).

## Diseño visual

- **Pantalla nueva: primero el tablero** en el Artifact [Sistema visual — ArquitecturaBase](https://claude.ai/artifact/HPbmDPLnr8JZ9TxevtTqJJ)
  (uno por pantalla, siempre ahí), desde una plantilla y con la biblioteca [ArquitecturaBase UI](https://claude.ai/artifact/Ew763kqorVHSYeUqE8CZ7h).
  Se programa tras la elección del usuario. Detalle en `visual-baseline.md` (“Pantalla nueva: primero el tablero”, “La
  biblioteca de piezas”), que manda si el enlace cambia o pide sesión.
- Una decisión visual se cierra en tokens de `src/index.css`, componentes de `src/shared/ui` y, si es verificable, tests.
- Lo no elegido vive en `design-lab/`, fuera del build, y se borra al decidir (“Comparaciones cerradas” del fundamento).
- La skill `variant` es explícita: `/variant` en Claude Code o `$variant` en Codex. Una pieza, tres variantes, un eje; elige el usuario.

## Comandos

- `aspire run` desde `../ArquitecturaBase`: Postgres, Redis, Api y front en `https://localhost:5173`.
- `npm run dev`: solo el front en `http://localhost:5173`, con la Api aparte; el ingreso real no anda por http (las
  redirect URIs son `https`).
- `npm run test` o `npm run test:watch`.

## Estructura

- `src/app`: router y providers. `src/auth`: sesión OIDC, rutas protegidas y permisos. `src/layouts`: AuthLayout,
  AppLayout y menú. `src/shared`: cliente HTTP, hooks, i18n y `ui`. `src/features/<módulo>`: páginas, componentes, API y
  su `AGENTS.md`. `src/locales/<idioma>/<módulo>.json`: un namespace por módulo.
- Una feature nunca importa otra; lo común sube a `shared`, que no depende de features. `featureDependencies.test.ts`
  (en `lint` y `test`) revisa imports de valores y tipos, reexports e imports dinámicos literales.
- `ForbiddenPage` (`shared/ui`) sirve a `/sin-permiso` y a los 403; `features/errors`, a la ruta inexistente.

## Rutas y sesión

- Rutas **en español**, todas en `src/app/routes.tsx`; `router.tsx` las monta. Administración: `/usuarios` (`users.read`),
  `/roles` (`roles.read`), `/roles/nuevo` y `/roles/{id}` (`roles.manage`), `/configuracion` y `/configuracion/apariencia`
  (`settings.manage`). El permiso va en `routes.tsx` (`<ProtectedRoute permission="..." />`) y se repite en
  `navigation.ts`: uno abre la ruta, el otro muestra el ítem.
- Una ruta hija no tiene ítem: `parentLinkOf` y `branchOf` la reconocen por prefijo para desplegar el grupo y armar las
  migas. Un segmento estático (`/roles/nuevo`) le gana a uno dinámico en cualquier orden.
- **Ingreso sin recargar.** Sin `returnUrl` válido, `createSigninReturnUrl` usa `OidcClient` con la configuración y el
  almacén del proveedor para generar PKCE y el pedido de `/connect/authorize`, guardado en la query reemplazando la
  entrada. Viaja al código y a Google; el servidor lo valida y lo devuelve. `authorizeReturnUrl` rechaza otros destinos.
- `/registro` usa el mismo OIDC con `screen_hint=signup`; `/registro/codigo` comparte verificación, reenvíos y bloqueos con
  `/login/codigo`. `register` marca la intención; el nombre viaja en el estado de la ruta y se guarda al crear la cuenta.
  `registrationOpen` (`/account/login-methods`) decide la oferta y el servidor la vuelve a comprobar.
- `HomeLayout` conserva `AppLayout` entre rutas privadas. Recuperación silenciosa: una vez por montaje del proveedor; la
  renovación conserva la pantalla; los namespaces se precargan.
- **Cierre de sesión:** POST de formulario a `/connect/logout`, espera la revocación, cancela consultas, limpia la sesión
  y navega a `/login`. `UserMenu` confirma `/login` con `flushSync` antes de liberar la transición (`RouterProvider` de
  `react-router/dom`): no queda guardada la ruta de la cuenta anterior y el ingreso siguiente empieza en Inicio. Una
  visita anónima conserva su `returnTo`. Regresión: `session.spec.ts`.
- `RouteErrorPage` es el límite estático traducido de import/render; Recargar abre un documento nuevo sin repetir
  escrituras. `ProtectedRoute` conserva el caparazón si falla una hoja; el límite raíz cubre la carga inicial. Un error de
  carga no es falta de permiso ni vacío.
- `/perfil` (desde «Mi perfil») no pide permiso. `PUT /api/me` reemplaza nombre, idioma y zona: van siempre los tres.
- **Inicio:** `src/app/AuthenticatedHome.tsx` carga `AiAssistantPage` solo si `installedFeatures` contiene `assistant` y
  hay `ai.assistant.use`; si no, `DashboardPage`; un fallo de lectura ofrece Reintentar. `home` no importa IA. La URL
  guarda solo `conversacion` y el paginado. `@assistant-ui/react` vive detrás de `shared/ui/assistant`.

## Ingreso con WhatsApp

Código pedido desde la web y verificado, independiente del modo Manual del chat; las invitaciones orientan a `/login`.
Contrato: [WhatsApp](../../ArquitecturaBase/docs/features/whatsapp.md) (módulo opcional).

- **El servidor dice qué medios ofrecer:** `getLoginMethods` trae `google`, `whatsapp`, `whatsappCountries` y
  `whatsappNumber`. Con WhatsApp apagado no hay selector ni vinculación en el perfil.
- `/login`: selector Correo | WhatsApp debajo de Google, en Correo. `EmailCodeForm` y `WhatsAppCodeForm` navegan a
  `/login/codigo` con `{ channel, email }` o `{ channel, phone, maskedPhone }` más `resendAfterSeconds`; sin ese estado,
  vuelve a `/login`.
- `PhoneField` arranca en el primero de `whatsappCountries` (nombres de `shared/lib/countries`) y manda
  `{ country, number }`; normaliza el backend, sin librería de teléfonos.
- **Errores de código por `code`** (`codeErrors.ts`): `phoneFieldError` ata al campo `Users.Phone.Invalid` y
  `Auth.WhatsApp.CountryNotSupported`, aun sin `errors`. Incorrecto → grupo de código; agotado o consumido → estado del
  flujo; red y rechazo general → aviso. `codeRequestErrorMessage` es legado a migrar, no referencia.
- `Auth.Account.NotInvited` y `Auth.Account.Disabled` deshabilitan Verificar y el reenvío y ofrecen volver a `/login`.
- **Error de Google:** el callback vuelve a `/login` o `/registro` con `error` y el `returnUrl` si recibió `register`;
  sin él, `LoginPage` lo prepara con `createSigninReturnUrl`. `loginRedirectError` guarda solo el código en
  `arquitecturabase.login-error` (nunca tokens ni datos de cuenta): prioriza la query, se borra con el pedido listo y se
  descarta al reenviar.
- **`/ingresar`** canjea enlaces históricos, en `AuthLayout` y sin `lazy`. El token del fragmento (`#t=…`) se lee en el
  primer render y se borra con `history.replaceState` (un efecto no sobrevive al doble montaje de `StrictMode`); después,
  solo memoria. `preview` no lo gasta; **Continuar** (`redeem`) una sola vez, y sigue `signinRedirect`.
  `loginLinkFailureOf` elige la pantalla; el reintento respeta `retryAfter`. "Volver a WhatsApp" solo con `whatsappNumber`.
- **Cuenta sin correo:** `src/auth/accountName.ts` arma nombre e inicial (`displayName ?? email ?? phoneNumber`; primera
  letra o cifra, o "?"), no un `initialOf(...)` suelto. El número se muestra con `formattedPhoneNumber`, nunca en E.164.
- **`/perfil`:** "Medios de ingreso" y "Datos del perfil". `LoginMethodsCard` muestra cada medio con `VerificationBadge`;
  el único medio muestra ayuda en lugar de Desvincular (ante `409 Users.User.LastLoginMethod`, se relee `/api/me`).
  `VerifyDestinationDialog` (`email`/`whatsapp`) pide destino y código en el mismo diálogo; el `409` de otra cuenta tiene texto propio.
- **Invitación:** `UserFormDialog` (alta) y `UserEditDialog` (edición, no crea identidades) van separados. Pide canal
  (`RadioGroupField`) y consentimiento; Por correo se deshabilita sin correo. Lo cargado por un admin queda Sin verificar,
  con explicación alcanzable por teclado.

### Lo que subió a `shared`

`PhoneField`, `OtpInput` (`shared/ui`), `countries` (`shared/lib`), `codeErrors`, `getLoginMethods` (`shared/api`): los
usan ingreso, perfil y usuarios. Textos en `common.json`.

### Piezas nuevas de `shared/ui`

Su aspecto cambia también en la biblioteca del Artifact. `RadioGroupField` (una opción entre pocas, como `FormField`);
`VerificationBadge` (igual en perfil y usuarios); `SegmentedControl` con `fullWidth` o `appearance="public"` (táctil desde
44 px); `Banner`, auditado por significado; tokens `--color-success-50/700` y `--color-warning-50/700`. Todo color nuevo es un token.

## Listados

- `usePagination` (`page`, `pageSize`, `sort`, `search`) y `useFilters` escriben con `useQueryUpdate`, el único que toca la
  query string. `setParams((previous) => …)` recibe la query **confirmada**: dos llamadas en el mismo tick se pisan. Lo que
  viaja junto va en una llamada (`setFilter` incluye el reset de página); lo cubre `useFilters.test.tsx`.
- `useFilters` recibe las claves del backend (`userFilterKeys`). Escribe con `replace: true`.
- Conteos: `GET /api/users/filter-counts`, bajo `usersQueryKeyRoot` como el listado, así una mutación invalida ambos.
- `DataTable` recibe `emptyTitle`, `emptyDescription` y `emptyAction`. Cambiar el orden también vuelve a la página 1.
- Parámetros de `PagedRequest`; `sort`: `campo` o `-campo`; fuera de la whitelist, 400.

## Reglas

- TypeScript estricto: sin `any` ni `@ts-ignore`; tipos con `import type` (`verbatimModuleSyntax`).
- i18next en español rioplatense con voseo e inglés, en el namespace del módulo (`useTranslation("<módulo>")`);
  `parity.test.ts` exige ambos. A `common.json` sube lo de más de un módulo.
- **Idioma en dos niveles.** Sin sesión, `PublicPresentationDefaults` (en `AuthLayout`) aplica el idioma general salvo una
  elección guardada con `changePublicLanguage` en `arquitecturabase.public-language` (no decide la cuenta anterior). Con sesión,
  `useLanguagePreference().change` lo guarda en el perfil y, si falla, vuelve atrás y avisa. Si difieren, gana la cuenta
  (`useProfileLanguageSync` en `AppLayout`), cuando ningún editor que se reinicia con el idioma tiene cambios sin guardar. `changeLanguage` no registra una elección pública. Viaja en
  `Accept-Language`; `lang` sigue a `languageChanged`. Configurar la instalación no cambia la sesión actual.
- Datos con TanStack Query, sin `useEffect` con `fetch`; HTTP solo por `shared/api/httpClient` (token, idioma, `ApiError`).
  Tokens en memoria. Los permisos del front son experiencia; decide el backend.
- Tailwind y tokens de `index.css`; `shared/ui` sin colores propios. Clases con `cn` (de `shared/lib/utils`), sin `clsx` ni `tailwind-merge`.
- Un `fieldset` con rótulo propio deja el `legend` en `sr-only` y dibuja la banda con `aria-hidden`. Nunca `fieldset` en
  una tabla: en `PermissionPicker` cada área es un `tbody` con `aria-labelledby`.
- **Tests:** Vitest y Testing Library por rol y texto; MSW para HTTP. Radix se abre con teclado (foco y `{Enter}`), no con
  `userEvent.click`. `src/test/setup.ts` simula `matchMedia`, `ResizeObserver` y `scrollIntoView`. Una ruta `lazy` no pinta
  sincrónicamente: `findBy*` o `waitFor`.
- **Generados de shadcn** (minúscula, `npx shadcn@4.21.0 add <componente> --yes`): editar lo mínimo; los propios, en
  PascalCase. Al regenerar, conservar las traducciones de `dialog.tsx` y `sonner.tsx` y `theme="light"` sin `next-themes`
  (`dialog.i18n`, `sonner.i18n` y `sonner.theme` tests). `.oxlintrc.json` apaga `react/only-export-components` solo en generados.
- Fechas: además de los formateadores de las premisas, `formatTimeInZone` (hora de un mensaje) y `calendarDateInZone`
  (agrupar por día) en `shared/lib/dateTime`. Un valor tipado (entero, decimal, fecha sin hora, sí/no) se muestra sólo con
  `shared/lib/typedValue`, igual en tablas, importación, resúmenes, respuestas y el chat; las fechas con hora siguen con
  `formatDateInZone`/`formatDateTimeInZone`.
- `IconButton` incluye `ActionTooltip` y usa `disabledLabel` con un motivo concreto. En `RowActions`, sin permiso se pasa
  `hidden`: un botón deshabilitado no recibe foco. Un control con texto deshabilitado por un motivo que no es obvio usa
  `DisabledReason`: tooltip sobre un span enfocable y descripción accesible; dentro de `FormField` reenvía `id`,
  `aria-invalid` y `aria-describedby` al control.
- **`AppLayout`** usa `h-svh` y scrollea `<main>`, `relative` (un `sr-only` estira el documento) y con `scroll-pt-14` (más que
  la banda de 48 px: el foco no queda tapado, WCAG 2.4.11). Al imprimir, `print:h-auto` y `print:overflow-visible`. jsdom no
  maqueta: un cambio del caparazón se mira en el navegador.
- **Formulario con ruta propia:** `useUnsavedChangesGuard` frena enlaces, migas, menú y Atrás (recargar lo pregunta el
  navegador). El `reset()` de `useBlocker` pisa `"proceeding"` y `ConfirmDialog` llama `onConfirm` y `onOpenChange(false)`
  en el mismo clic: `stay()` no hace nada tras `leave()`. Guarda apagada con `isDirty && !mutation.isPending`; la vuelta
  al listado va en el `onSuccess` de `mutate(...)`, no de `useMutation`. Cambiar el idioma del menú no pasa por el router
  pero vuelve a montar los editores cuya clave lleva la cultura (hoy, el diseño del PDF): su guarda pasa
  `remountsOnLanguageChange` y, con cambios (`hasUnsavedChanges`), `UserMenu` pregunta antes. Las pantallas que conservan el
  borrador con el idioma (el editor de formularios y los de catálogos, entre otras) no la pasan.
- **Errores por `code`:** `errors.ts` de cada feature hace `switch` sobre `ApiError.code` para los códigos con texto propio
  (`Users.LastAdmin`) y deja pasar el `detail`. `Roles.Role.HasUsers` arma el texto con `userCount` (`ApiError.problem`);
  `{{count}}` necesita `_one` y `_other`.
- Lo de varias features sube a `shared/api` (`shared/api/roles.ts`). Las mutaciones invalidan por prefijo
  (`usersQueryKeyRoot`), detalle y `currentUserQueryKey` si cambian permisos propios.
- **Editores privados** (IA, negocio, formularios, envíos de chat e Inicio): borrador y cuerpo/UUID congelados en memoria
  del editor, fuera de MutationCache, URL, storage y logs, sin reintentos automáticos. Lo incierto se consulta por UUID;
  un 404 no prueba rollback y solo una acción explícita repite el cuerpo idéntico. Las lecturas privadas usan claves por
  actor, cultura y permisos y se limpian al perder el contexto.
- Places busca con el cliente común, fuera de QueryCache y MutationCache por condición del proveedor; la clave queda en el
  servidor y se guarda el PlaceId. [Operación](../../ArquitecturaBase/docs/guides/configurar-google-places.md).

## Rendimiento

- Cada ruta con `lazy()`, salvo las de ingreso.
- Sin componentes definidos dentro de otros; el estado derivado se calcula en el render.
- En JSX, ternario y no `&&`. `localStorage`: lo mínimo, clave `arquitecturabase.*`, nunca tokens ni datos del usuario.

## Configuración general

- `SettingsForm` compone, `SettingsReview` compara y `SettingsPage` coordina. Valores y revisión de `/api/settings`; el
  PATCH manda los campos cambiados y `expectedRevision`. Registro confirma solo si cambió.
- El editor espera la lectura exitosa del montaje actual aunque haya caché; un refetch no toca el borrador. Una revisión
  aceptada incorpora cambios ajenos de campos no editados; una obsoleta o incierta obliga a releer y comparar.
- Apariencia: `AppearancePreview` para la vista previa; `AppProviders` monta `SystemTheme` una vez y la proyección pública
  aplica variables a la raíz y los portales. `shared/lib/appearance` valida y deriva texto/foco/hover. Sin localStorage.
- `shared/api/presentation.ts` consume `/api/settings/presentation`; usuarios y roles la esperan si la URL omite tamaño.
  `Pagination` ofrece 10/20/50/100 y vuelve a página 1. El catálogo de roles para selectores lee `/api/roles` completo.
- App y arnés comparten emisor, clasificador y fábrica de QueryClient; `errorOwner` local evita duplicados y
  `meta.silent` queda en consultas auditadas.

## Áreas con guía propia

- **WhatsApp** ([guía](../src/features/whatsapp/AGENTS.md)): `useChatThread` posee la lectura y su retiro privado; acciones,
  viewport e interpretación Manual conservan dueños separados sin importar otra feature. El modo y el origen Assistant
  son explícitos; tomar Manual exige Send y activar Assistant exige ConfigureAssistant. El historial muestra motivo,
  datos propuestos y títulos capturados sin reconstruir autoría ni sugerencias actuales; esos datos respetan RecordsRead.
  El preview Manual vive sólo en el editor y envía IDs de campos seleccionados. Consultar un resultado perdido usa GET
  compartido antes de repetir explícitamente. Audio conserva su tipo, bytes privados a pedido y transcripción vigente;
  abrir el hilo en Manual solicita sólo los Pending visibles, sin repetir un POST incierto.
- **IA** ([guía](../src/features/artificial-intelligence/AGENTS.md)): `/configuracion/ia` (`ai.read`, `ai.manage`) y
  `/configuracion/negocio` (`ai.business.read`/`manage`), sin depender de settings ni WhatsApp. Plegar o paginar el panel
  de Inicio no llama al modelo.
- **Formularios** ([guía](../src/features/business-forms/AGENTS.md), [diseño](design/formularios-whatsapp.md),
  [contrato](../../ArquitecturaBase/docs/features/formularios.md)): `/formularios` implementa A–E y P1–P3, con I1–I3 como reemplazo de E/P1 para idiomas; WhatsApp,
  C1–C5 y R1–R3, sin importar `business-forms`. MF1 reúne formularios según Read o Decide; cada formulario contiene su planilla y pendientes. D2 conserva URL, orden y un único dueño de decisión; DC0/DC1 reutiliza ese dueño en pantalla completa.
  Respuesta, Fotos, Actividad y PDF consumen hechos capturados. La aprobación sin RecordsRead conserva sólo metadata.
  Reglas, diseño PDF y sugerencias tienen guardado/revisión propios; OfferWhen usa el borrador existente sin publicarse.
  La publicación requiere el original completo y admite traducción secundaria opcional; la preview y el envío usan
  una cultura para el formulario entero. Ninguna pantalla elige el idioma del contenido: cada texto es un solo campo en
  el idioma del menú (`scope.culture`), que es el original de lo nuevo; en el otro idioma es la traducción, con el
  original como referencia (`contentReference`) y sin copiarlo, y un error del otro idioma va bajo el mismo campo
  (`localizedIssue`). Fuera de los editores se muestra en el idioma del menú y, si falta, en el original
  (`administrativeName`), según la [regla funcional](../../ArquitecturaBase/docs/features/formularios.md#idioma-original-y-traducción-opcional--2026-10-19). Los catálogos propuestos se revisan con original obligatorio; el contrato de los catálogos y
  de los datos de las personas trae su `originalCulture` y exige sólo ese idioma. Los faltantes agregados requieren Manage; crear conserva Read+Manage y sólo siembra
  el nombre en un alta nueva. Actor, cultura y permisos particionan consultas y limpiezas; un 403 retira el alcance que leyó.
  Los consumidores HTTP sirven bytes exportados sin modificarlos; `src/test/httpCohort` reúne las familias y sus variables
  de entrada. La calificación de esos cuerpos y del navegador se registra separada de los dobles y del piloto real.
