# El motivo de lo apagado (MA1-A)

Fecha: **2026-11-09**. Estado: **plan escrito; espera el visto bueno del usuario y un momento con el front quieto**.

El usuario eligió la MA1-A en el lienzo aparte [Motivo de lo apagado](https://claude.ai/artifact/AkskAbHDispJmt7wbGPBC6):
el motivo de algo apagado va sobre el mismo control y también se abre con un clic o un toque. La regla está en el
[fundamento visual](../design/visual-baseline.md#el-motivo-de-lo-apagado--2026-11-09). Este plan la lleva al código.

## Qué tiene que quedar

Igual al tablero «MA1-A · Sobre el control, y que responda al tocarlo». Sus seis puntos son el criterio de cierre:

1. **La casilla entera.** Pasar por el cuadradito o por su texto muestra el motivo arriba del cuadradito. Un clic hace
   lo mismo y no la marca («Permitir elegir varias» en una pregunta del bloque).
2. **El clic muestra el motivo.** Un clic sobre algo apagado lo abre y no hace la acción («Publicar en WhatsApp» con una
   publicación en curso). Lo cierran Escape, salir con el mouse, perder el foco o tocar afuera.
3. **Todos igual.** Botones, botones de ícono, casillas, campos y grupos de campos («Roles» sin permiso).
4. **Sin cambios de forma.** Nada se agrega al lado ni debajo. Una espera de segundos es sólo el motivo, y al terminar
   el control se enciende en el mismo lugar («Reenviar invitación»).
5. **El celular.** Tocar lo apagado abre el motivo arriba del control. La (i) también se abre al tocarla.
6. **Teclado y lector.** El control apagado se alcanza con Tab y el lector dice su nombre, «no disponible» y el motivo.
   Enter o Espacio lo vuelven a mostrar y no hacen la acción.

No cambian el motivo adentro de los ítems de un menú, «· motivo» en las opciones de un desplegable, el candado del
prefijo (un campo de sólo lectura) ni lo obvio sin motivo («Guardar» sin cambios). Tampoco cambian los textos ni qué
controles llevan motivo.

## Por qué no alcanza con lo de hoy

- Radix Tooltip (1.2.16) no se abre al tocar: `onPointerMove` ignora el puntero táctil, el foco que llega con un toque
  no lo abre y `onClick` lo cierra. En el celular no se ve ni el motivo ni la (i).
- Con el mouse, `onPointerDown` cierra el tooltip abierto: el clic esconde el motivo.
- `CheckboxField` envuelve en `DisabledReason` sólo el `Checkbox`.
- El envoltorio de `DisabledReason` es un `span` enfocable sin rol ni nombre, y `IconButton` le pone `aria-label` a un
  `span` genérico.

## Tareas

Cada tarea arranca con su test en rojo (`vitest`, con `userEvent` y `pointerType: "touch"` para el toque) y cierra con
lint, tipos y los tests de las piezas que toca.

1. **Un `ActionTooltip` que también se abre al tocarlo.** Un modo para lo que sólo informa, el motivo y la (i): además
   del mouse y el foco, abre con el clic, el toque, Enter y Espacio, y cierra con Escape, al salir con el mouse, al
   perder el foco o con un toque afuera. Los tooltips de acción, como el nombre de un botón de ícono habilitado, no
   cambian: tocarlos hace la acción. Radix cierra el tooltip en `onPointerDown` y `onClick` del disparador. El modo
   controla `open` y corta esos cierres con `preventDefault` en los manejadores compuestos. Si en el toque no alcanza,
   se evalúa un `Popover` con la misma forma.
2. **`InfoTip` usa ese modo.** La (i) se abre al tocarla en el celular.
3. **`DisabledReason`: apagado, pero alcanzable.**
   - `Button`, `IconButton` y `Checkbox` quedan en el orden de Tab con `aria-disabled="true"` en lugar de `disabled`,
     sin el `span` envoltorio. Conservan el aspecto apagado (la opacidad de hoy) y reciben el puntero. El clic, Enter y
     Espacio muestran el motivo y no llaman a `onClick` ni a `onCheckedChange`. En un `type="submit"`, el clic se
     cancela con `preventDefault`, así un Enter en un campo del formulario tampoco lo envía.
   - Los campos (`Input`, `NativeSelect`, `Autocomplete`, `MultiSelect` y `CatalogFieldSourceInput`) y los `fieldset`
     conservan el envoltorio enfocable, con el nombre del control (`aria-labelledby` a su rótulo) y el motivo como
     descripción.
   - Se respetan los anchos de hoy: `className="grid w-full"` en los campos y `max-sm:*:flex-1` en el pie de un diálogo.
4. **`CheckboxField`.** El motivo responde en la fila entera, el cuadradito y su texto. Tocar el texto de una casilla
   apagada no la marca. Lo mismo en la casilla «Obligatorio» de `CatalogFieldsDialog`, que arma su propia fila.
5. **`IconButton` con `disabledLabel`.** El nombre sigue siendo `label`, y el motivo es el tooltip y la descripción, con
   el comportamiento de la tarea 3. Incluye la paginación, ↑ ↓ de preguntas y títulos, quitar un ítem en el mínimo y
   Ver o Descargar durante una espera. La × de un diálogo que no se puede cerrar ya usa `DisabledReason`.
6. **Recorrido de los consumidores.** Son los de la lista de abajo. Casi ninguno cambia. Se miran los que pasan
   `disabled` a un control nativo, los tests que buscan el `span[tabindex="0"]` del envoltorio y los pies de diálogo en
   el celular.
7. **Escena visual.** En el catálogo visual, una escena con la casilla apagada al pasar por su texto, un botón después
   de un clic y el toque en el celular (Playwright con `hasTouch` y `tap`), en es/en, a 1440 y a 390. Las referencias
   que ya existen no deberían cambiar. Si cambia alguna, se revisa una por una.
8. **Docs.** `src/shared/ui/AGENTS.md` (`DisabledReason`, `InfoTip`, `IconButton` y `CheckboxField`), el cierre en
   `visual-baseline.md` y el estado de este plan. La biblioteca del lienzo ya tiene `DisabledReason` en su deuda.
9. **Cierre.** Una sola vez: lint, build, `vitest` completo y `test:visual`, con la PC quieta o en tandas si está
   cargada. La prueba manual es guiada: en el celular, tocar «Permitir elegir varias» en una pregunta del bloque y una
   (i); en la compu, llegar con Tab a un botón apagado y escucharlo con el lector.

## Dónde se usa

Relevamiento del 2026-11-09: unos 120 lugares. No cambian los ítems de menú con el motivo adentro (`CatalogOptionsActions`,
`FormLifecycleMenu` y «Descargar ▾» de `ResponseDocuments`) ni las opciones con «· motivo» (el tipo de pregunta de
`QuestionEditor`, `CatalogPresentationSection` y `CatalogFieldSourceInput`).

| Archivo (en `src/features/`, salvo `shared/ui`) | Controles con motivo |
| --- | --- |
| `artificial-intelligence/components/BusinessFaqEditor.tsx` | 1 desplegable, 1 botón |
| `artificial-intelligence/components/BusinessHoursEditor.tsx` | 2 botones |
| `artificial-intelligence/components/BusinessPlaceSearch.tsx` | 1 combo |
| `artificial-intelligence/pages/AiSettingsPage.tsx` | 2 botones |
| `artificial-intelligence/pages/BusinessInformationPage.tsx` | 1 botón |
| `business-forms/components/ApprovalDecisionPanel.tsx` | 3 botones |
| `business-forms/components/CatalogExtraFieldInput.tsx` | 1 botón |
| `business-forms/components/CatalogFieldsDialog.tsx` | 1 botón, 1 casilla |
| `business-forms/components/CatalogGroupBy.tsx` | 1 casilla |
| `business-forms/components/CatalogImportDialog.tsx` | 1 botón |
| `business-forms/components/CatalogItemsTable.tsx` | 1 botón de ícono |
| `business-forms/components/CatalogOptionsActions.tsx` | 2 botones |
| `business-forms/components/CatalogQuestionFilters.tsx` | 3 botones |
| `business-forms/components/CatalogQuestionSelector.tsx` | 1 combo |
| `business-forms/components/CatalogQuestionSettings.tsx` | 2 botones, 1 combo |
| `business-forms/components/EntryFilesField.tsx` | 1 botón |
| `business-forms/components/FormConditionsEditor.tsx` | 1 botón |
| `business-forms/components/FormDeactivationDialog.tsx` | 1 botón |
| `business-forms/components/FormDeletionDialog.tsx` | 1 botón |
| `business-forms/components/FormEntryCorrectionPanel.tsx` | 1 botón |
| `business-forms/components/FormEntryPanel.tsx` | 1 botón |
| `business-forms/components/FormPdfPreview.tsx` | 1 botón |
| `business-forms/components/FormRulesSection.tsx` | 3 botones, 1 casilla |
| `business-forms/components/FormSuggestionsSection.tsx` | 3 botones |
| `business-forms/components/OfficialFormPreview.tsx` | 1 botón |
| `business-forms/components/PersonAttributeDialog.tsx` | 1 campo |
| `business-forms/components/PublicationCheckDialog.tsx` | 3 botones |
| `business-forms/components/PublicationProgress.tsx` | 2 botones |
| `business-forms/components/QuestionEditor.tsx` | 1 casilla, 4 botones de ícono, 1 botón |
| `business-forms/components/ResponseDocuments.tsx` | 2 botones de ícono, 2 botones |
| `business-forms/components/ResponseExportDialog.tsx` | 1 botón |
| `business-forms/components/ResponseFacetControl.tsx` | 1 botón |
| `business-forms/components/ResponseWorkflowHistory.tsx` | 4 botones |
| `business-forms/components/RevisionHistory.tsx` | 1 botón |
| `business-forms/components/SectionTitleEditor.tsx` | 2 botones de ícono |
| `business-forms/pages/CatalogEditorPage.tsx` | 1 botón |
| `business-forms/pages/CatalogFiltersEditorPage.tsx` | 1 botón |
| `business-forms/pages/FormEditorPage.tsx` | 8 botones |
| `business-forms/pages/FormEntryCorrectionPage.tsx` | 1 botón |
| `business-forms/pages/FormEntryPage.tsx` | 1 botón |
| `business-forms/pages/FormPdfDesignPage.tsx` | 1 botón |
| `business-forms/pages/MissingFormsPage.tsx` | 2 grupos, 1 botón |
| `business-forms/pages/PersonDataPage.tsx` | 1 botón |
| `profile/components/LoginMethodsCard.tsx` | 1 botón |
| `settings/pages/AppearancePage.tsx` | 2 botones |
| `settings/pages/SettingsPage.tsx` | 2 botones |
| `users/components/LastInvitationStrip.tsx` | 1 botón |
| `users/components/RolesField.tsx` | 1 combo |
| `whatsapp/components/ChatAudio.tsx` | 1 botón |
| `whatsapp/components/ChatComposer.tsx` | 2 botones |
| `whatsapp/components/ChatThread.tsx` | 1 botón |
| `whatsapp/components/FormCatalogPreparation.tsx` | 1 botón |
| `whatsapp/components/FormComposer.tsx` | 5 botones, 3 grupos |
| `shared/ui/dialog.tsx` | la × del diálogo |
| `shared/ui/ItemTable.tsx` | 1 botón de ícono, 2 botones |
| `shared/ui/Pagination.tsx` | 2 botones de ícono |

## Cuándo

Programar esto toca `shared/ui`, que usa casi toda la app. Con la app levantada, Vite recarga la página de quien prueba.
Va después del visto bueno del usuario y en un momento con el front quieto, acordado con el chat que coordina la prueba
integral.
