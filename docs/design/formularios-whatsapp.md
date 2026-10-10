# Formularios por WhatsApp: tableros elegidos

Fecha: **2026-10-08**, con las variantes de los cuatro incrementos de la Etapa 1 y el botón «Abrir formulario»
agregados el **2026-10-10**.
Estado: **diseño elegido por el usuario, sin implementar**.

Origen: la página «Formularios por WhatsApp» del Artifact
[Sistema visual — ArquitecturaBase](https://claude.ai/artifact/HPbmDPLnr8JZ9TxevtTqJJ). Como el Artifact es privado
y puede cambiar fuera de Git, este documento y sus capturas congelan lo elegido. El usuario pidió implementarlo
**tal cual** y empezar de a poco, por el diseño del formulario y su conexión con el chat que ya existe (Etapa 1).

Relación con el [plan técnico](../../../ArquitecturaBase/docs/plans/2026-10-07-formularios-dinamicos-y-whatsapp-flows.md):
su arquitectura, persistencia, contratos, seguridad y pruebas siguen valiendo. Las pantallas, la navegación, los textos
y el orden de entrega salen de acá. La maqueta aislada del 2026-10-07 y 2026-10-08 del plan (pestañas Campos/Uso/Reglas/
Tabla/Documento/Circuito/Versiones, selector de vista y estado de prueba, claves de campo a la vista) queda como
procedencia reemplazada: no se promueve ni se usa como referencia de pantallas.

## Cómo leer los tableros

- Están dibujados a mano con los tokens Campo y Public Sans de `src/index.css` (la biblioteca ArquitecturaBase UI del
  lienzo sigue sin sincronizar y conserva el aspecto anterior). Al programar, cada parte se arma con su pieza de
  `src/shared/ui` (tabla de correspondencias abajo), no copiando el dibujo.
- Los círculos naranjas numerados son notas del tablero; su explicación está en la columna de la derecha. No son UI.
- Los datos (Juan Gómez, Pérez Hnos., VIS-000024) son ficticios.

## Los tableros

La historia completa, en el orden en que se lee el lienzo:

| Captura | Qué define |
| --- | --- |
| [La idea en una mirada](evidence/formularios-whatsapp/01-idea.png) | Los cinco pasos (armar, publicar, completar en WhatsApp, quedar guardado, aprobar y PDF) y las cuatro reglas que no cambian. |
| [Diseñar formularios](evidence/formularios-whatsapp/02-disenar-listado.png) | Navegación «Formularios» y listado de formularios con su estado en WhatsApp dicho en palabras. |
| [Editar un formulario](evidence/formularios-whatsapp/03-editor.png) | Editor de una sola pantalla con vista previa del celular, preguntas editadas en el lugar y «Cuando llega una respuesta». |
| [Publicar en WhatsApp](evidence/formularios-whatsapp/04-publicar.png) | Confirmación con «Qué cambia» y «Qué va a pasar», y los cuatro estados después de publicar. |
| [En el celular del empleado](evidence/formularios-whatsapp/05-celular.png) | Recorrido con asistente (cuenta, revisa, confirma, recibe aprobación y PDF) y cuatro casos: sin asistente, ambigüedad, número no vinculado, empresa que escribe primero. |
| [Las respuestas](evidence/formularios-whatsapp/06-respuestas.png) | Planilla por formulario: columnas desde las preguntas, filtros desde los tipos, «—» para preguntas que no existían, canal de origen y estado. |
| [Una respuesta](evidence/formularios-whatsapp/07-una-respuesta.png) | Detalle con versión, origen enmascarado, aporte del asistente, historial, corrección y vista previa del PDF; Aprobar/Rechazar. |
| [Versiones](evidence/formularios-whatsapp/08-versiones.png) | Qué pasa al agregar, renombrar, quitar o cambiar el tipo de una pregunta, y qué viene después. |

La Etapa 1:

| Captura | Qué define |
| --- | --- |
| [Editor justo para empezar](evidence/formularios-whatsapp/e1-1-editor.png) | El editor de la Etapa 1 y el editor de opciones de «Elegir de una lista». |
| [Mandar un formulario desde el chat](evidence/formularios-whatsapp/e1-2-chat-enviar.png) | Botón «Enviar formulario» en el chat actual y su diálogo. |
| [La respuesta llega al chat](evidence/formularios-whatsapp/e1-3-chat-respuesta.png) | Formulario enviado y respuesta recibida en la línea del tiempo, y vista previa en la lista de chats. |
| [En el celular de Juan](evidence/formularios-whatsapp/e1-4-celular.png) | Lo que ve el empleado en la Etapa 1, sin asistente. |

Incremento 1 de la Etapa 1, crear y editar (2026-10-10). Son variantes de los tableros elegidos, con los textos de
[la preparación del front](../plans/formularios-etapa-1-preparacion.md):

| Captura | Qué define |
| --- | --- |
| [A · El listado de la Etapa 1](evidence/formularios-whatsapp/e1-a-listado.png) | El 02 recortado: panel con solo «Diseñar formularios», columnas Formulario, Preguntas, En WhatsApp, Último cambio y Acciones (solo Editar), filtros con conteos del servidor y los estados de la lista. |
| [B · Nuevo formulario](evidence/formularios-whatsapp/e1-b-alta.png) | El editor e1-1 vacío: nada existe hasta «Guardar borrador», prefijo sugerido, pregunta nueva abierta en el lugar, Subir y Bajar, qué pasa al guardar (Guardando…, Guardado, No se guardó, Sin confirmar) y qué pide confirmación. |
| [C · El prefijo de numeración](evidence/formularios-whatsapp/e1-c-prefijo.png) | Sugerido, editado, ocupado, fijo al publicar, fijo aunque la publicación falló y fijado mientras se editaba. |
| [D · Otra persona guardó antes](evidence/formularios-whatsapp/e1-d-conflicto.png) | Aviso con «Revisar», comparación «Guardado actualmente» y «Mis cambios» por pregunta y opción, «Usar borrador actual» o «Conservar mis cambios», sin combinar nada solo. |
| [E · Textos en dos idiomas](evidence/formularios-whatsapp/e1-e-idiomas.png) | Español e inglés en el mismo editor: un idioma a la vez con el original debajo, lo que falta marcado en la fila, el campo y la vista previa. Se guarda incompleto; para publicar hacen falta los dos. |

Incremento 2 de la Etapa 1, publicar en WhatsApp (2026-10-10). Variantes del tablero 04 y del editor e1-1, sobre el
[contrato propuesto](../../../ArquitecturaBase/docs/plans/formularios-incremento-2-publicacion-contrato.md). Quedan a
definir las acciones de «Necesita revisión». Decidido el 2026-10-10: se publica solo lo guardado (D4) y en español e
inglés, con las traducciones cargadas en el editor (D5, variante E).

| Captura | Qué define |
| --- | --- |
| [P1 · Publicar la versión 1](evidence/formularios-whatsapp/e2-p1-publicar.png) | Confirmación de la primera publicación: «Qué incluye», «Qué queda fijo» (las preguntas de la versión y el prefijo) y «Qué va a pasar». Aceptar no es publicar. |
| [P1 · Antes de publicar](evidence/formularios-whatsapp/e2-p1-antes.png) | Variantes del diálogo: comprobando, cambios sin guardar, pregunta que WhatsApp no podría mostrar, versión siguiente con sus diferencias, comprobación vencida, cambios de otra persona, publicación en curso y cuenta de WhatsApp no lista. |
| [P2 · Publicando](evidence/formularios-whatsapp/e2-p2-publicando.png) | El avance en palabras (Aceptada, Enviada a WhatsApp, WhatsApp la revisa, Lista para mandar), la versión anterior en uso y el borrador editable mientras tanto. |
| [P2 · Cómo termina](evidence/formularios-whatsapp/e2-p2-resultado.png) | Publicada, rechazada por una pregunta, falla general con «Reintentar», sin confirmar, necesita revisión y cómo se ve en el listado. |
| [P3 · Vista previa oficial](evidence/formularios-whatsapp/e2-p3-vista.png) | Vista orientativa frente a la oficial de WhatsApp: selector Borrador / Versión N, carga, vencida y no se puede mostrar, con «Abrir vista oficial». |

Incremento 3 de la Etapa 1, mandar un formulario desde el chat (2026-10-10). Variantes de e1-2 y e1-3, con los textos y
estados que ya usa el chat (`src/locales/*/whatsapp.json`):

| Captura | Qué define |
| --- | --- |
| [C1 · ¿Puede recibir un formulario?](evidence/formularios-whatsapp/e3-c1-cuenta.png) | Encabezado y botón según la cuenta vinculada: con correo, sin correo, sin vínculo, inactiva, sin formularios para esa persona y sin permiso de responder. El motivo va debajo del botón deshabilitado. |
| [C2 · Elegir el formulario](evidence/formularios-whatsapp/e3-c2-elegir.png) | Diálogo con búsqueda y paginado, el idioma en que le llega, el mensaje y los estados de la lista. |
| [C3 · El mensaje y los dos botones](evidence/formularios-whatsapp/e3-c3-mensaje.png) | Mensaje obligatorio de hasta 1024 caracteres; «Abrir formulario» («Open form» en inglés) y el botón final del formulario. |
| [C4 · Si algo cambia con el diálogo abierto](evidence/formularios-whatsapp/e3-c4-cambios.png) | Ventana cerrada, permiso revocado, fuera de atención manual, otro envío, vínculo cambiado y formulario no disponible, sin perder lo escrito. |
| [C5 · Después de enviar](evidence/formularios-whatsapp/e3-c5-estado.png) | Guardando, en cola, leído, no se pudo enviar, envío sin confirmar con «Ya revisé el WhatsApp» y pedido sin confirmar con «Consultar envío». |

Incremento 4 de la Etapa 1, la respuesta llega al chat (2026-10-10). Variantes de e1-3:

| Captura | Qué define |
| --- | --- |
| [R1 · La respuesta llega](evidence/formularios-whatsapp/e4-r1-llega.png) | Guardando (sin valores), guardada con su número, no se pudo guardar, no reconocida, llegó dos veces y la vista previa en la lista de chats. |
| [R2 · Quién ve lo que respondió](evidence/formularios-whatsapp/e4-r2-permisos.png) | Con y sin `formrecords.read`, el permiso revocado con el chat abierto y lo que nunca lleva valores (lista, avisos, nombres accesibles). |
| [R3 · Cómo se muestran los valores](evidence/formularios-whatsapp/e4-r3-valores.png) | Los seis tipos sin perder nada («No», «0», «Sin respuesta», decimales exactos, fecha sin hora), opciones de su versión, respuesta larga plegada, mensaje de WhatsApp borrado y respuesta en inglés. |

Etapa 2, catálogos (2026-10-10), sobre los
[acuerdos §5](../../../ArquitecturaBase/docs/plans/formularios-modelo-demo/acuerdos-2026-10-08.md) y el plan §5.2. Decidido el
mismo día: el inglés de las opciones de un catálogo es opcional (si falta, se usa el español); cambiar el catálogo de una
pregunta publicada la convierte en pregunta nueva; si la opción elegida se dio de baja antes de responder, no se guarda,
se avisa al operador y se ofrece mandarlo de nuevo. La consulta avanzada necesita un ADR antes de programarse.

| Captura | Qué define |
| --- | --- |
| [K1 · Catálogos](evidence/formularios-whatsapp/cat-k1-listado.png) | Entrada nueva en Formularios; listado con origen, opciones, qué formularios lo usan y estado (activo, no se puede usar con el motivo, dado de baja). |
| [K2 · Nuevo catálogo](evidence/formularios-whatsapp/cat-k2-nuevo.png) | Elegir de dónde salen las opciones: escritas a mano, de la base con filtros o con una consulta avanzada. El origen no cambia después. |
| [K3 · Escritas a mano](evidence/formularios-whatsapp/cat-k3-manual.png) | Texto, detalle y código por opción, orden, dar de baja sin borrar, formularios que lo usan y cómo lo ve el empleado. |
| [K4 · De la base, con filtros](evidence/formularios-whatsapp/cat-k4-filtros.png) | Vista Usuarios, columnas de texto y detalle, condiciones, «sin incluir a quien lo recibe», orden y vista previa como si lo recibiera alguien. |
| [K5 · Con una consulta](evidence/formularios-whatsapp/cat-k5-consulta.png) | Consulta de lectura sobre vistas de catálogo, prueba con una persona de ejemplo, motivos de rechazo y cómo se arregla un catálogo que dejó de funcionar. |
| [K6 · Elegir de un catálogo](evidence/formularios-whatsapp/cat-k6-pregunta.png) | El tipo de pregunta nuevo en el editor; catálogos que no se pueden usar, visibles pero no elegibles. |
| [K7 · Al mandar y al responder](evidence/formularios-whatsapp/cat-k7-envio.png) | Opciones preparadas para cada persona al enviar, catálogo inválido, más de 200 o ninguna opción, lo que ve Juan, la referencia guardada y la opción dada de baja antes de responder. |

Etapa 3, planilla de respuestas (2026-10-10). **Propuesta para revisar**: los tableros 06 y 07 recortados a esta etapa,
sin aprobación, PDF ni asistente. Cargar desde la web queda para después (decidido el 2026-10-10).

| Captura | Qué define |
| --- | --- |
| [T1 · La planilla](evidence/formularios-whatsapp/pla-t1-planilla.png) | «Respuestas» en el panel, columnas fijas (número, recibida, cargó) y una por pregunta de todas las versiones; «—» si no existía y «Sin respuesta» si no se contestó. |
| [T2 · Más filtros](evidence/formularios-whatsapp/pla-t2-filtros.png) | Un filtro por pregunta según su tipo, con conteos del servidor; versión del formulario; búsqueda privada fuera de la dirección. |
| [T3 · Una respuesta](evidence/formularios-whatsapp/pla-t3-respuesta.png) | Lo que respondió con las preguntas de su versión, de dónde vino, historial y anterior/siguiente dentro de la planilla. |
| [T4 · Estados y casos](evidence/formularios-whatsapp/pla-t4-estados.png) | Carga, sin respuestas, sin coincidencias, error, muchos formularios, sin permiso, respuesta que no está y pregunta que cambió de tipo. |

Etapa 4, reglas, aprobación, PDF y avisos (2026-10-10), sobre los acuerdos §3 y el plan. Decidido el mismo día: después
de «Pedir aprobación» no hay más acciones en la misma regla; una respuesta que espera aprobación sigue con las reglas con
que llegó; nadie aprueba lo que cargó. Los avisos fuera de las 24 horas necesitan plantillas de Meta.

| Captura | Qué define |
| --- | --- |
| [G1 · Cuando llega una respuesta](evidence/formularios-whatsapp/reg-g1-reglas.png) | Reglas en palabras (cuándo, si, hacer en orden), una abierta para editar, Guardar reglas e historial de revisiones. |
| [G2 · El diseño del PDF](evidence/formularios-whatsapp/reg-g2-pdf.png) | Comprobante simple: nombre en los dos idiomas, qué preguntas incluye, quién aprobó, texto al pie y vista previa. |
| [G3 · Por aprobar](evidence/formularios-whatsapp/reg-g3-por-aprobar.png) | La bandeja de quien decide, en el panel con su cantidad; ordenada de la más vieja a la más nueva. |
| [G4 · Aprobar o rechazar](evidence/formularios-whatsapp/reg-g4-decidir.png) | El detalle con la decisión; rechazar pide motivo; otra persona decidió antes; no aprobar lo propio. |
| [G5 · Qué pasó después](evidence/formularios-whatsapp/reg-g5-historial.png) | Cada acción con su estado (esperando, en curso, hecho, no se pudo, sin confirmar, no aplica) y el PDF como copia fija. |
| [G6 · Lo que recibe el empleado](evidence/formularios-whatsapp/reg-g6-celular.png) | Confirmación al recibir, aviso con el PDF al aprobar, motivo al rechazar, también en inglés. |

Etapa 5, el asistente (2026-10-10), sobre los acuerdos §4 y §6. También son de esta etapa «Cuándo lo ofrece» (03),
el recorrido con asistente (05) y las sugerencias entre formularios (s1–s4). Decidido el mismo día: con un mensaje que no
es un formulario, el asistente no contesta y la conversación queda para un operador; ofrece formularios hasta 2 veces por
día en cada conversación; cambiar el modo pide el permiso nuevo «Configurar el asistente», que tiene Admin.

| Captura | Qué define |
| --- | --- |
| [H1 · El chat en modo Asistente](evidence/formularios-whatsapp/asi-h1-modo-asistente.png) | El asistente manda el formulario prellenado con su nombre como autor, «Por qué lo mandó», mensajes automáticos de reglas y «Tomar atención manual». |
| [H2 · En Atención manual, sugiere](evidence/formularios-whatsapp/asi-h2-sugerencia.png) | La sugerencia arriba del compositor y el diálogo de envío con los datos prellenados que se pueden destildar. |
| [H3 · Cambiar de modo](evidence/formularios-whatsapp/asi-h3-modos.png) | Confirmación para pasar a Asistente, tomar la atención a mitad de un envío, IA no disponible, chats existentes, marca en la lista y sin permiso. |
| [H4 · Un catálogo que propone el asistente](evidence/formularios-whatsapp/asi-h4-catalogo.png) | Pedido por WhatsApp, propuesta para revisar en la web y aprobación por una persona. |
| [H5 · Los límites del asistente](evidence/formularios-whatsapp/asi-h5-limites.png) | Pregunta si no está seguro, no insiste, respeta permisos y 24 horas, y deja todo registrado en la respuesta. |

Propuesta posterior, en revisión (Etapa del asistente): un formulario puede sugerir otro. No reemplaza a los
tableros elegidos; el modelo y las reglas están en los
[acuerdos del 2026-10-08](../../../ArquitecturaBase/docs/plans/formularios-modelo-demo/acuerdos-2026-10-08.md).

| Captura | Qué define |
| --- | --- |
| [La idea](evidence/formularios-whatsapp/s1-sugerir-idea.png) | Formularios independientes conectados por sugerencias: cuándo, qué datos pasan y cómo se ofrecen. |
| [Configurar qué sugerir después](evidence/formularios-whatsapp/s2-sugerir-editor.png) | Sección del editor con su propio «Guardar sugerencias», sin republicar. |
| [En el celular](evidence/formularios-whatsapp/s3-sugerir-celular.png) | Entrega que termina en factura, y los casos «Juan no lo abre», sin IA, nada que sugerir y sin permiso. |
| [La cadena en la web](evidence/formularios-whatsapp/s4-sugerir-cadena.png) | La respuesta recuerda de dónde vino, qué sugerencia la ofreció y por qué. |

## Decisiones de diseño

1. **Navegación.** «Formularios» es una entrada propia del menú principal con su panel, como WhatsApp. Arriba,
   «Respuestas», con un enlace por formulario publicado que la persona puede ver. Abajo, separado, «Diseñar
   formularios», solo con permiso de administrar. Hoy `src/layouts/navigation.ts` es estático: el plan define cómo el
   panel compone la parte fija con la lista que viene del backend.
2. **Editor en una sola pantalla, sin pestañas.** A la izquierda, las superficies «El formulario», «Preguntas» y
   «Cuando llega una respuesta». A la derecha, la vista previa del celular, que refleja el borrador mientras se edita
   y aclara que la vista oficial de WhatsApp aparece al publicar.
3. **Preguntas.** Una fila por pregunta: arrastre, número, etiqueta, tipo en palabras, Obligatoria u Opcional, Editar
   y Quitar. En la Etapa 1, «Subir» y «Bajar» reemplazan al arrastre (variante B); si el arrastre llega después, es
   un atajo y nunca la única forma de ordenar. Se editan en el lugar, en la fila expandida. Los tipos se nombran en palabras (Texto corto, Texto largo,
   Número con decimales, Fecha, Sí o no, Elegir de una lista). No se muestran claves internas, IDs, JSON ni la versión
   del esquema.
4. **Estados en palabras.** Cada formulario muestra una sola etiqueta: Borrador, Publicando…, Publicado · versión N,
   No se pudo publicar o Sin confirmar. El plan conserva los estados locales y los de Meta por separado; la pantalla
   traduce la combinación a esa etiqueta.
5. **Guardar no es publicar.** «Guardar borrador» conserva el trabajo. «Publicar en WhatsApp» abre la confirmación
   y, al aceptar, crea la versión, la manda a WhatsApp y la activa. Internamente son los pasos del recorrido A del
   plan, con estado durable; la persona ve una sola acción y su estado.
6. **La confirmación de publicar** muestra «Qué cambia respecto de la versión anterior» (diferencias calculadas) y
   «Qué va a pasar» en tres pasos. El motivo de un rechazo se muestra junto a la pregunta marcada; la versión
   publicada anterior sigue funcionando.
7. **Respuestas.** Planilla por formulario. Las columnas son las preguntas; los filtros salen de sus tipos; la
   búsqueda mira los textos largos; «—» indica que la pregunta no existía en la versión de esa respuesta. «Cargó»
   muestra la persona y el canal con ícono y texto accesible. «Estado» aparece solo si el formulario pide aprobación.
8. **Una respuesta** se muestra con las preguntas de su versión, de dónde vino (número enmascarado y enlace a la
   conversación), lo que propuso el asistente, el historial y la corrección como respuesta nueva. El PDF es una
   vista previa hasta aprobar y una copia fija después.
9. **WhatsApp.** El asistente solo propone y la persona confirma. Si el mensaje es ambiguo pregunta; sin IA se elige
   de una lista; un número sin cuenta vinculada recibe orientación; fuera de 24 horas hace falta una plantilla de
   Meta. Los mensajes al empleado usan voseo y dicen el número de la respuesta.
10. **Dos botones distintos.** El mensaje que abre un formulario en WhatsApp tiene un solo botón y dice siempre
    «Abrir formulario». El botón final, adentro del formulario, es el «Texto del botón final» que define cada uno
    («Enviar», «Confirmar visita»). WhatsApp no admite otro botón en el mismo mensaje: una sugerencia que la persona
    no quiere simplemente no se abre.
11. **Dos idiomas (2026-10-10).** Cada texto que ve el empleado (nombre, preguntas, ayudas, opciones y botón final) se
    escribe en español y en inglés. Se puede guardar con traducciones pendientes; para publicar hacen falta los dos.
    Cada empleado recibe el formulario, el mensaje y «Abrir formulario» en el idioma de su cuenta.

## Etapa 1: el formulario y el chat de hoy

Es el primer desarrollo. Las pantallas que no cambian respecto de la historia completa se implementan tal cual.

Entra:

- **Panel Formularios** solo con «Diseñar formularios». La sección «Respuestas» llega con la planilla.
- **Listado «Diseñar formularios»**, como la variante A: el tablero 02 sin respuestas y con solo Editar.
- **Editor de la Etapa 1**, como e1-1: «El formulario» con Nombre y Texto del botón final; «Preguntas» con los tipos
  Texto corto, Texto largo, Número con decimales, Fecha, Sí o no y Elegir de una lista; las opciones de una lista se
  escriben a mano en el editor; vista previa del celular. No aparecen «Cuándo lo ofrece el asistente» ni «Cuando
  llega una respuesta». El alta es la variante B, el prefijo la C y el conflicto al guardar la D.
- **Publicar**, como el tablero 04. El primer publicado es la versión 1.
- **Chat de WhatsApp**, como e1-2 y e1-3:
  - El encabezado de la conversación agrega «Cuenta vinculada: correo» cuando el contacto está vinculado a una cuenta.
  - El editor de respuesta suma un botón chico, contorneado, «Enviar formulario», a la izquierda de «Enviar».
    Aparece solo si se cumplen las condiciones que hoy habilitan una respuesta (permiso de responder, Atención
    manual, ventana de 24 horas abierta, número disponible, sin envío pendiente) y además el contacto está vinculado
    a una cuenta activa que puede completar al menos un formulario publicado.
  - El diálogo «Enviar un formulario a nombre» tiene la lista de formularios (nombre y «Versión N · K preguntas»),
    «Mensaje que lo acompaña» prellenado y editable, el aviso de hasta cuándo se puede mandar y la botonera
    Cancelar / Enviar formulario.
  - El envío usa la cola durable del chat: requestId, 202 como «en cola», los mismos estados (En cola, Entregado,
    Leído, Sin confirmar), sin reintento automático y bloqueando otro envío mientras está pendiente.
  - La línea del tiempo muestra el formulario enviado como burbuja saliente con la tarjeta del formulario, y la
    respuesta como burbuja entrante con la tarjeta «Respuesta del formulario»: cada pregunta con su respuesta y el pie
    «Guardada como número».
  - La lista de chats muestra «Respondió nombre del formulario».
  - No hay respuestas automáticas: el operador contesta a mano.
- **Celular**, como e1-4: el empleado recibe el pedido con el botón «Abrir formulario», completa el formulario de
  WhatsApp y lo envía con el botón final. Si lo cierra sin enviar, no se guarda nada.

Queda para etapas siguientes: la planilla de respuestas y su sección en el panel, Una respuesta, aprobación y PDF,
el asistente con IA, los catálogos y referencias (clientes), cargar desde la web, correcciones, mandar fuera de las
24 horas con plantilla de Meta y las acciones como descontar stock.

Las respuestas de la Etapa 1 ya se guardan con su versión y su número: cuando llegue la planilla, aparecen sin migrar.

## Pendientes antes de programar cada pantalla

- **Numeración (decidida el 2026-10-08, dibujada el 2026-10-10).** Prefijo del formulario, como en los tableros
  (VIS-000001): se propone a partir del nombre, el administrador puede cambiarlo hasta que se acepta la primera
  publicación (aunque después falle), es único y no se recicla. Sus estados están en la variante C.
- **Estados no dibujados.** Los de la lista están en la variante A y los de guardar en B y D. Faltan 320/390 px e
  inglés del listado y el editor, y los estados del diálogo de envío. Se dibujan en el mismo lienzo cuando la etapa llegue a esa pantalla;
  mientras tanto valen los patrones de la plantilla de listados y el [contrato de mensajes](../guides/mensajes-y-estados.md).
- **Vista oficial de Meta.** Sus estados están en P3; la CSP del iframe y el comportamiento real en el navegador se
  prueban en el piloto, como dice el plan.

## Correspondencia con `shared/ui`

| En el tablero | Pieza |
| --- | --- |
| Banda de la pantalla con volver y estado | `Page` con `backTo` y `status` |
| Superficie con banda («El formulario», «Preguntas») | `Surface` |
| Campos con etiqueta y ayuda | `FormField` con `Input`, `Textarea` o `NativeSelect` |
| Casillas («Obligatoria», «Pedir aprobación») | `CheckboxField` |
| Opciones del diálogo de envío | `RadioGroupField` |
| Diálogos | `Dialog`; la confirmación de publicar, `ConfirmDialog` si alcanza su contenido |
| Aviso de la versión publicada | `Banner` `info` |
| Tablas y paginado | `DataTable` y `Pagination` |
| Búsqueda, filtros y chips | `FilterBar`, `SearchInput`, `FilterMenuTrigger`, `FilterChip`, `SegmentedControl` |
| Acciones de fila | `RowActions` |
| Etiquetas de estado | `Badge` |
| Burbujas y línea del tiempo | `MessageBubble`, `MessageHistory`, `MessageDateDivider` |
| Íconos | `shared/ui/icons`; faltan el del formulario (portapapeles) y el de arrastre |

Una pieza que no exista se sube a `shared/ui` con su prueba, no se dibuja local en la feature.
