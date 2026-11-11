# Las acciones de un encabezado

Fecha: **2026-11-09**. Estado: **AC1-A elegida el 2026-11-11 y programada el mismo día (tareas 1 a 5); falta el cierre**.

El [diseño](../design/acciones-del-encabezado.md) propone qué acciones van a la vista y cuáles en ⋮, en toda la app.
Este plan supone AC1-A, la recomendada; con otra, cambian las tareas 2 a 4. Los tableros están en el lienzo aparte
[Diálogos con la lista de chequeo](https://claude.ai/artifact/NUTGFtcXh7QPq8wnpJ6K6c).

## Antes de empezar

- La elección del usuario (AC1-A, B o C).
- El front quieto: la tarea 1 toca `shared/ui`. Va después de [MA1-A](2026-11-09-motivo-de-lo-apagado.md), que cambia
  cómo se muestra el motivo de lo apagado, también el de un ítem de menú.
- Sin cambios en el backend.

## Qué tiene que quedar

Igual a AC1-A y a la tabla de AC2: la vista rápida y la pantalla completa de una respuesta con «Corregir» y «Anular» en
⋮, todo en el renglón del título; los dos editores de catálogo con «Dar de baja» o «Reactivar» en ⋮; el resto como está.

## Tareas

Cada tarea arranca con su test en rojo (`vitest`) y cierra con `tsc`, `lint` y los tests de lo que toca.

1. **Un menú ⋮ común.** Hoy hay tres hechos a mano: `FormLifecycleMenu`, `ResponseAmendActions` y el de
   `CatalogOptionsActions`. Una pieza de `shared/ui` con el disparador (un `IconButton` con su nombre, como «Más
   acciones» o «Acciones del formulario»), los ítems, la línea antes de lo destructivo, lo destructivo en rojo y el
   motivo adentro de un ítem apagado. Los tres pasan a usarla sin cambiar lo que muestran.
2. **Una respuesta.** `ResponseAmendActions` queda como un ⋮ con «Corregir» (con el lápiz) y, después de una línea,
   «Anular» en rojo. En la vista rápida (`FormResponseDetailPage`), el orden del renglón del título es pantalla completa,
   conversación, descargar, ⋮ y ↑ ↓ ×; en la pantalla completa (`FormResponseFullPage`), «Abrir conversación»,
   «Descargar ▾», ⋮, «1 de 2» y ↑ ↓, con «Aprobar» y «Rechazar» a la vista mientras espera. Tests: «Corregir» y
   «Anular» se abren desde ⋮ con el mouse y con el teclado, sin `canAmend` no hay ⋮, y el foco vuelve a ⋮ al cerrar.
3. **Los editores de catálogo.** `CatalogStateAction` pasa a un ítem de ⋮ en `CatalogEditorPage` y
   `CatalogFiltersEditorPage`, con su confirmación de siempre, después de «Descartar» y «Guardar». La propuesta del
   asistente no cambia. Tests de los dos editores.
4. **La regla y la lista.** La regla se escribe en
   [íconos y acciones](../design/visual-baseline.md#íconos-y-acciones) y en las
   [premisas](../guides/premisas-de-desarrollo.md#botones-y-acciones), y la pregunta 8 de la
   [lista de chequeo](../design/visual-baseline.md#lista-de-chequeo-de-diseño) suma la línea del diseño. CW10-A, en
   [carga desde la app](../design/carga-desde-la-app.md#corregir-y-anular-etapa-3--2026-11-05), dice que «Corregir» va en ⋮.
5. **ARCA y lo nuevo.** Se repasan los encabezados de ARCA con la regla; lo que no cumpla se anota y se pregunta.

## Avance (2026-11-11)

- **Tarea 1:** `ActionsMenu` en `shared/ui` (3bb07370), que usan `FormLifecycleMenu` (fdf3e6d9), `ResponseAmendActions`
  (6483ce0b) y `CatalogOptionsActions` (260404a4).
- **Tarea 2:** «Corregir» y «Anular» en ⋮ en la vista rápida y en la pantalla completa (6483ce0b).
- **Tarea 3:** «Acciones del catálogo» en los dos editores (f8a1c98a). A pedido de la sesión de carpetas, «Carpetas…»
  también va en ese ⋮ y en el del editor de formularios (9c7efea3), donde «Vista oficial» quedó antes del ⋮.
- **Tarea 4:** la regla en íconos y acciones, en las premisas y en la pregunta 8; CW10-A ya decía que «Corregir» va en ⋮.
- **Tarea 5:** ARCA cumplía salvo «Desconectar», a la vista en el encabezado de la conexión activa; el usuario eligió pasarlo
  al ⋮ «Acciones de la conexión», en rojo.

## Cierre

`npm run build`, `npm run lint` y `npm run test` completos; `npm run test:visual` con las escenas de la vista rápida, la
pantalla completa y los editores de catálogo, cada referencia que cambie revisada y explicada; el recorrido en el
navegador sobre el catálogo local, con teclado, en es y en, a 1440, 390 y 320. Después, pasar los tableros al lienzo del
sistema visual y retirar este plan con la
[auditoría documental](../../../ArquitecturaBase/docs/guides/auditar-documentacion.md).
