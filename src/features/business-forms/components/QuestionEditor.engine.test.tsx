import { act, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "@/test/utils/renderWithProviders";
import { QuestionEditor } from "./QuestionEditor";
import type { DraftQuestion } from "../model";

// Calculations (CA1-A), conditions (CO1-A) and the questions a library standard needs (BI1-A) in the editor of a question.
const concept: DraftQuestion = { localId: "field-concept", fieldId: "field-concept", replacesFieldId: null, type: "choice", label: { es: "Concepto" }, help: null, required: true,
  options: [{ localId: "choice-goods", choiceId: "choice-goods", label: { es: "Productos" } }, { localId: "choice-services", choiceId: "choice-services", label: { es: "Servicios" } }] };
const net: DraftQuestion = { localId: "field-net", fieldId: "field-net", replacesFieldId: null, type: "decimal", label: { es: "Neto" }, help: null, required: true };

async function mount(question: DraftQuestion, props: Partial<Parameters<typeof QuestionEditor>[0]> = {}) {
  const onChange = vi.fn();
  await act(async () => { renderWithProviders(<QuestionEditor question={question} position={2} total={2} culture="es" original="es" expanded readOnly={false}
    issues={[]} filesAvailable questions={[concept, question]} onChange={onChange} onExpand={() => {}} onMove={() => {}} onRemove={() => {}} {...props} />); });
  return onChange;
}

describe("calculations, conditions and bound questions in the editor of a question", () => {
  it("offers «Cálculo» and switches a saved number to it without a new identity nor asking, never required", async () => {
    const onChange = await mount(net);

    await pick(/^Tipo de respuesta /, "Cálculo");

    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    expect(onChange).toHaveBeenCalledWith({ ...net, required: false, calculation: { operation: "multiply", operands: [null, null] } });
  });

  it("reads a calculation in the list by its formula and has no «Obligatoria»", async () => {
    await mount({ ...net, required: false, calculation: { operation: "multiply", operands: ["field-net", null] } });
    expect(screen.getByText("Cálculo · Neto por …")).toBeVisible();
    expect(screen.queryByRole("checkbox", { name: "Obligatoria" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Qué calcula Multiplicar" })).toBeVisible();
  });

  it("says under the name when the question shows, and marks what is left to complete after a save stopped", async () => {
    await mount({ ...net, showWhen: { questionId: "field-concept", values: ["choice-services", "choice-goods"] } });
    expect(screen.getByText("Si Concepto es Servicios o…")).toBeVisible();

    await mount({ ...net, localId: "other", showWhen: { questionId: null, values: [] } }, { showIncomplete: true });
    expect(screen.getByText("Elegí la pregunta y al menos una respuesta.")).toBeVisible();
  });

  it("locks what the library standard needs, with the reason on each control, and leaves text and help free (BI1-A)", async () => {
    const onChange = await mount(net, { bound: true, removeReason: "La necesita el estándar de la biblioteca: no se puede quitar." });

    expect(screen.getByRole("button", { name: "La necesita el estándar de la biblioteca: se cambian el texto, la ayuda y el orden." })).toBeVisible();
    expect(screen.getByRole("group", { name: "Tipo de respuesta" })).toHaveAccessibleDescription("La necesita el estándar de la biblioteca: no se cambia.");
    expect(screen.getByRole("checkbox", { name: "Obligatoria" })).toHaveAttribute("aria-disabled", "true");
    expect(screen.getByRole("button", { name: "Quitar Neto" })).toHaveAccessibleDescription("La necesita el estándar de la biblioteca: no se puede quitar.");
    expect(screen.getByRole("button", { name: "Se muestra Siempre" })).toBeDisabled();
    expect(screen.getByRole("group", { name: "Se muestra" })).toHaveAccessibleDescription("La necesita el estándar de la biblioteca: no se cambia.");
    await userEvent.setup().type(screen.getByRole("textbox", { name: "Pregunta" }), " gravado");
    expect(onChange).toHaveBeenCalled();
  });

  // «Mínimo», «Máximo» and the files of a bound question say why they are off too (premise 5.4), like «Largo máximo».
  it("gives the reason on the range of choices and on the files of a bound question", async () => {
    const reason = "La necesita el estándar de la biblioteca: no se cambia.";
    const crops: DraftQuestion = { localId: "field-crops", fieldId: "field-crops", replacesFieldId: null, type: "multiChoice", label: { es: "Cultivos" }, help: null, required: false,
      selection: { minSelected: 0, maxSelected: 2 }, options: [{ localId: "soy", choiceId: "soy", label: { es: "Soja" } }, { localId: "corn", choiceId: "corn", label: { es: "Maíz" } }] };
    await mount(crops, { bound: true });
    for (const name of ["Mínimo", "Máximo"]) {
      const field = screen.getByRole("spinbutton", { name: new RegExp("^" + name) });
      expect(field).toBeDisabled();
      // The field keeps its own help before the reason.
      expect(field).toHaveAccessibleDescription(expect.stringContaining(reason));
    }
    const photo: DraftQuestion = { localId: "field-photo", fieldId: "field-photo", replacesFieldId: null, type: "photo", label: { es: "Foto" }, help: null, required: true,
      files: { minFiles: 1, maxFiles: 3, photoSource: "cameraOrGallery" } };
    await mount(photo, { bound: true });
    expect(screen.getByRole("button", { name: "De dónde sale la foto Cámara o galería" })).toBeDisabled();
    expect(screen.getByRole("group", { name: "De dónde sale la foto" })).toHaveAccessibleDescription(reason);
    for (const name of ["Mínimo", "Máximo"]) {
      const field = screen.getAllByRole("spinbutton", { name: new RegExp("^" + name) }).at(-1)!;
      expect(field).toBeDisabled();
      expect(field).toHaveAccessibleDescription(expect.stringContaining(reason));
    }
  });

  it("shows each toggle the standard declares below «Se carga varias veces», with its text and (i) in the menu language (IV2-A)", async () => {
    const user = userEvent.setup();
    const price: DraftQuestion = { localId: "field-price", fieldId: "field-price", replacesFieldId: null, type: "decimal", label: { es: "Precio unitario" }, help: null,
      required: true, repeated: true, toggles: [{ key: "pricesIncludeVat", label: { es: "El precio incluye IVA", en: "Prices include VAT" },
        help: { es: "Marcala si cargás precios finales.", en: "Check it if you enter final prices." }, value: false }] };
    const onChange = await mount(price, { bound: true, onRepeatedChange: () => {} });

    const repeated = screen.getByRole("checkbox", { name: "Se carga varias veces" });
    const toggle = screen.getByRole("checkbox", { name: "El precio incluye IVA" });
    expect(repeated.compareDocumentPosition(toggle) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(repeated).toHaveAttribute("aria-disabled", "true");
    expect(toggle).toHaveAccessibleDescription("Marcala si cargás precios finales.");
    expect(toggle).not.toBeChecked();
    await user.click(toggle);
    expect(onChange).toHaveBeenCalledWith({ ...price, toggles: [{ ...price.toggles![0]!, value: true }] });

    await mount({ ...price, localId: "english" }, { bound: true, culture: "en" });
    expect(screen.getByRole("checkbox", { name: "Prices include VAT" })).toHaveAccessibleDescription("Check it if you enter final prices.");
  });

  it("shows the standard's refusal of a change on top of the question", async () => {
    await mount(net, { issues: [{ path: "draft.fields[1]", messages: ["Esta pregunta la necesita el estándar del que viene el formulario."], fieldLocalId: "field-net" }] });
    expect(screen.getByRole("alert")).toHaveTextContent("Esta pregunta la necesita el estándar del que viene el formulario.");
  });
});

// The Picker opens with the keyboard, like the other Radix lists in the tests; its button says the label and the chosen one.
async function openList(trigger: string | RegExp | HTMLElement) {
  const button = trigger instanceof HTMLElement ? trigger : screen.getByRole("button", { name: trigger });
  await act(async () => { button.focus(); });
  await userEvent.keyboard("{Enter}");
  return screen.findByRole("listbox");
}
async function pick(trigger: string | RegExp | HTMLElement, option: string | RegExp) {
  await userEvent.click(within(await openList(trigger)).getByRole("option", { name: option }));
}
