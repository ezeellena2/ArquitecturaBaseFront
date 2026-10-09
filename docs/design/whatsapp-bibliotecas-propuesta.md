# Interfaces de chat para WhatsApp: comparación local

Fecha: **2026-10-04**. Estado: **maquetas para evaluar, sin elección ni adopción**.

## Tercera ronda: conservar la pantalla real y comparar sólo las burbujas

El usuario rechazó también Chatscope/Syncfusion nativos porque perdían la identidad
del chat. Puede interesarle la forma de los mensajes, pero no sus colores ni el
rediseño del resto. El tablero siguiente importa WhatsAppChatPage real y conserva
AppLayout, Page, bandeja, encabezado, historial, metadata, acciones y editor. Dos
opciones sobre los mismos datos: Actual / Redondeadas. Sólo cambia el radio y se
retira la punta en Redondeadas; padding, paleta Campo, Public Sans, bordes y estados
siguen siendo los del producto. La forma se inspira en Chatscope; este tablero
no monta su widget ni acredita la integración de esa biblioteca.

```text
Prueba visual: Actual | Redondeadas                         ES / EN
Chat real: título y Actualizar
┌──────────────────────┬───────────────────────────────────────────┐
│ Búsqueda             │ Nombre / teléfono / modo real            │
│ Todos / Sin leer     │ Historial real, mismas horas y estados   │
│ Contactos reales (*) │ Burbujas actuales o redondeadas          │
│                      │ Editor y Enviar originales              │
└──────────────────────┴───────────────────────────────────────────┘
(*) Componentes reales con contactos y operaciones ficticios.
```

Entrada aislada `shapes.html`, sin estilos de proveedores. La barra de comparación
queda fuera de la pantalla; cambiar forma no remonta el chat ni pierde el borrador.
Al iniciar se selecciona una vez el contacto ficticio Ana desde el arnés. Los datos
de pruebas se fechan relativos al inicio para permitir evaluar el editor en una
ventana ficticia abierta; ninguna llamada llega a una API real. Se revisan es/en,
1440/390/320, invariancia de colores/distribución, borrador, envío simulado y estados.
Las dos rondas anteriores quedan como procedencia rechazada, sin promoción.

### Implementación y evidencia de la tercera ronda

`ShapeComparison.tsx` monta la página real; `shapes.css` contiene únicamente el
radio asimétrico de 16/4 px y la retirada de la punta para Redondeadas. Los estilos
de la opción Actual vienen completos de `src/index.css`. No se cambiaron archivos
del chat productivo ni sus dependencias. Las consultas, lectura, viewport, editor,
estados/revisión e historial son los originales; el arnés sólo dobla sus respuestas.
El constructor del bundle evita que la extracción recursiva de dependencias arrastre
JS/CSS de los proveedores a esta entrada y conserva el orden de ejecución.

- [Redondeadas, escritorio](../../design-lab/whatsapp-chat/libraries/evidence/shape-rounded-es-1440.png).
- [Actuales, escritorio](../../design-lab/whatsapp-chat/libraries/evidence/shape-current-es-1440.png).
- [Redondeadas, móvil](../../design-lab/whatsapp-chat/libraries/evidence/shape-rounded-es-390.png).
- [Editor real en móvil](../../design-lab/whatsapp-chat/libraries/evidence/shape-rounded-es-390-editor.png).
- [Comparación de geometría/paleta y recorridos](../../design-lab/whatsapp-chat/libraries/evidence/shape-verification.json).

Se revisaron ambas formas a 1440/390/320 en es/en, sin cambios de color, tipografía,
padding, bordes, metadata ni geometría de la página al alternarlas. No se remonta el
editor; cambiar forma/contacto conserva el borrador. Se probó cola Pending, bloqueo
por permisos/ventana/envío incierto, resúmenes de acceso sin secretos, revisión e
historial anterior. El móvil conserva el scroll original; la barra del laboratorio
agrega altura y las capturas del editor muestran el tramo inferior por separado.
La vista compilada no carga JS/CSS de los proveedores ni hace peticiones externas.
Los cuatro recorridos del archivo nativo también pasaron con el nuevo bundle.

Producto: build sin advertencias, lint (48 controles) y 957 tests en 90 archivos en
verde. La suite visual completa obtuvo 114/116: un timeout en callback OIDC y una
diferencia en la captura del historial de acceso en inglés a 320 px. Ambos casos
pasaron al repetirlos solos con los mismos casos/referencias/tolerancias; se conserva
el resultado de la corrida completa, sin declarar una suite completa limpia ni una
causa definitiva. No se actualizaron snapshots. Persisten HydrateFallback,
NO_COLOR/FORCE_COLOR y, en la corrida larga, un intento de renovación silenciosa
del arnés que encontró la API local apagada. Se cerraron sólo los servidores propios
de pruebas en 5187; la vista compilada en 5185 queda disponible para evaluar.

## Segunda ronda: composición nativa, solicitada el 2026-10-04

El usuario rechazó las dos adaptaciones y autorizó comparar Chatscope con menos
intervención y Syncfusion. La primera ronda queda como procedencia, sin aprobación.
Esta ronda conserva AppLayout/Page y Public Sans fuera del chat; dentro de cada kit
se conservan sus colores, radios, espaciado y editor integrado. No trasladar esos
estilos al producto ni afirmar que la biblioteca incorpora transporte de WhatsApp.

Tablero previo: dos opciones sobre los mismos contactos y mensajes ficticios.
Chatscope compone MainContainer → Sidebar/ConversationList + ChatContainer con
ConversationHeader, MessageList y MessageInput. Syncfusion compone ChatUIComponent
con encabezado, historial y editor nativos, junto a una bandeja de controles comunes
(su Chat UI no aporta una bandeja de conversaciones). Iniciales, sin fotos remotas.
La bandeja ocupa aproximadamente 240 px; el resto corresponde a la conversación.
En móvil se alternan bandeja y chat con una acción Volver accesible.

Se mantienen conversación, carga, vacío, error con reintento, lectura sin envío,
ventana cerrada y revisión de envío incierto; biblioteca/escenario/idioma en la URL.
Cambiar biblioteca/chat conserva el borrador. Enviar agrega Pending en memoria,
sin inventar entrega. Las confirmaciones y avisos conservan las piezas compartidas.
Syncfusion se evalúa con su aviso de licencia original si no hay una clave válida;
no se oculta ni se presenta la maqueta como una licencia productiva.

Paleta del marco: tokens Campo (navegación, superficie, borde y texto); interior:
tema predeterminado de Chatscope y tema Fluent 2 de Syncfusion. No se homogeneizan
las burbujas: la diferencia de biblioteca es el eje que se compara. Revisión previa:
se retira el editor grande con botón externo que hacía converger ambas propuestas.

```text
Comparador: Chatscope | Syncfusion               Escenario / Idioma
Page: Chat · Maqueta                            Restablecer / Llegada
┌────────────────────┬────────────────────────────────────────────┐
│ Búsqueda / Sin leer│ Encabezado nativo + iniciales               │
│ Ana / Juan / ...   │ Historial nativo, fecha, hora y estado      │
│                    │ Editor compacto + envío integrado          │
└────────────────────┴────────────────────────────────────────────┘
```

### Implementación y evidencia de la segunda ronda

El selector ahora muestra Chatscope/Syncfusion. `library=chatscope` abre la
composición nueva; `library=chatscope-adapted` conserva la anterior. `NativeKits.tsx`
compone widgets reales y adapta sólo datos, iniciales, accesibilidad y estados.
Chatscope usa el editor integrado y sus estilos azules originales. Syncfusion usa
su encabezado, avatares por iniciales, historial, estado textual y editor Fluent 2;
la bandeja de conversaciones es compartida y no se atribuye al kit de Syncfusion.

Syncfusion 35.1.37 declara soporte para React 19 en su
[guía oficial](https://ej2.syncfusion.com/react/documentation/chat-ui/getting-started).
Su editor es imperativo: el adaptador sincroniza el borrador al cambiar de biblioteca
o conversación, nombres accesibles y bloqueo de envío. Cancela el append del kit
para mantener Pending en la cola simulada, con instante UTC ficticio; el texto
recibe escape HTML. Un ResizeObserver conserva el último mensaje al cambiar de
ancho si se estaba leyendo el final. El botón nativo de volver de Chatscope necesita
localizar el botón interior, porque su Back sólo pasa atributos al contenedor.

Las horas de Syncfusion usan la zona del navegador; las pruebas fijan Buenos Aires.
Antes de adoptar hay que resolver la zona del perfil y la integración real con
lecturas, scroll y envío. No se conectó ninguna API ni se cambió el producto.
Se conserva el aviso de evaluación original de Syncfusion, también en móvil.
La comparación carga aproximadamente 692 kB de JS y 1,35 MB de CSS de Syncfusion
antes de gzip; esos tamaños del laboratorio no entran al bundle productivo. Licencia,
coste de dependencias y adaptación deben evaluarse antes de elegir una biblioteca.

- [Chatscope nativo, escritorio](../../design-lab/whatsapp-chat/libraries/evidence/native-chatscope-es-1440.png).
- [Syncfusion nativo, escritorio](../../design-lab/whatsapp-chat/libraries/evidence/native-syncfusion-es-1440.png).
- [Chatscope nativo, móvil](../../design-lab/whatsapp-chat/libraries/evidence/native-chatscope-es-390.png).
- [Syncfusion nativo, móvil](../../design-lab/whatsapp-chat/libraries/evidence/native-syncfusion-es-320.png).
- [Cuatro recorridos es/en](../../design-lab/whatsapp-chat/libraries/evidence/native-verification.json).
- [Mismos recorridos en la vista compilada](../../design-lab/whatsapp-chat/libraries/evidence/built-native-verification.json).

Se comprobaron 1440/390/320 px, el último mensaje visible después de cambiar de
ancho, volver a la bandeja en móvil, borradores entre chats/kits, texto literal,
cola, carga/vacío/error, bloqueo de envío y revisión sin confirmar entrega.
Compilaciones del producto/laboratorio sin advertencias y lint (48 reglas) en verde;
955 pruebas Vitest en 90 archivos pasaron. Los cuatro recorridos del laboratorio
pasaron sin avisos de consola ni peticiones externas. El aviso visual de licencia
está presente; no se interpreta la ausencia de avisos de consola como licencia.

La regresión productiva se ejecutó completa: primera corrida con 113/116 y tres
errores ENOENT al cerrar trazas en la salida compartida. Se aisló salida/puerto
con `visual-product.config.mjs`, sin cambiar casos, referencias ni tolerancias:
113/116, con tres timeouts en callbacks OIDC. Los cuatro casos de sesión/código
se repitieron con la misma configuración y pasaron; no se atribuye una causa
definitiva a esos timeouts ni se declara una corrida completa limpia. No se
actualizaron snapshots. Persisten los avisos conocidos HydrateFallback y
NO_COLOR/FORCE_COLOR. El cierre de Vite del arnés siguió esperando después de
los casos; se identificó y cerró sólo cada servidor propio (5178/5187), obteniendo
los códigos finales de las corridas. La vista compilada en 5185 queda para evaluación.

## Primera ronda: rechazada, conservada como procedencia

El usuario pidió ver cómo quedarían bibliotecas de chat en código, conservando el
chat funcional. La entrada aislada `design-lab/whatsapp-chat/libraries/` compara tres
presentaciones sobre los mismos datos ficticios, dentro de AppLayout, Page y Surface
reales. No modifica rutas, dependencias, tokens, permisos ni transporte productivos.

| Vista | Componentes reales | Adaptación del laboratorio |
| --- | --- | --- |
| Actual | MessageBubble, MessageHistory, MessageDateDivider, Button y Textarea compartidos | Modelo de ejemplo común para comparar la estética, sin duplicar la API del chat. |
| Chatscope 2.1.1 | Avatar, Conversation, ConversationHeader, MessageList, Message y MessageInput | Campo/Public Sans, controles externos compartidos, editor de texto seguro, estados reales diferenciados y teclado. |
| React Chat Elements 12.0.18 | ChatItem, MessageBox e Input | Campo/Public Sans, teclado/foco en las filas, valor y accesibilidad del editor multiline adaptados explícitamente, estados propios fuera de la burbuja. |

Las versiones se fijan en package/lockfile propios. Chatscope declara React 19.
Elements declara React 18; la comparación prueba sus componentes con React 19.2.8
mediante `legacy-peer-deps` **sólo en el laboratorio**. Sus recorridos simulados no
demuestran compatibilidad general ni justifican adoptar una dependencia con ese
desajuste sin resolverlo. El producto conserva su React, router y paquetes.

Referencias: [Chatscope](https://github.com/chatscope/chat-ui-kit-react),
[React Chat Elements](https://github.com/Detaysoft/react-chat-elements).
Stream no se representa como un kit conectado al backend propio: su integración
documentada requiere su cliente/servicio y excede esta comparación visual.

## Qué se puede revisar

El selector vive fuera de la interfaz propuesta: Actual, Chatscope y React Chat
Elements. `library`, `scene` y `lang` se reflejan en la URL. Se puede buscar contactos,
filtrar sin leer, cambiar de conversación, escribir, cambiar de biblioteca sin
perder el borrador, simular una llegada y guardar una respuesta en la cola ficticia.
No hay generación de IA, botones de adjuntos activos, conexiones externas ni storage
de mensajes/borradores.

Los estados comparables son conversación, bandeja vacía, carga, fallo con reintento,
lectura sin permiso de envío, ventana cerrada y estados de envío. El caso de fallo
usa el Toaster compartido; la recuperación pertenece al contenido. Un mensaje
Failed puede preparar un borrador vacío, sin enviarlo ni pisar otro. Uncertain abre
ConfirmDialog y pasa a Reviewed, sin presentarse como Delivered. Un envío nuevo
queda Pending y bloquea otro; no se simula una confirmación de Meta. Las condiciones
duraderas se explican junto al editor.

Los textos del laboratorio salen de un namespace local es/en. Las fechas ficticias
son UTC y usan el formateador compartido con zona Buenos Aires. El menú/caparazón,
formularios externos y confirmaciones conservan el sistema del producto. Las clases
de los kits y sus adaptadores de tema sólo se importan en esta entrada.

## Evidencia y límites

- [Actual, escritorio](../../design-lab/whatsapp-chat/libraries/evidence/current-es-1440.png).
- [Chatscope adaptado, escritorio](../../design-lab/whatsapp-chat/libraries/evidence/chatscope-adapted-es-1440.png).
- [React Chat Elements, escritorio](../../design-lab/whatsapp-chat/libraries/evidence/elements-es-1440.png).
- [Chatscope adaptado, móvil](../../design-lab/whatsapp-chat/libraries/evidence/chatscope-adapted-es-390.png).
- [React Chat Elements, móvil](../../design-lab/whatsapp-chat/libraries/evidence/elements-es-390.png).
- [Recorridos del laboratorio](../../design-lab/whatsapp-chat/libraries/evidence/verification.json).

La revisión compara biblioteca, idioma y geometría a 1440/390/320 px; conserva
borradores por chat y entre bibliotecas, cola sin entrega inventada, bloqueo de envío,
recuperación y revisión. No acredita persistencia, Meta, una auditoría completa de
accesibilidad ni integración con las queries/acciones/viewport del chat real.
La sincronización del Artifact privado sigue pendiente; estas capturas son evidencia
local, no una actualización del lienzo externo.

Validación local: build del producto y del laboratorio sin advertencias de compilación,
lint (48 controles de arquitectura), 949 tests del front y 116 pruebas visuales en verde.
Los seis recorridos de la comparación terminaron sin avisos del navegador ni peticiones
externas. La instalación del kit de Chatscope avisa la deprecación de su dependencia
transitiva `@fortawesome/react-fontawesome` 0.2.x; no se cambia una dependencia del
producto para resolver ese aviso del paquete evaluado.

La regresión visual existente emitió el aviso de React Router sobre HydrateFallback:
`src/test/visual/preview.tsx` monta las rutas lazy sin ese fallback inicial. También
Node avisó la combinación NO_COLOR/FORCE_COLOR. No se silenciaron esos avisos ni se
actualizaron referencias. En Windows el runner esperaba el cierre de su Vite después
de terminar los 116 casos; se verificó/cerró sólo ese proceso del puerto 5178 y la
ejecución terminó con código 0. Resolver el fallback y el cierre automático del arnés
es un pendiente aparte; estos hallazgos no atribuyen un fallo al chat.

Antes de integrar hay que elegir la vista, resolver la compatibilidad de dependencias,
conservar los contratos de `src/features/whatsapp`, y revisar lectura/scroll, controles,
i18n, accesibilidad, envíos inciertos y regresiones de la ruta real. La comparación
se retira al promover una elección, preservando evidencia y decisiones útiles.
