# Fundamento visual de ArquitecturaBaseFront

Estado: **vigente**  
Revisión del Artifact: **2026-09-24** (veintiún tableros: los diez del sistema, los tres de “Un rol en su propia pantalla”, los seis de “Ingreso con WhatsApp” y las dos plantillas; las exploraciones descartadas se eliminaron). Aplicado al código en la Fase 5, en el rol en su propia pantalla y en el ingreso con WhatsApp; el mapa de abajo dice qué quedó implementado y qué no.  
Procedencia: [Sistema visual — ArquitecturaBase](https://claude.ai/artifact/HPbmDPLnr8JZ9TxevtTqJJ) (Artifact privado de Claude)  
Biblioteca de piezas: [ArquitecturaBase UI](https://claude.ai/artifact/Ew763kqorVHSYeUqE8CZ7h) (Artifact privado de Claude, instalada en el lienzo del sistema visual)

## Escala, tema y forma (2026-09-28)

### Jade equilibrado aprobado (2026-09-30)

El usuario eligió explícitamente **Jade equilibrado** después de comparar Salvia, Jade y Bosque
en el laboratorio de verdes. Esta paleta reemplaza los colores anteriores de esta sección y del
resto del documento. Conserva las medidas, la tipografía y el comportamiento de las pantallas.

Los tonos viven en `@theme` y los alias de controles en `:root` de `src/index.css`. Se asignan
por función; no hay selectores por ruta ni adaptadores de color del laboratorio en producción.

| Zona | Tokens | Tono |
| --- | --- | --- |
| Menú principal | `nav-surface`, `nav-foreground`, `nav-muted`, `nav-hover`, `nav-accent` | `#194f3a`, `#edf7f0`, `#bed5c5`, `#2b6049`, `#b9dfc5` |
| Panel secundario | `subnav-surface`, `subnav-hover` | `#eef5ef`, `#d9eadf` |
| Barra superior, incluido el acceso público | `topbar-surface`, `topbar-foreground`, `topbar-muted`, `topbar-border` | `#dcecdf`, `#254c38`, `#4f6b58`, `#b4cdbb` |
| Encabezado de pantalla | `page-header` | `#f2f7f3` |
| Encabezado de tabla y bandas de superficie | `surface-header`, `content-heading` | `#d0e5d5`, `#254c38` |
| Barra de filtros | `filter-surface` | `#eaf3ec` |
| Campos y selectores | `control-surface`, `control-border` | `#f8fcf9`, `#6f947b` |
| Superficies y bordes | `canvas`, `surface`, `surface-muted`, `border` | `#fff`, `#fff`, `#eef5ef`, `#b4cebc` |
| Texto y acciones | `content`, `content-muted`, `brand-600`, `brand-500` | `#202d26`, `#5c6d62`, `#176b4c`, `#338260` |

Los nombres de la tabla llevan el prefijo `--color-`. Éxito, atención y peligro conservan sus
roles semánticos. Los contextos `navigation-surface`, `subnavigation-surface` y `topbar-surface`
se aplican una vez en los layouts; los portales usan el tema global. `Page` aplica la cabecera,
`TableHeader` y `TableHead` el encabezado común de todas las tablas, y `FilterBar` la superficie
de filtros de usuarios y permisos. `Input`, `Textarea`, `Select`, `MultiSelect` y `NativeSelect`
comparten el fondo y borde de control; el foco, la validación y el estado deshabilitado conservan
sus señales. Una pantalla futura compone estas piezas y hereda Jade automáticamente.

Ajustes posteriores aprobados del menú (2026-09-30): los botones del borde para contraer/expandir
el menú y cerrar Administración tienen fondo blanco e ícono verde. Administración, Gestión de
usuarios, Usuarios, Roles y permisos y Configuración muestran los íconos del modelo común de
`layouts/navigation.ts`, de 16 px y decorativos; los textos mantienen sus nombres accesibles.
La lista compartida conserva los íconos también en submenús y en móvil. Esto reemplaza el criterio
anterior de ocultar íconos en los hijos del menú.
El panel secundario mide 224 px para que los rótulos sigan entrando con los íconos. Los ítems
conservan 30 px como alto mínimo y los nombres largos pueden ocupar más de una línea, también
en los grupos anidados del cajón móvil.

`shared/ui/theme.test.ts` comprueba contraste de texto, controles y foco. La integración se revisó
en las pantallas reales de roles, usuarios, configuración y perfil con datos simulados; el laboratorio
`design-lab/green-theme/`, sus variantes y sus adaptadores se eliminaron al cerrar la elección.

**Sincronización externa pendiente:** la revisión automática de permisos rechazó abrir la biblioteca
privada de Claude porque la solicitud autorizaba cambios locales y no el acceso a ese artefacto
externo. La fuente operativa vigente es este documento y el código compartido. Antes de usar nuevos
tableros, sincronizar los tokens Jade, `FilterBar`, `NativeSelect` y las superficies del layout en
[ArquitecturaBase UI](https://claude.ai/artifact/Ew763kqorVHSYeUqE8CZ7h), con autorización explícita.

### Editor de roles: tabla con secciones desplegables (2026-09-30)

El usuario aprobó continuar directamente en el front a partir de la maqueta `editor-roles.html`,
ajustada con sus referencias y su revisión posterior: una sola tabla enmarcada con encabezado común
  y secciones desplegables, siguiendo el estándar del listado de Usuarios.
Esta decisión reemplaza el editor anterior con panel lateral y resumen de permisos.

- Datos del rol arriba, sin tarjeta ni banda propia. Descripción debajo de Nombre, con ancho máximo
  de 672 px. Las restricciones de Admin y User siguen vigentes, sin insignia "Del sistema" ni aclaración
  de que el nombre no cambia.
- Filtros en una barra con borde, espaciado y controles como `UsersFilterBar`, separada de la tabla.
- Una sola tabla con los primitivos compartidos de `shared/ui/table`, borde exterior y encabezados
  Permiso, Descripción y Asignado una sola vez. Cada área es un `tbody` con nombre accesible mediante
  `aria-labelledby`, abierto o cerrado; los checks individuales y por sección se alinean al final.
- El checkbox de sección admite vacío, parcial y completo. Actúa sobre toda el área, también cerrada
  o filtrada; no modifica otras áreas. Admin muestra los checks deshabilitados.
- Se conservan búsqueda, filtro Elegidos, expandir/contraer, guardado, validaciones y confirmación al salir.
  El resumen lateral deja de montarse: la selección se consulta en la misma tabla.
- En móvil la tabla conserva un ancho mínimo de 520 px con scroll horizontal contenido. `Page` acomoda
  título, estado y acciones en filas, sin quedar adherido, para no tapar controles en pantallas angostas.
- Verificado en navegador a 1440, 1024, 390 y 320 px, con datos simulados y sin escrituras reales.

### Acceso público aprobado (2026-09-30)

Para bienvenida, ingreso, registro y verificación, prevalece la maqueta interactiva
`acceso-maqueta.html` revisada en Codex y aprobada explícitamente por el usuario antes de programar.
La revisión explícita del usuario del 30/09 extiende su paleta a toda la aplicación; conserva los layouts
existentes y no autoriza el rediseño pendiente del editor de roles.

- `/` muestra la bienvenida sin sesión y conserva el tablero para quien ya ingresó. `/login` y
  `/registro` distinguen intención, textos y formulario; cada uno tiene su paso `/codigo`.
- Tema claro en toda la aplicación: blanco `#fff`, fondo secundario `#f4f6f5`, texto `#202724`, texto secundario
  `#65716b`, borde `#dde4df`, acción verde `#176b4c`. Tokens en `index.css`, alcance
  global en `@theme` y `:root`, incluidos los controles en portales; `color-scheme: light`.
- Public Sans, título de formulario 30 px (28 en móvil),
  cuerpo 14 px, formulario de 400 px como máximo. Controles de 44/46 px y radio de 5 px.
- Una superficie, sin tarjeta alrededor del formulario. Cabecera solo con los accesos,
  pie con idioma, selector de correo/WhatsApp subrayado y con íconos Lucide visibles.
- La portada muestra solo Crear cuenta e Iniciar sesión, también en la cabecera. Se retiraron la marca
  visible, el texto introductorio y la vista previa con datos de ejemplo, por pedido del usuario.
- El registro pide nombre solo para crear una cuenta por código. Google aporta su propio nombre.
  Carga, fallo con reintento, registro cerrado, cuenta existente, código vencido y bloqueos conservan
  las reglas reales del backend. La existencia de una cuenta se informa después de verificar identidad.
- No se publican los enlaces ficticios de Privacidad/Ayuda del prototipo: requieren contenido real.
- Pruebas: recorridos con MSW y verificación en Chrome a 1440, 390 y 320 px, español e inglés.

Esta revisión reemplaza la paleta oscura anterior; las medidas de administración siguen vigentes.

**Esta sección manda sobre cualquier medida, color o forma que diga el resto del documento.** Nació de una
comparación contra Vercel y DigitalOcean: lo que hacía que esto se viera como una plantilla generada no era
la paleta, era que todo estaba una talla más grande de lo que usa una herramienta de trabajo, y que arriba de
eso había una capa de adornos que aparecen en cualquier panel. Los tableros están en el Artifact, bajo "Que no
parezca una plantilla: la escala".

- **La aplicación es clara y verde.** Canvas y superficies son blancos; `surface-muted` y las líneas
  delimitan agrupaciones sin sombras. `<html>` no lleva `class="dark"`.
- **El color de acción es verde:** `-50` y `-100` son fondos suaves, `-700` el texto que va encima,
  y `-600` el relleno con `--color-brand-ink` blanco.
- **La escala de texto baja una talla entera**, redefiniendo `--text-*` en `@theme`: la interfaz se lee en
  14 px (`text-sm`). Se define globalmente para que ingreso y administración compartan legibilidad.
- **Las medidas:** barra superior 48, menú 220 (56 contraído), panel de Administración 224, ítem de menú 30 como mínimo,
  botón 30 (26 el chico), control de formulario 30, fila de tabla 36, encabezado de tabla 32.
- **Las esquinas casi no se redondean:** 5 px en un control (`--radius-control`) y 6 px en una tarjeta
  (`--radius-card`). El redondeo de 8 y 12 px en todo, del más chico al más grande, es lo que hace que
  cualquier panel se parezca a cualquier otro.
- **Nada lleva sombra.** La profundidad la dan el escalón de luz y una línea de 1 px. Quedan las de los
  popovers, que sí flotan.
- **Lo que se fue, uno por uno:** el cuadrado de color donde iría el logo (ahora la marca es el nombre
  retirado también del menú y del ingreso), la banda tintada del encabezado de pantalla, el ícono de la sección
  metido en un cuadradito (la prop `icon` de `Page` ya no existe), los íconos de cada ítem del menú
  expandido —quedan solo para la barra contraída, que sin ellos no tendría nada que mostrar—, las versalitas
  con espaciado de los rótulos, las pastillas redondas de estado y los avatares circulares.
- **El ítem activo del menú se marca con una barra de 2 px de la marca y el peso de la tipografía**, no con
  una pastilla celeste. La pastilla tintada era el único lugar donde aparecía el color de marca en toda la
  pantalla, y eso lo convertía en decoración.
- **La tipografía es Public Sans** (`@fontsource-variable/public-sans`), no Inter: está dibujada para
  formularios y aguanta 13 px mejor. Las tablas llevan figuras tabulares por CSS, para que las columnas de
  números no se desalineen.

Lo que queda pendiente de esta revisión: la pantalla de roles sigue mostrando el selector de permisos como un
componente enorme con áreas de ejemplo, que no se parece a nada que exista en un producto real. Eso no lo
arregla la escala: hay que volver a dibujar esa pantalla.

## Datos en tablas (2026-09-30)

Cada dato adicional de un listado lleva su propia columna y encabezado; no se agrega como insignia al
nombre ni se mezcla con otro dato en su celda. En el listado de roles se omite "Del sistema": la columna
Rol muestra solo el nombre. Las restricciones de edición y borrado de Admin y User siguen vigentes.
Esta decisión prevalece sobre las composiciones anteriores de tablas; otros listados se adaptan cuando
se revisan.

## Organización y mensajes (2026-09-30)

Por pedido explícito del usuario, las pantallas se organizan por tarea, con menú por tema,
cabecera clara, datos pertinentes y controles elegidos según el dato. Configuración se diseña
con destinos separados para Idioma, Zona horaria, Listados y Registro; el tablero está en revisión
y esas rutas todavía no están implementadas. No se promueve el formulario que reunía todos los temas.

Los resultados, errores generales, warning e info van al único Toaster **abajo a la derecha**.
La validación de campo queda junto al campo; confirmar una decisión usa ConfirmDialog.
Una carga fallida reemplaza el contenido con su estado de recuperación; no deja un formulario
aparentemente utilizable. El contrato completo de ubicación, duración, acciones y duplicación
está en el [contrato transversal de mensajes](../guides/mensajes-y-estados.md).
Estas decisiones sustituyen los criterios anteriores de organización y mensajes. La adaptación
de código existente no se da por realizada por estar documentada. El [plan auditado de unificación](../plans/2026-09-30-unificacion-mensajes.md)
incluye todas las pantallas y los controles que deberán impedir una política distinta por feature.

## Cómo se usa esta base

Las [premisas de desarrollo del front](../guides/premisas-de-desarrollo.md) convierten este diseño en
reglas de implementación para filtros, tablas, formularios, selección, botones, modales y mensajes.
Las notificaciones transitorias tienen una ubicación común aprobada: **abajo a la derecha**,
con el único `Toaster` global definido en `shared/ui/sonner.tsx`.

El Artifact es el origen visual de esta revisión, pero no puede ser la única fuente: requiere una sesión autorizada y puede evolucionar fuera del historial de Git. Este documento congela sus decisiones aplicables para que Claude, Codex y cualquier persona trabajen con la misma base.

Orden de precedencia:

1. Contratos funcionales y de seguridad del backend, permisos, accesibilidad, i18n y manejo de errores.
2. Este fundamento visual y las decisiones ya codificadas en `src/index.css` y `src/shared/ui`.
3. El Artifact como referencia visual, historial de exploración y fuente de nuevas propuestas.

Una propuesta del Artifact no se considera implementada por estar dibujada. Primero debe pasar por una comparación o revisión, recibir una elección explícita y terminar expresada en tokens, componentes compartidos y tests. No se copia un valor aislado en una pantalla.

## Pantalla nueva: primero el tablero

Una pantalla nueva no arranca en el editor. Arranca como un tablero en el Artifact [Sistema visual — ArquitecturaBase](https://claude.ai/artifact/HPbmDPLnr8JZ9TxevtTqJJ), el mismo que ya agrupa “Gestión de usuarios”, “Filtros”, “Formularios” y “Anatomía”. Un tablero por pantalla y siempre en ese Artifact: no se abre uno nuevo por pantalla ni por fase, porque el valor está en verlas juntas.

El orden no se invierte:

1. Se agrega el tablero al Artifact con la funcionalidad completa dibujada, **arrancando de una plantilla** (hoy, “Plantilla · Listado”) y **armado con las piezas de la biblioteca**, no dibujado a mano (ver “La biblioteca de piezas”).
2. El usuario lo mira y elige. Sin elección explícita no se programa.
3. Recién ahí se escribe el código, y lo elegido termina en tokens, componentes compartidos y tests.

El tablero no es un dibujo lindo: dice **cómo se comporta** la pantalla. Antes de programar tiene que mostrar, cuando corresponda:

- el layout con datos y la acción primaria;
- carga, vacío de “no hay datos” y vacío de “no hay coincidencias”;
- el error del listado o del formulario, con reintento cuando aplica;
- qué se ve y qué no se ve sin permiso;
- el recorrido completo: diálogos, confirmaciones y a dónde vuelve cada salida;
- qué vive en la URL (página, tamaño, búsqueda, orden, filtros).

Esa lista es, a propósito, la misma que pide el “Criterio de finalización de una pantalla” al cerrar. Lo que no está dibujado se termina decidiendo sobre el teclado, con el costo ya pagado, y así es como una ruta deja de parecerse al resto. Si el tablero la cubre, cerrar la pantalla es implementar, no rediseñar.

Al terminar, la pantalla suma su fila al mapa Artifact → proyecto y se actualiza la revisión del encabezado de este documento.

## La biblioteca de piezas

Hasta el 2026-09-22 cada tablero dibujaba sus botones, campos y tablas a mano, con colores sueltos, y por eso dos tableros nunca salían iguales ni iguales al código. Desde el 2026-09-23 el lienzo tiene instalada la biblioteca [ArquitecturaBase UI](https://claude.ai/artifact/Ew763kqorVHSYeUqE8CZ7h): las piezas de `src/shared/ui` y de `src/layouts`, con los mismos nombres, medidas y tokens, que un tablero monta en vez de redibujar (`<x-import component-from-global-scope="AB.Button" variant="outline">`).

- **Una pantalla nueva se arma, no se dibuja.** Se duplica la plantilla que corresponde y se cambian la entidad, las columnas y los filtros. Lo que la plantilla ya resuelve (dónde va la acción primaria, los vacíos, el error, qué pasa sin permiso, los diálogos) no se vuelve a decidir.
- **Cada pieza tiene su gemela en el código**, y su ficha lo dice (“En el código: `shared/ui/button.tsx`”). Pasar un tablero al código es traducir pieza por pieza, no interpretar un dibujo.
- **Un cambio de aspecto se hace en la biblioteca y en `shared/ui` a la vez.** Nunca solo en un tablero, y nunca solo en el código: si divergen, los tableros vuelven a mentir.
- **Las fuentes viven en el Artifact de la biblioteca**, en `components/src/` (un `.jsx` por grupo, sus estilos en `css/` y `build.mjs`). `node build.mjs <carpeta del front>` regenera el paquete con el rolldown del front; después se vuelven a copiar `bundle.js`, `bundle.css`, `index.d.ts` y `tokens.json` al lienzo, en `project/ds/ab/`. Los pasos están en `components/src/COMO-SE-ARMA.txt`.

Piezas de la biblioteca que **todavía no existen en `shared/ui`** y hay que subir cuando una pantalla las use:

| Pieza | Dónde vive hoy |
| --- | --- |
| `FilterSelect`, `MoreFilters`, `FilterChip` | `features/users/components/UsersFilterBar.tsx` |
| `StatusDot` | `emailCell` en `features/users/columns.tsx` |
| `Avatar` | repetido en `Sidebar.tsx` y `UserMenu.tsx`, cada uno con su `initialOf` |
| `Surface` | un `div` suelto en `UsersPage.tsx` |

`FormError` general se retira de las piezas a promover: el párrafo repetido en formularios es
un desvío a migrar al aviso operativo común, no una pieza nueva de la biblioteca. Se conservan
los errores de campo/grupo y los estados del contenido conforme al contrato de mensajes.

Y al revés: piezas y cambios que **ya están en `shared/ui` y todavía no están en la biblioteca**. La regla dice que un cambio de aspecto va a los dos lados a la vez; esto es deuda, y mientras exista los tableros que usen estas piezas van a dibujarlas distinto de como se ven:

| Pieza o cambio | De dónde salió |
| --- | --- |
| Paleta Jade, contextos de navegación y barra superior, cabeceras de `Page` y tabla, controles con fondo; `FilterBar` y `NativeSelect` compartidos | elección explícita del usuario, 2026-09-30; ver sincronización externa pendiente arriba |
| `Banner` (`info`, `warning`, `danger`) | ingreso con WhatsApp, Tareas 14 y 16 |
| `RadioGroupField` | ingreso con WhatsApp, Tarea 16 |
| `VerificationBadge` | ingreso con WhatsApp, Tareas 14 y 16 |
| `PhoneField` y `OtpInput` (ahora en `shared/ui`) | ingreso con WhatsApp, Tareas 7 y 14 |
| `SegmentedControl` con `fullWidth`, y entero (es nuevo) | ingreso con WhatsApp, Tarea 7; rol en pantalla propia, Tarea 2 |
| `CheckboxField` con `error`, y como fila del selector | ingreso con WhatsApp, Tarea 16; rol en pantalla propia, Tarea 6 |
| `Spinner` con `decorative` | ingreso con WhatsApp, Tarea 12 |
| Íconos: `Mail`, `Smartphone`, `Check`, `Info`, `AlertCircle`, `AlertTriangle`, `Clock`, `Ban`, `Eye` | ingreso con WhatsApp, Tareas 12, 14 y 16; rol en pantalla propia, Tarea 8 |
| Tokens `--color-success-50`, `--color-success-700`, `--color-warning-50`, `--color-warning-700` | ingreso con WhatsApp, Tareas 14 y 16 |
| `Page` con `backTo` y `status`; `ConfirmDialog` con `cancelLabel`; `EmptyState` con `className` y `descriptionClassName`; el caparazón en `h-svh` con `main` `relative`; las migas de cuatro niveles | rol en pantalla propia, Tarea 6 |
| Íconos `CheckCheck` (las dos tildes de "Entregada" y "Leída") y `Send` (el avión de la invitación); token `--color-danger-700` ("No llegó" en letra chica sobre `surface-muted`) | tablero "Editar usuario · B", la franja de la última invitación (ingreso con WhatsApp, Tareas 15 y 16). El tablero los dibuja a mano: SVG sueltos y el rojo crudo en `.st.bad` |

## Principios del sistema

- **Un sistema, no una colección de pantallas.** La coherencia nace de piezas compartidas, no de volver a resolver cada ruta.
- **Una sola superficie.** Contenido principal, tabla, diálogo, formulario y estado vacío usan fondo blanco, borde de 1 px y radio de 12 px. No existen tarjetas visualmente distintas para cada caso.
- **Una banda de superficie.** Encabezados de tabla, formulario, diálogo y panel comparten tratamiento. El token previsto es `--color-surface-header`, con más contraste que `surface-muted`.
- **Tres alturas.** 32 px para acciones de ícono, 36 px para controles y 44 px para filas densas. La densidad es una decisión del proyecto, no de cada pantalla.
- **Cuatro estados.** Normal, hover, seleccionado y foco usan los mismos roles semánticos en navegación, tablas y listas.
- **Cinco niveles tipográficos.** Título de pantalla, título de sección, cuerpo/dato, texto secundario y rótulo. Un sexto nivel requiere ampliar el sistema, no un tamaño suelto.
- **Seis pasos de espacio.** 4, 8, 12, 16, 24 y 40 px. Como guía: 8 entre controles, 16 dentro de superficies y 24 entre secciones.
- **La marca significa acción.** `brand` se reserva para acciones, selección y foco. Éxito, atención y peligro conservan sus propios roles; el peligro se usa solo para consecuencias destructivas.
- **El color nunca comunica solo.** Todo estado lleva texto, ícono accesible o ambos.
  - **Una excepción, anotada:** el estado del listado de usuarios es un punto delante del correo, y su palabra va oculta para la vista (`sr-only`) pero no para el lector de pantalla. Se aceptó a cambio de la densidad: liberó la columna que ocupaba el estado —que en casi todas las filas dice lo mismo— para la de roles, que es el dato que hay que mirar fila por fila. Para quien ve, ahí el estado se lee del color: verde para activo y rojo para inactivo. Las acciones conservan solo íconos (check para habilitar y encendido para deshabilitar), con nombre accesible y tooltip; las dos abren confirmación antes de cambiar el acceso (2026-09-30). Si vuelve a aparecer este caso, se compara antes de repetirlo: una excepción es una excepción, no un permiso.

## Encabezados

Solo hay tres niveles:

1. **Pantalla:** uno por ruta, con ícono, título y acción primaria.
2. **Superficie:** abre tabla, formulario, diálogo o panel.
3. **Grupo:** rotula una lista sin caja, como una sección del menú lateral.

**El encabezado de pantalla está decidido** (2026-09-21, elección explícita del usuario sobre el Artifact):

- Es una **banda fija de 56 px**, adherida bajo la barra superior, con el tono de `--color-surface-header` y su borde inferior. **No tiene estado expandido:** se ve igual al entrar que después de scrollear, porque es chrome de la sección y no una portada.
  - **Adherida de verdad recién desde el rol en su propia pantalla (2026-09-22).** La Fase 5 la dio por implementada, pero la raíz de `AppLayout` era `min-h-svh`: crecía con el contenido, el que scrolleaba era el documento y la banda se iba con el resto, en todas las pantallas. Con la raíz en `h-svh` scrollea `<main>`, y la barra superior y la banda se quedan arriba. jsdom no maqueta, así que ningún test lo había visto: se comprobó en un navegador.
- Lleva **ícono de la sección** (32 px, radio 8), el **título de la pantalla abierta** en el nivel *título de sección*, y la **acción primaria** a la derecha. La acción es la de la pantalla activa: en Usuarios dice "Nuevo usuario"; en Roles, "Nuevo rol".
- **Una pantalla hija cambia el ícono por el botón de volver** (`backTo` en `Page`): 32 px, con borde y la flecha a la izquierda, que vuelve a la sección de la que cuelga y dice a dónde en su nombre accesible (“Volver a Roles y permisos”). Al lado del título puede llevar un estado que no es parte del nombre (`status`): la insignia “Del sistema”, o “· Cambios sin guardar” en gris.
- **Sin antetítulo y sin descripción.** El antetítulo se evaluó y se descartó: el grupo ya se lee en el menú lateral y en las migas, y un tercer lugar diciendo lo mismo no agrega orientación.
- **Las migas se quedan** en la barra superior, con los tres niveles (`Inicio / Gestión de usuarios / Usuarios`). Al no haber antetítulo, no hay duplicación que resolver.
- **Las migas de una ruta hija tienen cuatro niveles**, con el padre como enlace y como hoja lo que la pantalla está editando (`Inicio / Gestión de usuarios / Roles y permisos / Soporte`). La hoja la pone la pantalla (`useBreadcrumbLeaf`), porque solo ella sabe cómo se llama; mientras no la pone, el padre queda último y sin marcar como página actual.

El peso tipográfico se mantiene en 600. El laboratorio proponía 680, que sería un sexto nivel: el sistema tiene cinco y ampliarlo requiere una decisión deliberada, no un ajuste de una pantalla.

Con esto, `design-lab/page-header/index.html` cumplió su función y **ya se eliminó**.

## Navegación

- El menú lateral lista arriba las pantallas del día a día y cierra abajo con **Administración**, separada por una línea. Un ítem puede abrir un **submenú desplegable**: el padre es un `button` con `aria-expanded`, y los hijos van indentados, con una guía vertical que los ata al padre. Un grupo rotulado (`ADMINISTRACIÓN` en versalitas) sigue siendo posible para lo que se use todos los días; Administración ya no lo usa.
- **Administración abre un panel propio al lado del menú** (264 px, `--color-surface-muted` con su banda de cabecera), con la misma lista de siempre adentro: el desplegable `Gestión de usuarios` y `Configuración`. Se abre solo en cualquier ruta de administración y se cierra al salir de la sección; mientras estás adentro se cierra y se abre a mano, con el mismo botón o con la flecha «‹» montada sobre el borde del panel. Con el panel abierto se esconde la flecha de contraer el menú: las dos viven a la misma altura sobre bordes contiguos y juntas se leen como un círculo partido. Viene del menú de ArquitecturaBaseMultitenant y reemplaza al grupo rotulado que Administración tenía (2026-09-28).
- **En el teléfono no hay panel:** el cajón ya ocupa la pantalla, así que Administración se despliega adentro como cualquier grupo, y sus pantallas quedan a tres niveles.
- **Los submenús viven en el menú lateral, no en pestañas del encabezado.** Se evaluaron pestañas en la banda y se descartaron: obligaban a que el encabezado cambiara de alto según la sección, y dejaban el árbol de navegación repartido en dos lugares.
- **Los grupos arrancan plegados, y el de la ruta activa se despliega solo.** El menú tiene que decir a dónde se puede ir sin listarlo todo siempre; y entrar a `/roles` desde un favorito o recargando tiene que mostrar dónde estás, no un grupo cerrado. El desplegado se calcula durante el render, no con un efecto, así el grupo no aparece plegado y se abre después.
- **Se pliega a mano y no se recuerda entre visitas.** Que quede abierto porque estás parado adentro no es una preferencia; guardarlo convertiría en silencio "plegado salvo el activo" en "siempre abierto" apenas entrás una vez. La barra contraída sí se recuerda, porque eso sí es una decisión sobre el espacio de trabajo.
- Se abre solo el grupo activo. Con varios grupos abiertos el menú se vuelve una lista larga que hay que scrollear, y deja de servir para orientarse.
- **Los hijos conservan su ícono** (revisión explícita del 2026-09-30), junto con la sangría y la guía vertical. El mismo modelo de navegación abastece el panel de Administración, sus submenús, el cajón móvil y la barra contraída.
- **Agrupar en el menú no cambia las rutas.** `Gestión de usuarios` agrupa `/usuarios` y `/roles` sin anidar URLs: los enlaces guardados siguen funcionando y el `returnUrl` del ingreso no se toca.
- **Cada hijo conserva su permiso.** Quien tiene uno solo ve un solo hijo; quien no tiene ninguno no ve el grupo. El permiso se pide en la ruta y se repite en la navegación: uno decide si se entra, el otro si se ve.
- Contraída, la barra deja solo los íconos centrados en una caja de 40 px, y el rótulo del grupo se reemplaza por un separador corto. El control para plegarla es un círculo montado sobre el borde derecho, a la altura del primer ítem.
- **Contraída no hay submenús: los hijos suben a la lista como íconos sueltos.** La barra contraída es un lanzador, no un mapa; esconder destinos detrás de un desplegable de 40 px cambiaría un clic por dos. La jerarquía la siguen contando las migas y el menú expandido. **Administración es la excepción**, y por la misma razón: contraída sigue siendo un botón, porque lo que abre no es un desplegable de 40 px sino el panel entero.

## Íconos y acciones

- Tamaños: 16 px en línea, 18 px en acciones de fila y 20 px en navegación.
- Un único lenguaje: grilla de 24, trazo aproximado de 1.75 y puntas redondeadas.
- El SVG es decorativo (`aria-hidden="true"`); el botón posee el nombre accesible completo y contextual, por ejemplo “Eliminar a ana@ejemplo.com”.
- Todo control de acción sin texto usa `ActionTooltip` (2026-09-30), compartido por tablas, navegación, paginación, filtros y cierres. Aparece con hover y foco, cierra con Escape, permite pasar el puntero a la ayuda y ajusta su posición a los bordes. El contenido vive en un portal: los grupos segmentados y contenedores con scroll no lo recortan. Se reemplazó la implementación CSS local porque `overflow-hidden` ocultaba las ayudas de las filas. Un solo `TooltipProvider` gobierna el recorrido; el contenido se monta solo mientras está abierto. Los textos llegan traducidos desde el namespace de cada módulo, también cuando explican un botón deshabilitado. Los botones con texto visible no necesitan repetirlo en un tooltip.
- Una acción de fila muestra tooltip al hover y al foco. Las inocuas van primero y la destructiva, última y separada. El rojo aparece al interactuar, no como ruido permanente.
- Una acción sin permiso no se renderiza. No se deja deshabilitada sin una explicación alcanzable por teclado.
- No se usan emoji como iconografía de producto.

## Listados y filtros

- Un solo buscador de texto libre, siempre visible y con debounce.
- Hasta tres filtros frecuentes junto al buscador; los restantes viven en un panel avanzado con contador de filtros aplicados.
- Página, tamaño, búsqueda, orden y filtros viven en la URL. Cambiar búsqueda, orden o filtro vuelve a la página 1.
- Los filtros activos siempre se ven como chips removibles y existe una única acción “Limpiar todo”.
- El vacío distingue entre “no hay datos” y “no hay coincidencias”; en el segundo caso explica cuántos filtros hay y permite limpiarlos.
- Las opciones muestran el conteo esperado antes de elegirlas; una opción con cero resultados queda indisponible.
- Búsqueda y filtros rápidos aplican sin botón; el panel avanzado aplica el conjunto una sola vez.
- El backend filtra, ordena y pagina. El frontend no simula resultados sobre una página parcial.
- Selección masiva usa checkboxes nativos o semánticamente equivalentes con nombre accesible. El prototipo revisado no los exponía en el árbol de accesibilidad, por lo que esa parte es referencia visual, no implementación aceptable.

## Formularios y diálogos

- La etiqueta va arriba y nunca depende del placeholder.
- El control mide 36 px; su ancho responde al contenido y el formulario es de una columna salvo pares cortos relacionados.
- La ayuda ocupa el mismo renglón que reemplaza el error, evitando saltos de layout.
- `FormField` vincula etiqueta, control, ayuda/error, `aria-invalid` y `aria-describedby`; ningún formulario productivo dibuja un campo por fuera de esa pieza sin una razón documentada.
- Se valida al enviar. Después del primer error se valida en vivo mientras se corrige.
- El error del servidor asociado a un campo aparece junto al campo; el error general de una operación
  usa el Toaster abajo a la derecha. No se duplica ni agrega un cartel encima de la botonera.
- Cancelar queda junto a la primaria, que va última. Una destructiva, si existe, queda separada a la izquierda.
- Mientras guarda, el botón se deshabilita y explica el estado; no se tapa toda la pantalla ni se pierde lo escrito.
- Un formulario breve y contextual se abre en diálogo. Uno largo, seccionado o compartible tiene ruta propia. Un único valor puede editarse en línea.

## Avisos y estados

Cada hecho usa un solo canal:

- **Toast:** éxito, error operativo, warning e info, abajo a la derecha. Si necesita una acción,
  permanece hasta resolverla o cerrarlo; no cambia de canal por originarse en un formulario.
- **Error de campo:** requiere corregir un dato y permanece junto a su control.
- **Confirmación:** aparece antes de una decisión y explica su consecuencia.
- **Estado de contenido:** carga, falta de datos, falta de permiso o imposibilidad de cargar;
  ocupa la superficie que todavía no puede usarse. No es un banner de resultado.

Cada hecho tiene un solo dueño y un canal. El detalle, duración y recuperación siguen las
[contrato común](../guides/mensajes-y-estados.md). La deuda de consumidores y pruebas está en
el [plan de unificación](../plans/2026-09-30-unificacion-mensajes.md).

## Responsive y accesibilidad mínimos

**Ningún tablero del Artifact cubre todavía esta sección.** Todos están dibujados a 1440 px, así que lo de abajo es un contrato escrito pero no dibujado: cómo se ve una tabla de cinco columnas en 320 px, dónde va la acción primaria cuando la banda no entra y cómo se navega el submenú en el cajón de móvil son decisiones que siguen abiertas. Hasta que se dibujen, cada pantalla las va a resolver por su cuenta, que es exactamente lo que este documento existe para evitar.

- Todas las rutas deben funcionar desde 320 px hasta escritorio sin contenido esencial recortado.
- Lo que hace el puntero también lo hace el teclado; el foco siempre es visible.
- Cada control tiene nombre accesible y los cambios asincrónicos importantes se anuncian.
- Tablas anchas usan una estrategia explícita: scroll contenido con indicación, reducción de columnas o representación apilada. Nunca fuerzan scroll horizontal de toda la página.
- Los objetivos táctiles mantienen al menos 44 × 44 px en móvil, aunque la representación visual sea más compacta.
- Español e inglés conservan la misma jerarquía sin depender de longitudes fijas.

## Mapa Artifact → proyecto

| Tablero | Destino local | Estado |
| --- | --- | --- |
| Gestión de usuarios | `/usuarios`, `/roles`, `AppLayout`, `Sidebar`, `Page` | **Implementado** (Fase 5) |
| Filtros | `shared/hooks/useFilters`, `features/users/components/UsersFilterBar` | **Implementado** (Fase 5), con `GET /api/users/filter-counts` detrás |
| Reglas de filtrado | las mismas piezas, más `DataTable` (vacío con filtros) | **Implementado** (Fase 5) |
| Formularios | `FormField`, diálogos, perfil y configuración | Implementado; auditar que ningún campo se dibuje fuera de `FormField` |
| Avisos | Toaster global, errores de campo/grupo, ConfirmDialog y estados de contenido | **Contrato vigente, adopción parcial.** Sonner y las piezas existen; errores generales inline y usos de Banner están inventariados para migración. Emisor común y controles automáticos pendientes en el plan del 2026-09-30 |
| Anatomía | `src/index.css` (tokens) y `shared/ui` | **Implementado**: `--color-surface-header`, `--color-surface-header-border`, `--color-content-heading` y las tres alturas |
| Encabezados, íconos y color | `Page`, superficies, set propio de íconos | **Implementado**: banda adherida (de verdad desde el rol en su propia pantalla, ver “Encabezados”) y 17 íconos propios |
| Las mismas piezas | `shared/ui` (superficie, banda, control) | Contrato adoptado; consolidación incremental |
| Cómo se sostiene | tokens + componentes + tests | Norma de gobierno adoptada |
| Roles · Editar un rol, y Roles · Estados y recorrido | `/roles/nuevo`, `/roles/{id}`, `RoleEditorPage`, `PermissionPicker`, `RoleSummary`, `SegmentedControl`, `useUnsavedChangesGuard`, `useBreadcrumbLeaf` | **Implementado** (2026-09-22) |
| Roles · Acciones del listado | `/roles`, `RolesPage` con `RowActions` y `EyeIcon`: Admin “Ver”, User “Editar”, ninguno “Eliminar” | **Implementado** (2026-09-22). El separador entre Editar y Eliminar, desde el 2026-09-23: el `border-0` de cada botón de `RowActions` le ganaba al `divide-x` del grupo |
| WhatsApp · Ingreso en la web | `/login` con el selector Correo \| WhatsApp (`EmailCodeForm`, `WhatsAppCodeForm`, `PhoneField`, `SegmentedControl` con `fullWidth`) y `/login/codigo` con `OtpInput` | **Implementado** (2026-09-23) |
| WhatsApp · El enlace del chat | `/ingresar`, `LoginLinkPage`, `ClockIcon`, `BanIcon`, `Spinner` `decorative` | **Implementado** (2026-09-23). El `Spinner` mide 20 px y el tablero lo dibuja de 28 |
| WhatsApp · Conversaciones con el bot | **backend:** `Application/Resources/Bot.resx` y `Bot.en.resx`, `HandleInboundMessageCommandHandler` | **Implementado** (2026-09-23). No es una pantalla: son los textos del chat, uno por fila de la tabla del bot. El código sumó variantes sin nombre que el tablero no dibuja |
| WhatsApp · Mensajes que manda el sistema | **backend:** las plantillas de Meta (`codigo_ingreso`, `invitacion_acceso`) y `Infrastructure/Emails/Templates/Invitation.html` | **Implementado** (2026-09-24). **El panel 2 quedó desactualizado:** dibuja el texto con el que la invitación se presentó como Utilidad, y Meta la aprobó recién como Marketing, con otro texto |
| WhatsApp · Perfil: correo y WhatsApp | `/perfil` con sus dos superficies, `LoginMethodsCard`, `VerifyDestinationDialog`, `UnlinkWhatsAppDialog`, `Banner`, `VerificationBadge`, el aviso de `DashboardPage` | **Implementado** (2026-09-24), con las diferencias anotadas en la Tarea 14 del plan (el número con guion, el pie de los diálogos sin banda gris, el aviso del inicio con 8 px de radio y llevando a Mi perfil). El tablero dibuja un solo diálogo por acción; el código usa **uno** para las dos, con dos configuraciones |
| WhatsApp · Usuarios: alta con teléfono | `/usuarios`, `columns.tsx`, `UserFormDialog` (alta), `UserEditDialog` (edición), `UnlinkUserWhatsAppDialog`, `RadioGroupField`, `VerificationBadge` | **Implementado** (2026-09-24). **Sin dibujar y por lo tanto sin programar:** el estado de la última invitación y el botón de reenviarla, que el backend ya expone (`lastInvitation.deliveryStatus`) |
| Plantilla · Listado (y sus estados y recorrido) | el punto de partida de todo listado; su ejemplo es `/usuarios` | **Plantilla** (2026-09-23), armada con la biblioteca. No es una pantalla nueva: se duplica para las que vengan |

Lo que quedó **fuera** de la Fase 5 y sigue sin dibujarse: el responsive (ningún tablero es de menos de 1440 px), el tablero de inicio, las pantallas 403/404 y la marca real. Ver "Pantallas por completar con esta base".

El lienzo tiene hoy veintiún tableros. **Una nota del lienzo quedó vieja:** la que acompaña a “Ingreso con WhatsApp” todavía dice “Propuesta para aprobar: todavía no hay nada programado”, y los seis tableros están implementados. Los de exploración descartada —las variantes de encabezado, el sub-header con pestañas y las pantallas previas— se eliminaron al cerrar cada decisión: el Artifact guarda lo vigente, no el historial. El carril lateral volvió, ya no como exploración: los dos tableros del menú con el panel de Administración (escritorio y teléfono) son los vigentes de esta sección.

## Pantallas por completar con esta base

Los puntos 1 a 4 de la lista original se hicieron en la **Fase 5** (tokens y primitivas, `Page` como banda, submenú con permiso por hijo, y los filtros con su contrato de backend), salvo que la banda recién quedó adherida de verdad con el rol en su propia pantalla (ver “Encabezados”). Lo que queda, sin ampliar contratos:

1. **Completar estados responsive de usuarios, roles, configuración y perfil.** **Es el hueco más grande del fundamento:** todos los tableros del Artifact son de escritorio (1440 px), así que 320 px, tablas angostas y objetivos táctiles siguen sin dibujarse en ningún lado. La Fase 5 no lo tocó y no hay tablero que copiar: hay que dibujarlo primero.
2. Selección y acciones masivas cuando el backend tenga contrato. **El tablero las muestra con `<span>` en lugar de casillas reales, así que esa parte es referencia visual y no implementación aceptable.**
3. Diseñar inicio, estados 403/404 y marca real.
4. Auditar que ningún campo se dibuje fuera de `FormField`, y terminar los avisos (el tablero de Avisos está parcialmente implementado).

Dispositivos, sesiones y cualquier pantalla sin contrato pertenecen a una fase funcional posterior; el fundamento visual no autoriza inventar endpoints ni permisos.

## Comparaciones cerradas

Cuando una decisión visual tiene más de una salida razonable, se compara antes de programarla y la comparación se tira cuando la decisión se toma. Lo cerrado hasta hoy:

| Decisión | Se comparó | Resultado |
| --- | --- | --- |
| Tonalidades de verde por zona | Salvia suave / Jade equilibrado / Bosque intenso, con ajuste por zona | **Jade equilibrado**, global en tokens, layouts y componentes compartidos (2026-09-30) |
| Densidad de fila | 44 px densa contra 56 px cómoda | **44 px**, una sola para todo el proyecto |
| Encabezado de pantalla | respirable / equilibrado / compacto, y con o sin estado expandido | **Banda fija de 56 px**, sin expandido, sin antetítulo |
| Submenú | pestañas en el encabezado / desplegable en el menú / carril lateral propio | **Desplegable en el menú lateral**, y desde 2026-09-28 **un carril lateral propio para Administración**: lo que estaba adentro del desplegable pasó al panel, y el desplegable quedó para los grupos de adentro |
| Rutas al agrupar | anidar `/gestion-usuarios/...` o dejarlas | **Se quedan** `/usuarios` y `/roles` |
| Conteos por opción de filtro | ahora o en una fase posterior | **Ahora**, con el contrato de backend que haga falta |
| Grupo del menú al entrar | abierto por defecto / plegado salvo el activo | **Plegado salvo el activo** |
| Submenú con la barra contraída | íconos sueltos / menú flotante / descontraer la barra | **Íconos sueltos**, sin componente nuevo. Administración no: contraída abre el panel, que es el ancho entero |
| Estado en el listado de usuarios | columna propia con texto / punto delante del correo | **Punto**, con la palabra para el lector de pantalla, a cambio de la columna de roles |
| Acciones de fila | un grupo con la destructiva última / la destructiva en un grupo aparte | **Un grupo**, con el rojo solo al interactuar |
| Paso de página | botones con texto / flechas | **Flechas**, con el nombre completo en el `aria-label` |
| Alta y edición de un rol | diálogo / pantalla propia | **Pantalla propia** (`/roles/nuevo`, `/roles/{id}`), porque con veinte áreas el diálogo no tiene dónde crecer |

Los laboratorios de encabezado y de verdes **ya se eliminaron** al cerrar sus comparaciones. Un laboratorio vive solo mientras su pregunta está abierta; si se queda, en un mes nadie sabe si es una propuesta vigente o un resto.

## Criterio de finalización de una pantalla

- Usa solamente tokens y componentes compartidos o amplía el sistema de forma deliberada.
- Cubre carga, vacío, error, éxito y falta de permiso cuando correspondan.
- Funciona con teclado, lector de pantalla, zoom y desde 320 px.
- Todo texto visible existe en español e inglés.
- Conserva estado compartible en URL cuando sea una colección.
- Pasa `npm run build`, `npm run lint` y `npm run test`.


## Configuración general (2026-09-30)

Diseño y plan precedieron al desarrollo; el pedido explícito del usuario autorizó su implementación.
Configuración agrupa Idioma, Zona horaria, Listados y Registro en el menú de Administración. Cada
ruta tiene una cabecera Page con título del tema, estado de cambios y Guardar/Descartar; el cuerpo
solo contiene su ajuste, sin una tarjeta alrededor de un único campo ni formularios acumulados.

Selectores nativos para idioma/zona/tamaño y RadioGroupField para el registro. La confirmación
explica el efecto del registro; la guarda común decide antes de perder un borrador. Un conflicto
presenta una tabla corta del valor actual y el propio. Los errores operativos, success, warning e
info van al Toaster abajo a la derecha; campos inválidos junto al control. Un resultado incierto
se consulta antes de permitir otro envío o descartar a ciegas.

Se verificaron los componentes productivos en navegador a 1280 y 320 px, con API simulada solo
para la revisión visual. La persistencia, autorización y caché se verificaron por integración real.
El laboratorio se retiró al promoverlo. Evidencia:

- [Aviso de guardado incierto](evidence/2026-09-30-configuracion-error.jpg).
- [Formulario a 320 px](evidence/2026-09-30-configuracion-movil.jpg).

Esta entrega no completa la migración de mensajes de otras pantallas; sigue el
[plan transversal](../plans/2026-09-30-unificacion-mensajes.md).
