# Información del negocio: editor guiado — 2026-10-03

**Promovido a la aplicación por pedido explícito del usuario.** La descripción que sigue
conserva la propuesta previa como procedencia; sus pendientes se resolvieron en la entrega
documentada en [la fuente funcional](../../../ArquitecturaBase/docs/features/inteligencia-artificial.md#editor-guiado-y-evolución-del-contrato).
La vista local actual usa la página productiva con datos ficticios:
`/src/test/visual/index.html?screen=/configuracion/negocio&scenario=business-guided&lang=es`.
La antigua entrada `?screen=negocio-guiado` redirige allí; el prototipo ya no es una pantalla
activa. Sus archivos previos sin versionar se preservan como referencia y no se importan en producto.

Implementado: Leaflet 1.9.4 con teselas OSM al abrir el diálogo, navegación/clic y coordenadas
manuales; dirección escrita manualmente y enlace generado en el servidor. Sin búsqueda por
dirección ni integración Google Places. Horarios locales, zona IANA, hasta cuatro franjas por
día y 32 fechas especiales; hasta 20 FAQ con respuestas vacías. JSONB nullable conserva textos,
revisión, auditoría y comprobantes anteriores; el editor permite revisión manual de esos textos.
Conflicto combina grupos atómicos; guardado incierto conserva cuerpo/UUID. Bootstrap y fixtures
no se copiaron al producto. WhatsApp y generación siguen pendientes.

Mapa real revisado en navegador con ubicación de prueba; pruebas automáticas usan teselas y
API simuladas. Disponibilidad/licencia de otro proveedor y validación en producción requieren
su comprobación propia. [Política OSM](https://operations.osmfoundation.org/policies/tiles/),
[evidencia y verificaciones](../../../ArquitecturaBase/docs/reviews/2026-10-03-informacion-del-negocio-guiada.md).

## Procedencia: propuesta anterior

Entrada local: `http://127.0.0.1:5180/design-lab/whatsapp-chat/?screen=negocio-guiado`.
Agregar `&lang=en` muestra inglés. `?screen=negocio` conserva la propuesta anterior.

El usuario pidió elegir una ubicación, preguntas frecuentes predefinidas y horarios
con opciones. Después aclaró que necesita **guardar un enlace de la ubicación para
compartirlo más adelante por WhatsApp**, sin integrar específicamente Google Maps.
Esta aclaración reemplaza la propuesta inicial de conectar Places. El mapa del tablero
es un dibujo ilustrativo; sus direcciones y selecciones son ficticias.

## Diseño propuesto

- `Page`, `Surface`, campos, selectores, diálogos, confirmaciones y tooltips existentes.
  Paleta Campo, Public Sans y geometría de la aplicación; no cambia el sistema visual.
- Ubicación: local, zona de atención o ambos. Dirección, referencia y zona conservan
  entrada manual. Elegir un punto prepara un enlace generado con sus coordenadas;
  confirmar en el diálogo modifica el borrador, Guardar confirma sólo la simulación.
  No se copia una dirección obtenida de un servicio real.
- Horarios: semana completa con Sin definir, Abierto, Cerrado y 24 horas. Selectores
  de 24 horas con opciones cada 15 minutos; varias franjas por día. Cierre anterior a
  apertura exige indicar explícitamente el día siguiente. Validación de incompletos,
  orden y superposiciones, incluido domingo/lunes. Copiar lunes a viernes deja cambios
  revisables; fines de semana se conservan. Fechas especiales separadas y zona horaria
  ilustrativa de General; no se inventan horarios de feriados no confirmados.
- FAQ: catálogo inicial genérico (reservas, pagos, entregas, presupuesto, cambios y
  estacionamiento), preguntas editables y preguntas propias. Ninguna respuesta se
  precarga; sólo pares completos cuentan como información confirmada. Los ejemplos
  de preguntas se pueden quitar. No inferir precios, stock, envíos ni políticas.

El panel semanal adapta columnas al espacio de su contenedor, además del viewport;
un panel angosto no recorta los selectores. En 390/320 px los bloques se apilan.

## Enlace y WhatsApp

El enlace usa `https://www.google.com/maps/search/?api=1&query=latitud,longitud`,
con parámetros codificados. [Maps URLs](https://developers.google.com/maps/documentation/urls/get-started)
permite generar enlaces sin clave de Google. Generar un enlace es independiente del
proveedor del mapa que se elija para el selector real; **no implica que Google ofrezca
gratis un mapa embebido, búsqueda o geocodificación**. La maqueta no usa esos servicios.

Un futuro mensaje de WhatsApp puede incluir el enlace como texto. Enviar una ubicación
nativa es otra función: necesita coordenadas y el contrato de envío de Meta. Ninguna
de las dos acciones de envío se agregó en este tablero ni en el chat productivo.

## Estado y siguientes pasos

Sólo es una propuesta local, con estado en memoria y sin SDK externo, API real,
almacenamiento o llamadas facturables. La pantalla productiva sigue usando sus siete
textos, permisos propios, revisión y comprobantes. Estos objetos no se serializan a
esos textos como adaptación; la evolución requiere contratos y migración explícitos.

Antes de promover:

1. Elegir el diseño y el selector real de mapas, con su licencia, atribución, proveedor
   de mapas/búsqueda y disponibilidad. Una alternativa inicial puede aceptar un enlace
   copiado por el administrador; no se puede leer automáticamente la selección hecha
   en otra página de Maps sin una integración.
2. Definir dirección, punto opcional y enlace, con límites y validación. El enlace
   generado depende del punto; una dirección editada no confirma otras coordenadas.
   Si se aceptan enlaces pegados, permitir HTTPS/destinos conocidos y nunca resolver
   URL arbitrarias desde el backend ni cargar HTML externo como parte del formulario.
3. Definir horarios locales, zona IANA, cruces de medianoche, excepciones y FAQ tipadas,
   incluyendo límites y fechas duplicadas. Conservar Sin definir como ausencia de
   información y distinguir atención presencial de entrega si el negocio lo necesita.
4. Migrar el contenido libre existente conservándolo para revisión. Mantener
   `ai.business.read/manage`, permisos HTTP, transacción única, revisión y recuperación
   de guardados inciertos de Información del negocio. El módulo continúa independiente
   de WhatsApp; compartir el enlace se implementa luego desde el caso de uso del chat.
5. TDD del modelo/casos de uso, tests HTTP/persistencia con Docker y pruebas de mapa
   real elegidas para esa entrega. Las pruebas automatizadas no usarán claves reales
   ni servicios de pago.

Verificación de esta ronda: tests puros del laboratorio y Playwright en español/inglés
a 1440/390/320, incluyendo selección simulada, enlace, error de horario, corrección,
FAQ vacía/completa y ausencia de pedidos externos. Los resultados finales y capturas
figuran en [el fundamento visual](visual-baseline.md).
