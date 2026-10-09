# Formularios por WhatsApp: tableros elegidos

Fecha: **2026-10-08**. Estado: **diseño elegido por el usuario, sin implementar**.

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

Propuesta posterior, en revisión (Etapa del asistente): un formulario puede sugerir otro. No reemplaza a los
tableros elegidos; el modelo y las reglas están en los
[acuerdos del 2026-10-08](../../../ArquitecturaBase/docs/plans/formularios-modelo-demo/acuerdos-2026-10-08.md).

| Captura | Qué define |
| --- | --- |
| [La idea](evidence/formularios-whatsapp/s1-sugerir-idea.png) | Formularios independientes conectados por sugerencias: cuándo, qué datos pasan y cómo se ofrecen. |
| [Configurar qué sugerir después](evidence/formularios-whatsapp/s2-sugerir-editor.png) | Sección del editor con su propio «Guardar sugerencias», sin republicar. |
| [En el celular](evidence/formularios-whatsapp/s3-sugerir-celular.png) | Entrega que termina en factura, y los casos «Ahora no», sin IA, nada que sugerir y sin permiso. |
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
   y Quitar. Se editan en el lugar, en la fila expandida. Los tipos se nombran en palabras (Texto corto, Texto largo,
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

## Etapa 1: el formulario y el chat de hoy

Es el primer desarrollo. Las pantallas que no cambian respecto de la historia completa se implementan tal cual.

Entra:

- **Panel Formularios** solo con «Diseñar formularios». La sección «Respuestas» llega con la planilla.
- **Listado «Diseñar formularios»**, como el tablero 02.
- **Editor de la Etapa 1**, como e1-1: «El formulario» con Nombre y Texto del botón final; «Preguntas» con los tipos
  Texto corto, Texto largo, Número con decimales, Fecha, Sí o no y Elegir de una lista; las opciones de una lista se
  escriben a mano en el editor; vista previa del celular. No aparecen «Cuándo lo ofrece el asistente» ni «Cuando
  llega una respuesta».
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
- **Celular**, como e1-4: el empleado recibe el pedido, completa el formulario de WhatsApp y lo envía. Si lo cierra sin
  enviar, no se guarda nada.

Queda para etapas siguientes: la planilla de respuestas y su sección en el panel, Una respuesta, aprobación y PDF,
el asistente con IA, los catálogos y referencias (clientes), cargar desde la web, correcciones, mandar fuera de las
24 horas con plantilla de Meta y las acciones como descontar stock.

Las respuestas de la Etapa 1 ya se guardan con su versión y su número: cuando llegue la planilla, aparecen sin migrar.

## Pendientes antes de programar cada pantalla

- **Numeración (decidida el 2026-10-08).** Prefijo del formulario, como en los tableros (VIS-000001): se propone a
  partir del nombre, el administrador puede cambiarlo hasta la primera publicación, es único y no se recicla. Suma el
  campo «Prefijo de numeración» en «El formulario»: se dibuja en el lienzo antes de programarlo.
- **Estados no dibujados.** Carga, vacío, sin coincidencias, error con reintento, sin permiso, 320/390 px e inglés del
  listado, el editor y el diálogo de envío. Se dibujan en el mismo lienzo cuando la etapa llegue a esa pantalla;
  mientras tanto valen los patrones de la plantilla de listados y el [contrato de mensajes](../guides/mensajes-y-estados.md).
- **Vista oficial de Meta.** El tablero 03 dibuja una vista previa propia; la oficial (iframe de Meta) y su CSP siguen
  pendientes como dice el plan.

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
