# WhatsApp: chat de atención

`/whatsapp/chat` (`whatsapp.read`) reúne la bandeja y la conversación: historial, respuesta de texto, envío de formularios, revisión de sugerencias del asistente, respuestas de formularios y audios recibidos. Promueve el chat elegido de `design-lab/whatsapp-chat` sin importar el laboratorio. Una instalación comparte un número: no hay claves ni configuración por operador.

| Carpeta | Contenido | Guía |
|---|---|---|
| `api` | Rutas y guards zod de chat, formularios, respuestas, asistente y audio | [api](api/AGENTS.md) |
| `lib` | Reglas puras: línea de tiempo, guardas, intentos congelados, valores y retiro privado | [lib](lib/AGENTS.md) |
| `hooks` | Lecturas por actor, gate de valores, envío de formularios, sugerencias y transcripción | [hooks](hooks/AGENTS.md) |
| `components` | Conversación, historial, compositor y diálogo de formularios | [components](components/AGENTS.md) |
| `pages` | `WhatsAppChatPage` y los tests de página | esta guía |

## Al modificar

- **Permisos.** `whatsapp.read` lee bandeja, hilo y audio y marca leído; `whatsapp.send` responde, envía formularios, revisa sus envíos inciertos y toma Atención manual; `whatsapp.configureassistant` activa Asistente. `formrecords.read` gobierna valores de respuestas, explicaciones y avisos automáticos; `users.read`, el correo de la cuenta vinculada. Son experiencia: el servidor decide, y su 403 o `canReadFormRecords` prevalecen sobre la lista local.
- **Modo compartido.** Manual es el inicial y el único en que el operador responde; Assistant es una elección explícita: el asistente sólo ofrece formularios y aclaraciones con botones, y en Manual deja sugerencias para revisar. Bot y Manage están retirados, sin alias.
- **Frontera.** No importa `business-forms`, IA ni otra feature: formularios, metadata y sugerencias tienen contratos propios en `api`. No se agrega otra cola ni otra caché; el hilo, las salidas y el gate de lectura existentes alcanzan.
- **Página.** `WhatsAppChatPage` monta la bandeja con el usuario como clave (otra cuenta empieza de cero). La conversación elegida vive en `?conversacion=` con historial del navegador; búsqueda, filtro No leídos y página quedan en el estado de la bandeja. El preview usa «Borrador», el resumen de acceso o el texto del servidor (respuesta de formulario y avisos son textos fijos, sin valores). Bandeja e hilo se consultan cada 5 s mientras la ventana está visible y dejan de hacerlo ante un 403, sin leyenda del intervalo. Un refresco fallido de la bandeja conserva lo visible y lo avisa la notificación común de la consulta; `Page` no lleva `status`, y «No se pudo cargar el chat.» aparece sólo si no hay conversaciones que mostrar.
- **Borradores.** Texto, intento y formulario se guardan por conversación en la página; cambiar de chat no los pierde y la guarda de salida considera texto escrito, un intento sin resolver o un formulario tocado.
- **Privado en memoria.** Borradores, intentos de formularios y sugerencias, propuestas y bytes de audio pertenecen a su dueño, fuera de MutationCache, URL, storage y logs; las lecturas se particionan por actor, cultura y permisos y se retiran al cambiar ese contexto.
- **Textos y fechas.** Namespace `whatsapp` en es/en, piezas de `shared/ui` y zona horaria del perfil con `shared/lib/dateTime`.
- **Pruebas.** Comportamiento con MSW (`WhatsAppChatPage.test.tsx`, `WhatsAppForms.test.tsx`); cuerpos exportados del backend en `*Http.test.tsx` y `api`; navegador en `src/test/visual` (`whatsapp*.spec`, `chatForms`, `chatCatalogs`, `formActionMessages`). Ningún doble acredita Meta, el modelo ni la entrega real.

## Referencias

- [Regla funcional del chat](../../../../ArquitecturaBase/docs/features/whatsapp.md#chat-de-atención--2026-10-02) y [arquitectura del área](../../../docs/architecture.md#áreas-con-guía-propia).
- [Diseño del chat](../../../docs/design/visual-baseline.md#chat-de-whatsapp), [formularios por WhatsApp](../../../docs/design/formularios-whatsapp.md) y [propuestas abiertas](../../../docs/design/visual-baseline.md#propuestas-abiertas) (contactos y plantillas).
- [Historial de mensajes](../../../docs/guides/premisas-de-desarrollo.md#historial-de-mensajes-2026-10-02) y [contrato de mensajes](../../../docs/guides/mensajes-y-estados.md).
