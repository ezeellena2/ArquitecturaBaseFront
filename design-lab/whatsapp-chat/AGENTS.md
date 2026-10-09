# Maqueta de la bandeja de WhatsApp

Comparación solicitada el 2026-10-04: `libraries/` tiene entrada y dependencias propias
para comparar formas de mensajes sobre WhatsAppChatPage real en shapes.html,
conservando Campo/Public Sans y los controles originales. Las dos rondas anteriores
(adaptaciones y Chatscope/Syncfusion nativos) se rechazaron y quedan como procedencia.
Su [guía local](libraries/AGENTS.md) fija límites de paquetes,
compatibilidad y pruebas. No cambia ni promueve el chat productivo.

Estado actualizado: chat y configuración/prueba de IA se promovieron a features independientes.
Este laboratorio previo, sin versionar, se conserva como referencia y para sugerencias,
contactos/plantillas todavía pendientes; no borrar su trabajo sin procedencia recuperable.
La conexión IA del producto sigue [su propia guía](../../src/features/artificial-intelligence/AGENTS.md).
No copiar bootstrap, menú extendido, autenticación ni fixtures del laboratorio al producto.

Laboratorio simulado: los alcances nuevos siguen sin implementar. Hereda las reglas
de la raíz y el contrato visual local. Usa Page, Topbar y controles reales de shared/ui.

Propuesta del 2026-10-04: `?screen=ubicacion-lugar` compone `BusinessPlaceProposal`,
`businessPlaceCopy` y `businessPlaceModel`. Revisa sustituir el modal de coordenadas por
búsqueda por nombre en Google Maps (otra pestaña) y un enlace copiado de la ficha elegida.
El nombre/dirección son manuales; no simular autocompletado, importar datos ni inferir un
lugar de una búsqueda. Guardado sólo en memoria. Pendiente de aprobación, fuera del
producto: [diseño y alcance](../../docs/design/ubicacion-por-lugar.md).
PanelProposalLayout compone temporalmente el menú y dos paneles con las medidas
del Sidebar actual; no modifica el layout productivo antes de elegir el diseño.

- Datos ficticios, sesión en memoria y operaciones simuladas. No llamar a Meta ni
  conectar esta entrada con la API real; no guardar mensajes o borradores en storage.
- Mantener esta entrada fuera del router y del build productivos. El CSS solo compone
  el laboratorio con tokens existentes; no cambia los controles compartidos.
- Antes de promoverla, cerrar alcance y convivencia con el bot, diseñar contratos,
  permisos y persistencia, y obtener elección explícita del usuario.
- Retirar el laboratorio al implementar la decisión elegida.

El recorrido y las preguntas abiertas están en docs/design/whatsapp-chat-propuesta.md.

Revisión de sugerencias del 2026-10-02: `?screen=sugerencias` compone
`AiReviewChatProposal`, con `aiReviewCopy.ts` y MessageHistory/MessageBubble reales.
No ofrece activar el antiguo bot de acceso. Generar, cancelar, revisar fuentes,
pasar al borrador, confirmar un reemplazo y enviar son simulados. Una nueva entrada
invalida la propuesta anterior; cambiar de chat cancela su generación y conserva
solo su borrador. No modificar el chat productivo al revisar este tablero.

La propuesta de conexión LLM vive en `AiConnectionProposal.tsx`, con textos es/en en
`aiCopy.ts`. Desde la corrección del 2026-10-02 muestra un formulario común; se retiró
la separación negocio/personal. El alcance confirmado es una conexión compartida
de la instalación, administrada por el propietario. La conexión productiva ya admite
OpenAI/Anthropic; sugerencias e información del negocio siguen pendientes del plan
del 2026-10-03. La base se clona para instalaciones
independientes, sin compartir credenciales ni datos entre negocios. Guardar, probar,
quitar y revisar son simulados;
solo se aceptan claves ficticias `demo-`. No persistir ni registrar credenciales.
Entrar con `?screen=ia`; los modelos son ilustrativos y no afirman disponibilidad.

Corrección de alcance del 2026-10-02: el usuario eligió configurar primero la
conexión general de la instalación en Administración → Configuración → IA.
`preview.tsx` extiende solo su menú aislado y compone AppLayout/Sidebar reales,
con las pantallas existentes de General, Apariencia y Chat y fixtures ficticios.
La configuración muestra proveedor/modelo, credencial/prueba y disponibilidad;
no incluye información del negocio, prompts ni respuestas del chat. Probar no
guarda; no registrar ni devolver una clave configurada. El formulario se promovió al
producto; este tablero conserva únicamente su simulación.
El chat principal usa WhatsAppChatPage; el tablero de sugerencias se conserva
como propuesta postergada en su entrada explícita. No modificar navigation.ts,
las rutas ni los servicios productivos para implementar el laboratorio.

Ronda final del 2026-10-02: `ContactsProposal` (listado/ficha/chat), `TemplatesProposal`
(crear y consultar revisión simulada, entrega posterior), `ConnectionProposal`
(diagnóstico de solo lectura y configuración asistida), `AccessProposal` (matriz
local de permisos, no cambia roles reales) y `AiSuggestionProposal` (nunca envía,
preserva borrador y cancela al salir del chat). Datos comunes en `proposalContacts.ts`
y textos es/en en `finalCopy.ts`; entradas `contactos`, `plantillas`, `conexion`,
`permisos` además de `ia`. No habilitar estos enlaces en producto antes de implementar
cada entrega. No insertar funciones ni nombres de clientes reales en el bot base.

Ronda de color de acciones (2026-10-03): el usuario pidió conservar el diseño anterior
y ajustar sólo un botón; descartó el azul petróleo por diferir del resto. Sugerir con IA
usa ahora Button principal (`default`), con el verde sólido del sistema y su forma/tamaño
anteriores. Panel, otros botones e íconos conservan el tablero previo; sin tokens nuevos
ni CSS propio del botón. El usuario aprobó el ajuste y eligió historial + información
básica del negocio. Primero se maqueta su editor; generación productiva sigue pendiente
del [plan actualizado](../../../ArquitecturaBase/docs/plans/2026-10-03-sugerencias-ia-whatsapp.md).

Información del negocio (2026-10-03): `?screen=negocio` compone
`BusinessInformationProposal` y `businessInformationCopy.ts`, con Page/Surface y
formularios del sistema en es/en. Tres bloques: datos/atención, servicios/condiciones
y FAQ libre. Datos y guardados en memoria, sin API ni consumo de IA. El selector de
estados reinicia datos ficticios. Conflicto conserva las ediciones explícitas y permite
incorporar datos ajenos sin guardar; incertidumbre se resuelve por comprobante simulado,
nunca por igualdad de perfiles ni ausencia de recibo. Mensajes con notifications y
decisiones con ConfirmDialog. Propuesta elegida y promovida el 2026-10-03 a la feature artificial-intelligence; esta entrada conserva su simulación.
Los límites y el permiso settings.manage del arnés no definen contratos productivos.
La entrada precarga los namespaces es/en antes de extender common y mantiene un solo
enlace de IA; no copiar esas mutaciones del menú o bootstrap al producto.

Propuesta guiada (2026-10-03), **promovida después a producto**: `?screen=negocio-guiado`
ahora redirige al catálogo de BusinessInformationPage real con datos ficticios; el prototipo
dejó de ser una entrada activa. Archivos previos sin versionar se preservan como referencia,
sin importarlos en producto. La descripción siguiente documenta la propuesta histórica:
conservaba la entrada anterior y
compone `BusinessInformationGuidedProposal`, `businessGuidedCopy` y `businessGuidedModel`.
El punto elegido genera un enlace Maps URL sin clave ni SDK de Google; mapa y búsqueda
son ilustrativos. La aclaración del usuario descarta integrar Places para obtener el enlace.
Horarios semanales con franjas, cerrado/24 horas/sin definir, cruce de medianoche explícito
y fechas especiales. FAQ predefinidas sin respuestas inventadas; sólo las completas cuentan.
Modelo, datos y guardado viven en memoria: no convertir estas estructuras al contrato
productivo de siete textos sin diseñar antes su evolución y migración. La feature real
de Información del negocio sigue implementada; esta mejora sólo está propuesta.
Tests de lógica en el laboratorio y recorrido responsive es/en en `src/test/visual`.
Ver [diseño y pendientes](../../docs/design/informacion-del-negocio-guiada.md).
