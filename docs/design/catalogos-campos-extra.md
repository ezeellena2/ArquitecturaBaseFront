# Campos extra de los catálogos: tableros elegidos

Fecha: **2026-10-21**. **Elegidos CE1, CE2, CE3-B, CE4-A, CE5 y CE6** de la versión 106 del lienzo; la 107 los marca y
suma a CE4-A la nota del módulo, la 108, el ajuste de la evaluación de impacto, y la 110, el de claridad (abajo). Por
programar.

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
| [CE1 · Definir los campos](evidence/catalogos-campos-extra/ce1-definir-los-campos.png) | **Elegido el 2026-10-21.** Una sección nueva, «Campos», en el editor de un catálogo escrito a mano, entre el catálogo y las opciones; los de la base traen sus columnas. En reposo resume los campos, y «Editar campos» abre la tabla. Cada campo tiene nombre en español e inglés, una clave que no cambia después de guardar, un tipo (texto, entero, decimal, fecha, sí o no, o **elegir de un catálogo**, cuyos valores salen de otro catálogo escrito a mano, como «Zonas»), reglas (obligatorio, único y mínimo y máximo; en un texto, el largo) y un papel: filtro o dato. «Agregar campo» suma uno al final y lo abre debajo de su fila, marcado «Nuevo, sin guardar»: **nace opcional**, y pasarlo a obligatorio exige que todas las opciones activas tengan valor; si no, dice cuántas faltan. Las flechas ordenan las columnas de la tabla, la plantilla y el Excel; el tacho lo quita. Quitar un campo con datos pide una casilla; uno en uso, en el borrador o en la versión activa de un formulario, no se quita y dice dónde se usa; cambiar el tipo de uno cargado revisa los valores y lista por fila los que no convierten. En el celular, los campos van uno debajo del otro y cada uno se edita entero. Definirlos pide «Administrar catálogos»; con «Ver catálogos» se ven sin editar. |
| [CE2 · Cargar los valores](evidence/catalogos-campos-extra/ce2-cargar-los-valores.png) | **Elegido el 2026-10-21.** La tabla elegida en CA1-A suma una columna por campo, después del código, y cada celda se edita según su tipo: un texto, un número, una fecha, una casilla o, en un campo que elige de un catálogo, un desplegable con sus opciones, en el que se busca escribiendo. Un error queda en la celda y la fila dice qué pasa («Fila 3 · Plazo de pago (días): «30 días» no es un número entero»); no deja guardar. Con muchas columnas, la tabla se desplaza de costado dentro de su caja, con la barra a la vista, y el menú **«Campos»** muestra u oculta columnas. Un campo nuevo **no se carga hasta guardarlo**: su columna aparece apagada, con «Guardá para cargar valores». La plantilla suma una columna por campo, reconocida por su clave, con su tipo y sus reglas en la primera fila; pegar e importar validan cada celda por tipo, con fila y columna, en el mismo recorrido de CA2, y en un campo que elige de un catálogo va el código o el texto de la opción. En el celular, la opción se edita entera, con sus campos. En inglés, las columnas usan el nombre en inglés del campo, si lo tiene. |
| [CE3-B · Qué viaja a WhatsApp](evidence/catalogos-campos-extra/ce3-b-tambien-en-la-pregunta.png) | **Elegido el 2026-10-21.** En WhatsApp, cada opción tiene un título (hasta 30 caracteres) y una descripción (hasta 300), armados con uno o más campos, fijos o extra, separados por « · ». El catálogo define lo de siempre en su sección «En WhatsApp», junto a la vista previa, que se actualiza al cambiarla; lo de hoy es el texto y el detalle. En una pregunta de catálogo, «En WhatsApp» ofrece «Como en el catálogo», por defecto, o «Propio de esta pregunta», con los mismos campos y las mismas reglas, y la vista previa lo muestra. Si alguna opción no entra en 30, avisa con las opciones afectadas; se puede guardar, y la comprobación de publicar lo frena y dice si el problema es del catálogo o de la pregunta. Lo que no se elige no sale del sistema. Un cambio vale para los envíos nuevos. En el catálogo pide «Administrar catálogos»; en la pregunta, «Administrar formularios», y se publica como cualquier cambio de la pregunta. |
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

## Lo que no se ve en las pantallas

«Datos de las personas» se ve en Administración y en «Editar usuario», pero lo maneja el módulo de formularios: la pantalla y
la sección «Datos» las aporta el módulo por un punto de extensión, y sin el módulo no aparecen. El núcleo de usuarios no sabe
de formularios. CE4-A lo dice en una nota.
