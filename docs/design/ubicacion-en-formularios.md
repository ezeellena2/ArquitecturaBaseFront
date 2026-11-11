# La pregunta «Ubicación» en los formularios: tableros elegidos

Fecha: **2026-11-11**. Estado: **elegidos y programados** (Etapa 1, en la app; 2026-11-11, para la prueba integral final). El usuario eligió UB1-A a UB4-A el
2026-11-11. El alcance, las reglas por defecto y las tareas están en el
[plan del backend](../../../ArquitecturaBase/docs/plans/2026-10-22-documentos-por-whatsapp.md#la-pregunta-ubicación);
las pantallas, los textos y los estados salen de acá.

Origen: el 2026-11-10 el usuario preguntó si un formulario puede pedir la ubicación. Hoy no: ningún tipo de pregunta guarda
un punto, la respuesta dice quién, cuándo y por qué canal pero no dónde, la app no usa la ubicación del navegador y una
ubicación que llega por WhatsApp no se lee. Se puede pedir un punto en el momento de cargar; no un recorrido, y el punto no
prueba presencia: es lo que informa el dispositivo.

Lienzo: [Pregunta «Ubicación» en los formularios](https://claude.ai/artifact/9z3HT35LTTF7C7hmwHgFZj), de tipo Design
(versión 3, con las elegidas marcadas y una nota verde por fila). Se armó aparte porque el
[Sistema visual](https://claude.ai/artifact/HPbmDPLnr8JZ9TxevtTqJJ) es de otra cuenta y no se abre desde Claude Code. Los
tableros pasan a ese lienzo cuando se pueda abrir; como el lienzo es privado y puede cambiar fuera de Git, este documento
congela lo elegido.

## Cómo leer los tableros

- Están armados con las piezas de los lienzos anteriores: los colores de `src/index.css`, Public Sans y el escritorio con la
  raíz al 75 %. Al programar, cada parte se arma con su pieza de `src/shared/ui` (tabla abajo), no copiando el dibujo.
- Los círculos numerados son notas del tablero, explicadas en la columna de la derecha. No son UI.
- Sólo están las elegidas. UB3 y UB4 son de pantalla y tienen su fila; UB1-A y UB2-A van en la nota verde de arriba. «UB ·
  Hoy» es el relevamiento. La nota naranja de la fila UB3 junta las decisiones nuevas que aparecieron al dibujar.
- Los datos son ficticios: «Registro de visita» (REG), Juan Gómez, Ana Ruiz, «Ferretería Norte» y «Distribuidora Sur».
- El punto se escribe siempre igual, en español y en inglés: latitud, coma, espacio y longitud, con punto decimal y seis
  decimales («-34.603722, -58.381592»). La precisión sigue el idioma: «± 2.400 m» en español, «± 2,400 m» en inglés.

## Las elecciones

El 2026-11-11 el usuario eligió las cuatro recomendadas:

1. **UB1-A:** se guardan la latitud, la longitud y la precisión en metros (opcional). Descartó UB1-B (sin la precisión) y
   UB1-C (también nombre y dirección, que sólo trae un pin de WhatsApp).
2. **UB2-A:** la Etapa 1 es la app, en los formularios «Sólo en la app» ([SA1-A](formularios-solo-en-la-app.md)); por
   WhatsApp, en la Etapa 2, con su propio diseño. Descartó UB2-B (esperar a tener también WhatsApp).
3. **UB3-A:** el botón «Usar mi ubicación» muestra el punto con su precisión, «Ver en el mapa» y «Volver a pedirla»; si el
   navegador no la da, dice por qué; obligatoria, no deja enviar. Descartó UB3-B (escribir las coordenadas a mano) y UB3-C
   (elegir en un mapa embebido).
4. **UB4-A:** un punto es un solo dato: la planilla, el detalle, el PDF y los mensajes lo muestran con «Ver en el mapa»
   (Google Maps con `q=<lat>,<lng>`), y el Excel lo reparte en tres columnas numéricas. Descartó UB4-B (una sola columna de
   texto en el Excel).

## Los tableros

| Tablero | Qué define |
| --- | --- |
| **UB · Hoy** | El tipo de respuesta termina en «Documento». El detalle de una respuesta dice «Recibida», «Cargó» y «Canal», y una dirección se escribe a mano en un texto. Una ubicación mandada al chat de WhatsApp queda como un mensaje más (el webhook la clasifica como «otro»). |
| **UB3-A · «Usar mi ubicación», al cargar** (elegida) | En «Nueva respuesta», la pregunta va en «Datos», en una columna, como una fecha. Ocho estados: sin pedir (el botón, sin texto al lado); pidiendo (el aro y «Buscando tu ubicación…» en el mismo botón, sin atenuarse; la primera vez el navegador pide permiso con su propio cartel); con el punto (un recuadro con el pin, el punto y la precisión en gris, la cruz roja para quitarlo y, debajo, «Ver en el mapa» y «Volver a pedirla»); precisión baja (más de 100 m: la precisión en ámbar con el triángulo y la (i); se puede enviar igual); permiso denegado y sin señal o tiempo agotado (el botón sigue y, debajo, un renglón rojo con el motivo y qué hacer); el navegador no la da (el botón apagado con el motivo encima, MA1-A); obligatoria y vacía al enviar («Completá esta respuesta.» bajo el campo y el foco en el botón). En el celular, los botones van a lo ancho, con 44 px: «Ver en el mapa» y «Volver a pedirla», uno debajo del otro, como «Tomar foto» y «Elegir de la galería». |
| **UB3-A · El editor y la publicación** (elegida) | «Ubicación» va al final de «Tipo de respuesta», después de «Documento». La pregunta abierta tiene «Pregunta», «Tipo de respuesta», «Ayuda para el empleado (opcional)» y sólo «Obligatoria»: sin opciones, sin largo máximo y sin «Se carga varias veces». Su línea dice «Ubicación · Obligatoria». Dentro de un bloque el tipo aparece apagado: «Ubicación · No se carga varias veces», como una foto o un documento. Pasar una pregunta guardada a «Ubicación» pide confirmar, como todo cambio de tipo. En un formulario «En la app y por WhatsApp», el chequeo de publicar da un problema con «Ir a la pregunta» y «Publicar» queda apagado; con «Sólo en la app» publica al instante («Publicamos la versión 1.» y «Publicado · versión 1»). |
| **UB4-A · Un punto es un solo dato** (elegida) | En la planilla, la columna de la pregunta muestra el punto subrayado con el ícono de enlace externo: es el enlace al mapa, en otra pestaña, y su nombre accesible dice el punto y «Ver en el mapa»; sin respuesta, «Sin respuesta» en gris; si la pregunta no existía en esa versión, «—». En el detalle, el punto con «Ver en el mapa» al lado y la precisión en gris debajo. «Enviada» muestra el punto. El PDF escribe el punto con «Ver en el mapa» como enlace del PDF. Un mensaje de una regla lleva el punto y, en el renglón de abajo, el enlace del mapa. El Excel tiene tres columnas numéricas: «<Pregunta> · Latitud», «· Longitud» y «· Precisión (m)»; sin respuesta van vacías y, si la pregunta no existía, «—» en las tres. |

## Los textos

| Dónde | Español | Inglés |
| --- | --- | --- |
| Tipo de respuesta | Ubicación | Location |
| Línea de la pregunta | Ubicación · Obligatoria | Location · Required |
| El tipo dentro de un bloque | Ubicación · No se carga varias veces | Location · Not loaded several times |
| Botón | Usar mi ubicación | Use my location |
| Botón mientras busca | Buscando tu ubicación… | Finding your location… |
| Enlace al mapa (carga, detalle, PDF, nombre del enlace de la planilla) | Ver en el mapa | View on the map |
| Otro punto | Volver a pedirla | Ask for it again |
| Nombre de la cruz | Quitar la ubicación | Remove the location |
| Precisión | ± 15 m · ± 2.400 m | ± 15 m · ± 2,400 m |
| (i) de la precisión baja | Es una ubicación aproximada: sin GPS, el navegador la calcula por la red y puede errar por kilómetros. Desde un celular sale más precisa. | It is an approximate location: without GPS, the browser estimates it from the network and can be off by kilometers. A phone gives a more precise one. |
| Permiso denegado | No hay permiso para usar tu ubicación. Permitilo en la configuración del sitio, en el navegador, y volvé a tocar «Usar mi ubicación». | There is no permission to use your location. Allow it in the browser's site settings and press “Use my location” again. |
| Sin señal o tiempo agotado | No se pudo obtener tu ubicación. Revisá que la ubicación del dispositivo esté activada y volvé a tocar «Usar mi ubicación». | Your location could not be obtained. Check that the device's location is on and press “Use my location” again. |
| Motivo del botón apagado (el navegador no la da) | Este navegador no da la ubicación. Abrí el formulario en otro navegador o en el celular. | This browser does not provide the location. Open the form in another browser or on a phone. |
| Obligatoria y vacía (ya existe, `problems.required`) | Completá esta respuesta. | Fill in this answer. |
| Problema del chequeo de publicar (`Errors.resx`) | Por WhatsApp no se puede pedir una ubicación. Elegí «Sólo en la app» en «Dónde se completa» o quitá la pregunta. | A location cannot be requested on WhatsApp. Choose “Only in the app” in “Where it is completed” or remove the question. |
| Columnas del Excel | «<Pregunta> · Latitud», «<Pregunta> · Longitud», «<Pregunta> · Precisión (m)» | «<Question> · Latitude», «<Question> · Longitude», «<Question> · Accuracy (m)» |
| Mensaje de una regla | `-34.603722, -58.381592`, un salto de renglón y `https://www.google.com/maps?q=-34.603722,-58.381592` | igual |

## Decisiones nuevas al dibujar

UB1-A a UB4-A y las reglas por defecto del plan no las fijaban; se tomó la opción más simple y quedaron dibujadas:

1. **Precisión baja:** más de 100 m. La precisión va en ámbar con el triángulo y su (i); no frena el envío.
2. **Quitar el punto:** la cruz roja del recuadro, como la de un archivo; vuelve a «Usar mi ubicación».
3. **Dónde va un error del navegador:** en un renglón rojo bajo el botón, como los problemas de un archivo, y se va al
   volver a pedirla. Sin la función de ubicación, el botón se apaga con el motivo encima (MA1-A), sin texto al lado.
4. **El ancho:** una columna en «Datos» (`entryQuestionSpan` no cambia); un punto es un dato, como una fecha.
5. **El tipo en un formulario de WhatsApp:** «Ubicación» se puede elegir igual y lo frena el chequeo de publicar; no se
   apaga en la lista según «Dónde se completa».
6. **La planilla:** el punto mismo es el enlace al mapa (no entra «Ver en el mapa» como otro texto en la columna) y no
   lleva la precisión, que va en el detalle y en el Excel.
7. **Un mensaje de WhatsApp:** no tiene texto con enlace, así que el dato es el punto y, en el renglón de abajo, el enlace
   del mapa, que WhatsApp vuelve tocable.
8. **El PDF:** el punto y «Ver en el mapa» como enlace del PDF, sin la precisión.
9. **«Filtros» de la planilla:** la pregunta no aparece, como una foto o un documento (desde que salió «Respuesta»); el
   backend acepta igual «con respuesta» y «sin respuesta».
10. **Cómo se pide:** una vez por toque, con `navigator.geolocation.getCurrentPosition` en alta precisión, sin una ubicación
    guardada (`maximumAge: 0`) y hasta 20 s; vencido el tiempo, es el caso «sin señal». Una precisión de más de 100 km, que el
    servidor no toma, también cuenta como «sin señal» (detalle resuelto al programar).

## Lo que vale con cualquier estado

- No se pide nada hasta tocar el botón, y lo cargado viaja con «Enviar»: nada sale antes.
- La ayuda que escribe el autor va donde va en cualquier pregunta.
- Al corregir una respuesta, la pregunta arranca con el punto guardado; «Volver a pedirla» lo cambia y debajo aparece
  «Antes: -34.603722, -58.381592», como cualquier pregunta corregida.
- La vista previa de la app en el editor muestra la pregunta con «Usar mi ubicación», como la carga: no pide nada hasta tocar
  el botón. La vista previa de WhatsApp no la muestra, porque por WhatsApp no se pide.
- El resultado de pedirla (el punto, la precisión o el motivo) se anuncia al lector de pantalla (`aria-live="polite"`).

## Piezas de `src/shared/ui`

| Parte | Pieza |
| --- | --- |
| «Usar mi ubicación» y «Volver a pedirla» | `Button variant="outline"` con `pending` (LC1-A); en el celular, `size="touch"` a lo ancho |
| Botón apagado sin la función | `DisabledReason` sobre el mismo botón (MA1-A) |
| Recuadro del punto | el de un archivo de `EntryFilesField` (borde, `IconButton variant="destructive-outline"` para quitar), con un ícono nuevo `MapPinIcon` (lucide `map-pin`) en `shared/ui/icons` |
| «Ver en el mapa» | un enlace con `ExternalLinkIcon`, `target="_blank"` y `rel="noopener noreferrer"`; en el celular, con forma de `Button variant="outline" size="touch"` |
| Precisión baja | el color `--color-warning` con `AlertTriangleIcon` y un `InfoTip` |
| Renglón de error | el de los problemas de un archivo (`--color-danger-700`, `aria-live="polite"`) |
| La pregunta en la carga | `FormEntryForm`, en «Datos», una columna |
| Detalle y planilla | `ResponseValue` (en `ResponseAnswer` para el detalle) |
| Tipo en el editor | el `NativeSelect` de `QuestionEditor`, con el motivo después de «·» en el bloque (RG9-A) |
| Problema del chequeo | `PublicationCheckDialog` y `PublicationFindings`, con «Ir a la pregunta» |
| Publicado al instante | el aviso de éxito (AV1-A) |

## La lista de chequeo de diseño

1. **Entero y armado:** sí; los tres tableros muestran cada estado, el celular y el recorrido del editor al chequeo.
   Diferencia aceptada: se armaron con las piezas de los lienzos anteriores, porque el Sistema visual y su biblioteca no se
   abren desde Claude Code.
2. **Una tarea, zonas que se entienden solas:** sí; la pregunta es una más de «Datos», sin zona propia.
3. **El control según el dato:** sí; un punto que da el dispositivo se pide con un botón, sin escribirlo; el tipo, en el
   selector de siempre.
4. **Lo que se lee, en su lugar:** sí; el detalle es un `DataList` con el punto como valor y la precisión en gris debajo.
5. **Un dato por columna:** sí; la planilla muestra sólo el punto (el enlace es el mismo dato) y el Excel separa latitud,
   longitud y precisión.
6. **Sin leyendas:** sí; la explicación de la precisión baja va en la (i). Los renglones rojos son el resultado de pedirla,
   como los problemas de un archivo, no una explicación de cómo funciona.
7. **Textos ciertos, una sola vez:** sí; cada estado dice una cosa y el punto aparece una vez. El problema del chequeo nombra
   «Dónde se completa», que sólo existe con WhatsApp: sin el módulo todo es de la app (SA5) y el problema no aparece.
8. **Botones y lo apagado:** sí; cada botón nombra su acción, la cruz tiene nombre, el botón apagado da su motivo encima y
   el tipo apagado en el bloque, después de «·».
9. **Lo elegido y la espera:** sí; pedirla muestra el aro y el gerundio en el mismo botón, sin atenuarse ni mover nada.
10. **Estados y mensajes:** sí; sin pedir, pidiendo, con el punto, precisión baja, tres fallas y la obligatoria. Cada mensaje
    tiene su canal: el resultado de pedirla bajo el botón, la validación bajo el campo, el problema en el chequeo y el
    éxito de publicar en el aviso de abajo. No hay 429 ni conflicto propios: pedirla no llama al servidor.
11. **Lo mismo, igual en toda la app:** sí; el recuadro y la cruz son los de un archivo, los botones del celular, los de una
    foto, y las fechas van sólo con números. Suma un ícono, `MapPinIcon`.
12. **Celular, teclado e idiomas:** sí; desde 320 px el punto entra en un renglón, los botones tienen 44 px, todo se alcanza
    con el teclado, el resultado se anuncia y los textos están en español y en inglés. No es una colección: no hay URL.
