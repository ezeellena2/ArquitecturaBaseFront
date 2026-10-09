# Comparación de interfaces de WhatsApp

Propuesta solicitada el 2026-10-04, sin promover al chat productivo.

Desde la raíz del front:

```powershell
node node_modules/vite/bin/vite.js --config design-lab/whatsapp-chat/libraries/vite.config.mjs
```

Abrir http://127.0.0.1:5185/design-lab/whatsapp-chat/libraries/shapes.html.
La comparación vigente usa WhatsAppChatPage real: Actuales / Redondeadas. Sólo
cambia la silueta de las burbujas, conservando colores, tipografía, bandeja, metadata,
acciones y editor. La forma se inspira en Chatscope, pero esta entrada no monta su
widget. No adopta una biblioteca ni modifica el producto. `shape` y `lang` viven en
la URL; `scenario` acepta conversation, read-only, closed, empty, loading,
chat-states, chat-history y chat-access. Datos fechados relativos al inicio y envío
simulado en memoria; el bootstrap abre una vez Ana para ver la conversación.

`index.html` conserva la segunda ronda Chatscope/Syncfusion nativos, también
rechazada por perder la identidad del producto. La primera ronda sigue accesible con
`?library=chatscope-adapted` (también current/elements), sin promoción.
Los envíos quedan en cola **simulada**, sin afirmar entrega ni hacer peticiones a Meta.

Para servir la vista compilada desde esta carpeta:
`node ../../../node_modules/vite/bin/vite.js preview --config vite.config.mjs --host 127.0.0.1 --port 5185 --strictPort`.
`node verify.mjs --built` repite los recorridos sobre esa vista, sin levantar otro servidor.
`node verify-shapes.mjs` verifica la nueva entrada compilada, incluyendo invariancia
de colores/medidas/controles entre formas y las acciones reales con datos simulados.
Evidencia en `evidence/shape-verification.json` y `shape-*.png`. La configuración del
bundle separa dependencias sin capturarlas recursivamente y conserva el orden de
ejecución; shapes no carga estilos/runtime de los proveedores del archivo histórico.

Instalación reproducible dentro de esta carpeta:

```powershell
npm ci --legacy-peer-deps --ignore-scripts --no-audit --no-fund
npm run build
npm run verify
```

Dependencias/lockfile propios, fuera del router y de las entradas productivas.
Chatscope 2.1.1 declara React 19. React Chat Elements 12.0.18 declara React 18.2;
se prueba aquí con React 19.2.8 mediante `legacy-peer-deps`, sin afirmar soporte
general. Su Input multiline necesita sincronización explícita del valor y atributos
accesibles: ese adaptador está documentado en ChatKits.tsx. También se agregan foco
y teclado a sus filas de conversaciones. No copiar este bootstrap al producto.

`verify.mjs` inicia/cierra su servidor en 5186, ejerce los cuatro recorridos es/en,
registra errores/avisos y peticiones externas, y captura escritorio/390/320 px y
los estados. `evidence/native-verification.json` conserva los resultados. Los kits
de la segunda ronda viven en [NativeKits.tsx](NativeKits.tsx), los anteriores en
[ChatKits.tsx](ChatKits.tsx); la composición, en [Comparison.tsx](Comparison.tsx).

Syncfusion/Fluent 2 35.1.37 se evalúa sin licencia registrada. Se conserva su aviso
original; la evaluación no concede una licencia productiva. Su SDK soporta React 19
desde 29.1.33, según [la guía oficial](https://ej2.syncfusion.com/react/documentation/chat-ui/getting-started).
El editor imperativo necesita sincronizar texto, atributos accesibles y bloqueo de
envío. Se cancela el append nativo para que la cola simulada mantenga fecha/estado.
El render HTML del kit recibe texto escapado. Las horas de Syncfusion usan la zona
del navegador (BA en pruebas); la adopción debe resolver la zona del perfil.

La regresión visual productiva se puede ejecutar con su configuración heredada y
puerto/salida separados para evitar colisiones entre sesiones del mismo checkout:
`node ../../../node_modules/@playwright/test/cli.js test --config visual-product.config.mjs`.
No cambia casos, snapshots, tolerancias ni avisos del arnés productivo.

La opción `library=current` del archivo histórico reutiliza MessageBubble/MessageHistory
y controles reales sobre su modelo ficticio. La entrada nueva importa la página entera,
incluidos hooks y editor; los dos arneses simulan sus operaciones y no aportan transporte.
No se incluye Stream: la conversación anterior lo distinguió por depender de su servicio,
y estas maquetas evalúan la presentación sobre nuestro backend.

Diseño, capturas y criterio de adopción: [propuesta](../../../docs/design/whatsapp-bibliotecas-propuesta.md).
