import { act, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { expect, it, vi } from "vitest";
import { renderWithProviders } from "@/test/utils/renderWithProviders";
import { readFormEntry } from "../api/entries";
import { entryQuestionId, initialEntryDraft, type EntryDraft } from "../entryForm";
import { FormEntryForm } from "./FormEntryForm";

vi.setConfig({ testTimeout: 15_000 });

const id = (value: number) => "0199b0c0-0000-7000-8000-" + String(value).padStart(12, "0");
const fields = { crop: id(11), pests: id(12), sown: id(13) };
// Synthetic behavior DTO; the bodies the backend exports qualify the contract in entriesHttpContract.
const entry = readFormEntry({ definitionId: id(1), versionId: id(2), versionNumber: 1, prefix: "SIE", name: "Siembra", culture: "es", submitLabel: "Enviar", maxFileSizeMiB: 25,
  questions: [
    { fieldId: fields.crop, type: "choice", label: "Cultivo", help: "El de la campaña.", required: true, maxLength: null,
      options: [{ id: id(21), label: "Soja" }, { id: id(22), label: "Maíz" }], selection: null, files: null, catalog: null },
    { fieldId: fields.pests, type: "multiChoice", label: "Plagas", help: null, required: false, maxLength: null,
      options: [{ id: id(31), label: "Chinche" }, { id: id(32), label: "Oruga" }, { id: id(33), label: "Trips" }], selection: { minSelected: 0, maxSelected: 2 }, files: null, catalog: null },
    { fieldId: fields.sown, type: "boolean", label: "¿Se sembró?", help: null, required: false, maxLength: null, options: null, selection: null, files: null, catalog: null },
  ] });

function Harness({ errors = {}, disabled, onChange }: { errors?: Record<string, string>; disabled?: boolean; onChange?: (draft: EntryDraft) => void }) {
  const [draft, setDraft] = useState<EntryDraft>(initialEntryDraft(entry));
  return <>
    <FormEntryForm entry={entry} draft={draft} onChange={next => { onChange?.(next); setDraft(next); }} errors={errors} layout="page" disabled={disabled}/>
    <output data-testid="draft">{JSON.stringify({ values: draft.values, choices: draft.choices })}</output>
  </>;
}
const shown = () => JSON.parse(screen.getByTestId("draft").textContent!) as Pick<EntryDraft, "values" | "choices">;

/** The piece to choose opens with the keyboard, like the other Radix lists in the tests. */
async function openList(name: string) {
  const button = screen.getByRole("button", { name });
  await act(async () => { button.focus(); });
  await userEvent.keyboard("{Enter}");
  return screen.findByRole("listbox");
}

// 2026-11-22: up to five own options also go in the only piece to choose (DS1-A), as more than five already did.
it("chooses one of a few own options in the piece to choose, with «Sin respuesta» first, and choosing the one it has changes nothing", async () => {
  const onChange = vi.fn();
  await act(async () => { renderWithProviders(<Harness onChange={onChange}/>); });
  expect(screen.queryByRole("radio")).not.toBeInTheDocument();
  const crop = screen.getByRole("button", { name: "Cultivo Elegí una opción" });
  expect(crop).toHaveAccessibleDescription("El de la campaña.");

  const list = await openList("Cultivo Elegí una opción");
  expect(within(list).getAllByRole("option").map(option => option.textContent)).toEqual(["Sin respuesta", "Soja", "Maíz"]);
  await userEvent.click(within(list).getByRole("option", { name: "Maíz" }));
  expect(crop).toHaveAccessibleName("Cultivo Maíz");
  expect(crop).toHaveFocus();
  expect(shown().choices[fields.crop]).toEqual([{ id: id(22), title: "Maíz", description: null }]);

  await userEvent.click(within(await openList("Cultivo Maíz")).getByRole("option", { name: "Maíz" }));
  expect(onChange).toHaveBeenCalledTimes(1);
  await userEvent.click(within(await openList("Cultivo Maíz")).getByRole("option", { name: "Sin respuesta" }));
  expect(crop).toHaveAccessibleName("Cultivo Elegí una opción");
  expect(shown().choices[fields.crop]).toEqual([]);
});

// The «Sí | No» starts with nothing chosen, as the segmented did.
it("starts a yes or no with nothing chosen and chooses it in the piece to choose", async () => {
  const onChange = vi.fn();
  await act(async () => { renderWithProviders(<Harness onChange={onChange}/>); });
  const sown = screen.getByRole("button", { name: "¿Se sembró? Elegí una opción" });

  const list = await openList("¿Se sembró? Elegí una opción");
  expect(within(list).getAllByRole("option").map(option => [option.textContent, option.getAttribute("aria-selected")])).toEqual([["Sí", "false"], ["No", "false"]]);
  await userEvent.click(within(list).getByRole("option", { name: "No" }));
  expect(sown).toHaveAccessibleName("¿Se sembró? No");
  expect(shown().values[fields.sown]).toBe("false");

  await userEvent.click(within(await openList("¿Se sembró? No")).getByRole("option", { name: "No" }));
  expect(onChange).toHaveBeenCalledTimes(1);
});

// Several own options are the piece with `multiple`: the limit stays in the label and the list says it; marking does not close.
it("chooses several own options in the piece to choose, up to the limit of the question", async () => {
  await act(async () => { renderWithProviders(<Harness/>); });
  expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
  expect(screen.getByText("hasta 2")).toBeVisible();
  const pests = screen.getByRole("button", { name: "Plagas Elegí una opción" });

  const list = await openList("Plagas Elegí una opción");
  expect(list).toHaveAttribute("aria-multiselectable", "true");
  expect(within(list).getAllByRole("option").map(option => option.textContent)).toEqual(["Chinche", "Oruga", "Trips"]);
  expect(screen.getByText("Hasta 2")).toBeVisible();
  await userEvent.click(within(list).getByRole("option", { name: "Trips" }));
  await userEvent.click(within(list).getByRole("option", { name: "Chinche" }));
  expect(screen.getByText("Elegiste 2 de 2")).toBeVisible();
  expect(within(list).getByRole("option", { name: "Oruga" })).toHaveAttribute("aria-disabled", "true");
  await userEvent.keyboard("{Escape}");

  expect(pests).toHaveAccessibleName("Plagas Chinche, Trips");
  expect(shown().choices[fields.pests]).toEqual([{ id: id(33), title: "Trips", description: null }, { id: id(31), title: "Chinche", description: null }]);
});

// The page takes the focus to the first question with a problem by its id (`entryQuestionId`): the button of the piece.
it("marks each question with a problem on its button, which keeps the id the focus goes to, and turns them off while sending", async () => {
  const errors = { [fields.crop]: "Elegí una opción.", [fields.pests]: "Elegí hasta 2.", [fields.sown]: "Completá esta respuesta." };
  let view!: ReturnType<typeof renderWithProviders>;
  await act(async () => { view = renderWithProviders(<Harness errors={errors}/>); });
  for (const [fieldId, name] of [[fields.crop, "Cultivo Elegí una opción"], [fields.pests, "Plagas Elegí una opción"], [fields.sown, "¿Se sembró? Elegí una opción"]]) {
    const button = screen.getByRole("button", { name });
    expect(button).toHaveAttribute("id", entryQuestionId(fieldId));
    expect(button).toHaveAttribute("aria-invalid", "true");
    expect(button).toHaveAccessibleDescription(errors[fieldId]);
  }
  view.unmount();

  await act(async () => { renderWithProviders(<Harness disabled/>); });
  for (const name of ["Cultivo Elegí una opción", "Plagas Elegí una opción", "¿Se sembró? Elegí una opción"]) expect(screen.getByRole("button", { name })).toBeDisabled();
});
