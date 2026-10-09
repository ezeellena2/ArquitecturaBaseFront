# Bandeja de WhatsApp: propuesta para revisar

## Información del negocio: propuesta local — 2026-10-03

Esta sección conserva la ronda inicial. El usuario pidió la implementación productiva
el 2026-10-03: /configuracion/negocio, permisos ai.business.read/ai.business.manage,
persistencia y comprobantes reales. [Reglas finales](../../../ArquitecturaBase/docs/features/inteligencia-artificial.md#información-del-negocio--2026-10-03)
y [evidencia posterior](../../../ArquitecturaBase/docs/reviews/2026-10-03-informacion-del-negocio.md).
Las sugerencias siguen siendo simuladas. Los 80/82 citados abajo pertenecen a esa
ronda; la nueva ejecución completa terminó 95/95 sin actualizar referencias de Usuarios.

El usuario pidió realizar el siguiente paso del plan: maquetar el editor antes de
implementar información y generación. Entrada `?screen=negocio`, con `&lang=en` para
inglés. `BusinessInformationProposal` compone AppLayout, Page, tres Surface y los
campos reales del sistema; conserva Campo, Public Sans, medidas y navegación.
El menú aislado ofrece Administración → Configuración → Información del negocio,
junto a Inteligencia artificial. La ubicación y los campos siguen siendo propuesta,
pendientes de elección; no se creó una ruta ni un permiso productivo.

Campos propuestos: nombre, descripción, horario, ubicación/zona de atención,
productos/servicios, políticas/condiciones y preguntas/respuestas como texto libre.
No incorpora un catálogo de fuentes, adjuntos ni publicación editorial. Guardar aplica
el conjunto a nuevas sugerencias en el recorrido propuesto; la simulación no modifica
las muestras del chat ni una fuente real. El nombre y al menos un dato de atención
son obligatorios en la maqueta; límites de texto ilustrativos, por cerrar con los DTOs.

El selector de laboratorio reinicia datos ficticios y permite revisar información
cargada/vacía, carga, sólo lectura, sin permiso, carga fallida, guardado fallido,
conflicto, comprobante confirmado tras perder la respuesta y comprobante ausente.
Guardar/Descartar viven en Page. Descartar o salir con cambios pide ConfirmDialog;
un fallo conserva el borrador y usa el único Toaster. El conflicto compara datos
actuales con el borrador en la tabla común; conservar ediciones incorpora los campos
ajenos no editados y todavía no guarda. La incertidumbre bloquea edición, Guardar y
Descartar: sólo un comprobante confirmado habilita el éxito. La ausencia de comprobante
mantiene el estado pendiente, sin asumir rollback ni repetir el guardado.

Todo vive en memoria, con timers simulados: no hay API nueva, claves, proveedor ni
almacenamiento. El bootstrap y el permiso ficticio settings.manage quedan en el
laboratorio. La entrada carga los namespaces completos antes de extender common,
para que el caparazón también se traduzca al inglés; conserva un solo enlace de IA.

Verificación de esta ronda: siete tests de comportamiento en rojo antes de implementar
y después en verde, TypeScript del laboratorio, build, lint (39 reglas) y suite completa
del front (875 tests en 82 archivos) correctos. Playwright desde el navegador verificó
es/en a 1440/390/320 px, campos al pie en móvil, comparación con scroll contenido,
foco en el título de revisión y recuperación desde la notificación. Sin errores
de JavaScript ni desborde horizontal. Capturas en
`design-lab/whatsapp-chat/evidence/business-info-*.png`.

La suite visual general terminó **80/82**, con dos diferencias pendientes de capturas
en diálogos existentes de Usuarios: `appearance-dark-table.png` y `user-dialog-320.png`.
Se revisaron sus diffs, sin actualizar referencias ni cambiar componentes productivos.
Diagnóstico en `test-results/business-information-regression/`. La primera corrida
también sufrió interferencias de archivos de trazas entre ejecuciones simultáneas;
la repetición con salida propia eliminó esas fallas de archivos. El arnés de Usuarios
recibió una corrección concurrente a su despacho de POST, que destrabó el build; no
forma parte de los cambios de esta maqueta.

El build final detectó además una opción `exact` no admitida por Testing Library en
un test concurrente de Roles. Se retiró sólo esa opción: el nombre de rol ya usa
coincidencia exacta por defecto. Se conservó el recorrido y se verificó su consumidor
con el archivo de tests del editor de Roles y un nuevo build.

No se cambió backend ni se levantó Aspire. Persistencia, concurrencia real, generación
y sincronización del Artifact privado siguen pendientes del
[plan](../../../ArquitecturaBase/docs/plans/2026-10-03-sugerencias-ia-whatsapp.md).

## Propuesta de color de acciones — 2026-10-03

El usuario aclaró que se conserva el tablero anterior y sólo se diferencia algún botón.
Descartó el azul petróleo por diferir de los otros botones. En `?screen=sugerencias`,
Sugerir con IA usa ahora Button principal (`default`): verde sólido del sistema, con
la misma forma/tamaño. Panel, otros botones, íconos, tipografía, navegación y recorrido
de revisión humana mantienen el diseño previo. No hay tokens nuevos ni CSS propio
del botón. El usuario aprobó este ajuste y eligió historial + información básica del negocio,
con su editor maquetado primero. La implementación sigue el
[plan actualizado](../../../ArquitecturaBase/docs/plans/2026-10-03-sugerencias-ia-whatsapp.md);
los controles del laboratorio todavía usan datos ficticios.

Fecha inicial: 2026-10-01. **Ronda final de maqueta: 2026-10-02; chat y configuración/prueba de IA promovidos, demás destinos pendientes.**
El laboratorio sigue siendo una simulación aislada. La bandeja productiva, sus permisos,
endpoints y persistencia ya existen fuera de él, en `/whatsapp/chat` y el módulo del backend.
Su contrato actual está en [WhatsApp](../../../ArquitecturaBase/docs/features/whatsapp.md).
El bot de acceso y su activación de esta propuesta fueron reemplazados por el ADR 0011:
Manual por defecto, Bot legado sin automatización y acceso explícito desde la web.

El usuario pidió trabajar por partes: maqueta → estructura de carpetas y archivos
de ambos repositorios → plan → implementación. Cada entrega explica su función;
la estructura y el plan detallados se elaboran después de elegir el recorrido.

## Configuración LLM general: alcance corregido — 2026-10-02

El usuario aclaró que el próximo paso es **solo configurar la conexión al LLM**
y eligió Administración → Configuración → Inteligencia artificial. La ubicación y
el alcance están confirmados. Luego pidió implementar esta entrega desde la maqueta:
el formato de tres Surface se promovió a `/configuracion/ia`, según el fundamento visual.
Proponer respuestas en el chat queda postergado.

`?screen=ia` usa AppLayout y Sidebar reales. El bootstrap aislado agrega el destino
local `/configuracion/ia` a Configuración, junto a General y Apariencia; no modifica
las rutas ni la navegación productivas. Page, Surface con banda/margen interno,
FormField, Input, NativeSelect y RadioGroupField componen la misma biblioteca.

El formulario tiene proveedor/modelo, clave/prueba y disponibilidad, con un solo
Guardar/Descartar en la cabecera. Modelo usa un identificador ficticio editable:
no afirma un catálogo actual. La credencial se carga como password y no se devuelve
después de guardar. Reemplazar o quitar prepara un cambio; Quitar requiere confirmar,
y Descartar recupera la configuración guardada. Cambiar de proveedor requiere otro
modelo y otra clave, con confirmación cuando hay datos preparados.

Probar muestra un resultado simulado sin guardar. Disponible/Pausada controla la
conexión general propuesta para futuras funciones; no activa respuestas automáticas.
Este paso no configura información del negocio, prompts, fuentes, plantillas ni
límites. La conexión pertenece a la instalación, no a WhatsApp ni a un operador.
Persistencia protegida, permisos, API y adaptadores OpenAI/Anthropic ya están implementados
en el [módulo independiente](../../../ArquitecturaBase/docs/features/inteligencia-artificial.md).
Este texto conserva la simulación del laboratorio, que no conecta con la API real ni se
copia al producto. Las pruebas reales de proveedor y el Artifact externo siguen pendientes.

El selector del arnés muestra carga, sin clave, sin permiso, solo lectura, carga
fallida, prueba fallida y guardado incierto con revisión. Las fallas conservan el
borrador y usan el Toaster común; salir confirma descartar. Solo acepta claves
ficticias `demo-`, sin llamar a un LLM, registrar claves ni persistir secretos.

Chat, General y Apariencia usan sus pantallas productivas con fixtures. La propuesta
anterior de sugerencias se conserva postergada en `?screen=sugerencias`, fuera del
recorrido principal. La carpeta histórica del laboratorio no fija la ubicación de
la futura funcionalidad general en el producto.

Evidencia: `evidence/llm-settings-{es,en}-{1440,390,320}.png`, estado sin clave y
capturas de la parte inferior en móvil. Chromium comprueba reemplazo, quitar,
cancelar/descartar, cambio de proveedor, validación, probar sin guardar, errores,
incertidumbre, permisos, carga y salida hacia General. No acredita un LLM real.
La sincronización del Artifact externo permanece pendiente.

Validación final de esta corrección: TypeScript del laboratorio, build y lint
correctos; 830 tests del front y 72 pruebas visuales existentes en verde, sin
actualizar referencias. La revisión específica del tablero pasó en ambos idiomas,
escritorio y móvil, incluida la llegada al chat real del arnés sin sugerencias.
No se modificó backend ni se levantó Aspire.

## Sugerencias con revisión humana: nueva propuesta — 2026-10-02

El tablero de sugerencias usa `AiReviewChatProposal` y `aiReviewCopy.ts`; la conexión
de IA sigue en `?screen=ia`. El 2026-10-03 se aprobó conservar el diseño y ajustar sólo
Sugerir con IA al verde principal, con historial + información básica del negocio como
contexto. Su integración productiva está pendiente y no modifica `/whatsapp/chat`,
sus endpoints ni el backend. Conserva Campo, Public Sans,
la bandeja y los componentes MessageHistory/MessageBubble ya aprobados.

El recorrido propuesto es Sugerir con IA → revisar la propuesta y su información →
Pasar al borrador → editar → Enviar. La sugerencia aparece junto al editor, separada
del historial; pedirla o usarla no envía un mensaje. Un borrador existente requiere
ConfirmDialog antes de reemplazarlo. Descartar la propuesta conserva lo escrito.
El editor mantiene Enter para nueva línea y Ctrl+Enter para enviar.

La vista de ejemplo pertenece al administrador de una instalación independiente,
con conexión compartida entre operadores; no muestra claves personales ni un
selector de empresas. Los controles del laboratorio permiten revisar IA sin
configurar, fallo, falta de permiso de IA, solo lectura, falta de lectura y ventana
vencida. Sin IA se conserva la respuesta manual cuando hay permiso y ventana.
La definición exacta de los permisos nuevos continúa pendiente del plan backend.

Una generación muestra carga y permite cancelar sin borrar el editor. Se cancela
al cambiar de conversación; los borradores son propios de cada chat y viven solo
en memoria. Si llega otro mensaje, la propuesta se identifica como desactualizada
y requiere generar otra antes de usarla. Las fallas usan el Toaster común y
conservan el borrador; no se muestran como errores de campo.

Martina pregunta por el horario: la maqueta usa horarios ficticios previamente
configurados y muestra esa información al desplegar «Información utilizada».
Federico pregunta por un producto: sin fuente de stock, la propuesta pide nombre
o foto y no afirma disponibilidad. Estos textos son muestras deterministas; no
demuestran razonamiento, búsqueda ni precisión de un proveedor real.
Solo se representa historial de atención; los códigos y eventos de acceso no son
una fuente propuesta para generar respuestas.

Ningún texto de un cliente real está incorporado. La conexión productiva ya permite
configurar proveedor/modelo y probarla; esta muestra de chat sigue usando datos fijos
y no consume esa conexión ni persiste credenciales. Las instrucciones, los límites y
los campos de información del negocio se definirán mediante los casos y la nueva
maqueta de su editor, antes de implementar generación.

Evidencia de esta ronda: TypeScript del laboratorio, build y lint correctos; 72
pruebas visuales existentes en verde, sin actualizar sus referencias. Chromium
comprobó revisión sin envío, edición/envío explícito, reemplazo/cancelación,
conservación de borrador, propuesta desactualizada, fuentes ausentes, permisos y
cancelación al cambiar de chat. Capturas revisadas es/en a 1440, 390 y 320 px en
`design-lab/whatsapp-chat/evidence/ai-review-*.png`, sin errores de JavaScript ni
desborde horizontal. La corrida final general pasó 830 tests en 78 archivos. Una
primera corrida simultánea agotó el tiempo de una prueba de Usuarios; al repetir
la suite completa sin los otros trabajos, pasó sin modificar código ni timeouts.

La procedencia del Artifact y la biblioteca externa se conservan. Este es el
tablero local de revisión; no se acredita sincronización de los Artifacts privados.
El plan del 2026-10-03 registra el árbol propuesto front/back, responsabilidades,
contratos y pruebas. Primero se elige la maqueta de Información del negocio y se
cierra su alcance; después se integra generación.

## Procedencia y forma de revisarla

Referencia local: `../../../ArquitecturaBaseMutitenantFront/docs/design/lienzo/`:
`WA-Chats.dc.html`, `M-WA-Chats.dc.html`, `M-WA-Conversacion.dc.html`,
`M-WA-24h.dc.html` y `WA-Contacto.dc.html`. Esos tableros son una propuesta en
Multitenant, no evidencia de una bandeja ya implementada.

Se toma la organización de los chats; se mantienen Jade, Public Sans, AppLayout,
Page, Surface, FilterBar, campos, diálogos, tooltips y notificaciones de esta base.
Entrada local aislada: `design-lab/whatsapp-chat/index.html`, con `?lang=en` para inglés.
Ejecutar `npm run dev -- --host 127.0.0.1 --port 5181` y abrir
`http://127.0.0.1:5181/design-lab/whatsapp-chat/`.

La arquitectura del front permite fuentes locales operativas cuando el Artifact
privado requiere sesión. Esta revisión se conserva en el laboratorio local, como
la propuesta de Configuración. **No se modificó ni sincronizó el Artifact externo**;
Contactos, IA, Plantillas y Conexión siguen pendientes de elección/promoción según el fundamento
visual. La elección del chat y el panel compartido ya se aplicaron al producto; no se importa
el layout temporal del laboratorio desde una ruta productiva.

## Recorrido dibujado

Este apartado conserva la maqueta original, incluida la activación del bot y su teclado.
El producto actual usa Manual por defecto, solo permite tomar Manual desde Bot legado,
envía con Ctrl+Enter o el botón y agrega líneas con Enter. Hereda Campo del tema global;
Jade identifica la apariencia original del laboratorio. El resto de los destinos no se promovió.

WhatsApp abre su propio panel secundario, como Administración, con **Chats, Contactos,
Plantillas, Inteligencia artificial y Conexión de WhatsApp**. Solo se abre un panel
por vez; en móvil se despliega dentro del cajón. Administración conserva su entrada
separada y muestra una vista simulada de los permisos de WhatsApp en Roles y permisos.
Todos estos destinos son prototipos aislados: los menús futuros de producto se
habilitan por permisos y por entrega implementada, sin copiar todo el laboratorio.

La composición del menú vive temporalmente en `PanelProposalLayout.tsx` del laboratorio,
con el Topbar real y las mismas medidas y tokens del Sidebar. Al promover la decisión,
el layout productivo deberá soportar paneles compartidos; no se copiará un Sidebar
por módulo. El chat sigue montado al abrir/cerrar paneles, conservando sus borradores.

- Bandeja por última actividad, búsqueda por nombre/número, Todos/Sin leer y conteos.
- Hilo con entrantes, salientes y mensajes del sistema distinguidos; hora, autor y
  entrega con texto. Un envío aceptado queda pendiente, no se presenta como entregado.
- Respuesta de texto, envío explícito o Enter; Shift+Enter agrega una línea. Borradores
  por contacto en memoria al cambiar de conversación. No se borra el borrador al fallar.
- Modo bot/manual por chat con confirmación, borrador conservado y controles de lectura.
  Bot activo se refiere al bot existente, no a envío autónomo del LLM.
- Sugerencia de IA separada del borrador: generar no envía ni reemplaza texto. Agregar
  preserva el texto escrito y permite revisar antes del envío manual. Falla o falta
  de conexión no impiden responder manualmente. Cambiar de chat cancela la generación.
- Un mensaje entrante de prueba mueve a Federico al inicio y actualiza sus no leídos.
- Ficha en Dialog: nombre de WhatsApp, número cuando existe y cuenta vinculada cuando
  existe. No se asume que todo contacto tenga cuenta, correo o número.
- Carga, vacío inicial, sin coincidencias con limpiar filtros, error con reintento,
  lectura sin envío, sin permiso y canal apagado, seleccionables para revisar.
- Javier muestra ventana vencida y no ofrece texto libre. No hay una plantilla de
  atención implementada: su selector y envío quedan fuera de esta primera maqueta.
- Fallo de envío conserva texto; envío incierto bloquea repetir y ofrece revisar.
  El aviso operativo usa el Toaster común. Validación local junto al mensaje.
- Historial anterior incluye texto eliminado por retención. Nunca inventa un cuerpo
  para una fila cuyo texto ya se borró ni expone códigos/enlaces de ingreso.
- En móvil: bandeja → hilo → ficha en diálogo, con vuelta a la misma bandeja.

La ventana de atención se calcula en el servidor a partir del último entrante;
las fechas y plazos de la maqueta son ficticios. Referencia técnica:
[documentación de Meta sobre estados y ventana de atención](https://www.postman.com/meta/whatsapp-business-platform/folder/fuaee8l/statuses-object).

## Alcance confirmado y trabajo técnico pendiente

Este inventario describe la ronda original. Texto/ficha, permisos, sin leer por operador,
paginado, salida durable, revisión de incertidumbre y coordinación real ya están implementados
y probados con PostgreSQL/Redis y Meta simulado. La [evidencia del refactor](../../../ArquitecturaBase/docs/reviews/2026-10-02-separacion-acceso-whatsapp-validacion.md)
separa esa verificación de la prueba con teléfono real todavía pendiente. Los controles Bot
del prototipo no son una capacidad vigente del producto. Las extensiones de atención y los
demás destinos conservan sus entregas propias.

1. Primera versión de texto y ficha; adjuntos, audios, notas, asignaciones y plantillas
   de atención requieren recorridos propios si se incluyen en el alcance.
2. Modo bot/manual confirmado y representado con su decisión explícita. Falta implementar
   coordinación real del bot, despacho y cambios concurrentes; la UI no acredita locks.
3. Sin leer por operador confirmado. La matriz distingue lectura/envío/contactos/uso
   de IA y configuración; falta autorización real y exposición de cuenta bajo users.read.
4. Persistencia durable e idempotencia de envíos manuales. La cola actual es en memoria;
   mostrar aceptado, entregado y fallo requiere distinguir etapas y revisar resultados
   inciertos antes de repetir. No alcanza con poner un formulario sobre esa cola.
5. Actualización de entrantes/estados entre hosts, paginado del historial, orden estable
   y política de retención. Resolver el transporte en el plan sin violar las capas.

En producto, conversación seleccionada, búsqueda y filtro viven en URL; el borrador
vive en memoria. El laboratorio usa un router en memoria y estado local completo;
no acredita paginado, autorización, sincronización ni persistencia de producción.

## Plan de desarrollo

### Conexión al LLM: maqueta solicitada el 2026-10-01

Entrada directa: `http://127.0.0.1:5181/design-lab/whatsapp-chat/?screen=ia`,
y `&lang=en` para inglés. El panel WhatsApp agrega **Inteligencia artificial**
solo en el laboratorio. `AiConnectionProposal.tsx` compone Page, Surface padded,
FormField, NativeSelect, Input, ConfirmDialog y notificaciones
comunes. Conserva tema, densidad y navegación; no agrega una ruta productiva.

Corrección del 2026-10-02: se retiró la separación **Del negocio / Mi conexión**,
que mezclaba alcance de credenciales con roles y confundió al usuario. Se muestra
un formulario común **Conexión de IA**, con consulta/edición según permiso. No
representa una configuración personal obligatoria por operador. El alcance actual
es una configuración compartida por instalación y sugerencias con revisión humana;
el proveedor/modelo y las fuentes siguen pendientes de elección.

Muestra proveedor y modelos ilustrativos, clave configurada sin revelar su contenido,
reemplazo/quita, prueba con confirmación del consumo posible, habilitación y estado
guardado. Se retiraron las tarjetas de uso, enrutamiento y pago, y el límite mensual
propuesto. Cambiar proveedor confirma
que la clave anterior no corresponde al nuevo; requiere configurar otra y deja el
borrador deshabilitado. Quitar clave requiere confirmar y guardar. La guarda común frena abandonar la
pantalla con cambios. Guardar y probar son simulados, sin API ni llamadas al LLM.
No se calcula un costo real ni se afirma que limitar respuestas fija un gasto monetario.

Alcance aclarado el 2026-10-02: plantilla que se clona para instalarse por separado
en el servicio propio, La Clementina u otro negocio. Cada copia tiene su administrador,
datos, WhatsApp e IA propios. Solo la cuenta administradora configura canal/IA; operadores
atienden el WhatsApp compartido con permisos acotados. No se requieren claves ni
números propios por operador. La pantalla común sigue siendo una maqueta; falta
elegir proveedor y fuentes. El usuario confirmó sugerencias con revisión y envío
humano el 2026-10-02. El plan compartido contempla recursos/configuración independientes,
funciones del negocio en el derivado y traslado de mejoras comunes desde la base;
la preparación de una copia todavía no se verificó. No incluye multitenancy ni alta
de empresas en una plataforma compartida.

Selector de escenarios: configurada, sin clave, solo lectura, sin permiso,
carga fallida, proveedor sin respuesta y guardado incierto. El
incierto bloquea otro guardado y permite revisar antes de decidir. Error y recuperación
preservan el borrador; feedback operativo en un único Toaster. Claves de ejemplo
`demo-` en memoria, input password limpiado después del guardado simulado.

Evidencias de la corrección en `design-lab/whatsapp-chat/evidence/ai-connection*.png`:
formulario común, inglés y móvil de 390/320 px. Recorrido Chromium verifica reemplazo,
prueba/guardado, cambio de proveedor, quita, validación, fallo/resultado incierto,
recuperación, permisos y guarda de salida, sin errores JavaScript ni desborde horizontal.
TypeScript del laboratorio, build y lint limpios en la corrección (lint incluye
38 pruebas de arquitectura). Las capturas anteriores `ai-business.png` y
`ai-personal.png` documentan la propuesta retirada. La revisión anterior tuvo build,
lint, 780 tests y 39 controles visuales en verde, sin actualizar sus capturas; esa
corrida no verifica la corrección posterior. La maqueta no acredita integración ni
almacenamiento seguro de secretos en producción.

El usuario pidió el plan el 2026-10-01 y confirmó **sin leer por operador** y
**modo bot/manual por chat**. El [plan único de ambos repositorios](../../../ArquitecturaBase/docs/plans/2026-10-01-bandeja-whatsapp.md)
detalla inventario reutilizado, árboles de carpetas, responsabilidad de cada archivo,
contratos HTTP, permisos, persistencia durable, pruebas y entregas. Es una propuesta
de implementación; no se crearon carpetas ni archivos productivos vacíos.

Su ampliación del 2026-10-02 añade archivos/responsabilidades de IA y plantillas, la
matriz de permisos de atención/configuración y preparación de proyectos derivados
con instalación propia. Contactos tiene permiso propio; configurar IA y utilizarla
son capacidades distintas. Los usuarios de una instalación atienden su canal según
permisos; otra empresa se instala por separado. Se retiró la propuesta de SaaS central
según la última aclaración del usuario.

El control de modo y su confirmación están en la ronda final. Contactos tiene su
listado y recorrido de ficha/chat. Su elección visual y el desarrollo real siguen
pendientes; plantillas y diagnóstico del canal conservan sus entregas posteriores.

## Ronda final para revisar (2026-10-02)

| Entrada `?screen=` | Recorrido local |
| --- | --- |
| Sin parámetro / `chats` | Bandeja, lectura, hilo, ficha, modo y sugerencia de IA con revisión humana. |
| `contactos` | Listado, búsqueda/filtro por cuenta, vacío/error/denegado, ficha y Abrir chat del contacto seleccionado. |
| `plantillas` | Ejemplos de aprobada/en revisión/rechazada, filtros, vista previa y creación simulada con variables/ejemplos. Crear deja En revisión; no hay envío ni aprobación real. |
| `ia` | Perfil único compartido, proveedor/modelo ilustrativos, clave demo, prueba, habilitación e información autorizada de ejemplo. Solo el administrador configura. |
| `conexion` | Número/estado/credencial ocultada, revisión simulada y pasos de configuración asistida. Valores de despliegue de solo lectura; no se promete edición en caliente. |
| `permisos` | Administración → Roles y permisos: ejemplos Admin/Atención/Consulta, permisos dependientes, guardar/descartar y guarda de salida. No modifica roles reales ni cambia los permisos de otras pantallas del laboratorio. |

La información de negocio del formulario es ilustrativa y los resultados del LLM
son textos de ejemplo; no hay generación real ni conexión entre el contenido editado
y el proveedor. Cada instalación tiene sus propios datos y conexión. No hay selector
de empresas ni claves personales en esta propuesta.

Nuevos componentes locales: `ContactsProposal`, `TemplatesProposal`, `ConnectionProposal`,
`AccessProposal`, `AiSuggestionProposal`; datos ficticios en `proposalContacts.ts` y
textos es/en en `finalCopy.ts`. Se componen Page, Surface, tabla/casillas, campos,
diálogos y notificaciones reales. Mantenerlos fuera del build/router productivos.

Verificación de esta ronda: TypeScript del laboratorio y build limpios; lint limpio
con 38 pruebas de arquitectura; 780 tests y 39 controles visuales del front en verde,
sin actualizar sus capturas. Chromium verifica generación sin envío, borrador
conservado, modo, restricciones, contacto→chat, revisión/cancelación de plantilla,
diagnóstico y permisos. Evidencias `evidence/final-*.png` en escritorio y 320 px;
recorridos de los seis destinos en inglés. La evidencia no acredita API, LLM, permisos
del backend, persistencia ni instalación de un clon.

## Referencia para la implementación

Tras elegir el diseño: inventario de piezas existentes/reutilizadas/nuevas; árbol
`src/features/whatsapp` en el front y `Modules/WhatsApp` por capa en el backend;
responsabilidad de cada archivo, contratos MVC → servicios → puertos → Infrastructure
y tests. No crear archivos vacíos por simetría. Luego plan con TDD, migraciones si
corresponden, integración con PostgreSQL/Redis reales y comprobación de ambos builds.

## Verificación de esta maqueta

Primera revisión: TypeScript del laboratorio limpio; build y lint del front limpios; 745 tests y
25 comprobaciones visuales existentes en verde (sin actualizar sus capturas).
Recorrido con Chromium: respuesta, borradores entre contactos, fallo con conservación,
envío incierto y revisión, filtros y recuperación, lectura restringida, ficha sin número,
escritorio, móvil de 390/320 px e inglés. Sin errores de JavaScript ni desborde horizontal.
Las capturas revisadas viven en `design-lab/whatsapp-chat/evidence/`.
Estas comprobaciones usan datos ficticios y no validan la integración con Meta.

Revisión del menú: TypeScript, build y lint limpios; recorridos de chat y navegación
del laboratorio verificados en Chromium, incluidos paneles excluyentes, conservación
de borrador al alternarlos, cierre, menú contraído y cajón móvil. Captura móvil en
`evidence/mobile-menu.png`. La nueva ejecución general observó 3 fallos en los tests
de Apariencia y 28 fallos visuales: durante esa corrida se agregó una ruta que importaba
AppearancePage antes de existir el archivo. Son cambios externos a este laboratorio;
no se declara la suite general en verde ni se modifican sus capturas para ocultarlo.
