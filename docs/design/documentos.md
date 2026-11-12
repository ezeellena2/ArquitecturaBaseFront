# Documentos por WhatsApp: tableros elegidos

Fecha: **2026-10-22**. **Elegidos DOC5-A y DOC7-A, con DOC1–DOC4 y DOC6**, de la versión 116 del lienzo; la 117 los marca
y suma las correcciones al elegir (abajo), la 118 agranda DOC5-A para que entren sus notas y la 119 deja DOC2 y DOC4 como
quedaron en el plan. Por programar, salvo la pantalla «Biblioteca» de DOC1, sin la lectura de documentos, que llegó con la
etapa 2 de ARCA (BI1-A, [motor para documentos](motor-para-documentos.md)). DOC7-A, el tablero de cada formulario, quedó
programado en back y front el 2026-11-11 ([cómo quedó](#doc7-a--tarjetas-armadas-solas-2026-11-11)).

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
| [DOC2 · Los tres casos y los otros formatos](evidence/documentos/doc2-los-tres-casos-y-los-otros-formatos.png) | **Elegido el 2026-10-22.** Juan manda el comprobante por WhatsApp, con texto o sin él. Se lee solo lo de cuentas vinculadas y activas con permiso de cargar respuestas, y se clasifica entre los formularios con lectura que esa persona puede completar; si el que encaja no se le puede mandar, lo dice y deriva (DOC4). **Seguro:** «Recibí un comprobante de transferencia de $150.000 del Galicia. ¿Lo cargo?» con «Abrir formulario», prellenado y con el comprobante adjunto. **Duda:** «¿Qué es este documento?» con hasta 3 botones; con dos posibles, el tercero es «Otro», y con la elección sigue como el seguro. **No lo reconoce:** «No reconocí este documento. ¿Qué querés cargar con él?» con la lista de lo que esa persona puede completar y «Otro», que lo deja «Sin clasificar» y lo anota en Formularios que faltan. El sistema guarda la foto como copia privada y valida sin IA el CBU, el CUIT y los duplicados; en el chat del operador el documento es un mensaje más, con «Por qué lo propuso» o «Por qué preguntó» debajo, como en AS4. **Los otros formatos:** un PDF (se lee entero, hasta el tope), un Word y un Excel con varias filas, donde cada fila es una carga; la ubicación y el contacto que se comparten no pasan por la IA y completan las preguntas elegidas en el editor del formulario abierto («Dirección de entrega», «Recibió» y «Teléfono de quien recibe» en «Registrar entrega»), que se vuelve a mandar. Los mensajes van en el idioma de la persona. |
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
   «%». El reparto no es una tabla (excepción F) y dice «38 · 31 %», como lo pide el plan.
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
- **El período anterior se nombra con sus fechas** («+18 % que 01/09/2026 – 30/09/2026», fechas sólo con números): no «que
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
- **Un reparto lleva una línea entre renglones** y, donde no entra, la barra debajo del nombre; dice «38 · 31 %» también en el
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
