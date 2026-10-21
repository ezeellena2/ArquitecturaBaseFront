# Campos extra de los catálogos: tableros elegidos

Fecha: **2026-10-21**. **Elegidos CE1, CE2, CE3-B, CE4-A, CE5 y CE6** de la versión 106 del lienzo; la 107 los marca y
suma a CE4-A la nota del módulo. Por programar.

Origen: la sección «Catálogos · campos extra, qué viaja a WhatsApp y filtrar por persona» de la página «Formularios por
WhatsApp» del Artifact [Sistema visual — ArquitecturaBase](https://claude.ai/artifact/HPbmDPLnr8JZ9TxevtTqJJ). Como el
Artifact es privado y puede cambiar fuera de Git, este documento y sus capturas congelan lo elegido. El alcance, el modelo de
datos y las decisiones están en el [plan](../../../ArquitecturaBase/docs/plans/formularios/catalogos-campos-extra.md); las
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
| [CE1 · Definir los campos](evidence/catalogos-campos-extra/ce1-definir-los-campos.png) | **Elegido el 2026-10-21.** Una sección nueva, «Campos», en el editor de un catálogo escrito a mano, entre el catálogo y las opciones; los de la base traen sus columnas. En reposo resume los campos, y «Editar campos» abre la tabla. Cada campo tiene nombre en español e inglés, una clave que no cambia después de guardar, un tipo (texto, entero, decimal, fecha, sí o no, o lista de valores), reglas (obligatorio, único y mínimo y máximo; en un texto, el largo) y un papel: filtro o dato. «Agregar campo» suma uno al final y lo abre debajo de su fila; las flechas ordenan las columnas de la tabla, la plantilla y el Excel; el tacho lo quita. Una lista de valores se carga una vez, con «Agregar valor» o «Pegar una lista», y un valor en uso no se quita. Quitar un campo con datos pide una casilla; uno en uso no se quita y dice dónde se usa; cambiar el tipo de uno cargado revisa los valores y lista por fila los que no convierten. En el celular, los campos van uno debajo del otro y cada uno se edita entero. Definirlos pide «Administrar catálogos»; con «Ver catálogos» se ven sin editar. |
| [CE2 · Cargar los valores](evidence/catalogos-campos-extra/ce2-cargar-los-valores.png) | **Elegido el 2026-10-21.** La tabla elegida en CA1-A suma una columna por campo, después del código, y cada celda se edita según su tipo: un texto, un número, una fecha, una casilla o, en una lista de valores, un desplegable en el que se busca escribiendo. Un error queda en la celda y la fila dice qué pasa («Fila 3 · Plazo de pago (días): «30 días» no es un número entero»); no deja guardar. Con muchas columnas, la tabla se desplaza de costado dentro de su caja, con la barra a la vista. La plantilla suma una columna por campo, con su tipo y sus reglas en la primera fila; pegar e importar validan cada celda por tipo, con fila y columna, en el mismo recorrido de CA2. En el celular, la opción se edita entera, con sus campos. En inglés, las columnas usan el nombre en inglés del campo, si lo tiene. |
| [CE3-B · Qué viaja a WhatsApp](evidence/catalogos-campos-extra/ce3-b-tambien-en-la-pregunta.png) | **Elegido el 2026-10-21.** En WhatsApp, cada opción tiene un título (hasta 30 caracteres) y una descripción (hasta 300), armados con uno o más campos, fijos o extra, separados por « · ». El catálogo define lo de siempre en su sección «En WhatsApp», junto al desplegable, que se actualiza al cambiarla; lo de hoy es el texto y el detalle. En una pregunta de catálogo, «En WhatsApp» ofrece «Como en el catálogo», por defecto, o «Propio de esta pregunta», con los mismos campos y las mismas reglas, y la vista previa lo muestra. Si alguna opción no entra en 30, avisa con las opciones afectadas; se puede guardar, y la comprobación de publicar lo frena y dice si el problema es del catálogo o de la pregunta. Lo que no se elige no sale del sistema. Un cambio vale para los envíos nuevos. En el catálogo pide «Administrar catálogos»; en la pregunta, «Administrar formularios», y se publica como cualquier cambio de la pregunta. |
| [CE4-A · Filtrar por persona](evidence/catalogos-campos-extra/ce4-a-datos-de-la-persona.png) | **Elegido el 2026-10-21.** «Datos de las personas», una pantalla nueva en Administración, define los datos que tiene cada persona, como Zona y Sucursal, con su lista de valores. Se cargan en «Editar usuario», en la sección «Datos», y la lista de usuarios puede mostrarlos como columna. Las dos cosas las aporta el módulo de formularios (abajo). En una pregunta de catálogo, «Qué opciones ve cada persona» filtra sobre los campos de papel «filtro»: según quien lo recibe («Zona es la zona de quien lo recibe») o fijo («Rubro es Frío»); los filtros se suman. «Como si lo recibiera: Juan Gómez · Zona Centro → 14 opciones» prueba con una persona, y la vista previa muestra lo suyo. La comprobación de publicar cuenta el máximo por persona («como mucho 18, Zona Sur») contra 200 y 20, y avisa quién quedaría sin poder recibirlo; al mandarle a alguien sin el dato, el envío se bloquea con el motivo. Cargar los datos de una persona pide «Administrar usuarios»; definirlos, un permiso propio del módulo; los filtros de la pregunta, «Administrar formularios». |
| [CE5 · Las respuestas](evidence/catalogos-campos-extra/ce5-las-respuestas.png) | **Elegido el 2026-10-21.** Los campos de la opción elegida se sellan al responder. La planilla suma, después de la pregunta, una columna por campo de dato («Proveedores a consultar · CUIT»), con las opciones en el mismo orden; los de filtro se prenden en «Columnas», que lista las preguntas y, debajo de la de catálogo, sus campos. El detalle D2 muestra cada opción con todos sus campos; el Excel, una columna por campo, todos, con «; » entre las opciones; el PDF, los de dato junto a la opción. Una respuesta de antes de los campos muestra «—». La tarjeta del chat queda como hoy. En inglés, con el nombre en inglés de la pregunta y del campo. |
| [CE6 · El circuito de punta a punta](evidence/catalogos-campos-extra/ce6-el-circuito.png) | **Elegido el 2026-10-21.** Definir CUIT, Zona y Rubro en Proveedores, pegar 1.200 con esos campos, elegir que viaje el texto con el CUIT, filtrar «Pedir repuesto» por zona, Juan ve sus 14 en el celular, y la respuesta con el CUIT en la planilla, con lo que hacen la persona y el sistema. |

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

## Lo que no se ve en las pantallas

«Datos de las personas» se ve en Administración y en «Editar usuario», pero lo maneja el módulo de formularios: la pantalla y
la sección «Datos» las aporta el módulo por un punto de extensión, y sin el módulo no aparecen. El núcleo de usuarios no sabe
de formularios. CE4-A lo dice en una nota.
