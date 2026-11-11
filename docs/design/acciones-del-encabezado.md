# Las acciones de un encabezado

Fecha: **2026-11-09**. Estado: **AC1-A elegida el 2026-11-11 y programada el mismo día**; falta la prueba manual. La
regla quedó en [íconos y acciones](visual-baseline.md#íconos-y-acciones) y en la pregunta 8 de la lista de chequeo.

En la prueba integral, en la vista rápida de una respuesta, el usuario marcó que «Corregir» queda suelto entre la
etiqueta «Recibida» y los íconos (⋮, pantalla completa, conversación, ↑ ↓ ×): «se ve mal, para eso están los tres
puntitos». Pidió un estándar para toda la app que diga qué acciones van a la vista y cuáles en ⋮, y que entre en la
[lista de chequeo](visual-baseline.md#lista-de-chequeo-de-diseño). Los tableros están en el lienzo aparte
[Diálogos con la lista de chequeo](https://claude.ai/artifact/NUTGFtcXh7QPq8wnpJ6K6c), fila «Las acciones de un
encabezado». El [plan](../plans/2026-11-09-acciones-del-encabezado.md) lo lleva al código cuando se elija.

## Hoy (AC0)

- **No hay una regla para ⋮.** Las vigentes dicen que las acciones de una zona van al borde derecho de su encabezado, a
  la altura del título ([formularios y diálogos](visual-baseline.md#formularios-y-diálogos)); que en la vista rápida
  pantalla completa, «Descargar ▾» y la conversación son íconos junto a ↑ ↓ × (TL3-A, en
  [formularios](formularios-whatsapp.md#la-actividad-y-el-encabezado-de-una-respuesta-tl3-a--2026-11-02)); que en
  «Opciones» de un catálogo lo frecuente va a la vista y lo raro en ⋮ (CA1-A, en [mejoras de catálogos](catalogos-mejoras.md));
  y que en una fila lo destructivo va al final ([íconos y acciones](visual-baseline.md#íconos-y-acciones)).
- **La vista rápida de una respuesta.** «Corregir», con texto y borde, quedó entre la etiqueta y los íconos (CW10-A, en
  [carga desde la app](carga-desde-la-app.md#corregir-y-anular-etapa-3--2026-11-05)), y ⋮ tiene un solo ítem, «Anular». En
  el panel angosto las acciones no entran en el renglón del título y bajan, lejos de ↑ ↓ ×.
- **La pantalla completa** mezcla texto, íconos, el contador «1 de 2» y otra vez texto en la banda.
- **Dar de baja** va a la vista en el editor de un catálogo y en ⋮ en el de un formulario.

## Las opciones (AC1)

| Tablero | Qué define |
| --- | --- |
| **AC1-A · A la vista la tarea y moverse; lo demás que se hace con el objeto, en ⋮** (recomendada) | Con texto, la tarea de la pantalla: guardar y descartar en un editor, publicar, crear o agregar en un listado, exportar la planilla, aprobar o rechazar lo que espera una decisión; la principal, última. Ir a otro lado y bajar (pantalla completa, la conversación, el PDF): íconos con su nombre en un panel y texto en la banda de una pantalla (TL3-A). En ⋮, lo demás que se hace con el objeto: corregir, anular, dar de baja, reactivar, eliminar, descargar la plantilla, ordenar; lo destructivo al final, en rojo y después de una línea, y un ítem apagado con su motivo adentro. El orden: la tarea, ir y bajar, ⋮ y, al final, moverse y cerrar (↑ ↓ ×). Las filas siguen con sus íconos. |
| **AC1-B · «Acciones ▾» con texto en lugar de ⋮** | Lo mismo que A, con el menú abierto por un botón que dice «Acciones». Es un botón más con texto: compite con la tarea y en un panel angosto vuelve a no entrar. |
| **AC1-C · Lo frecuente como ícono; lo raro y lo destructivo en ⋮** | «Corregir» queda a la vista como lápiz con su nombre en el tooltip, y ⋮ sólo con «Anular». «Frecuente» se decide pantalla por pantalla, así que la regla no se aplica sola, y un lápiz suelto se lee como «editar». |

**Recomendación: AC1-A.** Es lo que pidió el usuario y lo que ya hacen el editor de formularios y «Opciones» de un
catálogo. Se aplica sin dudar: la tarea se ve, el resto espera en ⋮.

## Toda la app con AC1-A (AC2)

Se leyeron los encabezados con acciones de las 22 pantallas que tienen. Cambian tres:

| Encabezado | Hoy | Con AC1-A |
| --- | --- | --- |
| Vista rápida de una respuesta (`FormResponseDetailPage`) | «Corregir» con texto; ⋮ con «Anular» | Pantalla completa, conversación y descargar como íconos; ⋮ con «Corregir» y «Anular»; ↑ ↓ ×. En el renglón del título. |
| Respuesta en pantalla completa (`FormResponseFullPage`) | «Corregir», «1 de 2», ↑ ↓, «Abrir conversación», «Descargar ▾» | «Abrir conversación», «Descargar ▾», ⋮ con «Corregir» y «Anular», «1 de 2», ↑ ↓. «Aprobar» y «Rechazar» siguen a la vista, primeros en el renglón: son la tarea mientras espera (lo eligió el usuario el 2026-11-11; en el celular van fijos al pie). |
| Editor de un catálogo y de uno con filtros (`CatalogEditorPage`, `CatalogFiltersEditorPage`) | «Dar de baja» o «Reactivar» a la vista | ⋮ con «Dar de baja» o «Reactivar», como el editor de formularios. La propuesta del asistente sigue a la vista. |

Ya cumplen: el editor de formularios, «Opciones» de un catálogo, la planilla, los listados, los ajustes y editores con
guardar, las reglas y sugerencias y el chat de WhatsApp. ARCA se repasó al programar: cada zona tiene a la vista su tarea, y sólo «Desconectar», a la vista en el encabezado de la conexión activa, iba contra la regla; el usuario eligió pasarlo al ⋮ «Acciones de la conexión» (2026-11-11). Quedan fuera de la regla el pie de
un diálogo y las filas de una tabla.

Al programarla (2026-11-11), a pedido de la sesión de carpetas, «Carpetas…» también pasó al ⋮ de los editores de
formularios y de catálogos (CP2-A), y en el editor de formularios «Vista oficial», que lleva a otro lado, quedó antes del ⋮.

## En la lista de chequeo

Desde el 2026-11-11 la pregunta 8 suma: «¿A la vista va sólo la tarea de la pantalla y lo que lleva a otro lado, y lo
demás que se hace con el objeto va en ⋮, con lo destructivo al final?», con un enlace a la regla, escrita en
[íconos y acciones](visual-baseline.md#íconos-y-acciones).

## Lo que cambia otra decisión

CW10-A (2026-11-05) puso «Corregir» con el lápiz en el renglón del título, junto a ⋮. Con AC1-A pasa adentro de ⋮,
arriba de «Anular». TL3-A no cambia: los íconos siguen junto a ↑ ↓ ×.
