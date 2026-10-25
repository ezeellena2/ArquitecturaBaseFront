# Formularios por WhatsApp: tableros elegidos

Fecha: **2026-10-08**, con las variantes de los cuatro incrementos de la Etapa 1 y el botón «Abrir formulario»
agregados el **2026-10-10**.
Estado al **2026-10-21**: Etapas 1–5, idioma original/traducción opcional (I1–I3), baja/reactivación/eliminación y menú/detalle **MF1, DC0 y DC1** implementados localmente. Los cierres fechados siguientes conservan su alcance histórico; las reglas vigentes están en [formularios](../../../ArquitecturaBase/docs/features/formularios.md). El [piloto total con Meta, OpenAI y Azure del 2026-10-20](../../../ArquitecturaBase/docs/plans/verificacion-y-produccion.md#formularios-piloto-total-con-proveedores-reales--2026-10-20) acreditó el recorrido anterior. Los pilotos propios de ciclo de vida y menú/detalle esperan su code review.

Origen: la página «Formularios por WhatsApp» del Artifact
[Sistema visual — ArquitecturaBase](https://claude.ai/artifact/HPbmDPLnr8JZ9TxevtTqJJ). Como el Artifact es privado
y puede cambiar fuera de Git, este documento y sus capturas congelan lo elegido. El usuario pidió implementarlo
**tal cual** y empezar de a poco, por el diseño del formulario y su conexión con el chat que ya existe (Etapa 1).

Relación con los [resúmenes por etapa](../../../ArquitecturaBase/docs/plans/formularios/README.md):
ahí están el alcance y las decisiones técnicas de cada etapa. Las pantallas, la navegación, los textos
y el orden de entrega salen de acá. La maqueta aislada del 2026-10-07 y 2026-10-08 (pestañas Campos/Uso/Reglas/
Tabla/Documento/Circuito/Versiones, selector de vista y estado de prueba, claves de campo a la vista) queda como
procedencia reemplazada: no se promueve ni se usa como referencia de pantallas.

## Cierre y comprobaciones de Etapa 1 (2026-10-11)

A–E, P1–P3, C1–C5 y R1–R3 están integrados. La comprobación respeta el presupuesto HTTP del servidor y conserva el foco al localizar una pregunta. El chat distingue metadata oculta por permisos, muestra un resumen fijo sin valores privados en la bandeja/contacto y retira respuestas del DOM y la caché al perder lectura. Consultar un envío con 404 confirmado reabre el diálogo existente con el mismo UUID/cuerpo y repetición explícita.

El coordinador confirmó publicación y vista oficial, entrega desde la SPA, respuesta de seis tipos, número guardado y recarga en el piloto real. El móvil aislado verificó lectura autorizada/denegada en español y recarga a 390/320 px, foco y ausencia de valores privados. Usa API/PostgreSQL/Redis reales con identidad, Meta y puertos neutrales de pruebas, con credenciales temporales eliminadas; no acredita por sí solo el sink/source tipado de BusinessForms ni el teléfono físico.

Los pendientes de versión/idioma de respuesta, señal de purga, etiqueta de expansión, motivos de 409 y remonte del compositor están en el [resumen de la Etapa 2](../../../ArquitecturaBase/docs/plans/formularios/etapa-2-catalogos.md). El front conserva la escala decimal recibida y no reconstruye ceros omitidos. El teléfono físico respondió 100: 12,50/12.50 siguen sin calificar; la vista oficial aceptó punto y rechazó coma. Por decisión del usuario, estos pendientes menores de R3, la calificación del decimal físico y la intermitencia de Roles se trasladan a Etapa 2 sin bloquear el cierre. Las etapas siguientes siguen como diseño elegido.

La verificación general del front pasó 1455/1455 pruebas en 136 archivos; lint, 48/48 pruebas de arquitectura y TypeScript quedaron sin diagnósticos. La última corrida visual sobre `856e641`, con tres workers y sin retries ni cambio de referencias, terminó **292/294**: fallaron las esperas iniciales del campo Nombre del editor en español a 390/320 px. No se declara la suite visual completa verde ni una causa probada. Estas dos esperas iniciales quedan como deuda del arnés junto con la intermitencia de Roles; el próximo corte deberá comprobar la preparación de Idiomas con un control negativo antes de modificar los tests. Se conserva el informe `a2-r4-front-visual-session-shell-final.json`, sus trazas y la revisión de las 32 capturas en `.test-artifacts/forms-step5/`; el servidor visual quedó apagado. Por instrucción del usuario se registra este resultado y no se inicia otra corrida completa.

## Cierre de Manual K1–K3 (2026-10-12)

El listado y alta de catálogos y el editor Manual están integrados en /catalogos: metadatos es/en, opciones con identidad estable, posiciones confirmadas y movimientos entre páginas en un Guardar;409 conserva el borrador y exige adopción explícita. El contador de uso permanece desconocido sin lectura de formularios. Al cerrar ese corte estaban pendientes Filters/K4, K6/K7 y el piloto Meta. K4, K6 y K7 se implementaron después; el estado vigente está en el resumen de la Etapa 2.

El front pasó1542/1542 pruebas en149 archivos con1worker, build ylint48 de arquitectura limpios. La única completa visual terminó300/306; los6fallos pasaron6/6 en focal con configuración estable, sin modificar snapshots/assertions/productoIA. Manual pasó6/6 en es/en a 1440/390/320, con30capturas revisadas. El recorrido separado SPA/API/PostgreSQL/Redis pasó9/9 y8capturas; los tokens se mantuvieron en memoria y el arnés se cerró. Se conservan las corridas rojas y la procedencia automática de15cuerpos HTTP; no se acredita Meta ni Etapa2 completa. El [resumen vigente](../../../ArquitecturaBase/docs/plans/formularios/etapa-2-catalogos.md) conserva el resto del alcance.

## Verificación del front de Filters K4 (2026-10-12)

El editor K4 permite elegir columnas, condiciones y orden sobre Usuarios, probar con una persona explícita buscable/paginada y guardar sólo la configuración con revisión. Guardar vuelve a probar y no escribe con más de 200 opciones. El listado conserva origen/estado en la URL y usa conteos del servidor para search+state, ignorando sólo origen. Una fuente no disponible bloquea preview/escritura y conserva los filtros editables; Reintentar permite comprobar su restauración. Las etiquetas de choices, incluidos booleanos, proceden del backend; columnas/operadores se traducen por keys. Reutiliza el dueño, revisión/adopción y controles de Manual, con permisos propios de catálogos.

La última full Vitest, posterior a la corrección de foco durante la búsqueda de personas, pasó **1577/1577 en 153 archivos**, sin omitidos; la anterior 1574/1574 corresponde al estado anterior al fix. Los consumidores afectados pasaron 47/47 con las cohortes finales; build 3132 módulos y lint 48/48 de arquitectura terminaron sin diagnósticos. Los 8 cuerpos Filters y 15 Manual-current se copiaron sin cambios junto con sus manifiestos automáticos y se verifican por tamaño/SHA256. El runner backend registra head e284822a, cambios sólo de tests luego comprometidos en 8d9f292 y focal 122/122; conserva su full 2708/2710 roja. Los 15 cuerpos Manual históricos y su provenance permanecen intactos; la ausencia de los nuevos campos se rechaza explícitamente.

La completa visual ejecutada terminó **303/312**, con 9 fallos y 0 omitidos. La focal de esos mismos 9 pasó **9/9**: 6 K4, tras reproducir y corregir la deshabilitación del selector durante una consulta pendiente, y 3 del asistente cuya causa no quedó acreditada. Se revisaron **42/42 capturas K4** en es/en a1440/390/320 sin defectos visuales pendientes. El intento previo de colección evaluó 0 tests y falló por 2 imports JSON sin atributos; se corrigió antes de la completa. Se conservan todos los informes, el aviso NO_COLOR/FORCE_COLOR y las referencias sin actualizar. La visual usa rutas productivas con HTTP/persistencia simulados y la cohorte anterior como semilla; los consumidores finales y API/PostgreSQL/Redis del backend se acreditan por separado. El servidor visual quedó apagado; este corte no usó Meta ni inició K6. El cierre conjunto y los pendientes K6/K7 siguen en el [resumen vigente](../../../ArquitecturaBase/docs/plans/formularios/etapa-2-catalogos.md).

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
| [Recorrido guiado](evidence/formularios-whatsapp/00-recorrido.png) | **Elegido el 2026-10-17** (versión 78 del lienzo). Una visita de punta a punta en ocho capítulos: armar el formulario y sus catálogos, publicar, mandar, responder con fotos o un audio, el asistente, reglas con aprobación y PDF, la planilla con Excel y los formularios que faltan. Cada paso dice su etapa y qué hacen la persona, el sistema y la IA. Resume tableros elegidos; no define pantallas. |
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

Incremento 1 de la Etapa 1, crear y editar (2026-10-10). Son variantes de los tableros elegidos, con los textos de la preparación del front (retirada; Git la conserva):

| Captura | Qué define |
| --- | --- |
| [A · El listado de la Etapa 1](evidence/formularios-whatsapp/e1-a-listado.png) | El 02 recortado: panel con solo «Diseñar formularios», columnas Formulario, Preguntas, En WhatsApp, Último cambio y Acciones (solo Editar), filtros con conteos del servidor y los estados de la lista. BA1-A (2026-10-20) le suma los dados de baja y sus acciones. |
| [B · Nuevo formulario](evidence/formularios-whatsapp/e1-b-alta.png) | El editor e1-1 vacío: nada existe hasta «Guardar borrador», prefijo sugerido, pregunta nueva abierta en el lugar, Subir y Bajar, qué pasa al guardar (Guardando…, Guardado, No se guardó, Sin confirmar) y qué pide confirmación. |
| [C · El prefijo de numeración](evidence/formularios-whatsapp/e1-c-prefijo.png) | Sugerido, editado, ocupado, fijo al publicar, fijo aunque la publicación falló y fijado mientras se editaba. |
| [D · Otra persona guardó antes](evidence/formularios-whatsapp/e1-d-conflicto.png) | Aviso con «Revisar», comparación «Guardado actualmente» y «Mis cambios» por pregunta y opción, «Usar borrador actual» o «Conservar mis cambios», sin combinar nada solo. |
| [E · Textos en dos idiomas](evidence/formularios-whatsapp/e1-e-idiomas.png) | Español e inglés en el mismo editor: un idioma a la vez con el original debajo, lo que falta marcado en la fila, el campo y la vista previa. Se guarda incompleto; para publicar hacen falta los dos. Su regla de idioma la reemplaza I1 (2026-10-18). |

Incremento 2 de la Etapa 1, publicar en WhatsApp (2026-10-10). Variantes del tablero 04 y del editor e1-1, sobre el
contrato de publicación de entonces (hoy en [formularios](../../../ArquitecturaBase/docs/features/formularios.md)). Quedan a
definir las acciones de «Necesita revisión». Decidido el 2026-10-10: se publica solo lo guardado (D4) y en español e
inglés, con las traducciones cargadas en el editor (D5, variante E). Desde el 2026-10-18, I2 e I3 reemplazan esa exigencia de idioma.

| Captura | Qué define |
| --- | --- |
| [P1 · Publicar la versión 1](evidence/formularios-whatsapp/e2-p1-publicar.png) | Confirmación de la primera publicación: «Qué incluye», «Qué queda fijo» (las preguntas de la versión y el prefijo) y «Qué va a pasar». Aceptar no es publicar. |
| [P1 · Antes de publicar](evidence/formularios-whatsapp/e2-p1-antes.png) | Variantes del diálogo: comprobando, cambios sin guardar, pregunta que WhatsApp no podría mostrar, versión siguiente con sus diferencias, comprobación vencida, cambios de otra persona, publicación en curso y cuenta de WhatsApp no lista. |
| [P2 · Publicando](evidence/formularios-whatsapp/e2-p2-publicando.png) | El avance en palabras (Aceptada, Enviada a WhatsApp, WhatsApp la revisa, Lista para mandar), la versión anterior en uso y el borrador editable mientras tanto. |
| [P2 · Cómo termina](evidence/formularios-whatsapp/e2-p2-resultado.png) | Publicada, rechazada por una pregunta, falla general con «Reintentar», sin confirmar, necesita revisión y cómo se ve en el listado. «Consultar publicación» y «Repetir el mismo intento» van en el encabezado de su superficie, con la espera como su ayuda y sin texto debajo (decisión del 2026-10-23). |
| [P3 · Vista previa oficial](evidence/formularios-whatsapp/e2-p3-vista.png) | Vista orientativa frente a la oficial de WhatsApp: selector Borrador / Versión N, carga, vencida y no se puede mostrar, con «Abrir vista oficial». |

Incremento 3 de la Etapa 1, mandar un formulario desde el chat (2026-10-10). Variantes de e1-2 y e1-3, con los textos y
estados que ya usa el chat (`src/locales/*/whatsapp.json`):

| Captura | Qué define |
| --- | --- |
| [C1 · ¿Puede recibir un formulario?](evidence/formularios-whatsapp/e3-c1-cuenta.png) | Encabezado y botón según la cuenta vinculada: con correo, sin correo, sin vínculo, inactiva, sin formularios para esa persona y sin permiso de responder. El motivo del botón deshabilitado es su ayuda al pasar el mouse o con el foco (`DisabledReason`), sin texto debajo (decisión del 2026-10-23); la espera de un 429 es, igual, la ayuda de los controles que apaga: el primario del pie, el Reintentar de la lista o de la preparación, la búsqueda, las tarjetas de formularios y la paginación, «Consultar envío» junto al botón y «No, gracias» y «Revisar y enviar» de la sugerencia del asistente. |
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
[resumen de la Etapa 2](../../../ArquitecturaBase/docs/plans/formularios/etapa-2-catalogos.md). Decidido el
mismo día: el inglés de las opciones de un catálogo es opcional (si falta, se usa el español; desde el 2026-10-23, la
traducción opcional es el idioma que no es el original del catálogo y, si falta, se usa el original, según el
[idioma del menú](#idioma-del-menú-sin-selector--2026-10-23)); cambiar el catálogo de una
pregunta publicada la convierte en pregunta nueva; si la opción elegida se dio de baja antes de responder, no se guarda,
se avisa al operador y se ofrece mandarlo de nuevo. **Decisión del 2026-10-11:** Query/K5 se posterga hasta que una lista no pueda expresarse con Filters. El alta K2 muestra sólo Manual y Filters; no ofrece «con una consulta», tampoco deshabilitada. Las capturas K2/K5 se conservan como evidencia histórica del diseño anterior.

| Captura | Qué define |
| --- | --- |
| [K1 · Catálogos](evidence/formularios-whatsapp/cat-k1-listado.png) | Entrada nueva en Formularios; listado con origen, opciones, qué formularios lo usan y estado (activo, no se puede usar con el motivo, dado de baja). |
| [K2 · Nuevo catálogo](evidence/formularios-whatsapp/cat-k2-nuevo.png) | Elegir de dónde salen las opciones: escritas a mano o de la base con filtros. El origen no cambia después. La consulta visible en la captura histórica fue postergada el 2026-10-11 y no se muestra en el alta actual. |
| [K3 · Escritas a mano](evidence/formularios-whatsapp/cat-k3-manual.png) | Texto, detalle y código por opción, orden, dar de baja sin borrar, formularios que lo usan y cómo lo ve el empleado. |
| [K4 · De la base, con filtros](evidence/formularios-whatsapp/cat-k4-filtros.png) | Vista Usuarios, columnas de texto y detalle, condiciones, «sin incluir a quien lo recibe», orden y vista previa como si lo recibiera alguien. |
| [K5 · Con una consulta](evidence/formularios-whatsapp/cat-k5-consulta.png) | **Postergada el 2026-10-11**, hasta que una lista no pueda expresarse con Filters. Captura histórica: consulta de lectura sobre vistas, prueba con una persona de ejemplo y recuperación de un catálogo inválido; no se implementa ni se ofrece en K2. |
| [K6 · Elegir de un catálogo](evidence/formularios-whatsapp/cat-k6-pregunta.png) | El tipo de pregunta nuevo en el editor; catálogos que no se pueden usar, visibles pero no elegibles. |
| [K7 · Al mandar y al responder](evidence/formularios-whatsapp/cat-k7-envio.png) | Opciones preparadas para cada persona al enviar, catálogo inválido, más de 200 o ninguna opción, lo que ve Juan, la referencia guardada y la opción dada de baja antes de responder. |

Etapa 2B, fotos y documentos (sumada el 2026-10-11, dibujada en la versión 66 del lienzo). **Elegida el mismo día**,
con miniaturas livianas en el chat, ninguna respuesta guardada a medias y hasta 10.000 respuestas por exportación. El
recorrido guiado la incluye desde la versión 67; desde la 78, dentro del recorrido de punta a punta.
Preguntas «Foto» (cámara o galería, o solo cámara) y «Documento» (PDF, Excel, Word e imágenes; sin CSV porque Meta no lo
admite), una por pantalla del Flow y hasta 10 archivos por respuesta. Los archivos se ven en la tarjeta del chat, la
planilla y el PDF, con el mismo permiso que los valores. Detalle en el
[cierre de la Etapa 2B](../../../ArquitecturaBase/docs/features/formularios.md#cierre-de-la-etapa-2b--2026-10-15).

| Captura | Qué define |
| --- | --- |
| [F1 · Fotos y documentos en el editor](evidence/formularios-whatsapp/arc-f1-editor.png) | Los tipos «Foto» y «Documento», de dónde sale la foto, mínimo y máximo, el contador de hasta 10 archivos por formulario y la vista previa con una pantalla por archivo. |
| [F2 · En el celular de Juan](evidence/formularios-whatsapp/arc-f2-celular.png) | Solo cámara, con fotos adjuntas, el documento con el botón final y cámara o galería. |
| [F3 · La respuesta llega con archivos](evidence/formularios-whatsapp/arc-f3-llega.png) | Bajando los archivos, guardada con miniaturas, sin permiso, archivo que no se pudo bajar, archivo que no es lo que dice y muchas fotos. |
| [F4 · Ver y descargar](evidence/formularios-whatsapp/arc-f4-visor.png) | El visor en el diálogo común sobre el chat, descargar el original y documentos que siempre se descargan. |
| [F5 · Límites y casos](evidence/formularios-whatsapp/arc-f5-casos.png) | Más de 10 archivos al publicar, cómo se arman las pantallas, tamaño y tipo que frena WhatsApp, reintentos, sin almacenamiento configurado, permiso perdido y cuánto duran. |

La Etapa 3 suma [T5 · Exportar a Excel](evidence/formularios-whatsapp/pla-t5-exportar.png): con los filtros aplicados,
todas las preguntas o solo las visibles, permiso propio, archivos como cantidad y nombres, y hasta 10.000 respuestas por vez.
Ese tope y la espera de un 429 son el motivo de «Exportar a Excel» apagado, como ayuda al pasar el mouse o con el foco, sin texto en el diálogo (decisión del 2026-10-23).

Etapa 3, planilla de respuestas (2026-10-10). **Diseño elegido**: los tableros 06 y 07 recortados a esta etapa,
sin aprobación, PDF ni asistente. Cargar desde la web queda para después (decidido el 2026-10-10).

| Captura | Qué define |
| --- | --- |
| [T1 · La planilla](evidence/formularios-whatsapp/pla-t1-planilla.png) | «Respuestas» en el panel (MF1 la reemplaza por «Formularios», 2026-10-20), columnas fijas (número, recibida, cargó) y una por pregunta de todas las versiones; «—» si no existía y «Sin respuesta» si no se contestó. Fotos: primera miniatura y cantidad, abre el visor de F4; documentos: tipo y cantidad. Con muchas preguntas se desplaza a lo ancho y «Columnas» oculta las que sobran (elegido el 2026-10-16). |
| [T2 · Más filtros](evidence/formularios-whatsapp/pla-t2-filtros.png) | Un filtro por pregunta según su tipo, con conteos del servidor; versión del formulario; búsqueda privada fuera de la dirección. |
| [T3 · Una respuesta](evidence/formularios-whatsapp/pla-t3-respuesta.png) | Lo que respondió con las preguntas de su versión, de dónde vino, historial y anterior/siguiente dentro de la planilla. A todo el ancho, con galería de fotos que abre el visor y documentos con descarga (elegido el 2026-10-16). |
| [T4 · Estados y casos](evidence/formularios-whatsapp/pla-t4-estados.png) | Carga, sin respuestas, sin coincidencias, error, muchos formularios, sin permiso, respuesta que no está y pregunta que cambió de tipo. |

Etapa 4, reglas, aprobación, PDF y avisos (2026-10-10), con reglas implementadas en [formularios](../../../ArquitecturaBase/docs/features/formularios.md#reglas-con-revisiones-propias--etapa-4-g1). Decidido el mismo día: después
de «Pedir aprobación» no hay más acciones en la misma regla; una respuesta que espera aprobación sigue con las reglas con
que llegó; nadie aprueba lo que cargó. Los avisos fuera de las 24 horas necesitan plantillas de Meta. Los ajustes «Incluir las fotos» de G2 y «Reintentar» de G5 quedaron elegidos en la versión 75 del lienzo, el 2026-10-16.

| Captura | Qué define |
| --- | --- |
| [G1 · Cuando llega una respuesta](evidence/formularios-whatsapp/reg-g1-reglas.png) | Reglas en palabras (cuándo, si, hacer en orden), una abierta para editar, Guardar reglas e historial de revisiones. Desde el 2026-10-23 ([botones y estados](visual-baseline.md#botones-y-estados--2026-10-23)), el encabezado tiene sólo «Agregar regla» y Guardar, al borde derecho y a la altura del título, sin «Cambios sin guardar», número de revisión ni textos junto a los botones; el número queda en el historial. La espera de un 429, un conflicto sin resolver, un límite o «Pedir aprobación» como última acción son la ayuda del botón que apagan, al pasar el mouse o con el foco. Agregar una regla o una acción no muestra «Completá este dato»: los errores se marcan al intentar guardar, que no envía y abre la primera regla con problema, y después en vivo. |
| [G2 · El diseño del PDF](evidence/formularios-whatsapp/reg-g2-pdf.png) | Comprobante simple: nombre obligatorio en el idioma original y traducción opcional, qué preguntas incluye, quién aprobó, texto al pie y vista previa. «Incluir las fotos»: marcada, van chicas debajo de su pregunta; sin marcar, dice cuántas hay; los documentos solo se nombran (elegido el 2026-10-16). Desde el 2026-10-23 ([botones y estados](visual-baseline.md#botones-y-estados--2026-10-23)), junto al título va sólo el formulario, sin «Cambios sin guardar» ni la revisión o su fecha; «Vista previa» va en el encabezado de su superficie y un diseño inválido no la apaga: intentarla o guardar marca y enfoca el primer error, sin pedir nada. La espera de un 429 y un conflicto son la ayuda de Guardar apagado. |
| [G3 · Por aprobar](evidence/formularios-whatsapp/reg-g3-por-aprobar.png) | La bandeja de quien decide, en el panel con su cantidad; ordenada de la más vieja a la más nueva. MF1 (2026-10-20) la reemplaza por la columna y el filtro de «Formularios». |
| [G4 · Aprobar o rechazar](evidence/formularios-whatsapp/reg-g4-decidir.png) | El detalle con la decisión; rechazar pide motivo; otra persona decidió antes; no aprobar lo propio. |
| [G5 · Qué pasó después](evidence/formularios-whatsapp/reg-g5-historial.png) | Cada acción con su estado (esperando, en curso, hecho, no se pudo, sin confirmar, no aplica) y el PDF como copia fija. «Reintentar» retoma solo lo que no salió; lo «Sin confirmar» se consulta primero (2026-10-16). La espera de un 429 es la ayuda de Consultar, Reintentar y Resolver envío, sin texto debajo del historial (decisión del 2026-10-23). |
| [G6 · Lo que recibe el empleado](evidence/formularios-whatsapp/reg-g6-celular.png) | Confirmación al recibir, aviso con el PDF al aprobar, motivo al rechazar, también en inglés. |

Rediseño del detalle de una respuesta (2026-10-17, versión 79 del lienzo): cuatro conceptos, D1–D4, para T3, G4 y G5,
que reunían el detalle en una sola columna. **Elegido D2**, que reemplaza ese detalle; la decisión está en el
[contrato vigente de D2](../../../ArquitecturaBase/docs/features/formularios.md#motor-de-acciones-y-aprobación--etapa-4-g5-y-g3g4).

| Captura | Qué define |
| --- | --- |
| [D2 · Panel lateral sobre la planilla](evidence/formularios-whatsapp/det-d2-panel.png) | **Elegido el 2026-10-17.** Tocar una fila abre la respuesta al costado, sin salir de la planilla; ↑ ↓ (también las flechas del teclado) pasan de respuesta y Escape cierra. Arriba, el estado y los momentos uno por renglón, armados con las reglas que tenía el formulario al llegar la respuesta: Recibida con su origen, Por aprobar → Aprobada o Rechazada y lo que pasó al recibirla, aprobarla o rechazarla, con el resumen de sus acciones; lo que no aplica no se muestra. Mientras espera, Aprobar y Rechazar van en el renglón «Por aprobar». Pestañas Respuesta («pregunta · valor» con las fotos), Fotos, Actividad (las acciones por momento, con Consultar o Reintentar) y PDF (cuando hay copia), más Abrir conversación y Descargar ▾. Quien sólo aprueba conserva el panel de metadata en el celular, con ↑ ↓ arriba y la decisión fija abajo; con lectura se abre directamente DC1. Desde el 2026-10-20 es la vista rápida de escritorio: la pantalla completa es DC1 ajustado (abajo). Entrando por «Por aprobar · N», ↑ ↓ recorren lo que espera, de la más vieja a la más nueva, y el pie del panel lo dice (ajuste del 2026-10-20, versión 96). |

D2 está implementado sobre esos tableros: el panel conserva el listado y su orden; los momentos proceden de acciones ya capturadas, no de reglas actuales. El selector Estado y la marca PDF de la planilla usan el contrato del servidor; la decisión sin lectura de respuestas conserva sólo metadata. La [verificación del cierre](../../../ArquitecturaBase/docs/features/formularios.md#cierre-local-de-la-etapa-5-y-del-review-de-la-etapa-4) acredita navegador, capturas visuales y consumidores HTTP actuales, con sus límites explícitos.

Detalle completo (2026-10-20, versión 94 del lienzo): D2 deja de ser el único detalle. **Se eligieron DC0 y DC1 ajustado**,
implementados localmente: el panel queda como vista rápida y la respuesta se abre también en una pantalla propia. La verificación conjunta y el piloto conservan sus alcances separados. DC1, DC2 y DC3 quedan en el
lienzo como las alternativas que no se eligieron.

| Captura | Qué define |
| --- | --- |
| [DC0 · De la vista rápida a la pantalla completa](evidence/formularios-whatsapp/det-dc0-vista-rapida.png) | **Elegido el 2026-10-20.** El panel D2 suma «Abrir en pantalla completa» en su cabecera. La pantalla completa tiene su dirección, se puede compartir y «Volver» lleva a la planilla con la misma fila, los filtros y el orden; ↑ ↓ también pasan de respuesta ahí: entrando por «Por aprobar · N», lo que espera, de la más vieja a la más nueva («2 de 2 por aprobar»); por la planilla, la planilla («1 de 24»). Abierta desde un enlace compartido, no trae la búsqueda ni las personas filtradas, porque los datos privados no van en la dirección; ↑ ↓ siguen el orden y las versiones de la planilla (ajuste del 2026-10-20, versión 96). Quien solo aprueba no tiene pantalla completa: el panel ya muestra la tarea. En el celular no hay vista rápida: tocar una fila abre la pantalla completa, en una columna. |
| [DC1 ajustado · Respuesta y actividad](evidence/formularios-whatsapp/det-dc1-ajustado.png) | **Elegido el 2026-10-20.** Arriba, ↑ ↓, Abrir conversación, Descargar ▾ (el comprobante PDF y los documentos) y, mientras espera, Rechazar y Aprobar; la cabecera no repite el formulario, que está en las migas. Dos secciones a todo el ancho, que se pliegan con la flecha y, plegadas, dicen lo que tienen: «Respuesta» («pregunta · valor» con las fotos y el remito, y la versión del formulario) y «Actividad», contada como historia: quién la respondió y quién se la mandó, lo que se hizo al recibirla, la decisión y lo que se hizo después, con el PDF en «Al aprobarla» (vista previa chica y Descargar). Sin «De dónde vino», sin el PDF al costado y sin la fila de momentos de arriba. |

Etapa 5, el asistente (2026-10-10), con reglas vigentes en [ofrecimiento y prellenado](../../../ArquitecturaBase/docs/features/formularios.md#indicación-de-ofrecimiento--etapa-5), [sugerencias entre formularios](../../../ArquitecturaBase/docs/features/formularios.md#configuración-de-qué-sugerir-después--etapa-5) y [WhatsApp](../../../ArquitecturaBase/docs/features/whatsapp.md). También son de esta etapa «Cuándo lo ofrece» (03),
el recorrido con asistente (05) y las sugerencias entre formularios (s1–s4). Decidido el 2026-10-10 y el 2026-10-11: una
consulta o una charla no se contesta y queda para un operador; si alguien quiere registrar algo y no hay un formulario que
pueda completar, el asistente le avisa y anota el pedido sin nombrar formularios ajenos; ofrece formularios hasta 2 veces
por día en cada conversación; cambiar el modo pide el permiso nuevo «Configurar el asistente», que tiene Admin.

| Captura | Qué define |
| --- | --- |
| [H1 · El chat en modo Asistente](evidence/formularios-whatsapp/asi-h1-modo-asistente.png) | El asistente manda el formulario prellenado con su nombre como autor, «Por qué lo mandó», mensajes automáticos de reglas y «Tomar atención manual». |
| [H2 · En Atención manual, sugiere](evidence/formularios-whatsapp/asi-h2-sugerencia.png) | La sugerencia arriba del compositor y el diálogo de envío con los datos prellenados que se pueden destildar. |
| [H3 · Cambiar de modo](evidence/formularios-whatsapp/asi-h3-modos.png) | Confirmación para pasar a Asistente, tomar la atención a mitad de un envío, IA no disponible, chats existentes, marca en la lista y sin permiso. |
| [H4 · Un catálogo que propone el asistente](evidence/formularios-whatsapp/asi-h4-catalogo.png) | Pedido por WhatsApp, propuesta para revisar en la web y aprobación por una persona. |
| [H5 · Los límites del asistente](evidence/formularios-whatsapp/asi-h5-limites.png) | Pregunta si no está seguro, no contesta consultas ni charla, anota lo que no tiene formulario, no insiste, respeta las 24 horas y deja todo registrado en la respuesta (ajustado el 2026-10-16). |
| [H6 · Audios en el chat](evidence/formularios-whatsapp/asi-h6-audios.png) | **Elegido el 2026-10-16.** El audio se baja y se pasa a texto; el operador lo escucha con su transcripción y el asistente lo lee como texto. Sin transcripción, queda para un operador; sigue la retención de los mensajes. |
| [H7 · Formularios que faltan](evidence/formularios-whatsapp/asi-h7-faltan.png) | **Elegido el 2026-10-16.** Los pedidos agrupados por tema, con cuántos, de cuántas personas y cuándo, sin nombres ni mensajes; crear el formulario o descartar. |

Los tableros s1–s4 están elegidos para la Etapa 5: un formulario puede sugerir otro sin convertirlos en un circuito.
El modelo y las reglas están en los
[resúmenes por etapa](../../../ArquitecturaBase/docs/plans/formularios/README.md).

| Captura | Qué define |
| --- | --- |
| [La idea](evidence/formularios-whatsapp/s1-sugerir-idea.png) | Formularios independientes conectados por sugerencias: cuándo, qué datos pasan y cómo se ofrecen. |
| [Configurar qué sugerir después](evidence/formularios-whatsapp/s2-sugerir-editor.png) | Sección del editor con su propio «Guardar sugerencias», sin republicar. Desde el 2026-10-23 ([botones y estados](visual-baseline.md#botones-y-estados--2026-10-23)), como en las reglas: «Agregar sugerencia» y Guardar al borde derecho del encabezado, sin «Cambios sin guardar» ni número de revisión; los límites, la falta de destino, la espera y un conflicto son la ayuda del botón que apagan; la ayuda de «Datos que pasan» va bajo el título del grupo, y los errores se marcan al intentar guardar y después en vivo. |
| [En el celular](evidence/formularios-whatsapp/s3-sugerir-celular.png) | Entrega que termina en factura, y los casos «Juan no lo abre», sin IA, nada que sugerir y sin permiso. |
| [La cadena en la web](evidence/formularios-whatsapp/s4-sugerir-cadena.png) | La respuesta recuerda de dónde vino, qué sugerencia la ofreció y por qué. |

El idioma de los formularios (2026-10-18, versión 85 del lienzo), implementado según la
[regla funcional vigente](../../../ArquitecturaBase/docs/features/formularios.md#idioma-original-y-traducción-opcional--2026-10-19): solo el idioma
original es obligatorio para guardar y publicar, y si la traducción no está completa, todo sale entero en el original, sin
mezclar. **I1–I3 se eligieron el 2026-10-18**: reemplazan lo de E y P1 sobre los dos idiomas. I1–I3 están integrados en el front: autoría con traducción opcional y marcas neutras, vista previa entera en una cultura, comprobación por idioma, cambios entre versiones y vista oficial limitada a los publicados. El [cierre local](#cierre-local-de-idioma-original-y-traducción-opcional--2026-10-19) registra navegador, visuales y contratos HTTP renovados.

| Captura | Qué define |
| --- | --- |
| [I1 · El editor con la traducción opcional](evidence/formularios-whatsapp/idi-i1-editor.png) | «Textos en» con el original obligatorio y el inglés opcional. Lo que falta se cuenta como «3 sin traducir», en gris, y cada texto dice «Sin traducir», sin alerta. La vista previa muestra lo que recibe una cuenta en inglés: entero en español mientras falte algo y entero en inglés al completarlo, nunca mezclado. **Desde el 2026-10-23 (decisión del punto 35 del review de Catálogos E2) no hay «Textos en»:** se edita en el idioma del menú; con el menú en el otro idioma cada texto es la traducción, con «Sin traducir», el original como referencia y los faltantes contados por pregunta. Un error del otro idioma, de guardado o ubicado desde la comprobación de publicación, se ve bajo el mismo campo («En inglés: …»). Para traducir se cambia el idioma del menú; con cambios sin guardar, el menú pide confirmación antes de descartarlos. |
| [I2 · Publicar con la traducción incompleta](evidence/formularios-whatsapp/idi-i2-publicar.png) | La comprobación no frena por una traducción que falta: dice «En WhatsApp, en español» y avisa «El inglés no se publica», con lo que le falta y «Completar el inglés». A Meta van solo los idiomas completos; sumar el inglés después es la versión siguiente. Desde el 2026-10-23, «Completar el inglés» se ofrece sólo con el menú en inglés, el idioma en que se edita; con el menú en español el aviso sólo lista lo que falta. La fecha del borrador guardado va en la descripción del diálogo, no junto a los botones del pie, y la espera de un 429 es la ayuda de Reintentar (decisión del 2026-10-23). |
| [I3 · Los idiomas al publicar](evidence/formularios-whatsapp/idi-i3-idiomas.png) | La confirmación con la traducción incompleta o completa, y una versión nueva que suma el inglés o lo pierde, con aviso. |

Dar de baja, reactivar y eliminar (2026-10-20, versión 88 del lienzo), con las reglas de
[ciclo de vida de formularios](../../../ArquitecturaBase/docs/features/formularios.md#dar-de-baja-reactivar-y-eliminar--2026-10-21). BA1 tenía dos
conceptos de dónde viven las acciones: A, en la fila; B, en una ficha al costado. **BA1-A y BA2–BA5 se eligieron el
2026-10-20**; implementados junto con BA6. Se ajustaron el mismo día con la guía (versión 96 del lienzo): «Activos» y «Dados de baja»
con las mismas palabras que Formularios, el celular conserva la tabla y BA6 marca las sugerencias hacia un dado de baja.

| Captura | Qué define |
| --- | --- |
| [BA1-A · Las acciones en la fila](evidence/formularios-whatsapp/baja-ba1-a-fila.png) | **Elegido el 2026-10-20.** El segmentado dice «Activos (N) · Publicados (N) · Borradores (N) · Dados de baja (N)», con las mismas palabras que Formularios: «Activos» son los publicados y los borradores, y los dados de baja van aparte (ajuste del 2026-10-20, versión 96). Suma la columna Respuestas. El estado dice «Dado de baja · versión N» y, debajo, lo que pasa en WhatsApp. Las acciones de cada fila: Editar; Dar de baja en los publicados; Reactivar en los dados de baja; Eliminar, último, solo sin respuestas. Editar y Eliminar piden administrar; Dar de baja y Reactivar, publicar; lo que no se puede no se dibuja. En el celular, la tabla y el segmentado se desplazan dentro de su caja, como todas las tablas. |
| [BA2 · El editor](evidence/formularios-whatsapp/baja-ba2-editor.png) | **Elegido el 2026-10-20.** Un menú «⋯» junto a la acción principal, con las mismas acciones; lo que no se puede queda apagado con el motivo. El dado de baja muestra un aviso con quién y cuándo, que no se manda ni lo ofrece el asistente y que lo cargado se conserva, y WhatsApp en palabras: «Se deprecan cuando venzan los envíos abiertos», «Deprecados el …» o que no se pudo confirmar y se sigue consultando. Reactivar ocupa el lugar de «Publicar en WhatsApp». |
| [BA3 · El diálogo «Dar de baja»](evidence/formularios-whatsapp/baja-ba3-dar-de-baja.png) | **Elegido el 2026-10-20.** Qué deja de pasar (el chat, el asistente y las sugerencias de otros formularios, con sus nombres), los envíos abiertos con el vencimiento del último, «En WhatsApp no se deshace» y lo que se conserva. Lo que no aplica no se muestra; error, 390 px e inglés. |
| [BA4 · Reactivar y eliminar](evidence/formularios-whatsapp/baja-ba4-reactivar.png) | **Elegido el 2026-10-20.** Reactivar muestra la versión nueva, qué cambia, la numeración que sigue y la comprobación de siempre. Eliminar, solo sin respuestas: desaparece de los listados, el prefijo queda reservado y, si se publicó, sus Flows se deprecan. Con respuestas, Eliminar no está: el menú dice por qué. La espera de un 429 es la ayuda de Eliminar, sin texto en el diálogo (decisión del 2026-10-23). |
| [BA5 · El circuito de punta a punta](evidence/formularios-whatsapp/baja-ba5-circuito.png) | **Elegido el 2026-10-20.** Activo, dar de baja, un envío abierto que se responde igual, deprecados en WhatsApp al vencer y reactivar con una versión nueva: qué hacen la persona, el sistema y el asistente en cada paso. |
| [BA6 · Una sugerencia hacia un dado de baja](evidence/formularios-whatsapp/baja-ba6-sugerencias.png) | **Ajuste del 2026-10-20, versión 96.** En el editor de sugerencias de otro formulario, la fila que apunta a un dado de baja dice «Dado de baja», solo tiene Quitar y pide quitarla; mientras quede, Guardar sugerencias está apagado y da ese pedido como motivo al pasar el mouse o con el foco (2026-10-23). Dar de baja no las borra: dejan de ofrecerse y, si se reactiva, vuelven las que quedaron. «Formulario a sugerir» solo ofrece publicados. |

El menú de Formularios (2026-10-20, versión 88 del lienzo): tres conceptos, MF1–MF3, comparados con las capturas de hoy
(MF0). **Elegido MF1 e implementado localmente**: cambia la decisión 1 (Navegación) y reemplaza el panel de T1 y la bandeja de G3.
Se ajustó el mismo día con la guía (versión 96 del lienzo).

| Captura | Qué define |
| --- | --- |
| [MF1 · Una tabla de formularios](evidence/formularios-whatsapp/menu-mf1-tabla.png) | **Elegido el 2026-10-20.** El grupo del menú pasa a llamarse «Gestión de formularios». Su panel tiene «Formularios», con lo que espera tu decisión, y Diseñar formularios, Catálogos y Formularios que faltan, como están. «Formularios» es una tabla: lo que cada uno tiene por aprobar, cuántas respuestas y la última con su estado; primero los que esperan aprobación y después por la última respuesta. «Con algo por aprobar» deja solo esos, incluidos los dados de baja que esperan una decisión. El segmentado dice «Activos (N) · Dados de baja (N)», con las mismas palabras que Diseñar formularios: los dados de baja van aparte, con un aviso, y una línea arriba de la tabla avisa si alguno espera una decisión. Al entrar en un formulario, «Por aprobar · N», de la más vieja a la más nueva, arriba de la planilla; «Revisar» abre D2, y ahí ↑ ↓ recorren lo que espera en ese orden; desde la planilla, recorren la planilla. No hay bandeja aparte. Quien solo ve respuestas, sin «Por aprobar» ni número; quien solo aprueba, sus formularios con algo para decidir y cuántas, sin «Respuestas», «Última respuesta» ni «Con algo por aprobar», porque no puede ver respuestas, y al entrar, la tarea sin las respuestas; sin permiso, no ve «Formularios». En el celular, la misma tabla, con su desplazamiento contenido. Lo de quien solo aprueba, las flechas, el segmentado y el celular son ajustes del 2026-10-20 (versión 96). |

## Decisiones de diseño

1. **Navegación.** El grupo «Gestión de formularios» contiene «Formularios», con la tabla MF1 de formularios y sus pendientes, además de Diseñar formularios, Catálogos y Formularios que faltan según sus permisos. MF1 reemplaza la navegación dinámica por formulario de la Etapa 3 y la bandeja global de G3. La tabla exige leer respuestas o decidir; cada permiso conserva su alcance independiente. Las [reglas vigentes](../../../ArquitecturaBase/docs/features/formularios.md#gestión-de-formularios-y-detalle-completo--2026-10-21) fijan las proyecciones y la navegación D2/DC1.
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
   conversación), lo que propuso el asistente, el historial y la corrección como respuesta nueva. La vista previa del diseño usa una respuesta de ejemplo;
   el PDF de una respuesta se emite sólo al aprobar y queda como copia fija.
9. **WhatsApp.** El asistente solo propone y la persona confirma. Si el mensaje es ambiguo pregunta; sin IA se elige
   de una lista; un número sin cuenta vinculada recibe orientación; fuera de 24 horas hace falta una plantilla de
   Meta. Los mensajes al empleado usan voseo y dicen el número de la respuesta.
10. **Dos botones distintos.** El mensaje que abre un formulario en WhatsApp tiene un solo botón y dice siempre
    «Abrir formulario». El botón final, adentro del formulario, es el «Texto del botón final» que define cada uno
    («Enviar», «Confirmar visita»). WhatsApp no admite otro botón en el mismo mensaje: una sugerencia que la persona
    no quiere simplemente no se abre.
11. **Idiomas.** La elección del 2026-10-10 exigía español e inglés completos al publicar y guardado con traducciones
    pendientes. **I1–I3, elegidos el 2026-10-18, sustituyen ese requisito:** sólo el original es obligatorio para guardar
    y publicar. Desde el 2026-10-23 (decisión del punto 35) no hay selector de idioma: se escribe en el idioma del menú
    y, para traducir, se cambia el idioma del menú y se edita lo mismo: el editor conserva los cambios sin guardar y muestra la otra traducción (sólo el diseño del PDF se reinicia y pide confirmación antes de descartarlos). La preview muestra todo en el original mientras falte una traducción y todo en el secundario al completarse.
    Un error de guardado o de la comprobación de publicación en el otro idioma se ve bajo el mismo campo, con su idioma («En inglés: …»): no se cambia de idioma para mostrarlo.
    La vista oficial de WhatsApp tampoco tiene selector: pide el idioma del menú si la versión activa lo publicó y, si no, el original.
    Los mensajes de las reglas también se escriben en el idioma del menú, con el original como referencia.
    El diseño del PDF (G2) tampoco tiene selector: nombre y pie son un solo campo en el idioma del menú, con el original como referencia, y la vista previa pide el idioma del menú.
    «El catálogo» (K3, K4 y la revisión de H4) tampoco tiene selector: nombre y descripción son un solo campo en el idioma del menú. Un catálogo nuevo nace en ese idioma, que es su original; con el menú en el otro idioma se edita la traducción, con el original del catálogo como referencia.
    Las opciones de un catálogo escrito a mano (CA1-A) siguen la misma regla: texto y detalle se escriben en el idioma del menú y sólo el texto en el original del catálogo es obligatorio. Con el menú en el otro idioma, la tabla muestra el original como texto de ayuda de la celda y el editor de la opción como referencia («Original (…): …»); lo que falta del original se marca bajo el texto, con su idioma.
    Los campos de un catálogo (CE1) también: cada uno tiene un solo «Nombre» en el idioma del menú, obligatorio sólo en el original del catálogo; con el menú en el otro idioma es la traducción, con el original como referencia.
    Los datos de las personas (CE4-A) también: un dato nuevo nace en el idioma del menú, que es su original, con un solo «Nombre»; con el menú en el otro idioma se escribe la traducción, con el original del dato como referencia.
    El envío fija una cultura preparada para el formulario, la apertura predeterminada, «Abrir formulario», los avisos y el PDF;
    conserva la apertura editada por el operador. El texto y detalle de cada ítem de catálogo conservan su respaldo individual
    al original, sin cambiar el idioma del formulario. Los catálogos comunes ya no tienen validación bilingüe: como los propuestos, exigen sólo su original. La
    [regla funcional](../../../ArquitecturaBase/docs/features/formularios.md#idioma-original-y-traducción-opcional--2026-10-19) fija la completitud y las copias capturadas.

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

Al cerrar la Etapa 1 quedaban para las siguientes: la planilla de respuestas y su sección en el panel, Una respuesta, aprobación y PDF,
el asistente con IA, los catálogos y referencias (clientes), cargar desde la web, correcciones, mandar fuera de las
24 horas con plantilla de Meta y las acciones como descontar stock.

Las respuestas de la Etapa 1 ya se guardan con su versión y su número: cuando llegue la planilla, aparecen sin migrar.

## Decisiones y pendientes al cerrar la Etapa 1 (histórico)

- **Numeración (decidida el 2026-10-08, dibujada el 2026-10-10).** Prefijo del formulario, como en los tableros
  (VIS-000001): se propone a partir del nombre, el administrador puede cambiarlo hasta que se acepta la primera
  publicación (aunque después falle), es único y no se recicla. Sus estados están en la variante C.
- **Estados no dibujados.** Los de la lista están en la variante A y los de guardar en B y D. Faltan 320/390 px e
  inglés del listado y el editor, y los estados del diálogo de envío. Se dibujan en el mismo lienzo cuando la etapa llegue a esa pantalla;
  mientras tanto valen los patrones de la plantilla de listados y el [contrato de mensajes](../guides/mensajes-y-estados.md).
- **Vista oficial de Meta.** Sus estados están en P3; la CSP del iframe y el comportamiento real en el navegador se
  prueban en el piloto, como dice el resumen de su etapa.

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


## Cierre local de K7 (2026-10-12)

El diálogo del chat prepara los catálogos para la cuenta vinculada: muestra conteos y bloquea catálogo no disponible, más de 200 opciones o lista obligatoria vacía, conservando el mensaje. La respuesta muestra texto, catálogo y detalle históricos; sin `formrecords.read` oculta los valores. La baja Manual nombra sólo la pregunta y no muestra registro ni número; «Mandar de nuevo» abre el compositor y requiere otra confirmación. El ancho intermedio mantiene legible la conversación y permite volver al listado.

Verificación final: **1614/1614** unitarios, **7/7** consumidores de cuerpos HTTP exportados, build y lint/arquitectura **48/48**, visual completa **398/398** con tres workers y referencias intactas. Se revisaron capturas representativas de K7 en es/en a 1440/390/320 y 900 px. El navegador usa datos/transporte simulados; backend SQL y webhook se acreditan por separado. El arnés sirve una compilación aislada con estilos de desarrollo, sin proxy a la API real. Meta queda pendiente de realizarlo con el usuario; el alcance vigente está en el resumen de la etapa.

## Cierre de las cinco correcciones del review — 2026-10-13

K3 y K4 incorporan Dar de baja/Reactivar con la confirmación común: el cambio se prepara y se aplica con Guardar, bajo una única revisión. El estado se muestra en palabras junto al título; se conservan opciones y respuestas anteriores. Una baja Filters no requiere elegir persona ni preview. Buscar personas conserva el editor y el foco con espera de 300 ms; un fallo de lectura no retira los filtros. Guardar tras red/5xx permite reintento explícito; sólo 409 exige revisión. Desde el 2026-10-23, K4 no muestra «Cambios sin guardar» junto al título y su Guardar no espera a la persona de ejemplo: intentarlo sin ella marca y enfoca «Como si lo recibiera», sin enviar nada; «Probar» y «Revisar» van en el encabezado de su superficie.

Front final: **1621/1621**, lint/arquitectura **48/48**, build limpio y visual completa **416/416**, sin modificar referencias ni timeouts. Treinta capturas nuevas de estado/búsqueda; revisión representativa en español/inglés, escritorio y móvil. Se conserva el aviso conocido NO_COLOR/FORCE_COLOR del runner. Las pantallas usan los componentes y la navegación elegidos; el transporte del navegador es simulado. El piloto real de catálogos con Meta, entonces pendiente, se completó el 2026-10-15; el estado vigente se registra abajo.

## Estado vigente de catálogos — 2026-10-15

K1–K7 están implementados; el review previo al piloto corrige privacidad, límites, selección, errores y reenvío manteniendo los tableros elegidos. Las notas de cortes anteriores son históricas. La preparación del operador muestra cantidades, K4 señala nombres/detalles que no entran sin recortar y el texto de cada opción Filters sólo puede ser nombre. El piloto de catálogos con Meta se completó con el usuario el 2026-10-15: envío desde el chat, respuesta física y recarga. Los ajustes visuales «Con la 2B» conservan su estado pendiente.

Validación final del review: front **1643/1643**, lint/arquitectura **48/48**, build limpio y visual completa **422/422**; backend **2772/2772** con PostgreSQL/Redis y build sin advertencias. Capturas representativas revisadas en es/en, escritorio y celular, sin modificar referencias ni tolerancias. Los consumidores verifican cuerpos HTTP exportados de esa corrida backend. El transporte de esas pruebas automáticas está simulado; el piloto físico posterior confirmó Manual con/sin detalle, Usuarios vacío/con opciones, rechazo por baja sin número, «Mandar de nuevo» tras recargar y 200 opciones con detalle completo. Los resultados y pendientes heredados están en el resumen de Etapa 2.

## Implementación local F1–F5 — 2026-10-15

Los tableros elegidos de la Etapa 2B ya tienen implementación: Foto/Documento con mínimo, máximo y origen; contador y pantallas de la vista previa; tarjeta bajando/reintentando/rechazada; respuesta con fotos y documentos; visor común y descarga privada. Los tipos se ven deshabilitados cuando falta almacenamiento. La pérdida de lectura cierra el visor y retira nombres y miniaturas. Documento siempre se descarga; el original de foto sólo se pide al abrir. Se conservan el diseño y las referencias elegidas.

Verificación de cierre del front: build y lint limpios, arquitectura **48/48** y tests **1681/1681**. La corrida visual de implementación quedó **434/434**; en el piloto no hubo cambios de UI. Las doce variantes nuevas F1/F3/F4/F5 cubren es/en y 1440/390/320; los consumidores verifican cinco cuerpos HTTP exportados desde el backend. El navegador contra la API real comprobó crear el borrador bilingüe «Piloto 2B · Fotos y documentos», guardar, recargar, cambiar el máximo y guardar/recargar otra vez. Quedó una foto de cámara y un documento obligatorios, sin publicar todavía. Las pruebas visuales usan transporte simulado; persistencia y Blob real se acreditan con PostgreSQL/Azurite en el backend. El piloto conjunto de Meta y Azure real quedó verificado el 2026-10-15: cámara + PDF y foto opcional vacía, respuesta FOTO2B-000001 aparecida automáticamente dentro del minuto sin recarga, miniatura, visor y descargas íntegras; la recarga conserva el resultado. Evidencia y alcance en [el cierre de la Etapa 2B](../../../ArquitecturaBase/docs/features/formularios.md#cierre-de-la-etapa-2b--2026-10-15). Azurite quedó predeterminado y Aspire apagado.

## Implementación de T1–T5 — 2026-10-16

Planilla y detalle usan el diseño elegido, incluidos T1/T3 con archivos de la versión 71: primera miniatura/cantidad, visor F4, galería a todo el ancho y documentos descargables desde la respuesta. Se implementaron filtros privados, estados de lectura y diálogo de Excel; sin aprobación, PDF ni asistente. Los permisos de consulta y edición del diseñador conservan los de la Etapa 1; consultar respuestas usa formrecords.read y exportar agrega formrecords.export.

El recorrido real abrió FOTO2B-000001 (Azure privado), foto y PDF; opcional vacía, catálogo histórico y navegación filtrada con PILK7-000003/000001, y recarga. El usuario confirmó que FOTO2B-20261016.xlsx abre en Excel sin reparación, con nombres de archivos y opcional vacía. Las capturas automáticas son transporte simulado y se verifican aparte de este recorrido real. La sincronización del código al lienzo externo no se presume.

Etapa 3 cerrada: build/lint limpios, arquitectura **48/48**, tests **1703/1703** y visual completa **451/451**, sin cambios de referencias/tolerancias. Contratos HTTP y XLSX verificados con la exportación del backend **2896/2896**. Capturas revisadas en es/en, escritorio y 390/320 px, incluidos carga, error/reintento, cambio de tipo y galería. Reglas canónicas y límites en [formularios](../../../ArquitecturaBase/docs/features/formularios.md#planilla-detalle-y-excel--etapa-3). Aspire apagado.

## Implementación de G1–G6 — 2026-10-16

Reglas, historial, bandeja de aprobación, decisión, diseño PDF y avisos conservan los tableros elegidos, incluidos los ajustes G2/G5 de la versión 75. Reglas y diseño guardan su revisión propia con adopción explícita ante409, sin publicar ni guardar preguntas. Sólo los textos nuevos de esta etapa exigen el idioma original; la alternativa es opcional. En ese corte, las Etapas 1–3 conservaban la publicación bilingüe; [I1–I3](#decisiones-de-diseño) sustituyen luego ese requisito. Si el idioma de quien recibe está incompleto en cualquier aviso de esa revisión de reglas o en su diseño PDF, los mensajes y las copias del evento salen enteros en el original.

«Por aprobar» usa roles vigentes y no permite decidir lo propio. Sin lectura de respuestas abre sólo metadata y decisión; los valores y documentos requieren su permiso independiente. El historial distingue acciones esperando, en curso, hechas, fallidas, sin confirmar y no aplicables. Consultar/Reintentar usan la misma acción; lo incierto se consulta primero y lo confirmado no se repite.

La vista previa del diseño usa ejemplos y no persiste. La respuesta aprobada ofrece su PDF fijo por API autorizada; cambiar el diseño no lo regenera. Los avisos de reglas aparecen en WhatsApp con autor automático y documento cuando corresponde; sin lectura de respuestas se retiran cuerpo y caption antes de la caché y la bandeja conserva un resumen genérico.

Verificación local definitiva: build, TypeScript y lint limpios; full **1793/1793 en 188 archivos** y visual completa **493/493** con referencias intactas. Sobre las seis cohortes definitivas pasaron **13/13 en 7 archivos** en 9,23 s: 67 capturas con bytes, tamaño y SHA256 comprobados, del run `20261016-203953-d6165b4572ea4d019735be2c387de43f` y backend `98fa775c` (**3096/3096**, cero omitidos y build sin errores ni advertencias). Las fuentes productoras son idénticas a las verificadas. Los avisos del arnés de la full permanecen en su [pendiente existente](../../../ArquitecturaBase/docs/plans/README.md).

El recorrido contra SPA/API local de ese corte verificó arranque/migraciones, bandeja vacía, reglas con original y traducción vacía, diseño inicial/preview con respaldo completo, descarte sin persistir, filtro decimal y detalle histórico. IAB/headless no pintó el visor PDF nativo; los bytes, fotos en color y cuatro páginas se calificaron por render técnico separado. Aspire quedó detenido. Las capturas visuales usaron transporte simulado y almacenamiento emulado. El [piloto posterior del 2026-10-17](../../../ArquitecturaBase/docs/features/formularios.md#piloto-de-aprobación-y-pdf--2026-10-17) confirmó con Meta y Azure reales la visita en español con foto, aprobación y PDF al celular; los [casos físicos restantes](../../../ArquitecturaBase/docs/plans/verificacion-y-produccion.md#formularios-piloto-de-aprobación-y-pdf) conservan su alcance. El [cierre canónico](../../../ArquitecturaBase/docs/features/formularios.md#verificación-de-la-etapa-4--2026-10-16) conserva el alcance y [history](../../../ArquitecturaBase/docs/history/README.md#formularios-etapa-4-y-review-de-la-etapa-3--2026-10-16), la procedencia del plan y review retirados.

## Implementación local de Etapa 5 — 2026-10-17

La sugerencia configurada Always usa la misma tarjeta y confirmación: el puntero del servidor manda aun con IA apagada y Body nulo; su ProposalId null evita atribuirla al asistente. Sin puntero, sólo una fuente nueva completa puede iniciar interpretación con IA disponible. La pausa conserva la selección y el diálogo del puntero activo.

En el review de Etapa 5, el respaldo común se confirmó antes de enviar: si faltaba una traducción usada en el formulario, los catálogos, las reglas o el PDF, formulario, apertura predeterminada, avisos y PDF usaban enteros el original. C2 espera la preparación de toda selección, muestra ese idioma y conserva la apertura editada por el operador; la revisión H2 usa el idioma de la propuesta. La cultura real de la cuenta sigue controlando el contexto del destinatario. Ese corte no cambió la publicación bilingüe de las Etapas 1–3 ni implementó I1–I3. La [regla posterior](../../../ArquitecturaBase/docs/features/formularios.md#idioma-original-y-traducción-opcional--2026-10-19) fija la cultura preparada y exceptúa del respaldo global el texto y detalle de cada ítem de catálogo.

OfferWhen se edita dentro de «El formulario» y usa el guardado, UUID y revisión del borrador existente. No integra el esquema publicado ni exige republicar. Las sugerencias s1–s3 guardan configuración e historial propios; muestran condiciones y mapeos por identidad y conservan el borrador ante errores o 409. Los textos nuevos requieren sólo el idioma original. En ese corte, la publicación y los catálogos comunes conservaron su contrato bilingüe; la publicación sigue ahora [I1–I3](#decisiones-de-diseño) y, desde el 2026-10-23, los catálogos comunes también exigen sólo su original ([idioma del menú](#idioma-del-menú-sin-selector--2026-10-23)).

H1–H3 y H5 conservan el chat elegido: Manual es el estado inicial; tomarlo requiere Send y activar Assistant requiere ConfigureAssistant. La disponibilidad y el posible envío iniciado vienen del servidor. El origen Assistant identifica al autor también en el historial, con operador nulo. En Manual, H2 muestra la sugerencia sobre el compositor y el diálogo C2 existente permite destildar datos; no permite editar valores propuestos ni remonta el borrador ordinario. Un resultado perdido se consulta por GET antes de repetir explícitamente. El historial muestra motivo, datos propuestos y títulos de opciones capturados; los detalles privados respetan RecordsRead y no se reconstruyen desde configuración actual. Interpretar no registra por sí solo una respuesta ni decide una aprobación.

H4 se revisa en K4, con evidencia de quién pidió la propuesta por WhatsApp, sus límites y quién la resolvió. Aprobar y activar envía la edición y la persona de ejemplo en un comando; descartar conserva la propuesta original sin activarla. Ese catálogo conserva el original obligatorio al editarlo después; desde el 2026-10-23 los comunes siguen la misma regla, con el idioma del menú al crearlos como original. No se muestran identificadores técnicos del modelo.

s4 usa la pestaña Respuesta de D2: datos propuestos plegables, marcas de inclusión/mapeo/corrección y cadena de respuestas confirmadas. Modo, motivo y operador pertenecen a la captura histórica. No se inventan eventos de apertura o aceptación ni registros por ofertas pendientes. Los enlaces y descargas del registro anterior se bloquean mientras se cambia de destino; decidir sin RecordsRead sigue limitado a metadata.

H6 se monta en la burbuja existente con reproducción privada a pedido y transcripción debajo. Usa controles nativos sin fabricar duración ni forma de onda. En Manual se solicita cada Pending visible una vez bajo Read, sin exigir Send; una finalización observada retira el aviso anterior y cancela el pedido local pendiente. Un audio disponible puede escucharse aunque la transcripción no esté habilitada. Sólo Completed vigente entra al análisis; fallas y vencimiento no se convierten en texto ni reactivan un mensaje previo.

H7 usa temas y conteos agregados del servidor, con Pendientes/Descartados e historial real de descarte. Manage permite leer/descartar sin lectura de plantillas; Crear conserva Read+Manage y abre el alta normal con el nombre del tema, en el idioma del menú como cualquier alta, sin resolver el pedido ni reemplazar un borrador editado. La navegación conserva una sola entrada activa.

El cierre local verificó lógica, permisos, recuperación, conservación de borradores y guards: 2.245/2.245 tests en 227 archivos, build sin errores ni advertencias y lint con 49/49 checks de arquitectura. La visual normal quedó 511/511 escenas en la pasada normal definitiva; se inspeccionaron las 36 capturas nuevas de H6/H7/s4 en es/en a 1440/390/320 contra los tableros elegidos. Las 126 referencias anteriores conservan sus SHA: 125 siguen comparándose y la de Bot se preserva como evidencia histórica de un estado retirado. La migración a Manual tiene una referencia nueva, inspeccionada contra H1, sin reemplazar aquella. Las comparaciones vigentes mantienen su tolerancia. El diseño vigente mantiene D2, G2/G5 versión 75, H1–H7 y s1–s4.

Los consumidores usan 19 cohortes, 295 capturas —64 de WhatsApp— y 53 fuentes, con bytes y SHA idénticos al front. El recorrido AppPreview con ingreso normal por correo/código, PostgreSQL/Azurite y Meta/IA controlados acreditó Chrome e IAB: ingreso normal con código, D2 en planilla y Por aprobar, filtros/foco/URL/flechas/Escape, decisión con otra cuenta, PDF fijo con foto abierto y descargado, vista previa con respaldo completo al original, revisión manual, continuación Siempre, catálogo aprobado, tablero de pedidos faltantes y audio con permiso de lectura; móvil de 390×844; los hosts quedaron detenidos. El [cierre canónico](../../../ArquitecturaBase/docs/features/formularios.md#cierre-local-de-la-etapa-5-y-del-review-de-la-etapa-4) conserva resultados, procedencia y límites; la [calificación OpenAI](../../../ArquitecturaBase/docs/guides/configurar-ia.md#evidencia-para-habilitar-perfiles) es independiente del [piloto físico del asistente y audios](../../../ArquitecturaBase/docs/plans/verificacion-y-produccion.md#formularios-piloto-del-asistente-y-audios). En ese cierre se conservó la regla bilingüe de preguntas y catálogos de las Etapas 1–3. [I1–I3](#decisiones-de-diseño) sustituyen después el requisito de publicación del formulario, y desde el 2026-10-23 los catálogos comunes tampoco son bilingües.

## Cierre local de idioma original y traducción opcional — 2026-10-19

I1–I3 conservan el original obligatorio, el secundario opcional y sus marcas neutras. La preview elige una cultura
para todo el formulario; la publicación informa los idiomas completos y los cambios de una versión a otra. El selector
común permitía envolver sus etiquetas sólo en I1, manteniendo visible el conteo en móvil; con la
[decisión del 2026-10-23](#idioma-del-menú-sin-selector--2026-10-23) se retiraron ese selector de I1 y, con él, la
variante `wrapLabels`. Las culturas de la vista oficial
y del aviso de publicación proceden de las copias confirmadas del servidor. La
[regla funcional](../../../ArquitecturaBase/docs/features/formularios.md#idioma-original-y-traducción-opcional--2026-10-19) fija también la cultura preparada de envío y el respaldo individual de cada ítem de catálogo.

Verificación final del front: **2355/2355 tests en 228 archivos**, build y TypeScript limpios, lint con **49/49** checks
de arquitectura y visual completa normal **527/527**, sin fallos ni omitidos. Los tests de consumo de contratos HTTP quedaron **79/79 en 21 archivos** y validaron el export conjunto: **19 cohortes, 318 capturas y 54 fuentes**, con tamaños, bytes y SHA256 coincidentes
con la corrida backend de fuente `59b52772`. Forms conserva 46 cuerpos, incluidos 18 de original→ambos→original
para es/en; Workflow/PDF incluyen el recorrido inglés con un ítem en su original. Las **127 referencias visuales**
conservaron sus hashes; no se cambiaron tolerancias. El servidor visual terminó solo y liberó 5178. El aviso heredado
`NO_COLOR`/`FORCE_COLOR` se conserva en el log de la ejecución.

Se revisaron **40 capturas I1–I3**: 24 de I1 en es/en a 1440/390/320 y 16 de I2/I3 en es/en a 390/320.
Las capturas de página conservan el desplazamiento del main; las de preview y las comprobaciones DOM completan
la lectura de contenido y geometría. El navegador contra la API local comprobó v1 sólo español→v2 ambos idiomas→v3
sólo español, preview entera en español e inglés, CTA Completar con foco en Nombre y Cancelar sin cambios.
La matriz DOM es/en a 390/320 confirmó selector, contador y diálogos dentro del ancho disponible. Las doce imágenes
del recorrido se conservan como evidencia local; entre ellas:

| Evidencia | Alcance |
| --- | --- |
| [I1, autoría en UI español a 320](evidence/formularios-whatsapp/idioma-20261019-i1-es-320.jpg) | Original obligatorio, inglés opcional y contador 3 visible. |
| [I1, UI inglés y preview español a 390](evidence/formularios-whatsapp/idioma-20261019-i1-preview-en-390.jpg) | Traducción incompleta: el teléfono usa español entero. |
| [I1, traducción completa con UI español a 320](evidence/formularios-whatsapp/idioma-20261019-i1-complete-es-320.jpg) | El teléfono pasa entero a inglés. |
| [I2, sólo español a 390](evidence/formularios-whatsapp/idioma-20261019-i2-es-390.jpg) | Faltantes secundarios informativos y publicación disponible. |
| [I3, suma inglés con UI inglés a 320](evidence/formularios-whatsapp/idioma-20261019-i3-add-en-320.jpg) | Confirmación de la versión 2 que suma inglés. |
| [I3, pierde inglés con UI español a 390](evidence/formularios-whatsapp/idioma-20261019-i3-remove-es-390.jpg) | Confirmación de la versión 3 que pierde inglés, con aviso. |

El proveedor Meta del recorrido local fue simulado. El
[piloto físico de idioma original y traducción opcional](../../../ArquitecturaBase/docs/plans/verificacion-y-produccion.md#formularios-idioma-original-y-traducción-opcional) conserva su criterio de cierre separado.

## Cierre local de baja, reactivación y eliminación — 2026-10-21

BA1-A, BA2, BA3, BA4 y BA6 siguen los tableros elegidos y los ajustes de la versión 96. Activos reúne publicados y borradores; la reactivación continúa en Dados de baja hasta confirmar la versión nueva. La tabla y el segmentado conservan el desplazamiento dentro de su caja en el celular. El editor explica por qué no se puede eliminar un formulario con respuestas como texto no accionable. La sugerencia hacia un dado de baja sólo permite Quitar y bloquea Guardar mientras permanezca.

El cierre del front quedó en **2479/2479 tests en 233 archivos**, sin fallos ni omitidos, con build/TypeScript y lint aprobados; los controles de arquitectura fueron **49/49**.

La visual normal cerró **567/567**, incluidas **40 escenas nuevas** en es/en a 390/320. Las **127 referencias** conservaron sus hashes, sin cambios de tolerancias. Los **109 tests de contratos en 23 archivos** consumen el export real conjunto de **20 cohortes, 354 capturas y 63 fuentes únicas**, de fuente backend `23014e6b`; lifecycle aporta 28 cuerpos, catorce por idioma, con bytes y SHA256 intactos.

El recorrido interactivo en IAB sobre componentes productivos y datos sintéticos comprobó los filtros, el desplazamiento contenido, los diálogos móviles con pie fijo, Cancelar y retorno de foco, el diálogo de reactivación y los estados Pendiente/Sin confirmar, y BA6 con Quitar que habilita Guardar. Se inspeccionaron las capturas actuales, incluido el motivo neutral en el menú. Las pruebas de persistencia y concurrencia corresponden a la [integración Docker del backend](../../../ArquitecturaBase/docs/features/formularios.md#verificación-local-del-ciclo-de-vida--2026-10-21); este recorrido no usa Meta real.

| Evidencia de la implementación | Alcance |
| --- | --- |
| [BA1-A, español a 390](evidence/formularios-whatsapp/baja-20261021-ba1-es-390.png) | Tabla y segmentado con desplazamiento contenido. |
| [BA2, inglés a 320](evidence/formularios-whatsapp/baja-20261021-ba2-en-320.png) | Baja, Reactivar y motivo no accionable; Eliminar ausente. |
| [BA3, español a 390](evidence/formularios-whatsapp/baja-20261021-ba3-es-390.png) | Sugerencia afectada, vencimiento, conservación y confirmación. |
| [BA4 Reactivar, español a 320](evidence/formularios-whatsapp/baja-20261021-ba4-reactivar-es-320.png) | Versión nueva, numeración y comprobación de publicación. |
| [BA4 Eliminar, inglés a 320](evidence/formularios-whatsapp/baja-20261021-ba4-eliminar-en-320.png) | Diálogo completo móvil, prefijo reservado y pie fijo. |
| [BA6, inglés a 390](evidence/formularios-whatsapp/baja-20261021-ba6-en-390.png) | Destino dado de baja, sólo Quitar y Guardar apagado. |

MF1 y el detalle completo tienen sus [reglas implementadas](../../../ArquitecturaBase/docs/features/formularios.md#gestión-de-formularios-y-detalle-completo--2026-10-21). El [piloto real de baja y reactivación](../../../ArquitecturaBase/docs/plans/verificacion-y-produccion.md#formularios-baja-reactivación-y-eliminación) conserva su cierre físico separado.

## Verificación posterior al review de baja — 2026-10-21

El review conserva BA1-A, BA2, BA3, BA4 y BA6. Se revisaron la baja sin envíos abiertos, el prefijo reservado al eliminar, la advertencia de WhatsApp sólo para formularios que llegaron a publicarse, los motivos alcanzables por teclado y el estado «Requiere atención», sin una acción nueva ni una fecha de deprecación inventada. Las relecturas tras red/5xx conservan el borrador y no atribuyen al operador un cambio observado de otro intento.

El front cerró **2511/2511 tests en 237 archivos**, build/TypeScript y lint aprobados, con **49/49** controles de arquitectura. La visual estándar quedó **585/585**, con las **127 referencias** idénticas en inventario y SHA256, sin cambios de snapshots ni tolerancias. Se inspeccionaron las seis capturas P10 en es/en a 1440/390/320 y muestras actuales de eliminación y NeedsAttention. El export real de la misma corrida backend `49e14c21` reúne **20 cohortes, 356 capturas y 63 fuentes únicas** —80 referencias de fuentes sumadas por cohorte—; lifecycle contiene **30 cuerpos**, quince por idioma, incluidos los dos NeedsAttention. Los consumidores verificaron sus bytes, hashes y contratos estrictos.

El recorrido IAB en es/en a 390/320 comprobó BA1-A, BA2, BA3, BA4 y BA6, NeedsAttention en tabla y editor y el teclado. Las confirmaciones durables se cancelaron; BA6 sólo cambió el borrador local y se descartó. P10 se acredita con seis casos y capturas de un 429 simulado por el arnés visual, sin atribuirlo a ese recorrido manual. La tabla y el segmentado mantienen scroll contenido y los diálogos móviles, cuerpo desplazable y pie fijo. Servidor y pestañas del agente quedaron cerrados. El transporte del arnés es simulado; la [integración del backend](../../../ArquitecturaBase/docs/features/formularios.md#verificación-local-del-ciclo-de-vida--2026-10-21), MF1 y el piloto físico mantienen sus alcances separados.

| Evidencia posterior al review | Alcance |
| --- | --- |
| [BA3 sin envíos abiertos, español a 320](evidence/formularios-whatsapp/baja-review-20261021-no-open-es-320.jpg) | JPEG del recorrido IAB, sin convertir: aviso inmediato, conservación y pie fijo. |
| [Eliminar borrador, español a 320](evidence/formularios-whatsapp/baja-review-20261021-delete-draft-es-320.png) | Prefijo ENT reservado, sin advertencia de Flows publicados. |
| [Eliminar publicado, inglés a 320](evidence/formularios-whatsapp/baja-review-20261021-delete-published-en-320.png) | Prefijo VIS, advertencia de WhatsApp y Cancelar con foco. |
| [NeedsAttention en editor, inglés a 390](evidence/formularios-whatsapp/baja-review-20261021-needsattention-editor-en-390.png) | Aviso explícito sin fecha de deprecación ni acción nueva. |
| [NeedsAttention en tabla, español a 320](evidence/formularios-whatsapp/baja-review-20261021-needsattention-list-es-320.png) | Tabla desplazada hasta el estado autoritativo; scroll contenido. |
| [P10, español a 320](evidence/formularios-whatsapp/baja-review-20261021-publication-wait-es-320.png) | Comprobación pendiente, espera y acciones separadas ante 429 simulado. |
| [P10, inglés a 390](evidence/formularios-whatsapp/baja-review-20261021-publication-wait-en-390.png) | Mismo recorrido con copy en inglés y foco visible. |
| [P11, inglés a 320](evidence/formularios-whatsapp/baja-review-20261021-unavailable-menu-en-320.png) | Motivo de la acción apagada alcanzable por teclado; no inicia otra publicación. |

## Cierre local de menú y detalle — 2026-10-21

MF1, D2 como vista rápida y DC0/DC1 ajustado siguen los tableros elegidos y la versión 96. La pantalla completa conserva el origen, las flechas y el retorno a la fila; Actividad y Respuesta son plegables y el PDF queda vinculado a la acción que lo generó. Los permisos de lectura y decisión se retiran por separado.

La última suite visual, sobre producto `54cca75` y los contratos del export conjunto, pasó **617/617 escenas** en 8,5 minutos. Se conservaron los hashes de las **127 referencias**, sin actualizar snapshots ni alterar timeouts, reintentos o tolerancias. El build y lint completos quedaron limpios, incluidos **49/49 controles de arquitectura**. La [verificación conjunta](../../../ArquitecturaBase/docs/features/formularios.md#verificación-conjunta-de-menú-detalle-y-aislamiento--2026-10-21) conserva Docker, procedencia y los resultados completos.

El recorrido interactivo en IAB verificó componentes productivos con transporte sintético: es/en a 1440, 390 y 320 px, tabla contenida, permisos, D2, pantalla completa, flechas, retorno y foco, plegado, visor y descarga del mismo blob. Las capturas siguientes pertenecen a la última corrida visual en verde. El iframe nativo del PDF aparece blanco en estos PNG: acreditan su marco, nombre, idioma y controles; no sus píxeles internos. Los tests verifican carga diferida, reutilización y retiro del blob. No se inició un piloto con Meta ni se repitió la calificación de IA.

| Evidencia | Alcance |
| --- | --- |
| [MF1 escritorio](evidence/formularios-whatsapp/menu-detalle-20261021/form-overview-active-es-1440.png) | Filtros en una fila, pendientes y última respuesta en tabla densa. |
| [MF1 lectura, en, 390](evidence/formularios-whatsapp/menu-detalle-20261021/form-overview-read-en-390.png) | Desplazamiento horizontal contenido, sin columna de aprobación. |
| [Sólo decisión, es, 320](evidence/formularios-whatsapp/menu-detalle-20261021/response-full-decide-es-320.png) | Metadata y decisión, sin valores ni acceso a pantalla completa. |
| [D2 escritorio, en](evidence/formularios-whatsapp/menu-detalle-20261021/response-full-quick-en-1440.png) | Vista rápida sobre la planilla con acceso a pantalla completa. |
| [DC1 inicial, es, 320](evidence/formularios-whatsapp/menu-detalle-20261021/response-full-initial-es-320.png) | Formulario/número legibles, Respuesta abierta, Actividad plegada y adjunto legible. |
| [Actividad, en, 390](evidence/formularios-whatsapp/menu-detalle-20261021/response-full-activity-en-390.png) | PDF vinculado a su acción, nombre, idioma y marco de miniatura. |
| [Visor PDF, es, 320](evidence/formularios-whatsapp/menu-detalle-20261021/response-full-pdf-es-320.png) | Descargar y Cerrar dentro del diálogo de copia fija. |

## Verificación interactiva posterior al review de menú — 2026-10-21

Se recorrieron en IAB los componentes productivos con transporte sintético: MF1 con las cuatro entradas, el filtro de pendientes y las bajas identificadas; D2 con migas de planilla; teclado desde Por aprobar hasta la pantalla completa y retorno a la tarea; selección/foco al cerrar; el atajo móvil del PDF y el perfil que sólo decide. Español e inglés a 390/320 px, más escritorio para MF1, D2 y pendientes. No se usaron datos de Aspire ni Meta. Los servidores y pestañas propios se cerraron y se retiró el tamaño temporal del navegador.

El atajo «Ver PDF» abre Actividad; la entrada ordinaria mantiene el plegado. Esta comprobación acredita estado, controles y referencia a la copia, sin atribuir píxeles al iframe nativo. El [cierre conjunto del review](../../../ArquitecturaBase/docs/reviews/2026-10-21-code-review-menu-y-detalle.md#cierre-local) verificó Docker **5.389/5.389**, front **2.689/2.689**, build productivo y lint limpios, y visual **623/623** sobre `0ad49f3`, con las **127 referencias** idénticas por hash. Estas siete capturas son evidencia interactiva y conservan su procedencia. El bundle de pruebas agrupa paquetes/shared: 76 → 16 preloads; el aviso de tamaño de su chunk común quedó revisado y visible. Se ejecutó `aspire stop` y todos los servidores propios quedaron cerrados.

| Evidencia del review | Alcance |
| --- | --- |
| [MF1 pendientes, es, escritorio](evidence/formularios-whatsapp/menu-review-20261021/mf1-pending-es-desktop.png) | Cuatro entradas, segmentos sin selección, baja marcada y sin aviso repetido. |
| [MF1 pendientes, en, 320](evidence/formularios-whatsapp/menu-review-20261021/mf1-pending-en-320.png) | Traducción y tabla con desplazamiento contenido. |
| [D2, es, escritorio](evidence/formularios-whatsapp/menu-review-20261021/d2-breadcrumb-es-desktop.png) | Migas de la planilla, sin la rama genérica de respuesta. |
| [Pendientes completos, es, 390](evidence/formularios-whatsapp/menu-review-20261021/pending-full-es-390.png) | Origen Por aprobar, contador de cola y decisión al pie. |
| [Pendientes completos, en, 320](evidence/formularios-whatsapp/menu-review-20261021/pending-full-en-320.png) | Interfaz en inglés; conserva el texto y el archivo históricos. |
| [Atajo PDF, en, 390](evidence/formularios-whatsapp/menu-review-20261021/pdf-intent-en-390.png) | Actividad abierta y copia vinculada a Al aprobarla. |
| [Sólo decisión, es, 320](evidence/formularios-whatsapp/menu-review-20261021/decide-only-es-320.png) | Metadata y decisión sin respuestas ni pantalla completa. |

## Idioma del menú sin selector — 2026-10-23

Decisión del usuario en el review de Catálogos E2 (punto 35): nadie está obligado a escribir en español ni en inglés y
ninguna pantalla elige el idioma del contenido. Lo que se crea se escribe en el idioma del menú, que es su original y el
único obligatorio; el otro idioma es una traducción opcional y se edita cambiando el idioma del menú. Se retiraron
«Textos en» de I1, de «El catálogo» y de la vista oficial, el selector de la vista previa del PDF y los pares de campos por
idioma (nombre y pie del PDF, nombre de un campo del catálogo y de un dato de las personas): cada texto es un solo campo.

- Con el menú en el otro idioma, un texto sin traducción queda vacío, con «Sin traducir» y el original como referencia
  («Original (Inglés): …»), sin copiarlo; en la tabla de opciones el original es el placeholder de la celda.
- Fuera de los editores, cada texto se muestra en el idioma del menú y, si falta, en el original.
- La comprobación de publicación sigue avisando lo que falta del original; «Completar el {idioma}» se ofrece sólo con el
  menú en ese idioma.
- Un error de guardado o de la comprobación en el otro idioma se ve bajo el mismo campo, con su idioma
  («En inglés: …»), sin cambiar de idioma; lo que no tiene control conserva su aviso.
- Cambiar el idioma del menú con cambios sin guardar los conserva en el editor del formulario y en los de catálogos (punto 41
  del review de E2): es el mismo objeto en la otra traducción. Sólo el diseño del PDF se reinicia con el idioma y pide
  confirmación antes de descartarlos.
- La regla alcanza a los catálogos (nombre, descripción, opciones y campos, con el `originalCulture` del catálogo) y a los
  datos de las personas (con el suyo), y retira la excepción bilingüe del alta común de catálogos.

La [regla funcional](../../../ArquitecturaBase/docs/features/formularios.md#idioma-original-y-traducción-opcional--2026-10-19)
fija el contrato. Las escenas visuales recorren editor, publicación, vista oficial, PDF, catálogos, campos y datos de las
personas sin selector, y `catalogManual` suma el editor de catálogo en inglés sobre un original español, con la
referencia.
