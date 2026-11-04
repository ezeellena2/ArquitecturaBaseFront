import { act, fireEvent, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "@/test/utils/renderWithProviders";
import { QuestionEditor } from "./QuestionEditor";
import type { DraftQuestion } from "../model";

// The block of rows in the editor of a question (RG1-A, RG6-A, RG9-A).
const contact: DraftQuestion = { localId: "contact", fieldId: null, replacesFieldId: null, type: "shortText", label: { es: "Contacto" }, help: null, required: false, maxLength: 80 };
const unit: DraftQuestion = { localId: "unit", fieldId: null, replacesFieldId: null, type: "choice", label: { es: "Unidad" }, help: null, required: true, repeated: true,
  options: [{ localId: "liters", choiceId: null, label: { es: "Litros" } }] };
const block: DraftQuestion = { localId: "block", fieldId: null, replacesFieldId: null, type: "group", label: { es: "Artículos" }, help: null, required: true, rows: { minRows: 1, maxRows: 20 } };

async function mount(question: DraftQuestion, props: Partial<Parameters<typeof QuestionEditor>[0]> = {}) {
  const onChange = vi.fn();
  await act(async () => { renderWithProviders(<QuestionEditor question={question} position={1} total={1} culture="es" original="es" expanded readOnly={false}
    issues={[]} filesAvailable onChange={onChange} onExpand={() => {}} onMove={() => {}} onRemove={() => {}} {...props} />); });
  return onChange;
}
const option = (name: string) => screen.getByRole("option", { name });

describe("the block of rows in the editor of a question", () => {
  it("offers «Renglones» last and turns the question into a block that starts with 1 to 20 rows", async () => {
    const onChange = await mount(contact);
    const types = screen.getAllByRole("option").map(item => item.textContent);

    expect(types.at(-1)).toBe("Renglones");
    await userEvent.selectOptions(screen.getByRole("combobox", { name: "Tipo de respuesta" }), "group");

    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ type: "group", label: { es: "Contacto" }, required: true, rows: { minRows: 1, maxRows: 20 } }));
  });
  it("keeps «Renglones» off with its reason while the form has a block", async () => {
    await mount(contact, { blockExists: true });

    expect(option("Renglones · Ya hay un bloque de renglones")).toBeDisabled();
  });
  it("turns off, in a question of the block, what a row does not hold, each with its reason", async () => {
    await mount(unit, { blockExists: true, onRepeatedChange: () => {} });

    expect(option("Foto · No se carga varias veces")).toBeDisabled();
    expect(option("Documento · No se carga varias veces")).toBeDisabled();
    expect(option("Renglones · Ya hay un bloque de renglones")).toBeDisabled();
    expect(screen.getByRole("checkbox", { name: "Permitir elegir varias" })).toBeDisabled();
    expect(screen.getByRole("checkbox", { name: "Se carga varias veces" })).toBeChecked();
  });
  it("hands «Se carga varias veces» to the list, which moves the question", async () => {
    const onRepeatedChange = vi.fn();
    await mount(contact, { onRepeatedChange });

    await userEvent.click(screen.getByRole("checkbox", { name: "Se carga varias veces" }));

    expect(onRepeatedChange).toHaveBeenCalledWith(true);
  });
  it("keeps the type of a block with questions, so they are never left without a block", async () => {
    await mount(block, { rowCount: 2, blockExists: true });

    expect(screen.getByRole("combobox", { name: "Tipo de respuesta" })).toBeDisabled();
  });
  it("lets an empty block change its type back", async () => {
    await mount(block, { rowCount: 0, blockExists: true });

    expect(screen.getByRole("combobox", { name: "Tipo de respuesta" })).toBeEnabled();
  });
  it("edits the block's name, help and rows, and its line says the rows and its questions", async () => {
    const onChange = await mount(block, { rowCount: 3, blockExists: true });

    expect(screen.getByText("Renglones · de 1 a 20 · 3 preguntas")).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "Nombre" })).toHaveValue("Artículos");
    expect(screen.queryByRole("checkbox", { name: "Obligatoria" })).not.toBeInTheDocument();
    expect(screen.queryByRole("checkbox", { name: "Se carga varias veces" })).not.toBeInTheDocument();
    fireEvent.change(screen.getByRole("spinbutton", { name: "Mínimo" }), { target: { value: "0" } });

    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ rows: { minRows: 0, maxRows: 20 }, required: false }));
  });
});
