# Fundamento visual de ArquitecturaBaseFront

## Formularios por WhatsApp: tableros elegidos — 2026-10-08

El usuario eligió los doce tableros de la página «Formularios por WhatsApp» del Artifact del sistema visual: la
historia completa (diseñar, publicar, completar por WhatsApp, respuestas, aprobación, PDF y versiones) y la Etapa 1
(el editor y su conexión con el chat existente). Pidió implementarlos tal cual y empezar por la Etapa 1. Reemplazan,
como referencia de pantallas, la maqueta aislada del plan de formularios del 2026-10-07/08, que queda como procedencia.
Están dibujados a mano con Campo y Public Sans porque la biblioteca del lienzo sigue sin sincronizar. Capturas,
decisiones, alcance de la Etapa 1, correspondencia con `shared/ui` y pendientes: [formularios-whatsapp.md](formularios-whatsapp.md).
Sin implementación todavía.

## Inicio: panel interno de conversaciones elegido — 2026-10-05

Por pedido del usuario se implementa un panel claro plegable dentro del marco del chat aprobado,
con Nueva conversación, listado propio por Hoy/Ayer/Anteriores, selección y borrado confirmado.
El refinamiento pedido después usa primitivas nativas ThreadList/Item/More de assistant-ui:
256 px, filas de una línea, fechas sólo en los grupos y menú «…» en hover/foco o siempre en táctil.
Es una adaptación de esa biblioteca; no se acredita usar el componente interno de Codex/Claude.
Inicio abre vacío; una conversación anterior se recupera al elegirla. En móvil, Dialog compartido
como panel superpuesto. AppLayout, Page y AssistantThread/Composer/Message reales conservan
Campo/Public Sans y la composición assistant-ui corregida; no se reutiliza el formulario rechazado.
El panel refinado fue elegido explícitamente y promovido a la pantalla productiva. El [tablero histórico](../../design-lab/history/home-assistant-conversations-2026-10-05/README.md) conserva sus datos ficticios y evidencia de procedencia como archivo inactivo. Las referencias productivas viven en `src/test/visual/screenshots/assistant-conversations-*.png` y `assistant-*.png`.
El [plan entre proyectos](../../../ArquitecturaBase/docs/plans/2026-10-04-panel-conversaciones-inicio.md)
detalla archivos, título autorizado, paginado, privacidad, idioma/zona/timer y capacidad por empresa.
**Elección y promoción realizadas el 2026-10-05.** Se conserva el marco de chat aprobado, con título autorizado desde el backend y confirmaciones existentes. El Artifact privado no se declara sincronizado.

## Places en Información del negocio — 2026-10-04

Pedido explícito de integrar el buscador de Google: Autocomplete compartido sobre Input/tokens,
nombre/ciudad → sugerencia → enlace a ficha completa, sin modal pequeño de coordenadas.
Dirección manual antes de buscar; selección prepara borrador y Guardar confirma PlaceId.
Campo, Public Sans, Page y Surface conservados. Atribución Google Maps junto al contenido;
carga/vacío en status, error operativo en Toaster único, cooldown sin reintento automático.
Sugerencias sólo en editor. Prueba real y Términos/Privacidad pendientes por instalación:
[operación](../../../ArquitecturaBase/docs/guides/configurar-google-places.md).

## Inicio: composición assistant-ui corregida — 2026-10-04

El usuario eligió assistant-ui tras comparar las cuatro bibliotecas. La primera integración
funcional recompuso el chat como formulario y fue rechazada explícitamente. Se corrige tomando
como contrato las capturas originales assistant-ui-empty/answer de
design-lab/history/home-assistant-comparison-2026-10-04/evidence, conservadas como procedencia.
No tomar chosen-board ni una captura de la implementación rechazada como nueva aprobación.
El marco ocupa el contenido de Page; hilo/editor de 672 px dentro de una columna de 704 px,
bienvenida/editor centrados en vacío y sugerencias debajo; editor al pie al conversar.
Editor redondeado con envío por flecha, burbuja propia y respuesta de lectura sin tarjeta.
Disponibilidad junto al editor, sin panel exterior. Campo/Public Sans y el caparazón se conservan.
Los controles sin función productiva (adjuntos/regeneración) no se ofrecen.
El [plan entre proyectos](../../../ArquitecturaBase/docs/plans/2026-10-04-inicio-asistente.md)
define los árboles de archivos, ExternalStoreRuntime sobre API MVC/estado durable, permisos,
es/en, UTC/TimeProvider, zona del perfil, timer compartido, fuentes, recuperación y verificaciones.
El contrato se implementa en shared/ui/assistant e index.css, con Page viewport sólo para esta vista.
Las verificaciones y límites están en el [registro de corrección](../verification/inicio-asistente-correccion-2026-10-04.md).
Las propuestas manuales y la comparación siguientes conservan procedencia; no reemplazan la elección.

## Bibliotecas para el chat de WhatsApp: comparación local — 2026-10-04

El usuario rechazó las adaptaciones y después Chatscope/Syncfusion nativos porque
perdían la identidad del chat. La tercera ronda, `design-lab/whatsapp-chat/libraries/shapes.html`,
usa WhatsAppChatPage real y compara burbujas Actuales/Redondeadas: sólo radio/punta,
con la misma paleta Campo, Public Sans, densidad, bandeja, metadata, acciones y editor.
La forma se inspira en Chatscope, sin montar su widget ni cargar sus estilos. Los
providers/hooks originales usan fixtures ficticios; operaciones/borradores en memoria.
Las entradas anteriores conservan la procedencia rechazada y el aviso original de
evaluación de Syncfusion. Package/lockfile propios, sin cambios en el chat productivo.
Ninguna vista fue elegida ni promovida. Sincronización del Artifact pendiente:
[diseño y evidencia](whatsapp-bibliotecas-propuesta.md).

## Inicio: cuatro bibliotecas de chat en comparación — 2026-10-04

El usuario rechazó la propuesta manual de Inicio y pidió maquetar assistant-ui, AI Elements,
CopilotKit y ChatKit. `design-lab/home-assistant/libraries/` muestra sus componentes reales en
el caparazón Campo/Public Sans, con datos ficticios, vacío/conversación, envío y es/en. La entrada
anterior redirige al comparador en 5184. Sus formas propias se comparan sólo en el laboratorio;
ninguna biblioteca o pantalla se promovió. Dependencias y lockfile aislados, sin generación real.
48 combinaciones del tablero y recorridos en las cuatro pasaron; producto: build/lint, 949 pruebas
y 116 visuales en verde. Fuentes, límites del iframe externo, tamaño y pendientes en el
[diseño actualizado](inicio-asistente-propuesta.md#comparación-de-bibliotecas--pedido-posterior-del-2026-10-04).

## Inicio con asistente: propuesta local — 2026-10-04

Por pedido del usuario se estudió el Inicio autenticado como chat con el LLM configurado y
consultas del sistema. El tablero aislado en `design-lab/home-assistant/` compone AppLayout,
Page y controles reales con Campo/Public Sans, datos ficticios y estados es/en. Propone
chat centrado, historial propio a demanda y fuentes junto a cada respuesta. No se modificó
la pantalla productiva ni se conectó generación. En ese estudio quedaron pendientes preguntas,
alcance, retención y elección; assistant-ui se eligió después, como se registra arriba.
El Artifact privado no pudo leerse mediante web;
esta ronda no acredita su sincronización.

El enmarcado inicial con banda Conversación fue rechazado al pedir las bibliotecas.
El diseño elegido mantiene el marco discreto de assistant-ui; sigue sin instalar/promover en producto.

[Diseño y recorrido](inicio-asistente-propuesta.md),
[plan técnico](../../../ArquitecturaBase/docs/plans/2026-10-04-inicio-asistente.md) y
[primera consulta](../../design-lab/home-assistant/evidence/empty-es-1440.png).

## Selector de modelos de IA — 2026-10-04

Por pedido del usuario, la pantalla existente `/configuracion/ia` consulta modelos de OpenAI
y Anthropic/Claude con la clave guardada o candidata y los presenta en NativeSelect. Cargar/
Actualizar modelos y la entrada manual componen Button/Input comunes; se conservan las tres
Surface, Campo/Public Sans y el guardado/prueba separados. La lista no elige un modelo por
defecto ni cambia uno guardado fuera del catálogo. Carga/vacío/cooldown y errores conservan
el borrador y usan los canales compartidos. La disponibilidad no acredita compatibilidad:
Probar conexión sigue verificando el ID elegido. Catálogo local con claves/modelos ficticios;
acceso real de las cuentas y sincronización del Artifact externo siguen pendientes.

Verificación final: build/lint limpios, 940 pruebas Vitest y 116 recorridos Playwright en verde.
Se revisaron y actualizaron sólo las seis referencias de IA es/en a 1440/390/320 px. El backend
pasó 2175 pruebas con Docker y build sin advertencias, con salida aislada porque Visual Studio
tenía la API abierta. Un timeout inicial de la portada pasó al repetir sus siete casos y la suite
visual completa. No se levantó Aspire ni se interrumpió la sesión de desarrollo existente.

## Ubicación, horarios y FAQ guiados: promovidos — 2026-10-03

Por autorización explícita del usuario se implementó el editor elegido en la página real
`/configuracion/negocio`, conservando Campo/Public Sans, Page/Surface y controles comunes.
Leaflet/OSM reemplaza el dibujo ficticio: navegar, marcar o ingresar coordenadas genera el
enlace. Dirección manual, sin búsquedas simuladas; confirmar prepara el borrador y Guardar
persiste con revisión/comprobante. Horarios, fechas especiales y FAQ tienen validación real.
Los textos anteriores quedan para revisión manual, sin conversión automática.

Se revisaron las seis nuevas referencias es/en a 1440/390/320 antes de actualizarlas.
El catálogo prueba la página productiva con dobles de sesión/API/teselas; Docker acredita la
migración y el guardado. También se comprobó la carga de OSM y la selección en navegador real.
[Detalle y evidencia](../../../ArquitecturaBase/docs/reviews/2026-10-03-informacion-del-negocio-guiada.md).
La sección siguiente conserva la propuesta previa como procedencia. Su entrada ahora redirige
al catálogo real; envío por WhatsApp y sincronización del Artifact privado siguen pendientes.

## Ubicación, horarios y FAQ guiados: propuesta local — 2026-10-03

Por pedido del usuario, `?screen=negocio-guiado` ofrece un tablero adicional sin
reemplazar `?screen=negocio` ni el editor productivo de siete textos. Conserva Campo,
Public Sans y los componentes compartidos. Ubicación permite elegir un punto ficticio
y preparar su enlace; la aclaración del usuario descarta exigir una integración específica
con Google Maps. Generar [Maps URLs](https://developers.google.com/maps/documentation/urls/get-started)
no requiere clave de Google; el mapa ilustrativo no acredita búsqueda o selección reales.
Los horarios tienen estados por día, franjas con opciones, cruces explícitos de medianoche
y validación de superposiciones. Las FAQ proponen preguntas editables y respuestas vacías.
Guardar confirma únicamente el estado en memoria; enviar desde WhatsApp sigue pendiente.

[Diseño y evolución de contratos](informacion-del-negocio-guiada.md),
[vista general](../../design-lab/whatsapp-chat/evidence/business-guided-overview-es.png),
[selector ilustrativo](../../design-lab/whatsapp-chat/evidence/business-guided-location-es.png)
y [preguntas frecuentes](../../design-lab/whatsapp-chat/evidence/business-guided-faq-es.png).
El selector real, la persistencia estructurada, la migración del contenido existente
y la sincronización del Artifact privado no se implementaron en esta ronda.

## Inicio, separación de navegación y autocompletado de IA — 2026-10-03

El usuario pidió el ícono de Inicio también en el menú expandido y una línea antes
de WhatsApp con el mismo borde de Administración. Se usa el HomeIcon existente;
la línea aparece sólo cuando hay un ítem de WhatsApp visible, incluido el menú móvil.

La captura de IA mostraba credenciales de ingreso en Modelo y Clave por autocompletado
del navegador. Los campos ahora tienen nombres técnicos independientes, Modelo usa
`autocomplete="off"` y el reemplazo de clave `autocomplete="new-password"`, según
[MDN](https://developer.mozilla.org/en-US/docs/Web/Security/Practical_implementation_guides/Turning_off_form_autocompletion).
Una conexión sin configurar empieza con ambos campos vacíos; un modelo ya guardado
sigue siendo metadato visible y la clave guardada nunca se devuelve al navegador.
La conducta con credenciales realmente guardadas en el Chrome del usuario queda pendiente:
los atributos son orientaciones al gestor y no garantizan su comportamiento.

Build productivo, tipos del laboratorio y lint en verde. La suite Vitest final pasó
902 pruebas en 85 archivos con cuatro workers; una ejecución anterior bajo carga
concurrente agotó el timeout de una comprobación AST, sin modificar sus límites.
Playwright completo pasó 103 casos, incluidas regresiones de login, chat, roles y
configuración y la propuesta guiada en español/inglés a 1440/390/320 px. Después de
ajustar la geometría final del panel semanal se repitieron sus seis casos, también verdes.
Las pruebas usaron datos ficticios y dobles, sin claves reales ni servicios facturables.
Se revisaron y actualizaron sólo las dos referencias de chat de escritorio afectadas.
No hubo cambios ni una nueva ejecución de tests del backend en esta ronda; no se levantó Aspire.

## Roles: botón para abrir y plegar todas las áreas — 2026-10-04

Por pedido del usuario, PermissionPicker reemplaza los dos enlaces pequeños por un
único Button outline con ChevronDownIcon, Expandir todo/Contraer todo y estado accesible.
Con algunas áreas cerradas ofrece expandir; con todas las visibles abiertas ofrece
contraer. Incluye todas las áreas del catálogo, sin nombres fijos ni cambios de permisos.
Admin puede usarlo para revisar. Una búsqueda/filtro nuevo abre los resultados; el
botón y cada encabezado pueden plegarlos inmediatamente después. Sin coincidencias
el botón queda deshabilitado. Se revisó y actualizó sólo la referencia del editor a 320 px;
la de 1440 pasó sin actualización. Cobertura en PermissionPicker y role-groups.spec.ts.

## Propuesta de ubicación por ficha de Maps — 2026-10-04

El usuario rechazó la usabilidad del modal de coordenadas y pidió un diseño para
aprobar antes de cambiar el producto. La propuesta `?screen=ubicacion-lugar` usa el
nombre del lugar, búsqueda en Google Maps en otra pestaña y enlace copiado de su ficha,
con comprobación y vista previa dentro de la página. Nombre/dirección son manuales.
No hay importación de datos ni selección automática por búsqueda; guardado en memoria.
El mapa completo queda en Google Maps. Esta propuesta sigue pendiente de elección y
no sustituye todavía el editor productivo. [Diseño y límites](ubicacion-por-lugar.md).

## Roles: encabezados de área diferenciados — 2026-10-03

El usuario aclaró que Usuarios, Roles, Configuración, WhatsApp e Inteligencia artificial
deben tener color en su encabezado de área. Los permisos individuales permanecen blancos.
TableRow tone="section" usa los tokens table-section/table-section-foreground: Campo suave
inicial y tono derivado de la cabecera guardada en Apariencia, con contraste comprobado.
El aspecto no depende de que el área esté abierta y el encabezado principal es más marcado.
Esta aclaración reemplaza la elección inicial de áreas blancas registrada debajo.

[Captura con datos simulados](../../design-lab/whatsapp-chat/evidence/roles-area-headings-es.png)
y [verificación y diagnóstico de Redis](../../../ArquitecturaBase/docs/reviews/2026-10-03-roles-y-arranque-redis.md).

## Información del negocio y filas de Roles: promovidas — 2026-10-03

El usuario pidió implementarla en la aplicación real después de revisar la maqueta:
menú, permisos de lectura/administración, editor y persistencia independientes en
/configuracion/negocio. Se conservan los siete campos, las tres superficies y los
componentes existentes. El bootstrap/escenarios/datos ficticios no se promueven.
Guardar prepara hechos; las sugerencias todavía no están implementadas.

La ronda inicial dejó uniforme el cuerpo de la tabla de permisos de Roles. La aclaración
posterior sobre color de los encabezados de área está arriba; los permisos individuales
siguen blancos. Otros listados conservan su apariencia; hover/foco y controles siguen la biblioteca.

Build/lint y 886 tests del front en verde. Playwright completo: 95/95, con la nueva
página es/en a 1440/390/320 px, permisos, recuperación y regresiones login/chat/roles/
configuración. Las diferencias antiguas de Usuarios ya no fallan en el código actual;
esta entrega no actualizó sus referencias. Capturas y [evidencia](../../../ArquitecturaBase/docs/reviews/2026-10-03-informacion-del-negocio.md).
La sincronización del Artifact privado y el reinicio de la API abierta en Visual Studio
siguen pendientes; el catálogo usa datos ficticios para mostrar las páginas reales.

## Información del negocio: propuesta local — 2026-10-03

Registro de la ronda inicial; la promoción y verificaciones posteriores están arriba.

Por pedido del usuario, `?screen=negocio` en `design-lab/whatsapp-chat/` maqueta el
contexto elegido para sugerencias: historial + información básica del negocio.
Propone un destino propio de Configuración, separado de las credenciales de IA.
Compone AppLayout, Page, Surface, FormField, Input/Textarea, tabla y ConfirmDialog
existentes; conserva Campo, Public Sans y controles compactos. Tres superficies:
datos/atención, servicios/condiciones y preguntas frecuentes. Estados y guardado
son simulados; su elección e implementación productiva siguen pendientes.
Recorrido y verificaciones en la
[propuesta local](whatsapp-chat-propuesta.md#información-del-negocio-propuesta-local--2026-10-03),
incluidas dos diferencias pendientes en capturas generales de Usuarios.
El tablero local no acredita sincronización del Artifact privado.

## Conexión LLM general: promovida al producto — 2026-10-02

El usuario confirmó primero configurar la conexión en Administración →
Configuración → Inteligencia artificial y pidió implementar la entrega desde la maqueta
local. Esta instrucción resuelve el estado anterior de forma pendiente: se promueven sus
tres superficies con los componentes existentes, conservando las decisiones de producto.
`?screen=ia` en el laboratorio compone AppLayout y Sidebar reales, Page con
Guardar/Descartar y tres Surface como Configuración: proveedor/modelo,
clave/prueba y disponibilidad. Se conservan Campo, Public Sans y las medidas.
No configura conocimiento del negocio ni respuestas. La propuesta de sugerencias
queda postergada en `?screen=sugerencias`; el chat principal usa su pantalla real
con datos ficticios. `/configuracion/ia` ya configura y prueba OpenAI/Anthropic mediante
los contratos del módulo independiente. El laboratorio conserva su simulación como
referencia sin versionar y los otros alcances pendientes; su bootstrap no entra al producto.
Playwright protege 1440/390/320 px en español/inglés con datos inventados y capturas revisadas.
Las nuevas referencias están en `src/test/visual/screenshots/ai-*.png`.
Detalle en la [propuesta](whatsapp-chat-propuesta.md#configuración-llm-general-alcance-corregido--2026-10-02).
La biblioteca externa conserva su sincronización pendiente.

## Sugerencias de IA para el chat: propuesta local — 2026-10-02

Se agregó un tablero interactivo de revisión humana en `?screen=sugerencias` del
laboratorio `design-lab/whatsapp-chat/`. Conserva mensajes, campos, Surface, diálogos y
colores Campo; propone solicitar, revisar fuentes, pasar al borrador, editar y enviar.
El 2026-10-03 el usuario aprobó diferenciar únicamente Sugerir con IA con Button principal
verde, conservando el diseño previo; se descartaron el acento azul y cambios del panel.
Eligió historial + información básica del negocio, con su editor maquetado primero.
Generación e información productivas siguen pendientes del
[plan actualizado](../../../ArquitecturaBase/docs/plans/2026-10-03-sugerencias-ia-whatsapp.md).
El tablero sigue ficticio; la aprobación del botón no implementa permisos ni fuentes.
Recorridos, estados y evidencia en la [propuesta de WhatsApp](whatsapp-chat-propuesta.md#sugerencias-con-revisión-humana-nueva-propuesta--2026-10-02).
La sincronización con el Artifact externo sigue pendiente.

## Landing pública con nota de campo — 2026-10-02

El usuario aprobó en este chat la maqueta `landing-campo.html` y pidió integrarla.
Esta elección reemplaza únicamente la portada vacía de `/`: blanco predominante,
cabecera verde clara, curvas suaves de campo al pie del bloque principal, tres capacidades
genéricas y la marca de ejemplo «Tu organización». Public Sans, botones comunes y selector
de idioma conservan el sistema existente. Iniciar sesión es la acción principal; Crear una
cuenta aparece únicamente si el servidor habilita el registro. Con sesión se conserva el tablero.

`WelcomePage` compone `PublicLanding` de la biblioteca compartida y `AuthLayout` aporta
marca, navegación y pie. Los roles `public-*` viven en `src/index.css`; los verdes suaves
se derivan del encabezado de la paleta global, sin ignorar la configuración de Apariencia.
Los textos de portada y marca están en `auth.json`, en español e inglés.
Ingreso, registro y código conservan sus formularios y geometría anteriores.

El mismo pedido quita del chat las leyendas del atajo y del intervalo de actualización.
Se conservan Ctrl+Enter, Enter para nueva línea, polling de cinco segundos y el estado de fallo.
La sincronización del Artifact externo sigue pendiente; la aprobación de la maqueta local
y el pedido explícito precedieron a la implementación.

Evidencia: [escritorio](../../src/test/visual/screenshots/landing-es-1440.png) y
[320 px](../../src/test/visual/screenshots/landing-es-320.png), además de inglés y 390 px.
La suite visual completa pasó sus 66 casos; después se comprobó también el contraste de
la marca con un encabezado personalizado oscuro, con los siete casos de `landing.spec.ts`
en verde. Las capturas móviles del chat se actualizaron tras revisar la eliminación de las
leyendas. Build y lint limpios; 829 pruebas del front y 2057 del backend, incluida integración
con PostgreSQL y Redis. No se levantó Aspire.

## Contraste de mensajes y refactor del chat — 2026-10-02

El usuario eligió distinguir recibidos y enviados, con hora/estado fuera de la burbuja, y
pidió integrar mediante un refactor que respete las premisas. `/whatsapp/chat` usa ahora
`MessageHistory`, `MessageBubble` y `MessageDateDivider` de la biblioteca compartida;
el catálogo muestra las mismas piezas. No importa código ni CSS del laboratorio retirado.

Los tokens `message-*` de `src/index.css` definen fondo cálido `#F0ECE4`, recibidos blancos,
salientes `#D9EFCD`, contenido `#203227`, metadatos `#526258` y lectura azul `#126A85`.
Fallo e incertidumbre usan los roles semánticos existentes. Se conservan Campo, Public Sans,
controles, radios, menú y composición de la aplicación. Las variantes de mensajes son roles
del sistema visual, independientes de los cuatro colores editables de navegación/apariencia.

La feature adapta los contratos a una línea de tiempo ordenada por instante e identidad,
mezclando historial y operaciones. Agrupa fechas por día del perfil; el formato vive en
`shared/lib/dateTime`. Bot, Vos y Operador salen de la autoría disponible en la API.
Cola/envío, aceptación, entrega, lectura, fallo, incertidumbre y revisión se distinguen
con ícono y texto. Un estado desconocido se informa sin inventar una aceptación.

Consulta/lectura, acciones y viewport tienen hooks separados. Cargar páginas y recibir
mensajes mientras se lee conserva la posición; volver a recientes sigue el extremo nuevo.
Recuperar un texto fallido prepara un borrador vacío sin enviar ni pisar lo escrito.
Una revisión incierta conserva requestId y requiere confirmación del propio operador;
Reviewed no afirma entrega. Un error de revisión usa su mensaje y el aviso global común.

Pruebas de la feature cubren contratos, permisos y recuperación; Playwright verifica geometría,
scroll, borrador y estados a 1440, 390 y 320 px, español e inglés. Las capturas del chat usan
componentes/rutas reales con fixtures exclusivos de pruebas; no acreditan un envío al teléfono.
La sincronización de la biblioteca externa continúa pendiente.

Validación final del conjunto: build y lint limpios; 57 casos de navegador en verde,
incluida recepción durante una carga anterior mientras el operador sigue leyendo.
El viewport ancla el mensaje visible y conserva también el desplazamiento hecho durante
la petición, sin confundir mensajes nuevos con una página antepuesta. Las referencias
ya reflejan el recorrido de atención manual consolidado por la separación de acceso/chat.
El backend compila sin advertencias y pasa sus 2054 pruebas, incluida integración real
con PostgreSQL y Redis. Meta permanece simulado; no acredita entrega a un teléfono real.

## Paleta Campo aplicada, solo colores — 2026-10-02

El usuario eligió los colores de la maqueta y aclaró: «no cambies diseños de componentes
ni nada de eso». Se promueve únicamente la paleta: acciones `#285A3D`, navegación `#24352B`,
encabezados `#DFE8D9` y filas `#F4F6F0`, con sus tonos derivados y texto oscuro.
Esta elección reemplaza los colores Jade de las secciones históricas de este documento.

Se conservan Public Sans, botones y campos de 30 px, tablas de 36 px, radios, márgenes,
layouts, íconos, filtros, modales y recorridos. No se promueven las pantallas de campo,
la escala de 44 px ni la simulación offline. El laboratorio se retira al cerrar la elección.
`initialAppearance`, sus valores de vista previa y los tokens CSS expresan la misma base.
Restaurar colores iniciales prepara Campo como borrador; Guardar sigue siendo explícito.
El backend actualiza solo una instalación con los cuatro colores Jade originales; cualquier
color personalizado conserva la paleta completa y los demás ajustes.

## Chat de WhatsApp promovido — 2026-10-02

El usuario aprobó la maqueta final y pidió implementar primero recepción y respuesta. `/whatsapp/chat` promueve solo el chat: panel WhatsApp con la geometría de Administración, bandeja y conversación dentro de Surface, burbujas con los tokens compartidos y la paleta Campo vigente, historial y compositor. En móvil alterna bandeja/conversación con «Chats» para volver. Confirma tomar Manual desde un contacto legado en Bot y revisar envíos inciertos; no ofrece activar un bot. Conserva borradores y posición de lectura. Sugerencias de IA, contactos y plantillas permanecen en el laboratorio; la configuración/prueba de conexión se promovió después a Administración, como registra la sección inicial.

Se verifican componentes y rutas reales con fixtures de prueba a 1440, 390 y 320 px en `src/test/visual/whatsapp.spec.ts`; no se actualizan capturas existentes para ocultar diferencias. La persistencia/envío se prueban por integración con PostgreSQL/Redis y Meta simulado. Reglas funcionales: [WhatsApp](../../../ArquitecturaBase/docs/features/whatsapp.md#chat-de-atención--2026-10-02).

Estado: **vigente**  
Reconciliación con el código local: **2026-10-02**; no implica sincronización del Artifact externo.

Revisión del Artifact: **2026-09-24** (veintiún tableros: los diez del sistema, los tres de “Un rol en su propia pantalla”, los seis de “Ingreso con WhatsApp” y las dos plantillas; las exploraciones descartadas se eliminaron). Aplicado al código en la Fase 5, en el rol en su propia pantalla y en el ingreso con WhatsApp; el mapa de abajo dice qué quedó implementado y qué no.  
Procedencia: [Sistema visual — ArquitecturaBase](https://claude.ai/artifact/HPbmDPLnr8JZ9TxevtTqJJ) (Artifact privado de Claude)  
Biblioteca de piezas: [ArquitecturaBase UI](https://claude.ai/artifact/Ew763kqorVHSYeUqE8CZ7h) (Artifact privado de Claude, instalada en el lienzo del sistema visual)

## Escala, tema y forma (2026-09-28)

### Chat de WhatsApp: propuesta local (2026-10-01)

El usuario pidió avanzar por partes: maqueta, estructura front/back, plan e implementación.
La [propuesta de la bandeja](whatsapp-chat-propuesta.md) vive en `design-lab/whatsapp-chat/`,
con los layouts y controles reales de ArquitecturaBase UI, Jade y Public Sans. Toma la
organización de los tableros de WhatsApp del lienzo local de Multitenant, sin copiar su tema.
Muestra bandeja, hilo, ficha del contacto, móvil y estados, con envíos simulados.
El usuario pidió un menú WhatsApp como Administración: la maqueta ahora muestra
un panel independiente. La ronda final del 2026-10-02 añade Contactos completo,
Plantillas, IA, diagnóstico de la conexión y permisos en Administración, todos
simulados. Chat incluye modo y sugerencias con revisión humana. En móvil, las
opciones se despliegan dentro del cajón. Entradas y evidencia en la propuesta local.
**Chat elegido e implementado en `/whatsapp/chat`; configuración/prueba de IA promovida después a Administración. Los otros destinos siguen siendo propuestas.**
La separación de acceso y atención está implementada desde el 2026-10-02, con Manual por
defecto y orientación pública por acciones estructuradas. La sincronización del Artifact
externo y las entregas de Contactos, sugerencias de IA, Plantillas y diagnóstico de Conexión
WhatsApp siguen pendientes. La maqueta
conservada es evidencia original de esos recorridos, no el contrato del chat productivo.

### Conexión LLM: propuesta local (2026-10-01)

La ampliación de IA solicitada el 2026-10-01 agrega **Inteligencia artificial** al
menú del laboratorio de WhatsApp, con proveedor/modelo, clave, prueba y estados
simulados. Corrección del 2026-10-02: formulario común, sin separar negocio/personal
ni mostrar límites o reglas de pago todavía no elegidas. Entrada `?screen=ia`;
conexión compartida de la instalación, proveedor y fuentes pendientes. El detalle y
la evidencia están en [la propuesta local](whatsapp-chat-propuesta.md); no se conecta
a un proveedor real ni se agrega una ruta productiva.

Alcance aclarado después el 2026-10-02: plantilla clonable con una instalación
independiente por negocio; cada copia tiene sus datos, canal e IA compartidos entre
sus operadores, configurados por su administrador. Atención delegada por permisos,
sugerencias revisadas y enviadas por una persona. Se posponen conexiones personales;
multitenancy y Embedded Signup no forman parte de este plan. La preparación de las
copias y traslado de mejoras comunes están en el plan compartido, sin verificarse aún.

### Continuidad del diseño actual (2026-10-01)

El usuario confirmó que le gusta el aspecto actual de ArquitecturaBase y pidió continuar
refinando todas las pantallas con sus mismas formas: formularios, filtros, tablas, íconos,
modales, inputs, desplegables y tooltips. Se conserva Jade, Public Sans, la densidad compacta
y la navegación aprobada. La referencia a Multitenant no implica adoptar su tema arena ni
rediseñar el caparazón. Las reglas transversales están en el [estándar aplicado](../guides/estandar-visual.md).

El usuario eligió avanzar con Configuración unificada el 2026-10-01. El tablero local se
promovió a `/configuracion`, con los componentes reales y tres superficies: preferencias
regionales, listados y registro. Conserva Jade y la navegación general. Guardar envía los campos
cambiados juntos; el backend valida y confirma el conjunto con una revisión y una transacción.
El laboratorio se retiró. La propuesta anterior con el tema de Multitenant fue descartada.
La biblioteca privada de Claude conserva la sincronización pendiente ya registrada abajo.

### Estándar aplicado y verificable (2026-09-30)

Actualización pedida el **2026-10-01**: campos en contenedores `Surface padded`, sin banda
decorativa; filtros y tablas separados. Aplicado a los datos del editor de roles y los ajustes
de Configuración; Perfil ya usa sus superficies. `TableBody` alterna blanco y `#f2f7f3`
(`table-row-alternate`) en las filas, con hover `#e5f1e8` (`table-row-hover`). Las bandas
de sección, encabezados y selección conservan sus prioridades. Playwright comprueba colores
calculados, separación de bloques y capturas a 1440/320 px. Sincronización externa pendiente.

**Apariencia aprobada e implementada (2026-10-01)**: `/configuracion/apariencia`, dentro de
Configuración junto a General, requiere `settings.manage`. Edita botones/enlaces, menú,
encabezados y filas alternadas con vista previa local, Guardar/Descartar y Restaurar colores
como borrador. Guarda los cuatro colores `#RRGGBB` juntos, con `expectedRevision`, en
SystemSettings. Desde el 2026-10-02 la restauración prepara Campo como borrador. La proyección pública los aplica también al ingreso y a los portales.
El texto, hover, enlaces y foco se derivan para mantener contraste; success, warning y
danger conservan sus colores. Los errores y conflictos mantienen el borrador y requieren
relectura antes de repetir. El laboratorio se retiró al promover la elección; las capturas
y recorridos reales están en `src/test/visual/appearance.spec.ts`. La sincronización externa
continúa pendiente y no se presenta como actualizada.

El usuario pidió aplicar un estándar transversal. Se consolidó el diseño aprobado, con `Surface`
para listados y superficies con banda, cabeceras y densidad comunes en `table`, controles de filtro
compartidos y variantes explícitas de acceso público. Perfil y el diálogo de edición de usuarios
usan la misma superficie; Configuración usa la tabla común para comparar revisiones. El resumen
lateral antiguo de Roles y `ProfileSection` se retiraron porque sus responsabilidades quedaron
en la tabla aprobada y `Surface`.

El [estándar aplicado](../guides/estandar-visual.md) describe piezas, medidas y alcance de los controles.
`npm run lint` incluye la arquitectura visual; el catálogo local muestra componentes reales.
Las [capturas de referencia](../../src/test/visual/screenshots/) y Playwright comprueban pantallas
a 1440, 390 y 320 px, tamaños calculados, scroll contenido, teclado y retorno de foco.
El Artifact privado conserva su sincronización pendiente; esta revisión está en el código y fuentes locales.

### Jade equilibrado aprobado (2026-09-30)

El usuario eligió explícitamente **Jade equilibrado** después de comparar Salvia, Jade y Bosque
en el laboratorio de verdes. Esta tabla conserva la elección histórica: el 2026-10-02 se
reemplazaron únicamente sus colores por Campo, según la sección vigente al inicio.
Las medidas, la tipografía y el comportamiento se conservan.

Los tonos viven en `@theme` y los alias de controles en `:root` de `src/index.css`. Se asignan
por función; no hay selectores por ruta ni adaptadores de color del laboratorio en producción.

| Zona | Tokens | Tono |
| --- | --- | --- |
| Menú principal | `nav-surface`, `nav-foreground`, `nav-muted`, `nav-hover`, `nav-accent` | `#194f3a`, `#edf7f0`, `#bed5c5`, `#2b6049`, `#b9dfc5` |
| Panel secundario | `subnav-surface`, `subnav-hover` | `#eef5ef`, `#d9eadf` |
| Barra superior, incluido el acceso público | `topbar-surface`, `topbar-foreground`, `topbar-muted`, `topbar-border` | `#dcecdf`, `#254c38`, `#4f6b58`, `#b4cdbb` |
| Encabezado de pantalla | `page-header` | `#f2f7f3` |
| Encabezado de tabla y bandas de superficie | `surface-header`, `content-heading` | `#d0e5d5`, `#254c38` |
| Barra de filtros | `filter-surface` | `#eaf3ec` |
| Campos y selectores | `control-surface`, `control-border` | `#f8fcf9`, `#6f947b` |
| Superficies y bordes | `canvas`, `surface`, `surface-muted`, `border` | `#fff`, `#fff`, `#eef5ef`, `#b4cebc` |
| Texto y acciones | `content`, `content-muted`, `brand-600`, `brand-500` | `#202d26`, `#5c6d62`, `#176b4c`, `#338260` |

Los nombres de la tabla llevan el prefijo `--color-`. Éxito, atención y peligro conservan sus
roles semánticos. Los contextos `navigation-surface`, `subnavigation-surface` y `topbar-surface`
se aplican una vez en los layouts; los portales usan el tema global. `Page` aplica la cabecera,
`TableHeader` y `TableHead` el encabezado común de todas las tablas, y `FilterBar` la superficie
de filtros de usuarios y permisos. `Input`, `Textarea`, `Select`, `MultiSelect` y `NativeSelect`
comparten el fondo y borde de control; el foco, la validación y el estado deshabilitado conservan
sus señales. Una pantalla futura compone estas piezas y hereda la paleta global vigente automáticamente.

Ajustes posteriores aprobados del menú (2026-09-30): los botones del borde para contraer/expandir
el menú y cerrar Administración tienen fondo blanco e ícono verde. Administración, Gestión de
usuarios, Usuarios, Roles y permisos y Configuración muestran los íconos del modelo común de
`layouts/navigation.ts`, de 16 px y decorativos; los textos mantienen sus nombres accesibles.
La lista compartida conserva los íconos también en submenús y en móvil. Esto reemplaza el criterio
anterior de ocultar íconos en los hijos del menú.
El panel secundario mide 224 px para que los rótulos sigan entrando con los íconos. Los ítems
conservan 30 px como alto mínimo y los nombres largos pueden ocupar más de una línea, también
en los grupos anidados del cajón móvil.

`shared/ui/theme.test.ts` comprueba contraste de texto, controles y foco. La integración se revisó
en las pantallas reales de roles, usuarios, configuración y perfil con datos simulados; el laboratorio
`design-lab/green-theme/`, sus variantes y sus adaptadores se eliminaron al cerrar la elección.

**Sincronización externa pendiente:** la revisión automática de permisos rechazó abrir la biblioteca
privada de Claude porque la solicitud autorizaba cambios locales y no el acceso a ese artefacto
externo. La fuente operativa vigente es este documento y el código compartido. Antes de usar nuevos
tableros, sincronizar los tokens vigentes Campo, `FilterBar`, `NativeSelect` y las superficies del layout en
[ArquitecturaBase UI](https://claude.ai/artifact/Ew763kqorVHSYeUqE8CZ7h), con autorización explícita.

### Editor de roles: tabla con secciones desplegables (2026-09-30)

El usuario aprobó continuar directamente en el front a partir de la maqueta `editor-roles.html`,
ajustada con sus referencias y su revisión posterior: una sola tabla enmarcada con encabezado común
  y secciones desplegables, siguiendo el estándar del listado de Usuarios.
Esta decisión reemplaza el editor anterior con panel lateral y resumen de permisos.

- Datos del rol arriba, desde el pedido del 2026-10-01 dentro de `Surface padded`, sin banda propia. Descripción debajo de Nombre, con ancho máximo
  de 672 px. Las restricciones de Admin y User siguen vigentes, sin insignia "Del sistema" ni aclaración
  de que el nombre no cambia.
- Filtros en una barra con borde, espaciado y controles como `UsersFilterBar`, separada de la tabla.
- Una sola tabla con los primitivos compartidos de `shared/ui/table`, borde exterior y encabezados
  Permiso, Descripción y Asignado una sola vez. Cada área es un `tbody` con nombre accesible mediante
  `aria-labelledby`, abierto o cerrado; los checks individuales y por sección se alinean al final.
- El checkbox de sección admite vacío, parcial y completo. Actúa sobre toda el área, también cerrada
  o filtrada; no modifica otras áreas. Admin muestra los checks deshabilitados.
- Se conservan búsqueda, filtro Elegidos, expandir/contraer, guardado, validaciones y confirmación al salir.
  El resumen lateral deja de montarse: la selección se consulta en la misma tabla.
- En móvil la tabla conserva un ancho mínimo de 520 px con scroll horizontal contenido. `Page` acomoda
  título, estado y acciones en filas, sin quedar adherido, para no tapar controles en pantallas angostas.
- Verificado en navegador a 1440, 1024, 390 y 320 px, con datos simulados y sin escrituras reales.

### Acceso público aprobado (2026-09-30)

Para bienvenida, ingreso, registro y verificación, prevalece la maqueta interactiva
`acceso-maqueta.html` revisada en Codex y aprobada explícitamente por el usuario antes de programar.
La elección posterior de Jade del 30/09 actualizó la paleta de toda la aplicación. El editor de roles
tiene su propia revisión aprobada e implementada, descrita en la sección anterior.

- `/` muestra la bienvenida sin sesión y conserva el tablero para quien ya ingresó. `/login` y
  `/registro` distinguen intención, textos y formulario; cada uno tiene su paso `/codigo`.
- Tema claro en toda la aplicación con los tokens de [Campo](#paleta-campo-aplicada-solo-colores--2026-10-02).
  `index.css` define su alcance global en `@theme` y `:root`, incluidos los controles en portales;
  `color-scheme: light`. La cabecera pública usa el mismo contexto `topbar-surface`.
- Public Sans, título de formulario 30 px (28 en móvil),
  cuerpo 14 px, formulario de 400 px como máximo. Controles de 44/46 px y radio de 5 px.
- Una superficie, sin tarjeta alrededor del formulario. Cabecera solo con los accesos,
  pie con idioma, selector de correo/WhatsApp subrayado y con íconos Lucide visibles.
- La portada del 30/09 mostraba solo Crear cuenta e Iniciar sesión. La elección del 02/10,
  [Landing pública con nota de campo](#landing-pública-con-nota-de-campo--2026-10-02), reemplaza
  esa bienvenida por la marca genérica, introducción y capacidades, sin datos ficticios de actividad.
- El registro pide nombre solo para crear una cuenta por código. Google aporta su propio nombre.
  Carga, fallo con reintento, registro cerrado, cuenta existente, código vencido y bloqueos conservan
  las reglas reales del backend. La existencia de una cuenta se informa después de verificar identidad.
- No se publican los enlaces ficticios de Privacidad/Ayuda del prototipo: requieren contenido real.
- Pruebas: recorridos con MSW y verificación en Chrome a 1440, 390 y 320 px, español e inglés.

Esta revisión reemplaza la paleta oscura anterior; las medidas de administración siguen vigentes.

La escala compacta siguiente rige administración; el acceso público conserva sus controles de 44/46 px
y los colores vigentes son los de Campo. Nació de una
comparación contra Vercel y DigitalOcean: lo que hacía que esto se viera como una plantilla generada no era
la paleta, era que todo estaba una talla más grande de lo que usa una herramienta de trabajo, y que arriba de
eso había una capa de adornos que aparecen en cualquier panel. Los tableros están en el Artifact, bajo "Que no
parezca una plantilla: la escala".

- **La aplicación es clara y verde.** Canvas y superficies son blancos; `surface-muted` y las líneas
  delimitan agrupaciones sin sombras. `<html>` no lleva `class="dark"`.
- **El color de acción es verde:** `-50` y `-100` son fondos suaves, `-700` el texto que va encima,
  y `-600` el relleno con `--color-brand-ink` blanco.
- **La escala de texto baja una talla entera**, redefiniendo `--text-*` en `@theme`: la interfaz se lee en
  14 px (`text-sm`). Se define globalmente para que ingreso y administración compartan legibilidad.
- **Las medidas:** barra superior 48, menú 220 (56 contraído), panel de Administración 224, ítem de menú 30 como mínimo,
  botón 30 (26 el chico), control de formulario 30, fila de tabla 36, encabezado de tabla 32.
- **Las esquinas casi no se redondean:** 5 px en un control (`--radius-control`) y 6 px en una tarjeta
  (`--radius-card`). El redondeo de 8 y 12 px en todo, del más chico al más grande, es lo que hace que
  cualquier panel se parezca a cualquier otro.
- **Nada lleva sombra.** La profundidad la dan el escalón de luz y una línea de 1 px. Quedan las de los
  popovers, que sí flotan.
- **Lo que se fue, uno por uno:** el cuadrado de color donde iría el logo (ahora la marca es el nombre
  retirado también del menú y del ingreso), la banda tintada del encabezado de pantalla, el ícono de la sección
  metido en un cuadradito (la prop `icon` de `Page` ya no existe), las versalitas
  con espaciado de los rótulos, las pastillas redondas de estado y los avatares circulares.
  Los íconos de Administración y sus hijos se conservaron en la revisión del 2026-09-30.
- **El ítem activo del menú se marca con una barra de 2 px de la marca y el peso de la tipografía**, no con
  una pastilla celeste. La pastilla tintada era el único lugar donde aparecía el color de marca en toda la
  pantalla, y eso lo convertía en decoración.
- **La tipografía es Public Sans** (`@fontsource-variable/public-sans`), no Inter: está dibujada para
  formularios y aguanta 13 px mejor. Las tablas llevan figuras tabulares por CSS, para que las columnas de
  números no se desalineen.

El pendiente de redibujar el selector de permisos se resolvió con la tabla de secciones aprobada
el 2026-09-30, descrita arriba. La [revisión funcional del 2026-10-01](../../../ArquitecturaBase/docs/reviews/2026-10-01-revision-funcional.md)
agregó recorridos de Roles con API real. Las salidas y estados todavía sin evidencia individual
se conservan en el [registro de verificaciones](../../../ArquitecturaBase/docs/plans/verificacion-y-produccion.md).

## Datos en tablas (2026-09-30)

Cada dato adicional de un listado lleva su propia columna y encabezado; no se agrega como insignia al
nombre ni se mezcla con otro dato en su celda. En el listado de roles se omite "Del sistema": la columna
Rol muestra solo el nombre. Las restricciones de edición y borrado de Admin y User siguen vigentes.
Esta decisión prevalece sobre las composiciones anteriores de tablas; otros listados se adaptan cuando
se revisan.

## Organización y mensajes (2026-09-30)

Por pedido explícito del usuario, las pantallas se organizan por tarea, con menú por tema,
cabecera clara, datos pertinentes y controles elegidos según el dato. La elección del 2026-10-01
reúne Idioma, Zona horaria, Listados y Registro en General, con tres secciones compartidas,
guardado explícito, revisión y comparación. Las cuatro rutas anteriores redirigen a esa pantalla.
Su evidencia está en [Configuración general](#configuración-general-2026-09-30).

Los resultados, errores generales, warning e info van al único Toaster **abajo a la derecha**.
La validación de campo queda junto al campo; confirmar una decisión usa ConfirmDialog.
Una carga fallida reemplaza el contenido con su estado de recuperación; no deja un formulario
aparentemente utilizable. El contrato completo de ubicación, duración, acciones y duplicación
está en el [contrato transversal de mensajes](../guides/mensajes-y-estados.md).
Estas decisiones sustituyen los criterios anteriores de organización y mensajes. La adaptación
de código existente no se da por realizada por estar documentada. El [plan auditado de unificación](../plans/2026-09-30-unificacion-mensajes.md)
incluye todas las pantallas y los controles que deberán impedir una política distinta por feature.

## Cómo se usa esta base

Las [premisas de desarrollo del front](../guides/premisas-de-desarrollo.md) convierten este diseño en
reglas de implementación para filtros, tablas, formularios, selección, botones, modales y mensajes.
Las notificaciones transitorias tienen una ubicación común aprobada: **abajo a la derecha**,
con el único `Toaster` global definido en `shared/ui/sonner.tsx`.

El Artifact es el origen visual de esta revisión, pero no puede ser la única fuente: requiere una sesión autorizada y puede evolucionar fuera del historial de Git. Este documento congela sus decisiones aplicables para que Claude, Codex y cualquier persona trabajen con la misma base.

Orden de precedencia:

1. Contratos funcionales y de seguridad del backend, permisos, accesibilidad, i18n y manejo de errores.
2. Este fundamento visual y las decisiones ya codificadas en `src/index.css` y `src/shared/ui`.
3. El Artifact como referencia visual, historial de exploración y fuente de nuevas propuestas.

Una propuesta del Artifact no se considera implementada por estar dibujada. Primero debe pasar por una comparación o revisión, recibir una elección explícita y terminar expresada en tokens, componentes compartidos y tests. No se copia un valor aislado en una pantalla.

## Pantalla nueva: primero el tablero

Una pantalla nueva no arranca en el editor. Arranca como un tablero en el Artifact [Sistema visual — ArquitecturaBase](https://claude.ai/artifact/HPbmDPLnr8JZ9TxevtTqJJ), el mismo que ya agrupa “Gestión de usuarios”, “Filtros”, “Formularios” y “Anatomía”. Un tablero por pantalla y siempre en ese Artifact: no se abre uno nuevo por pantalla ni por fase, porque el valor está en verlas juntas.

El orden no se invierte:

1. Se agrega el tablero al Artifact con la funcionalidad completa dibujada, **arrancando de una plantilla** (hoy, “Plantilla · Listado”) y **armado con las piezas de la biblioteca**, no dibujado a mano (ver “La biblioteca de piezas”).
2. El usuario lo mira y elige. Sin elección explícita no se programa.
3. Recién ahí se escribe el código, y lo elegido termina en tokens, componentes compartidos y tests.

El tablero no es un dibujo lindo: dice **cómo se comporta** la pantalla. Antes de programar tiene que mostrar, cuando corresponda:

- el layout con datos y la acción primaria;
- carga, vacío de “no hay datos” y vacío de “no hay coincidencias”;
- el error del listado o del formulario, con reintento cuando aplica;
- qué se ve y qué no se ve sin permiso;
- el recorrido completo: diálogos, confirmaciones y a dónde vuelve cada salida;
- qué vive en la URL (página, tamaño, búsqueda, orden, filtros).

Esa lista es, a propósito, la misma que pide el “Criterio de finalización de una pantalla” al cerrar. Lo que no está dibujado se termina decidiendo sobre el teclado, con el costo ya pagado, y así es como una ruta deja de parecerse al resto. Si el tablero la cubre, cerrar la pantalla es implementar, no rediseñar.

Al terminar, la pantalla suma su fila al mapa Artifact → proyecto y se actualiza la revisión del encabezado de este documento.

## La biblioteca de piezas

Hasta el 2026-09-22 cada tablero dibujaba sus botones, campos y tablas a mano, con colores sueltos, y por eso dos tableros nunca salían iguales ni iguales al código. Desde el 2026-09-23 el lienzo tiene instalada la biblioteca [ArquitecturaBase UI](https://claude.ai/artifact/Ew763kqorVHSYeUqE8CZ7h): las piezas de `src/shared/ui` y de `src/layouts`, con los mismos nombres, medidas y tokens, que un tablero monta en vez de redibujar (`<x-import component-from-global-scope="AB.Button" variant="outline">`).

- **Una pantalla nueva se arma, no se dibuja.** Se duplica la plantilla que corresponde y se cambian la entidad, las columnas y los filtros. Lo que la plantilla ya resuelve (dónde va la acción primaria, los vacíos, el error, qué pasa sin permiso, los diálogos) no se vuelve a decidir.
- **Cada pieza tiene su gemela en el código**, y su ficha lo dice (“En el código: `shared/ui/button.tsx`”). Pasar un tablero al código es traducir pieza por pieza, no interpretar un dibujo.
- **Un cambio de aspecto se hace en la biblioteca y en `shared/ui` a la vez.** Nunca solo en un tablero, y nunca solo en el código: si divergen, los tableros vuelven a mentir.
- **Las fuentes viven en el Artifact de la biblioteca**, en `components/src/` (un `.jsx` por grupo, sus estilos en `css/` y `build.mjs`). `node build.mjs <carpeta del front>` regenera el paquete con el rolldown del front; después se vuelven a copiar `bundle.js`, `bundle.css`, `index.d.ts` y `tokens.json` al lienzo, en `project/ds/ab/`. Los pasos están en `components/src/COMO-SE-ARMA.txt`.

Composiciones que todavía permanecen en sus consumidores, sin un componente propio en `shared/ui`:

| Pieza | Dónde vive hoy |
| --- | --- |
| Selección por catálogo y “Más filtros” (`FilterSelect`/`MoreFilters` en el Artifact) | `features/users/components/UsersFilterBar.tsx`; los triggers ya usan `FilterMenuTrigger` y los chips, `FilterChip` |
| Punto de estado (`StatusDot` en el Artifact) | `identityCell` en `features/users/columns.tsx` |
| Avatar de cuenta | `layouts/components/Sidebar.tsx` y `layouts/components/UserMenu.tsx`; ambos consumen el helper compartido `initialOf` |

`Surface` y `FilterChip` **ya existen en `shared/ui`** y se usan en las pantallas. La lista anterior
de piezas por promover quedó reemplazada al aplicar el estándar; no volver a crearlas en las features.

`FormError` general se retira de las piezas a promover: el párrafo repetido en formularios es
un desvío a migrar al aviso operativo común, no una pieza nueva de la biblioteca. Se conservan
los errores de campo/grupo y los estados del contenido conforme al contrato de mensajes.

Y al revés: piezas y cambios que **ya están en `shared/ui` y todavía no están en la biblioteca**. La regla dice que un cambio de aspecto va a los dos lados a la vez; esto es deuda, y mientras exista los tableros que usen estas piezas van a dibujarlas distinto de como se ven:

| Pieza o cambio | De dónde salió |
| --- | --- |
| Paleta Jade, contextos de navegación y barra superior, cabeceras de `Page` y tabla, controles con fondo; `FilterBar` y `NativeSelect` compartidos | elección explícita del usuario, 2026-09-30; ver sincronización externa pendiente arriba |
| `Surface`, `FilterChip`, `FilterMenuTrigger`, `TableSectionToggle`, `TableRowHeader`, `EmptyState embedded`, variantes `Button inline/touch`, `SegmentedControl appearance="public"` y tokens de alturas/rótulo | estándar aplicado en código el 2026-09-30; sincronización del Artifact pendiente |
| `Banner` (`info`, `warning`, `danger`) | ingreso con WhatsApp, Tareas 14 y 16 |
| `RadioGroupField` | ingreso con WhatsApp, Tarea 16 |
| `VerificationBadge` | ingreso con WhatsApp, Tareas 14 y 16 |
| `PhoneField` y `OtpInput` (ahora en `shared/ui`) | ingreso con WhatsApp, Tareas 7 y 14 |
| `SegmentedControl` con `fullWidth`, y entero (es nuevo) | ingreso con WhatsApp, Tarea 7; rol en pantalla propia, Tarea 2 |
| `CheckboxField` con `error`, y como fila del selector | ingreso con WhatsApp, Tarea 16; rol en pantalla propia, Tarea 6 |
| `Spinner` con `decorative` | ingreso con WhatsApp, Tarea 12 |
| Íconos: `Mail`, `Smartphone`, `Check`, `Info`, `AlertCircle`, `AlertTriangle`, `Clock`, `Ban`, `Eye` | ingreso con WhatsApp, Tareas 12, 14 y 16; rol en pantalla propia, Tarea 8 |
| Tokens `--color-success-50`, `--color-success-700`, `--color-warning-50`, `--color-warning-700` | ingreso con WhatsApp, Tareas 14 y 16 |
| `Page` con `backTo` y `status`; `ConfirmDialog` con `cancelLabel`; `EmptyState` con `className` y `descriptionClassName`; el caparazón en `h-svh` con `main` `relative`; las migas de cuatro niveles | rol en pantalla propia, Tarea 6 |
| Íconos `CheckCheck` (las dos tildes de "Entregada" y "Leída") y `Send` (el avión de la invitación); token `--color-danger-700` ("No llegó" en letra chica sobre `surface-muted`) | tablero "Editar usuario · B", la franja de la última invitación (ingreso con WhatsApp, Tareas 15 y 16). El tablero los dibuja a mano: SVG sueltos y el rojo crudo en `.st.bad` |

## Principios del sistema

- **Un sistema, no una colección de pantallas.** La coherencia nace de piezas compartidas, no de volver a resolver cada ruta.
- **Superficies comunes.** `Surface` y `DialogContent` usan fondo blanco, borde de 1 px y radio de 6 px. La pantalla no agrega una tarjeta si la tarea no la necesita; `EmptyState embedded` evita otro borde dentro de la tabla.
- **Una banda de superficie.** `Surface` y las tablas usan `--color-surface-header`, con más contraste que `surface-muted`. `Page` usa el tono propio `--color-page-header`; el diálogo conserva su encabezado común blanco.
- **Densidad compartida.** Controles y botones de 30 px, variante chica de 26 px, filas mínimas de 36 px y cabeceras de tabla de 32 px. Acceso usa botones desde 44 px y campos desde 46 px. Las filas crecen con su contenido; la feature no redefine estas alturas.
- **Cuatro estados.** Normal, hover, seleccionado y foco usan los mismos roles semánticos en navegación, tablas y listas.
- **Cinco niveles tipográficos.** Título de pantalla, título de sección, cuerpo/dato, texto secundario y rótulo. Un sexto nivel requiere ampliar el sistema, no un tamaño suelto.
- **Seis pasos de espacio.** 4, 8, 12, 16, 24 y 40 px. Como guía: 8 entre controles, 16 dentro de superficies y 24 entre secciones.
- **La marca significa acción.** `brand` se reserva para acciones, selección y foco. Éxito, atención y peligro conservan sus propios roles; el peligro se usa solo para consecuencias destructivas.
- **El color nunca comunica solo.** Todo estado lleva texto, ícono accesible o ambos.
  - **Una excepción, anotada:** el estado del listado de usuarios es un punto delante del correo, y su palabra va oculta para la vista (`sr-only`) pero no para el lector de pantalla. Se aceptó a cambio de la densidad: liberó la columna que ocupaba el estado —que en casi todas las filas dice lo mismo— para la de roles, que es el dato que hay que mirar fila por fila. Para quien ve, ahí el estado se lee del color: verde para activo y rojo para inactivo. Las acciones conservan solo íconos (check para habilitar y encendido para deshabilitar), con nombre accesible y tooltip; las dos abren confirmación antes de cambiar el acceso (2026-09-30). Si vuelve a aparecer este caso, se compara antes de repetirlo: una excepción es una excepción, no un permiso.

## Encabezados

Solo hay tres niveles:

1. **Pantalla:** uno por ruta de aplicación, con título y acción primaria; sin ícono de sección.
2. **Superficie:** abre tabla, formulario, diálogo o panel.
3. **Grupo:** rotula una lista sin caja, como una sección del menú lateral.

**El encabezado de pantalla usa `Page`.** La banda elegida el 2026-09-21 fue ajustada con la escala
y las formas del diseño aprobado; estas son sus medidas y composición actuales:

- Es una banda de **48 px mínimos**, adherida dentro del contenido en escritorio, con `--color-page-header` y borde inferior. En móvil deja de adherirse y título, estado y acciones pueden ocupar varias filas. No tiene estado expandido.
  - **Adherida de verdad recién desde el rol en su propia pantalla (2026-09-22).** La Fase 5 la dio por implementada, pero la raíz de `AppLayout` era `min-h-svh`: crecía con el contenido, el que scrolleaba era el documento y la banda se iba con el resto, en todas las pantallas. Con la raíz en `h-svh` scrollea `<main>`, y la barra superior y la banda se quedan arriba. jsdom no maqueta, así que ningún test lo había visto: se comprobó en un navegador.
- Lleva el **título de la pantalla abierta** y la **acción primaria** a la derecha, sin ícono de sección ni descripción. Título y menú ya dan el contexto. La acción corresponde a la pantalla activa: crear usuario o crear rol.
- **Una pantalla hija agrega el enlace de volver** (`backTo` en `Page`): caja de 24 px con flecha de 14 px y tooltip, sin borde permanente, que dice a dónde vuelve en su nombre accesible. `status` puede acompañar al título sin formar parte del nombre, por ejemplo “Cambios sin guardar”.
- **Sin antetítulo y sin descripción.** El antetítulo se evaluó y se descartó: el grupo ya se lee en el menú lateral y en las migas, y un tercer lugar diciendo lo mismo no agrega orientación.
- **Las migas se quedan** en la barra superior, con los tres niveles (`Inicio / Gestión de usuarios / Usuarios`). Al no haber antetítulo, no hay duplicación que resolver.
- **Las migas de una ruta hija tienen cuatro niveles**, con el padre como enlace y como hoja lo que la pantalla está editando (`Inicio / Gestión de usuarios / Roles y permisos / Soporte`). La hoja la pone la pantalla (`useBreadcrumbLeaf`), porque solo ella sabe cómo se llama; mientras no la pone, el padre queda último y sin marcar como página actual.

El peso tipográfico se mantiene en 600. El laboratorio proponía 680, que sería un sexto nivel: el sistema tiene cinco y ampliarlo requiere una decisión deliberada, no un ajuste de una pantalla.

Con esto, `design-lab/page-header/index.html` cumplió su función y **ya se eliminó**.

## Navegación

- El menú lateral lista arriba las pantallas del día a día y cierra abajo con **Administración**, separada por una línea. Un ítem puede abrir un **submenú desplegable**: el padre es un `button` con `aria-expanded`, y los hijos van indentados, con una guía vertical que los ata al padre. Un grupo rotulado (`ADMINISTRACIÓN` en versalitas) sigue siendo posible para lo que se use todos los días; Administración ya no lo usa.
- **Administración abre un panel propio al lado del menú** (224 px, contexto `subnavigation-surface`), con el desplegable `Gestión de usuarios` y los destinos vigentes de `Configuración`. General reúne los cuatro ajustes iniciales desde el 2026-10-01. El panel se abre solo en cualquier ruta de administración y se cierra al salir de la sección; adentro se puede cerrar y abrir con el mismo botón o la flecha del borde. Con el panel abierto se esconde la flecha de contraer el menú. Reemplazó al grupo rotulado que Administración tenía (2026-09-28), con la escala actual de la plantilla.
- **En el teléfono no hay panel:** el cajón ya ocupa la pantalla, así que Administración se despliega adentro como cualquier grupo, y sus pantallas quedan a tres niveles.
- **Los submenús viven en el menú lateral, no en pestañas del encabezado.** Se evaluaron pestañas en la banda y se descartaron: obligaban a que el encabezado cambiara de alto según la sección, y dejaban el árbol de navegación repartido en dos lugares.
- **Los grupos arrancan plegados, y el de la ruta activa se despliega solo.** El menú tiene que decir a dónde se puede ir sin listarlo todo siempre; y entrar a `/roles` desde un favorito o recargando tiene que mostrar dónde estás, no un grupo cerrado. El desplegado se calcula durante el render, no con un efecto, así el grupo no aparece plegado y se abre después.
- **Se pliega a mano y no se recuerda entre visitas.** Que quede abierto porque estás parado adentro no es una preferencia; guardarlo convertiría en silencio "plegado salvo el activo" en "siempre abierto" apenas entrás una vez. La barra contraída sí se recuerda, porque eso sí es una decisión sobre el espacio de trabajo.
- Se abre solo el grupo activo. Con varios grupos abiertos el menú se vuelve una lista larga que hay que scrollear, y deja de servir para orientarse.
- **Los hijos conservan su ícono** (revisión explícita del 2026-09-30), junto con la sangría y la guía vertical. El mismo modelo de navegación abastece el panel de Administración, sus submenús, el cajón móvil y la barra contraída.
- **Agrupar en el menú no cambia las rutas.** `Gestión de usuarios` agrupa `/usuarios` y `/roles` sin anidar URLs: los enlaces guardados siguen funcionando y el `returnUrl` del ingreso no se toca.
- **Cada hijo conserva su permiso.** Quien tiene uno solo ve un solo hijo; quien no tiene ninguno no ve el grupo. El permiso se pide en la ruta y se repite en la navegación: uno decide si se entra, el otro si se ve.
- Contraída, la barra deja solo los íconos centrados en controles de 30 px (40 px en estados auxiliares de carga/error), y el rótulo del grupo se reemplaza por un separador corto. El control para plegarla es una caja de 20 px con el radio común, montada sobre el borde derecho.
- **Contraída no hay submenús: los hijos suben a la lista como íconos sueltos.** La barra contraída es un lanzador, no un mapa; esconder destinos detrás de un desplegable compacto cambiaría un clic por dos. La jerarquía la siguen contando las migas y el menú expandido. **Administración es la excepción**, y por la misma razón: contraída sigue siendo un botón, porque abre el panel entero.

## Íconos y acciones

- Tamaños: 16 px en línea y navegación, 18 px en acciones de fila; volver desde `Page` usa una flecha de 14 px.
- Un único lenguaje: grilla de 24, trazo aproximado de 1.75 y puntas redondeadas.
- Configuración conserva `SettingsIcon`; General usa controles de ajuste (`PreferencesIcon`) y Apariencia una paleta (`PaletteIcon`). Los tres destinos se distinguen por su dibujo dentro del mismo set común (2026-10-01).
- El SVG es decorativo (`aria-hidden="true"`); el botón posee el nombre accesible completo y contextual, por ejemplo “Eliminar a ana@ejemplo.com”.
- Todo control de acción sin texto usa `ActionTooltip` (2026-09-30), compartido por tablas, navegación, paginación, filtros y cierres. Aparece con hover y foco, cierra con Escape, permite pasar el puntero a la ayuda y ajusta su posición a los bordes. El contenido vive en un portal: los grupos segmentados y contenedores con scroll no lo recortan. Se reemplazó la implementación CSS local porque `overflow-hidden` ocultaba las ayudas de las filas. Un solo `TooltipProvider` gobierna el recorrido; el contenido se monta solo mientras está abierto. Los textos llegan traducidos desde el namespace de cada módulo, también cuando explican un botón deshabilitado. Los botones con texto visible no necesitan repetirlo en un tooltip.
- Una acción de fila muestra tooltip al hover y al foco. Las inocuas van primero y la destructiva, última y separada. El rojo aparece al interactuar, no como ruido permanente.
- Una acción sin permiso no se renderiza. No se deja deshabilitada sin una explicación alcanzable por teclado.
- No se usan emoji como iconografía de producto.

## Listados y filtros

- Un solo buscador de texto libre, siempre visible y con debounce.
- Hasta tres filtros frecuentes junto al buscador; los restantes viven en un panel avanzado con contador de filtros aplicados.
- Página, tamaño, búsqueda, orden y filtros viven en la URL. Cambiar búsqueda, orden o filtro vuelve a la página 1.
- Los filtros activos siempre se ven como chips removibles y existe una única acción “Limpiar todo”.
- El vacío distingue entre “no hay datos” y “no hay coincidencias”; en el segundo caso explica cuántos filtros hay y permite limpiarlos.
- Las opciones muestran el conteo esperado antes de elegirlas; una opción con cero resultados queda indisponible.
- Búsqueda y filtros rápidos aplican sin botón; el panel avanzado aplica el conjunto una sola vez.
- El backend filtra, ordena y pagina. El frontend no simula resultados sobre una página parcial.
- Selección masiva usa checkboxes nativos o semánticamente equivalentes con nombre accesible. El prototipo revisado no los exponía en el árbol de accesibilidad, por lo que esa parte es referencia visual, no implementación aceptable.

## Formularios y diálogos

- La etiqueta va arriba y nunca depende del placeholder.
- El control común mide 30 px, o 26 px en variante chica; el acceso público usa 44/46 px. Su ancho responde al contenido y el formulario es de una columna salvo pares cortos relacionados.
- La ayuda ocupa el mismo renglón que reemplaza el error, evitando saltos de layout.
- `FormField` vincula etiqueta, control, ayuda/error, `aria-invalid` y `aria-describedby`; ningún formulario productivo dibuja un campo por fuera de esa pieza sin una razón documentada.
- Se valida al enviar. Después del primer error se valida en vivo mientras se corrige.
- El error del servidor asociado a un campo aparece junto al campo; el error general de una operación
  usa el Toaster abajo a la derecha. No se duplica ni agrega un cartel encima de la botonera.
- Cancelar queda junto a la primaria, que va última. Una destructiva, si existe, queda separada a la izquierda.
- Mientras guarda, el botón se deshabilita y explica el estado; no se tapa toda la pantalla ni se pierde lo escrito.
- Un formulario breve y contextual se abre en diálogo. Uno largo, seccionado o compartible tiene ruta propia. Un único valor puede editarse en línea.

## Avisos y estados

Cada hecho usa un solo canal:

- **Toast:** éxito, error operativo, warning e info, abajo a la derecha. Si necesita una acción,
  permanece hasta resolverla o cerrarlo; no cambia de canal por originarse en un formulario.
- **Error de campo:** requiere corregir un dato y permanece junto a su control.
- **Confirmación:** aparece antes de una decisión y explica su consecuencia.
- **Estado de contenido:** carga, falta de datos, falta de permiso o imposibilidad de cargar;
  ocupa la superficie que todavía no puede usarse. No es un banner de resultado.

Cada hecho tiene un solo dueño y un canal. El detalle, duración y recuperación siguen el
[contrato común](../guides/mensajes-y-estados.md). La deuda de consumidores y pruebas está en
el [plan de unificación](../plans/2026-09-30-unificacion-mensajes.md).

## Responsive y accesibilidad mínimos

La revisión externa registrada del Artifact era de escritorio; su sincronización sigue pendiente.
**El código ya tiene evidencia local a 320 px** para Usuarios, Roles, editor, Configuración y Perfil,
además de acceso y catálogo. Las pruebas actuales verifican scroll horizontal contenido, cabecera
adaptable, foco y teclado. Eso no acredita todos los criterios de esta lista: falta una auditoría
completa de accesibilidad y objetivos táctiles; los controles compactos de administración y el
enlace de volver no se agrandan todos automáticamente a 44 px en móvil.

- Todas las rutas deben funcionar desde 320 px hasta escritorio sin contenido esencial recortado.
- Lo que hace el puntero también lo hace el teclado; el foco siempre es visible.
- Cada control tiene nombre accesible y los cambios asincrónicos importantes se anuncian.
- Tablas anchas usan una estrategia explícita: scroll contenido con indicación, reducción de columnas o representación apilada. Nunca fuerzan scroll horizontal de toda la página.
- Los objetivos táctiles mantienen al menos 44 × 44 px en móvil, aunque la representación visual sea más compacta.
- Español e inglés conservan la misma jerarquía sin depender de longitudes fijas.

## Mapa Artifact → proyecto

| Tablero | Destino local | Estado |
| --- | --- | --- |
| Gestión de usuarios | `/usuarios`, `/roles`, `AppLayout`, `Sidebar`, `Page` | **Implementado** (Fase 5) |
| Filtros | `shared/hooks/useFilters`, `features/users/components/UsersFilterBar` | **Implementado** (Fase 5), con `GET /api/users/filter-counts` detrás |
| Reglas de filtrado | las mismas piezas, más `DataTable` (vacío con filtros) | **Implementado** (Fase 5) |
| Formularios | `FormField`, diálogos, perfil y configuración | Implementado; auditar que ningún campo se dibuje fuera de `FormField` |
| Avisos | Toaster global, errores de campo/grupo, ConfirmDialog y estados de contenido | **Contrato vigente, adopción parcial.** Emisor común, fábrica de QueryClient y Configuración implementados; otros consumidores y controles de arquitectura pendientes en el plan del 2026-09-30 |
| Anatomía | `src/index.css` (tokens) y `shared/ui` | **Implementado**: tokens de superficies, tipografía y alturas comunes de controles, filas y cabeceras; ver el estándar aplicado |
| Encabezados, íconos y color | `Page`, superficies, set propio de íconos | **Implementado**: banda adherida (de verdad desde el rol en su propia pantalla, ver “Encabezados”) y 17 íconos propios |
| Las mismas piezas | `shared/ui` (superficie, banda, control) | **Implementado en código**; biblioteca externa pendiente de sincronizar |
| Cómo se sostiene | tokens + componentes + tests | Norma de gobierno adoptada |
| Roles · Editar un rol, y Roles · Estados y recorrido | `/roles/nuevo`, `/roles/{id}`, `RoleEditorPage`, `PermissionPicker`, `Surface`, `SegmentedControl`, `useUnsavedChangesGuard`, `useBreadcrumbLeaf` | **Implementado**; la tabla de secciones del 2026-09-30 reemplazó el resumen lateral |
| Roles · Acciones del listado | `/roles`, `RolesPage` con `RowActions` y `EyeIcon`: Admin “Ver”, User “Editar”, ninguno “Eliminar” | **Implementado** (2026-09-22). El separador entre Editar y Eliminar, desde el 2026-09-23: el `border-0` de cada botón de `RowActions` le ganaba al `divide-x` del grupo |
| WhatsApp · Ingreso en la web | `/login` con el selector Correo \| WhatsApp (`EmailCodeForm`, `WhatsAppCodeForm`, `PhoneField`, `SegmentedControl appearance="public"`) y `/login/codigo` con `OtpInput` | **Implementado**; ingreso y registro explícitos desde el 2026-09-30 |
| WhatsApp · El enlace del chat | `/ingresar`, `LoginLinkPage`, `ClockIcon`, `BanIcon`, `Spinner` `decorative` | **Compatibilidad histórica** (2026-09-23): la ruta canjea enlaces previos; desde el 2026-10-02 el chat orienta al acceso explícito y no emite enlaces. El `Spinner` mide 20 px y el tablero lo dibuja de 28 |
| WhatsApp · Orientación de acceso | **backend:** `Resources/Access.resx` y `Access.en.resx`, `WhatsAppInboundService` y `WhatsAppAccessReplyPolicy` | Bot anterior retirado el 2026-10-02. Solo botones estructurados reciben orientación a login/registro públicos; acceso por código independiente de Manual |
| WhatsApp · Mensajes que manda el sistema | **backend:** las plantillas de Meta (`codigo_ingreso`, `invitacion_acceso`) y `Infrastructure/Emails/Templates/Invitation.html` | **Implementado** (2026-09-24). **El panel 2 quedó desactualizado:** dibuja el texto con el que la invitación se presentó como Utilidad, y Meta la aprobó recién como Marketing, con otro texto |
| WhatsApp · Perfil: correo y WhatsApp | `/perfil` con dos `Surface`, `LoginMethodsCard`, `VerifyDestinationDialog`, `UnlinkWhatsAppDialog`, `Banner`, `VerificationBadge` y aviso de `DashboardPage` | **Implementado**. El código usa un diálogo de verificación configurable para ambos destinos; superficies y radios siguen el estándar actual. Mensajes heredados y sincronización externa siguen pendientes |
| WhatsApp · Usuarios: alta con teléfono | `/usuarios`, `columns.tsx`, `UserFormDialog` (alta), `UserEditDialog` (edición), `UnlinkUserWhatsAppDialog`, `RadioGroupField`, `VerificationBadge`, `LastInvitationStrip` | **Implementado**, incluido estado de última invitación y reenvío. Sus mensajes todavía requieren la adopción transversal; la sincronización del tablero externo no se da por realizada |
| Plantilla · Listado (y sus estados y recorrido) | el punto de partida de todo listado; su ejemplo es `/usuarios` | **Plantilla** (2026-09-23), armada con la biblioteca. No es una pantalla nueva: se duplica para las que vengan |

La Fase 5 dejó responsive, inicio, 403/404 y marca pendientes. Desde entonces se aprobaron
acceso público, tabla de roles y Configuración con evidencia local a 320 px; el alcance todavía
abierto se enumera en "Pantallas por completar con esta base". No se infiere de esa evidencia
que la biblioteca o todos los tableros externos estén sincronizados.

La revisión externa registrada contaba veintiún tableros y una nota vieja junto a “Ingreso con WhatsApp” que decía “Propuesta para aprobar: todavía no hay nada programado”; esos seis tableros ya tienen implementación local. La procedencia registra el retiro de las exploraciones descartadas y los dos tableros del panel de Administración (escritorio y teléfono). El estado actual del Artifact y su actualización al estándar local siguen pendientes de comprobar y sincronizar.

## Pantallas por completar con esta base

Los puntos 1 a 4 de la lista original se hicieron en la **Fase 5** (tokens y primitivas, `Page` como banda, submenú con permiso por hijo, y los filtros con su contrato de backend), salvo que la banda recién quedó adherida de verdad con el rol en su propia pantalla (ver “Encabezados”). Lo que queda, sin ampliar contratos:

1. **Completar los estados responsive y recorridos no cubiertos de todas las áreas.** Usuarios, Roles, editor, Configuración, Perfil y acceso público ya tienen evidencia local a 320 px. Falta revisar los tableros externos y completar estados de tablas angostas y objetivos táctiles; cada superficie nueva se dibuja antes de implementarse.
2. Selección y acciones masivas cuando el backend tenga contrato. **El tablero las muestra con `<span>` en lugar de casillas reales, así que esa parte es referencia visual y no implementación aceptable.**
3. Completar el inicio autenticado, el diseño de estados 403/404 y marca real. La portada pública de acceso ya está aprobada e implementada.
4. Auditar que ningún campo se dibuje fuera de `FormField`, y terminar los avisos (el tablero de Avisos está parcialmente implementado).

Dispositivos, sesiones y cualquier pantalla sin contrato pertenecen a una fase funcional posterior; el fundamento visual no autoriza inventar endpoints ni permisos.

## Comparaciones cerradas

Cuando una decisión visual tiene más de una salida razonable, se compara antes de programarla y la comparación se tira cuando la decisión se toma. Lo cerrado hasta hoy:

| Decisión | Se comparó | Resultado |
| --- | --- | --- |
| Tonalidades de verde por zona | Salvia suave / Jade equilibrado / Bosque intenso, con ajuste por zona | **Jade equilibrado** (2026-09-30); solo sus colores fueron reemplazados por **Campo** el 2026-10-02 |
| Aplicación de campo | Maqueta de inspecciones, mantenimiento y agro | **Solo paleta Campo** (2026-10-02), conservando componentes, tipografía, tamaños y distribución; laboratorio retirado |
| Densidad de fila | 44 px densa contra 56 px cómoda | Se eligió 44 px; la escala compacta posterior y el estándar vigente usan **36 px mínimos** |
| Encabezado de pantalla | respirable / equilibrado / compacto, y con o sin estado expandido | Se eligió sin expandido ni antetítulo; la escala vigente usa **48 px mínimos**, adaptable en móvil |
| Submenú | pestañas en el encabezado / desplegable en el menú / carril lateral propio | **Desplegable en el menú lateral**, y desde 2026-09-28 **un carril lateral propio para Administración**: lo que estaba adentro del desplegable pasó al panel, y el desplegable quedó para los grupos de adentro |
| Rutas al agrupar | anidar `/gestion-usuarios/...` o dejarlas | **Se quedan** `/usuarios` y `/roles` |
| Conteos por opción de filtro | ahora o en una fase posterior | **Ahora**, con el contrato de backend que haga falta |
| Grupo del menú al entrar | abierto por defecto / plegado salvo el activo | **Plegado salvo el activo** |
| Submenú con la barra contraída | íconos sueltos / menú flotante / descontraer la barra | **Íconos sueltos**, sin componente nuevo. Administración no: contraída abre el panel, que es el ancho entero |
| Estado en el listado de usuarios | columna propia con texto / punto delante del correo | **Punto**, con la palabra para el lector de pantalla, a cambio de la columna de roles |
| Acciones de fila | un grupo con la destructiva última / la destructiva en un grupo aparte | **Un grupo**, con el rojo solo al interactuar |
| Paso de página | botones con texto / flechas | **Flechas**, con el nombre completo en el `aria-label` |
| Alta y edición de un rol | diálogo / pantalla propia | **Pantalla propia** (`/roles/nuevo`, `/roles/{id}`), porque con veinte áreas el diálogo no tiene dónde crecer |

Los laboratorios de encabezado y de verdes **ya se eliminaron** al cerrar sus comparaciones. Un laboratorio vive solo mientras su pregunta está abierta; si se queda, en un mes nadie sabe si es una propuesta vigente o un resto.

## Criterio de finalización de una pantalla

- Usa solamente tokens y componentes compartidos o amplía el sistema de forma deliberada.
- Cubre carga, vacío, error, éxito y falta de permiso cuando correspondan.
- Funciona con teclado, lector de pantalla, zoom y desde 320 px.
- Todo texto visible existe en español e inglés.
- Conserva estado compartible en URL cuando sea una colección.
- Pasa `npm run build`, `npm run lint` y `npm run test`.


## Configuración general (2026-09-30)

Diseño y plan precedieron al desarrollo; el pedido explícito del usuario autorizó su implementación.
La elección del 2026-10-01 reemplaza los cuatro destinos por una pantalla `/configuracion`
con tres `Surface` con título y margen interno: Preferencias regionales, Listados y Registro
de cuentas. `Page` comparte estado del borrador y Guardar/Descartar. El menú ofrece General como único destino para estos ajustes;
las cuatro URLs anteriores redirigen para conservar favoritos. `SettingsForm` compone las
secciones, `SettingsReview` compara los ajustes y `SettingsPage` coordina lectura, borrador y guardado.

Selectores nativos para idioma/zona/tamaño y RadioGroupField para el registro. La confirmación
explica el efecto del registro; la guarda común decide antes de perder un borrador. Un conflicto
presenta una tabla de los cuatro ajustes, con valor actual y borrador; el scroll horizontal queda
contenido en la tabla móvil. Conservar cambios incorpora los valores ajenos de campos no tocados.
El PATCH manda solo campos cambiados y expectedRevision, con un commit y una revisión. Los errores operativos, success, warning e
info van al Toaster abajo a la derecha; campos inválidos junto al control. Un resultado incierto
se consulta antes de permitir otro envío o descartar a ciegas.

Se verificaron los componentes productivos en navegador a 1280 y 320 px, con API simulada solo
para la revisión visual. La persistencia, autorización y caché se verificaron por integración real.
El laboratorio se retiró al promoverlo. Evidencia:

- [Aviso de guardado incierto](evidence/2026-09-30-configuracion-error.jpg).
- [Formulario a 320 px](evidence/2026-09-30-configuracion-movil.jpg).

Esta entrega no completa la migración de mensajes de otras pantallas; sigue el
[plan transversal](../plans/2026-09-30-unificacion-mensajes.md).

## Eventos de acceso dentro del chat aprobado — 2026-10-02

Ante la propuesta de una nueva presentación, el usuario indicó que el chat ya tenía su maqueta
y que otra tarea ajustaba sus colores. Se reutiliza la composición aprobada y los tokens comunes:
MessageBubble/ChatTimeline muestran resumen localizado y etiqueta «Acceso al sistema», con
hora y estado reales. No se agregan paletas ni una implementación paralela del historial.
El laboratorio aislado de esta propuesta se retira al integrar; el chat aprobado se conserva.

La metadata Access nunca muestra código, enlace secreto ni recuperación como borrador.
Business conserva su texto; Unclassified permite historia sin metadata. La evidencia local está
en `src/test/visual/screenshots/whatsapp-access-{es,en}-{1440,390,320}.png` y
`whatsapp-access-legacy-390.png`. Los tests `whatsapp-access.spec.ts` verifican móvil, ambos
idiomas, teclado, ausencia de secretos y toma de Manual. Son datos ficticios; no acreditan Meta
ni el teléfono real. Las pruebas visuales completas se registran en la evidencia del refactor.

## Inicio con assistant-ui — 2026-10-04

Se implementa la biblioteca elegida con `Thread/Composer/Message` compuestos desde shared/ui,
Campo y Public Sans, ancho de lectura 760 px y marco discreto sin banda Conversación. Pregunta
a la derecha, respuesta de lectura a la izquierda, fuentes tipadas debajo y compositor al pie.
Se dibujaron los estados faltantes antes de programarlos; el tablero local elegido usa piezas reales
y conserva evidencia `design-lab/history/home-assistant-comparison-2026-10-04/evidence/chosen-*.png`.
El Artifact privado no pudo
leerse ni actualizarse; esa sincronización no se declara completa.

La suite productiva incorpora once estados × es/en × 1440/390/320, incluida cancelación solicitada
confirmada tras recarga, más aceptación incierta, cooldown y un recorrido de lectura/GET fallido/borrado.
Sus capturas viven en `src/test/visual/screenshots/assistant-*.png`. Son contratos
ficticios exclusivos de pruebas: acreditan composición, teclado, foco y geometría; no prueban
consumo LLM real. Se revisaron manualmente respuesta es320/es1440, bloqueo en320 y cancelación
solicitada en320, sin overflow. El [registro del front](../verification/inicio-asistente-2026-10-04.md)
separa estas pruebas de la integración conjunta.

El selector y las bibliotecas descartadas salieron de la entrada activa. El tablero elegido vive en
`design-lab/home-assistant/chosen`; la comparación y sus archivos originales se conservan recuperables
en `design-lab/history/home-assistant-comparison-2026-10-04`. Su caché node_modules previa quedó
en la ubicación anterior por un archivo en uso; no contiene una entrada activa ni se usa en producto.
