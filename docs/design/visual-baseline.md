# Fundamento visual de ArquitecturaBaseFront

Estado: **vigente**. Contrato visual versionado que comparten Codex y Claude. No repite las
[premisas](../guides/premisas-de-desarrollo.md) (interacción), el [estándar aplicado](../guides/estandar-visual.md)
(piezas, medidas, catálogo y controles) ni el [contrato de mensajes](../guides/mensajes-y-estados.md).

- Procedencia: [Sistema visual — ArquitecturaBase](https://claude.ai/artifact/HPbmDPLnr8JZ9TxevtTqJJ) (Artifact privado de Claude).
- Biblioteca: [ArquitecturaBase UI](https://claude.ai/artifact/Ew763kqorVHSYeUqE8CZ7h) (Artifact privado, instalada en el lienzo).
- Revisión registrada del Artifact: **2026-09-24** (veintiún tableros), más la página «Formularios por WhatsApp»
  (2026-10-08/10), con los ajustes G2/G5 elegidos en la versión 75 el 2026-10-16. Reconciliación general con el código: **2026-10-02**; las actualizaciones de formularios se registran en su [diseño](formularios-whatsapp.md) y no implican sincronización del Artifact.
- Evidencia: [`src/test/visual/screenshots/`](../../src/test/visual/screenshots/), [`evidence/`](evidence/),
  [`docs/verification/`](../verification/) y `design-lab/history/`.

## Cómo se usa esta base

El Artifact requiere sesión y cambia fuera de Git: este documento congela lo aplicable. Precedencia:

1. Contratos funcionales y de seguridad del backend, permisos, accesibilidad, i18n y manejo de errores.
2. Este fundamento y lo codificado en `src/index.css` y `src/shared/ui`.
3. El Artifact como referencia visual, historial y fuente de propuestas.

Una propuesta dibujada no está implementada: necesita revisión, elección explícita y terminar en tokens,
componentes compartidos y tests. No se copia un valor aislado en una pantalla.

## Pantalla nueva: primero el tablero

Una pantalla nueva arranca como tablero en el Artifact [Sistema visual — ArquitecturaBase](https://claude.ai/artifact/HPbmDPLnr8JZ9TxevtTqJJ),
el que agrupa “Gestión de usuarios”, “Filtros”, “Formularios” y “Anatomía”. Un tablero por pantalla y siempre en ese
Artifact, nunca uno nuevo por pantalla o fase. Desde el 2026-10-10 el lienzo tiene una página por módulo con un índice arriba.

El orden no se invierte:

1. Se agrega el tablero con la funcionalidad completa, **arrancando de una plantilla** (hoy, “Plantilla · Listado”)
   y **armado con las piezas de la biblioteca**, no dibujado a mano (ver “La biblioteca de piezas”).
2. El usuario lo mira y elige. Sin elección explícita no se programa.
3. Recién ahí se programa; lo elegido termina en tokens, componentes compartidos y tests.

El tablero dice cómo se comporta la pantalla. Muestra, cuando corresponda:

- el layout con datos y la acción primaria;
- carga, vacío de “no hay datos” y vacío de “no hay coincidencias”;
- el error del listado o del formulario, con reintento cuando aplica;
- qué se ve y qué no sin permiso;
- el recorrido completo: diálogos, confirmaciones y a dónde vuelve cada salida;
- qué vive en la URL (página, tamaño, búsqueda, orden, filtros).

Es la lista del “Criterio de finalización de una pantalla”: si el tablero la cubre, cerrar es implementar, no
rediseñar. Al terminar, la pantalla suma su fila al “Mapa Artifact → proyecto” y se actualiza la revisión del encabezado.

## La biblioteca de piezas

Desde el 2026-09-23 el lienzo tiene [ArquitecturaBase UI](https://claude.ai/artifact/Ew763kqorVHSYeUqE8CZ7h): las piezas
de `src/shared/ui` y `src/layouts`, con los mismos nombres, medidas y tokens, que un tablero monta
(`<x-import component-from-global-scope="AB.Button" variant="outline">`).

- **Una pantalla nueva se arma, no se dibuja.** Se duplica la plantilla y se cambian entidad, columnas y filtros; lo que
  la plantilla resuelve (acción primaria, vacíos, error, sin permiso, diálogos) no se vuelve a decidir.
- **Cada pieza tiene su gemela en el código** y su ficha lo dice (“En el código: `shared/ui/button.tsx`”).
- **Un cambio de aspecto se hace en la biblioteca y en `shared/ui` a la vez.** Nunca en uno solo.
- **Fuentes en el Artifact de la biblioteca**, `components/src/` (un `.jsx` por grupo, `css/` y `build.mjs`).
  `node build.mjs <carpeta del front>` regenera el paquete con el rolldown del front; después se copian `bundle.js`,
  `bundle.css`, `index.d.ts` y `tokens.json` al lienzo, en `project/ds/ab/`. Pasos: `components/src/COMO-SE-ARMA.txt`.

Composiciones que siguen en sus consumidores: “Más filtros” y selección por catálogo (`FilterSelect`/`MoreFilters` en el
Artifact) en `UsersFilterBar.tsx`, con `FilterMenuTrigger` y `FilterChip`; punto de estado (`StatusDot`) en `identityCell`
de `features/users/columns.tsx`; avatar de cuenta en `Sidebar.tsx` y `UserMenu.tsx`, con `initialOf`. `Surface` y
`FilterChip` ya están en `shared/ui`. `FormError` general no se promueve: es un desvío a migrar al aviso común.

**Deuda de sincronización** (está en `shared/ui` y no en la biblioteca; abrir el Artifact requiere autorización
explícita): tokens Campo, contextos y cabeceras; `FilterBar`, `NativeSelect`, `Surface`, `FilterChip`, `FilterMenuTrigger`,
`TableSectionToggle`, `TableRowHeader`, `EmptyState embedded`, `Button inline/touch`, `SegmentedControl` (`fullWidth`,
`appearance="public"`), `Banner`, `RadioGroupField`, `VerificationBadge`, `PhoneField`, `OtpInput`, `CheckboxField` con
`error`, `Spinner decorative`, `DisabledReason`, `Page` con `backTo`/`status`, `ConfirmDialog` con `cancelLabel`, caparazón `h-svh`, migas
de cuatro niveles; íconos `Mail`, `Smartphone`, `Check`, `Info`, `AlertCircle`, `AlertTriangle`, `Clock`, `Ban`, `Eye`,
`CheckCheck`, `Send`; tokens `success-*`, `warning-*`, `danger-700`; y las piezas posteriores al 2026-10-02.

## Principios del sistema

- **Un sistema, no una colección de pantallas.** La coherencia nace de piezas compartidas.
- **Superficies comunes.** `Surface` y `DialogContent`: fondo blanco, borde de 1 px, radio de 6 px. Sin tarjetas que
  la tarea no necesita; `EmptyState embedded` evita otro borde dentro de la tabla.
- **Una banda de superficie.** `Surface` y tablas usan `--color-surface-header`; `Page`, `--color-page-header`; el
  diálogo conserva su encabezado blanco.
- **Cuatro estados:** normal, hover, seleccionado y foco, con los mismos roles en navegación, tablas y listas.
- **Cinco niveles tipográficos:** título de pantalla, de sección, cuerpo/dato, secundario y rótulo. Un sexto requiere
  ampliar el sistema. Título de pantalla con peso 600.
- **Seis pasos de espacio:** 4, 8, 12, 16, 24 y 40 px (8 entre controles, 16 dentro de superficies, 24 entre secciones).
- **La marca significa acción:** `brand` para acciones, selección y foco. Éxito, atención y peligro tienen roles
  propios; peligro solo para consecuencias destructivas.
- **El color nunca comunica solo:** todo estado lleva texto, ícono accesible o ambos.
  - **Excepción:** en Usuarios el estado es un punto delante del correo (verde activo, rojo inactivo) con la palabra en
    `sr-only`. Habilitar (check) y deshabilitar (encendido) son íconos con nombre y tooltip, y piden confirmación. No se
    repite en otro listado sin compararlo antes.

## Paleta Campo aplicada, solo colores — 2026-10-02

Solo colores, sin cambiar componentes: acciones `#285A3D`, navegación `#24352B`, encabezados
`#DFE8D9` y filas `#F4F6F0`, con tonos derivados y texto oscuro. Reemplaza a Jade. No se promovieron las pantallas de
campo, la escala de 44 px ni la simulación offline. `initialAppearance`, la vista previa y los tokens expresan la misma
base. El backend migra solo una instalación con los cuatro colores Jade originales; una personalizada se conserva entera.

Tonos en `@theme` y alias de controles en `:root` de `src/index.css`, por función y sin selectores por ruta (prefijo `--color-`):

| Zona | Tokens |
| --- | --- |
| Menú principal y panel secundario | `nav-surface`, `nav-foreground`, `nav-muted`, `nav-hover`, `nav-accent`; `subnav-surface`, `subnav-hover` |
| Barra superior, también en acceso | `topbar-surface`, `topbar-foreground`, `topbar-muted`, `topbar-border` |
| Encabezados | `page-header`; tabla y bandas: `surface-header`, `content-heading` |
| Filtros y campos | `filter-surface`; `control-surface`, `control-border` |
| Superficies y texto | `canvas`, `surface`, `surface-muted`, `border`, `content`, `content-muted` |
| Acciones | `brand-500`, `brand-600`, `brand-ink` |
| Filas | `table-row-alternate`, `table-row-hover`, `table-section`, `table-section-foreground` |

Los contextos `navigation-surface`, `subnavigation-surface` y `topbar-surface` se aplican una vez en los layouts; los
portales usan el tema global. Los campos comparten fondo y borde; foco, validación y deshabilitado conservan sus señales.
`shared/ui/theme.test.ts` comprueba contraste.

## Escala y forma

Escala compacta para administración; el acceso público usa controles de 44/46 px.

- **Clara y verde.** Canvas y superficies blancos; `surface-muted` y líneas delimitan. `<html>` sin `class="dark"`; `color-scheme: light`.
- **Acción verde:** `-50`/`-100` fondos suaves, `-700` texto encima, `-600` relleno con `--color-brand-ink` blanco.
- **Texto una talla abajo** (`--text-*` en `@theme`): la interfaz se lee en 14 px (`text-sm`), también en el ingreso.
- **Medidas del caparazón:** barra superior 48, menú 220 (56 contraído), panel de Administración 224, ítem de menú 30
  mínimo (los nombres largos pueden ocupar varias líneas). Controles, filas y cabeceras: ver el estándar.
- **Esquinas:** 5 px en controles (`--radius-control`) y 6 px en tarjetas (`--radius-card`).
- **Sin sombras**, salvo los popovers: profundidad por escalón de luz y línea de 1 px.
- **Quitados:** cuadrado de logo (la marca es el nombre), ícono de sección en `Page` (la prop `icon` no existe),
  versalitas espaciadas en rótulos, pastillas redondas de estado y avatares circulares.
- **Ítem activo del menú:** barra de 2 px de la marca y peso tipográfico, no una pastilla.
- **Public Sans** (`@fontsource-variable/public-sans`); tablas con figuras tabulares por CSS.

## Encabezados

Tres niveles: **pantalla** (uno por ruta, título y acción primaria, sin ícono), **superficie** (abre tabla, formulario,
diálogo o panel) y **grupo** (rotula una lista sin caja, como una sección del menú). La pantalla usa `Page`:

- Banda de **48 px mínimos**, `--color-page-header` y borde inferior, adherida en escritorio. Si título y acciones no
  entran en un renglón, las acciones bajan al borde derecho y el título queda entero. En móvil no se adhiere y
  título, estado y acciones pueden ocupar varias filas. Sin estado expandido, antetítulo, descripción ni ícono.
- Título de la pantalla abierta y su acción primaria a la derecha.
- Pantalla hija: `backTo`, caja de 24 px con flecha de 14 px, tooltip, sin borde permanente y nombre accesible que dice
  a dónde vuelve. `status` acompaña al título sin formar parte del nombre y muestra solo el estado del objeto, como
  «Activo» o «Dado de baja». No muestra «Cambios sin guardar» ni números de revisión: que Guardar esté habilitado ya
  dice que hay cambios. Una prueba de arquitectura impide que un locale vuelva a ofrecer ese estado.
- Migas en la barra superior, tres niveles (`Inicio / Gestión de usuarios / Usuarios`); una ruta hija suma la hoja
  (`… / Roles y permisos / Soporte`) con `useBreadcrumbLeaf`. Hasta que la pone, el padre queda último sin marcar como actual.

## Navegación

- Arriba, las pantallas del día a día; abajo, **Administración**, separada por una línea. Un submenú tiene un padre
  `button` con `aria-expanded` e hijos indentados con guía vertical, ícono y sangría; vive en el menú lateral, no en
  pestañas del encabezado. Un grupo rotulado (`ADMINISTRACIÓN` en versalitas) sigue siendo posible para lo de todos los
  días; Administración ya no lo usa.
- **Administración abre un panel propio** (224 px, `subnavigation-surface`) con `Gestión de usuarios` y `Configuración`.
  Se abre solo en sus rutas y se cierra al salir; adentro, con el mismo botón o la flecha del borde, que esconde la de
  contraer el menú. En el teléfono no hay panel: se despliega en el cajón.
- **Los grupos arrancan plegados y el activo se despliega solo**, calculado en el render; solo se abre el activo. El
  plegado manual no se recuerda; la barra contraída sí. `layouts/navigation.ts` abastece panel, cajón y barra contraída.
- **Agrupar no cambia rutas:** `/usuarios` y `/roles` no se anidan; enlaces guardados y `returnUrl` siguen igual.
- **Cada hijo conserva su permiso:** sin ninguno no se ve el grupo. Se pide en la ruta y se repite en la navegación.
- Contraída: íconos centrados en controles de 30 px (40 en estados auxiliares de carga/error), separador corto en lugar
  del rótulo y control de plegar de 20 px sobre el borde. Sin submenús: los hijos suben como íconos sueltos;
  Administración sigue siendo un botón que abre el panel.

## Íconos y acciones

- 16 px en línea y navegación, 18 px en acciones de fila, 14 px el volver de `Page`.
- Grilla de 24, trazo aproximado de 1.75, puntas redondeadas. Sin emoji.
- Configuración usa `SettingsIcon`; General, `PreferencesIcon`; Apariencia, `PaletteIcon`.
- SVG decorativo (`aria-hidden="true"`); el botón lleva el nombre contextual (“Eliminar a ana@ejemplo.com”).
- Toda acción sin texto usa `ActionTooltip`: hover y foco, Escape, el puntero puede pasar a la ayuda, se ajusta a los
  bordes y vive en un portal. Un solo `TooltipProvider`; se monta solo abierto; textos del namespace del módulo, también
  en botones deshabilitados. Un botón con texto visible no repite su nombre en un tooltip; si está deshabilitado por un
  motivo que no es obvio, `DisabledReason` lo muestra como tooltip y descripción accesible.
- En una fila, inocuas primero y destructiva última; el rojo aparece al interactuar. Sin permiso, no se renderiza.

## Listados y filtros

Complementa las [premisas](../guides/premisas-de-desarrollo.md#filtros-y-búsqueda):

- Un buscador de texto libre, siempre visible. Hasta tres filtros frecuentes al lado; el resto en un panel avanzado con
  contador de aplicados, que aplica el conjunto una vez. Búsqueda y filtros rápidos aplican sin botón.
- Filtros activos como chips removibles y una única acción “Limpiar todo”. Sin coincidencias, el vacío dice cuántos
  filtros hay y permite limpiarlos. Cambiar el orden también vuelve a la página 1.
- El backend filtra, ordena y pagina; el front no simula resultados sobre una página parcial.
- Selección masiva con checkboxes nativos o equivalentes con nombre accesible.

## Formularios y diálogos

Complementa las [premisas](../guides/premisas-de-desarrollo.md#formularios-y-selección):

- Etiqueta arriba. Ancho según el contenido; una columna salvo pares cortos relacionados.
- La ayuda ocupa el renglón que reemplaza el error, sin saltos. Ningún campo productivo fuera de `FormField` sin razón documentada.
- Se valida al enviar; después del primer error, en vivo mientras se corrige.
- Cancelar junto a la primaria, que va última; una destructiva, separada a la izquierda.
- Al guardar, el botón se deshabilita mientras trabaja, sin tapar la pantalla ni perder lo escrito.
- **Un botón está habilitado o deshabilitado, sin explicaciones al lado** (decisión del usuario, 2026-10-23):
  - no se agregan textos debajo ni al costado, como «No hay cambios para guardar», «Revisá los datos marcados antes de
    guardar» o «Guardá … antes»;
  - los botones no cambian de lugar ni de forma con cada acción;
  - si el motivo de un deshabilitado no es obvio, va como tooltip al pasar el mouse o con el foco (`DisabledReason`);
  - los errores se marcan en sus campos.
- **Las acciones de una superficie van al borde derecho de su encabezado,** a la altura del título.
- Breve y contextual: diálogo. Largo, seccionado o compartible: ruta propia. Un único valor puede editarse en línea.

## Responsive y accesibilidad mínimos

- Todas las rutas funcionan desde 320 px sin recortar contenido esencial.
- Lo que hace el puntero lo hace el teclado; el foco siempre se ve.
- Cada control tiene nombre accesible; los cambios asincrónicos importantes se anuncian.
- Tablas anchas: scroll contenido con indicación, menos columnas o apilado; nunca scroll horizontal de la página.
- Objetivos táctiles de al menos 44 × 44 px en móvil, aunque el dibujo sea más compacto.
- Español e inglés conservan la jerarquía sin longitudes fijas.

Falta una auditoría completa de accesibilidad y objetivos táctiles: los controles compactos y el volver de `Page` no
crecen todos a 44 px en móvil.

## Criterio de finalización de una pantalla

- Usa solo tokens y componentes compartidos, o amplía el sistema de forma deliberada.
- Cubre carga, vacío, error, éxito y falta de permiso cuando correspondan.
- Funciona con teclado, lector de pantalla, zoom y desde 320 px.
- Todo texto visible existe en español e inglés.
- Conserva estado compartible en la URL cuando es una colección.
- Pasa `npm run build`, `npm run lint` y `npm run test`.

## Decisiones por pantalla

### Acceso público y portada

- `/` muestra la portada sin sesión y el tablero con sesión. `/login` y `/registro` distinguen intención, textos y
  formulario; cada uno tiene su `/codigo`.
- Portada: blanco predominante, cabecera verde clara, curvas de campo al pie del bloque principal, tres capacidades
  genéricas y la marca «Tu organización», sin actividad ficticia. Iniciar sesión es la acción principal; Crear una cuenta,
  solo si el servidor habilita el registro. `WelcomePage` compone `PublicLanding`; `AuthLayout` aporta marca, navegación
  y pie. Roles `public-*` derivados del encabezado de la paleta global; textos en `auth.json`.
- Ingreso, registro y código: título de 30 px (28 en móvil), formulario de 400 px máximo, controles de 44/46 px. Una
  superficie sin tarjeta; cabecera solo con los accesos (`topbar-surface`), pie con idioma, selector correo/WhatsApp
  subrayado con íconos Lucide.
- El registro pide nombre solo para una cuenta por código. Los estados siguen al backend; la existencia de una cuenta
  se informa después de verificar identidad. Sin enlaces de Privacidad/Ayuda hasta tener contenido real.

### Roles

- Listado: Rol muestra solo el nombre, sin “Del sistema”. `RowActions`: Admin “Ver”, User “Editar”, ninguno “Eliminar”.
- Editor: datos en `Surface padded`, Descripción debajo de Nombre (672 px máximo), sin insignia para Admin y User;
  búsqueda y filtro Elegidos en una barra como `UsersFilterBar`. Una tabla con encabezados Permiso, Descripción y Asignado una vez; cada
  área es un `tbody` con `aria-labelledby`, abierto o cerrado. En móvil, 520 px mínimos con scroll contenido.
- Cancelar y Guardar en la banda de `Page`. Guardar se habilita solo con cambios, sin «Cambios sin guardar» junto al título.
- El check de sección admite vacío, parcial y completo; actúa sobre toda el área, aun cerrada o filtrada, y no toca otras.
  Admin ve los checks deshabilitados.
- Encabezados de área con `TableRow tone="section"` (derivado de la cabecera de Apariencia), igual abiertos o cerrados.
- Un `Button` outline con `ChevronDownIcon` alterna Expandir todo / Contraer todo sobre todas las áreas. Una búsqueda
  nueva abre los resultados, que se pueden plegar enseguida; sin coincidencias se deshabilita.

### Configuración general (2026-09-30)

- `/configuracion`: tres `Surface` con título y margen (Preferencias regionales, Listados, Registro de cuentas) y una
  `Page` con Guardar/Descartar, sin estado del borrador. Las cuatro URLs anteriores redirigen.
- Selectores nativos para idioma, zona y tamaño; `RadioGroupField` para el registro, con confirmación de su efecto.
- Un conflicto muestra una tabla de los cuatro ajustes (actual y borrador), con scroll contenido en móvil. Conservar
  cambios incorpora valores ajenos de campos no tocados. Un resultado incierto se consulta antes de otro envío o descarte.
  «Revisar valores actuales» va en la banda de `Page`, antes de Descartar; Usar valores actuales y Conservar mis
  cambios, en el encabezado de la comparación. La comparación aparece al final del contenido: cada lectura lleva el
  foco a su título, que la deja a la vista y pone las elecciones en el siguiente Tab.
- Evidencia: [guardado incierto](evidence/2026-09-30-configuracion-error.jpg) y [320 px](evidence/2026-09-30-configuracion-movil.jpg).

### Apariencia (2026-10-01)

`/configuracion/apariencia` (`settings.manage`) edita botones/enlaces, menú, encabezados y filas alternadas con vista previa
local, Guardar/Descartar y Restaurar colores iniciales (Campo) como borrador. Guarda los cuatro `#RRGGBB` juntos con
`expectedRevision`; la proyección pública los aplica al ingreso y a los portales. Texto, hover, enlaces y foco se derivan
para conservar contraste; success, warning y danger no cambian. Restaurar va en el encabezado de «Colores del sistema»;
`Page` no muestra estado del borrador y, tras un conflicto, «Revisar valores actuales» va en su banda, antes de
Descartar, con Usar valores actuales y Conservar mis cambios en el encabezado de la comparación; como en
`/configuracion`, cada lectura lleva el foco al título de la comparación. Recorridos:
`src/test/visual/appearance.spec.ts`.

### Inteligencia artificial

- `/configuracion/ia`: `Page` con Guardar/Descartar, sin estado del borrador, y tres `Surface` (proveedor/modelo,
  clave/prueba, disponibilidad). No configura conocimiento del negocio ni respuestas. Capturas `ai-*.png`.
- Probar conexión, Reemplazar y Quitar clave van en el encabezado de «Clave y prueba de conexión»; el resultado de la
  prueba va al Toaster, sin estado al lado del botón. La espera de un 429 es el motivo de Cargar modelos y de Probar
  conexión (`DisabledReason`). «Revisión del guardado» lleva consultar, reintentar y elegir en su encabezado, y su
  resumen de la configuración actual no muestra el número de revisión.
- Modelo con `autocomplete="off"` y clave nueva con `autocomplete="new-password"`, con nombres técnicos propios; sin
  configurar, ambos vacíos. Modelos de OpenAI y Anthropic en `NativeSelect`, con Cargar/Actualizar y entrada manual; la
  lista no elige por defecto ni cambia un modelo guardado fuera del catálogo. Probar conexión verifica el ID elegido.
- Alcance: una instalación por negocio (plantilla clonable), con IA compartida entre sus operadores y configurada por su
  administrador; sin conexiones personales, multitenancy ni Embedded Signup.
- Pendientes: el gestor de contraseñas real y el acceso real de las cuentas a los modelos.

### Información del negocio

- `/configuracion/negocio`, con menú, permisos, editor y persistencia propios; Guardar persiste con revisión y comprobante.
- `Page` muestra solo «Sólo lectura» o «Guardado por revisar», sin estado del borrador; revisar, reintentar y elegir van
  en el encabezado de la superficie de recuperación. Horarios y demás datos se marcan al intentar guardar y después en
  vivo; Confirmar de una fecha especial queda habilitado y valida al tocarlo solo lo que trae esa fecha: el horario
  semanal se marca al guardar, en su campo.
- Ubicación: `Autocomplete` sobre `Input` (nombre/ciudad → sugerencia → enlace a la ficha), sin modal pequeño de
  coordenadas. Dirección manual antes de buscar; elegir prepara el borrador y Guardar confirma el PlaceId. Atribución de
  Google Maps junto al contenido. Pendientes por instalación: [operación](../../../ArquitecturaBase/docs/guides/configurar-google-places.md).
- Leaflet/OSM: navegar, marcar o ingresar coordenadas genera el enlace, sin búsquedas simuladas.
- Horarios, fechas especiales y FAQ con validación real; los textos anteriores quedan para revisión manual.
  [Detalle](../../../ArquitecturaBase/docs/reviews/2026-10-03-informacion-del-negocio-guiada.md).

### Chat de WhatsApp

- `/whatsapp/chat`: panel con la geometría de Administración, bandeja y conversación en `Surface`, historial y compositor.
  En móvil alterna bandeja y conversación, con «Chats» para volver. Tomar Atención manual requiere Send; activar
  Asistente exige ConfigureAssistant y disponibilidad confirmada. Un envío iniciado puede terminar al tomar Manual.
  Los envíos inciertos se consultan antes de resolverlos. Sin leyendas de atajo ni de intervalo (Ctrl+Enter envía,
  Enter agrega línea, polling de 5 s).
- La línea que separa WhatsApp de Inicio aparece solo si hay un ítem de WhatsApp visible.
- `src/test/visual/whatsapp.spec.ts`; no se actualizan capturas para ocultar diferencias. Reglas:
  [WhatsApp](../../../ArquitecturaBase/docs/features/whatsapp.md#chat-de-atención--2026-10-02).

### Contraste de mensajes y refactor del chat — 2026-10-02

- Recibidos y enviados se distinguen; hora y estado fuera de la burbuja. `MessageHistory`, `MessageBubble` y
  `MessageDateDivider`, sin código ni CSS del laboratorio.
- Tokens `message-*`: fondo `#F0ECE4`, recibidos blancos, salientes `#D9EFCD`, contenido `#203227`, metadatos `#526258`,
  lectura `#126A85`. Fallo e incertidumbre usan roles semánticos. Son independientes de los cuatro colores editables.
- Cola, aceptación, entrega, lectura, fallo, incertidumbre y revisión llevan ícono y texto; lo desconocido no se
  muestra como aceptado. Origin Assistant presenta Asistente y FormAction presenta Automático; Vos y Operador
  conservan al operador real. El modo actual no reconstruye la autoría histórica. Historial:
  [premisas](../guides/premisas-de-desarrollo.md#historial-de-mensajes-2026-10-02).
- Eventos de acceso: misma burbuja, etiqueta «Acceso al sistema», resumen localizado, hora y estado reales; sin código,
  enlace secreto ni recuperación a borrador. Business conserva su texto. Capturas `whatsapp-access-*.png`.

### Formularios por WhatsApp

Los tableros elegidos de la página «Formularios por WhatsApp» (historia completa, Etapa 1 y variantes A–E, P1–P3, C1–C5,
R1–R3), los ajustes G2/G5 de la versión 75 y D2 de la versión 79 reemplazan la maqueta aislada del plan. I1–I3, elegidos
el 2026-10-18 en la versión 85, sustituyen el idioma de E/P1 con original obligatorio y traducción opcional; su
implementación y verificación se distinguen en [el diseño del área](formularios-whatsapp.md). Desde el 2026-10-23 no
tienen selector de idioma ni pares de campos por idioma: cada texto es un solo campo en el idioma del menú, que es el
original de lo nuevo; con el menú en el otro idioma es la traducción, vacía con «Sin traducir» y el original como ayuda
del campo, sin copiarlo. Un error del otro idioma va bajo el mismo campo, con su idioma, y cambiar el idioma del menú con
cambios sin guardar los conserva y muestra la otra traducción (el diseño del PDF, que se reinicia, pide confirmación). Vale también para catálogos, sus campos y los datos de las personas
([idioma del menú](formularios-whatsapp.md#idioma-del-menú-sin-selector--2026-10-23)). D2 reemplaza
el detalle vertical de T3/G4/G5. MF1 y DC0/DC1 ajustado, elegidos el 2026-10-20 con los ajustes de la versión 96, reemplazan la navegación dinámica y la bandeja global: D2 es vista rápida de escritorio y DC1 la pantalla completa, directa en móvil con lectura. H1–H7 y s1–s4 conservan los tableros elegidos del asistente. El botón que abre un
formulario dice siempre «Abrir formulario». La [calificación local del cierre](../../../ArquitecturaBase/docs/features/formularios.md#cierre-local-de-la-etapa-5-y-del-review-de-la-etapa-4)
separa integración, contratos, visuales y navegador de la calificación del proveedor y del piloto físico con Meta.
Capturas, decisiones, alcance, piezas y estado: [formularios-whatsapp.md](formularios-whatsapp.md).

### Inicio: composición assistant-ui corregida — 2026-10-04

- Contrato: capturas originales `assistant-ui-empty/answer` de `design-lab/history/home-assistant-comparison-2026-10-04/evidence`;
  no `chosen-board` ni la integración rechazada (que lo recomponía como formulario).
- El marco ocupa el contenido de `Page` (viewport solo acá). Hilo/editor de 672 px en una columna de 704 px. Vacío:
  bienvenida y editor centrados, sugerencias debajo. Conversando: pregunta a la derecha, respuesta a la izquierda sin
  tarjeta, fuentes tipadas debajo y editor redondeado al pie, con envío por flecha.
- Disponibilidad junto al editor, sin panel exterior ni banda Conversación. Sin adjuntos ni regeneración.
- Vive en `shared/ui/assistant` e `index.css`. Capturas `assistant-*.png`; verificación en el
  [registro de corrección](../verification/inicio-asistente-correccion-2026-10-04.md).

### Inicio: panel de conversaciones (2026-10-05)

Panel claro plegable dentro del marco, con `ThreadList/Item/More` de assistant-ui: 256 px, Nueva conversación, grupos
Hoy/Ayer/Anteriores con la fecha solo en el grupo, filas de una línea, menú «…» en hover/foco (siempre en táctil) y borrado
confirmado. Títulos autorizados por el backend. Inicio abre vacío; una conversación se recupera al elegirla. En móvil,
`Dialog` compartido superpuesto. Capturas `assistant-conversations-*.png`.

## Propuestas abiertas

Sin elección; no se implementan sin ella.

- Contactos, Plantillas y diagnóstico de la conexión de WhatsApp ([propuesta](whatsapp-chat-propuesta.md)); no es el
  contrato del chat productivo.
- Sugerencias de IA (`?screen=sugerencias`). Aprobados: Sugerir con IA como `Button` principal verde y el contexto
  historial + información del negocio. [Plan](../../../ArquitecturaBase/docs/plans/2026-10-03-sugerencias-ia-whatsapp.md).
- Burbujas con forma inspirada en Chatscope (`libraries/shapes.html`): [diseño](whatsapp-bibliotecas-propuesta.md).
- Ubicación por ficha de Maps (`?screen=ubicacion-lugar`): [diseño](ubicacion-por-lugar.md).

## Mapa Artifact → proyecto

| Tablero | Destino | Estado |
| --- | --- | --- |
| Gestión de usuarios, Filtros, Reglas de filtrado | `/usuarios`, `/roles`, `UsersFilterBar` | Implementado |
| Formularios | `FormField`, diálogos | Falta auditar campos fuera de `FormField` |
| Avisos | Toaster y estados comunes | Adopción parcial |
| Anatomía; Encabezados, íconos y color; Las mismas piezas | `index.css`, `shared/ui`, 17 íconos | Implementado; biblioteca pendiente |
| Cómo se sostiene | tokens + componentes + tests | Norma de gobierno |
| Roles (editar, estados, acciones) | `RoleEditorPage`, `RolesPage` | Implementado |
| WhatsApp · Ingreso, Perfil, Usuarios con teléfono | `/login`, `/perfil`, diálogos de usuario | Implementado; mensajes por adoptar |
| WhatsApp · El enlace del chat | `/ingresar` (`Spinner` de 20 px; el tablero, 28) | Compatibilidad: ya no se emiten enlaces |
| WhatsApp · Orientación y mensajes del sistema | backend | Panel 2 desactualizado: Meta aprobó la invitación como Marketing, con otro texto |
| Plantilla · Listado | ejemplo `/usuarios` | Se duplica para cada listado |
| Formularios por WhatsApp | `/formularios`, respuestas, aprobación, diseño PDF y chat | [Diseño y estado de calificación](formularios-whatsapp.md) |
| Casos del asistente | Pantalla Asistente del panel de WhatsApp y el chat | [Tableros elegidos, por programar](asistente-casos.md) |
| Mejoras de catálogos | Editor de catálogos, «Elegir de un catálogo» y las respuestas | [E1 implementado y recorrido local](catalogos-mejoras.md#recorrido-local-de-e1--2026-10-22) |
| Campos extra de catálogos | Editor de catálogos, «Elegir de un catálogo», «Datos de las personas», «Editar usuario» y las respuestas | [E2 implementado; alcance y evidencia](catalogos-campos-extra.md) |
| Documentos por WhatsApp | «Biblioteca», «Lectura de documentos» en el editor, el chat, «Documentos recibidos» y la pestaña «Tablero» | [Tableros elegidos, por programar](documentos.md) |

Pendiente: comprobar el Artifact y sincronizarlo con el estándar local. La nota «Propuesta para aprobar» junto a
«Ingreso con WhatsApp» quedó vieja: sus seis tableros están implementados.

## Pantallas por completar con esta base

Sin ampliar contratos:

1. **Estados responsive y recorridos no cubiertos de todas las áreas:** revisar los tableros externos y completar tablas
   angostas y objetivos táctiles. Cada superficie nueva se dibuja antes de implementarse.
2. Selección y acciones masivas cuando el backend tenga contrato. El tablero usa `<span>`: es referencia visual, no
   implementación aceptable.
3. Inicio autenticado completo, estados 403/404 y marca real.
4. Auditar que ningún campo se dibuje fuera de `FormField` y terminar los avisos.

Dispositivos, sesiones y pantallas sin contrato son de una fase posterior: este fundamento no autoriza inventar endpoints
ni permisos. Verificaciones con API real: [registro compartido](../../../ArquitecturaBase/docs/plans/verificacion-y-produccion.md).

## Comparaciones cerradas

Se compara antes de programar; el laboratorio se borra al decidir.

| Decisión | Resultado |
| --- | --- |
| Colores | **Campo** (2026-10-02), solo colores, sobre Jade |
| Densidad de fila / encabezado | **36 px** / **48 px** sin expandido ni antetítulo |
| Submenú | **Desplegable lateral**; Administración en **carril propio** |
| Rutas al agrupar | **Se quedan** `/usuarios` y `/roles` |
| Conteos por opción de filtro | **Ahora**, con contrato de backend |
| Grupo del menú al entrar | **Plegado salvo el activo** |
| Submenú con barra contraída | **Íconos sueltos** |
| Estado en Usuarios | **Punto** con la palabra para lector de pantalla |
| Acciones de fila | **Un grupo**, rojo al interactuar |
| Paso de página | **Flechas** con nombre completo en `aria-label` |
| Alta y edición de un rol | **Pantalla propia** |
| Chat de Inicio | **assistant-ui** |


## Pendiente de compilación CSS — 2026-10-12

Al verificar el arnés compilado se comprobó que la optimización de Tailwind transforma el reinicio `translate: 0 0` del panel de conversaciones en `transform: translate(0)`, mientras las utilidades del diálogo conservan su traslación individual; el panel móvil queda desplazado. La misma transformación está en `dist`. K7 no cambia el build productivo ni ese diseño. Su corrección queda pendiente del sistema visual; el catálogo de pruebas conserva explícitamente los estilos de desarrollo elegidos, sin actualizar referencias para aceptar la diferencia.

## Menú y detalle de formularios — 2026-10-21

MF1 y DC0/DC1 ajustado de la versión 96 están implementados junto con D2 como vista rápida. El [cierre visual y su evidencia](formularios-whatsapp.md#cierre-local-de-menú-y-detalle--2026-10-21) conserva es/en a 1440/390/320, la distinción Read/Decide y el alcance del visor PDF; las referencias elegidas se mantienen. El piloto real con Meta espera el code review propio.


## Catálogos E2 — 2026-10-23

CE1, CE2, CE3-B, CE4-A y CE5 están implementados según los ajustes elegidos. El [cierre visual](catalogos-campos-extra.md#cierre-local-de-e2--2026-10-23) registra la VRT 719/719, el recorrido es/en a 390/320, datos de personas con extensión neutral, presentación por pregunta y campos históricos. Las referencias elegidas se conservan; CE6 es la guía del circuito y el piloto con Meta espera el review de E2.

## Botones y estados — 2026-10-23

La decisión del usuario del 2026-10-23 (puntos 37 y 38 del review de Catálogos E2) está aplicada en todo el front con
las reglas de [Encabezados](#encabezados), [Íconos y acciones](#íconos-y-acciones) y
[Formularios y diálogos](#formularios-y-diálogos). Piezas comunes: `DisabledReason` da el motivo de un control apagado
como tooltip al pasar el mouse o con el foco y como descripción accesible, nunca en un ítem de menú, que lo conserva
adentro; `Surface` lleva sus acciones al borde derecho de la banda, a la altura del título y también al bajar de renglón;
`Page.status` muestra sólo el estado del objeto. Ninguna pantalla muestra «Cambios sin guardar» ni números de revisión
fuera de los historiales, y una prueba de arquitectura impide que un locale vuelva a ofrecer ese estado; la guarda de
salida sigue avisando. En su lugar, Guardar se apaga sin cambios en todos los editores: roles, IA, apariencia,
configuración, información del negocio, PDF, catálogos y el borrador del formulario. El alta de un formulario, que no
existe hasta guardarla, lo tiene habilitado desde el principio. Se valida al intentar guardar y, después del primer error, en vivo.

Se conservan, con su motivo: los motivos dentro de los menús «⋯», los estados del flujo con su acción (guardado sin
confirmar, revisión pendiente), la espera del chat y de Inicio, los conteos de los encabezados, «Nuevo, sin guardar» de
CE1, los pies de diálogo y la etiqueta «Guardando…» mientras trabaja ([premisas](../guides/premisas-de-desarrollo.md)).

La corrida visual del cierre aprobó 741/741 pruebas. Se revisaron las 29 diferencias de la primera corrida y se actualizaron sólo
esas referencias, todas por esta decisión: `ai-*` (Probar conexión, Reemplazar y Quitar clave en el encabezado de su
superficie, sin estado de la prueba al lado), `appearance-*` (Restaurar en el encabezado de Colores), `editor-*` (Guardar
del rol apagado sin cambios), `profile-*` (Guardar en el encabezado de «Datos del perfil»), `settings-review-320`
(«Revisar valores actuales» en la banda de `Page` y las elecciones en el encabezado de la comparación), y `whatsapp-*`,
`whatsapp-access-*` y `whatsapp-manual-390` (sin el motivo escrito debajo de «Enviar formulario», C1). Se sumaron las
referencias nuevas de CE1 en uso (`catalog-field-in-use-*`). `catalog-*`, `business-information-*`, `settings-*` y
`roles-*` pasaron sin actualizarse. Dos escenas de publicación se ajustaron sin cambiar producto: «Ir a la pregunta» abre la pregunta
en el idioma del menú, y la prueba del tooltip de la espera mueve el puntero en pasos para que Radix lo cierre.

El review del cierre (2026-10-25) encontró que el editor de formularios no cumplía la regla. «Guardar borrador» seguía
habilitado en un formulario guardado sin cambios, y también cuando sólo cambiaban Reglas o Sugerencias, que tienen su
propio Guardar. Se veía en las capturas de 1440 de Reglas y Sugerencias. Ni la corrida de 741 ni el recorrido lo
detectaron: ninguna referencia compara el editor de formularios y sus escenas guardan después de cambiar el borrador.
Se corrigió con su prueba unitaria (`FormsPage.test.tsx`) y se volvieron a tomar esas seis capturas de 1440, donde ahora
está apagado. Las de 390 y 320 no muestran el encabezado de la página y quedan igual.

| Vista | es · 1440 | en · 1440 | es · 390 | en · 390 | es · 320 | en · 320 |
| --- | --- | --- | --- | --- | --- | --- |
| Reglas | [Ver](evidence/botones-y-estados-2026-10-23/reglas-nueva-es-1440.jpg) | [Ver](evidence/botones-y-estados-2026-10-23/reglas-nueva-en-1440.jpg) | [Ver](evidence/botones-y-estados-2026-10-23/reglas-nueva-es-390.jpg) | [Ver](evidence/botones-y-estados-2026-10-23/reglas-nueva-en-390.jpg) | [Ver](evidence/botones-y-estados-2026-10-23/reglas-nueva-es-320.jpg) | [Ver](evidence/botones-y-estados-2026-10-23/reglas-nueva-en-320.jpg) |
| Reglas al guardar | [Ver](evidence/botones-y-estados-2026-10-23/reglas-al-guardar-es-1440.jpg) | [Ver](evidence/botones-y-estados-2026-10-23/reglas-al-guardar-en-1440.jpg) | [Ver](evidence/botones-y-estados-2026-10-23/reglas-al-guardar-es-390.jpg) | [Ver](evidence/botones-y-estados-2026-10-23/reglas-al-guardar-en-390.jpg) | [Ver](evidence/botones-y-estados-2026-10-23/reglas-al-guardar-es-320.jpg) | [Ver](evidence/botones-y-estados-2026-10-23/reglas-al-guardar-en-320.jpg) |
| Sugerencias | [Ver](evidence/botones-y-estados-2026-10-23/sugerencias-motivo-es-1440.jpg) | [Ver](evidence/botones-y-estados-2026-10-23/sugerencias-motivo-en-1440.jpg) | [Ver](evidence/botones-y-estados-2026-10-23/sugerencias-motivo-es-390.jpg) | [Ver](evidence/botones-y-estados-2026-10-23/sugerencias-motivo-en-390.jpg) | [Ver](evidence/botones-y-estados-2026-10-23/sugerencias-motivo-es-320.jpg) | [Ver](evidence/botones-y-estados-2026-10-23/sugerencias-motivo-en-320.jpg) |
| PDF | [Ver](evidence/botones-y-estados-2026-10-23/pdf-es-1440.jpg) | [Ver](evidence/botones-y-estados-2026-10-23/pdf-en-1440.jpg) | [Ver](evidence/botones-y-estados-2026-10-23/pdf-es-390.jpg) | [Ver](evidence/botones-y-estados-2026-10-23/pdf-en-390.jpg) | [Ver](evidence/botones-y-estados-2026-10-23/pdf-es-320.jpg) | [Ver](evidence/botones-y-estados-2026-10-23/pdf-en-320.jpg) |
| IA | [Ver](evidence/botones-y-estados-2026-10-23/ia-es-1440.jpg) | [Ver](evidence/botones-y-estados-2026-10-23/ia-en-1440.jpg) | [Ver](evidence/botones-y-estados-2026-10-23/ia-es-390.jpg) | [Ver](evidence/botones-y-estados-2026-10-23/ia-en-390.jpg) | [Ver](evidence/botones-y-estados-2026-10-23/ia-es-320.jpg) | [Ver](evidence/botones-y-estados-2026-10-23/ia-en-320.jpg) |
| Catálogo nuevo | [Ver](evidence/botones-y-estados-2026-10-23/catalogo-opciones-es-1440.jpg) | [Ver](evidence/botones-y-estados-2026-10-23/catalogo-opciones-en-1440.jpg) | [Ver](evidence/botones-y-estados-2026-10-23/catalogo-opciones-es-390.jpg) | [Ver](evidence/botones-y-estados-2026-10-23/catalogo-opciones-en-390.jpg) | [Ver](evidence/botones-y-estados-2026-10-23/catalogo-opciones-es-320.jpg) | [Ver](evidence/botones-y-estados-2026-10-23/catalogo-opciones-en-320.jpg) |

- **Reglas:** el encabezado tiene sólo «Agregar regla» y Guardar; agregar una regla y una acción no muestra errores. En
  esta captura y en las dos siguientes, «Guardar borrador» está apagado porque el borrador no cambió.
- **Reglas al guardar:** Guardar no envía, marca el mensaje vacío y le da el foco.
- **Sugerencias:** Guardar apagado por un destino dado de baja (BA6), con el motivo como tooltip al enfocar su envoltorio.
- **PDF:** con cambios, junto al título va sólo el formulario; Guardar en «El comprobante» y Vista previa en su superficie. Desde el 2026-10-25 tampoco va el formulario, que queda en la miga: `Page.status` del PDF no se usa.
- **IA:** con cambios, sin «Cambios sin guardar»; las acciones de la clave en el encabezado de su superficie.
- **Catálogo nuevo:** las acciones de «Opciones» al borde derecho; en escritorio el motivo de Importar como tooltip y en
  el celular dentro de los ítems de «⋯».

Las capturas son JPEG nativos de Playwright sobre el catálogo visual, con rutas y componentes productivos, datos y
transporte sintéticos y comprobaciones de geometría, foco y escrituras en cada paso. El recorrido en el navegador integrado,
sobre el mismo catálogo, se hizo con teclado: en un catálogo nuevo a 1440, Tab llega al envoltorio de Pegar desde Excel,
Importar y Exportar con su tooltip, Escape lo cierra sin mover el foco y «⋯» lista los motivos adentro y devuelve el foco
al cerrarse; en Reglas, en inglés, Enter en «Add rule» no muestra errores y Enter en «Save rules» no envía, marca «Fill in
this field.» y enfoca «Add action»; en Sugerencias a 390, Tab desde «Agregar sugerencia» llega a Guardar con el tooltip de
BA6 y su descripción accesible; en IA a 320, en inglés, las tres acciones de la clave quedan al borde derecho sin
desplazamiento horizontal. La biblioteca del Artifact sigue sin sincronizar (`DisabledReason` está en la deuda).
