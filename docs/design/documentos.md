# Documentos por WhatsApp: tableros elegidos

Fecha: **2026-10-22**. **Elegidos DOC5-A y DOC7-A, con DOC1–DOC4 y DOC6**, de la versión 116 del lienzo; la 117 los marca
y suma las correcciones al elegir (abajo), la 118 agranda DOC5-A para que entren sus notas y la 119 deja DOC2 y DOC4 como
quedaron en el plan. Todos programados en el backend y el front del 2026-11-11 al 2026-11-13, con sus cohortes HTTP exportadas el 2026-11-17 (front 9aa157ae), salvo el porqué de un documento en el chat del operador (DOC2), que el chat todavía no dibuja. DOC1: la pantalla «Biblioteca», sin la lectura de documentos, llegó con la etapa 2
de ARCA (BI1-A, [motor para documentos](motor-para-documentos.md)), y la lectura en el editor y lo que lee cada estándar, al front
el 2026-11-11 ([cómo quedó](#doc1--la-biblioteca-y-la-lectura-2026-11-11)). DOC7-A, el
tablero de cada formulario, quedó programado en back y front el 2026-11-11 ([cómo quedó](#doc7-a--tarjetas-armadas-solas-2026-11-11)).
El mismo día se eligieron UC1-A y VC1-A, de un lienzo aparte, para la ubicación y el contacto que se comparten y varias cargas
desde un Excel ([abajo](#ubicación-y-contacto-por-whatsapp-w3-y-varias-cargas-desde-un-excel)), por programar.

Origen: la sección «Documentos por WhatsApp · biblioteca, lectura con IA, bandeja y tablero» de la página «Formularios por
WhatsApp» del Artifact [Sistema visual — ArquitecturaBase](https://claude.ai/artifact/HPbmDPLnr8JZ9TxevtTqJJ). Como el
Artifact es privado y puede cambiar fuera de Git, este documento y sus capturas congelan lo elegido. El alcance y las
decisiones están en el [plan](../../../ArquitecturaBase/docs/plans/2026-10-22-documentos-por-whatsapp.md), y las reglas de
lectura, en el [ADR 0022](../../../ArquitecturaBase/docs/decisions/0022-lectura-de-documentos-con-ia.md); las pantallas, los
textos y los estados salen de acá. Para recorrerlo tocando, la [maqueta viva](https://claude.ai/artifact/CM56W2Yc4VVzwMmxCKFpdP)
lo muestra dentro de las pantallas reales y tiene el circuito DOC en «Recorridos».

## Los tableros

DOC5 y DOC7 tenían dos conceptos. **Se eligieron DOC5-A**, la bandeja como planilla con el documento en un panel al
costado, **y DOC7-A**, el tablero de tarjetas que se arma solo. DOC5-B, la cola de revisión, y DOC7-B, un informe por
pregunta, son las alternativas que no se eligieron: se sacaron del lienzo para hacer lugar y siguen en el repo del
generador. DOC1–DOC4 y DOC6 tenían un solo concepto y valen para los elegidos: el aviso de los documentos parecidos de DOC6
va arriba de la planilla de DOC5-A.

| Captura | Qué define |
| --- | --- |
| [DOC1 · La biblioteca y la lectura](evidence/documentos/doc1-la-biblioteca-y-la-lectura.png) | **Elegido el 2026-10-22.** «Biblioteca», una pantalla nueva en Gestión de formularios, junto a Diseñar formularios: los formularios estándar del producto, hoy «Comprobante de transferencia», y los de las etapas siguientes como «Próximamente», sin acción. Cada estándar dice qué lee, sus validaciones fijas, su versión y en qué formularios propios está; se filtra por todos, disponibles o próximamente y se busca por nombre, en la dirección. «Agregar» pide el nombre y el prefijo y crea una copia propia en borrador; se puede agregar más de una vez («Pagos a proveedores» es otra copia del mismo estándar). En el editor, la sección **«Lectura de documentos»**: prenderla; de qué estándar y versión viene; «Cómo reconocerlo», la descripción para la IA, donde lo propio (de quién es la cuenta de destino) separa dos copias; los ejemplos, que suman las correcciones de la bandeja sin entrenar ningún modelo; qué pregunta recibe cada dato (cambiarle el nombre a una no corta la lectura; un dato sin pregunta no se lee); las validaciones fijas del estándar, con candado (los dígitos del CBU, el CVU y el CUIT; el banco sale de los primeros dígitos de la cuenta, con la tabla del BCRA como datos); el cruce con catálogos (Cliente por el CUIT de origen, en Clientes); los duplicados y cómo viene leyendo, por formulario y por dato. Un formulario propio sin estándar usa el mismo mecanismo, sin candados. Prender o cambiar la lectura se guarda en el borrador y sale al publicar. Pide «Diseñar formularios». |
| [DOC2 · Los tres casos y los otros formatos](evidence/documentos/doc2-los-tres-casos-y-los-otros-formatos.png) | **Elegido el 2026-10-22.** Juan manda el comprobante por WhatsApp, con texto o sin él. Se lee solo lo de cuentas vinculadas y activas con permiso de cargar respuestas, y se clasifica entre los formularios con lectura que esa persona puede completar; si el que encaja no se le puede mandar, lo dice y deriva (DOC4). **Seguro:** «Recibí un comprobante de transferencia de $150.000 del Galicia. ¿Lo cargo?» con «Abrir formulario», prellenado y con el comprobante adjunto. **Duda:** «¿Qué es este documento?» con hasta 3 botones; con dos posibles, el tercero es «Otro», y con la elección sigue como el seguro. **No lo reconoce:** «No reconocí este documento. ¿Qué querés cargar con él?» con la lista de lo que esa persona puede completar y «Otro», que lo deja «Sin clasificar» y lo anota en Formularios que faltan. El sistema guarda la foto como copia privada y valida sin IA el CBU, el CUIT y los duplicados; en el chat del operador el documento es un mensaje más, con «Por qué lo propuso» o «Por qué preguntó» debajo, como en AS4. **Los otros formatos:** un PDF (se lee entero, hasta el tope), un Word y un Excel con varias filas, donde cada fila es una carga; la ubicación y el contacto que se comparten no pasan por la IA y completan las preguntas elegidas en el editor del formulario abierto («Dirección de entrega», «Recibió» y «Teléfono de quien recibe» en «Registrar entrega»), que se vuelve a mandar. Los mensajes van en el idioma de la persona. Desde el 2026-11-11, la ubicación, el contacto y las cargas de un Excel los fijan UC0 a UC6 y VC1 a VC5 ([abajo](#ubicación-y-contacto-por-whatsapp-w3-y-varias-cargas-desde-un-excel)), y los tres desplegables pasan a la zona de UC1-A. |
| [DOC3 · El formulario prellenado](evidence/documentos/doc3-el-formulario-prellenado.png) | **Elegido el 2026-10-22.** El Flow de siempre, completo con lo leído y el aviso «Lo completamos con el comprobante que mandaste. Revisá lo marcado antes de confirmar.»: lo dudoso, con «Revisá» y el borde de atención; lo que no se leyó, vacío con «No se leyó» (si la pregunta es obligatoria, no deja confirmar); el comprobante, ya adjunto en su pregunta de documento, con «Cambiar documento». Al confirmar se vuelven a revisar el CBU, el CVU, el CUIT y los duplicados con lo corregido; lo que no pasa no se guarda y dice por qué («Revisá la cuenta: los números no dan. Copiala del comprobante.»). Cada corrección queda registrada: el dato propuesto, el confirmado y quién. En el chat, la tarjeta de siempre, con el comprobante como archivo de la respuesta; en el detalle, la lectura: qué reconoció, qué se corrigió o completó y qué se validó sin IA. |
| [DOC4 · Los casos difíciles](evidence/documentos/doc4-los-casos-dificiles.png) | **Elegido el 2026-10-22.** Una foto movida, oscura o cortada: no adivina, pide otra diciendo qué dato falta. Un PDF con contraseña: no se abre ni se pide la contraseña; pide uno sin contraseña o una captura. Un repetido (el mismo archivo, o la misma operación, monto y fecha): avisa cuándo y en qué respuesta se cargó, sin IA. Un CBU mal leído: la validación fija lo rechaza y la cuenta llega marcada; no se puede confirmar así. **Un formulario que no se le puede mandar**, como «Pagos a proveedores» a Pablo, que no tiene zona: el documento se lee y se reconoce, pero a la persona le falta el dato con el que se filtra el catálogo (CE4-A) y nunca se manda la lista entera; contesta «Gracias, recibí tu comprobante de $412.000. No lo puedo cargar desde acá: se lo pasé a una persona del equipo para que lo revise.», deriva la conversación como en AS4 y el documento queda propuesto, con lo leído, para alguien del equipo. Un Word o un Excel de formato viejo, un Excel con macros o con contraseña: no se abren ni van a la IA, y se pide un PDF o una versión sin macros ni contraseña. **Un número sin cuenta vinculada**, como Carlos Díaz: no se lee ni se le contesta; queda en el chat para un operador, con la línea «No se leyó: el número no tiene una cuenta vinculada. Lo atiende un operador.», y no entra en la bandeja. |
| [DOC5-A · La planilla con panel](evidence/documentos/doc5-a-la-planilla-con-panel.png) | **Elegido el 2026-10-22.** «Documentos recibidos», debajo de Formularios en el panel de Gestión de formularios, con cuántos esperan a alguien del equipo. Una planilla como la de respuestas: cada documento es una fila con su miniatura, cuándo llegó, quién lo mandó, el formulario, los datos leídos que sirven para encontrarlo (monto, banco o CUIT), el estado y la respuesta. Se busca por monto (con o sin puntos), CUIT u operación, también en lo que no se cargó; se filtra por formulario, quién lo mandó, cuándo llegó y estado (propuesto, sin clasificar, confirmado o descartado, con cuántos hay), y todo vive en la dirección, con la página y el documento abierto. Un sin clasificar o un descartado se borra a los 90 días, con su lectura, y su fila dice cuándo. El documento se abre en un panel al costado, como la vista rápida D2: arriba el documento (acercar, girar, páginas y descargar); abajo el formulario que reconoció la IA, con su seguridad (cambiarlo vuelve a leer los datos para ese formulario), los datos, el historial, «Descartar», con confirmación y que se puede volver a abrir, y «Pasar al formulario», que guarda la respuesta con lo revisado, deja registradas las correcciones y pasa el documento a «Confirmado», con su número. ↑ ↓ recorren la planilla. **Para revisar acá** queda un propuesto que venció sin que la persona lo confirmara en WhatsApp, como el comprobante del Macro que mandó Pablo. En el celular, la tabla se desplaza de costado y el documento abre en su pantalla, con las acciones abajo. Dos permisos nuevos: «Ver documentos recibidos» y «Revisar documentos» (corregir, pasar al formulario y descartar); con solo ver, el documento y sus datos se ven sin poder cambiarlos. La respuesta dice en su origen de qué documento salió y quién la revisó. |
| [DOC6 · Armar formulario con la IA](evidence/documentos/doc6-armar-formulario-con-la-ia.png) | **Elegido el 2026-10-22.** Para lo que no encaja en ningún formulario: desde el aviso de los parecidos («Llegaron 5 documentos parecidos que no encajan en ningún formulario: tickets de combustible. ¿Armamos un formulario?») o desde un sin clasificar, en su panel. La IA propone el formulario entero: el nombre, el prefijo, el texto del botón, «Cómo reconocerlo» y una pregunta por cada dato que se repite, con su tipo y lo que leyó en el primero para comparar; se cambian, se quitan o se suman, con los documentos que lo originaron a la vista. Si se parece a un estándar de la biblioteca, lo sugiere antes («Agregar el estándar» o «Armar igual con la IA»). «Crear borrador» lo crea con la lectura prendida y abre el editor; se publica como cualquiera, con su comprobación, y la IA nunca publica ni aprueba (ADR 0019). Al publicar, esos documentos quedan propuestos en la bandeja y los próximos se reconocen solos. Mientras arma se puede salir y volver; si falla, no queda nada a medias. Pide «Revisar documentos» y «Diseñar formularios»; con uno solo, el botón no aparece. |
| [DOC7-A · Tarjetas armadas solas](evidence/documentos/doc7-a-tarjetas-armadas-solas.png) | **Elegido el 2026-10-22.** La pestaña «Tablero», junto a Respuestas en la página de cada formulario, con el permiso de leer respuestas: quien solo aprueba no la ve. Los filtros son los de la planilla (recibida, quién cargó, estado y cualquier pregunta), viven en la dirección y se comparten con Respuestas; lo que va por período se agrupa por día, semana o mes. Arriba, los números: cuántas llegaron y, de cada pregunta de número o monto, total, promedio, mínimo y máximo, contra el período anterior. Abajo, una tarjeta por gráfico, armada sola con los tipos de las preguntas: cuántas llegaron por período (los días sin actividad, en un tono suave), los montos por período, el reparto de cada pregunta de elegir o de catálogo, quién cargó cuánto y por estado. «Agregar gráfico» ofrece las preguntas que no tienen tarjeta con lo que se puede contar de cada una, y «Volver al automático» lo deja como al principio. El menú de cada tarjeta cambia la cuenta, la muestra como tabla o la quita. Los ajustes son de cada persona, como las columnas de la planilla, y no hay tableros en el código: salen de los tipos de las preguntas y de los valores con tipo de las respuestas. En el celular, una tarjeta debajo de la otra y los filtros en un botón. |

## Lo que se fijó al dibujar

El plan no lo decía; se resolvió con la opción más simple y quedó confirmado al elegir:

- un nombre de formulario de más de 20 caracteres, lo que admite un botón de WhatsApp, hace que la pregunta de la duda vaya
  como lista;
- la lista de «no lo reconoce» entra en las 10 filas de una lista de WhatsApp, con «Otro» al final;
- de una planilla se proponen hasta 3 filas por mensaje, el tope de acciones del asistente;
- la ubicación y el contacto vuelven a mandar el formulario abierto, completado, y dicen qué preguntas completaron; sin
  una pregunta elegida en el editor, quedan en el chat, como hoy;
- un documento que no se lee deja una línea en el chat del operador y no entra en la bandeja;
- el aviso de los parecidos aparece con tres o más sin clasificar que se parecen;
- en el tablero, un monto con moneda se cuenta por moneda, y el nombre del número lo dice: «Total de Monto (pesos)».

## Correcciones al elegir

Al elegir se corrigió quién se lee y el ejemplo de «para revisar acá». La elección no cambia; los tableros (versión 119 del
lienzo) y la maqueta ya lo muestran, y las capturas de arriba son las corregidas:

- **Quién se lee (DOC2 y DOC4).** Solo lo de cuentas vinculadas y activas con el permiso de cargar respuestas, el mismo que
  pide mandarles un formulario desde el chat. Una cuenta sin ese permiso no tiene formularios posibles: no se lee, lo dice y
  deriva; está en el plan y no se dibuja.
- **Un formulario que no se le puede mandar (DOC4).** Es un caso aparte: a Pablo, sin zona, no se le puede mandar «Pagos a
  proveedores», que filtra los proveedores por la zona de quien lo recibe. Su documento se lee y se reconoce; lo dice y
  deriva, y nunca se manda la lista entera.
- **Un número sin cuenta vinculada (DOC4).** Carlos Díaz queda en el chat de Ana, sin leerse, para un operador.
- **Para revisar acá (DOC5-A).** Junta los propuestos que vencieron sin que la persona los confirmara en WhatsApp, como el
  comprobante del Macro de Pablo, y las filas de una planilla que pasaron el tope. Los pasa al formulario alguien con
  «Revisar documentos».

## Ubicación y contacto por WhatsApp (W3) y varias cargas desde un Excel

Fecha: **2026-11-11**. **Elegidos UC1-A y VC1-A**, los recomendados, y programados el 2026-11-12 y el 2026-11-13: son las tareas 19 a 30 del
[plan](../../../ArquitecturaBase/docs/plans/2026-10-22-documentos-por-whatsapp.md#ubicación-y-contacto-por-whatsapp-w3-y-varias-cargas-desde-un-excel),
después de las tareas 1 a 16 y antes del cierre. Es lo que la implementación de DOC1 a DOC7 dejaba afuera, aunque DOC2 lo había
dibujado: la ubicación y el contacto que la persona comparte por su cuenta mientras tiene un formulario abierto (W3 de la
[pregunta «Ubicación»](ubicacion-en-formularios.md#etapa-2-por-whatsapp-w1-a)) y varias cargas desde un Excel. Las reglas, el
modelo de datos y las tareas están en el plan; las pantallas, los textos y los estados salen de acá.

Lienzo: [Ubicación, contacto y varias cargas por WhatsApp](https://claude.ai/artifact/Sv9qPDk5H6xbRabJqUT77w), de tipo Design.
Se armó aparte porque el [Sistema visual](https://claude.ai/artifact/HPbmDPLnr8JZ9TxevtTqJJ) es de otra cuenta y no se abre desde
Claude Code, y se dibujó sobre DOC2, DOC4 y DOC5-A, W1-A y el tope de tres acciones de
[casos del asistente](../../../ArquitecturaBase/docs/plans/2026-10-21-casos-del-asistente.md), sin reabrirlos: cómo llegan las
cargas al teléfono (un aviso y una carga por fila, cada una con «Abrir formulario») y el primer teléfono de un contacto ya los
había fijado DOC2. Como el lienzo es privado y puede cambiar fuera de Git, esta sección congela lo elegido. Los tableros pasan al
Sistema visual cuando se pueda abrir, y ahí se suman sus capturas, como las de DOC1 a DOC7.

### Los tableros

UC1 y VC1 tenían varios conceptos. **Se eligieron UC1-A**, una zona propia en el editor, **y VC1-A**, una entrada por fila en
«Documentos recibidos»; UC1-B, UC1-C y VC1-B son las alternativas que no se eligieron. Los demás tableros tenían un solo concepto
y valen para los elegidos.

| Tablero | Qué define |
| --- | --- |
| UC0 · Qué hace una ubicación o un contacto que llega | La regla y su orden, sin IA. Una ubicación completa primero un pedido de W1-A que la espera, del operador o del asistente, sin cambios; si no hay, va al envío abierto más viejo que eligió una pregunta para la ubicación, y le vuelve el formulario completado; si no, queda en el chat, como hoy. Un contacto va al envío abierto más viejo que eligió preguntas para el contacto; si no, queda en el chat, ahora legible, con el nombre y los teléfonos. En todos los caminos, el más viejo primero y lo primero vale; un número sin cuenta vinculada no tiene envíos abiertos. |
| UC1-A · Una zona propia en el editor | **Elegido el 2026-11-11.** «Ubicación y contacto», debajo de «Preguntas» y de «Lectura de documentos», con la (i) en el título y tres renglones con la etiqueta arriba (IA1-A): «Ubicación», «Nombre del contacto» y «Teléfono del contacto», cada uno con un desplegable de las preguntas de texto. Aparece sólo con «En la app y por WhatsApp». La ubicación y el contacto no pasan por la IA ni dependen de leer documentos: «Registrar entrega» los usa sin prender la lectura, que pide «Cómo reconocerlo». Una cosa, una zona: los tres se ven juntos, y una pregunta «Ubicación» cambia un solo renglón. En contra: una zona más en un editor largo. |
| UC1-B · Dentro de «Lectura de documentos», como DOC2 | No se eligió. Los mismos desplegables, como un grupo dentro de la zona de la lectura y con la etiqueta al costado: lo que dibujó DOC2 el 2026-10-22, antes de que existiera la pregunta «Ubicación». Junta lo que lee la IA con lo compartido sin IA, la zona se llama «Lectura de documentos» aunque esté apagada y, si el grupo sólo se ve con la lectura prendida, obliga a escribir «Cómo reconocerlo». |
| UC1-C · En cada pregunta | No se eligió. «Se completa con lo que se comparte» en el editor de cada pregunta de texto, con la línea de la pregunta que lo dice y las opciones tomadas apagadas. Va con la pregunta, sin zona nueva, pero lo del formulario queda repartido (hay que abrir cada pregunta para saber quién recibe qué), suma un dato a cada línea y apaga opciones lejos de la pregunta que las tiene. |
| UC1-A · El editor entero: estados | El editor con la zona y el desplegable abierto: «Ninguna», las preguntas de texto y, apagadas, las que tomó otro renglón, con «· Recibe …». Un formulario con una pregunta «Ubicación», con el renglón de la ubicación apagado y su motivo encima; «Sólo en la app», sin la zona; sólo lectura, y el celular. |
| UC2 · La ubicación completa el formulario abierto (W3) | «Registrar entrega», mandado por Ana Pérez; Juan comparte un lugar con el clip. El mensaje que vuelve dice qué pregunta completó y de qué formulario, y el formulario trae la dirección o, si mandó su ubicación actual, el punto. En el chat de la app, la ubicación como en W1-A, el reenvío con «Prellenado con» y la respuesta; en la actividad del detalle, «Llegó la ubicación · Completó «Dirección de entrega»» y «Se volvió a mandar el formulario». |
| UC3 · El contacto completa el formulario abierto | El asistente había mandado «Registrar entrega» prellenado con la dirección; Juan comparte un contacto con dos teléfonos. El formulario vuelve con lo que ya tenía más el nombre y el primer teléfono. La burbuja nueva del contacto en el chat de la app, y la actividad: «Llegó el contacto · Completó «Recibió» y «Teléfono de quien recibe»». |
| UC4 · Sin formulario que completar, con un pedido W1-A y sin cuenta | Sin un envío abierto que lo reciba, o sin preguntas elegidas, no se contesta nada y los mensajes quedan en el chat, con «Contacto» en la lista de chats. El pedido de W1-A aparece como contexto, sin redibujarse. Lo de un número sin cuenta vinculada queda para un operador, sin la línea de DOC4. |
| UC5 · Dos formularios abiertos y la ubicación que llega dos veces | «Registrar entrega» y «Retiro de envases» abiertos: la primera ubicación va al más viejo, la segunda al otro y la tercera queda en el chat. Una sola respuesta por envío: Juan responde el formulario anterior y se guarda; si después responde el nuevo, no se guarda y el chat lo dice. |
| UC6 · En inglés | El teléfono, el chat de la app, la zona del editor con su (i) y la actividad, con el menú en inglés y las fechas en `MM/dd/yyyy`. |
| VC1-A · Una entrada por fila | **Elegido el 2026-11-11.** En «Documentos recibidos», cada fila que se vuelve una carga es una entrada: la planilla como su archivo, con «Fila 5» en gris debajo (la excepción A de un dato por columna), y su formulario, su monto, su estado y su respuesta. El panel cambia el visor por «La fila», con los encabezados y los valores como llegaron (`DataList`), y «Descargar la planilla»; lo demás es el panel de DOC5-A. Cada fila tiene su estado, su respuesta, su historial y su búsqueda por monto, la bandeja sigue con un dato por columna y ↑ ↓ recorren las filas, sin un panel nuevo. En contra: una planilla grande llena la bandeja de renglones del mismo archivo; el plan la acota a 50 filas. |
| VC1-B · Una entrada por planilla | No se eligió. La planilla es un documento, como «pagos-semana.xlsx» en DOC5-A, y sus filas viven en una tabla del panel, con «Revisar» por fila y «Pasar las 4 al formulario». La planilla aparece una vez y se pueden pasar varias juntas, pero rompe un dato por columna (el monto, el estado y la respuesta de siete filas en una celda), la búsqueda encuentra la planilla y no la fila, y suma un panel con su propia revisión adentro. |
| VC2 · Siete filas: tres cargas y el resto para el equipo | Marta manda «cobranzas-semana.xlsx». El aviso; las tres cargas («1 de 3 · $95.000 · Ferretería Norte», con «Cobranzas · prellenado» en el pie); la carga 2 abierta, con su marca de duda (DOC3); el chat de la app con «Por qué lo propuso» y el enlace a la bandeja, y la actividad de una respuesta que salió de una fila, mandada a la persona o pasada por el equipo. |
| VC3 · La bandeja con las filas | La bandeja entera, con el panel de una fila «Para revisar» y el aro de «Pasando…», el contador del menú, una fila que espera a la persona («Descartar» y «Pasar al formulario» apagados, con su motivo encima), el historial de una confirmada y el celular. |
| VC4 · Casos difíciles de una planilla | Filas de dos formularios, una repetida, una que no encaja, la misma planilla otra vez (descartada con su motivo, como un documento repetido), ninguna fila que encaja («No lo reconoce» de DOC2) y un número sin cuenta vinculada (la línea de DOC4). |
| VC5 · En inglés | El teléfono, el chat con «Why it proposed this» y la bandeja con «Row 5», «To review», «The row» y el motivo de una fila que espera a la persona. |

### Los textos

**A · La ubicación y el contacto**

| Dónde | Español | Inglés |
| --- | --- | --- |
| WhatsApp, la ubicación completó (el texto de DOC2, con el formulario) | Puse tu ubicación en «{pregunta}». Revisá el formulario «{formulario}» y confirmalo. | I put your location in “{question}”. Check the form “{form}” and confirm it. |
| WhatsApp, el contacto completó | Puse el contacto en «{pregunta}» y «{pregunta}». Revisá el formulario «{formulario}» y confirmalo. | I put the contact in “{question}” and “{question}”. Check the form “{form}” and confirm it. |
| El botón (ya existe) | Abrir formulario | Open form |
| Chat, el reenvío (ya existe; el autor es el remitente del envío, el operador o «Asistente») | Prellenado con | Prefilled with |
| Chat, nombre accesible de la burbuja del contacto | Contacto: {nombre} | Contact: {name} |
| Lista de chats, vista previa | Contacto | Contact |
| Chat, un contacto que ya no se conserva (como «Mensaje de ubicación») | Mensaje de contacto | contact message |
| Chat, la segunda respuesta del mismo envío | No se guardó: el envío ya tiene su respuesta, {número}. | Not saved: the send already has its response, {number}. |
| Actividad, la ubicación de W3 (el renglón de W1-A con su detalle) | Llegó la ubicación · Completó «{pregunta}» | Location received · Filled in “{question}” |
| Actividad, el contacto | Llegó el contacto · Completó «{pregunta}» y «{pregunta}» | Contact received · Filled in “{question}” and “{question}” |
| Actividad, el reenvío | Se volvió a mandar el formulario | Form sent again |
| Editor, título de la zona | Ubicación y contacto | Location and contact |
| Editor, la (i) del título | La ubicación o el contacto que la persona comparte en el chat completan estas preguntas del formulario que tiene abierto, y el formulario le vuelve a llegar completado. Sin una pregunta elegida, quedan en el chat. | The location or contact the person shares in the chat fills in these questions of the form they have open, and the form comes back to them filled in. With no question chosen, they stay in the chat. |
| Editor, renglones | Ubicación · Nombre del contacto · Teléfono del contacto | Location · Contact name · Contact phone |
| Editor, opción vacía | Ninguna | None |
| Editor, opción tomada por otro renglón | {pregunta} · Recibe la ubicación / · Recibe el nombre del contacto / · Recibe el teléfono del contacto | {question} · Gets the location / · Gets the contact name / · Gets the contact phone |
| Editor, motivo del renglón apagado con una pregunta «Ubicación» | La ubicación va a la pregunta «{pregunta}», que se pide antes de mandar el formulario. | The location goes to the “{question}” question, which is asked for before the form is sent. |

Las preguntas se juntan como en el resto de los textos: «A», «A» y «B», «A», «B» y «C» (en inglés, “A” and “B”).

**B · Varias cargas desde un Excel**

| Dónde | Español | Inglés |
| --- | --- | --- |
| WhatsApp, el aviso, primera frase | Recibí una planilla con {n} filas de «{formulario}». | I got a spreadsheet with {n} rows of “{form}”. |
| El aviso, primera frase con filas de varios formularios | Recibí una planilla con {n} filas. | I got a spreadsheet with {n} rows. |
| El aviso, van todas | Te preparé un formulario por cada una: revisalos y confirmalos. | I prepared a form for each one: check them and confirm them. |
| El aviso, pasan el tope | Te preparé un formulario para cada una de las 3 primeras: revisalos y confirmalos. | I prepared a form for each of the first 3: check them and confirm them. |
| El aviso, una sola carga | Te preparé el formulario: revisalo y confirmalo. | I prepared the form: check it and confirm it. |
| El aviso, una repetida | La fila {n} ya se cargó el {fecha} en {número}: no la cargo de nuevo. | Row {n} was already loaded on {date} in {number}: I won't load it again. |
| El aviso, varias repetidas | Las filas {n} y {m} ya se cargaron: no las cargo de nuevo. | Rows {n} and {m} were already loaded: I won't load them again. |
| El aviso, para el equipo | Las otras {m} se las pasé a una persona del equipo. | I passed the other {m} to a person on the team. |
| El aviso, para el equipo, una sola | La otra se la pasé a una persona del equipo. | I passed the other one to a person on the team. |
| WhatsApp, una planilla de más de 50 filas (lo sumó el plan) | Por acá cargo planillas de hasta 50 filas. Dividila y mandámela de nuevo. | I load spreadsheets of up to 50 rows here. Split it and send it to me again. |
| La carga, cuerpo | {i} de {k} · {resumen de la fila} | {i} of {k} · {row summary} |
| La carga, pie (hasta 60 caracteres, el tope de Meta) | {formulario} · prellenado | {form} · prefilled |
| Ninguna fila encaja (DOC2, adaptado) | No reconocí las filas de esta planilla. ¿Qué querés cargar con ella? | I didn't recognize the rows of this spreadsheet. What do you want to load with it? |
| El botón de la lista (DOC2) | Elegir formulario | Choose form |
| El aviso del formulario prellenado (DOC3, adaptado) | Lo completamos con la planilla que mandaste. Revisá lo marcado antes de confirmar. | We filled it in with the spreadsheet you sent. Check what is marked before confirming. |
| Chat, «Por qué lo propuso» (DOC2) | Reconoció · {n} filas de {formulario}, seguro / Mandó · Filas 2, 3 y 4 / Para el equipo · Filas 5 a 8 / Repetidas · Fila {n}, ya en {número} | Recognized · {n} rows of {form}, sure / Sent · Rows 2, 3 and 4 / For the team · Rows 5 to 8 / Repeated · Row {n}, already in {number} |
| Chat, el enlace | Ver en Documentos recibidos | View in Received documents |
| Bandeja, detalle del archivo | Fila {n} | Row {n} |
| Bandeja, detalle del archivo con varias hojas | {hoja} · fila {n} | {sheet} · row {n} |
| Bandeja, estado del propuesto que espera al equipo | Para revisar | To review |
| Panel, por qué espera al equipo | Pasó el tope de 3 cargas por mensaje. | It went over the limit of 3 loads per message. |
| Panel, una fila que no encaja | No encaja en ningún formulario. | It does not fit any form. |
| Panel, una fila que la IA no llegó a leer (`unseen`) · su paso del historial | La IA no llegó a leerla. · Llegó y la IA no llegó a leerla | The AI did not get to read it. · Arrived and the AI did not get to read it |
| Panel, una repetida | Repetida: el mismo dato {dato} que {número}. · Repetida: los mismos datos {datos} que {número}. | Repeated: the same {field} as {number}. |
| Panel, la zona y su botón | La fila · Descargar la planilla | The row · Download the spreadsheet |
| Panel, motivo de «Descartar» y «Pasar al formulario» apagados | Le mandamos esta fila a {persona}. Si no la confirma hasta el {fecha y hora}, la podés revisar acá. | We sent this row to {person}. If they do not confirm it by {date and time}, you can review it here. |
| Historial de la fila | Llegó en {archivo}, fila {n}, por WhatsApp de {persona}. · La IA la reconoció: {formulario}, seguro. Leyó {a} de {b} datos. · Se la mandó prellenada a {persona}, como {i} de {k}. · Pasó el tope de 3 cargas por mensaje: quedó para revisar acá. · {persona} la confirmó: {número}, sin correcciones. | Arrived in {file}, row {n}, via WhatsApp from {person}. · The AI recognized it: {form}, sure. It read {a} of {b} data. · Sent prefilled to {person}, as {i} of {k}. · It went over the limit of 3 loads per message: left to review here. · {person} confirmed it: {number}, without corrections. |
| Actividad de la respuesta | Salió de una planilla · {archivo}, fila {n} | Came from a spreadsheet · {file}, row {n} |
| Actividad, si la pasó el equipo | La pasó al formulario {persona} · Desde «Documentos recibidos» | {person} passed it to the form · From “Received documents” |

Fechas sólo con números: `dd/MM/yyyy` en español y `MM/dd/yyyy` en inglés, con la hora como en el resto de la app. En inglés la
planilla es «spreadsheet», como en el resto de la app, donde «sheet» es la planilla de respuestas o una hoja: el lienzo decía
«sheet» y se corrigió al registrarlo. El lienzo no dibuja el aviso ni el motivo de una fila igual a otra de la misma planilla (B5):
nombran esa otra fila en lugar de la respuesta, y su texto lo fijan las tareas 29 y 30 por lo más simple.

### Decisiones de detalle

Lo que las dos elecciones no fijaban se resolvió por lo más simple y quedó dibujado. El tope, el aviso, los ofrecimientos y el
orden de la ubicación se confirmaron con las otras sesiones de la tanda; donde el plan las precisó contra el código va lo del plan
(abajo, las correcciones). No se vuelven a preguntar.

**A · La ubicación y el contacto**

1. **El orden vive con W1-A.** Una ubicación que la persona manda por su cuenta completa primero un pedido de W1-A que la espera,
   del operador o del asistente; si no hay, va al envío abierto más viejo que eligió una pregunta para la ubicación; si no, queda
   en el chat. Un contacto va al envío abierto más viejo que eligió preguntas para el contacto.
2. **Un envío abierto** salió por WhatsApp, no tiene respuesta, no venció y ya existía cuando llegó lo compartido. Uno que espera
   la ubicación de W1-A todavía no salió: no toma un contacto. Un número sin cuenta vinculada no tiene envíos: lo que manda queda
   en el chat, sin la línea de DOC4.
3. **Lo primero vale.** Un envío toma una sola ubicación y un solo contacto; lo que llega después va al siguiente que lo pueda
   usar o queda en el chat. No pasa por la IA ni gasta cupos.
4. **Qué se escribe:** la dirección del lugar si vino o, si no, el punto («-32.947102, -60.638955», como la pregunta
   «Ubicación»); del contacto, el nombre y el primer teléfono de la primera tarjeta, tal como vienen (si es otro, la persona lo
   cambia en el formulario). Un contacto sin nombre o sin teléfono completa lo que trae, y el mensaje nombra sólo esa pregunta. Se
   corta en el largo de la pregunta y reemplaza lo prellenado.
5. **El formulario vuelve en el mismo envío:** otro Flow del envío, con lo que ya tenía más lo compartido, del mismo remitente y
   con su sello, como el Flow que sigue a la ubicación en W1-A. El mensaje de DOC2 suma el nombre del formulario, como todo
   mensaje que lo abre desde el 2026-11-07. «Por qué lo mandó» va sólo en el primero; en el chat, el reenvío lleva «Prellenado
   con» (la etiqueta y el valor), que se ve como «Por qué lo mandó»: con `formrecords.read` y mientras se conserva el contenido.
   No es otra oferta, no entra a «Documentos recibidos» y no cambia el perfil del Flow.
6. **Si cambió el modo.** El reenvío sale como cualquier mensaje de su remitente: el del operador, mientras la conversación siga
   en Atención manual; el del asistente, mientras siga en Asistente con la revisión que selló, así que no vuelve si una persona
   tomó la conversación. Si ya no puede salir, lo compartido no va a ese envío: va al siguiente o queda en el chat. Si el modo
   cambia después, la reserva frena el reenvío, como en W1-A, y se ve como cualquier mensaje que no salió.
7. **Una sola respuesta por envío:** la primera que llega, del Flow anterior o del nuevo. La otra no se guarda y el chat dice
   cuál quedó; a la persona no se le avisa, como hoy un rechazo.
8. **El contacto se ve:** deja de ser «Mensaje de otro tipo». El chat muestra el nombre y los teléfonos, uno por renglón, y la
   lista de chats dice «Contacto».
9. **El editor.** Cada renglón ofrece las preguntas de texto, corto o largo, fuera del bloque; la elegida en otro renglón aparece
   apagada, con «· Recibe …». Quitar la pregunta o cambiarle el tipo vuelve el renglón a «Ninguna»; cambiarle el nombre no
   cambia nada. Se guarda con el borrador y sale al publicar. Con «Sólo en la app» la zona no aparece y lo elegido queda guardado.
10. **Con una pregunta «Ubicación»** la ubicación va ahí, por W1-A: el renglón de la ubicación queda apagado, con su motivo
    encima (MA1-A).
11. **Lo demás no cambia:** lo que se escribe es una respuesta de texto, así que la planilla, el Excel, el PDF y el detalle no
    suman insignias; la actividad del detalle dice qué se completó.

**B · Varias cargas desde un Excel**

1. **Un aviso y una carga por fila,** hasta tres por planilla, en el orden de la planilla. El tope cuenta las cargas propuestas,
   no los mensajes: el aviso es un texto fijo que suma el canal al aplicar las propuestas, no lo escribe el modelo y no cuenta.
   Cada planilla es un mensaje: dos seguidas tienen tres cargas cada una.
2. **El aviso dice las filas y el formulario** («7 filas de «Cobranzas»») en lugar del tipo de documento, porque un formulario
   propio no trae el nombre de su documento; con filas de varios formularios, sólo cuántas, y cada carga dice el suyo en el pie.
3. **Lo que va al equipo, en una frase:** junta las que pasan el tope, las que no encajan y las que no se le pueden mandar
   (CE4-A).
4. **Cada fila se clasifica sola:** la que encaja seguro es una carga; con duda o sin formulario, «Sin clasificar» (una fila no
   pregunta con botones). Si ninguna encaja, la planilla sigue «No lo reconoce» de DOC2: la lista y «Otro».
5. **Repetida** es la que coincide con una respuesta en lo que el formulario marca como repetido, o la igual a otra fila de la
   misma planilla: no se carga, el aviso dice dónde está y queda descartada, con su fecha de borrado. La misma planilla otra vez
   (el mismo archivo) entra descartada, como un documento repetido.
6. **No son cargas ni entradas** los encabezados, los totales ni las filas vacías.
7. **Una fila no trae archivo:** la pregunta de foto o documento queda vacía y, si es obligatoria, la completa la persona en el
   Flow. Por eso el ejemplo es «Cobranzas» y no el comprobante de transferencia, que pide el comprobante.
8. **En la bandeja,** «Para revisar» es cómo se ve un propuesto que espera al equipo (el «para revisar acá» de DOC5-A), y
   «Propuesto», el que espera a la persona, con «Descartar» y «Pasar al formulario» apagados y su motivo encima. El filtro
   «Propuestos» incluye los dos. De lo leído se muestra «Monto», un dato por columna.
9. **«Fila 5»** es la fila como la numera Excel; si el libro tiene varias hojas, «Ventas · fila 5».
10. **Las cargas contestan un archivo que mandó la persona:** no son ofertas y no gastan los dos ofrecimientos del día. Las
    acotan los cupos de lectura y de interpretación: la planilla se lee en el servidor, sin `ReadDocument`, y su interpretación
    cuenta en el cupo global, como hoy.
11. **Como DOC4:** una cuenta sin vincular o sin permiso de cargar, y una planilla que no se abre (con macros, con contraseña o
    de formato viejo).

### La lista de chequeo de diseño

Pasada antes de mostrar los tableros para elegir (2026-11-11). Diferencia aceptada en todos: se dibujaron a mano con las medidas
y los tokens de los lienzos anteriores (W1-A y DOC5-A), porque la biblioteca de piezas está en otra cuenta. Lo que corrigió el
plan (abajo) no está en el lienzo: la lista se vuelve a pasar al programar.

| Tablero | Respuestas |
| --- | --- |
| UC0 | Tablero de reglas, no una pantalla. 1 sí (los caminos, con W1-A como contexto); 2 sí; 7 sí («Ya programado» y «Como hoy» marcan lo que no cambia); 10 sí (el «si no» de cada camino es el vacío); 11 sí. Lo demás no aplica. |
| UC1-A | 1 sí; 2 sí; 3 sí (un desplegable por dato); 6 sí (la leyenda de DOC2 pasa a la (i)); 7 sí; 8 sí; 11 sí (`Surface`, `FormField` y `NativeSelect`); 10 y 12, en el editor entero. |
| UC1-B, no elegido | No pasan 2 (dos cosas en una zona) y 7 (la zona se llama como la lectura, aunque esté apagada); 6 se corrigió con la (i). |
| UC1-C, no elegido | No pasan 4 (hay que abrir cada pregunta), 7 (un dato más en cada línea) y 8 (opciones apagadas lejos de la pregunta que las tiene). |
| UC1-A, el editor entero | 1 a 12 sí: el desplegable abierto, la pregunta «Ubicación», «Sólo en la app», sólo lectura y el celular; lo apagado, con su motivo encima; sin carga, error, 429 ni conflicto propios (son los del borrador); 44 px a 390; es/en; sin URL. |
| UC2 | 1 a 12 sí: el teléfono, el formulario abierto con y sin dirección, el chat de la app y la actividad (TL3-A); el mensaje dice qué completó y de qué formulario; un reenvío que no sale se ve como cualquier mensaje; fechas sólo con números. |
| UC3 | 1 a 12 sí: dos teléfonos (el primero, visible en «Prellenado con»), vuelve con lo que ya tenía, la burbuja nueva del contacto con el número sin partir. |
| UC4 | 1, 7, 10 y 11 sí: no se contesta ni se suma una línea; el pedido de W1-A no se redibuja. |
| UC5 | 1, 7 y 10 sí: cada mensaje nombra su formulario; la segunda respuesta del mismo envío se ve con su motivo en el chat. |
| UC6 | 7 y 12 sí: el idioma del formulario para la persona y el del menú para la app, sin nombrar el idioma; `MM/dd/yyyy`. |
| VC1-A | 1 a 5, 7, 8 y 11 sí: «Fila 5» como detalle gris (excepción A); la fila en `DataList`; el panel de DOC5-A. |
| VC1-B, no elegido | No pasan 5 (celdas con varios estados y respuestas), 9 (la fila abierta no es la carga) y 2 (un panel con otra tabla y sus acciones). |
| VC2 | 1 a 12 sí: el aviso, las cargas, el formulario prellenado con su marca, «Por qué lo propuso» en `DataList`, el enlace a la bandeja y la actividad. |
| VC3 | 1 a 12 sí: los estados de las filas, el panel para revisar con «Pasando…», la fila que espera a la persona (el motivo en las acciones, EP1-A), el historial, el contador y el celular; un 409 si otra persona ya la pasó; la carga, los vacíos, el error y los permisos de DOC5-A. |
| VC4 | 1, 7 y 10 sí: dos formularios, la repetida, sin clasificar, ninguna que encaja y sin cuenta, cada caso por su canal. |
| VC5 | 7 y 12 sí: los idiomas, `MM/dd/yyyy` y los montos con coma de miles. |

### Correcciones del plan

El plan se escribió contra el código el mismo día y corrigió lo que el lienzo resolvía de otra forma o no tenía. La elección no
cambia y el lienzo todavía no lo muestra; las decisiones de arriba ya lo siguen:

- **El reenvío del operador, sólo en Atención manual.** El lienzo lo hacía volver en cualquier modo, pero hoy un mensaje del
  operador sale sólo en Atención manual (`WhatsAppOutgoingSendGuard`): el reenvío sale como cualquier mensaje de su remitente y,
  si ya no puede salir, lo compartido va al siguiente envío o queda en el chat (A6).
- **Lo elegido en el editor se guarda en cada pregunta** (`receives`: `location`, `contactName` o `contactPhone`, como
  `validation`), no como tres referencias del formulario al lado de «Dónde se completa». Sale al publicar con el esquema, se va
  con la pregunta y no lo hereda la pregunta nueva de un cambio de tipo, así que no quedan referencias sueltas; con «Sólo en la
  app» queda guardado en sus preguntas. El servidor lo acepta sólo en una pregunta de texto fuera del bloque, cada valor una vez,
  y la ubicación sólo sin una pregunta «Ubicación».
- **Las filas se proponen con un mapeo por formulario,** no fila por fila. Se leen las filas de todas las hojas, con los
  encabezados de cada hoja (su primera fila con contenido). La IA dice, por cada formulario que reconoce, sus filas, qué columna
  va a cada pregunta y qué columnas leyó con dudas, y aparte las filas de datos que no encajan; las que no nombra (totales,
  notas) no son filas. Formularios arma cada fila desde la copia, sin IA: convierte cada celda al tipo de su pregunta, corre las
  validaciones fijas, busca las repetidas y aplica el tope en el orden de la planilla. Una fila que el modelo no llegó a ver
  queda «Sin clasificar», el resumen de una carga son sus dos primeros datos, en el orden del formulario, y cambiar de
  formulario en el panel vuelve a proponer el mapeo de esa fila, sin leer de nuevo.
- **Hasta 50 filas por planilla,** sin contar los encabezados; el lienzo no tenía tope. Una más grande no se carga: contesta,
  como una planilla que no se abre, «Por acá cargo planillas de hasta 50 filas. Dividila y mandámela de nuevo.» y entra
  descartada, sin gastar una interpretación. Vale para cargar (armar o importar siguen con sus topes): así una planilla no llena
  la bandeja ni deja filas que el modelo no ve. Lo calibra el piloto.
- **Cuándo se carga una planilla.** Hoy se baja, en el Asistente automático, sólo la de quien administra catálogos; con algún
  formulario publicado con lectura, también la de quien puede cargar respuestas. Una planilla sola va a la carga; con un pedido,
  también a armar, como hoy. Sin formularios con lectura, todo sigue como hoy.
- **La segunda respuesta** no suma un motivo propio: ya la rechaza la captura (`Forms.Record.ReplayConflict`), y el hilo suma a
  ese rechazo el número de la que se guardó (`savedNumber`), que el chat muestra con el texto de UC5.
- **DOC2 pasa sus tres desplegables a la zona de UC1-A.** DOC2 los dibujó dentro de «Lectura de documentos» («Registrar entrega ·
  Lectura de documentos · Ubicación y contacto»), con la etiqueta al costado («Ubicación», «Contacto: nombre» y «Contacto:
  teléfono») y la leyenda debajo. Ahora van en «Ubicación y contacto», con la etiqueta arriba, los nombres de UC1-A y la leyenda
  en la (i); la captura de DOC2 conserva el dibujo anterior.

Lo que falta confirmar, con Meta en la prueba real: que el reenvío salga con el `flow_token` del envío (si no, pasa a ser otro
envío que cierra el primero) y el pie de una carga (si no, el formulario va en el cuerpo). Con el usuario, nada: el tope de 50
filas y el reenvío del operador en Atención manual se resolvieron por lo más simple.

## Cómo quedó

Lo programado se compara con su tablero, y cada diferencia lleva su motivo. Los tableros son del 2026-10-22, anteriores a la
[lista de chequeo de diseño](visual-baseline.md#lista-de-chequeo-de-diseño) (2026-11-09): al programarlos se contesta la lista y se
aplica lo que piden ella y las reglas más nuevas, sin volver a preguntar lo que decidió el
[plan](../../../ArquitecturaBase/docs/plans/2026-10-22-documentos-por-whatsapp.md#implementación-lectura-carga-bandeja-etapa-3-de-la-ia-y-tableros).

### DOC7-A · Tarjetas armadas solas (2026-11-11)

Tarea 16 del plan (decisiones 22 a 24 y sus [diferencias](../../../ArquitecturaBase/docs/plans/2026-10-22-documentos-por-whatsapp.md#diferencias-con-los-tableros)),
contra el contrato del backend (a1c8c8ea) y con cuerpos sintéticos hasta que se exporte la cohorte `forms-dashboard-http`:
`FormDashboard` es la pestaña «Tablero» de `FormResponsesPage`, con las piezas nuevas de `shared/ui/charts` (`StatCard`,
`BarChart`, `BarList` y `ChartRefreshing`). Las escenas `formDashboard.spec.ts` y `charts.spec.ts` (catálogo,
`?scenario=charts`) dejan las capturas es/en a 1440, 390 y 320 en `test-results/dashboard` y `test-results/charts` (sin golden).

**La lista de chequeo:**

1. **Entero y armado.** Pestañas, la barra de filtros de la planilla, el segmentado, `Surface`, ⋮ (`ActionsMenu`, que suma
   `choice` para «Contar»), el desplegable de «Agregar gráfico», `DataTable` para «Ver como tabla», `EmptyState`, `Skeleton` y
   `DisabledReason`, más las piezas de gráfico, con su ficha en el catálogo. Estados: carga, sin respuestas, sin coincidencias, error
   con «Reintentar» y la espera de un 429, vuelve a leer, «Agregar gráfico» apagado y sin permiso. No hay diálogos.
2. **Una tarea, zonas que se entienden solas.** Ver qué llegó con los filtros de la planilla: la barra (con el período y «Agregar
   gráfico», que ajustan lo que se ve, como «Columnas»), los números y una zona por gráfico.
3. **El control según el dato.** El período, tres opciones fijas: segmentado. «Contar», una entre pocas: opciones con su tilde
   dentro del ⋮. Los filtros, los de la planilla. Cada gráfico tiene su tabla.
4. **Lo que se lee, en su lugar.** Cada número con su nombre arriba y su variación debajo; un reparto, renglones con el nombre, su
   barra y sus números en columnas fijas; la tabla, un dato por columna.
5. **Un dato por columna.** Las tablas: «Día», «Semana» o «Mes» y «Cantidad» o el total; «Opción», «Persona» o «Estado», el valor y
   «%». El reparto no es una tabla (excepción F) y dice «38 · 31%», como lo pide el plan.
6. **Sin leyendas.** Sin subtítulos en las tarjetas ni descripción en los vacíos. Las líneas grises son datos: la variación, por
   qué un valor dice «—» y «Se ven los últimos 400 días».
7. **Textos ciertos, una sola vez.** Los títulos siguen al período de la respuesta a la vista (no al pedido que todavía no llegó) y
   a lo que se cuenta; la cantidad está en la pestaña y en el
   primer número, no tres veces; la variación aparece sólo con un rango de fechas; «—», sólo cuando un valor no entra (con su motivo)
   o nadie respondió.
8. **Botones y lo apagado.** «Agregar gráfico» apagado con su motivo cuando todo está en el tablero, y sin motivo mientras no hay nada
   que graficar (la zona de abajo dice por qué), en el mismo lugar y con la misma forma; lo que se hace con una tarjeta va en su ⋮;
   nada destructivo.
9. **Lo elegido y la espera.** El período relleno (OE1-A), «Contar» con su tilde; la carga ocupa el lugar de los números y las
   tarjetas, con la barra ya en su lugar desde la primera vez; al volver a leer, los gráficos quedan atenuados bajo la línea que corre (LC2-A); «Reintentar» con su aro.
10. **Estados y mensajes.** Un fallo: la zona con «Reintentar» y la causa en el aviso común (un dueño); un 403 retira la lectura como
    la planilla; un 429, la espera como motivo de «Reintentar». No escribe nada: no hay conflictos ni avisos de éxito.
11. **Lo mismo, igual en toda la app.** La misma barra y los mismos chips de «Respuestas»; zonas con banda; ⋮ común; los colores de
    gráfico de `index.css` (dos tokens nuevos: el tono suave de un día sin respuestas y la pista de una barra de reparto); los cinco
    niveles de letra; medidas en `rem`; fechas con números.
12. **Celular, teclado e idiomas.** Desde 320 px nada se desplaza de costado, ni con 400 días en una tarjeta (las escenas miden cada
    caja que desplaza alrededor del gráfico, no el documento); pestañas y segmentado de 44 px en el
    celular; las tarjetas una debajo de la otra y los filtros detrás de «Filtros»; cada balde dice su período y su valor al lector;
    es/en; la pestaña, el período y los ajustes en la dirección (`view`, `period`, `cards`).

**Diferencias con el tablero:**

- **Un solo período para todo el tablero** (lo eligió el usuario el 2026-11-11): DOC7-A dibuja una tarjeta por día y otra por
  semana; todas siguen a «Día · Semana · Mes».
- **Los filtros viven en memoria, no en la dirección** (decisión 23): son los filtros privados de la planilla, compartidos con
  «Respuestas». La dirección lleva la pestaña, el período y los ajustes de las tarjetas; «Volver al automático» los saca.
- **La barra es la de «Respuestas»** (PL1-A, posterior al tablero): la búsqueda (con textos largos), el canal y el estado a la vista
  y lo demás en «Filtros», con los chips y «Limpiar todo»; no «Recibida: octubre 2026 · Cargó · Estado · … · Más filtros».
- **«Agregar gráfico» va en la barra**, al final, junto al período, como «Columnas» en «Respuestas»; el encabezado conserva las
  acciones del formulario (exportar y agregar una respuesta), iguales en las dos pestañas.
- **Las pestañas de quien también aprueba** son «Por aprobar (N) · Todas · Tablero» (PL1-A); las demás, «Respuestas (N) ·
  Tablero». «123 respuestas» al lado del período no está: lo dicen la pestaña y el primer número.
- **El período anterior se nombra con sus fechas** («+18% que 01/09/2026 – 30/09/2026», fechas sólo con números): no «que
  septiembre». «Mínimo y máximo» no dice «En octubre»: el chip ya dice el rango.
- **La variación va en gris, con su signo**: el tablero la pinta de verde, pero si subir es bueno depende del formulario.
- **Los montos van sin símbolo** («14.381.300»), con su moneda en el nombre: «Total de Monto (pesos)» (diferencias del plan).
- **Cada tarjeta es una `Surface` con su banda** y el ⋮ a la derecha, como toda zona de la app; no lleva el subtítulo gris («De la
  pregunta … · cantidad»), que repetía el título: lo que cuenta va en el título («Total de Monto (pesos), por Banco …», «Por Cliente
  (catálogo Clientes)»).
- **Las tarjetas por período ocupan todo el renglón** (DOC7-A, dos tercios y un tercio): con un solo período tienen los mismos
  baldes y las barras y sus fechas necesitan el ancho. Los repartos van de a tres.
- **El eje nombra pocas fechas, enteras y con números** (la primera y la última, debajo de su barra mientras entran, y más a
  medida que la tarjeta crece), no «1 … 22» ni «5 al 11»; cada balde dice su período al pasar el mouse, al lector y en la tabla
  («05/10/2026 – 11/10/2026»).
- **Un día sin respuestas es una barrita en el tono suave**, como dice la regla («los días sin actividad»): DOC7-A pinta así los
  días flojos, que acá son barras como las demás.
- **La cifra va sobre la barra sólo si entra**, corta («4,4 M», «820 k»); con muchos días en el celular no hay cifras y el valor va
  al pasar el mouse y en la tabla.
- **Con muchos baldes las barras se juntan**: el espacio entre ellas se achica (un cuarto del ancho como mucho), así los 400 días que
  manda el servidor entran en un teléfono. Un total negativo no tiene barra: su cifra va sobre la línea de base, sin el tono suave.
- **Una tarjeta cuyo número o moneda no vino con estos filtros** cuenta las respuestas, con su título y «Contar» en «Cantidad», y la
  dirección conserva su total: lo vuelve a sumar cuando los filtros lo dejan entrar.
- **Un reparto lleva una línea entre renglones** y, donde no entra, la barra debajo del nombre; dice «38 · 31%» también en el
  celular, donde DOC7-A dejaba sólo la cantidad.
- **Lo que queda va en gris y con un nombre común**: «Otras 7 opciones» (DOC7-A, «Otros 7 clientes» en verde); «Otras N
  personas» en «Quién cargó».
- **Los estados se llaman como en la planilla**, en singular («Aprobada», «Por aprobar», «Rechazada»), con los colores de su rol y
  «Recibida» y «Anulada» en gris; la tarjeta aparece en un formulario con aprobación.
- **«Contar» es una elección dentro del ⋮**, con su tilde: la cantidad o el total de un número por moneda, nunca la suma de dos
  monedas (DOC7-A, un ítem «Contar: cantidad · total de Monto»). «Ver como tabla» pasa a «Ver como gráfico».
- **«Quitar del tablero» no va en rojo**: no destruye nada y «Agregar gráfico» lo devuelve.
- **El automático muestra todo** lo que sale de los tipos de las preguntas (decisión 22 y la tarea): también cada pregunta de fecha,
  que DOC7-A ofrecía en «Agregar gráfico». Por eso «Agregar gráfico» arranca apagado, con su motivo, y se llena al quitar
  tarjetas; agrupa «De las respuestas» y «De una pregunta», y «Volver al automático» aparece después de un ajuste.
- **Los vacíos no explican**: «Todavía no hay respuestas», sin «El tablero se arma solo…»; sin coincidencias, «Ninguna respuesta
  coincide» con «Limpiar todo», el mismo título y el mismo botón que la planilla de al lado (DOC7-A: «Ninguna respuesta con estos
  filtros», «Probá con otro período o quitá filtros.» y «Limpiar filtros»).
- **La carga ocupa su lugar** (ES1–ES3): cuatro números y tres tarjetas, no tres bloques sueltos; DOC7-A no dibuja el error, que
  queda con «Reintentar».
- **En el celular** «Filtros» también lleva la búsqueda, el canal y el estado; lo aplicado son chips, como en la planilla (DOC7-A,
  «Filtros · Recibida: octubre»), y los números van de a dos (de a uno a 320 px).
- **En inglés** «Quién cargó» es «Who submitted», como «Cargó» («Submitted by») en la planilla; DOC7-A decía «Who loaded».

### DOC1 · La biblioteca y la lectura (2026-11-11)

Tarea 6 del plan (decisiones 5, 6, 7 y 13), contra el contrato de la tarea 5 y con dobles sintéticos, porque el backend se
programa a la vez: `FormDocumentReadingZone` después de «Preguntas» en el editor y `FormLibraryPage` en «Biblioteca». La escena
`formDocumentReading.spec.ts` deja las capturas es/en a 1440, 390 y 320 en `test-results/visual` (sin golden).

**La lista de chequeo**, para la zona del editor y para la biblioteca:

1. **Entero y armado.** Piezas de la biblioteca (`CollapsibleSection`, `CheckboxField`, `FormField`, `GroupLabel`, `Table` dentro de
   `Surface`, `NativeSelect`, `DataList`, `ComparisonTable`, `DataTable`, `FilterBar`, `SearchInput`, `SegmentedControl`, `Badge`).
   Estados de la zona: plegada y abierta, apagada, sólo lectura (sin cruces, sin su renglón), «Cómo reconocerlo» vacía o un cruce
   sin completar al guardar, los campos del catálogo cargando, sin «Ver catálogos», los errores de guardar y de publicar, un 409, y
   «Cómo viene leyendo» cargando, con error, con la espera de un 429, sin permiso, sin correcciones y sin «Ver respuestas». De la
   biblioteca: carga, error con
   «Reintentar» y la espera de un 429, sin estándares, sin coincidencias y sin permiso. «Ver los ejemplos» es un diálogo: una
   consulta breve sobre la zona.
2. **Una tarea, zonas que se entienden solas.** La lectura se configura y se guarda junta: una sola zona, en renglones con una
   línea entre ellos (IA1-A) y en el orden en que se usa: prenderla, cómo reconocerlo, qué datos lee, los cruces, los repetidos y
   cómo viene leyendo. La biblioteca resuelve encontrar un estándar y agregarlo.
3. **El control según el dato.** Prender, una casilla; «Cómo reconocerlo», un texto largo; los datos del estándar, los cruces, lo
   confirmado por pregunta y los estándares, tablas; cada parte de un cruce, un desplegable; todos, disponibles o próximamente, un
   segmentado con su cantidad.
4. **Lo que se lee, en su lugar.** «Cómo viene leyendo» en `DataList` (documentos, desde y la que más se corrige) y una tabla por
   pregunta; los ejemplos, lo leído y lo confirmado lado a lado (`ComparisonTable`, una respuesta por grupo); en la tarjeta del
   celular, «Qué lee» y «Validaciones fijas» en `DataList`.
5. **Un dato por columna.** La biblioteca separa «Qué lee», «Validaciones fijas», «Versión», «Origen», «En tus formularios» y, sólo
   en «Todos», «Estado». Una columna aparece sólo si algún estándar del filtro tiene su dato: ninguna va llena de «—», y
   «Próximamente» muestra sólo «Estándar», sin «Acciones». El tipo de una pregunta y la descripción de un estándar van en gris
   debajo (excepción A).
6. **Sin leyendas.** Pasaron a la (i): la descripción bajo la casilla y que se publica como siempre (la de la zona), la ayuda de
   «Cómo reconocerlo», las frases del cruce y de los duplicados, «Es la base para cargar solo…», «Le cambiaste el nombre: sigue
   leyendo…» (la de «Datos del estándar») y la introducción de la biblioteca (la de su título, con qué se valida sin IA).
7. **Textos ciertos, una sola vez.** El estándar y su versión ya los dice el encabezado del editor (BI1-A): la zona no los repite y
   los nombra la (i) de «Datos del estándar». La banda plegada dice lo configurado («Prendida · 1 cruce con catálogos», «Apagada»).
   «Estado» no aparece en el filtro que ya lo dice, y sin estándares próximos no están ni «Estado» ni el segmentado. «Ver los
   ejemplos» abre «Últimas correcciones»: son las últimas, hasta diez, no todas las de los 30 días. Sin documentos, la lectura dice
   0, sin tabla; lo confirmado sin cambios se redondea para abajo, así nunca dice 100 % cuando hubo correcciones.
8. **Botones y lo apagado.** «Agregar cruce» apagado con su motivo (cinco cruces, ninguna pregunta de catálogo para completar o todas
   con su cruce);
   «Ver los ejemplos (0)» apagado con «No hubo correcciones en los últimos 30 días.» (HI1-A); «Se busca por», sin «Ver catálogos»,
   apagado con «Necesitás permiso para leer catálogos y ver sus campos.» cuando no puede nombrar el campo; «Reintentar» apagado
   con la espera de un 429; quitar un cruce, en rojo y sin preguntar, como un ítem; un próximo, sin acción.
9. **Lo elegido y la espera.** El segmentado relleno (OE1-A); los repetidos y «Cómo viene leyendo» cargan con barras en su lugar;
   «Se busca por» dice «Cargando…» mientras llegan los campos del catálogo, en lugar de «Campo no disponible»; «Reintentar» con su
   aro; la tabla de la biblioteca, con el suyo (ES1-A).
10. **Estados y mensajes.** Validación junto al campo: con la lectura prendida, «Cómo reconocerlo» vacía («Escribí cómo reconocer el
    documento.», un texto propio) y cada parte de un cruce frenan Guardar y el diálogo de publicar, y llevan el foco a lo que falta;
    un error de guardar queda bajo su control, y el campo de un cruce al publicar, con «Ir al cruce» que lo enfoca. Apagada, un cruce
    a medio elegir se va y un error de lo que no se ve va al aviso común: nada frena en silencio. Un cruce nunca nombra una pregunta
    quitada, con otra identidad, adentro del bloque o que dejó de ser de catálogo: se va con ella. Un 409 lista la lectura como un
    cambio y «Conservar mis cambios» la conserva. El fallo de «Cómo viene leyendo» va al aviso común y deja «Reintentar» en su
    lugar; con un 429 queda apagado y su motivo dice cuánto esperar, y un 401 o un 403 lo saca (el 403 también de la caché). Sin
    «Administrar formularios» se lee sin cambiar; sin «Ver catálogos», «Se busca por» dice por qué no nombra el campo. Sin canal o
    sin la IA que lee (`assistant`), la zona no está y lo guardado se conserva.
11. **Lo mismo, igual en toda la app.** La zona sigue a ZP1-A (plegada con su resumen y abierta por un problema); los cruces, a la
    tabla de ítems (tabla en escritorio, recuadros en el celular, tacho rojo); las fechas, con números; tokens y `rem`.
12. **Celular, teclado e idiomas.** Desde 320 px sin desplazar la página (lo mide la escena); los datos del estándar, un bloque por
    dato con la pregunta que lo recibe y su candado, como en el tablero; los cruces en recuadros; «Agregar cruce», «Quitar», «Ver los
    ejemplos», «Reintentar» y los desplegables de un cruce miden 44 px (`size="touch"`, también en `NativeSelect`; lo mide la
    escena); los encabezados de las tablas bajan de renglón; el segmentado de la biblioteca también (`wrap`); cada control con su
    nombre («Cruce 1 · Dato leído»); es/en; la búsqueda y el filtro de la biblioteca en la dirección (`search`, `availability`).

**Diferencias con el tablero:**

- **Qué pregunta recibe cada dato** no se elige (DOC1 dibuja un desplegable por dato): lo fijó «Agregar» (BI1-A) y la tabla es de
  sólo lectura, con las tres columnas del tablero, «Dato del estándar», «Pregunta que lo recibe» y «Validación fija». Para eso el
  contrato cambió el 2026-11-11, al programarla: la biblioteca manda cada dato con su clave (`reads: [{ key, name }]`, en el orden
  del estándar), la misma de `standard.bound` del formulario (clave → pregunta), y la tabla une por esa clave cada dato con su
  pregunta. Así una pregunta renombrada o movida sigue recibiendo su dato («Titular de origen» → «Quién transfirió») y un dato cuya
  pregunta ya no está dice «Sin pregunta» en gris. Que renombrarla no corta la lectura lo dice la (i). El tipo va en gris debajo del
  dato. El comprobante no es un dato que se lee (`reads` no lo trae): va entero a su pregunta.
- **«De dónde viene»** (DOC1, la línea con el estándar y su versión al principio de la zona) no está: el encabezado del editor ya
  dice de qué estándar y versión es la copia (BI1-A), y la (i) de «Datos del estándar» los nombra.
- **Las validaciones fijas** de la tabla son las de cada pregunta de la copia (`validation`, que fijó «Agregar»), y las de la
  biblioteca, las que el estándar declara (`validations`): la cuenta y el CUIT o CUIL. DOC1 también llamaba validación a que el
  banco sale de la cuenta (lo completa el servidor), al formato de montos y fechas (lo valida su tipo), al repetido (está en
  «Repetidos») y al documento adjunto (va a su pregunta).
- **Los ejemplos** («Se suman como ejemplos las correcciones de la bandeja…», bajo «Cómo reconocerlo») pasan a «Ver los ejemplos
  (N)» en «Cómo viene leyendo», sólo con «Ver respuestas»: las correcciones se muestran a quien diseña, que mejora «Cómo
  reconocerlo» a mano (decisión 3 del usuario), y no se suman solas.
- **El cruce con catálogos** deja la tarjeta con su frase por una tabla de hasta cinco: «Dato leído», «Completa» y «Se busca por»
  (el código, el texto o un campo del catálogo de la pregunta que completa que se pueda comparar con lo leído), en ese orden porque
  el campo depende de ese catálogo.
- **Duplicados y cómo viene leyendo** dejan de ser tarjetas lado a lado: son renglones de la zona. «Duplicados» se llama
  «Repetidos» y nombra las preguntas que lo marcan (`duplicateQuestionIds`). «Cómo viene leyendo» no tiene el porcentaje general de
  DOC1 (el contrato lo da por pregunta): da los documentos, desde cuándo, la que más se corrige y lo confirmado sin cambios de cada
  pregunta.
- **Un formulario propio** muestra la casilla, «Cómo reconocerlo» y los cruces; la línea «Cada pregunta del formulario es un dato a
  leer…» es una leyenda y no está.
- **La zona arranca plegada** (DOC1 la muestra abierta), con lo configurado en la banda, como las del editor de una pregunta
  (ZP1-A); un problema la abre.
- **«En tus formularios»** es la cantidad (`copies`): el contrato no trae la lista de copias que DOC1 dibuja como enlaces. La
  tarjeta del celular dice «En N de tus formularios».
- **La biblioteca no tiene paginado** (DOC1, «1–13 de 13 · Filas por página»): llega entera.
- **«Próximamente»** no es un botón gris en «Acciones»: es un estado, en «Estado» (sólo en «Todos») y en la tarjeta del celular;
  su filtro lista el nombre y lo que es, sin las columnas que un próximo no tiene.
- **Las validaciones de la biblioteca** (DOC1, «Valida sin IA: …» bajo «Qué lee») van en su columna, con los nombres de los datos
  validados; qué se valida va en la (i) del título.
- **El segmentado en el celular** baja de renglón, en lugar de cortarse.

### DOC2 y DOC4 · El documento en el chat del operador (2026-11-12)

Tarea 8 en el front: el chat del operador muestra el documento que llega, sobre el contrato de la tarea 8 del backend y con dobles
sintéticos hasta la exportación conjunta. Escena `chat-document` (`chatDocumentFixtures`), con golden es/en a 1440, 390 y 320: una
conversación con cuenta vinculada, también con el historial arriba, y la de un número sin cuenta.

**La lista de chequeo**, para la tarjeta del documento y la línea de DOC4:

1. **Entero y armado.** Piezas de la biblioteca: `MessageBubble` y `MessageCard`, con el ícono de foto o de documento. Estados: un
   PDF con sus páginas y antes de contarlas, una foto con nombre y una sin nombre de archivo, un Word, uno de otro tipo, uno vencido,
   con y sin `caption`, y lo de un número sin cuenta con la línea de DOC4. No es un diálogo.
2. **Una tarea, zonas que se entienden solas.** Es un mensaje del historial: la tarjeta dice qué llegó y el `caption` va debajo, en
   el mismo mensaje.
3. **El control según el dato.** No tiene controles: el chat no baja ni abre el archivo.
4. **Lo que se lee, en su lugar.** El nombre arriba y lo que es debajo, en gris («PDF · 2 páginas», «Foto», «Word»), sin «Rótulo:
   valor»; una foto sin nombre es sólo «Foto», sin segunda línea.
5. **Un dato por columna.** No hay tablas.
6. **Sin leyendas.** La línea de DOC4 no explica cómo funciona algo: dice qué pasó con lo que llegó.
7. **Textos ciertos, una sola vez.** Una foto no dice «1 página»; la línea va una vez, debajo del último de lo que el número mandó
   seguido; vencido, ya no están el nombre ni el `caption`, y lo dice («Ya no está disponible.»).
8. **Botones y lo apagado.** No tiene botones.
9. **Lo elegido y la espera.** Sin selección ni esperas propias: llega con el historial, que carga como siempre.
10. **Estados y mensajes.** La carga, el error y los permisos son los del chat; vencido es un estado del mensaje, con su texto.
11. **Lo mismo, igual en toda la app.** Es la tarjeta de la planilla recibida, con el ícono de foto o de documento de «Documentos
    recibidos»; la línea, como las del asistente; las páginas con los miles de su idioma (`1.250`, `1,250`); tokens y `rem`.
12. **Celular, teclado e idiomas.** Desde 320 px sin desplazar de costado (un nombre largo baja de renglón dentro de la tarjeta); la
    línea describe su mensaje (`aria-describedby`), así el lector la dice con él; es/en; nada en la dirección.

**Diferencias con los tableros:**

- **Sin miniatura.** El chat no baja el archivo: el documento es su nombre en una tarjeta, como la planilla, con lo que es debajo, y
  el `caption` va debajo de la tarjeta, en el mismo mensaje, no en otra burbuja. Una foto que WhatsApp manda sin nombre de archivo es
  «Foto», sin segunda línea; los tableros la nombran («comprobante.jpg»).
- **Lo que DOC2 y DOC4 no dibujan en el chat del operador:** un PDF con sus páginas, un Word, uno de otro tipo y uno vencido, que
  siguen la tarjeta de la planilla, y varios seguidos de un número sin cuenta, con la línea una vez, debajo del último.
- «Por qué lo propuso» y «Por qué preguntó» debajo del documento: la tarea 9 los manda en `why` y el guard los lee, pero el chat todavía no los dibuja (pendiente).

### UC1-A · Ubicación y contacto en el editor (2026-11-12)

Tarea 19 en su primera parte (el guard de `receives`; los del hilo y de la actividad quedan para la segunda) y tarea 21 del
[plan](../../../ArquitecturaBase/docs/plans/2026-10-22-documentos-por-whatsapp.md#ubicación-y-contacto-por-whatsapp-w3-y-varias-cargas-desde-un-excel)
(decisión técnica 1), contra el contrato fijo de la tarea 20 y con dobles sintéticos, porque el backend se programa después:
`receives` en cada pregunta de texto del borrador y del detalle, que el editor devuelve como llegó al guardar, chequear y
publicar, y `FormLocationContactZone` después de «Lectura de documentos». La escena `formLocationContact.spec.ts` deja las
capturas es/en a 1440, 390 y 320 en `test-results/visual` (sin golden).

**La lista de chequeo**, para la zona:

1. **Entero y armado.** Piezas de la biblioteca: `Surface` con su (i), `FormField`, `NativeSelect`, `DisabledReason` y, en sólo
   lectura, `Label` sobre cada valor. Estados: las tres preguntas elegidas, «Ninguna», una tomada por otro renglón, una pregunta
   «Ubicación», «Sólo en la app» y sin canal (sin la zona), sólo lectura y el celular. No es un diálogo.
2. **Una tarea, zonas que se entienden solas.** Una zona para lo que completa lo compartido, aparte de la lectura (que pide la IA
   y «Cómo reconocerlo»), en renglones con una línea entre ellos y en el orden en que llegan los datos.
3. **El control según el dato.** Una pregunta de una lista: un desplegable por dato.
4. **Lo que se lee, en su lugar.** En sólo lectura, cada renglón con su etiqueta arriba y la pregunta debajo, como en el tablero
   (una `dl`), sin «Rótulo: valor» corrido; en la revisión de un 409 la zona es un cambio de `ComparisonTable`, un dato por renglón,
   con cada pregunta nombrada como en la zona y los números de su versión.
5. **Un dato por columna.** No hay tablas.
6. **Sin leyendas.** La explicación (la leyenda de DOC2) va en la (i) del título, y el motivo del renglón apagado, encima de él.
7. **Textos ciertos, una sola vez.** «Ninguna» dice que nada lo recibe, «· Recibe …» nombra qué recibe la tomada y el motivo nombra
   la pregunta «Ubicación» del formulario; con «Sólo en la app» o sin canal la zona no está, así que no promete lo que no pasa. El
   idioma no se nombra.
8. **Botones y lo apagado.** No tiene botones. Con una pregunta «Ubicación», el renglón de la ubicación queda en su lugar y con su
   forma, muestra esa pregunta y da el motivo encima, con el puntero, un toque o el foco en su envoltorio (MA1-A); una opción
   tomada lleva «· Recibe …», la forma de lo apagado en un desplegable.
9. **Lo elegido y la espera.** Lo elegido es el valor del desplegable. No tiene esperas propias: se guarda con «Guardar borrador», y
   mientras guarda, queda sin confirmar o espera una revisión, los desplegables siguen en su lugar, apagados, como los controles de
   «Lectura de documentos»: nada salta.
10. **Estados y mensajes.** Sin carga, error, 429 ni conflicto propios: son los del borrador. Un 409 la lista como un cambio y
    «Conservar mis cambios» la conserva. Lo que el servidor rechazaría no sale del editor: quitar la pregunta, cambiarle el tipo,
    meterla en el bloque o ponerle una condición le saca lo elegido (sacarle la condición no se lo devuelve), y sumar una pregunta
    «Ubicación» le saca la ubicación a la de texto, con la zona a la vista u oculta. Sin «Administrar formularios» o dado de baja
    se lee sin cambiar; guardar o esperar una revisión no la vuelve de sólo lectura.
11. **Lo mismo, igual en toda la app.** Los renglones son los de IA1-A y las preguntas se nombran como en las demás listas del
    editor; tokens y `rem`.
12. **Celular, teclado e idiomas.** Desde 320 px sin desplazar la página; en el celular los desplegables van a lo ancho y miden
    44 px (`size="touch"`), y la escena lo mide; cada control se llama como su renglón, y el envoltorio del renglón apagado se
    alcanza con Tab, con el motivo como descripción del control; es/en; nada en la dirección.

**Diferencias con el tablero:**

- **Una pregunta con condición o con validación fija no recibe nada** (decidido al programar, el 2026-11-12): la zona ofrece las
  preguntas de texto fuera del bloque, sin «Se muestra: Según otra respuesta» (CO1-A), porque WhatsApp no prellena una pregunta
  condicional y el formulario que vuelve fallaría, y sin la validación fija de un estándar de la biblioteca (la cuenta o el CUIT),
  que lo compartido no pasaría. El servidor rechaza las dos (`Forms.Draft.ReceivesQuestionInvalid`). Ponerle una condición a la que
  recibe algo la deja en «Ninguna», como meterla en el bloque. El tablero ofrece todas las de texto fuera del bloque.
- **Las preguntas llevan su número** («Dirección de entrega (pregunta 1)», «Recibió (pregunta 2) · Recibe el nombre del
  contacto»), como en las demás listas de preguntas del editor (los cruces de la lectura, las condiciones y los cálculos): así se
  distinguen dos con el mismo texto, y una que todavía no tiene texto se llama «Pregunta 6». La revisión de un 409 las nombra igual.
  El tablero las dibuja sólo con su texto. A 320 px el valor elegido se corta dentro del desplegable, como en esas listas; las
  opciones se leen enteras en la lista del teléfono.
- **El renglón apagado** muestra la pregunta «Ubicación» con su número, como valor del desplegable; el motivo la nombra por su
  texto, como en el tablero, o por su número mientras no tiene texto («La ubicación va a la pregunta 6, …»).
- **Sólo lectura** también dice «Ninguna», en gris, y con una pregunta «Ubicación», esa pregunta en el renglón de la ubicación.
- **La (i) del título** está en todos los estados; el tablero la omite en los recuadros chicos.
- **La escena** no tiene «Lectura de documentos» encima: esa zona pide el módulo de IA, que el escenario no instala; el orden de las
  dos zonas lo prueba vitest (`FormEditorLocationContact.test.tsx`). El desplegable abierto es el nativo y no se captura: sus
  opciones, y cuáles están apagadas, las prueba vitest (`FormLocationContactZone.test.tsx`).

### UC2 a UC6 · El chat y la actividad (2026-11-12)

Tarea 25 del [plan](../../../ArquitecturaBase/docs/plans/2026-10-22-documentos-por-whatsapp.md#ubicación-y-contacto-por-whatsapp-w3-y-varias-cargas-desde-un-excel)
(decisiones técnicas 3, 6, 7 y 8), sobre los guards de la tarea 19b y con cuerpos sintéticos de esas formas hasta que las tareas 22
a 24 escriban los del backend y se exporten (`whatsapp-audio-http`, `whatsapp-forms-http` y `forms-responses-http`): `ChatContact`
en el chat del operador, «Prellenado con» en la tarjeta del reenvío, el motivo de la segunda respuesta en `FormReplyCard` y los
renglones nuevos de la actividad en `ResponseWorkflowHistory`. La vista previa «Contacto» de la lista es un texto del servidor: no
dibuja nada. La escena `whatsapp-shared-content.spec.ts` deja el chat con golden es/en a 1440, 390 y 320
(`whatsapp-shared-content{,-contact,-prefilled}` y `whatsapp-shared-contacts`), y `responsesSharedContent.spec.ts`, la actividad en
`test-results/shared-content`, sin golden como las demás escenas de la actividad.

**La lista de chequeo**, para la burbuja del contacto, el reenvío, la segunda respuesta y la actividad:

1. **Entero y armado.** Piezas de la biblioteca: `MessageBubble`, `MessageCard` (la del formulario, con «Prellenado con» adentro
   como el renglón de estado de `LocationRequestCard`), los renglones de los valores de una respuesta (`FormReplyValues`), `CellText`
   y `UserIcon`; la actividad es la de TL3-A. Estados: un contacto con nombre y dos teléfonos, con un teléfono largo, sin nombre, sin
   teléfono, sin los dos y vencido; el reenvío del operador y el del asistente, con uno y con tres datos, sin «Prellenado con» sin
   permiso o al revocarlo y sin tarjeta si su metadata no vale; la segunda respuesta; en la actividad, la ubicación de W3, el
   contacto con una y con dos preguntas, los reenvíos y la ubicación de W1-A, sin preguntas. No hay diálogos.
2. **Una tarea, zonas que se entienden solas.** Son mensajes del historial y renglones de la actividad: el contacto dice quién es y
   sus teléfonos; el reenvío, qué se prellenó, dentro de su tarjeta; la segunda respuesta, por qué no se guardó.
3. **El control según el dato.** No tienen controles: el chat no abre ni agenda el contacto.
4. **Lo que se lee, en su lugar.** «Prellenado con» se lee como los valores de la respuesta que llega después (LR1): cada pregunta
   con su valor en dos columnas desde 640 px y, en el celular, el valor debajo de su pregunta; el contacto, el nombre arriba y un
   teléfono por renglón, sin «Teléfono:»; en la actividad, lo que se completó va en gris debajo de lo que pasó, donde los demás
   renglones dicen quién.
5. **Un dato por columna.** No hay tablas nuevas; la actividad conserva sus cuatro columnas.
6. **Sin leyendas.** Nada explica: el motivo de la segunda respuesta es su estado y «Completó …» es un dato de su renglón.
7. **Textos ciertos, una sola vez.** «Se volvió a mandar el formulario» no repite quién lo mandó, aunque el servidor lo diga: es el
   mismo envío y su remitente está en «Se mandó el formulario», como lo dibujan UC2 y UC3. La ubicación de W1-A no dice «Completó»
   (no trae preguntas), un contacto sin teléfono no inventa uno y «Por qué lo mandó» va sólo en el primer envío (el servidor no lo
   manda en el reenvío). La segunda respuesta nombra la que quedó y no ofrece «Mandar de nuevo».
8. **Botones y lo apagado.** No hay botones nuevos.
9. **Lo elegido y la espera.** Sin selección ni esperas propias: llegan con el hilo y con el detalle.
10. **Estados y mensajes.** La carga, el error y los permisos son los del chat y del detalle. «Prellenado con» tiene la privacidad
    de «Por qué lo mandó»: sin «Ver respuestas» el servidor no lo manda y el guard lo descarta, y al revocar el permiso se va; el
    contacto lo ve quien lee el chat. Vencido es un estado del mensaje: «Mensaje de contacto».
11. **Lo mismo, igual en toda la app.** La burbuja del contacto sigue a la ubicación de W1-A (el ícono, el dato en negrita, lo
    demás debajo y los números con ancho fijo, como el punto); «Prellenado con», los renglones de los valores de la respuesta; la
    segunda respuesta, el renglón de un rechazo; un teléfono, como un código con guiones, se parte sólo en sus espacios (`CellText`),
    y el número de una respuesta no se parte en su guion, también en «Guardada como …»; las preguntas se juntan como en el resto de
    los textos («A» y «B», “A” and “B”); tokens y `rem`; fechas con números.
12. **Celular, teclado e idiomas.** Desde 320 px nada se desplaza de costado: la escena mide cada caja que desplaza o corta
    alrededor de los contactos, del último «Prellenado con», de la segunda respuesta y de los renglones de la actividad, hasta el
    documento (`expectNoSideScroll`). Un teléfono que entra ocupa un renglón; uno largo («+54 9 (0341) 15-555-0177») se parte sólo
    en sus espacios y nunca dentro de un grupo, como el número de una respuesta, y la escena revisa cada grupo. La región del
    contacto se llama «Contacto: {nombre}» («Contacto» sin nombre) y «Prellenado con» es un grupo con ese nombre; es/en; nada en la
    dirección.

**Diferencias con los tableros:**

- **La segunda respuesta va como cualquier rechazo** de la tarjeta, con el triángulo y sin tinte: UC5 la pinta en rojo con el
  círculo, que ningún otro rechazo de la tarjeta usa.
- **Un contacto sin nombre o sin teléfono** no está dibujado: sin nombre se titula «Contacto», como una foto sin nombre de archivo es
  «Foto» (DOC2), y su región se llama «Contacto»; sin teléfono es el nombre solo. Uno sin los dos, que el contrato admite, es
  «Contacto» solo.
- **«Prellenado con» va en los renglones de los valores de la respuesta**: dos columnas iguales desde 640 px y, en el celular, cada
  valor debajo de su pregunta, así un teléfono entra entero; UC2 y UC3 lo dibujan con las columnas de `DataList`.
- **El primer envío del asistente no lleva «Prellenado con» en su tarjeta**, que UC3 sí le dibuja: esos datos van sólo en «Por qué
  lo mandó», porque `prefill` existe sólo en el reenvío (decisión técnica 6 del plan).

### DOC5-A · La planilla con panel (2026-11-12)

Tarea 10 del [plan](../../../ArquitecturaBase/docs/plans/2026-10-22-documentos-por-whatsapp.md#parte-b--la-bandeja-documentos-recibidos-doc5-a-y-doc6)
(decisiones 14 a 16), sólo el front, contra el contrato del backend de la tarea 7 y su corrección «7b» (la búsqueda va en el
cuerpo de `POST api/forms/documents/search`, con los formularios y las personas de los filtros) y con cuerpos sintéticos hasta que se
exporte la cohorte `forms-documents-http`: `ReceivedDocumentsPage` en `/formularios/documentos`, su panel (`components/documents`)
en `/formularios/documentos/{id}`, la pieza nueva `DocumentViewer` de `shared/ui`, la entrada del menú con su número y, en «Cómo
empezó» del detalle de una respuesta, de qué documento salió, quién la pasó al formulario y «Ver en Documentos recibidos» (con «Ver
documentos recibidos», que es a quien el servidor se lo nombra). La escena `receivedDocuments.spec.ts` deja las capturas es/en a
1440, 390 y 320 en `test-results/documents` (sin golden). Quedan para sus tareas el documento en el chat del operador, la línea de
un número sin cuenta y la marca «Necesita una persona» (tareas 8 y 9) y el aviso de los parecidos con «Armar formulario con la IA»
(tarea 14).

**La lista de chequeo:**

1. **Entero y armado.** `Page` con su (i), `FilterBar` con `SearchInput`, el segmentado de los estados y «Filtros» (`FilterPanel`:
   «Formulario» y «Mandó» con `Autocomplete`, y «Recibido»), los chips con «Limpiar todo», `Surface` con `DataTable` y
   `Pagination`, `Badge`; el panel es el marco de D2 (`ResponsePanelFrame`) con `Tabs`, `DocumentViewer`, `Banner`, `FormField`,
   `NativeSelect`, `DisabledReason`, los campos comunes, `DataList` y `ConfirmDialog`. Estados: la carga (el aro en la tabla y en la
   caja del documento), sin documentos, sin coincidencias, el error con «Reintentar» y la espera de un 429 (también al volver a leer
   el documento o su archivo), sin permiso, sólo lectura, uno que espera a su persona, leyendo para otro formulario, confirmado,
   descartado, un 409 y un resultado incierto. El único diálogo es la confirmación de «Descartar».
2. **Una tarea, zonas que se entienden solas.** Revisar lo que llegó: la barra, la planilla y, en el panel, el documento, por qué
   está donde está, su formulario con sus datos y, al pie, lo que se hace con él.
3. **El control según el dato.** Los estados, pocos y con su cantidad: segmentado. «Formulario» y «Mandó», en «Filtros»: el combo
   que se escribe para buscar, como PL2-A; «Recibido»: desde y hasta. El formulario del documento, uno entre pocos: desplegable.
   Una pregunta de elegir: desplegable con sus opciones; un sí o no: segmentado; un texto, un número o una fecha: su campo.
4. **Lo que se lee, en su lugar.** Los datos que no se editan van en `DataList`; el historial, un renglón por paso con qué pasó,
   quién debajo en gris y la fecha a la derecha, como los momentos de una respuesta. Ningún «Rótulo: valor» corrido.
5. **Un dato por columna.** Documento (su nombre, que lo abre; el ícono del tipo es dibujo y la «Fila 5» de VC1-A irá debajo en
   gris, excepción A), Recibido, Mandó, Formulario, una columna por dato leído con el nombre de su pregunta, Estado, Se borra (sólo
   si la página tiene un descartado o un sin clasificar) y Respuesta.
6. **Sin leyendas.** La bajada del título y la regla de los 90 días van en la (i) de la página; qué pasa al cambiar el formulario,
   en la (i) de «Formulario». Por qué un documento está donde está es un dato (nombra a la persona, quién lo descartó o dónde se
   cargó) y va en un `Banner` arriba de sus datos; el motivo de las acciones de uno que espera, sobre ellas. Los vacíos dicen sólo
   su título.
7. **Textos ciertos, una sola vez.** «Para revisar» es el propuesto que espera al equipo y «Propuesto», el que espera a su persona;
   su `Banner` dice «Venció…» sólo si se le mandó y no lo confirmó, «No se le pudo mandar…» si no se pudo, y nada si alguien del
   equipo lo volvió a abrir o lo leyó para otro formulario (lo decide el último paso del historial que cambia a quién espera).
   «Todos (N)» suma los cuatro estados, y las cantidades y el número del menú van con los miles de la región; la seguridad aparece
   sólo con un formulario; el día en que se borraría se cuenta al abrir la confirmación. El estado está en el encabezado del panel y
   no se repite: el `Banner` dice por qué.
8. **Botones y lo apagado.** Al pie, «Descartar» (borde rojo, abre la confirmación) y «Pasar al formulario», la principal y
   última; «Volver a abrir» en un descartado. Los de uno que espera a su persona quedan en su lugar, apagados, con el motivo encima
   («Le mandamos este documento a {persona}. Si no lo confirma hasta el {fecha y hora}, lo podés revisar acá.», VC1-A), igual que el
   desplegable del formulario y «Volver a leer para «X»», debajo de él (un desplegable nunca elige la opción que muestra); la espera
   de un 429 también es su motivo. Sin «Revisar documentos» no están.
9. **Lo elegido y la espera.** El estado elegido va relleno y la fila abierta lleva su barra; «Pasando…», «Descartando…» y
   «Abriendo…» con su aro; «Leyendo los datos para «X»…» con el aro y los datos atenuados mientras se lo sigue; si su lectura falla
   (una red caída, un 5xx, un 429), deja de leerlo y dice «No pudimos saber si terminó la lectura para «X».» con «Reintentar» (con la
   espera de un 429), sin apagar las acciones; la planilla vuelve a leer con la línea que corre, y la caja del documento conserva su
   alto mientras llega.
10. **Estados y mensajes.** El resultado (el número con que se cargó, descartado, reabierto) va en el aviso común, uno por
    documento, también si llega con el panel cerrado (y la planilla se vuelve a leer); lo que falta (también una pregunta de elegir
    obligatoria), un número o una fecha que no lo son y los problemas del servidor por pregunta, debajo de su dato, con el foco en el
    primero; un 409 (también `Forms.ReceivedDocument.AwaitingSender`, y el de las opciones de un documento que ya no se puede
    cambiar) dice el porqué del servidor y vuelve a leer el documento, y
    `Forms.Entry.VersionChanged` ofrece en el aviso «Volver a leer para «X»»; un 403 retira la bandeja; un 429 apaga con la espera;
    una red caída o un 5xx al escribir dicen que no se pudo confirmar el resultado y vuelven a leer el documento, y otro «Pasar al
    formulario» repite el mismo pedido.
11. **Lo mismo, igual en toda la app.** El marco de D2 (↑ ↓ ×, Escape y la posición al pie), la barra y los chips de la planilla,
    las fechas con números, tokens y `rem`.
12. **Celular, teclado e idiomas.** Desde 320 px la página no se desplaza de costado: la tabla lo hace dentro de su caja (lo mide la
    escena). El documento abre en su pantalla con las acciones abajo, a lo ancho. ↑ ↓ y Escape en el panel (dentro de la foto
    acercada, ↑ ↓ la desplazan); es/en; en la dirección van la página, el tamaño, el orden, el documento abierto y la pestaña
    (`tab=history`), y los filtros viven en la página.

**Diferencias con el tablero:**

- **Los filtros viven en memoria, no en la dirección** (decisión 16): la búsqueda trae montos, CUIT y operaciones. El estado también
  es un filtro privado, como en la planilla.
- **«Formulario» y «Mandó» son combos de «Filtros»**, como los de la planilla (PL2-A): sus opciones son las que trae la página,
  cada una contada por el servidor bajo los otros filtros, y se muestran sin la cantidad; escribir busca entre ellas. El servidor
  trae hasta 100, las de más documentos (y siempre la elegida); si cortó la lista, arriba de las opciones dice «Se muestran los 100
  con más documentos.».
- **La miniatura es el ícono del tipo** (foto, PDF o Word): no hay una ruta de miniatura, y bajar cada archivo para la tabla pesa.
- **«Datos leídos» es una columna por dato** (UD), con el nombre de su pregunta y «—» donde un documento no lo trae; un monto va a
  la izquierda porque el dato no trae su tipo.
- **«Se borra» es una columna**, con la fecha, en lugar de «Se borra el …» junto al estado (UD); **«Para revisar»** es el estado del
  propuesto que espera al equipo (VC1-A).
- **La bajada va en la (i)** del título y no está «27 en los últimos 7 días» del celular: la cantidad está en «Todos (27)» y al pie.
- **El aviso de los parecidos** (DOC6) llegó con la tarea 14, arriba de la planilla y con su acción
  ([cómo quedó](#doc6--armar-formulario-con-la-ia-2026-11-12)).
- **En el celular el segmentado baja de renglón**, como en el resto de la app, en lugar del desplegable «Estado: todos».
- **El panel es el marco de D2**: la posición va al pie, a la izquierda de las acciones (en el celular, arriba), no junto a ↑ ↓.
- **El visor**: una foto se acerca, se aleja, gira y se descarga; un PDF usa el visor del navegador, con sus páginas y su zoom, y
  «Descargar» (sin «Página 1 de 1» propio). Un archivo rechazado del que la bandeja no guardó copia (`stored: false`: más de 10 MB,
  un .doc viejo, un .docm) muestra su nombre y su motivo, sin visor ni «Descargar», y nunca se pide; como nunca se leyó, tampoco se
  vuelve a abrir (no quedaría nada para revisar: cambiar de formulario necesita su lectura).
- **La seguridad** es la insignia «Seguro» o «Con dudas» junto al desplegable, en lugar de «Reconocido por la IA · seguro».
- **El formulario se elige entre los que el servidor puede leerlo** (también un sin clasificar sin candidatos), con el suyo
  primero si ya no está entre ellos.
- **Una pregunta de elegir** (Cliente, Moneda) es un desplegable con sus opciones (las propias o las del catálogo que ve quien lo
  mandó), también la que no se leyó; la leída queda aunque su catálogo ya no la ofrezca, y las de una pregunta de catálogo que elige
  primero por un campo (LD1-A) van bajo su grupo, para distinguir «San Martín» de dos provincias. Sin «Revisar documentos», o en un
  confirmado o un descartado, el servidor no manda las opciones y el dato se lee. Si el catálogo tiene más de 200 opciones para quien
  lo mandó, se buscan en el servidor, de a 50, como una pregunta de catálogo en la carga desde la app; si a esa persona le falta el
  dato por el que filtra el catálogo, el dato dice «No hay opciones para {persona}: le falta «{dato}». Completalo en Datos de las
  personas.» en lugar del desplegable, y frena «Pasar al formulario» sólo si es obligatorio.
- **«Del catálogo»** marca un dato que completó el servidor, en lugar de «Por el CUIT de origen, en Clientes.» y «Banco Macro, por
  los primeros dígitos.»: el contrato no dice desde qué dato ni con qué catálogo.
- **Sólo lectura** muestra los datos en `DataList`, sin campos apagados ni la línea «Solo lectura: no tenés «Revisar documentos».»
- **El historial** no trae las correcciones dato por dato ni «sin texto»: el contrato no las tiene. Que la persona eligió un
  formulario de las dudas en WhatsApp es «Eligió el formulario», con «{persona}, por WhatsApp» debajo, y un cambio de formulario que
  el motor no permitió, «No se pudo leer para «{formulario}»: el motor no lo permitió.», con quien lo pidió debajo (el aviso dice lo
  mismo y el documento deja de decir «Leyendo…»).
- **«Ver los N datos más»** deja a la vista, plegado, el dato que pide una mirada (con dudas, que no pasa, obligatorio sin leer o
  con un problema); «Ver menos datos» vuelve a plegar los demás.
- **Los vacíos**: «Todavía no llegaron documentos» y «Ningún documento coincide» con «Limpiar todo», como la planilla, sin las
  descripciones; el error es el de la tabla con «Reintentar» y el aviso común, no un recuadro rojo.
- **El menú** dice «Documentos recibidos (7)», como «Formularios (4)», y la entrada va **después de las páginas fijas** del panel
  de Gestión de formularios (y del cajón del celular) **y antes de las carpetas**, no debajo de «Formularios»: su renglón, que aparece
  o se va cuando llegan los permisos, no mueve ninguna página, y las carpetas, que llegan después, se suman debajo de él (regla del
  2026-11-05, visual-baseline). Las migas de un documento abierto siguen colgando de «Documentos recibidos».
- **«Descartar»** confirma con el día en que se borraría; **«Pasar al formulario»** dice el número en el aviso común.
- **El PDF** no se ve en las capturas: Chromium sin ventana no dibuja su visor y la caja queda vacía; vitest prueba que el marco
  recibe la URL privada.

### DOC6 · Armar formulario con la IA (2026-11-12)

Tarea 14 del [plan](../../../ArquitecturaBase/docs/plans/2026-10-22-documentos-por-whatsapp.md#parte-b--la-bandeja-documentos-recibidos-doc5-a-y-doc6)
(decisión 17), sólo el front, contra el contrato del backend de la misma tarea (`FormDocumentProposalsController`) y con cuerpos
sintéticos hasta que se exporte la cohorte `forms-documents-http`: el aviso de los parecidos arriba de la planilla (los `groups` de
la página), «Armar formulario con la IA» en el panel de un sin clasificar y la página `/formularios/documentos/armar/{pedido}`
(`DocumentFormProposalPage`). La escena `documentFormProposal.spec.ts` guarda las referencias
`document-form-{notice,pending,proposal,failed}-{es,en}-{1440,390,320}`.

**La lista de chequeo:**

1. **Entero y armado.** `Page` con su (i) y «Cancelar» y «Crear borrador» en la banda; `Banner` para el aviso de la bandeja, el
   estándar parecido, el borrador ya creado, el pedido que falló y el que no se pudo seguir; «El formulario» (`Surface` con
   `FormField`, `Input` y `Textarea`), «Preguntas (N)» y «Documentos (N)» (`Surface` con `DataTable`, y el `DocumentViewer` de la
   bandeja); el diálogo de una pregunta (`Dialog` con `NativeSelect`, `CheckboxField` y `CatalogQuestionSelector`), el «Agregar» de
   la biblioteca (`FormStandardAddDialog`) y `ConfirmDialog` al salir con cambios. Estados: pidiendo, armando (se puede salir y
   volver), la propuesta, el borrador ya creado, el que falló, el que no se pudo seguir, el pedido que ya no está (`EmptyState` con
   «Volver a Documentos recibidos»), el error al pedirlo o al leerlo con «Reintentar», la espera de un 429 y sin permiso. El
   diálogo es breve y de una pregunta.
2. **Una tarea, zonas que se entienden solas.** Armar el formulario: a un lado la propuesta (sus avisos, «El formulario» y
   «Preguntas»), al otro los documentos de los que salió; en el celular, uno debajo del otro.
3. **El control según el dato.** Las preguntas y los documentos son colecciones: tablas. El tipo de una pregunta, uno entre diez:
   desplegable; si es obligatoria: casilla; su catálogo: el combo de catálogos de siempre; sus opciones: un campo por opción con
   «Agregar opción».
4. **Lo que se lee, en su lugar.** Lo leído para una pregunta va, en su diálogo, en `DataList`; ningún «Rótulo: valor» corrido.
5. **Un dato por columna.** Preguntas: Pregunta, Tipo (las opciones o el catálogo debajo, en gris: excepción A), Leído en el primero
   (sólo si alguna lo trae), Obligatoria y Acciones. Documentos: Documento (su nombre elige cuál se ve; el ícono del tipo es dibujo),
   Mandó y Recibido.
6. **Sin leyendas.** Qué hace la IA y qué pasa al publicar van en la (i) del título; qué es «Cómo reconocerlo», en la suya; el
   prefijo y el botón final, en las del editor; de dónde salen los documentos, en la (i) de «Documentos».
7. **Textos ciertos, una sola vez.** «La IA está leyendo el documento…» o «…los N documentos…», con la cantidad del pedido;
   «Crear borrador» está apagado sólo mientras llega la propuesta («Esperá a que la IA arme la propuesta.»); un pedido que falló o
   que no se pudo leer no ofrece crear, así no se dice dos veces que no hay propuesta; el borrador ya creado se dice una vez, en su
   `Banner`, con «Abrir el borrador» en la banda.
8. **Botones y lo apagado.** «Cancelar» junto a «Crear borrador», la principal y última; «Volver a pedir» en el aviso del que
   falló; «Agregar el estándar» (la principal del aviso) y «Armar igual con la IA». El lápiz y el tacho de cada fila editan y
   quitan (quitar no confirma: nada se guarda hasta «Crear borrador»). Lo apagado da su motivo encima: la espera de un 429, la
   biblioteca que se está leyendo o que ya no tiene el estándar.
9. **Lo elegido y la espera.** El documento que se ve lleva la barra de la fila elegida; «Pidiendo la propuesta…», «La IA está
   leyendo…» y «Creando…» llevan su aro; lo que viene ocupa su lugar con las zonas de `FormSkeleton`, y los documentos no se mueven
   cuando llega la propuesta ni cuando falla.
10. **Estados y mensajes.** El borrador creado va en el aviso común y abre su editor. Lo que falta y los problemas del servidor van
    debajo de su campo o de su pregunta, por la ruta del cuerpo (`name`, `prefix`, `recognition`, `questions[2].options`…), con el
    foco en el primero; lo que no es de un campo, en el aviso. Un 404 o un 409 al crear (también una propuesta vieja,
    `Forms.ReceivedDocument.ProposalNotFound`) dice el texto del servidor y vuelve a leer el pedido; un 400, 404 o 409 al pedir
    dice el texto del servidor con la vuelta a la bandeja; un 429 (también el cupo o la capacidad de la IA,
    `Ai.Assistant.QuotaExceeded` y `Ai.Assistant.CapacityLimited`) dice el texto del servidor y espera lo que pidió, con el motivo
    en «Reintentar» o en «Crear borrador» (en el aviso, cuándo se puede volver a intentar); un 403 retira la página; salir con
    cambios pide confirmación.
11. **Lo mismo, igual en toda la app.** El aviso es el `Banner` de siempre; las fechas van con números y la zona del perfil, las
    cantidades de los textos con los miles de la región, tokens y `rem`.
12. **Celular, teclado e idiomas.** Desde 320 px la página no se desplaza de costado (lo mide la escena): las tablas lo hacen dentro
    de su caja. El diálogo de una pregunta ocupa la pantalla del celular. es/en. En la dirección va el pedido y, sólo hasta que el
    servidor lo guarda, qué se pidió (`?documento=` o `?tema=`): volver a la dirección lee el mismo pedido.

**Diferencias con el tablero:**

- **«Cancelar» en lugar de «Descartar la propuesta»**: la propuesta no se borra en el servidor, y cancelar vuelve a la bandeja
  (con cambios, confirma).
- **Sin la línea «La IA propone; vos revisás y publicás…» ni la insignia «Propuesta de la IA»**: lo primero va en la (i) del
  título (sin leyendas) y lo segundo ya lo dice el título.
- **El estándar parecido es un aviso arriba de la propuesta**, como en el detalle del tablero («Agregar el estándar» y «Armar igual
  con la IA»), no una zona fija al pie: sin estándar no hay zona, porque «Ninguno de la biblioteca, todavía…» no ayuda a decidir.
  «Agregar el estándar» abre el «Agregar» de la biblioteca, con las carpetas de Diseñar formularios.
- **Las preguntas son una tabla con un dato por columna** (UD): «Leído en el primero» es una columna, en lugar de «Leído en el
  primero: …» en el renglón, y no hay columna de número. En el celular es la misma tabla, que se desplaza de costado dentro de su
  caja como las demás de la app, en lugar de una tarjeta por pregunta.
- **Una pregunta se edita en un diálogo** (el lápiz de su fila) con su texto, su tipo, si es obligatoria y sus opciones o su
  catálogo, y lo leído arriba para comparar; «Agregar pregunta» abre el mismo diálogo.
- **Los documentos son una tabla** (Documento, Mandó, Recibido) con el elegido en el visor de la bandeja, en lugar de las
  miniaturas y del resumen «Los sin clasificar que se parecen: de … del 17 al 22 de octubre.»; lo que pasa al publicar va en la (i)
  de «Documentos».
- **El aviso de la bandeja dice la cantidad y el tema, con «Armar formulario con la IA»**, sin «¿Armamos un formulario?» (lo dice
  el botón) ni «Ver los 5», porque la bandeja no filtra por tema. Con varios temas, un aviso por tema (hasta cinco), el más grande
  primero.
- **La entrada desde el panel** es «Armar formulario con la IA» debajo del formulario de un sin clasificar que tiene su lectura y su
  copia, no la tarjeta «Sin clasificar · 5» del concepto B.
- **Si falla**, el aviso rojo dice por qué (la IA no propuso ninguno, el pedido ya no está o no se pudo armar) con «Volver a pedir»,
  que pide otra vez, con un pedido nuevo, para el mismo tema o documento; no hay «Crear borrador» ni la segunda frase del tablero:
  los documentos siguen a la vista al costado.
- **Mientras arma**, el aro y «La IA está leyendo los N documentos y armando la propuesta…» van arriba de las zonas que vienen; si
  no se puede saber cómo sigue, un aviso amarillo con «Reintentar».
- **Ya creado el borrador**, la propuesta queda de sólo lectura, con «Ya se creó el borrador con esta propuesta.» y «Abrir el
  borrador» en la banda.
- **En el celular las acciones quedan en la banda**, como en las demás páginas, y no al pie.

### VC1-A · Una entrada por fila (2026-11-13)

Tarea 30 del [plan](../../../ArquitecturaBase/docs/plans/2026-10-22-documentos-por-whatsapp.md#ubicación-y-contacto-por-whatsapp-w3-y-varias-cargas-desde-un-excel)
(reglas B6 y B9 y decisiones técnicas 12 y 13), sólo el front, sobre los guards de la tarea 26 (front 9f2d7c5d) y el backend de la
bandeja con filas (tarea 28), con cuerpos sintéticos hasta que se exporten `forms-documents-http`, `whatsapp-audio-http` y
`forms-responses-http`: en la bandeja, «Fila 5» debajo de la planilla, «La fila» con «Descargar la planilla» en el panel, los motivos
y el historial de una fila; en el chat del operador, «Por qué lo propuso» del aviso de las cargas con su enlace; y en la respuesta,
«Salió de una planilla». Las escenas `receivedDocumentRows.spec.ts` y `whatsapp-spreadsheet-rows.spec.ts` guardan las referencias
`document-rows`, `document-row`, `document-row-waiting` y `whatsapp-spreadsheet-rows`, es/en a 1440, 390 y 320. El aviso con sus
textos y las cargas los escribe el backend (tarea 29); el chat dibuja cada carga como la tarjeta de su formulario, sin el pie, que va
sólo a WhatsApp.

**La lista de chequeo:**

1. **Entero y armado.** Las piezas de DOC5-A: la planilla con `DataTable`, el marco de D2 con `Tabs`, `Banner`, `DisabledReason`,
   `DataList` y `ConfirmDialog`; «La fila» es una caja con el marco del visor (el título y «Descargar la planilla» arriba, `DataList`
   debajo). En el chat, `DataList` dentro de la caja de «Por qué lo mandó» y el enlace común. Estados: una fila que espera a su
   persona, para revisar por el tope o porque no se le pudo mandar, sin clasificar (no encaja), confirmada, descartada y repetida (de
   una respuesta o de otra fila de la misma planilla), «Descargando…», la bajada que falla y la espera de un 429; la carga, los
   vacíos, el error y los permisos son los de DOC5-A.
2. **Una tarea, zonas que se entienden solas.** Una fila se revisa como un documento: la fila como llegó en el lugar del documento,
   por qué está donde está, su formulario con sus datos y, al pie, las acciones.
3. **El control según el dato.** No hay controles nuevos: bajar la planilla es un botón; el filtro es el segmentado de siempre.
4. **Lo que se lee, en su lugar.** Las celdas de la fila, el encabezado a la izquierda y el valor a la derecha (`DataList`), tal como
   llegaron; «Por qué lo propuso», en dos columnas desde 640 px y, en el celular, cada valor debajo de su dato, como «Prellenado
   con», con un renglón por formulario o por hoja cuando hay varios.
5. **Un dato por columna.** La fila va debajo del nombre de la planilla en gris (la excepción A), «Ventas · fila 3» si el libro tiene
   varias hojas; «Monto» sigue en su columna.
6. **Sin leyendas.** Qué pasa al cambiar el formulario de una fila va en la (i) de «Formulario»; el porqué de una fila es un dato y va
   en el `Banner`.
7. **Textos ciertos, una sola vez.** Una fila es «la fila»: «Le mandamos esta fila…», «Venció sin que {persona} la confirmara…», «La
   descartó…», «Llegó y la IA la reconoció»; una que no es carga dice «No encaja en ningún formulario.», una que la IA no llegó a leer
   (`unseen`, fuera de la muestra), «La IA no llegó a leerla.», y una repetida, «Repetida: el mismo dato «Fecha» que COB-000118.»
   («dato» concuerda con cualquier pregunta; varios, «los mismos datos …») o «Repetida: igual a la fila 3 de «Ventas».». El número de
   una fila es un identificador: va sin separador de miles, como en Excel. En la bandeja, el enlace de cada fila se describe con su
   «Fila 5»: las filas de una planilla comparten el nombre del enlace.
8. **Botones y lo apagado.** Los de una fila que espera a su persona quedan en su lugar, apagados, con el motivo encima, como en
   DOC5-A; «Descargar la planilla» espera un 429 con su motivo.
9. **Lo elegido y la espera.** La fila abierta lleva su barra; «Descargando…» con su aro.
10. **Estados y mensajes.** Una bajada que falla lo dice en el aviso común; un 403 retira la bandeja; los demás son los de DOC5-A.
11. **Lo mismo, igual en toda la app.** El panel, la planilla y el chat de siempre; tokens y `rem`.
12. **Celular, teclado e idiomas.** Desde 320 px la página no se desplaza de costado; es/en con las fechas con números; el chat junta
    las filas con la conjunción de cada idioma («Filas 2, 3 y 4», «Rows 2, 3, and 4»).

**Diferencias con el tablero:**

- **El historial de una fila conserva la simplificación de DOC5-A:** «Llegó y la IA la reconoció», con «De {persona}, por WhatsApp»
  debajo, en lugar de «Llegó en {archivo}, fila {n}, por WhatsApp de {persona}.» y «La IA la reconoció: {formulario}, seguro.»: la
  planilla y la fila ya están en el título y debajo de él, y el formulario y la seguridad, en «Revisar». No está «Leyó {a} de {b}
  datos»: el contrato no lo trae. La confirmación es «Se cargó como {número}», como la de un documento, sin «sin correcciones».
- **El panel dice la fila debajo del título** («Fila 5 · Marta Ruiz · 12/11/2026, 10:40»), y las migas, el aviso de descartar o volver
  a abrir y la confirmación nombran «cobranzas-semana.xlsx · Fila 5»: el título sigue siendo la planilla, como en la bandeja.
- **«Descargar la planilla» la pide al tocarlo**, no al abrir la fila: recorrer las filas con ↑ ↓ no baja la planilla cada vez.
- **El filtro es «Propuestos»**, que trae los que esperan al equipo («Para revisar») y los que esperan a su persona («Propuesto»),
  sin un segmento propio para «Para revisar».
- **El enlace de «Por qué lo propuso» abre la bandeja**, no las filas de esa planilla: `spreadsheetRows` no trae las entradas y los
  filtros de la bandeja viven en memoria. Sólo lo ve quien puede abrir «Documentos recibidos».
- **«Para el equipo» junta en un rango más de tres filas seguidas** («Filas 5 a 8») y nombra hasta tres («Filas 2, 3 y 4»), como
  escribe el tablero los dos casos; con varias hojas, un renglón por hoja («Ventas · filas 2 y 3»). Una repetida de otra fila dice
  «Fila 9, igual que fila 4»: el tablero no la dibuja.
- **«Salió de una planilla»** va en la actividad, a la hora en que llegó la planilla, con «{archivo}, fila {n}» debajo, y en «Cómo
  empezó» reemplaza a «Salió de un documento»; «La pasó al formulario {persona}» sigue en «Cómo empezó», como en DOC5-A, sin «Desde
  «Documentos recibidos»», que ya dice el enlace.
- **«Por qué lo propuso» no usa `DataList` en el celular:** como «Prellenado con», sus dos columnas van desde 640 px y debajo cada
  valor va bajo su dato, porque en la caja angosta de un mensaje a 320 px «Recognized» se partía adentro de la palabra.
- **Una repetida de otra fila** dice «Repetida: igual a la fila {n}.» (o «… de «Ventas».»), el texto que el tablero dejaba a la tarea 30.
