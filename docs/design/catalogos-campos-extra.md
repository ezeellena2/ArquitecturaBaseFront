# Campos extra de los catálogos: tableros elegidos

Fecha: **2026-10-21**. **Elegidos CE1, CE2, CE3-B, CE4-A, CE5 y CE6** de la versión 106 del lienzo; la 107 los marca y
suma a CE4-A la nota del módulo, la 108, el ajuste de la evaluación de impacto, y la 110, el de claridad (abajo). Implementado en E2; el review y el piloto real conservan su comprobación separada.

Origen: la sección «Catálogos · campos extra, qué viaja a WhatsApp y filtrar por persona» de la página «Formularios por
WhatsApp» del Artifact [Sistema visual — ArquitecturaBase](https://claude.ai/artifact/HPbmDPLnr8JZ9TxevtTqJJ). Como el
Artifact es privado y puede cambiar fuera de Git, este documento y sus capturas congelan lo elegido. El alcance, el modelo de
datos y las decisiones están en las [reglas vigentes](../../../ArquitecturaBase/docs/features/formularios.md#catálogos-con-campos-extra-y-filtros-por-persona--e2-2026-10-23); las
pantallas, los textos y los estados salen de acá. Para recorrerlo tocando, el
[prototipo navegable](https://claude.ai/artifact/2noVifPc2MX33UnNvT2jhY) tiene seis recorridos en su sección «Campos extra».

## Los tableros

CE3 y CE4 tenían dos variantes. **Se eligieron CE3-B**, en la que el catálogo define lo que viaja a WhatsApp y una pregunta
puede tener lo propio, **y CE4-A**, en la que la zona es un dato de la persona. CE3-A y CE4-B quedan en el lienzo como las
alternativas que no se eligieron. CE3-B toma la sección «En WhatsApp» del catálogo tal como está dibujada arriba en CE3-A:
[la sección del catálogo](evidence/catalogos-campos-extra/ce3-seccion-del-catalogo.png). Todos se apoyan en el editor elegido
en [CA1-A](catalogos-mejoras.md#los-tableros) y no lo cambian.

| Captura | Qué define |
| --- | --- |
| [CE1 · Definir los campos](evidence/catalogos-campos-extra/ce1-definir-los-campos.png) | **Elegido el 2026-10-21.** Una sección nueva, «Campos», en el editor de un catálogo escrito a mano, entre el catálogo y las opciones; los de la base traen sus columnas. En reposo resume los campos, y «Editar campos» abre la tabla; desde el 2026-10-23 es un alternador que la abre y la cierra sin cambiar de forma, y «Agregar campo» queda siempre a su lado, en el encabezado de «Campos». Cada campo tiene un nombre (desde el 2026-10-24, uno solo en el idioma del menú, con el otro idioma como traducción opcional), una clave que no cambia después de guardar, un tipo (texto, entero, decimal, fecha, sí o no, o **elegir de un catálogo**, cuyos valores salen de otro catálogo escrito a mano, como «Zonas»), reglas (obligatorio, único y mínimo y máximo; en un texto, el largo) y un papel: filtro o dato. «Agregar campo» suma uno al final (hasta 20; con 20 se apaga y lo dice como tooltip) y lo abre debajo de su fila, marcado «Nuevo, sin guardar»: **nace opcional**, y pasarlo a obligatorio exige que todas las opciones activas tengan valor; si no, dice cuántas faltan. Las flechas ordenan las columnas de la tabla, la plantilla y el Excel; el tacho lo quita. Quitar un campo con datos pide una casilla; uno en uso, en el borrador o en la versión activa de un formulario, no se quita y dice dónde se usa; cambiar el tipo de uno cargado revisa los valores y lista por fila los que no convierten. En el celular, los campos van uno debajo del otro y cada uno se edita entero, sin «Editar campos». Definirlos pide «Administrar catálogos»; con «Ver catálogos» se ven sin editar. |
| [CE2 · Cargar los valores](evidence/catalogos-campos-extra/ce2-cargar-los-valores.png) | **Elegido el 2026-10-21.** La tabla elegida en CA1-A suma una columna por campo, después del código, y cada celda se edita según su tipo: un texto, un número, una fecha, una casilla o, en un campo que elige de un catálogo, un desplegable con sus opciones, en el que se busca escribiendo. Un error queda en la celda y la fila dice qué pasa («Fila 3 · Plazo de pago (días): «30 días» no es un número entero»); no se guarda, pero desde el 2026-10-23 no apaga Guardar: al intentarlo no se envía nada y se abre la opción, con el foco en el valor marcado. Con muchas columnas, la tabla se desplaza de costado dentro de su caja, con la barra a la vista, y el menú **«Campos»** muestra u oculta columnas. Un campo nuevo **no se carga hasta guardarlo**: su columna aparece apagada, con «Guardá para cargar valores», que desde el 2026-10-23 cada celda apagada da como ayuda al pasar el mouse o con el foco, sin texto debajo. La plantilla suma una columna por campo, reconocida por su clave, con su tipo y sus reglas en la primera fila; pegar e importar validan cada celda por tipo, con fila y columna, en el mismo recorrido de CA2, y en un campo que elige de un catálogo va el código o el texto de la opción. En el celular, la opción se edita entera, con sus campos. En inglés, las columnas usan el nombre en inglés del campo, si lo tiene. |
| [CE3-B · Qué viaja a WhatsApp](evidence/catalogos-campos-extra/ce3-b-tambien-en-la-pregunta.png) | **Elegido el 2026-10-21.** En WhatsApp, cada opción tiene un título (hasta 30 caracteres) y una descripción (hasta 300), armados con uno o más campos, fijos o extra, separados por « · ». El catálogo define lo de siempre en su sección «En WhatsApp», junto a la vista previa, que se actualiza al cambiarla; lo de hoy es el texto y el detalle. En una pregunta de catálogo, «En WhatsApp» ofrece «Como en el catálogo», por defecto, o «Propio de esta pregunta», con los mismos campos y las mismas reglas, y la vista previa lo muestra. Si alguna opción no entra en 30, avisa con las opciones afectadas (desde el review de E2, el aviso mira cada idioma del catálogo y también las descripciones de más de 300); se puede guardar, y la comprobación de publicar lo frena y dice si el problema es del catálogo o de la pregunta. Lo que no se elige no sale del sistema. Un cambio vale para los envíos nuevos. En el catálogo pide «Administrar catálogos»; en la pregunta, «Administrar formularios», y se publica como cualquier cambio de la pregunta. |
| [CE4-A · Filtrar por persona](evidence/catalogos-campos-extra/ce4-a-datos-de-la-persona.png) | **Elegido el 2026-10-21.** «Datos de las personas», una pantalla nueva del módulo en Administración, con ruta propia (`/datos-de-personas`): arriba, los datos que tiene cada persona, como Zona y Sucursal, que eligen de un catálogo («Zonas») o son un texto; abajo, **la tabla de personas con sus valores**. Los valores se cargan en «Editar usuario», en la sección «Datos», que **se guarda aparte del usuario**, solo si cambió; si falla, el diálogo queda abierto con el error en la sección. **La lista de usuarios no suma columnas.** Las dos cosas las aporta el módulo de formularios (abajo). En una pregunta de catálogo, «Qué opciones ve cada persona» filtra sobre los campos de papel «filtro»: según quien lo recibe («Zona es la zona de quien lo recibe», que compara la misma opción de «Zonas») o fijo («Rubro es Frío»); los filtros se suman. «Como si lo recibiera: Juan Gómez · Zona Centro → 14 opciones» prueba con una persona, y la vista previa muestra lo suyo. **La comprobación de publicar frena** lo que no puede funcionar (un campo inexistente o inactivo, un papel o tipo que no corresponde, un título de más de 30) y **suma avisos que no frenan**, en una lista aparte: el máximo por persona («como mucho 18, Zona Sur») contra 200 y 20, y quién quedaría sin poder recibirlo. Al mandarle a alguien sin el dato, el envío se bloquea con el motivo. Cargar los datos de una persona pide «Administrar usuarios»; definirlos, un permiso propio del módulo; los filtros de la pregunta, «Administrar formularios». |
| [CE5 · Las respuestas](evidence/catalogos-campos-extra/ce5-las-respuestas.png) | **Elegido el 2026-10-21.** Los campos de la opción elegida se sellan al responder. La planilla suma, después de la pregunta, una columna por campo de dato («Proveedores a consultar · CUIT»), con las opciones en el mismo orden; las subcolumnas **solo se muestran**: no se ordenan, ni filtran, ni cuentan en las facetas. Los de filtro se prenden en «Columnas», que lista las preguntas y, debajo de la de catálogo, sus campos. El detalle D2 muestra cada opción con todos sus campos; el Excel, una columna por campo, todos, con «; » entre las opciones, y con «Solo las columnas visibles» **sigue a las columnas** de la planilla; el PDF, los de dato junto a la opción. Una respuesta de antes de los campos muestra «—». La tarjeta del chat queda como hoy. En inglés, con el nombre en inglés de la pregunta y del campo. |
| [CE6 · El circuito de punta a punta](evidence/catalogos-campos-extra/ce6-el-circuito.png) | **Elegido el 2026-10-21.** Crear el catálogo «Zonas», definir en Proveedores CUIT, Zona (de «Zonas») y Rubro, pegar 1.200 con esos campos, elegir que viaje el texto con el CUIT, cargarle a Juan su zona en «Editar usuario», filtrar «Pedir repuesto» por zona, Juan ve sus 14 en el celular, y la respuesta con el CUIT en la planilla, con lo que hacen la persona y el sistema. |

## Lo que se fijó al dibujar

El plan no lo decía; se resolvió con la opción más simple y quedó confirmado al elegir:

- en la planilla, los campos de papel «dato» se ven por defecto, después de su pregunta, y los de «filtro» se prenden en
  «Columnas»;
- el Excel trae todos los campos, uno por columna, con «; » entre las opciones; el PDF muestra los de dato junto a la opción;
- la tarjeta del chat queda como hoy;
- un campo en uso no se quita y dice dónde se usa; quitar uno con datos pide marcar «Sí, quitar el campo y sus N valores»;
- cambiar el tipo de un campo cargado revisa los valores, lista por fila los que no convierten y no deja guardar mientras
  alguno no convierta;
- a una persona sin el dato no se le manda el formulario: el envío se bloquea con su motivo, y la comprobación de publicar
  avisa antes quién quedaría sin poder recibirlo.

## Ajuste de la evaluación de impacto, 2026-10-21

La evaluación de impacto, back y front, cambió algunas pantallas. La elección no cambia; los tableros (versión 108 del lienzo)
y el navegable ya lo muestran, y las capturas de arriba son las ajustadas:

- **Una sola fuente de valores (CE1, CE4 y CE6).** El tipo «lista de valores» pasa a ser «elegir de un catálogo»: los valores
  del campo «Zona» y del dato de la persona «Zona» salen del catálogo «Zonas», escrito a mano. No hay un editor de valores
  propio, ni en el campo ni en el dato. El circuito arranca creando «Zonas».
- **Datos de las personas (CE4-A).** La pantalla muestra la tabla de personas con sus valores y tiene ruta plana,
  `/datos-de-personas`. La lista de usuarios no suma la columna «Zona». La sección «Datos» de «Editar usuario» se guarda aparte;
  si falla, el diálogo queda abierto con el error en esa sección.
- **Comprobación de publicar (CE4).** Lo que no puede funcionar frena: un campo inactivo, el papel o el tipo equivocado, un
  título de más de 30. El máximo por persona y quién queda sin el dato son avisos que no frenan, en una lista aparte.
- **Campo nuevo (CE1 y CE2).** Nace opcional, y su columna aparece apagada con «Guardá para cargar valores» hasta guardarlo.
  Pasarlo a obligatorio exige que todas las opciones activas tengan valor; si no, dice cuántas faltan. Un menú «Campos» muestra
  u oculta columnas en la tabla.
- **Respuestas (CE5).** Las subcolumnas de la planilla solo se muestran: no se ordenan, ni filtran, ni cuentan en las facetas.
  El detalle muestra todos los campos. El Excel con «Solo las columnas visibles» sigue a las columnas.
- **«En uso» (CE1)** mira el borrador y la versión activa de cada formulario.

## Ajuste de claridad, 2026-10-21

La vista previa del catálogo, al costado del editor, sigue a CA1-A
([ajuste de claridad](catalogos-mejoras.md#ajuste-de-claridad-2026-10-21)): por defecto, el campo cerrado con «Elegí una
opción»; al tocarlo, la lista; y arriba, «Una opción / Varias», que decide cada pregunta. CE1, CE2 y la sección del catálogo
de CE3-A (versión 110 del lienzo) ya lo muestran, y sus capturas de arriba son las ajustadas; en la sección del catálogo se
ve también la lista, como al tocarlo.

## Ajuste del review de E2, 2026-10-23

- **Quitar un campo que usa la presentación del propio catálogo (CE1 y CE3-B).** Ese uso ya no impide quitarlo: al
  quitarlo, sale también del título y de la descripción de «En WhatsApp» del borrador, y si el título queda vacío vuelve
  al texto de la opción. Los usos en el borrador o la versión activa de un formulario lo siguen impidiendo y se listan.
  «Restaurar el campo» lo devuelve a su lugar en «En WhatsApp» si la presentación no se editó después de quitarlo.
- **«En uso» como en CE1.** Cada pregunta que usa el campo aparece una vez y dice dónde: «Proveedor» en Pedir repuesto,
  en el borrador, en la versión activa o en la versión activa y en el borrador. Quien puede ver formularios tiene «Ir a la
  pregunta», que abre el formulario con esa pregunta del borrador abierta. El uso de «En WhatsApp» del propio catálogo no se muestra como un
  formulario: «También se saca de «En WhatsApp» de este catálogo.». Lo mismo vale para los usos de un guardado rechazado.
- **Usos de un campo sin permiso para ver formularios (CE1).** El formulario y la pregunta que usan un campo se nombran
  sólo a quien puede ver formularios (`formtemplates.read`). Sin ese permiso, cada formulario que lo usa se lista por su
  etapa, «La versión activa de un formulario» o «El borrador de un formulario», y el campo sigue sin poder quitarse.
- **Cambiar el tipo de un campo cargado (CE1 y CE2).** El editor ya no frena Guardar por el cambio: lo revisa el servidor
  sobre los valores guardados. Si alguno no convierte, se abre «Cambiar el tipo» como en CE1, armado con las filas que
  devuelve el servidor (hasta 50, con número, valor y motivo): muestra cinco y «Y N más.». «Ver los N en la tabla» deja en
  la tabla solo esas opciones, con un chip «Con error · N filas» que se quita para volver al listado; buscar, guardar o
  releer y adoptar también lo quitan. Cada celda queda marcada con su motivo hasta que se la edita; en el celular, donde la
  celda es texto, el motivo va debajo del valor. Mientras el cambio no
  se guarda, un valor que el control del tipo nuevo no admite se ve tal cual: en catálogo, en el buscador; en Sí/No y
  fecha, en un campo de sólo lectura con «Limpiar», que lo vacía para cargarlo con la casilla o la fecha. La lista de códigos
  que mostraba la sección «Campos» se retira.
- **Bajar el largo, cambiar el mínimo o el máximo, activar «Único» o restaurar un campo (CE1 y CE2).** El servidor revisa
  todos los valores guardados y devuelve el conteo y hasta 50 filas, como en un cambio de tipo, pero no se abre «Cambiar el
  tipo» ni se dice «De … a …». El mensaje va en el control que cambió (o junto a la fila del campo restaurado); el conteo, en
  «Campos», con «Ver los N en la tabla» a la derecha, que deja en la tabla solo esas opciones con el mismo chip. Cada celda
  queda marcada con su motivo hasta que se la edita; un valor repetido dice que se repite en otra opción activa.

- **El error de un valor en la tabla (CE2).** Como en el tablero, la celda queda marcada y una línea debajo de su fila
  dice la fila, el campo, el valor y el motivo: «Fila 3 · Plazo de pago (días): «30 días» no es un número entero.». Vale
  para un valor mal escrito antes de guardar y para las filas que devuelve el servidor; en el celular, el mismo motivo va
  bajo el campo del editor de la opción.
- **Más columnas a la derecha (CE2).** Mientras la tabla de opciones tiene columnas sin ver a la derecha, arriba a la
  derecha dice «La tabla se desplaza de costado: hay más columnas a la derecha.»; al llegar al final el texto se oculta sin
  mover la tabla, y una tabla que entra entera no lo muestra.
- **Ayudas de tipo y rango en el celular (CE2).** En el editor de la opción, cada campo entero, decimal o fecha dice su
  tipo y su rango debajo, con el formato común: «Entero, de 0 a 180.», «Fecha, hasta 31/12/2026.» o «Número decimal.» si
  no tiene rango. Un error del valor ocupa ese renglón.

## Lo que no se ve en las pantallas

«Datos de las personas» se ve en Administración y en «Editar usuario», pero lo maneja el módulo de formularios: la pantalla y
la sección «Datos» las aporta el módulo por un punto de extensión, y sin el módulo no aparecen. El núcleo de usuarios no sabe
de formularios. CE4-A lo dice en una nota.


## Cierre local de E2 — 2026-10-23

CE1, CE2, CE3-B, CE4-A y CE5 quedaron implementados con las rutas y controles productivos. La última corrida visual aprobó 719/719 pruebas; el navegador recorrió es/en a 390 y 320 px y se inspeccionó también evidencia de escritorio. Las capturas elegidas de arriba conservan sus bytes y no se actualizaron goldens para aceptar diferencias.

| Recorrido | Evidencia del comportamiento |
| --- | --- |
| CE1/CE2 | [Campos y valores](../../src/test/visual/catalogExtraFields.spec.ts): nuevo campo opcional con carga apagada hasta guardar, claves, tipos, fuente en otro catálogo, error por celda, menú Campos, foco y desplazamiento contenido; editor de opción en móvil. |
| CE1 · En uso | [Campos en uso](../../src/test/visual/catalogExtraFields.spec.ts) (es/en a 1440 y 390): «Quitar «Zona»» con una línea por pregunta y su etapa («en la versión activa y en el borrador»), «Ir a la pregunta» hacia el formulario y sin «Quitar el campo»; un uso que quedó sólo en la versión activa; el uso de «En WhatsApp» del propio catálogo, sin su nombre y sin impedir quitar. El golden del diálogo (`catalog-field-in-use-*`) se genera en la corrida visual del cierre. |
| CE4-A · Datos | [Datos de personas](../../src/test/visual/personData.spec.ts): tablas y sección reales, opciones sin CatalogsRead, foco y guardado parcial que conserva el diálogo y sus cambios. |
| CE3-B/CE4-A · Pregunta | [Presentación y destinatario](../../src/test/visual/catalogQuestionFields.spec.ts): heredar o elegir presentación propia; Juan ve 14 opciones y Pablo, sin el dato, no ve opciones. El estado y los avisos quedan visibles. |
| CE5 | [Campos históricos](../../src/test/visual/catalogResponseFields.spec.ts): subcolumnas por papel, nombres y tipos sellados, orden entre opciones, detalle y exportación sólo de las columnas visibles, incluso ocultando la pregunta base. |

Los controles se revisaron con teclado y a 320 px sin recortes; dos botones usan el ajuste responsive del Button compartido. El transporte y los datos del navegador son sintéticos. CE6 conserva la referencia del circuito, sin convertir escenas independientes en una prueba física de propagación. Los PDF y XLSX reales, migraciones, SQL y contratos tienen su [verificación del backend](../../../ArquitecturaBase/docs/features/formularios.md#verificación-local-de-e2--2026-10-23).

Se cerraron pestaña y servidores propios y se restauró el viewport. Aspire stop confirmó que no había AppHost en ejecución. El [piloto único con Meta](../../../ArquitecturaBase/docs/plans/verificacion-y-produccion.md#formularios-piloto-único-con-meta-después-de-e2) queda para después del review de E2; no se hizo en este desarrollo.
