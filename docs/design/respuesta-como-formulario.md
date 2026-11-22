# La respuesta como el formulario (VF1-A) y la actividad fila por fila (VF2-A)

Elegidas por el usuario el 2026-11-22. Las decisiones, las tareas y los riesgos están en el
[plan del backend](../../../ArquitecturaBase/docs/plans/2026-11-22-respuesta-como-formulario.md), que es la ley. Este
documento ancla cada parte a su tablero y dice con qué piezas se arma.

**Tableros:** lienzo aparte [Respuesta como formulario](https://claude.ai/artifact/2vnLgSq6xxdoz9LjAdNmaN), versión 13.
Es privado y puede cambiar fuera de Git.

| Tablero | Qué dibuja |
| --- | --- |
| VF1-A · 1 de 2 | La pantalla completa leyendo PED-000010 y corrigiendo en el lugar («Corregir PED-000010», «Antes: 250», el motivo) |
| VF1-A · 2 de 2 | La vista rápida leyendo y corrigiendo, el celular en español e inglés, y por aprobar, corregida, anulada y sin permiso |
| VF · A completa | Quién ve «Corregir» y «Anular» (decisión 8), fotos y documentos, una respuesta de otra versión, la carga, el error, el 409, el 429 y salir con cambios |
| VF2-A | La actividad en tabla en la pantalla completa y en recuadros a 390 px, con los ejemplos de PED-000010 y RVI-000003 |
| VF1-B, VF1-C | Descartadas |

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
    `FormRecordFiles`.
- **Corregir** (`FormEntryCorrection`, en la página o en el panel) reusa `FormEntryForm`, el editor de la corrección y el
  aviso de versión (`correctionVersion.ts`).
- **La actividad** (`ResponseWorkflowHistory`): la tabla de `shared/ui` en la pantalla completa y recuadros en la vista
  rápida y por debajo de 640 px. Las acciones van como íconos de fila con su nombre en el tooltip.

## Estado

En programación desde el 2026-11-22: la lectura está hecha (`ResponseForm`) y se corrige en el lugar
(`FormEntryCorrection`, con `/corregir` que lleva a la pantalla completa). Faltan la actividad y el barrido de la regla en
toda la app.
