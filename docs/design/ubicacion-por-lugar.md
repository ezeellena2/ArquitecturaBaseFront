# Ubicación por lugar: propuesta para aprobación

Fecha: 2026-10-04. El recorrido externo original queda como antecedente. El pedido posterior de
integrar autocomplete se implementó: nombre/ciudad → sugerencia → ficha completa de Google
Maps → Guardar PlaceId con datos manuales. La maqueta no se copió.
[Configuración y condiciones pendientes](../../../ArquitecturaBase/docs/guides/configurar-google-places.md).

Las secciones siguientes describen la propuesta y la preparación anteriores; no son el contrato
actual. La clave de sitios web se conserva para SDK JavaScript; el REST implementado necesita
una segunda credencial restringida para servidor.

El usuario rechazó el modal pequeño que pone latitud/longitud en primer plano. Quiere
elegir un lugar conocido, como Sanatorio Plaza, conservar su enlace y comprobar dónde
queda antes de compartirlo por WhatsApp. Pidió ver el nuevo diseño antes de aprobarlo.

## Recorrido propuesto

1. En Información del negocio, buscar el nombre del lugar y la ciudad.
2. Buscar en Google Maps abre otra pestaña con la búsqueda; allí se elige la ficha correcta
   y se revisa el mapa completo, con sus controles de zoom e indicaciones.
3. Desde Compartir → Copiar enlace, pegar el vínculo en Enlace del lugar. También se
   admite la URL completa de la ficha en la barra del navegador.
4. Completar el nombre para mostrar, dirección opcional y referencia. Estos valores son
   manuales; una búsqueda por nombre no acredita una selección ni importa datos.
5. Comprobar en Google Maps abre ese mismo enlace. La vista previa muestra el texto y
   vínculo que se prepararán para compartir. Guardar confirma el conjunto del negocio.

En la maqueta, **Guardar en la maqueta** sólo confirma el estado en memoria. No existe
todavía guardado de enlaces de fichas en la API ni envío por WhatsApp.

## Diseño y viabilidad

Se conservan Campo, Public Sans, Page, Surface, FormField, Input y Button existentes.
El formulario y la vista previa quedan en la página, sin modal ni coordenadas como tarea
principal. Con espacio suficiente se ven lado a lado; en móvil se apilan, con botones
que caben en su superficie, foco y errores por campo. Ningún mapa se carga al entrar.

Se abre Google Maps para usar su búsqueda y revisar el lugar. [Maps URLs](https://developers.google.com/maps/documentation/urls/get-started)
admite búsquedas por nombre sin clave de API. Guardar el enlace exacto es diferente de
guardar coordenadas o una URL de resultados: permite volver a la ficha seleccionada.
Las opciones de Compartir se documentan en [la ayuda oficial](https://support.google.com/maps/answer/7101463).

Esta elección conserva la decisión anterior de no exigir una integración específica.
Un buscador de lugares con resultados y selección dentro de la aplicación sería otro
alcance: [Places API](https://developers.google.com/maps/architecture/maps-url), configuración
de proveedor y revisión de costos/condiciones. La maqueta no simula que eso ya existe.

## Preparación de Google Places solicitada — 2026-10-04

Después de revisar el costo del autocompletado, el usuario pidió ayuda para configurar
Google Cloud y eligió un proyecto nuevo. Esto prepara la cuenta para evaluar sugerencias
dentro de la aplicación; no acredita integración, guardado ni aprobación de un diseño
con autocompletado. El recorrido externo de arriba sigue siendo la maqueta existente.

Estado comprobado en la consola del proyecto `ArquitecturaBase`: el usuario completó el
alta y la página de facturación muestra **Plan actual: Pago por uso**. Maps JavaScript API
y Places API (New) están habilitadas. La clave existente tenía 32 APIs permitidas y una
sola fila con las tres URLs pegadas, precedidas por un asterisco. Se corrigió y guardó:
**Sitios web**, tres entradas separadas de desarrollo (listadas abajo) y sólo las dos APIs.
Se volvió a abrir la edición y se comprobaron esas restricciones persistidas.
[Evidencia sin el valor de la clave](../../design-lab/whatsapp-chat/evidence/google-places-key-restrictions-saved.png).

Alertas de presupuesto y cuotas siguen pendientes; se consultó al usuario el monto de
referencia para las alertas. El agente no creó ni leyó la clave, ni llamó a Places con ella.
No hay integración productiva ni prueba real del autocompletado todavía.

Pasos para desarrollo con el autocompletado de Maps JavaScript:

1. Iniciar sesión en [Google Cloud](https://console.cloud.google.com/google/maps-apis/overview)
   con la cuenta que administrará esta instalación. Crear un proyecto dedicado a desarrollo,
   por ejemplo `ArquitecturaBase Places Desarrollo`; anotar su ID sin credenciales.
2. Vincular una cuenta de facturación. Quien administra completa los datos de pago y
   acepta los términos de Google. Revisar la modalidad por uso antes de elegir un plan.
3. En APIs y servicios → Biblioteca, habilitar **Maps JavaScript API** y **Places API (New)**.
   El [widget nuevo](https://developers.google.com/maps/documentation/javascript/place-autocomplete-new)
   necesita Places API (New); no habilitar la versión Legacy para este recorrido.
4. Crear una clave exclusiva para el navegador de desarrollo. Aplicar **restricciones de
   aplicación: Sitios web**, con los orígenes locales que realmente se vayan a usar:

   ```text
   https://localhost:5173/*
   http://localhost:5173/*
   http://127.0.0.1:5180/*
   ```

   Aplicar **restricciones de API** a Maps JavaScript API y Places API (New), como indica
   la [guía oficial de seguridad](https://developers.google.com/maps/api-security-best-practices).
   No usar comodines globales ni reutilizar credenciales del ingreso con Google. Producción
   lleva otra clave con su dominio exacto; no ampliar la de desarrollo a sitios públicos.
5. Antes de una consulta real, acordar el gasto aceptado y revisar las cuotas disponibles
   de cada API y las alertas de facturación. Un presupuesto **avisa pero no corta** el gasto;
   las cuotas limitan pedidos, según las dimensiones que ofrezca cada servicio. No prometer
   un corte mensual exacto ni costo cero por configurar una alerta. Ver
   [control de costos](https://developers.google.com/maps/billing-and-pricing/manage-costs).
6. Conservar la clave fuera de Git y del chat. La clave del SDK web será visible al navegador:
   sus restricciones son necesarias aunque se entregue desde configuración local. Una clave
   de servidor sería otra credencial con otras restricciones. Todavía no hay variable ni
   pantalla de configuración de Maps en el producto: se definirán con la integración.

El costo de la selección también depende de los datos solicitados, no sólo de las
sugerencias. Revisar la [tarifa vigente](https://developers.google.com/maps/billing-and-pricing/pricing)
y [las sesiones](https://developers.google.com/maps/documentation/places/web-service/session-pricing)
antes de estimar. No importar fotos, reseñas ni horarios para elegir la ubicación.
La implementación debe revisar las condiciones de uso y persistencia de datos de Places,
conservar la selección exacta y probar con dobles; los tests automatizados no llaman a Google.

## Límites que deben resolverse al aprobar

- Evolucionar el contrato estructurado del negocio para aceptar un enlace de ficha y su
  nombre, preservando ubicaciones por punto y textos existentes. Hoy mapsUrl es una
  salida calculada a partir de coordenadas, no un campo de entrada de vínculos.
- Definir explícitamente la convivencia entre ficha y punto: no reemplazar silenciosamente
  una ficha con coordenadas ni mantener dos destinos incompatibles como si fueran uno.
- Validar HTTPS, longitudes, dominio y ruta también en Domain/API. La validación del
  laboratorio es sólo de formato: no acredita existencia, propiedad ni dirección del lugar.
- Conservar los enlaces cortos sin resolverlos desde el servidor: no agregar scraping,
  geocodificación ni pedidos a URLs del usuario. Un enlace abre Maps por decisión del usuario.
- Ampliar el cuerpo, normalización, huella y recuperación de comprobantes del guardado,
  con TDD e integración Docker, preservando permisos y revisión actuales.
- Nombre, dirección y referencia son información confirmada por quien administra el
  negocio. No importar fotos, reseñas ni horarios; el envío desde WhatsApp sigue pendiente.

## Entrada y evidencia

`http://127.0.0.1:5180/design-lab/whatsapp-chat/?screen=ubicacion-lugar&lang=es`
(`lang=en` para inglés). Esta entrada vive fuera del router/build productivos.

Pruebas del laboratorio: 17 casos de construcción/validación de enlaces con dobles,
incluidos HTTPS, dominios parecidos, credenciales en URL y caracteres de control.
Playwright usa enlaces ficticios, sin abrir servicios externos; recorre es/en a 1440/390/320
con validación, guardado simulado, descarte y geometría de los botones.

Se comprobó manualmente la búsqueda pública «Sanatorio Plaza, Rosario»: había más de
un resultado y se eligió la ficha de Dorrego 1550 para el ejemplo, sin importar esos datos
a producto. Esa comprobación acredita el recorrido de Maps de esa ficha, no integración
ni persistencia. [Vista de la propuesta](../../design-lab/whatsapp-chat/evidence/business-place-proposal-es.png).

## Verificación de esta entrega

- Build productivo y tipos del laboratorio correctos; lint final sin advertencias y 39
  reglas de arquitectura en verde. La suite Vitest completa pasó 938 casos en 87 archivos.
- Se ejecutaron los 116 casos de Playwright: la primera pasada encontró seis referencias
  de IA desactualizadas durante un cambio paralelo del catálogo de modelos. No se
  modificaron esas referencias desde este desarrollo.
- Una segunda pasada aislada pasó 110 y mostró que seis pruebas del editor guiado asumían
  el puerto 5178. Se corrigió su comparación de origen para usar baseURL, manteniendo
  la restricción a teselas OSM simuladas. Los 19 casos afectados se repitieron y pasaron,
  incluidos los seis restantes y la geometría final de esta propuesta. No se afirma una
  única ejecución final con los 116 en verde.
- La ejecución aislada usó temporalmente 5181 y su propia carpeta de resultados para
  evitar interferencia con pruebas concurrentes. Su configuración temporal se retiró.
  Se preservaron ambos main y sus cambios previos, sin commits/push; no se levantó Aspire.
