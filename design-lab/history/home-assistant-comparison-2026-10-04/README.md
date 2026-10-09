# Cuatro bibliotecas en el Inicio

Propuesta solicitada el 2026-10-04. La comparación mantiene el caparazón Campo/Public Sans
y cambia la biblioteca de conversación. Entrada vacía: bienvenida y preguntas sugeridas;
conversación: pregunta del usuario, respuesta con datos y fuente, repregunta y respuesta breve;
compositor al pie. Sin la banda titulada Conversación de la propuesta rechazada.

El mismo contenido y escenario permite comparar tamaño, respiración, burbujas, editor y acciones.
Las dependencias viven únicamente aquí. No se conectan claves ni servicios de generación.
La selección es una propuesta y no cambia el Inicio productivo.

## Abrir

Desde esta carpeta: `npm ci --ignore-scripts` y `npm run dev`.
http://127.0.0.1:5184/design-lab/home-assistant/libraries/index.html?library=assistant-ui&lang=es&scene=answer

Pestañas: `assistant-ui`, `ai-elements`, `copilotkit`, `chatkit`. Escenarios `empty/answer`, idiomas
`es/en`. El usuario puede enviar preguntas de usuarios/roles/ayuda; las respuestas son fixtures,
no inferencia. Nueva conversación confirma; Historial abre el ejemplo guardado en memoria.
La entrada anterior en 5182 redirige aquí. Los archivos del dibujo previo conservan la procedencia.

## Componentes ejecutados

| Ejemplo | UI real | Adaptación local |
| --- | --- | --- |
| assistant-ui | Thread oficial y sus componentes del registro; ExternalStoreRuntime | Mensajes locales, sugerencias, cancelar y traducción de textos principales. |
| AI Elements | Conversation, Message, MessageResponse y PromptInput de su registro | Coordinación local y composición del vacío/sugerencias con sus controles base. |
| CopilotKit | CopilotChatView v2, proveedor y CSS publicados | Mensajes y callbacks locales; sin runtime de agentes. Inspector y consola de desarrollo desactivados. |
| ChatKit | Componente oficial, wrapper React e iframe de su CDN | Custom API fetch con JSON/SSE ficticio conforme a los tipos oficiales. No requiere una clave para esta simulación. |

Versiones exactas del laboratorio en package-lock.json. Las dependencias no entran en el bundle
productivo. El tema y Public Sans se mantienen; cada biblioteca conserva sus formas y composición.
Sus controles propios sólo están autorizados dentro de esta comparación por el pedido del usuario.

ChatKit necesita internet para su componente y la tipografía pública; el iframe bloquea fuentes
de loopback y data por sus políticas, por lo que Public Sans usa una URL pública con versión fija.
Se observaron solicitudes de telemetría del SDK y avisos CORS de sus settings externos que no
interrumpieron la interfaz. La prueba intercepta el colector Datadog y registra esos avisos;
no se desactiva ni altera la seguridad del iframe. Revisar esto antes de una adopción productiva.

`verify.mjs` revisa 48 combinaciones: cuatro bibliotecas × vacío/conversación × es/en × 1440/390/320.
Prueba envío, repregunta, editor limpio, Historial/Escape y cancelar Nueva conversación.
La respuesta común usa una lista breve de cantidades, legible desde 320 px sin depender del
scroll horizontal interno de las tablas de cada renderer. `verify-recovery.mjs` verifica además
la carga CDN fallida de forma aislada y la redirección de la entrada anterior.
`evidence/verification.json` conserva resultados y notices externos; hay una captura por combinación.
Build del laboratorio completo: correcto, con aviso de chunks grandes por los renderers completos
de código/fórmulas/diagramas de las bibliotecas. Este paquete comparativo no es el bundle a promover.
