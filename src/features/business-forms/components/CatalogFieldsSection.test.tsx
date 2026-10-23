import { useState } from "react";
import { MemoryRouter } from "react-router";
import { act, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it } from "vitest";
import { renderWithProviders } from "@/test/utils/renderWithProviders";
import { newCatalogField, type CatalogFieldDraft } from "../catalogFields";
import { CatalogFieldsSection } from "./CatalogFieldsSection";
import type { CatalogFieldFeedback } from "../api/catalogFieldFeedback";

const field: CatalogFieldDraft = { ...newCatalogField("saved", 1), id: "01990000-0000-7000-8000-000000000001", key: "tax_id", name: { es: "CUIT" }, hasValues: true };
function Harness({ initial = [] as readonly CatalogFieldDraft[], readOnly = false, errors = {} as Readonly<Record<string, Readonly<Record<string, readonly string[]>>>>, feedback = null as CatalogFieldFeedback | null }) {
  const [fields, setFields] = useState(initial);
  const [confirmedRemovals, setConfirmedRemovals] = useState<readonly string[]>([]);
  return <CatalogFieldsSection fields={fields} culture="es" scope={{ actorId: "author", culture: "es", permissions: ["formcatalogs.read", "formcatalogs.manage"] }} readOnly={readOnly} errors={errors} feedback={feedback} confirmedRemovals={confirmedRemovals} onChange={(next, confirmed) => { setFields(next); setConfirmedRemovals(confirmed); }} />;
}
async function mount(initial?: readonly CatalogFieldDraft[], readOnly = false) {
  await act(async () => { renderWithProviders(<MemoryRouter><Harness initial={initial} readOnly={readOnly} /></MemoryRouter>); });
}
it("adds an optional field and keeps the new column unavailable until its identity is saved", async () => {
  await mount();
  await userEvent.click(screen.getByRole("button", { name: "Agregar campo" }));
  expect(screen.getByText("Nuevo, sin guardar")).toBeInTheDocument();
  expect(screen.getByRole("checkbox", { name: "Obligatorio" })).not.toBeChecked();
  expect(screen.getByRole("textbox", { name: "Clave" })).not.toHaveAttribute("readonly");
  expect(screen.getByRole("textbox", { name: "Nombre" })).toHaveFocus();
});
it("keeps a saved key immutable and requires a checked confirmation before removing values", async () => {
  await mount([field]);
  await userEvent.click(screen.getByRole("button", { name: "Editar campos" }));
  await userEvent.click(screen.getByRole("button", { name: "Editar CUIT" }));
  expect(screen.getByRole("textbox", { name: "Clave" })).toHaveAttribute("readonly");
  await userEvent.click(screen.getByRole("button", { name: "Quitar CUIT" }));
  const dialog = screen.getByRole("dialog");
  expect(within(dialog).getByRole("button", { name: "Quitar el campo" })).toBeDisabled();
  await userEvent.click(within(dialog).getByRole("checkbox"));
  await userEvent.click(within(dialog).getByRole("button", { name: "Quitar el campo" }));
  expect(screen.queryByRole("button", { name: "Editar CUIT" })).not.toBeInTheDocument();
});
it("shows where an in-use field is referenced and never offers to confirm its removal", async () => {
  await mount([{ ...field, usedBy: [{ definitionId: "01990000-0000-7000-8000-000000000002", formName: "Pedir repuesto", question: "Proveedor", stage: "Active" }] }]);
  await userEvent.click(screen.getByRole("button", { name: "Editar campos" }));
  await userEvent.click(screen.getByRole("button", { name: "Quitar CUIT" }));
  expect(within(screen.getByRole("dialog")).getByText(/Pedir repuesto/)).toBeInTheDocument();
  expect(within(screen.getByRole("dialog")).queryByRole("button", { name: "Quitar el campo" })).not.toBeInTheDocument();
});
it("opens the failed field and shows missing counts from the complete server validation", async () => {
  await act(async () => { renderWithProviders(<MemoryRouter><Harness initial={[field]} errors={{ saved: { required: ["Completá las opciones activas."] } }} feedback={{ missingCount: 12 }} /></MemoryRouter>); });
  expect(screen.getByText("Completá las opciones activas.")).toBeInTheDocument();
  expect(screen.getByText("Faltan valores en 12 opciones activas.")).toBeInTheDocument();
});

it("allows reading the full field definition without offering changes", async () => {
  await mount([field], true);
  await userEvent.click(screen.getByRole("button", { name: "Ver CUIT" }));
  expect(screen.getByRole("textbox", { name: "Clave" })).toHaveAttribute("readonly");
  expect(screen.queryByRole("button", { name: "Quitar CUIT" })).not.toBeInTheDocument();
});

it("shows a removed field rejected by a concurrent use and restores its identity without losing other edits", async () => {
  const other: CatalogFieldDraft = { ...newCatalogField("other", 2), name: { es: "Otro cambio" }, key: "other" };
  let savedFields: readonly CatalogFieldDraft[] = [field, other], confirmed: readonly string[] = [];
  const serverErrors = { saved: { isActive: ["El campo está en uso. Sacá esos usos para quitarlo."] } };
  function Recovery({ errors = {} as Readonly<Record<string, Readonly<Record<string, readonly string[]>>>> }) {
    const [values, setValues] = useState<readonly CatalogFieldDraft[]>([field, other]);
    const [removals, setRemovals] = useState<readonly string[]>([]);
    return <CatalogFieldsSection fields={values} culture="es" scope={{ actorId: "author", culture: "es", permissions: ["formcatalogs.read", "formcatalogs.manage"] }} readOnly={false} errors={errors} confirmedRemovals={removals} onChange={(next, nextRemovals) => { savedFields = next; confirmed = nextRemovals; setValues(next); setRemovals(nextRemovals); }} />;
  }
  let rendered!: ReturnType<typeof renderWithProviders>;
  await act(async () => { rendered = renderWithProviders(<MemoryRouter><Recovery /></MemoryRouter>); });
  await userEvent.click(screen.getByRole("button", { name: "Editar campos" }));
  await userEvent.click(screen.getByRole("button", { name: "Quitar CUIT" }));
  const dialog = screen.getByRole("dialog");
  await userEvent.click(within(dialog).getByRole("checkbox"));
  await userEvent.click(within(dialog).getByRole("button", { name: "Quitar el campo" }));
  expect(savedFields[0]?.isActive).toBe(false);
  expect(confirmed).toEqual([field.id]);
  await act(async () => { rendered.rerender(<MemoryRouter><Recovery errors={serverErrors} /></MemoryRouter>); });
  expect(await screen.findByRole("alert")).toHaveTextContent(serverErrors.saved.isActive[0]!);
  const restore = screen.getByRole("button", { name: "Restaurar el campo" });
  await userEvent.click(restore);
  expect(savedFields[0]).toMatchObject({ id: field.id, localId: field.localId, isActive: true });
  expect(savedFields[1]?.name.es).toBe("Otro cambio");
  expect(confirmed).toEqual([]);
  expect(screen.getByRole("button", { name: "Quitar CUIT" })).toBeInTheDocument();
});
