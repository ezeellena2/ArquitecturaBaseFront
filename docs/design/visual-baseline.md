# Fundamento visual de ArquitecturaBaseFront

Estado: **vigente**  
Revisión del Artifact: **2026-09-21** (nueve tableros, exploraciones descartadas eliminadas)  
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

## Encabezados

Solo hay tres niveles:

1. **Pantalla:** uno por ruta, con ícono, título y acción primaria.
2. **Superficie:** abre tabla, formulario, diálogo o panel.
3. **Grupo:** rotula una lista sin caja, como una sección del menú lateral.

**El encabezado de pantalla está decidido** (2026-09-21, elección explícita del usuario sobre el Artifact):

- Es una **banda fija de 56 px**, adherida bajo la barra superior, con el tono de `--color-surface-header` y su borde inferior. **No tiene estado expandido:** se ve igual al entrar que después de scrollear, porque es chrome de la sección y no una portada.
- Lleva **ícono de la sección** (32 px, radio 8), el **título de la pantalla abierta** en el nivel *título de sección*, y la **acción primaria** a la derecha. La acción es la de la pantalla activa: en Usuarios dice "Nuevo usuario"; en Roles, "Nuevo rol".
- **Sin antetítulo y sin descripción.** El antetítulo se evaluó y se descartó: el grupo ya se lee en el menú lateral y en las migas, y un tercer lugar diciendo lo mismo no agrega orientación.
- **Las migas se quedan** en la barra superior, con los tres niveles (`Inicio / Gestión de usuarios / Usuarios`). Al no haber antetítulo, no hay duplicación que resolver.

El peso tipográfico se mantiene en 600. El laboratorio proponía 680, que sería un sexto nivel: el sistema tiene cinco y ampliarlo requiere una decisión deliberada, no un ajuste de una pantalla.

Con esto, `design-lab/page-header/index.html` cumplió su función y se elimina.

## Navegación

- El menú lateral tiene **grupos rotulados** (`ADMINISTRACIÓN`) y, dentro, ítems que pueden abrir un **submenú desplegable**. El grupo padre es un `button` con `aria-expanded`; los hijos van indentados, con una guía vertical que los ata al padre.
- **Los submenús viven en el menú lateral, no en pestañas del encabezado.** Se evaluaron pestañas en la banda y se descartaron: obligaban a que el encabezado cambiara de alto según la sección, y dejaban el árbol de navegación repartido en dos lugares.
- Se abre solo el grupo activo. Con varios grupos abiertos el menú se vuelve una lista larga que hay que scrollear, y deja de servir para orientarse.
- **Agrupar en el menú no cambia las rutas.** `Gestión de usuarios` agrupa `/usuarios` y `/roles` sin anidar URLs: los enlaces guardados siguen funcionando y el `returnUrl` del ingreso no se toca.
- **Cada hijo conserva su permiso.** Quien tiene uno solo ve un solo hijo; quien no tiene ninguno no ve el grupo. El permiso se pide en la ruta y se repite en la navegación: uno decide si se entra, el otro si se ve.
- Contraída, la barra deja solo los íconos centrados en una caja de 40 px, y el rótulo del grupo se reemplaza por un separador corto. El control para plegarla es un círculo montado sobre el borde derecho, a la altura del primer ítem.

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
| Gestión de usuarios | `/usuarios`, `/roles`, `AppLayout`, `Sidebar`, `PageHeader` | Pantalla de referencia; pendiente de implementar |
| Filtros | futuro `shared/hooks/useFilters` y barra de filtros compartida | Pendiente, requiere filtros nuevos en el backend |
| Reglas de filtrado | las mismas piezas, más `DataTable` (vacío con filtros) | Pendiente |
| Formularios | `FormField`, diálogos, perfil y configuración | Implementado; auditar que ningún campo se dibuje fuera de `FormField` |
| Avisos | Sonner, errores inline, `ConfirmDialog`, banners | Parcialmente implementado |
| Anatomía | `src/index.css` (tokens) y `shared/ui` | Contrato adoptado; falta `--color-surface-header` y unificar alturas |
| Encabezados, íconos y color | `PageHeader`, superficies, set propio de íconos | Encabezado decidido; set de íconos por completar |
| Las mismas piezas | `shared/ui` (superficie, banda, control) | Contrato adoptado; consolidación incremental |
| Cómo se sostiene | tokens + componentes + tests | Norma de gobierno adoptada |

El lienzo tiene hoy nueve tableros. Los de exploración descartada —las variantes de encabezado, el sub-header con pestañas, el carril lateral de submenú y las pantallas previas— se eliminaron al cerrar cada decisión: el Artifact guarda lo vigente, no el historial.

## Pantallas por completar con esta base

Prioridad sugerida, sin ampliar contratos del backend:

1. Consolidar tokens y primitivas: `--color-surface-header` y un `RowActions` compartido. **Las tres alturas ya se respetan** — se auditó el 2026-09-21: `Input` y `Button` por defecto son `h-9` (36 px), `Button size="sm"` es `h-8` (32) y `TableHead` es `h-10` (40). El único tamaño fuera de la escala es `Button size="lg"` (40), que no se usa en ninguna pantalla y viene del archivo generado por shadcn.
2. Promover el encabezado decidido a `PageHeader`, y hacer que `main` sea el contenedor que scrollea para que la banda pueda adherirse.
3. Submenú desplegable en el menú lateral, con permiso por hijo.
4. Filtros de listado: primero el contrato del backend, después `useFilters` y la barra compartida.
5. Completar estados responsive de usuarios, roles, configuración y perfil. **Es el hueco más grande del fundamento actual:** todos los tableros del Artifact son de escritorio, así que 320 px, tablas angostas y objetivos táctiles todavía no están dibujados en ningún lado.
6. Selección y acciones masivas cuando el backend tenga contrato.
7. Diseñar inicio, estados 403/404 y marca real.

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

`design-lab/page-header/index.html` fue el soporte de la segunda de esas comparaciones y ya no tiene función: se elimina. Un laboratorio vive solo mientras su pregunta está abierta; si se queda, en un mes nadie sabe si es una propuesta vigente o un resto.

## Criterio de finalización de una pantalla

- Usa solamente tokens y componentes compartidos o amplía el sistema de forma deliberada.
- Cubre carga, vacío, error, éxito y falta de permiso cuando correspondan.
- Funciona con teclado, lector de pantalla, zoom y desde 320 px.
- Todo texto visible existe en español e inglés.
- Conserva estado compartible en URL cuando sea una colección.
- Pasa `npm run build`, `npm run lint` y `npm run test`.
