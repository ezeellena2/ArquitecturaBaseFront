import { act, fireEvent, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import i18n from "@/shared/i18n";
import { renderWithProviders } from "@/test/utils/renderWithProviders";
import { QuestionEditor } from "./QuestionEditor";
import type { DraftQuestion } from "../model";

// The block of rows in the editor of a question (RG1-A, RG6-A, RG9-A), added with «Agregar bloque» (RG10-D) and with «ítem»
// in its texts (RG12-A).
const contact: DraftQuestion = { localId: "contact", fieldId: null, replacesFieldId: null, type: "shortText", label: { es: "Contacto" }, help: null, required: false, maxLength: 80 };
const unit: DraftQuestion = { localId: "unit", fieldId: null, replacesFieldId: null, type: "choice", label: { es: "Unidad" }, help: null, required: true, repeated: true,
  options: [{ localId: "liters", choiceId: null, label: { es: "Litros" } }] };
const block = (minRows = 1, maxRows = 20): DraftQuestion =>
  ({ localId: "block", fieldId: null, replacesFieldId: null, type: "group", label: { es: "Artículos", en: "Articles" }, help: null, required: minRows > 0, rows: { minRows, maxRows } });

async function mount(question: DraftQuestion, props: Partial<Parameters<typeof QuestionEditor>[0]> = {}) {
  const onChange = vi.fn();
  await act(async () => { renderWithProviders(<QuestionEditor question={question} position={1} total={1} culture="es" original="es" expanded readOnly={false}
    issues={[]} filesAvailable onChange={onChange} onExpand={() => {}} onMove={() => {}} onRemove={() => {}} {...props} />); });
  return onChange;
}

describe("the block of rows in the editor of a question", () => {
  it("no longer offers the block in «Tipo de respuesta»: it has its own button (RG10-D)", async () => {
    await mount(contact);
    const types = within(await openList(/^Tipo de respuesta /)).getAllByRole("option").map(item => item.textContent ?? "");

    expect(types.at(-1)).toBe("Ubicación");
    expect(types.filter(type => /Bloque|Renglones/.test(type))).toEqual([]);
  });
  it("turns off, in a question of the block, what an item does not hold, each with its reason", async () => {
    await mount(unit, { onRepeatedChange: () => {} });

    // Off, each with its reason as its description (MA1-A).
    const types = await openList(/^Tipo de respuesta /);
    for (const name of ["Foto", "Documento", "Ubicación"]) {
      expect(within(types).getByRole("option", { name })).toHaveAttribute("aria-disabled", "true");
      expect(within(types).getByRole("option", { name })).toHaveAccessibleDescription("No se carga varias veces");
    }
    await userEvent.keyboard("{Escape}");
    expect(screen.getByRole("checkbox", { name: "Permitir elegir varias" })).toHaveAttribute("aria-disabled", "true");
    expect(screen.getByRole("checkbox", { name: "Permitir elegir varias" })).toHaveAccessibleDescription("En un bloque se elige una sola opción.");
    expect(screen.getByRole("checkbox", { name: "Se carga varias veces" })).toBeChecked();
  });
  it("hands «Se carga varias veces» to the list, which moves the question, and its (i) speaks of items", async () => {
    const onRepeatedChange = vi.fn();
    await mount(contact, { onRepeatedChange });
    const repeated = screen.getByRole("checkbox", { name: "Se carga varias veces" });

    expect(repeated).toHaveAccessibleDescription("Se carga una vez por ítem, en la tabla del bloque.");
    await userEvent.click(repeated);

    expect(onRepeatedChange).toHaveBeenCalledWith(true);
  });
  it("edits the block's name, help and items, without «Tipo de respuesta»", async () => {
    const onChange = await mount(block(), { rowCount: 3 });

    expect(screen.getByText("Bloque · de 1 a 20 ítems · 3 preguntas")).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "Nombre" })).toHaveValue("Artículos");
    expect(screen.getByRole("textbox", { name: "Ayuda para el empleado (opcional)" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^Tipo de respuesta / })).not.toBeInTheDocument();
    expect(screen.queryByRole("checkbox", { name: "Obligatoria" })).not.toBeInTheDocument();
    expect(screen.queryByRole("checkbox", { name: "Se carga varias veces" })).not.toBeInTheDocument();
    expect(screen.getByText("Ítems")).toBeInTheDocument();
    expect(screen.getByRole("spinbutton", { name: "Máximo" })).toHaveAccessibleDescription("En WhatsApp se cargan hasta 10 ítems; en la app, hasta el máximo.");
    fireEvent.change(screen.getByRole("spinbutton", { name: "Mínimo" }), { target: { value: "0" } });

    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ rows: { minRows: 0, maxRows: 20 }, required: false }));
  });
  it("says in the list the items by the minimum and the maximum, with the plural of the last number (RG12-A)", async () => {
    const line = async (question: DraftQuestion, rowCount: number) => {
      let unmount = () => {};
      await act(async () => {
        ({ unmount } = renderWithProviders(<QuestionEditor question={question} position={1} total={1} culture="es" original="es" expanded={false} readOnly={false}
          issues={[]} rowCount={rowCount} onChange={() => {}} onExpand={() => {}} onMove={() => {}} onRemove={() => {}} />));
      });
      const text = screen.getByText(/^Bloque · /).textContent;
      unmount();
      return text;
    };

    expect(await line(block(1, 1), 2)).toBe("Bloque · 1 ítem · 2 preguntas");
    expect(await line(block(3, 3), 1)).toBe("Bloque · 3 ítems · 1 pregunta");
    expect(await line(block(0, 10), 3)).toBe("Bloque · hasta 10 ítems · 3 preguntas");
    expect(await line(block(1, 10), 3)).toBe("Bloque · de 1 a 10 ítems · 3 preguntas");
  });
  it("says the block and its items in English too", async () => {
    await act(async () => { await i18n.changeLanguage("en"); });
    try {
      await mount(block(0, 10), { rowCount: 3, culture: "en", original: "en" });

      expect(screen.getByText("Block · up to 10 items · 3 questions")).toBeInTheDocument();
      expect(screen.getByText("Items")).toBeInTheDocument();
      expect(screen.getByRole("spinbutton", { name: "Maximum" })).toHaveAccessibleDescription("WhatsApp loads up to 10 items; the app, up to the maximum.");
    } finally { await act(async () => { await i18n.changeLanguage("es"); }); }
  });
});

// The Picker opens with the keyboard, like the other Radix lists in the tests; its button says the label and the chosen one.
async function openList(trigger: string | RegExp | HTMLElement) {
  const button = trigger instanceof HTMLElement ? trigger : screen.getByRole("button", { name: trigger });
  await act(async () => { button.focus(); });
  await userEvent.keyboard("{Enter}");
  return screen.findByRole("listbox");
}
