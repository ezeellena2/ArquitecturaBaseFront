# Comparación de interfaces de WhatsApp

Maquetas solicitadas el 2026-10-04. Hereda la guía del laboratorio padre y el sistema
visual del front. La tercera ronda (`shapes.html`) importa WhatsAppChatPage real y
compara Actuales/Redondeadas conservando la identidad del producto. Sólo modifica
radio/punta de burbujas en CSS local; no monta ni importa los estilos de un proveedor.
Las dos rondas de bibliotecas fueron rechazadas y quedan como procedencia en index.

- Package y lockfile propios. React 19 como el producto; Elements declara React 18
  y se instala con legacy-peer-deps sólo acá. Registrar ese soporte sin confirmar;
  el recorrido de la maqueta no acredita compatibilidad general del paquete.
- Syncfusion 35.1.37 y tema Fluent 2 propios del laboratorio. Mantener visible su
  aviso de evaluación; no registrar una clave inventada ni ocultarlo. Draft/API
  imperativos del kit se adaptan en NativeKits, sin copiar transporte al producto.
- AppLayout, Page, Surface, controles externos y confirmaciones son los compartidos.
  Los componentes/estilos de cada kit sólo se permiten dentro de esta comparación.
- ShapeComparison no copia la página: usa sus hooks, timeline y editor reales. El
  bootstrap selecciona una vez Ana; shapeFixtures fecha datos relativos al inicio y
  dobla permisos, lecturas/cola/estados únicamente en memoria. Mantener las entradas
  compiladas separadas: shapes no debe cargar CSS/runtime de los proveedores.
- Mensajes, búsqueda, borradores y envíos son simulaciones en memoria. No llamar a
  Meta, proveedores ni API real; no persistir conversaciones ni borradores.
- Cubrir conversación, vacío, carga, recuperación, lectura sin envío y ventana
  cerrada, español/inglés y móvil. No confundir una maqueta con adopción productiva.
- Retirar esta comparación al integrar una elección, preservando la evidencia útil.
- verify.mjs usa puerto 5186. visual-product.config.mjs hereda los casos/referencias
  del producto con puerto 5187 y salida aislada para evitar colisiones de trazas.
- verify-shapes.mjs ejerce la vista compilada en 5185: compara colores, tipografía,
  padding y geometría de toda la página real entre formas a 1440/390/320 en es/en,
  además de borrador, cola, permisos, acceso seguro, revisión e historial anterior.

Detalle y límites: [diseño](../../../docs/design/whatsapp-bibliotecas-propuesta.md).
