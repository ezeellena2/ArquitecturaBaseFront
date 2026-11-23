# Casos del asistente: tableros elegidos

Fecha: **2026-10-21**. **Elegidos AS1-A y AS2–AS6** de la versión 98 del lienzo. **La pantalla «Asistente» (AS1-A, AS2, AS3 y AS5) está programada** en `/whatsapp/asistente` desde el 2026-11-11, con [las diferencias de abajo](#diferencias-de-lo-programado--2026-11-11); **el chat (AS4)**, en `/whatsapp/chat` desde el 2026-11-12, con [las suyas](#el-chat-as4--2026-11-12).

Origen: la sección «Casos del asistente» de la página «Formularios por WhatsApp» del Artifact
[Sistema visual — ArquitecturaBase](https://claude.ai/artifact/HPbmDPLnr8JZ9TxevtTqJJ). Como el Artifact es privado
y puede cambiar fuera de Git, este documento y sus capturas congelan lo elegido. El alcance y las decisiones están en el
[plan](../../../ArquitecturaBase/docs/plans/2026-10-21-casos-del-asistente.md); las pantallas, los textos y los estados
salen de acá.

## Los tableros

AS1 tenía tres conceptos de cómo se organiza la pantalla: A, con pestañas; B, una página guiada; C, una lista con el
detalle al costado. **Se eligió AS1-A**; B y C quedan en el lienzo como las alternativas que no se eligieron. AS2–AS6
valen para el concepto elegido.

| Captura | Qué define |
| --- | --- |
| [AS1-A · Pestañas](evidence/asistente-casos/as1-a-pestanas.png) | **Elegido el 2026-10-21.** «Asistente» en el panel de WhatsApp, junto a Chat. La pantalla es la del agente principal: cabecera «Agente principal · Atiende todas las conversaciones en modo Asistente» y cuatro pestañas, Perfil, Conocimiento, Casos (con su cantidad) y Límites; se entra por Casos. «Probar» abre un panel al costado (AS3). Un solo Guardar para las cuatro pestañas, con revisión y 409. Para un negocio que empieza, abre en Perfil con un aviso: hasta configurarlo, el asistente hace lo de hoy. En el celular, las pestañas se desplazan de costado y Guardar queda abajo. Pide «Configurar el asistente»; sin él, la entrada no aparece y por la dirección dice «No tenés permiso». Cuando haya varios agentes (etapa Agentes), cada uno abre esta misma pantalla desde una lista. |
| [AS2 · Los casos](evidence/asistente-casos/as2-casos.png) | **Elegido el 2026-10-21.** La lista, en el orden en que se eligen: los casos propios, que se arrastran y se pausan (programado con ↑ ↓, sin arrastre); los de los formularios, en un bloque fijo, que salen de su «Cuándo lo ofrece» y se editan en el formulario; y «Cualquier otra cosa», siempre al final, que no se borra, no se pausa ni se mueve. Cada caso dice cuándo, el tipo de entrada (cualquiera, texto o audio, en una lista que deja lugar para fotos y documentos) y qué hace, de un menú cerrado: mandar un formulario, un texto exacto (español y, opcional, inglés), responder con la información del negocio (instrucciones), preguntar con botones (hasta 3, cada uno con su destino), derivar a una persona (motivo) o no responder. El editor se abre al costado, con Listo; se guarda con la pantalla. |
| [AS3 · Probar el asistente](evidence/asistente-casos/as3-probar.png) | **Elegido el 2026-10-21.** Un panel que prueba como si escribiera una cuenta vinculada, con lo guardado, y avisa si hay cambios sin guardar. Un mensaje por renglón; varios renglones son una ráfaga (espera 4 s sin mensajes nuevos, como mucho 15). Muestra las acciones en orden, hasta 3, cada una con su caso, por qué, lo que usó y cómo la vería la persona, y «No se mandó nada». Ejemplos: «hola», «¿qué hora es?», «¿hacen envíos a Córdoba?» con la información y sin ella (deriva), «se rompió la heladera en la sucursal Centro», «quiero hablar con alguien» y la ráfaga «Hola» / «Estoy en la sucursal Centro» / «Se rompió la heladera y necesito un repuesto», que responde con un texto y dos formularios. |
| [AS4 · El chat](evidence/asistente-casos/as4-chat.png) | **Elegido el 2026-10-21.** Cada acción sale como «Asistente», con su porqué debajo: «Por qué respondió esto» (el caso, lo que usó y el texto, guardado tal como salió) o «Por qué lo mandó» para un formulario. Derivar manda el mensaje fijo del perfil, pasa la conversación a Atención manual y la marca «Necesita una persona» con el motivo: en la cabecera, en una franja y en la lista de chats, con el filtro «Necesita una persona (N)»; se quita cuando alguien le responde. También el texto exacto, los botones, «Sin respuesta del asistente», el tope del día (deriva) y, en Atención manual, la respuesta redactada como borrador para el operador, con la sugerencia de hoy (H2). Sin avisos fuera del sistema. |
| [AS5 · Límites y conocimiento](evidence/asistente-casos/as5-limites-y-conocimiento.png) | **Elegido el 2026-10-21.** Límites: las reglas fijas de toda respuesta redactada (solo con lo cargado; corta y en el idioma de la persona; sin enlaces, teléfonos, precios ni compromisos que no estén cargados; si no sabe, deriva), temas que no responde, lo que no puede prometer, el largo máximo (lo que se pasa no sale y deriva), el tope de respuestas por conversación y día (aparte de los 2 ofrecimientos; al llegar, deriva) y las acciones que el agente puede usar. Al derivar, el mensaje es el del perfil. Conocimiento: la Información del negocio, de solo lectura, sección por sección con su estado («Cargado», «Sin cargar», «Texto anterior, sin revisar»); las preguntas sin respuesta y los textos anteriores sin revisar no se usan. Se edita en su pantalla, con «Administrar información del negocio». |
| [AS6 · El circuito de punta a punta](evidence/asistente-casos/as6-circuito.png) | **Elegido el 2026-10-21.** Los ejemplos en el celular de la persona y en el chat del operador, con lo que hacen la persona, el sistema y la IA, más la ráfaga con tres acciones. La IA elige y redacta; el sistema le pasa esa conversación de las últimas 24 horas con lo que ya hizo, vuelve a validar límites y permisos antes de mandar y guarda el caso, lo que usó y el texto. Como hoy, solo en modo Asistente y dentro de las 24 horas. |

## Diferencias de lo programado — 2026-11-11

La revisión del 11/11 contra la lista de chequeo de [visual-baseline](visual-baseline.md) y las reglas nuevas (sin leyendas, motivo de lo apagado, un dato por columna, fechas sólo con números) cambió dos cosas, aprobadas por el usuario:

- La zona «Cuando deriva» de Límites se fue: repetía el mensaje del Perfil. Los motivos para derivar (un caso, un tema que no responde, que no encuentre la respuesta en lo cargado, una respuesta que se pasa del largo máximo y el tope del día) pasaron a la (i) de «Mensaje al derivar a una persona», en Perfil.
- El recuadro «Siempre, en todas las respuestas redactadas» pasó a la (i) del título «Límites».

Y al programar, con los componentes que ya existen:

1. El encabezado de los paneles (el editor de un caso y Probar) es blanco con una línea, como los diálogos, no la banda verde.
2. «Qué hacer» va en una sola columna de tarjetas: sin descripciones cada una ocupa un renglón y `RadioGroupField` no tiene grilla.
3. «Prellenado con lo que diga el mensaje.» y «No se borra ni se mueve» explicaban algo: pasaron a la (i) de su banda.
4. Un caso propio que manda un formulario dice «Mandar <formulario>», igual que el bloque de los formularios.
5. «Editar en Información del negocio» y «Editar en el formulario» van sin el ícono de enlace externo: navegan dentro de la app.
6. Las zonas de Conocimiento usan los títulos reales de Información del negocio («Datos del negocio», «Ubicación y zona de atención», «Horario de atención», «Servicios y condiciones», «Preguntas frecuentes»), en el orden del servidor; «Qué dice» lista los hechos confirmados y debajo, en gris, cuántas preguntas no tienen respuesta. Un texto anterior sin revisar no se muestra.
7. En Probar cada burbuja lleva su hora (`MessageBubble` la exige), el número de cada acción es el recuadro de `StepList` y no hay una cuenta elegida de entrada: Probar la pide.
8. «Necesita una persona» y su motivo van sin «Motivo:».
9. «Cualquier otra cosa» no tiene «Tipo de entrada».
10. En el celular, Descartar y Guardar quedan abajo con `sticky`, como en la carga web de un formulario.
11. Límites suma «Agregar» junto al cuadro del tema.
12. Lo que el tablero no dibuja: la pestaña con un problema lleva un ícono, el 409 se revisa en una zona con `ComparisonTable` y, mientras se guarda o hay un conflicto, la lista queda inerte.

Capturas: `src/test/visual/screenshots/assistant-agent-{cases,case-editor,profile-empty,limits,knowledge,test}-{es,en}-{1440,390,320}.png`.

### El chat (AS4) — 2026-11-12

Programado contra el contrato del backend (`needsPerson`, `assistantReply`, `assistantEvents` y `textProposal`), con las reglas de [visual-baseline](visual-baseline.md) que el tablero no tenía. Difiere en:

1. **«Por qué respondió esto» en dos columnas** ([lecturas](visual-baseline.md#lecturas)): la acción va como etiqueta con su ícono (la de «Asistente») y, en `DataList`, «En la respuesta» («1 de 2», sólo con varias acciones), «Caso» («Cualquier otra cosa» para el último), «Tocó» («Visita»), «Por qué» y «Usó»; lo vacío no aparece. No van «Caso 2:» ni «Texto: el de arriba…»: el servidor manda el «cuándo» del caso, no su número, y el texto es el del mensaje.
2. **La franja** no repite «Necesita una persona», que ya está en la cabecera ([el estado, una vez](visual-baseline.md#el-estado-una-vez--2026-11-06)): dice sólo el motivo, sin «Motivo:» y sin comillas (el de un caso, tal cual), en el `Banner` de atención, con su triángulo en lugar de la persona; la marca queda para el lector de pantalla y «Se quita cuando alguien le responde.» pasó a la (i).
3. **La marca de la fila** es la etiqueta común, del ancho de su texto, entre el nombre y el resumen. El resumen es el del servidor («Mensaje del asistente»), no «Asistente: Te paso…».
4. **Los filtros** son un segmentado de tres, siempre separados (`wrap="always"`): en la columna angosta «Necesita una persona (N)» baja de renglón, también a 390 px en español, porque cada opción mide 44 px en el celular. La cantidad se ve aunque sea 0. Desde el 2026-11-22 los filtros van en la pieza para elegir, sin cantidades (DS1-A).
5. **Las líneas** («Sin respuesta del asistente», «El asistente derivó la conversación») llevan debajo los mismos datos de un porqué (caso, por qué y, al derivar, la marca con su motivo), en lugar de una oración con «caso 4: «…»»; «Pasó a Atención manual» no se repite: lo dice el modo de la cabecera.
6. **El mensaje al derivar** lleva su porqué («Derivar a una persona», el caso y la marca con su motivo), sin «mensaje al derivar» en la hora; la línea del derivar aparece sólo cuando ese mensaje no pudo salir.
7. **El botón tocado** es «Tocó «Visita»» sólo cuando el servidor lo guarda (un texto o un derivar); un botón que manda un formulario lo interpreta el asistente como un mensaje, así que «eligió «Visita» → mandó Registrar visita» no existe. Un formulario de una ráfaga sigue con «Por qué lo mandó»: hoy el servidor no le suma lugar ni caso.
8. **El borrador del operador** muestra el texto entero en su recuadro, más «Caso» y «Usó» en dos columnas; los botones van a la derecha del título en la compu y abajo en el celular. «Usar como borrador» sólo escribe en un compositor vacío y habilitado: si no, queda apagado con su motivo («Ya hay una respuesta escrita.», el del compositor o la espera de un 429), y si el descarte falla el texto queda en el compositor y la tarjeta sigue.
9. **Al programar**: el cuerpo de «Por qué lo mandó» de un formulario también se lee desde la izquierda, como el nuevo; las dos tarjetas de sugerencia dejan a su contenido un ancho propio, así en el celular los botones bajan en lugar de aplastar el texto.

Capturas: `src/test/visual/screenshots/whatsapp-assistant-{handoff,replies,draft}-{es,en}-{1440,390,320}.png` y `whatsapp-assistant-list-{es,en}-{390,320}.png`; las `whatsapp-*-1440` (chat, accesos y planillas) muestran el filtro nuevo.

### Tope de ofrecimientos (TO1-A) — 2026-11-21

Elegido el 2026-11-21 en el lienzo [Tope de ofrecimientos del asistente](https://claude.ai/artifact/NsTVmw3osSU4MX5jYsb8ck) (privado, como los demás tableros). El tope de ofrecimientos de formularios, que era un 2 fijo en el código, se edita en Límites: la columna de la derecha suma un tercer número debajo de «Tope de respuestas», «Tope de ofrecimientos de formularios», con la misma pieza (obligatorio, de 1 a 50, «por conversación y día»). Vale 2 mientras no se cambie, se guarda con el resto de la pantalla (el mismo Guardar, la revisión y el 409) y la revisión del conflicto suma su renglón. La (i) de «Tope de respuestas» ya no nombra el 2: dice «Aparte del tope de ofrecimientos de formularios». La del campo nuevo explica qué cuenta y qué pasa al llegar: el formulario no sale y la conversación deriva con el motivo «Llegó al tope de ofrecimientos del día» (O36, decidido el mismo día), que también lee la franja del chat. En el celular el campo queda en la misma columna, debajo de «Tope de respuestas».

Capturas: `src/test/visual/screenshots/assistant-agent-limits-{es,en}-{1440,390,320}.png`.

### Planillas, documentos y rechazos (RC2-B) — 2026-11-22

Confirmado el 2026-11-22 en el lienzo [WhatsApp: reglas en Configuración](https://claude.ai/artifact/DRQbDpxdqUDp9XVQRCN32B) (privado, como los demás tableros), junto con Configuración › WhatsApp. Límites suma, en la columna de la derecha debajo de «Tope de ofrecimientos de formularios», «Volver a ofrecer un formulario rechazado»: el desplegable simple con «Nunca» (por defecto, lo de antes) y «A los N días», que trae al lado el número de días (7 al elegirlo, de 1 a 365, «días»). Debajo de la superficie «Límites» va otra, «Planillas y documentos», con «Formularios por planilla» (3, de 1 a 10, «por planilla») y «Páginas de un PDF» (10, de 1 a 10, «páginas como máximo»), cada uno con su (i). Todo se guarda con el resto de la pantalla (el mismo Guardar, la revisión y el 409) y la revisión del conflicto suma sus renglones. El tablero decía de 1 a 50 páginas; al programar quedó de 1 a 10, lo más que lee la lectura de documentos, y su nota lo dice.

Capturas: `src/test/visual/screenshots/assistant-agent-limits-{es,en}-{1440,390,320}.png`.

## Lo que se fijó al dibujar

El plan no lo decía; se resolvió con la opción más simple y quedó confirmado al elegir:

- la pantalla va en el panel de WhatsApp y pide «Configurar el asistente»; el conocimiento se ve ahí y se edita en
  Información del negocio;
- un solo Guardar para toda la pantalla, con revisión y 409; Probar usa lo guardado;
- los casos de los formularios van en un bloque fijo entre los propios y «Cualquier otra cosa», y no se reordenan;
- derivar pasa la conversación a Atención manual y la marca se quita con la primera respuesta de una persona;
- sin perfil, «Cualquier otra cosa» empieza en «No responder»: hasta configurarlo, el asistente hace lo de hoy;
- el sistema vuelve a revisar el largo máximo, y el tope del día también deriva;
- las acciones que puede usar son del agente, para que cada agente tenga las suyas en la etapa Agentes;
- se confirman las ráfagas (4 s sin mensajes nuevos, tope de 15 s), hasta 3 acciones por respuesta y el borrador para el
  operador en Atención manual.
