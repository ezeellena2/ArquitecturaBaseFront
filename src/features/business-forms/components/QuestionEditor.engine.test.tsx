import { act, screen } from "@testing-library/react";
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
    const user = userEvent.setup();
    const onChange = await mount(net);

    await user.selectOptions(screen.getByRole("combobox", { name: "Tipo de respuesta" }), "calculation");

    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    expect(onChange).toHaveBeenCalledWith({ ...net, required: false, calculation: { operation: "multiply", operands: [null, null] } });
  });

  it("reads a calculation in the list by its formula and has no «Obligatoria»", async () => {
    await mount({ ...net, required: false, calculation: { operation: "multiply", operands: ["field-net", null] } });
    expect(screen.getByText("Cálculo · Neto por …")).toBeVisible();
    expect(screen.queryByRole("checkbox", { name: "Obligatoria" })).not.toBeInTheDocument();
    expect(screen.getByRole("group", { name: "Qué calcula" })).toBeVisible();
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
    expect(screen.getByRole("button", { name: "Siempre" })).toHaveAttribute("aria-disabled", "true");
    await userEvent.setup().type(screen.getByRole("textbox", { name: "Pregunta" }), " gravado");
    expect(onChange).toHaveBeenCalled();
  });

  it("shows the standard's refusal of a change on top of the question", async () => {
    await mount(net, { issues: [{ path: "draft.fields[1]", messages: ["Esta pregunta la necesita el estándar del que viene el formulario."], fieldLocalId: "field-net" }] });
    expect(screen.getByRole("alert")).toHaveTextContent("Esta pregunta la necesita el estándar del que viene el formulario.");
  });
});
