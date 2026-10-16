# Formularios por WhatsApp: tableros elegidos

Fecha: **2026-10-08**, con las variantes de los cuatro incrementos de la Etapa 1 y el botón «Abrir formulario»
agregados el **2026-10-10**.
Estado al **2026-10-16**: **Etapas 1–3 cerradas; Etapa 4 implementada y verificada localmente**. G1–G6 conservan las elecciones del lienzo; el piloto físico de esta etapa sigue pendiente. Las notas fechadas de los cortes anteriores son históricas. Las reglas y la evidencia vigente están en [formularios](../../../ArquitecturaBase/docs/features/formularios.md#verificación-de-la-etapa-4--2026-10-16).

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

El front pasó1542/1542 pruebas en149 archivos con1worker, build ylint48 de arquitectura limpios. La única completa visual terminó300/306; los6fallos pasaron6/6 en focal con configuración estable, sin modificar snapshots/assertions/productoIA. Manual pasó6/6 en es/en a1440/390/320, con30capturas revisadas. El recorrido separado SPA/API/PostgreSQL/Redis pasó9/9 y8capturas; los tokens se mantuvieron en memoria y el arnés se cerró. Se conservan las corridas rojas y la procedencia automática de15cuerpos HTTP; no se acredita Meta ni Etapa2 completa. El [resumen vigente](../../../ArquitecturaBase/docs/plans/formularios/etapa-2-catalogos.md) conserva el resto del alcance.

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
| [A · El listado de la Etapa 1](evidence/formularios-whatsapp/e1-a-listado.png) | El 02 recortado: panel con solo «Diseñar formularios», columnas Formulario, Preguntas, En WhatsApp, Último cambio y Acciones (solo Editar), filtros con conteos del servidor y los estados de la lista. |
| [B · Nuevo formulario](evidence/formularios-whatsapp/e1-b-alta.png) | El editor e1-1 vacío: nada existe hasta «Guardar borrador», prefijo sugerido, pregunta nueva abierta en el lugar, Subir y Bajar, qué pasa al guardar (Guardando…, Guardado, No se guardó, Sin confirmar) y qué pide confirmación. |
| [C · El prefijo de numeración](evidence/formularios-whatsapp/e1-c-prefijo.png) | Sugerido, editado, ocupado, fijo al publicar, fijo aunque la publicación falló y fijado mientras se editaba. |
| [D · Otra persona guardó antes](evidence/formularios-whatsapp/e1-d-conflicto.png) | Aviso con «Revisar», comparación «Guardado actualmente» y «Mis cambios» por pregunta y opción, «Usar borrador actual» o «Conservar mis cambios», sin combinar nada solo. |
| [E · Textos en dos idiomas](evidence/formularios-whatsapp/e1-e-idiomas.png) | Español e inglés en el mismo editor: un idioma a la vez con el original debajo, lo que falta marcado en la fila, el campo y la vista previa. Se guarda incompleto; para publicar hacen falta los dos. |

Incremento 2 de la Etapa 1, publicar en WhatsApp (2026-10-10). Variantes del tablero 04 y del editor e1-1, sobre el
contrato de publicación de entonces (hoy en [formularios](../../../ArquitecturaBase/docs/features/formularios.md)). Quedan a
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
[resumen de la Etapa 2](../../../ArquitecturaBase/docs/plans/formularios/etapa-2-catalogos.md). Decidido el
mismo día: el inglés de las opciones de un catálogo es opcional (si falta, se usa el español); cambiar el catálogo de una
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
recorrido guiado tiene su capítulo desde la versión 67.
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

Etapa 3, planilla de respuestas (2026-10-10). **Diseño elegido**: los tableros 06 y 07 recortados a esta etapa,
sin aprobación, PDF ni asistente. Cargar desde la web queda para después (decidido el 2026-10-10).

| Captura | Qué define |
| --- | --- |
| [T1 · La planilla](evidence/formularios-whatsapp/pla-t1-planilla.png) | «Respuestas» en el panel, columnas fijas (número, recibida, cargó) y una por pregunta de todas las versiones; «—» si no existía y «Sin respuesta» si no se contestó. Fotos: primera miniatura y cantidad, abre el visor de F4; documentos: tipo y cantidad. Con muchas preguntas se desplaza a lo ancho y «Columnas» oculta las que sobran (elegido el 2026-10-16). |
| [T2 · Más filtros](evidence/formularios-whatsapp/pla-t2-filtros.png) | Un filtro por pregunta según su tipo, con conteos del servidor; versión del formulario; búsqueda privada fuera de la dirección. |
| [T3 · Una respuesta](evidence/formularios-whatsapp/pla-t3-respuesta.png) | Lo que respondió con las preguntas de su versión, de dónde vino, historial y anterior/siguiente dentro de la planilla. A todo el ancho, con galería de fotos que abre el visor y documentos con descarga (elegido el 2026-10-16). |
| [T4 · Estados y casos](evidence/formularios-whatsapp/pla-t4-estados.png) | Carga, sin respuestas, sin coincidencias, error, muchos formularios, sin permiso, respuesta que no está y pregunta que cambió de tipo. |

Etapa 4, reglas, aprobación, PDF y avisos (2026-10-10), con reglas implementadas en [formularios](../../../ArquitecturaBase/docs/features/formularios.md#reglas-con-revisiones-propias--etapa-4-g1). Decidido el mismo día: después
de «Pedir aprobación» no hay más acciones en la misma regla; una respuesta que espera aprobación sigue con las reglas con
que llegó; nadie aprueba lo que cargó. Los avisos fuera de las 24 horas necesitan plantillas de Meta. Los ajustes «Incluir las fotos» de G2 y «Reintentar» de G5 quedaron elegidos en la versión 75 del lienzo, el 2026-10-16.

| Captura | Qué define |
| --- | --- |
| [G1 · Cuando llega una respuesta](evidence/formularios-whatsapp/reg-g1-reglas.png) | Reglas en palabras (cuándo, si, hacer en orden), una abierta para editar, Guardar reglas e historial de revisiones. |
| [G2 · El diseño del PDF](evidence/formularios-whatsapp/reg-g2-pdf.png) | Comprobante simple: nombre obligatorio en el idioma original y traducción opcional, qué preguntas incluye, quién aprobó, texto al pie y vista previa. «Incluir las fotos»: marcada, van chicas debajo de su pregunta; sin marcar, dice cuántas hay; los documentos solo se nombran (elegido el 2026-10-16). |
| [G3 · Por aprobar](evidence/formularios-whatsapp/reg-g3-por-aprobar.png) | La bandeja de quien decide, en el panel con su cantidad; ordenada de la más vieja a la más nueva. |
| [G4 · Aprobar o rechazar](evidence/formularios-whatsapp/reg-g4-decidir.png) | El detalle con la decisión; rechazar pide motivo; otra persona decidió antes; no aprobar lo propio. |
| [G5 · Qué pasó después](evidence/formularios-whatsapp/reg-g5-historial.png) | Cada acción con su estado (esperando, en curso, hecho, no se pudo, sin confirmar, no aplica) y el PDF como copia fija. «Reintentar» retoma solo lo que no salió; lo «Sin confirmar» se consulta primero (2026-10-16). |
| [G6 · Lo que recibe el empleado](evidence/formularios-whatsapp/reg-g6-celular.png) | Confirmación al recibir, aviso con el PDF al aprobar, motivo al rechazar, también en inglés. |

Etapa 5, el asistente (2026-10-10), sobre el [resumen de la Etapa 5](../../../ArquitecturaBase/docs/plans/formularios/etapa-5-asistente.md). También son de esta etapa «Cuándo lo ofrece» (03),
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

Propuesta posterior, en revisión (Etapa del asistente): un formulario puede sugerir otro. No reemplaza a los
tableros elegidos; el modelo y las reglas están en los
[resúmenes por etapa](../../../ArquitecturaBase/docs/plans/formularios/README.md).

| Captura | Qué define |
| --- | --- |
| [La idea](evidence/formularios-whatsapp/s1-sugerir-idea.png) | Formularios independientes conectados por sugerencias: cuándo, qué datos pasan y cómo se ofrecen. |
| [Configurar qué sugerir después](evidence/formularios-whatsapp/s2-sugerir-editor.png) | Sección del editor con su propio «Guardar sugerencias», sin republicar. |
| [En el celular](evidence/formularios-whatsapp/s3-sugerir-celular.png) | Entrega que termina en factura, y los casos «Juan no lo abre», sin IA, nada que sugerir y sin permiso. |
| [La cadena en la web](evidence/formularios-whatsapp/s4-sugerir-cadena.png) | La respuesta recuerda de dónde vino, qué sugerencia la ofreció y por qué. |

## Decisiones de diseño

1. **Navegación.** «Formularios» es una entrada propia del menú principal con su panel, como WhatsApp. Arriba,
   «Respuestas», con un enlace por formulario publicado que la persona puede ver. Abajo, separado, «Diseñar
   formularios», solo con permiso de administrar. El panel de la Etapa 3 compone la parte fija con la lista paginada del backend mediante `FormResponsesShell` y el contexto neutral de layouts; no fija formularios en `navigation.ts`.
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

K3 y K4 incorporan Dar de baja/Reactivar con la confirmación común: el cambio se prepara y se aplica con Guardar, bajo una única revisión. El estado se muestra en palabras junto al título; se conservan opciones y respuestas anteriores. Una baja Filters no requiere elegir persona ni preview. Buscar personas conserva el editor y el foco con espera de 300 ms; un fallo de lectura no retira los filtros. Guardar tras red/5xx permite reintento explícito; sólo 409 exige revisión.

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

Reglas, historial, bandeja de aprobación, decisión, diseño PDF y avisos conservan los tableros elegidos, incluidos los ajustes G2/G5 de la versión 75. Reglas y diseño guardan su revisión propia con adopción explícita ante409, sin publicar ni guardar preguntas. Sólo los textos nuevos de esta etapa exigen el idioma original; la alternativa es opcional. Las Etapas 1–3 conservan la publicación bilingüe. Si el idioma de quien recibe está incompleto en cualquier aviso de esa revisión de reglas o en su diseño PDF, los mensajes y las copias del evento salen enteros en el original.

«Por aprobar» usa roles vigentes y no permite decidir lo propio. Sin lectura de respuestas abre sólo metadata y decisión; los valores y documentos requieren su permiso independiente. El historial distingue acciones esperando, en curso, hechas, fallidas, sin confirmar y no aplicables. Consultar/Reintentar usan la misma acción; lo incierto se consulta primero y lo confirmado no se repite.

La vista previa del diseño usa ejemplos y no persiste. La respuesta aprobada ofrece su PDF fijo por API autorizada; cambiar el diseño no lo regenera. Los avisos de reglas aparecen en WhatsApp con autor automático y documento cuando corresponde; sin lectura de respuestas se retiran cuerpo y caption antes de la caché y la bandeja conserva un resumen genérico.

Verificación local definitiva: build, TypeScript y lint limpios; full **1793/1793 en 188 archivos** y visual completa **493/493** con referencias intactas. Sobre las seis cohortes definitivas pasaron **13/13 en 7 archivos** en 9,23 s: 67 capturas con bytes, tamaño y SHA256 comprobados, del run `20261016-203953-d6165b4572ea4d019735be2c387de43f` y backend `98fa775c` (**3096/3096**, cero omitidos y build sin errores ni advertencias). Las fuentes productoras son idénticas a las verificadas. Los avisos del arnés de la full permanecen en su [pendiente existente](../../../ArquitecturaBase/docs/plans/README.md).

El recorrido contra SPA/API local verificó arranque/migraciones, bandeja vacía, reglas con original y traducción vacía, diseño inicial/preview con respaldo completo, descarte sin persistir, filtro decimal y detalle histórico. IAB/headless no pintó el visor PDF nativo; los bytes, fotos en color y cuatro páginas se calificaron por render técnico separado. Aspire quedó detenido. Las capturas visuales usan transporte simulado y el almacenamiento local fue emulado; el [piloto de visita, aprobación y PDF al celular](../../../ArquitecturaBase/docs/plans/verificacion-y-produccion.md#formularios-piloto-de-aprobación-y-pdf) sigue pendiente con Meta y Azure reales. El [cierre canónico](../../../ArquitecturaBase/docs/features/formularios.md#verificación-de-la-etapa-4--2026-10-16) conserva el alcance y [history](../../../ArquitecturaBase/docs/history/README.md#formularios-etapa-4-y-review-de-la-etapa-3--2026-10-16), la procedencia del plan y review retirados.
