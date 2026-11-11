import { act, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it, vi } from "vitest";
import { renderWithProviders } from "@/test/utils/renderWithProviders";
import { QuestionEditor } from "./QuestionEditor";
import type { DraftQuestion } from "../model";

// UB3-A in the editor: «Ubicación» goes last in «Tipo de respuesta» and is only required or optional.
const place: DraftQuestion = { localId: "place", fieldId: null, replacesFieldId: null, type: "location", label: { es: "Dónde estás" }, help: null, required: true };
const contact: DraftQuestion = { localId: "contact", fieldId: null, replacesFieldId: null, type: "shortText", label: { es: "Contacto" }, help: null, required: false, maxLength: 80 };

async function mount(question: DraftQuestion, expanded = true) {
  const onChange = vi.fn();
  await act(async () => { renderWithProviders(<QuestionEditor question={question} position={1} total={1} culture="es" original="es" expanded={expanded} readOnly={false}
    issues={[]} filesAvailable onChange={onChange} onExpand={() => {}} onMove={() => {}} onRemove={() => {}} onRepeatedChange={() => {}} />); });
  return onChange;
}

it("offers «Ubicación» last and a new question becomes one at once, keeping its text", async () => {
  const onChange = await mount(contact);

  expect(screen.getAllByRole("option").map(option => option.textContent).at(-1)).toBe("Ubicación");
  await userEvent.selectOptions(screen.getByRole("combobox", { name: "Tipo de respuesta" }), "Ubicación");

  expect(onChange.mock.calls.at(-1)?.[0]).toMatchObject({ type: "location", label: { es: "Contacto" } });
  expect(onChange.mock.calls.at(-1)?.[0]).not.toHaveProperty("maxLength");
});

it("has only «Obligatoria»: no length, no options and it never goes in the block", async () => {
  await mount(place);

  expect(screen.getByRole("checkbox", { name: "Obligatoria" })).toBeChecked();
  expect(screen.queryByRole("checkbox", { name: "Se carga varias veces" })).not.toBeInTheDocument();
  expect(screen.queryByRole("spinbutton")).not.toBeInTheDocument();
});

it("reads «Ubicación · Obligatoria» on its line", async () => {
  await mount(place, false);

  expect(screen.getByText(/Ubicación · Obligatoria/)).toBeVisible();
});
