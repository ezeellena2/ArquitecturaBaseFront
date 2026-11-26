# La respuesta como el formulario (VF1-A) y la actividad fila por fila (VF2-A)

Elegidas por el usuario el 2026-11-22. Este documento es la fuente de sus decisiones: las ancla a su tablero y dice con
qué piezas se arma. La regla funcional y el contrato están en
[formularios](../../../ArquitecturaBase/docs/features/formularios.md#la-respuesta-como-el-formulario--vf1-a-y-vf2-a-2026-11-22);
la regla para toda la app, en [nada debajo de otro dato](visual-baseline.md#nada-debajo-de-otro-dato--2026-11-22).

**Tableros:** lienzo aparte [Respuesta como formulario](https://claude.ai/artifact/2vnLgSq6xxdoz9LjAdNmaN), versión 15.
Es privado y puede cambiar fuera de Git.

| Tablero | Qué dibuja |
| --- | --- |
| VF1-A · 1 de 2 | La pantalla completa leyendo PED-000010 y corrigiendo en el lugar («Corregir PED-000010», «Antes: 250», el motivo) |
| VF1-A · 2 de 2 | La vista rápida leyendo y corrigiendo, el celular en español e inglés, y por aprobar, corregida, anulada y sin permiso |
| VF · A completa | Quién ve «Corregir» y «Anular» (decisión 8), fotos y documentos, una respuesta de otra versión, la carga, el error, el 409, el 429 y salir con cambios |
| VF2-A | La actividad en tabla en la pantalla completa y en recuadros a 390 px, con los ejemplos de PED-000010 y RVI-000003 |
| VF1-B, VF1-C | Descartadas |

## Las decisiones

1. **Se lee con la forma de la carga**, en D2 y DC1: las mismas zonas, el orden, hasta tres por renglón y el ancho de cada
   tipo (AR1-A). Cada pregunta es su control, sin poder tocarlo: el recuadro gris claro y el valor en negro; la opción
   elegida, rellena (OE1-A), y las demás a la vista, en gris; un cálculo, en gris con su fórmula en la (i).
2. **Nada debajo de otro dato:** en la grilla, cada dato de la opción va en el mismo renglón que su pregunta, «Pregunta ·
   Dato», en gris; en el bloque, es una columna más.
3. **Lo que su condición oculta no aparece**, como al cargar.
4. **«Corregir» a la vista:** un botón con texto en la banda de DC1 y el lápiz, primero entre los íconos del título, en
   D2. «Anular» sigue en ⋮, en rojo (CW11-A). Los decide el servidor (`canAmend`); sin permiso no se dibujan, ni apagados.
5. **Corregir en el lugar:** el título pasa a «Corregir PED-000010», la banda queda con «Cancelar» y «Guardar corrección» y
   se van ⋮, ↑ ↓ y la actividad. «Antes: …» va debajo de lo que cambió, salvo adentro del bloque (RG2-A), y el motivo,
   obligatorio, al final. D2 corrige en su mismo panel, con el mismo componente.
6. **La versión:** «Versión N» en la banda; se corrige con la activa y, si cambia algo, un aviso arriba lo dice al empezar
   («Se corrige con la versión 2 del formulario, la activa: «Receta agronómica» arranca vacía.»).
7. **La actividad, fila por fila (VF2-A):** Fecha, Hora, Qué pasó, Quién, Canal, Detalle, Estado y Acciones, con «—» donde
   no aplica. Las bandas de cada momento separan. Cada PDF y cada persona de un aviso es su renglón, y los acuses de
   WhatsApp son el estado de ese renglón. El motivo va entero en «Detalle», la única celda de varias líneas. En Acciones,
   sólo íconos con su nombre en el tooltip (Ver PDF, Descargar, Reintentar, Consultar y Resolver envío). A 390 px y en D2,
   cada renglón es un recuadro con «Qué pasó» arriba y los demás datos de a dos. Lo que se hizo al recibir la respuesta va
   después de ella, aunque su acción tome la hora del comienzo del guardado (O56).
8. **Lo demás no cambia:** los momentos (TL1-A) y «Actividad» debajo del formulario en DC1; el PDF y «Abrir conversación»;
   «Comprobante» primero y «Cómo empezó» después del formulario; en el celular, un recuadro por ítem y «Rechazar»/«Aprobar»
   o «Guardar corrección» fijos abajo.

Estados (VF · A completa): por aprobar, corregida, anulada y sin permiso; la carga (ES3); el error con «Reintentar»; el
409, que vuelve a la lectura con «Esta respuesta ya no se puede corregir.» y «Ver la actual», que abre la versión que la
reemplazó (O52); la espera de un 429 como motivo de «Guardar corrección», y salir con cambios («¿Descartar la corrección?»).

## Lo que reemplaza

| Antes | Ahora |
| --- | --- |
| TL1-A en el detalle: dos columnas y los datos de la opción debajo del valor | La forma del formulario, con cada dato de la opción en su campo («Artículo · Rubro») |
| DC1, la sección «Respuesta» | Las zonas del formulario: «Datos», una por título de sección y «Fotos y documentos» |
| RG4-A en el detalle | La tabla o los recuadros de la carga, sin acciones |
| CW10-A, corregir en otra página o en otro panel | Corregir en el lugar, con «Antes» y el motivo |
| AC1-A en esta pantalla | «Corregir» a la vista; «Anular» en ⋮ |
| TL3-A, la actividad | La tabla de VF2-A, un dato por columna, con las bandas por momento como separadores |

## Piezas

- **Leer** (`features/business-forms/components/ResponseForm.tsx`, lógica en `responseReading.ts`): `CollapsibleSection`
  por zona, la grilla de la carga (`useEntryColumns`, `entryRows`) y cada pregunta en su control de sólo lectura.
  - Lo respondido usa `Input` o `Textarea` con `readOnly` y `answered`, que conservan el recuadro del control y el color
    del texto. Un cálculo o un dato del catálogo quedan en el gris de sólo lectura.
  - El bloque usa `ItemTable` o `ItemCards` con `readOnly`, sin ↑ ↓, sin quitar y sin «Agregar ítem».
  - La ubicación va en un renglón, con su precisión al lado y «Ver en el mapa». Las fotos y documentos usan
    `FormRecordFiles`; el visor de una pregunta lleva su nombre y recorre sólo sus fotos.
- **Corregir** (`FormEntryCorrection`, en la página o en el panel) reusa `FormEntryForm`, el editor de la corrección y el
  aviso de versión (`correctionVersion.ts`).
- **La actividad** (`ResponseWorkflowHistory`): la tabla de `shared/ui` en la pantalla completa y recuadros en la vista
  rápida y por debajo de 640 px. Las acciones van como íconos de fila con su nombre en el tooltip.

## Estado

Programado entre el 2026-11-22 y el 2026-11-23: la lectura (`ResponseForm`), corregir en el lugar (`FormEntryCorrection`,
con `/corregir` que lleva a la pantalla completa), la actividad fila por fila (`workflowActivity`) y el barrido de la regla
en toda la app (VF3 con R2-A), con O52 y O56 de la prueba integral, hasta el 2026-11-24. Falta la prueba a mano, en
[verificación y producción](../../../ArquitecturaBase/docs/plans/verificacion-y-produccion.md#pruebas-a-mano-de-formularios-el-criterio).
