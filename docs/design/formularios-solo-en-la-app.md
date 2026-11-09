# Formularios sólo en la app: tableros propuestos

Fecha: **2026-11-09**. Estado: **propuesta, sin elegir**. Nada está programado. Las preguntas, la recomendación de cada una y
el diseño técnico están en el [plan del backend](../../../ArquitecturaBase/docs/plans/2026-11-09-formularios-solo-en-la-app.md).
Cuando el usuario elija, este documento suma «Las elecciones» y congela lo elegido; hasta entonces nada de acá es una regla.

Origen: durante la prueba integral del 2026-11-09 el usuario pidió poder crear formularios que no vayan a WhatsApp, que sean
sólo de la app. Hoy publicar una versión siempre pasa por un canal: sin el módulo de WhatsApp, publicar frena con «No hay un
canal de formularios instalado.»; con WhatsApp, la versión queda activa recién cuando Meta la acepta. Ese mismo día Meta
rechazó las versiones 2 y 3 de «Remito de prueba» y la app siguió cargando la 1.

Lienzo: [Formularios sólo en la app](https://claude.ai/artifact/GjxDspdmg3xtZzG4oH2Hzu), de tipo Design (versión 4). Se armó
aparte porque el [Sistema visual](https://claude.ai/artifact/HPbmDPLnr8JZ9TxevtTqJJ) es de otra cuenta y no se abre desde
Claude Code. Los tableros elegidos pasan a ese lienzo cuando se pueda abrir.

## Cómo leer los tableros

- Están armados con las piezas de los lienzos anteriores: los colores de `src/index.css`, Public Sans y el escritorio con la
  raíz al 75 %. Al programar, cada parte se arma con su pieza de `src/shared/ui` (tabla abajo), no copiando el dibujo.
- Los círculos numerados son notas del tablero, explicadas en la columna de la derecha. Cada opción cierra con «Para
  comparar». No son UI.
- Hay una fila por pregunta, con la recomendada primero. «SA · Hoy» es el relevamiento y SA5 tiene un solo concepto.
- Los datos son ficticios: «Remito de prueba» (REM), «Recepción de insumos» (INS), «Parte diario de labores», Juan Gómez y
  Ana Ruiz.
- El ajuste se llama «Dónde se completa», con dos opciones: «En la app y por WhatsApp» y «Sólo en la app». No hay «sólo
  WhatsApp»: lo que se publica por WhatsApp también se carga en la app.

## Los tableros

| Tablero | Qué propone |
| --- | --- |
| **SA · Hoy** | El editor tiene una sola forma de publicar, «Publicar en WhatsApp», y la versión espera a Meta (aceptada, preparando, publicando, publicada). Si Meta la rechaza, la app sigue con la anterior: el encabezado dice «No se pudo publicar · versión 3» con «Problemas», y el listado, «La versión 1 publicada sigue activa.». Sin el módulo, el diálogo frena con «El canal de publicación: No hay un canal de formularios instalado.». WhatsApp aparece en todo el editor: la columna «En WhatsApp» del listado, la (i) del máximo del bloque, «entra en el desplegable (200)», «Cuándo lo ofrece el asistente», «Qué sugerir después» y la vista previa del celular. Lo que ya anda sin WhatsApp: la carga desde la app, la planilla, el detalle, el Excel, las reglas, las aprobaciones y el PDF, todo sobre la versión activa. |
| **SA1-A · «Dónde se completa», en «El formulario»** (recomendada) | Un segmentado en la zona «El formulario», al lado del prefijo, con su (i). Se guarda con «Guardar borrador» y cada versión publicada lo sella. Un formulario nuevo arranca con «En la app y por WhatsApp», como hoy. El botón del encabezado dice «Publicar en WhatsApp» o «Publicar» según lo elegido (también antes de guardar). Cambiarlo es un cambio del borrador: la versión publicada sigue como está hasta publicar otra. Sin el módulo de WhatsApp el ajuste no aparece. |
| **SA1-B · Se elige al publicar** | El editor no cambia y el botón dice «Publicar». El diálogo «Publicar la versión 4» suma arriba «Dónde se publica», con lo de la versión activa elegido, y hay que elegirlo en cada versión. Hasta publicar, el editor muestra siempre los avisos y límites de WhatsApp. |
| **SA1-C · Se elige al crear y no cambia** | «Nuevo formulario» abre primero un diálogo «¿Dónde se completa?» con dos tarjetas (lo elegido, con borde) y «Crear». Después queda fijo en «El formulario», con candado, como el prefijo publicado. Para pasarlo a WhatsApp hay que armar otro formulario, con otro prefijo y otra planilla. |
| **SA2-A · Se va todo lo de WhatsApp** (recomendada) | Con «Sólo en la app»: se van «Cuándo lo ofrece el asistente» (lo escrito queda guardado), «Qué sugerir después» y «Ver vista oficial». Valen los límites de la app: el bloque llega a 100 ítems sin la (i) de WhatsApp, «Elegir primero» dice «Todos ven las mismas 125, en 3 valores de «Rubro».» sin el desplegable de 200 y publicar no mide los textos con los topes de Meta; siguen los de siempre (40 preguntas, 20 opciones en «Elegir varias», 10 archivos). La vista previa del costado es la de la app: el panel de «Nueva respuesta», en una columna y con un recuadro por ítem del bloque. En WhatsApp no aparece: «Enviar un formulario a Juan Gómez» no lo lista, el asistente no lo ofrece, no es destino de sugerencias y un pedido por WhatsApp va a «Formularios que faltan». Las reglas siguen como están: un aviso por WhatsApp o un PDF salen igual. |
| **SA2-B · Los límites de WhatsApp, para todos** | Un formulario «Sólo en la app» se arma igual que uno de WhatsApp: publicar frena con «Hasta 30 caracteres; tiene 34.» y avisa «En WhatsApp se cargan hasta 10 ítems; el máximo es 50.». La vista previa sigue siendo el celular. En WhatsApp no aparece, como en A. |
| **SA3-A · El estado una vez; dónde, en el listado** (recomendada) | El diálogo es el mismo, sin WhatsApp: «Publicar la versión 4», «Problemas» y «Avisos» sólo si hay, y «Qué se publica» con la fila «Dónde se completa». Publicar es instantáneo: sin «Publicación aceptada» ni «Publicando», el aviso «Publicamos la versión 4.» y la etiqueta «Publicado · versión 4». En «Diseñar formularios», la columna «En WhatsApp» pasa a «Estado» y se suma la columna «Dónde se completa» (en un borrador, dónde se va a publicar), con un dato por columna como pide [la regla del 2026-11-09](visual-baseline.md#un-dato-por-columna--2026-11-09): «Versión activa», «Último cambio» y «Cambió» también van aparte. Sin el módulo, ni la fila ni la columna. |
| **SA3-B · El estado dice dónde** | La etiqueta del encabezado suma el lugar: «Publicado en la app · versión 4» o «Publicado en la app y WhatsApp · versión 3», y «Publicando en WhatsApp · versión 3» mientras se publica. En el celular ocupa el ancho de la pantalla. El listado, como en A. |
| **SA3-C · Una etiqueta «Sólo en la app»** | Una etiqueta gris aparte del estado, en el encabezado; los de WhatsApp no la llevan. El listado, como en A: una etiqueta junto al nombre rompería un dato por columna. |
| **SA4-A · Se cambia el ajuste y se publica** (recomendada) | Pasar de un lado al otro es publicar una versión nueva con el otro valor. De la app a WhatsApp: «Publicar la versión 3 en WhatsApp», con los avisos y problemas de WhatsApp y «Dónde se completa: En la app y por WhatsApp»; espera a Meta y, mientras tanto o si la rechaza, la app sigue con la 2 (en el listado, «Publicando», «Sólo en la app» y «Versión activa» 2). De WhatsApp a la app: «Publicar la versión 5» con el aviso «Deja de completarse por WhatsApp. Los envíos abiertos se pueden responder hasta que vencen.», al instante; los Flows se deprecan cuando vencen los envíos abiertos, como con cualquier versión reemplazada. Mismo formulario, misma planilla, mismo prefijo. |
| **SA4-B · La app no espera a Meta** | Con «En la app y por WhatsApp», publicar activa la versión en la app enseguida y WhatsApp la toma cuando Meta la acepta. El encabezado lleva dos etiquetas («Publicado · versión 4» y «WhatsApp: no se pudo publicar la 4; sigue la 3») y el listado, «En la app», «En WhatsApp», «Versión en la app» y «Versión en WhatsApp». |
| **SA5 · Sin el módulo de WhatsApp: todo es de la app** (recomendada) | No aparece «Dónde se completa» ni «Cuándo lo ofrece el asistente»; el botón dice «Publicar», y publicar es instantáneo, con la vista previa de la app. El diálogo «Publicar la versión 1» no tiene la fila «Dónde se completa» y el listado no tiene esa columna. Una versión que se publicó por WhatsApp antes de quitar el módulo se sigue cargando en la app. Con el módulo instalado y sin el número configurado, «Sólo en la app» publica igual. |

## Lo que vale con cualquier opción

- «Formularios», la pantalla con «Cargar», no cambia: un formulario de la app aparece como los demás.
- La carga desde la app, la planilla, el detalle, el Excel, las reglas, las aprobaciones y el PDF trabajan sobre la versión
  activa, venga de donde venga.
- Las carpetas en el menú lateral (CP5-A, sin programar) muestran los formularios activos sin mirar dónde se completan.
- «Publicar» apagado sigue diciendo su motivo sobre el mismo control ([MA1-A](visual-baseline.md#el-motivo-de-lo-apagado--2026-11-09)).

## Piezas de `src/shared/ui`

| Parte | Pieza |
| --- | --- |
| «Dónde se completa» | `SegmentedControl` con lo elegido relleno (OE1-A) dentro de un `FormField` con su `InfoTip`; en el celular, la opción que no entra baja de renglón, como «Elegir una» en la carga |
| Vista previa de la app | las piezas de la carga en el panel (`FormEntryForm` en una columna, un recuadro por ítem del bloque) |
| Diálogo de publicar | `PublicationCheckDialog` con sus zonas (PU1-A) |
| «Publicamos la versión 4.» | el aviso de éxito (AV1-A) |
| Listado | `DataTable`, con «Dónde se completa» como una columna más |
