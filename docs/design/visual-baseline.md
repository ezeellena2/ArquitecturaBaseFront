# Fundamento visual de ArquitecturaBaseFront

Estado: **vigente**  
Revisión del Artifact: **2026-09-21**  
Procedencia: [Sistema visual — ArquitecturaBase](https://claude.ai/artifact/HPbmDPLnr8JZ9TxevtTqJJ) (Artifact privado de Claude)

## Cómo se usa esta base

El Artifact es el origen visual de esta revisión, pero no puede ser la única fuente: requiere una sesión autorizada y puede evolucionar fuera del historial de Git. Este documento congela sus decisiones aplicables para que Claude, Codex y cualquier persona trabajen con la misma base.

Orden de precedencia:

1. Contratos funcionales y de seguridad del backend, permisos, accesibilidad, i18n y manejo de errores.
2. Este fundamento visual y las decisiones ya codificadas en `src/index.css` y `src/shared/ui`.
3. El Artifact como referencia visual, historial de exploración y fuente de nuevas propuestas.

Una propuesta del Artifact no se considera implementada por estar dibujada. Primero debe pasar por una comparación o revisión, recibir una elección explícita y terminar expresada en tokens, componentes compartidos y tests. No se copia un valor aislado en una pantalla.

## Pantalla nueva: primero el tablero

Una pantalla nueva no arranca en el editor. Arranca como un tablero en el Artifact [Sistema visual — ArquitecturaBase](https://claude.ai/artifact/HPbmDPLnr8JZ9TxevtTqJJ), el mismo que ya agrupa “Pantalla completa”, “Tabla”, “Filtros” y “Flujo · Nuevo usuario”. Un tablero por pantalla y siempre en ese Artifact: no se abre uno nuevo por pantalla ni por fase, porque el valor está en verlas juntas.

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

1. **Pantalla:** uno por ruta, con título, descripción breve y acción primaria.
2. **Superficie:** abre tabla, formulario, diálogo o panel.
3. **Grupo:** rotula una lista sin caja, como una sección del menú lateral.

El Artifact propone reemplazar las migas redundantes por un antetítulo contextual, aumentar el contraste tipográfico y compactar el encabezado al hacer scroll sin perder la acción primaria. Esa dirección todavía es una candidata: se compara en `design-lab/page-header/index.html` antes de tocar `PageHeader`.

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

- Todas las rutas deben funcionar desde 320 px hasta escritorio sin contenido esencial recortado.
- Lo que hace el puntero también lo hace el teclado; el foco siempre es visible.
- Cada control tiene nombre accesible y los cambios asincrónicos importantes se anuncian.
- Tablas anchas usan una estrategia explícita: scroll contenido con indicación, reducción de columnas o representación apilada. Nunca fuerzan scroll horizontal de toda la página.
- Los objetivos táctiles mantienen al menos 44 × 44 px en móvil, aunque la representación visual sea más compacta.
- Español e inglés conservan la misma jerarquía sin depender de longitudes fijas.

## Mapa Artifact → proyecto

| Tablero revisado | Destino local | Estado |
| --- | --- | --- |
| Pantalla completa | `/usuarios`, `AppLayout`, `Sidebar`, `Topbar` | Implementado parcialmente |
| Encabezado nuevo / Encabezado de pantalla | `shared/ui/PageHeader` | En comparación; no promovido |
| Flujo · Nuevo usuario | `features/users/components/UserFormDialog` | Flujo existente; revisar detalle visual |
| Tabla | `shared/ui/DataTable` y futuras acciones masivas | Tabla existente; selección masiva pendiente |
| Las mismas piezas / Anatomía | `src/index.css` y `shared/ui` | Contrato adoptado; consolidación incremental |
| Filtros / Reglas de filtrado | futuro `shared/hooks/useFilters` y toolbar compartida | Pendiente |
| Cómo se sostiene | tokens + componentes + tests | Norma de gobierno adoptada |
| Encabezados, íconos y color | `PageHeader`, superficies, set de íconos | Parcial; set propio pendiente |
| Avisos | Sonner, errores inline, `ConfirmDialog`, banners | Parcialmente implementado |
| Formularios | `FormField`, diálogos y páginas de perfil/configuración | Implementado; auditar cobertura |

## Pantallas por completar con esta base

Prioridad sugerida, sin ampliar contratos del backend:

1. Elegir y promover un encabezado común.
2. Consolidar superficie, banda de encabezado y alturas en tokens/componentes.
3. Completar toolbar y filtros URL-driven de listados.
4. Añadir selección y acciones masivas cuando el backend tenga contrato.
5. Diseñar inicio, estados 403/404 y marca real.
6. Completar estados responsive y accesibles de usuarios, roles, configuración y perfil.

Dispositivos, sesiones y cualquier pantalla sin contrato pertenecen a una fase funcional posterior; el fundamento visual no autoriza inventar endpoints ni permisos.

## Flujo `variant`

La primera ronda compara únicamente el encabezado de `/usuarios` sobre el eje **densidad**:

| Variante | Posición del eje | Adecuada cuando | Costo |
| --- | --- | --- | --- |
| Respirable | Máximo aire y jerarquía | La llegada a la sección necesita contexto | Consume más altura antes de los datos |
| Equilibrado | Jerarquía y eficiencia parejas | La pantalla mezcla orientación y trabajo frecuente | No maximiza ninguno de los extremos |
| Compacto | Máxima densidad operativa | El listado se usa muchas veces por día | La descripción pierde protagonismo |

Ejecución local:

```text
npm run dev
http://localhost:5173/design-lab/page-header/index.html?variant=equilibrado
```

El selector preserva la variante en `?variant=`, usa flechas para recorrer y teclas `1`–`3` para saltar. El laboratorio replica el contexto completo pero no importa código productivo ni es importado por él; por eso no entra al build. Tras una elección explícita se implementa la ganadora en `shared/ui/PageHeader` y se elimina el laboratorio.

## Criterio de finalización de una pantalla

- Usa solamente tokens y componentes compartidos o amplía el sistema de forma deliberada.
- Cubre carga, vacío, error, éxito y falta de permiso cuando correspondan.
- Funciona con teclado, lector de pantalla, zoom y desde 320 px.
- Todo texto visible existe en español e inglés.
- Conserva estado compartible en URL cuando sea una colección.
- Pasa `npm run build`, `npm run lint` y `npm run test`.
