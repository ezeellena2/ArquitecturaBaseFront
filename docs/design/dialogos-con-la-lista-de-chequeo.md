# Diálogos con la lista de chequeo

Fecha: **2026-11-09**. Estado: **elegidas las recomendadas el 2026-11-11 (EX1-A, EX2-A y los 19 diálogos de DL) y
programadas el mismo día**; faltan la prueba manual y pasar los tableros al lienzo del sistema visual. Las confirmaciones
dudosas y las reglas RF1 a RF3 también quedaron con lo recomendado; el control automático no se agregó (abajo).

Durante la prueba integral, exportando la planilla de «Remito de prueba» con el filtro de un bloque de ítems, el usuario
marcó que el diálogo «Exportar respuestas a Excel» es una lista suelta y preguntó por qué, para diseñar algo nuevo, las
premisas no se aplican solas. De ahí salieron tres cosas: la [lista de chequeo de diseño](visual-baseline.md#lista-de-chequeo-de-diseño),
vigente, que todo tablero y toda pantalla nueva pasan antes de programarse; este diseño, con el diálogo de exportar
rehecho con esa lista y los demás diálogos que tienen el mismo problema; y el
[plan](../plans/2026-11-09-dialogos-con-la-lista-de-chequeo.md) para programarlo con el front quieto.

Los tableros están en el lienzo aparte [Diálogos con la lista de chequeo](https://claude.ai/artifact/NUTGFtcXh7QPq8wnpJ6K6c)
(el Sistema visual no se abre desde Claude Code). Falta pasarlos al lienzo del sistema visual.

## Por qué pasa

### Dónde están hoy las reglas

| Fuente | Qué tiene |
| --- | --- |
| [`visual-baseline.md`](visual-baseline.md) | Unos 1.160 renglones: los principios, una sección por tema (encabezados, listados, formularios y diálogos, lecturas, accesibilidad) y, desde el 2026-10-23, una decisión fechada por pedido, al final, con su historia. |
| [`premisas-de-desarrollo.md`](../guides/premisas-de-desarrollo.md) | 300 renglones de interacción: estructura de una pantalla, filtros, tablas, formularios, botones, modales y mensajes. |
| [`estandar-visual.md`](../guides/estandar-visual.md) y [`mensajes-y-estados.md`](../guides/mensajes-y-estados.md) | Las piezas para cada necesidad, las medidas y el contrato de mensajes. |
| Diseños por área (`formularios-whatsapp.md`, `carga-desde-la-app.md`…) | Los tableros elegidos de cada área; el de formularios pasa los 130 KB. |
| [Revisar y validar un cambio](../../../ArquitecturaBase/docs/guides/validar-un-cambio.md) (backend) | Doce preguntas para revisar el código antes de cerrar, desde el 2026-11-08. La primera compara la pantalla con su tablero. |
| `src/test/architecture/designRules.ts` | Los controles automáticos: tokens, piezas comunes, estilos propios y leyendas fijas en `hint`, `description` y `DialogDescription`. Ninguno mira cómo se compone un diálogo. |

Hasta hoy no había una entrada corta que dijera qué mirar en un tablero: para diseñar un diálogo había que leer unos
2.000 renglones en cuatro guías y sacar de ahí lo que aplica.

### Lo que rompe este diálogo

| Lo que se ve | Pregunta de la lista | Regla y fecha |
| --- | --- | --- |
| «2 respuestas» y «1 filtro aplicado» en párrafos sueltos, en la letra del título (16 px) | 2, 4 y 11 | Lecturas, «cada dato va en un lugar fijo» (LR1, 2026-11-03); cinco niveles de letra (2026-09-24) |
| «Estado: Dañado» en una viñeta, mientras en la planilla el mismo filtro es un chip | 4 y 11 | Lecturas, sin «Rótulo: valor» corrido (2026-11-03); «un sistema, no una colección de pantallas» (2026-09-24) |
| El filtro de una pregunta del bloque no dice «en algún ítem de Artículo» y se confunde con el estado de la respuesta | 7 | Textos ciertos ([pregunta 2 de la revisión](../../../ArquitecturaBase/docs/guides/validar-un-cambio.md#antes-de-cerrar-lo-que-más-se-repite-en-las-revisiones)) |
| Las dos opciones dicen «(4 columnas)»: sin columnas ocultas dan lo mismo | 7 | Premisas: nada de «resúmenes que no ayudan a decidir» (2026-09-30) |
| «Columnas a exportar», un título armado a mano porque `RadioGroupField` no dibuja el suyo | 3 y 11 | Sólo piezas comunes ([criterio de finalización](visual-baseline.md#criterio-de-finalización-de-una-pantalla)) |
| Con «Incluir las anuladas» marcada sigue diciendo «2 respuestas» | 7 | Textos ciertos |
| El nombre del archivo, suelto y sin rótulo; nada dice que el bloque sale en su propia hoja | 4 y 7 | Lecturas; textos ciertos |

Sí cumple sin leyendas (la (i) de «Columnas»), los botones (Cancelar al lado de la principal, el tope y la espera como
motivo de «Exportar a Excel» apagado) y el aro al exportar.

### Por qué no se aplicaron

| Fecha | Qué pasó | El diálogo |
| --- | --- | --- |
| 2026-09-23 a 30 | El tablero antes de programar; las premisas; los principios. | Todavía no existía. |
| 2026-10-11 | Se elige el tablero T5: la cantidad y los chips de los filtros, las columnas en tarjetas y el archivo en el pie. | — |
| 2026-10-16 | Se programa (5cde82b9) y esa tarde el resumen pasa a párrafos y viñetas (13911457). | Distinto del tablero desde el primer día. |
| 2026-10-23 | Se exportan los campos de catálogo visibles (88ebff89). | Cambia sólo el conteo. |
| 2026-10-23 a 25 | Botones y estados (0c90e90a). | Repasado sólo para esa regla. |
| 2026-10-31 a 11-01 | Sin leyendas; toda espera muestra carga (b61b18ac). | Repasado sólo para esa regla. |
| 2026-11-03 | Lecturas (LR1). | No se repasó: el relevamiento recorrió reglas, sugerencias, chat, Inicio y la pregunta de catálogo. |
| 2026-11-05 | CW11-A suma «Incluir las anuladas» (6b9671eb). | Se sumó la casilla sin repasar el resto. |
| 2026-11-07 | Renglones: filtrar por algún ítem (8fbd531f) y una hoja por bloque en el Excel (backend 7992d5be). | No se repasó: los chips y el diálogo siguen diciendo «Estado: Dañado». |
| 2026-11-08 | Una cosa, una zona (IA1-A); las doce preguntas de la revisión. | No se repasó. |
| 2026-11-09 | El motivo de lo apagado (MA1-A) y Un dato por columna. | MA1-A ya lo cumple; un dato por columna no aplica. |

1. **Se programó distinto del tablero y nadie los comparó.** T5 tenía chips y el archivo en el pie; el código salió con
   párrafos y viñetas. La pregunta que pide comparar elemento por elemento recién se escribió el 2026-11-08.
2. **Cada regla nueva se aplicó de a una.** Al fijar una regla se buscó su patrón en la app y se corrigió ese patrón. El
   diálogo se repasó dos veces, siempre para una sola regla, y nadie lo miró entero. Las lecturas (2026-11-03) no lo
   alcanzaron porque se buscaron en reglas, sugerencias y el chat, y su definición habla de «algo guardado».
3. **Lo sumado no se dibujó.** Los campos de catálogo, las anuladas y la hoja del bloque entraron sin un tablero del
   diálogo entero: «primero el tablero» se lee como una regla de pantallas nuevas.
4. **El tablero quedó viejo.** T5 todavía muestra las leyendas de octubre, así que tampoco sirve para comparar.
5. **Las reglas están repartidas y fechadas.** Las de octubre y noviembre se agregaron al final de `visual-baseline.md`
   con su historia. Los principios resumen varias, pero no todas (las lecturas, por ejemplo), y no había una lista
   corta para el momento de dibujar.
6. **Los controles automáticos no miran la composición.** Un `<ul>` o un `<p>` suelto en un diálogo pasa lint y tests.

## La lista de chequeo

Quedó en [`visual-baseline.md`](visual-baseline.md#lista-de-chequeo-de-diseño), con el modelo de las doce preguntas de
la revisión: doce preguntas que enlazan cada regla en su fuente, sin repetirla. La del motivo de lo apagado y la de un
dato por columna se enlazan; no se copian. La enlazan el [`AGENTS.md`](../../AGENTS.md) del front y el de
[`docs`](../AGENTS.md), que es la guía de `docs/design`.

## Reglas nuevas (elegidas el 2026-11-11)

Están escritas en [`visual-baseline.md`](visual-baseline.md): RF1 en la [lista de chequeo](visual-baseline.md#lista-de-chequeo-de-diseño),
RF2 en [Lecturas](visual-baseline.md#lecturas) y RF3 en [cómo se usa esta base](visual-baseline.md#cómo-se-usa-esta-base).

- **RF1 · Sumar a lo que existe repasa el conjunto.** Al agregar un control, un dato o un estado a una pantalla o un
  diálogo que ya existe, el tablero lo muestra entero y pasa la lista otra vez, no sólo lo nuevo.
- **RF2 · Lo que un diálogo dice de lo que va a hacer es una lectura.** Cuántas, con qué filtros, a quién o a qué archivo
  va en `DataList`, como los datos de un registro. Hoy [Lecturas](visual-baseline.md#lecturas) habla de «algo guardado».
- **RF3 · Un cambio pedido sobre una captura vale para toda la app.** El usuario lo decidió el 2026-11-03 y falta
  escribirlo: al pedir un cambio sobre una pantalla, se buscan las parecidas en todas las pantallas y diálogos, no sólo
  donde aparece el mismo patrón, y la regla se escribe general.

## El diálogo de exportar

| Tablero | Qué define |
| --- | --- |
| **EX0 · Hoy, contra la lista** | El tablero T5 y la captura del 2026-11-09 lado a lado, lo que no pasa la lista y cuándo salió cada regla. |
| **EX1-A · Lo que se exporta arriba, en dos columnas** (recomendada) | «Respuestas» y «Filtros» en `DataList`, con los mismos chips de la planilla sin la cruz («Ninguno» sin filtros). «Columnas», título del grupo con su (i); sin columnas ocultas, «Solo las visibles» apagada con «Se ven todas las columnas.». «Incluir las anuladas» donde la puso CW11-A, con su (i), «Suma la columna «Anulada».»; marcada, «Respuestas» dice «2 y las anuladas». «Archivo» y «Filas» al final: «Una por ítem de Artículo» o «Una por respuesta», según el Excel elegido (XL1-A) y «Solo las visibles», con la (i) «Los datos de cada respuesta se repiten en sus ítems. Una respuesta sin ítems ocupa una fila.». |
| **EX1-B · Como T5, sin leyendas** | Una frase con la cantidad en negrita y los chips, las columnas en tarjetas y el archivo en el pie, a la izquierda. |
| **EX1-C · Las elecciones arriba, lo que se baja al pie** | Las mismas piezas que A, con las elecciones primero y un solo `DataList` junto al botón. |
| **EX2 · El filtro de una pregunta del bloque** | **A** (recomendada): «Estado: Dañado (en algún ítem de Artículo)». **B**: «Algún ítem de Artículo con Estado: Dañado», las palabras de las reglas. **C**: «Artículo › Estado: Dañado», sin decir «algún». Vale para los chips de la planilla y el diálogo, que salen del mismo texto. |
| **EX3 · Estados y recorrido de EX1-A** | Con columnas ocultas, con las anuladas, con un estado elegido (sin la casilla, como fijó CW11-A), sin filtros, con más de 10.000, exportando, esperando un 429 y a 320 px; qué pasa al terminar, con un error o sin permiso. |

**Recomendación: EX1-A con EX2-A.** Cada dato tiene su lugar y se encuentra sin leer frases; los filtros se ven igual
que en la planilla; lo que depende de las elecciones queda al lado del resultado; ningún texto se reescribe según el
caso y se arma con piezas que ya existen. B vuelve al tablero que se eligió en octubre, pero la frase cambia con cada
caso y las tarjetas duplican el alto. C pone primero una elección sin contexto y el filtro al final.

No cambia el contrato con el backend: el diálogo no inventa cuántas anuladas hay, y «Filas» sale de las columnas que ya
llegan (si el bloque entra en lo que se exporta).

El mismo día el usuario pidió el Excel en una sola hoja y eligió XL1-A, una fila por ítem: está en el
[plan del Excel](../../../ArquitecturaBase/docs/plans/2026-11-09-excel-de-respuestas-en-una-hoja.md), con los tableros
XL0 a XL2 del mismo lienzo. Por eso EX1-A, EX1-C y EX3 dicen «Filas» en lugar de «Hojas»: «Una por ítem de Artículo»,
o «Una por respuesta» sin bloque o con el bloque fuera de «Solo las visibles». El backend quedó programado el mismo
día, con un tope de 100.000 filas que el usuario eligió al ver la medición; la (i) de «Filas» lo dice.

## Los demás diálogos

Se leyeron en el código los 56 archivos que abren un diálogo (sin abrir la app). Tienen el mismo problema 19 diálogos,
y hay 5 confirmaciones dudosas. Los cuatro primeros están dibujados en el tablero **DL**, hoy y así.

| Diálogo | Qué tiene hoy | Cómo quedaría |
| --- | --- | --- |
| Dar de baja un formulario (`FormDeactivationDialog`) | Tres títulos armados a mano y seis avisos apilados, uno por consecuencia; «Si alguien lo pide, se anota en…» debajo del asistente. | «Deja de pasar» y «Se conserva» en dos columnas, con su título, y un solo aviso: el de WhatsApp, que no se deshace. La explicación del asistente, en su (i). Con las filas que fijó [formularios sólo en la app](formularios-solo-en-la-app.md): «App · No se carga más» para todos; «Chat» y «Asistente», sólo si la versión activa se publicó por WhatsApp. |
| Eliminar un formulario (`FormDeletionDialog`) | Cuatro textos sueltos; «no se deshace» dos veces. | Una frase con lo que se afecta y el aviso de WhatsApp sólo si alguna versión se publicó ahí, como fijó formularios sólo en la app. |
| Resolver el envío (`ResponseWorkflowHistory`) | «Destinatario: Ana Pérez» corrido y una frase gris que explica por qué las opciones están apagadas. | «Destinatario» en su renglón; la frase, motivo de las opciones apagadas. |
| Revisión del catálogo (`CatalogEditorPage`, `CatalogFiltersEditorPage`) | Dos recuadros sin decir qué es cada texto, una leyenda bajo el título y el mismo diálogo dibujado distinto en cada página. | La comparación lado a lado de LR2-A, como «Revisión del borrador», en un solo diálogo. |
| Enviar un formulario (`FormComposer`) | Versión, idioma, vencimiento y contador en párrafos de dos tamaños; el título de los prellenados, armado a mano. | Formulario, Versión, Idioma (si es el otro) y «Se puede mandar hasta» en dos columnas. |
| Publicar en WhatsApp (`PublicationCheckDialog`) | «Qué se publica» con una copia local de `DataList`; la celda de idiomas junta cuatro cosas. | La pieza común; cada cosa en su renglón, también la fila «Dónde se completa» que suma SA3-A. |
| Agregar o editar un dato de las personas (`PersonAttributeDialog`) | Viñetas con los formularios que lo usan y una frase que explica lo apagado. | «Se usa en» en su renglón; la frase, motivo de lo apagado. |
| Importar opciones (`CatalogImportDialog`) | El resumen de la revisión en un renglón con « · »; casillas armadas a mano. | Archivo, Hoja y Filas leídas en dos columnas; `CheckboxField`. |
| Cambiar el tipo de un campo (`CatalogFieldConversionDialog`) | El cambio como título a mano y los conteos en una frase. | Tipo y conteos en dos columnas. |
| Nuevo catálogo (`CatalogOriginDialog`) | Los títulos de sus dos grupos de opciones, armados a mano. | El grupo dibuja su título con su (i). |
| ¿Aprobar N? (`ApprovalDecisionPanel`) | «Ana Pérez · 9 nov 2026, 14:00», sin decir qué es. | «La cargó Ana Pérez el 09/11/2026, 14:00.» |
| Foto (`PhotoViewer`) | Nombre, tamaño y fecha en tres párrafos; «Foto 2 de 5 · número» en la descripción. | El nombre y la línea gris «86 KB · 09/11/2026». |
| Horario de una fecha especial (`BusinessHoursEditor`) | El estado y las franjas sin etiqueta visible; el error suelto. | `FormField` «Atención» y «Horario». |
| Elegir opciones en el celular (`EntryCatalogField`) | «hasta 3» pegado al título; dos conteos en párrafos. | El tope fuera del título y los conteos en un renglón. |
| Opciones y Campos de un catálogo (`CatalogItemsDialog`, `CatalogFieldsDialog`) | Lo pendiente al guardar en texto rojo y «Nuevo» en etiqueta; los usos como frases. | Los dos estados en etiqueta, con UD3; los usos en renglones. |
| Verificar número o correo (`VerifyDestinationDialog`); Nuevo usuario (`UserFormDialog`) | El rótulo «Código» y la zona de la invitación, armados a mano. | Las mismas piezas, sin rótulos ni márgenes propios. |

Confirmaciones dudosas (el 2026-11-11 quedaron en una frase con lo que se afecta, sin instrucciones; la del idioma dice que
es por el idioma): «Pasar a modo Asistente» explica cómo trabaja el asistente;
«Confirmar revisión del envío», «¿Quitar la clave?» y «Descartar pedido» suman una frase de instrucciones; y
«¿Descartar los cambios?» al cambiar el idioma no dice que es por el idioma.

Ya cumplen las confirmaciones de una frase que dice qué se afecta (roles, usuarios, WhatsApp, ARCA, el registro y
descartar cambios en cada editor), «¿Anular N?», «Rechazar N», «Editar usuario», la vista oficial, «Cómo queda» del
asistente, «Revisión del borrador» y el historial de revisiones, cuya línea gris «fecha · persona» debajo del título es
la excepción aprobada de [Lecturas](visual-baseline.md#lecturas). Fuera de los diálogos, la tarjeta de la propuesta del
asistente tiene el mismo problema («Texto · opción 1, opción 2 · Obligatoria»).

## Qué falta

- **Control automático (tarea 8 del [plan](../plans/2026-11-09-dialogos-con-la-lista-de-chequeo.md)): no se agregó.** La
  sintaxis no distingue una viñeta con datos de una lista de cosas: hay diez archivos con listas legítimas dentro de un
  diálogo (opciones, campos, el historial, las revisiones, los problemas de publicar). Lo cubren la lista de chequeo y la
  revisión.
- La prueba manual y `test:visual`, con cada referencia que cambió revisada: la exportación, la baja, la eliminación,
  publicar, los editores y los diálogos del catálogo, el envío de un formulario, la foto, la fecha especial, verificar y
  nuevo usuario.
- Pasar los tableros al lienzo del sistema visual. T5 ya figura como reemplazado en [formularios](formularios-whatsapp.md).

## Cómo quedó (2026-11-11)

Igual a los tableros, con estas diferencias, que siguen reglas que ya existían:

- **Revisión del catálogo:** la revisión actual primero, como «Revisión del borrador», y sólo lo distinto una vez leída
  ([comparaciones lado a lado](visual-baseline.md#comparaciones-lado-a-lado--2026-11-03)); si no cambió ninguno de esos
  datos (cambiaron las opciones), muestra todos, así la tabla nunca queda vacía.
- **Importar opciones:** además de Archivo, Hoja y Filas leídas, «Sin cambios» y «Reactivadas» cuando hay, porque no tienen
  pestaña y reactivar es un efecto que conviene ver antes de aplicar.
- **Enviar un formulario:** en la lista, la tarjeta elegida ya dice el formulario y la versión, así que el `DataList` lleva
  sólo Idioma (si es el otro) y el vencimiento.
- **Publicar:** los renglones que el tablero no nombraba se llaman «Se suma» y «Sin el inglés».
- **Exportar:** una pregunta «Ubicación» cuenta como tres columnas (latitud, longitud y precisión), como sale en el Excel.
  Cada dato del resultado de una acción (RE1-A) cuenta como una columna en las dos opciones, y «Solo las visibles» manda
  los que se ven (2026-11-11): con sólo uno oculto en «Columnas», ya se puede elegir.
