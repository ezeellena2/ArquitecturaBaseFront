# Fundamento visual de ArquitecturaBaseFront

Estado: **vigente**  
Revisión del Artifact: **2026-09-22** (nueve tableros, exploraciones descartadas eliminadas, más los tres de “Un rol en su propia pantalla”). Aplicado al código en la Fase 5 y en el rol en su propia pantalla; el mapa de abajo dice qué quedó implementado y qué no.  
Procedencia: [Sistema visual — ArquitecturaBase](https://claude.ai/artifact/HPbmDPLnr8JZ9TxevtTqJJ) (Artifact privado de Claude)

## Cómo se usa esta base

El Artifact es el origen visual de esta revisión, pero no puede ser la única fuente: requiere una sesión autorizada y puede evolucionar fuera del historial de Git. Este documento congela sus decisiones aplicables para que Claude, Codex y cualquier persona trabajen con la misma base.

Orden de precedencia:

1. Contratos funcionales y de seguridad del backend, permisos, accesibilidad, i18n y manejo de errores.
2. Este fundamento visual y las decisiones ya codificadas en `src/index.css` y `src/shared/ui`.
3. El Artifact como referencia visual, historial de exploración y fuente de nuevas propuestas.

Una propuesta del Artifact no se considera implementada por estar dibujada. Primero debe pasar por una comparación o revisión, recibir una elección explícita y terminar expresada en tokens, componentes compartidos y tests. No se copia un valor aislado en una pantalla.

## Pantalla nueva: primero el tablero

Una pantalla nueva no arranca en el editor. Arranca como un tablero en el Artifact [Sistema visual — ArquitecturaBase](https://claude.ai/artifact/HPbmDPLnr8JZ9TxevtTqJJ), el mismo que ya agrupa “Gestión de usuarios”, “Filtros”, “Formularios” y “Anatomía”. Un tablero por pantalla y siempre en ese Artifact: no se abre uno nuevo por pantalla ni por fase, porque el valor está en verlas juntas.

El orden no se invierte:

1. Se agrega el tablero al Artifact con la funcionalidad completa dibujada.
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
  - **Una excepción, anotada:** el estado del listado de usuarios es un punto delante del correo, y su palabra va oculta para la vista (`sr-only`) pero no para el lector de pantalla. Se aceptó a cambio de la densidad: liberó la columna que ocupaba el estado —que en casi todas las filas dice lo mismo— para la de roles, que es el dato que hay que mirar fila por fila. Para quien ve, ahí el estado se lee del color. Si vuelve a aparecer este caso, se compara antes de repetirlo: una excepción es una excepción, no un permiso.

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

- El menú lateral tiene **grupos rotulados** (`ADMINISTRACIÓN`) y, dentro, ítems que pueden abrir un **submenú desplegable**. El grupo padre es un `button` con `aria-expanded`; los hijos van indentados, con una guía vertical que los ata al padre.
- **Los submenús viven en el menú lateral, no en pestañas del encabezado.** Se evaluaron pestañas en la banda y se descartaron: obligaban a que el encabezado cambiara de alto según la sección, y dejaban el árbol de navegación repartido en dos lugares.
- **Los grupos arrancan plegados, y el de la ruta activa se despliega solo.** El menú tiene que decir a dónde se puede ir sin listarlo todo siempre; y entrar a `/roles` desde un favorito o recargando tiene que mostrar dónde estás, no un grupo cerrado. El desplegado se calcula durante el render, no con un efecto, así el grupo no aparece plegado y se abre después.
- **Se pliega a mano y no se recuerda entre visitas.** Que quede abierto porque estás parado adentro no es una preferencia; guardarlo convertiría en silencio "plegado salvo el activo" en "siempre abierto" apenas entrás una vez. La barra contraída sí se recuerda, porque eso sí es una decisión sobre el espacio de trabajo.
- Se abre solo el grupo activo. Con varios grupos abiertos el menú se vuelve una lista larga que hay que scrollear, y deja de servir para orientarse.
- **Los hijos van sin ícono**, solo con la sangría y la guía vertical: el ícono del padre ya representa al grupo, y repetirlo en cada hijo empuja el texto casi treinta píxeles a la derecha sin decir nada nuevo. El ícono sigue existiendo en el modelo porque lo usa la barra contraída.
- **Agrupar en el menú no cambia las rutas.** `Gestión de usuarios` agrupa `/usuarios` y `/roles` sin anidar URLs: los enlaces guardados siguen funcionando y el `returnUrl` del ingreso no se toca.
- **Cada hijo conserva su permiso.** Quien tiene uno solo ve un solo hijo; quien no tiene ninguno no ve el grupo. El permiso se pide en la ruta y se repite en la navegación: uno decide si se entra, el otro si se ve.
- Contraída, la barra deja solo los íconos centrados en una caja de 40 px, y el rótulo del grupo se reemplaza por un separador corto. El control para plegarla es un círculo montado sobre el borde derecho, a la altura del primer ítem.
- **Contraída no hay submenús: los hijos suben a la lista como íconos sueltos.** La barra contraída es un lanzador, no un mapa; esconder destinos detrás de un desplegable de 40 px cambiaría un clic por dos. La jerarquía la siguen contando las migas y el menú expandido.

## Íconos y acciones

- Tamaños: 16 px en línea, 18 px en acciones de fila y 20 px en navegación.
- Un único lenguaje: grilla de 24, trazo aproximado de 1.75 y puntas redondeadas.
- El SVG es decorativo (`aria-hidden="true"`); el botón posee el nombre accesible completo y contextual, por ejemplo “Eliminar a ana@ejemplo.com”.
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
- El error del servidor asociado a un campo aparece junto a ese campo; el no asociado aparece encima de la botonera. Nunca se duplica en toast.
- Cancelar queda junto a la primaria, que va última. Una destructiva, si existe, queda separada a la izquierda.
- Mientras guarda, el botón se deshabilita y explica el estado; no se tapa toda la pantalla ni se pierde lo escrito.
- Un formulario breve y contextual se abre en diálogo. Uno largo, seccionado o compartible tiene ruta propia. Un único valor puede editarse en línea.

## Avisos y estados

Cada hecho usa un solo canal:

- **Toast:** éxito ya completado y sin acción pendiente; desaparece solo.
- **Error de formulario:** requiere corrección, permanece y usa `role="alert"`.
- **Confirmación:** aparece antes de una acción irreversible y explica qué se pierde, no pregunta de forma genérica si la persona está segura.
- **Banner persistente:** describe una condición que sigue vigente mientras la pantalla está abierta.

Carga, vacío y error del listado pertenecen a la superficie del listado. Los errores no desaparecen solos, se traducen por `ApiError.code`, ofrecen reintento cuando aplica y muestran el identificador de seguimiento cuando existe.

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
| Avisos | Sonner, errores inline, `ConfirmDialog`, banners | Parcialmente implementado |
| Anatomía | `src/index.css` (tokens) y `shared/ui` | **Implementado**: `--color-surface-header`, `--color-surface-header-border`, `--color-content-heading` y las tres alturas |
| Encabezados, íconos y color | `Page`, superficies, set propio de íconos | **Implementado**: banda adherida (de verdad desde el rol en su propia pantalla, ver “Encabezados”) y 17 íconos propios |
| Las mismas piezas | `shared/ui` (superficie, banda, control) | Contrato adoptado; consolidación incremental |
| Cómo se sostiene | tokens + componentes + tests | Norma de gobierno adoptada |
| Roles · Editar un rol, y Roles · Estados y recorrido | `/roles/nuevo`, `/roles/{id}`, `RoleEditorPage`, `PermissionPicker`, `RoleSummary`, `SegmentedControl`, `useUnsavedChangesGuard`, `useBreadcrumbLeaf` | **Implementado** (2026-09-22) |
| Roles · Acciones del listado | `/roles`, `RolesPage` con `RowActions` y `EyeIcon`: Admin “Ver”, User “Editar”, ninguno “Eliminar” | **Implementado** (2026-09-22), salvo el separador entre Editar y Eliminar, que `RowActions` no dibuja |

Lo que quedó **fuera** de la Fase 5 y sigue sin dibujarse: el responsive (ningún tablero es de menos de 1440 px), el tablero de inicio, las pantallas 403/404 y la marca real. Ver "Pantallas por completar con esta base".

El lienzo tiene hoy nueve tableros. Los de exploración descartada —las variantes de encabezado, el sub-header con pestañas, el carril lateral de submenú y las pantallas previas— se eliminaron al cerrar cada decisión: el Artifact guarda lo vigente, no el historial.

## Pantallas por completar con esta base

Los puntos 1 a 4 de la lista original se hicieron en la **Fase 5** (tokens y primitivas, `Page` como banda adherida, submenú con permiso por hijo, y los filtros con su contrato de backend). Lo que queda, sin ampliar contratos:

1. **Completar estados responsive de usuarios, roles, configuración y perfil.** **Es el hueco más grande del fundamento:** todos los tableros del Artifact son de escritorio (1440 px), así que 320 px, tablas angostas y objetivos táctiles siguen sin dibujarse en ningún lado. La Fase 5 no lo tocó y no hay tablero que copiar: hay que dibujarlo primero.
2. Selección y acciones masivas cuando el backend tenga contrato. **El tablero las muestra con `<span>` en lugar de casillas reales, así que esa parte es referencia visual y no implementación aceptable.**
3. Diseñar inicio, estados 403/404 y marca real.
4. Auditar que ningún campo se dibuje fuera de `FormField`, y terminar los avisos (el tablero de Avisos está parcialmente implementado).

Dispositivos, sesiones y cualquier pantalla sin contrato pertenecen a una fase funcional posterior; el fundamento visual no autoriza inventar endpoints ni permisos.

## Comparaciones cerradas

Cuando una decisión visual tiene más de una salida razonable, se compara antes de programarla y la comparación se tira cuando la decisión se toma. Lo cerrado hasta hoy:

| Decisión | Se comparó | Resultado |
| --- | --- | --- |
| Densidad de fila | 44 px densa contra 56 px cómoda | **44 px**, una sola para todo el proyecto |
| Encabezado de pantalla | respirable / equilibrado / compacto, y con o sin estado expandido | **Banda fija de 56 px**, sin expandido, sin antetítulo |
| Submenú | pestañas en el encabezado / desplegable en el menú / carril lateral propio | **Desplegable en el menú lateral** |
| Rutas al agrupar | anidar `/gestion-usuarios/...` o dejarlas | **Se quedan** `/usuarios` y `/roles` |
| Conteos por opción de filtro | ahora o en una fase posterior | **Ahora**, con el contrato de backend que haga falta |
| Grupo del menú al entrar | abierto por defecto / plegado salvo el activo | **Plegado salvo el activo** |
| Submenú con la barra contraída | íconos sueltos / menú flotante / descontraer la barra | **Íconos sueltos**, sin componente nuevo |
| Estado en el listado de usuarios | columna propia con texto / punto delante del correo | **Punto**, con la palabra para el lector de pantalla, a cambio de la columna de roles |
| Acciones de fila | un grupo con la destructiva última / la destructiva en un grupo aparte | **Un grupo**, con el rojo solo al interactuar |
| Paso de página | botones con texto / flechas | **Flechas**, con el nombre completo en el `aria-label` |
| Alta y edición de un rol | diálogo / pantalla propia | **Pantalla propia** (`/roles/nuevo`, `/roles/{id}`), porque con veinte áreas el diálogo no tiene dónde crecer |

`design-lab/page-header/index.html` fue el soporte de la segunda de esas comparaciones y **ya se eliminó**: hoy no existe ningún laboratorio. Uno vive solo mientras su pregunta está abierta; si se queda, en un mes nadie sabe si es una propuesta vigente o un resto.

## Criterio de finalización de una pantalla

- Usa solamente tokens y componentes compartidos o amplía el sistema de forma deliberada.
- Cubre carga, vacío, error, éxito y falta de permiso cuando correspondan.
- Funciona con teclado, lector de pantalla, zoom y desde 320 px.
- Todo texto visible existe en español e inglés.
- Conserva estado compartible en URL cuando sea una colección.
- Pasa `npm run build`, `npm run lint` y `npm run test`.
