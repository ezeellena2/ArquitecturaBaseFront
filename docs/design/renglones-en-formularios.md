# Renglones en los formularios: tableros elegidos

Fecha: **2026-11-04**, con los tableros dibujados del 2026-11-02 al 2026-11-04. Estado: **por programar**. El alcance, el
modelo y las etapas están en el [plan](../../../ArquitecturaBase/docs/plans/2026-11-03-renglones-en-formularios.md); las
pantallas, los textos y los estados salen de acá.

Origen: el lienzo provisorio [Formularios desde la app](https://claude.ai/artifact/Kvbr5KFJrGT951JLiu8i4M), filas
«Formularios · renglones · 0» a «· 8» (RG0 a RG6 en la versión 55; RG7 y RG8, al final, en las versiones 79 y 82). Se armó aparte porque el
[Sistema visual](https://claude.ai/artifact/HPbmDPLnr8JZ9TxevtTqJJ) no se abre desde la cuenta de Claude Code: se volvió a
probar el 2026-11-04 y dio «artifact not found». Los tableros elegidos pasan a ese lienzo cuando se pueda abrir, y mientras
tanto vale el provisorio. Como el lienzo es privado y puede cambiar fuera de Git, este documento congela lo elegido.

## Cómo leer los tableros

- Están dibujados a mano en escritorio, con la raíz al 75 % y los colores de `src/index.css`. Cada parte se arma con su
  pieza de `src/shared/ui` (tabla abajo), no copiando el dibujo.
- Los círculos numerados son notas del tablero, explicadas en la columna de la derecha, como «Para comparar» en las opciones.
  No son UI.
- El ejemplo es el remito 0003-00004521 de «Recepción de insumos» (INS), con el proveedor «Agroinsumos del Litoral S.A.» y
  el campo «SAN JULIAN». RG1 a RG5 tienen tres artículos y un «Precio (US$)» de ejemplo que el formulario real no tiene;
  RG0, RG6 y RG7 usan el formulario real, con «Unidad» y «Observaciones» en cada renglón, y RG0, las respuestas reales
  INS-000001 a INS-000004.
- Algunos tableros se dibujaron antes de reglas que ya están programadas (PL2-A, LR1-A, NI2-C, OE1-A y las líneas entre
  columnas). Donde difieren vale la regla, como dice [lo que se fijó al registrar](#lo-que-se-fijó-al-registrar).

## Las elecciones

El usuario eligió las recomendadas: RG1-A a RG6-A el 2026-11-03, y RG7-A y RG8-A el 2026-11-04. Descartó RG1-B, una sección que se
repite, que necesitaba antes los títulos de sección; RG2-B, una tabla de lectura con un diálogo por renglón; RG3-B, una sola
pantalla de renglón y la lista de lo cargado, con intercambio cifrado con Meta; RG4-B, una fila por renglón en la planilla y
en el Excel; RG5-B, elegir «algún» o «todos» en cada condición y contar renglones; RG6-B, volver a crear adentro del bloque
las preguntas que ya existen, y RG6-C, una zona «Carga múltiple» con la lista para marcar; RG7-B, que WhatsApp cargue los
renglones que entran y publicar avise, y RG7-C, frenar como hoy con 16 KB; RG8-B, la pregunta del mínimo 0 al final de la
pantalla anterior, y RG8-C, que WhatsApp cargue siempre al menos un renglón. RG0 no tenía opciones.

| Tablero | Qué define |
| --- | --- |
| **RG0 · El remito, hoy y con renglones** | Hoy el remito se cargó como cuatro respuestas, INS-000001 a INS-000004, con «Mantener las respuestas para la siguiente»: proveedor, remito, fecha y campo se repiten en cada una, la planilla y «Formularios» cuentan artículos como si fueran remitos, la observación «3 bolsas rotas en la descarga» es de la urea y no del remito, y las reglas corren una vez por artículo. Con renglones es una sola respuesta, INS-000005, con cuatro renglones: lo de arriba se escribe una vez, la observación va en su renglón, y las reglas, la aprobación y el PDF corren una vez. Las cuatro de antes quedan como están, con «—» en «Artículos» y sus columnas viejas al final de la planilla. |
| **RG1-A · Un tipo de pregunta «Renglones»** (elegida) | «Agregar pregunta» suma «Renglones» al final de los tipos, con su ícono; si el formulario ya tiene un bloque, se apaga y su motivo dice «Ya hay un bloque de renglones.». En la lista, el bloque es una fila más («5 · Artículos» y, debajo, «Renglones · de 1 a 20 · 5 preguntas») con ↑ ↓, el lápiz y el tacho, y un recuadro con sus preguntas numeradas 5.1, 5.2…, que se mueven con ↑ ↓ dentro del bloque, y su propio «Agregar pregunta» en la banda «Preguntas de cada renglón». El lápiz abre el editor del bloque: el nombre («Artículos», que titula la tabla, la columna de la planilla y la hoja del Excel), la ayuda y, bajo «Renglones», el mínimo y el máximo, con la (i) del máximo (RG7-A). Con el bloque abierto, la vista previa muestra la pantalla de un renglón en WhatsApp. Un bloque nuevo arranca con 1 y 20; el mínimo va de 0 al máximo, con 0 el bloque es opcional, y el máximo llega hasta 100. Lo que no cambia: un solo bloque por formulario, sus preguntas cuentan para el máximo de 40, guardar el borrador admite un bloque sin preguntas y cambiar el tipo de una pregunta del bloque crea otra. Al publicar, un bloque sin preguntas va en «Problemas» con «Agregá al menos una pregunta al bloque.». |
| **RG6-A · «Se carga varias veces», una casilla en cada pregunta** (elegida) | En el editor de cada pregunta, debajo de «Obligatoria», la casilla «Se carga varias veces», con su (i): «Se carga una vez por renglón, en la tabla del bloque.». Fotos y documentos no la tienen. Las marcadas se juntan en el bloque; si no hay, lo crea en el lugar de la primera, llamado «Renglones» hasta que el autor le ponga otro nombre. Desmarcar una la saca del bloque y la deja justo después de él; el «Agregar pregunta» de adentro del bloque sigue. Una pregunta que ya existía pasa como pregunta nueva y lo cargado antes conserva su columna: «Publicar» lo dice en una fila de «Qué se publica», «Pasan a renglones» («Artículo, Cantidad, Unidad, ¿Llegó en buen estado?, Observaciones»), en lugar de mostrarlas como quitadas y agregadas. |
| **RG2-A · Una tabla para cargar los renglones** (elegida) | En la página «Nueva respuesta», el bloque ocupa el renglón entero de «Datos», donde lo puso el autor, con su nombre como etiqueta. Cada renglón es una fila con su número a la izquierda; cada pregunta, una columna con su etiqueta arriba, y al final van ↑ ↓ y el tacho en rojo, que quita sin preguntar, como un archivo. Si no entra, la tabla se desplaza de costado dentro de su caja, y el texto largo es una celda que crece con lo escrito. La tabla arranca con el mínimo de renglones. «Agregar renglón», al pie, suma uno vacío y lleva el foco a su primera pregunta; con el máximo se apaga y dice por qué («Hasta 20 renglones.»), y con el mínimo el tacho se apaga y dice por qué. Al enviar, cada renglón se valida como una pregunta suelta (obligatorias, tipo, largo y que la opción siga disponible): la celda con un error se marca en rojo, el mensaje va debajo de su renglón con el nombre de la pregunta («Cantidad: completá esta respuesta.»), el foco va a la primera y los renglones no cambian de orden. Si faltan renglones, lo dice debajo de la tabla: «Agregá al menos 1 renglón.». En el panel junto a la planilla (CW2-B) y en el celular, cada renglón va en su recuadro, con «Renglón 2», ↑ ↓ y «Quitar» en la banda y las preguntas una debajo de otra; número y fecha siguen angostos, y en el celular «Agregar renglón» va al pie de los recuadros y Enviar sigue fijo abajo. «Mantener las respuestas para la siguiente» conserva también los renglones; los archivos, no. Como hoy, salir con algo cargado pide confirmar, una versión nueva o la baja avisan arriba sin perder lo cargado y un reintento no duplica la respuesta. |
| **RG3-A · WhatsApp: una pantalla por renglón, hasta 10** (elegida) | Al publicar, el Flow suma una pantalla por renglón, hasta 10 o el máximo del bloque si es menor. La primera pantalla tiene lo de antes del bloque; cada renglón, sus preguntas y el número en el título («Artículos · renglón 2»), y al final va lo de después del bloque con «Enviar». Desde el mínimo, cada renglón termina con «¿Agregás otro renglón?», sí o no, obligatoria: con «Sí» sigue el renglón siguiente; con «No», lo de después del bloque o, si no hay, «Enviar». El último renglón no pregunta. La flecha de WhatsApp vuelve al renglón anterior, para corregirlo o para decir «No». Con un máximo mayor que 10, «Avisos» lo dice sin frenar («Artículos · En WhatsApp se cargan hasta 10 renglones; el máximo es 20.», con «Ir a la pregunta») y en la app se sigue cargando hasta el máximo. Antes de enviar no se ve la lista con los nombres de los artículos: el Flow no muestra el texto de una opción elegida en otra pantalla. Llega como una respuesta más, con sus renglones y su canal, y las preguntas de cada renglón siguen los límites de cada componente, como hoy. |
| **RG7-A · El tope de la respuesta: con renglones, 64 KB como con archivos** (elegida) | Al publicar se suma lo más largo que podría mandar cada pregunta, contando cada carácter como 6 bytes, y si no entra frena: 16 KB, o 64 KB si el formulario lleva fotos o documentos. Con renglones, lo de un renglón se cuenta una vez por cada renglón de WhatsApp. Un formulario con bloque tiene el tope de uno con archivos: el remito, de unos 41 KB con 10 renglones y Observaciones de 600 caracteres, entra aunque no lleve el remito adjunto. Publicar no muestra nada nuevo. Si igual no entra, por ejemplo con Observaciones de 2.000 caracteres por renglón, frena como hoy, con su problema en cada pregunta de texto. La (i) del máximo dice «En WhatsApp se cargan hasta 10 renglones; en la app, hasta el máximo.». Falta confirmar con Meta que una respuesta de unos 40 KB llega entera; si no llega, queda RG7-C. |
| **RG8-A · Un bloque con mínimo 0 en WhatsApp: «¿Agregás un renglón?» antes del primero** (elegida) | Con un mínimo de 0, el Flow suma antes del primer renglón una pantalla con el nombre del bloque como título («Artículos») y «¿Agregás un renglón?», sí o no, obligatoria: con «Sí» sigue el renglón 1; con «No», lo de después del bloque o «Enviar». Desde el primero, cada renglón termina con «¿Agregás otro renglón?», como en RG3-A, y la flecha de WhatsApp vuelve a esa pantalla para cambiar el «No». Con un mínimo de 1 o más, la pantalla no aparece. En la app no cambia nada: la tabla arranca vacía y «Agregar renglón» suma el primero. |
| **RG4-A · Una fila por respuesta y una hoja por bloque** (elegida) | La planilla sigue con una fila por respuesta. La columna del bloque dice la cantidad, en gris, y los valores de su primera pregunta, en orden y cortados con «…»: «3 · GLIFOSATO 64%, ATRAZINA 50%, UREA GRANULADA…». No se ordena por ella, como «elegir varias», y una respuesta de antes del bloque dice «—». En «Filtros», las preguntas del bloque van debajo de su nombre, con sangría, y cada una filtra por algún renglón («En algún renglón de Artículos»). La vista rápida (D2) muestra el bloque como un dato más: cada renglón con su número y su primer valor en negro, y los demás datos alineados debajo, como los de un catálogo (TL1-A). La pantalla completa (DC1) muestra una tabla en la columna del valor, y el PDF, una tabla con el nombre del bloque como título, que sigue en la página siguiente con su encabezado si no entra. El Excel deja «Respuestas» como hoy, con la cantidad de renglones en la columna del bloque, y suma una hoja con el nombre del bloque: una fila por renglón con N°, Renglón y sus preguntas, con los tipos y la precisión de hoy. |
| **RG5-A · «Algún renglón con…»** (elegida) | Al elegir en una condición una pregunta del bloque («Artículos › ¿Llegó en buen estado?»), la condición empieza con «Algún renglón con» y se cumple si al menos un renglón la cumple. Varias del mismo bloque buscan un mismo renglón que las cumpla todas: «Algún renglón con Artículo GLIFOSATO 64% y Cantidad desde 100». «Filtros» usa la misma regla, y una respuesta de antes del bloque no cumple ninguna condición sobre sus preguntas, como hoy con una pregunta que no existía. En «Agregar dato» (MD1-A), el bloque es un dato que trae todos sus renglones; sus preguntas no se ofrecen sueltas. En «Así llega» y en el aviso, cada renglón va en una línea, numerado y con sus valores separados por « · » en el orden de las preguntas: «1. GLIFOSATO 64% · 200 · Litros · 4,20 · Sí». La lista de reglas dice «Algún renglón de Artículos con ¿Llegó en buen estado? es No», con la pregunta y el valor en negrita. |

## Qué entra en cada etapa

| Etapa del plan | De los tableros |
| --- | --- |
| 1 · El bloque en el editor y al publicar | RG1-A y RG6-A enteros; de RG3-A, las pantallas del Flow, «¿Agregás otro renglón?» y el aviso del máximo; RG7-A y RG8-A. La verificación con Meta: las 10 ramas, lo que no se visitó, las opciones de un catálogo en cada pantalla y una respuesta de unos 40 KB. |
| 2 · Cargar renglones | RG2-A entero, en la página, el panel y el celular, con «Mantener»; de RG3-A, la carga por WhatsApp. La prueba física con el remito de tres artículos, desde la app y por WhatsApp. |
| 3 · Ver los renglones | RG4-A: la columna de la planilla, «Filtros» por algún renglón, la vista rápida, la pantalla completa, el chat de WhatsApp, la hoja del Excel y la tabla del PDF. |
| 4 · Las reglas | RG5-A: «Algún renglón con…» en el editor y en la evaluación, la lista de reglas y el bloque como dato del mensaje, con «Así llega». |

## Lo que se fijó al registrar

Los tableros no lo dicen, o se dibujaron antes de una regla que ya está programada. Se resolvió con la regla vigente o con la
opción más simple que cumple el plan:

- **«Filtros» (PL2-A y FO1-A):** una pregunta del bloque con opciones es un combo de una opción, con «Todas» arriba, buscador
  y sin cantidades. No van las casillas con su cantidad ni el select «Respuesta» que dibujó RG4-A. Texto, número y fecha
  filtran como hoy.
- **La lista de reglas, en pasos (LR1-A):** la condición es un paso, «Si algún renglón de Artículos con ¿Llegó en buen
  estado? es No», con «Si» en gris y la pregunta y el valor en negrita, en lugar de los rótulos «Cuándo», «Si» y «Hacer» de
  TL2-A que dibujó RG5-A.
- **«Qué se publica» (NI2-C):** con un solo idioma, el del menú, no va la fila «Idiomas» que dibujaron RG1-A y RG6-A.
- **Sí o no en la tabla:** el `SegmentedControl` común, sin nada marcado al empezar y con la elegida rellena (OE1-A).
- **Las tablas:** la de carga y las de lectura (la pantalla completa, el PDF y la hoja del Excel) llevan la línea entre
  columnas y los números a la derecha, el del renglón incluido
  ([líneas entre columnas](visual-baseline.md#líneas-entre-columnas--2026-11-02)).
- **El texto largo, adentro del bloque (RG6-A):** RG1-A dibujó el «Agregar pregunta» del bloque sin texto largo; desde RG6-A
  entra, con la celda que crece. Quedan afuera elegir varias, fotos, documentos y otro bloque.
- **La casilla:** «Se carga varias veces» es el `CheckboxField` de siempre con su `InfoTip`; no hace falta una pieza nueva.
- **Una revisión con cambios de otra persona (LR2-A):** el bloque se compara lado a lado con los nombres de su editor
  («Nombre», «Mínimo» y «Máximo»), y entre los datos de cada pregunta va «Se carga varias veces».
- **El chat de WhatsApp**, que muestra los valores de una respuesta, pone el bloque con un renglón por línea, como «Así
  llega». Viene del plan, sin tablero.
- **Los textos son genéricos** («Agregar renglón», «Renglón 2», «¿Agregás otro renglón?»): el bloque no guarda cómo se llama
  un renglón en singular.
- **El celular, fuera de la carga:** la tabla de la pantalla completa se desplaza de costado dentro de su caja, como las
  demás tablas, y en el editor el recuadro del bloque va a lo ancho, con las mismas acciones.
- **Las esperas y los errores** siguen el contrato común: agregar, mover y quitar renglones no esperan al servidor; enviar y
  publicar usan sus esperas de hoy.

## Lo que cambia de lo que hay

Al programar cada etapa se reescribe lo que hoy dice lo contrario:

- En la [carga desde la app](carga-desde-la-app.md#dos-anchos-ar1-a--2026-11-02), la tabla de anchos suma el bloque a «El
  renglón entero», y [mantener lo cargado](carga-desde-la-app.md#mantener-lo-cargado-en-la-página-ar2-a--2026-11-02)
  conserva también los renglones.
- En [Formularios por WhatsApp](formularios-whatsapp.md):
  - la planilla, que no ordena por «elegir varias», tampoco ordena por el bloque;
  - [«Filtros»](formularios-whatsapp.md#el-filtro-de-una-pregunta-con-opciones-un-combo-pl2-a--2026-11-03) suma las
    preguntas del bloque;
  - el [detalle](formularios-whatsapp.md#textos-largos-el-detalle-y-las-reglas-tl1-a-y-tl2-a--2026-11-02) suma los
    renglones;
  - [«Publicar»](formularios-whatsapp.md#publicar-en-whatsapp-pu1-a--2026-11-01) suma «Pasan a renglones», el bloque vacío
    y el aviso del máximo;
  - las [reglas en pasos](formularios-whatsapp.md#reglas-y-sugerencias-en-pasos-lr1-a--2026-11-03) y el
    [mensaje con datos](formularios-whatsapp.md#reglas-el-mensaje-con-datos-md1-a--2026-11-03) suman «algún renglón» y el
    bloque como dato.
- En [formularios](../../../ArquitecturaBase/docs/features/formularios.md#persistencia-y-responsabilidad), el tipo `group`,
  hoy reservado y rechazado al guardar, pasa a ser el bloque, y cada valor suma su renglón.
- En [WhatsApp](../../../ArquitecturaBase/docs/features/whatsapp.md), la respuesta de más de 16 KiB, que hoy se marca
  rechazada, pasa a 64 KiB cuando el formulario tiene un bloque.
- El [estándar visual](../guides/estandar-visual.md#catálogo-y-revisión-con-navegador) suma las dos piezas nuevas (abajo).

## Correspondencia con `shared/ui`

| En el tablero | Pieza |
| --- | --- |
| El bloque en la lista del editor, con sus preguntas 5.1, 5.2… | La lista de preguntas del editor de hoy; el recuadro del bloque es del módulo de formularios |
| «Agregar pregunta» con «Renglones» y su motivo apagado | El menú de hoy (`dropdown-menu`) con `DisabledReason` |
| El editor del bloque: nombre, ayuda, mínimo y máximo | `FormField`, con la (i) del máximo en `InfoTip` |
| «Se carga varias veces» | `CheckboxField` con su `InfoTip` |
| «Pasan a renglones», el bloque vacío y el aviso del máximo | `PublicationCheckDialog` (PU1-A) |
| La pantalla de un renglón en la vista previa | `FormPreview`, sobre `PhonePreview` |
| La tabla de carga | Pieza nueva de `shared/ui` sobre `Table`, con `FormField` en cada celda, los controles de siempre (`Autocomplete`, `SegmentedControl`, `textarea`), `IconButton` para ↑ ↓ y el tacho, y «Agregar renglón» con `Button` y `DisabledReason`; se desplaza de costado como `WideTable` |
| Un recuadro por renglón, en el panel y en el celular | Pieza nueva de `shared/ui`, la versión en recuadros de la tabla de carga, con «Quitar» en `Button` |
| La columna del bloque en la planilla | `DataTable` con `CellText`, como «elegir varias» |
| «Filtros» por algún renglón | `FilterPanel` con el combo de PL2-A (`Autocomplete` con `dropdown`) |
| Los renglones en la vista rápida | `DataList`, con los datos de cada renglón alineados debajo de su primer valor |
| La tabla de la pantalla completa | `DataTable` con `numeric`, dentro de `WideTable` |
| «Algún renglón con…» en el editor de reglas | `FormConditionsEditor` |
| La condición en la lista de reglas | `StepList` (LR1-A) |
| El bloque en «Agregar dato» y en «Así llega» | `RuleMessageField` (MD1-A) |
| Una revisión con cambios de otra persona | `ComparisonTable` (LR2-A) |
| La tabla del PDF | El renderer del backend, con su vista previa en `FormPdfPreview` |

Las dos piezas nuevas, la tabla de carga y su versión en recuadros, se suman al catálogo local del
[estándar visual](../guides/estandar-visual.md#catálogo-y-revisión-con-navegador) con sus variantes: vacía, con el máximo,
con errores y en una columna.
