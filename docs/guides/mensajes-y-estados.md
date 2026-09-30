# Contrato de mensajes y estados del front

Fecha: **2026-09-30**. El criterio de interacción es vigente por pedido del usuario.
El emisor, el clasificador y la fábrica de consultas están implementados; la migración de consumidores y sus controles de arquitectura están **pendientes**; su recorrido está
en el [plan de adopción](../plans/2026-09-30-unificacion-mensajes.md). Este documento es la fuente
única de este contrato, enlazada desde la arquitectura, las premisas y las instrucciones.

## Alcance y responsabilidad

Aplica a todas las pantallas públicas y privadas, formularios, diálogos, listados y proyectos
derivados de la plantilla. Una pantalla no elige la ubicación, duración o apariencia de los
mensajes. Aporta la operación, los campos visibles y las reglas de negocio; el sistema común
resuelve la presentación. Un cambio de criterio se hace acá y en el mecanismo compartido,
con pruebas de sus consumidores, antes de extenderlo a una pantalla.

La regla tiene tres partes: **un contrato, un mecanismo común y pruebas que lo hagan cumplir**.
Tener el Toaster o esta guía no demuestra por sí solo que las pantallas estén unificadas.
Los desvíos existentes tienen un inventario y deben retirarse según el plan, no conservarse
como excepciones permanentes. Un desarrollo nuevo cumple el contrato desde su primera versión.

## Dónde va cada mensaje

| Hecho | Canal único | Ejemplo |
| --- | --- | --- |
| Un dato editable es inválido | Error junto al campo o grupo, con las piezas comunes | Correo inválido; nombre de rol ya usado |
| Una operación se completó | Notificación de éxito abajo a la derecha | Guardamos los cambios |
| Una operación falló y no se corrige en un campo visible | Notificación de error abajo a la derecha | No pudimos guardar; revisá el valor actual |
| Hay una consecuencia a tener en cuenta y se puede continuar | Notificación warning abajo a la derecha | La operación continúa con una limitación explicada |
| Hay información sobre una operación | Notificación info abajo a la derecha | La solicitud quedó en proceso |
| Hay que decidir antes de actuar | ConfirmDialog, con consecuencia y acción concreta | Eliminar; abrir registro; descartar cambios |
| El contenido no pudo cargarse | Estado de recuperación de DataTable/EmptyState con Reintentar; una notificación explica la causa | No pudimos cargar los usuarios |
| Falla una actualización de datos ya visibles | Conservar los datos y el borrador; notificación de error | No pudimos actualizar la lista |
| Hay una condición de negocio que sigue vigente | Dato, estado del flujo o ayuda junto a la acción afectada | Único medio de ingreso; código agotado; cuenta deshabilitada |
| No hay sesión, permiso o ruta | Flujo de sesión o página correspondiente | Ingresar; Sin permiso; Página inexistente |

**Error** significa que la operación no pudo completarse o confirmarse. **Warning** advierte
una consecuencia cuando todavía se puede continuar. **Info** comunica algo sin pedir corregir
un problema. El éxito se comunica después de confirmar la respuesta. No convertir un fallo
en warning para suavizarlo ni elegir el tono solo por el status HTTP.

Un error de campo permanece junto al campo hasta corregirlo o iniciar otro intento. No se
repite como toast. Si una respuesta contiene errores de campos visibles y otro problema que
no tiene un control donde corregirse, se muestran los campos y **un** toast para ese problema
distinto; no se repite el genérico «Revisá los campos marcados».

Un estado sin contenido identifica qué superficie no se puede usar y ofrece recuperación.
La notificación contiene la causa, sin repetir ese detalle en la tabla o en el formulario.
Si hay datos anteriores utilizables, no borrarlos ni reemplazar el editor por una pantalla de
error al fallar un refetch. No confundir una carga fallida con una colección vacía.

## Un solo lugar para notificar

- El único Toaster productivo se monta en `src/app/providers.tsx`; su presentación vive en
  `src/shared/ui/sonner.tsx`: abajo a la derecha, tema, tokens, íconos y textos accesibles comunes.
  Una feature no monta otro Toaster ni cambia sus props de posición, duración o estilo.
- Los cuatro tipos operativos usan ese mismo canal, también dentro de un formulario o diálogo
  y en las pantallas de ingreso. No agregar un Banner, `FormError`, párrafo de error general
  encima de los botones ni modal informativo como canal alternativo.
- Una condición duradera sigue siendo legible al cerrar cualquier notificación. Se representa
  junto al dato, al control o como estado del flujo; no se genera un popup en cada render.
  Los usos actuales de Banner se revisan por su significado; su existencia no autoriza usarlo
  para resultados de operaciones ni promover un `FormError` general a la biblioteca.
- La futura API común de notificación será el único punto de acceso a Sonner para el código
  consumidor. Hasta su implementación hay llamadas directas heredadas: no se declaran migradas
  ni se multiplica ese patrón en pantallas nuevas. Su diseño técnico está en el plan.

## Duración, cierre y acciones

| Tipo de notificación | Duración común |
| --- | --- |
| Éxito o info ordinarios | 4 segundos |
| Warning ordinario | 8 segundos |
| Error sin acción pendiente | 10 segundos |
| Error, warning o info que contiene una acción necesaria | Hasta cerrar el aviso o realizar la acción |

Todos ofrecen cierre. Se respeta el tiempo de interacción accesible de la biblioteca y se
comprueba que el aviso pueda leerse y accionarse con teclado. Un toast no roba el foco, no
cierra un editor, no descarta valores ni convierte una acción en confirmada al cerrarlo.
La acción dice qué hace («Reintentar», «Revisar»), no «Aceptar».

Una operación usa un identificador estable que incluye su contexto. Repetir la misma causa
actualiza su aviso; operaciones distintas no se pisan por usar un id global fijo. Resolver,
descartar o abandonar el contexto de una acción pendiente retira su aviso o desactiva la
acción que ya no es válida. Un resultado que llega después de salir del editor conserva el
contexto necesario para explicar qué operación terminó, sin reabrir el editor automáticamente.

**Reintentar no es un botón universal.** Una lectura puede repetirse. Para una escritura cuyo
resultado es incierto, primero se consulta el estado actual; no enviar de nuevo a ciegas ni
afirmar que no se guardó. La regla vale también para operaciones que pueden consumir códigos,
enlaces o invitaciones. Los 429 respetan el plazo del servidor y el control mantiene visible
la espera después de cerrar la notificación; no se habilita un reintento prematuro.

Con un Dialog abierto, el aviso debe anunciarse y su recuperación debe poder completarse
con teclado. Se prueba la interacción del Toaster con el foco y los portales del diálogo en
el navegador; no se desactiva la modalidad ni se añade un segundo aviso para resolverlo.

## Cómo se interpreta un error

El transporte sigue siendo `shared/api/httpClient`: interpreta ProblemDetails y entrega
`ApiError`. No muestra mensajes. El front decide por `code` y por `errors`, nunca buscando
palabras en `detail` ni mostrando una excepción cruda.

1. Resolver el significado en el contexto de la operación: campo editable, estado terminal
   del flujo, sesión/permisos o fallo general. La feature declara los campos visibles y los
   códigos de negocio que necesitan una explicación propia; no reimplementa red, 5xx y fallback.
2. Los errores de campos visibles se llevan a FormField, CheckboxField, RadioGroupField,
   PhoneField o al grupo de código accesible. Un campo desconocido u oculto no absorbe el error:
   su explicación pasa al aviso general, sin sugerir revisar un campo que no existe.
3. Un código incorrecto marca el grupo de código; un código vencido, agotado o consumido cambia
   el estado del flujo y ofrece pedir otro. No marcarlo como si fuera un error de tipeo. El
   contador de intentos, la espera y el bloqueo permanecen junto al control correspondiente.
4. Red y errores inesperados usan el texto común. Para 5xx se puede añadir el `traceId` como
   código para reportar; el fallback de un error sin ApiError también es común. Los errores de
   negocio conservan el texto traducido del servidor salvo una explicación específica de la feature.
5. Un 401 de una petición autenticada sigue la renovación y el flujo de expiración de sesión;
   un 403 por falta de permiso sigue la página/estado de acceso. No duplicarlos con un toast.
   Los códigos de negocio del ingreso público se clasifican en su flujo: no ocultar un código
   incorrecto o una cuenta bloqueada por tratar todo 401/403 como expiración o falta de permiso.
6. Una cancelación deliberada o una respuesta superada por otra solicitud no es un fallo que
   deba notificarse. No anunciar éxito de una escritura hasta que su respuesta esté confirmada.

## Un dueño por hecho

En consultas comunes, el manejador global de QueryCache es el dueño del aviso, después del
resultado final de los reintentos permitidos. Una consulta que necesita interpretar localmente
un estado usa `meta: { silent: true }` y su dueño local aplica **este mismo contrato**, incluido
el aviso cuando corresponde. `silent` no significa que un error operativo se pueda ocultar.

Las mutaciones tienen un único manejador de feedback. Los callbacks de la pantalla pueden
navegar, enfocar campos o actualizar el borrador; no vuelven a notificar el mismo resultado.
Un refetch fallido después de una escritura confirmada no deshace el éxito: explica que falló
la actualización de la vista, sin afirmar que el guardado falló ni repetir mensajes por cada
consumidor de la misma consulta.

## Textos y accesibilidad

- Qué pasó y, cuando hace falta, qué puede hacer la persona. Usar frases breves, voseo e i18next
  en español e inglés; el texto traducido del servidor ya respeta Accept-Language.
- No mostrar stack traces, nombres de excepciones, tokens, códigos secretos ni destinos completos
  si el flujo usa datos enmascarados. No depender del color o del ícono para explicar el estado.
- Los errores de campo tienen asociación accesible, `aria-invalid` y `aria-describedby`.
  La validación puede llevar al primer campo inválido; una notificación operativa conserva el foco.
- El anuncio, cierre, acceso al aviso y acción usan el mecanismo accesible común. Un montaje doble
  de StrictMode, un render o varios observadores de la consulta no producen anuncios duplicados.
- Se verifica escritorio y 320 px: el aviso no desborda, su texto y acciones entran y se puede
  seguir usando la pantalla. El contrato debe funcionar igual en ambos idiomas y con un diálogo abierto.

## Cuándo se puede dar por unificada una pantalla

El diseño previo identifica evento, canal, dueño, recuperación y datos que se conservan. La
implementación usa el mecanismo compartido y cubre con pruebas los escenarios aplicables:

- validación en campo sin toast duplicado;
- fallo general de guardado: un error, borrador y editor conservados;
- carga inicial fallida y refetch con datos previos;
- éxito, warning e info con duración, cierre y acción comunes;
- sesión/permisos, espera 429 y conflicto o resultado incierto cuando existan;
- navegación o cierre durante la petición, StrictMode y varios observadores;
- teclado, ambos idiomas y accesibilidad del aviso desde un diálogo.

Las pruebas de arquitectura deberán comprobar el único punto de notificación y evitar
imports directos de Sonner en consumidores. Las de comportamiento comprueban el canal real y
la recuperación, con el mismo manejador de consultas que usa la app. Un build o un test que
solo encuentra el texto del error no demuestra que esté en el lugar correcto.

La migración se cierra con el inventario completo, sin excepciones temporales, pruebas de
arquitectura activas y `npm run build`, `npm run lint` y `npm run test` limpios. Ese cierre
todavía no ocurrió: ver el [plan y el relevamiento de las pantallas](../plans/2026-09-30-unificacion-mensajes.md).
