import { useState } from "react";
import { MemoryRouter, RouterProvider, createMemoryRouter } from "react-router";
import { act, cleanup, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it, vi } from "vitest";
import { http, HttpResponse } from "msw";
import i18n from "@/shared/i18n";
import { server } from "@/test/mocks/server";
import { renderWithProviders } from "@/test/utils/renderWithProviders";
import { catalogFieldsBody, newCatalogField, type CatalogFieldDraft } from "../catalogFields";
import { CatalogFieldsSection } from "./CatalogFieldsSection";
import type { CatalogFieldFeedback } from "../api/catalogFieldFeedback";
import type { CatalogPresentation } from "../api/catalogResponse";

const field: CatalogFieldDraft = { ...newCatalogField("saved", 1), id: "01990000-0000-7000-8000-000000000001", key: "tax_id", name: { es: "CUIT" }, valuesCount: 2 };
const catalogPermissions = ["formcatalogs.read", "formcatalogs.manage"] as const;
function Harness({ initial = [] as readonly CatalogFieldDraft[], readOnly = false, errors = {} as Readonly<Record<string, Readonly<Record<string, readonly string[]>>>>, feedback = null as CatalogFieldFeedback | null, permissions = catalogPermissions as readonly string[], presentation = null as CatalogPresentation | null }) {
  const [fields, setFields] = useState(initial);
  const [confirmedRemovals, setConfirmedRemovals] = useState<readonly string[]>([]);
  return <CatalogFieldsSection fields={fields} presentation={presentation} culture="es" original="es" scope={{ actorId: "author", culture: "es", permissions }} readOnly={readOnly} errors={errors} feedback={feedback} confirmedRemovals={confirmedRemovals} onChange={(next, confirmed) => { setFields(next); setConfirmedRemovals(confirmed); }} />;
}
async function mount(initial?: readonly CatalogFieldDraft[], readOnly = false) {
  await act(async () => { renderWithProviders(<MemoryRouter><Harness initial={initial} readOnly={readOnly} /></MemoryRouter>); });
}
it("adds an optional field and keeps the new column unavailable until its identity is saved", async () => {
  await mount();
  // The phone always lists the fields: its band has only Add field, without a toggle for a table it does not have.
  expect(screen.queryByRole("button", { name: "Editar campos" })).not.toBeInTheDocument();
  await userEvent.click(within(screen.getByRole("heading", { name: "Campos" }).parentElement!).getByRole("button", { name: "Agregar campo" }));
  expect(screen.getByText("Nuevo, sin guardar")).toBeInTheDocument();
  expect(screen.getByRole("checkbox", { name: "Obligatorio" })).not.toBeChecked();
  expect(screen.getByRole("textbox", { name: "Clave" })).not.toHaveAttribute("readonly");
  expect(screen.getByRole("textbox", { name: "Nombre" })).toHaveFocus();
});
it("edits the field name in the menu language with a single name field", async () => {
  await i18n.changeLanguage("en");
  try {
    let changed: readonly CatalogFieldDraft[] = [];
    function English() {
      const [values, setValues] = useState<readonly CatalogFieldDraft[]>([]);
      return <CatalogFieldsSection fields={values} presentation={null} culture="en" original="en" scope={{ actorId: "author", culture: "en", permissions: catalogPermissions }} readOnly={false} confirmedRemovals={[]} onChange={next => { changed = next; setValues(next); }} />;
    }
    await act(async () => { renderWithProviders(<MemoryRouter><English /></MemoryRouter>); });
    await userEvent.click(screen.getByRole("button", { name: "Add field" }));
    expect(screen.queryByRole("textbox", { name: "Name in English" })).not.toBeInTheDocument();
    const name = screen.getByRole("textbox", { name: "Name" });
    expect(screen.getByText("Name", { selector: "label" })).toHaveTextContent(/^Name \*$/);
    expect(name).not.toHaveAttribute("placeholder");
    await userEvent.type(name, "Zone");
    expect(changed[0]?.name).toEqual({ en: "Zone" });
    expect(catalogFieldsBody(changed)[0]?.name).toEqual({ en: "Zone" });
  } finally {
    await i18n.changeLanguage("es");
  }
});
it("translates a field name with the original as reference and shows an error of the original under it", async () => {
  await i18n.changeLanguage("en");
  try {
    let changed: readonly CatalogFieldDraft[] = [];
    function Translation({ errors = {} }: { errors?: Readonly<Record<string, Readonly<Record<string, readonly string[]>>>> }) {
      const [values, setValues] = useState<readonly CatalogFieldDraft[]>([field]);
      return <CatalogFieldsSection fields={values} presentation={null} culture="en" original="es" scope={{ actorId: "author", culture: "en", permissions: catalogPermissions }} readOnly={false} confirmedRemovals={[]} errors={errors} onChange={next => { changed = next; setValues(next); }} />;
    }
    let rendered!: ReturnType<typeof renderWithProviders>;
    await act(async () => { rendered = renderWithProviders(<MemoryRouter><Translation /></MemoryRouter>); });
    await userEvent.click(screen.getByRole("button", { name: "Edit CUIT" }));
    const name = screen.getByRole("textbox", { name: "Name" });
    expect(screen.getByText("Name", { selector: "label" })).toHaveTextContent(/^Name$/);
    expect(name).toHaveValue("");
    expect(name).toHaveAttribute("placeholder", "Untranslated");
    expect(name).toHaveAccessibleDescription("Original (Spanish): CUIT");
    await userEvent.type(name, "Tax ID");
    expect(changed[0]?.name).toEqual({ es: "CUIT", en: "Tax ID" });
    await act(async () => { rendered.rerender(<MemoryRouter><Translation errors={{ saved: { "name.es": ["Enter the name."] } }} /></MemoryRouter>); });
    expect(screen.getByRole("textbox", { name: "Name" })).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByRole("textbox", { name: "Name" })).toHaveAccessibleDescription("In Spanish: Enter the name.");
  } finally {
    await i18n.changeLanguage("es");
  }
});
it("shows a field named only in the other language with that name in the table and its actions", async () => {
  const media = vi.spyOn(globalThis, "matchMedia").mockImplementation(query => ({ matches: query === "(min-width: 640px)", media: query, onchange: null, addListener: vi.fn(), removeListener: vi.fn(), addEventListener: vi.fn(), removeEventListener: vi.fn(), dispatchEvent: vi.fn() }) as MediaQueryList);
  try {
    const phone: CatalogFieldDraft = { ...field, name: { en: "Phone" } };
    await act(async () => { renderWithProviders(<MemoryRouter><CatalogFieldsSection fields={[phone]} presentation={null} culture="es" original="en" scope={{ actorId: "author", culture: "es", permissions: catalogPermissions }} readOnly={false} confirmedRemovals={[]} onChange={vi.fn()} /></MemoryRouter>); });
    await userEvent.click(screen.getByRole("button", { name: "Editar campos" }));
    expect(within(screen.getByRole("table")).getByRole("cell", { name: "Phone" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Editar Phone" })).toBeInTheDocument();
  } finally {
    media.mockRestore();
  }
});
it("keeps Edit fields and Add field in place after opening the fields table", async () => {
  const media = vi.spyOn(globalThis, "matchMedia").mockImplementation(query => ({ matches: query === "(min-width: 640px)", media: query, onchange: null, addListener: vi.fn(), removeListener: vi.fn(), addEventListener: vi.fn(), removeEventListener: vi.fn(), dispatchEvent: vi.fn() }) as MediaQueryList);
  try {
    await mount([field]);
    // Both actions live in the band beside the title: the toggle that opens the table and the one that adds a field.
    const band = screen.getByRole("heading", { name: "Campos" }).parentElement!;
    const toggle = within(band).getByRole("button", { name: "Editar campos" });
    const add = within(band).getByRole("button", { name: "Agregar campo" });
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
    await userEvent.click(toggle);
    // Opening the table keeps the same two buttons, in the same place, and does not add another one in the body.
    expect(toggle).toBeInTheDocument(); expect(toggle).toHaveAttribute("aria-expanded", "true");
    expect(within(band).getByRole("button", { name: "Editar campos" })).toBe(toggle);
    expect(within(band).getByRole("button", { name: "Agregar campo" })).toBe(add);
    expect(screen.getAllByRole("button", { name: "Agregar campo" })).toHaveLength(1);
    expect(screen.getByRole("table")).toBeInTheDocument();
    await userEvent.click(toggle);
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
    // Adding a field from the band opens the table with it.
    await userEvent.click(add);
    expect(toggle).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByText("Nuevo, sin guardar")).toBeInTheDocument();
    cleanup();
    // Without fields, Add field is still only in the band.
    await mount([]);
    const emptyBand = screen.getByRole("heading", { name: "Campos" }).parentElement!;
    expect(within(emptyBand).getByRole("button", { name: "Editar campos" })).toHaveAttribute("aria-expanded", "false");
    expect(screen.getAllByRole("button", { name: "Agregar campo" })).toEqual([within(emptyBand).getByRole("button", { name: "Agregar campo" })]);
  } finally {
    media.mockRestore();
  }
});
it("keeps the band's buttons in place while saving or a pending review makes the fields read-only for a Manage user", async () => {
  const band = () => screen.getByRole("heading", { name: "Campos" }).parentElement!;
  // On the phone: Add field stays in the band, turned off.
  let phone!: ReturnType<typeof renderWithProviders>;
  await act(async () => { phone = renderWithProviders(<MemoryRouter><Harness initial={[field]} /></MemoryRouter>); });
  const phoneAdd = within(band()).getByRole("button", { name: "Agregar campo" });
  await act(async () => { phone.rerender(<MemoryRouter><Harness initial={[field]} readOnly /></MemoryRouter>); });
  expect(within(band()).getByRole("button", { name: "Agregar campo" })).toBe(phoneAdd);
  expect(phoneAdd).toBeDisabled();
  cleanup();
  const media = vi.spyOn(globalThis, "matchMedia").mockImplementation(query => ({ matches: query === "(min-width: 640px)", media: query, onchange: null, addListener: vi.fn(), removeListener: vi.fn(), addEventListener: vi.fn(), removeEventListener: vi.fn(), dispatchEvent: vi.fn() }) as MediaQueryList);
  try {
    let view!: ReturnType<typeof renderWithProviders>;
    await act(async () => { view = renderWithProviders(<MemoryRouter><Harness initial={[field]} /></MemoryRouter>); });
    const toggle = within(band()).getByRole("button", { name: "Editar campos" });
    const add = within(band()).getByRole("button", { name: "Agregar campo" });
    // Saving or a pending review does not change the band: the same toggle with the same name, and Add field only turns off.
    await act(async () => { view.rerender(<MemoryRouter><Harness initial={[field]} readOnly /></MemoryRouter>); });
    expect(within(band()).getByRole("button", { name: "Editar campos" })).toBe(toggle);
    expect(within(band()).getByRole("button", { name: "Agregar campo" })).toBe(add);
    expect(toggle).toBeEnabled(); expect(add).toBeDisabled();
    cleanup();
    // Without Manage the toggle only shows the fields and there is nothing to add.
    await act(async () => { renderWithProviders(<MemoryRouter><Harness initial={[field]} readOnly permissions={["formcatalogs.read"]} /></MemoryRouter>); });
    expect(within(band()).getByRole("button", { name: "Ver campos" })).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("button", { name: "Agregar campo" })).not.toBeInTheDocument();
  } finally {
    media.mockRestore();
  }
});
it("keeps a saved key immutable and requires a checked confirmation before removing values", async () => {
  await mount([field]);
  await userEvent.click(screen.getByRole("button", { name: "Editar CUIT" }));
  expect(screen.getByRole("textbox", { name: "Clave" })).toHaveAttribute("readonly");
  await userEvent.click(screen.getByRole("button", { name: "Quitar CUIT" }));
  const dialog = screen.getByRole("dialog");
  expect(within(dialog).getByRole("button", { name: "Quitar el campo" })).toBeDisabled();
  await userEvent.click(within(dialog).getByRole("checkbox"));
  await userEvent.click(within(dialog).getByRole("button", { name: "Quitar el campo" }));
  expect(screen.queryByRole("button", { name: "Editar CUIT" })).not.toBeInTheDocument();
});
it("asks to confirm removing the field and its values with their count", async () => {
  const open = async (initial: CatalogFieldDraft) => {
    await mount([initial]);
    await userEvent.click(screen.getByRole("button", { name: "Quitar CUIT" }));
    return screen.getByRole("dialog");
  };
  for (const [valuesCount, label] of [[1200, "Sí, quitar el campo y sus 1.200 valores"], [1, "Sí, quitar el campo y su valor"]] as const) {
    const dialog = await open({ ...field, valuesCount });
    expect(within(dialog).getByRole("button", { name: "Quitar el campo" })).toBeDisabled();
    await userEvent.click(within(dialog).getByRole("checkbox", { name: label }));
    expect(within(dialog).getByRole("button", { name: "Quitar el campo" })).toBeEnabled();
    cleanup();
  }
  const empty = await open({ ...field, valuesCount: 0 });
  expect(within(empty).queryByRole("checkbox")).not.toBeInTheDocument();
  expect(within(empty).getByRole("button", { name: "Quitar el campo" })).toBeEnabled();
});
it("numbers the active fields and shows each type's detail", async () => {
  const source = "01990000-0000-7000-8000-000000000009";
  const cultures = [{ culture: "es", titleTooLongCount: 0, titleExamples: [], descriptionTooLongCount: 0, descriptionExamples: [] }, { culture: "en", titleTooLongCount: 0, titleExamples: [], descriptionTooLongCount: 0, descriptionExamples: [] }];
  server.use(http.get("/api/forms/catalogs/" + source, () => HttpResponse.json({ id: source, key: source.replaceAll("-", ""), name: { es: "Zonas", en: "Zones" }, description: { es: "Zonas de reparto", en: "Delivery zones" }, kind: "Manual", valueType: "Text", revision: 1, isActive: true, itemsCount: 72, usageCount: 1, originalCulture: "es", unavailableReasonCode: null, filters: null, proposal: null, fields: [], presentation: null, presentationCheck: { cultures } })));
  const saved = (localId: string, number: number, values: Partial<CatalogFieldDraft>): CatalogFieldDraft => ({ ...newCatalogField(localId, number), id: "01990000-0000-7000-8000-0000000001" + String(number).padStart(2, "0"), key: localId, name: { es: localId }, ...values });
  const fields = [
    saved("cuit", 1, { name: { es: "CUIT" }, maxLength: 13 }),
    saved("gone", 2, { name: { es: "Viejo" }, isActive: false }),
    saved("zone", 3, { name: { es: "Zona" }, type: "catalog", sourceCatalogId: source }),
    saved("days", 4, { name: { es: "Plazo" }, type: "integer", min: "0", max: "180" }),
    saved("amount", 5, { name: { es: "Monto" }, type: "decimal", min: "1.500,5" }),
    saved("due", 6, { name: { es: "Vence" }, type: "date", max: "2026-12-31" }),
    saved("gps", 7, { name: { es: "GPS" }, type: "boolean" }),
  ];
  const media = vi.spyOn(globalThis, "matchMedia").mockImplementation(query => ({ matches: query === "(min-width: 640px)", media: query, onchange: null, addListener: vi.fn(), removeListener: vi.fn(), addEventListener: vi.fn(), removeEventListener: vi.fn(), dispatchEvent: vi.fn() }) as MediaQueryList);
  try {
    await mount(fields);
    await userEvent.click(screen.getByRole("button", { name: "Editar campos" }));
    expect(screen.getAllByRole("columnheader")[0]).toHaveTextContent(/^#$/);
    expect(await screen.findByText("Zonas · 72 opciones")).toBeInTheDocument();
    const cells = (name: string) => within(screen.getAllByRole("row").find(row => within(row).queryByText(name))!).getAllByRole("cell");
    for (const [name, number, type, detail] of [["CUIT", "1", "Texto", "13 caracteres"], ["Zona", "2", "Elegir de un catálogo", "Zonas · 72 opciones"], ["Plazo", "3", "Entero", "De 0 a 180"], ["Monto", "4", "Decimal", "Desde 1.500,5"], ["Vence", "5", "Fecha", "Hasta 31/12/2026"], ["GPS", "6", "Sí o no", null]] as const) {
      const row = cells(name);
      expect(row[0]).toHaveTextContent(new RegExp("^" + number + "$"));
      expect(row[3]).toHaveTextContent(new RegExp("^" + type + (detail ?? "") + "$"));
      if (detail) expect(within(row[3]!).getByText(detail)).toBeInTheDocument();
    }
    expect(screen.queryByText("Viejo")).not.toBeInTheDocument();
  } finally {
    media.mockRestore();
  }
});
it("names the stage of each form use once and links to its question", async () => {
  const form = "01990000-0000-7000-8000-000000000002", question = "01990000-0000-7000-8000-000000000004";
  const use = { definitionId: form, formName: "Pedir repuesto", question: "Proveedor", questionId: question };
  const used: CatalogFieldDraft = { ...field, usedBy: [{ ...use, stage: "Active" }, { ...use, stage: "Draft" }] };
  for (const canOpenForms of [false, true]) {
    const router = createMemoryRouter([
      { path: "/catalogos/proveedores", element: <Harness initial={[used]} permissions={canOpenForms ? [...catalogPermissions, "formtemplates.read"] : catalogPermissions} /> },
      { path: "/formularios/:id", element: <p>Formulario</p> },
    ], { initialEntries: ["/catalogos/proveedores"] });
    await act(async () => { renderWithProviders(<RouterProvider router={router} />); });
    await userEvent.click(screen.getByRole("button", { name: "Quitar CUIT" }));
    const dialog = screen.getByRole("dialog");
    const items = within(dialog).getAllByRole("listitem");
    expect(items).toHaveLength(1);
    expect(items[0]).toHaveTextContent("«Proveedor» en Pedir repuesto, en la versión activa y en el borrador");
    expect(within(dialog).queryByRole("button", { name: "Quitar el campo" })).not.toBeInTheDocument();
    if (!canOpenForms) {
      expect(within(dialog).queryByRole("link")).not.toBeInTheDocument();
      cleanup();
      continue;
    }
    const link = within(dialog).getByRole("link", { name: "Ir a la pregunta «Proveedor» de Pedir repuesto" });
    expect(link).toHaveTextContent("Ir a la pregunta");
    expect(link).toHaveAttribute("href", "/formularios/" + form);
    await userEvent.click(link);
    expect(router.state.location.pathname).toBe("/formularios/" + form);
    expect(router.state.location.state).toEqual({ questionFieldId: question });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  }
});
it("shows the stage of uses whose form the reader cannot see and still blocks removal", async () => {
  const hidden = { definitionId: null, formName: null, question: null, questionId: null };
  await mount([{ ...field, usedBy: [{ ...hidden, stage: "Active" }, { ...hidden, stage: "Draft" }] }]);
  await userEvent.click(screen.getByRole("button", { name: "Quitar CUIT" }));
  const dialog = screen.getByRole("dialog");
  expect(within(dialog).getAllByRole("listitem").map(item => item.textContent)).toEqual(["La versión activa de un formulario", "El borrador de un formulario"]);
  expect(within(dialog).queryByRole("button", { name: "Quitar el campo" })).not.toBeInTheDocument();
});
it("shows the stage of a field-in-use conflict whose form the reader cannot see", async () => {
  const uses = [{ definitionId: null, formName: null, question: null, questionId: null, stage: "Draft" as const }];
  await act(async () => { renderWithProviders(<MemoryRouter><Harness initial={[{ ...field, isActive: false }]} errors={{ saved: { isActive: ["El campo está en uso."] } }} feedback={{ uses }} /></MemoryRouter>); });
  expect(screen.getByRole("alert")).toHaveTextContent("El borrador de un formulario");
});
it("shows the catalog's own WhatsApp use as part of this catalog instead of a form", async () => {
  const used: CatalogFieldDraft = { ...field, usedBy: [{ definitionId: null, formName: "Proveedores", question: null, questionId: null, stage: "Catalog" }] };
  await act(async () => { renderWithProviders(<MemoryRouter><Harness initial={[used]} presentation={{ title: ["text"], description: ["detail", field.id!] }} /></MemoryRouter>); });
  await userEvent.click(screen.getByRole("button", { name: "Quitar CUIT" }));
  const dialog = screen.getByRole("dialog");
  expect(within(dialog).queryByText(/Proveedores/)).not.toBeInTheDocument();
  expect(within(dialog).getByText("También se saca de «En WhatsApp» de este catálogo.")).toBeInTheDocument();
  await userEvent.click(within(dialog).getByRole("checkbox"));
  await userEvent.click(within(dialog).getByRole("button", { name: "Quitar el campo" }));
  expect(screen.queryByRole("button", { name: "Editar CUIT" })).not.toBeInTheDocument();
});
it("shows the restore error of an active field next to it", async () => {
  const message = "Hay valores que no cumplen las reglas del campo.";
  for (const desktop of [true, false]) {
    const media = vi.spyOn(globalThis, "matchMedia").mockImplementation(query => ({ matches: desktop && query === "(min-width: 640px)", media: query, onchange: null, addListener: vi.fn(), removeListener: vi.fn(), addEventListener: vi.fn(), removeEventListener: vi.fn(), dispatchEvent: vi.fn() }) as MediaQueryList);
    try {
      await act(async () => { renderWithProviders(<MemoryRouter><Harness initial={[field]} errors={{ saved: { isActive: [message] } }} feedback={{ invalidCount: 2 }} /></MemoryRouter>); });
      const row = desktop ? screen.getAllByRole("row").find(element => within(element).queryByText("CUIT"))! : screen.getByText("CUIT").parentElement!;
      expect(within(row).getByRole("alert")).toHaveTextContent(message);
      expect(screen.getAllByText(message)).toHaveLength(1);
    } finally {
      cleanup();
      media.mockRestore();
    }
  }
});
it.each([["maxLength", "text", "Máximo de caracteres"], ["min", "integer", "Mínimo"], ["max", "integer", "Máximo"], ["unique", "text", "Único"]] as const)("shows incompatible values of a %s change on that control", async (path, type, label) => {
  const message = "Hay valores que no cumplen las reglas del campo.";
  await act(async () => { renderWithProviders(<MemoryRouter><Harness initial={[{ ...field, type }]} errors={{ saved: { [path]: [message] } }} feedback={{ invalidCount: 2 }} /></MemoryRouter>); });
  expect(screen.getByLabelText(label)).toHaveAccessibleDescription(message);
  expect(screen.getAllByText(message)).toHaveLength(1);
});
it("counts the values of a rule change as not meeting the field rules, and only a type change as not converting", async () => {
  let rendered!: ReturnType<typeof renderWithProviders>;
  await act(async () => { rendered = renderWithProviders(<MemoryRouter><Harness initial={[field]} errors={{ saved: { maxLength: ["Hay valores que no cumplen las reglas del campo."] } }} feedback={{ invalidCount: 2 }} /></MemoryRouter>); });
  expect(screen.getByText("2 opciones tienen valores que no cumplen las reglas del campo.")).toBeInTheDocument();
  expect(screen.queryByText(/no convierten/)).not.toBeInTheDocument();
  await act(async () => { rendered.rerender(<MemoryRouter><Harness initial={[field]} errors={{ saved: { type: ["Hay valores que no se convierten al tipo nuevo."] } }} feedback={{ convertedCount: 0, invalidCount: 2 }} /></MemoryRouter>); });
  expect(screen.getByText("2 opciones tienen valores que no convierten.")).toBeInTheDocument();
});
it("opens the failed field and shows missing counts from the complete server validation", async () => {
  await act(async () => { renderWithProviders(<MemoryRouter><Harness initial={[field]} errors={{ saved: { required: ["Completá las opciones activas."] } }} feedback={{ missingCount: 12 }} /></MemoryRouter>); });
  expect(screen.getByText("Completá las opciones activas.")).toBeInTheDocument();
  expect(screen.getByText("Faltan valores en 12 opciones activas.")).toBeInTheDocument();
});

it.each(["role", "type", "sourceCatalogId"])("shows the uses next to an in-use %s error inside the editor of that field", async path => {
  const filter: CatalogFieldDraft = { ...field, role: "filter", type: path === "sourceCatalogId" ? "catalog" : "text", sourceCatalogId: path === "sourceCatalogId" ? "01990000-0000-7000-8000-000000000009" : null };
  const other: CatalogFieldDraft = { ...newCatalogField("other", 2), id: "01990000-0000-7000-8000-000000000003", key: "zone", name: { es: "Zona" } };
  const uses = [{ definitionId: "01990000-0000-7000-8000-000000000002", formName: "Pedir repuesto", question: "Proveedor", questionId: "01990000-0000-7000-8000-000000000004", stage: "Active" as const }];
  server.use(http.get("/api/forms/catalogs", () => HttpResponse.json({ items: [{ valueType: "Text", id: "01990000-0000-7000-8000-000000000009", name: "Proveedores", description: null, origin: "Manual", optionsCount: 2, usageCount: null, state: "Active", stateReason: null, canEdit: true }], page: 1, pageSize: 20, totalCount: 1, totalPages: 1, hasPrevious: false, hasNext: false, filterCounts: { byKind: { all: 1, manual: 1, filters: 0 } } })));
  await act(async () => { renderWithProviders(<MemoryRouter><Harness initial={[filter, other]} errors={{ saved: { [path]: ["El campo está en uso."] } }} feedback={{ uses }} /></MemoryRouter>); });
  expect(screen.getByText("El campo está en uso.")).toBeInTheDocument();
  expect(screen.getAllByText("«Proveedor» en Pedir repuesto, en la versión activa")).toHaveLength(1);
  expect(screen.getByRole("textbox", { name: "Clave" })).toHaveValue("tax_id");
});

it("allows reading the full field definition without offering changes", async () => {
  await mount([field], true);
  await userEvent.click(screen.getByRole("button", { name: "Ver CUIT" }));
  expect(screen.getByRole("textbox", { name: "Clave" })).toHaveAttribute("readonly");
  expect(screen.queryByRole("button", { name: "Quitar CUIT" })).not.toBeInTheDocument();
});

it("moves a field down and up past a hidden removed field in one step and leaves the removed field in its place", async () => {
  const first: CatalogFieldDraft = { ...newCatalogField("first", 1), id: "01990000-0000-7000-8000-000000000011", key: "alpha", name: { es: "Alfa" } };
  const removed: CatalogFieldDraft = { ...newCatalogField("removed", 2), id: "01990000-0000-7000-8000-000000000012", key: "beta", name: { es: "Beta" }, isActive: false };
  const last: CatalogFieldDraft = { ...newCatalogField("last", 3), id: "01990000-0000-7000-8000-000000000013", key: "gamma", name: { es: "Gama" } };
  let changed: readonly CatalogFieldDraft[] = [];
  function Ordering() {
    const [values, setValues] = useState<readonly CatalogFieldDraft[]>([first, removed, last]);
    return <CatalogFieldsSection fields={values} presentation={null} culture="es" original="es" scope={{ actorId: "author", culture: "es", permissions: ["formcatalogs.read", "formcatalogs.manage"] }} readOnly={false} confirmedRemovals={[]} onChange={next => { changed = next; setValues(next); }} />;
  }
  await act(async () => { renderWithProviders(<MemoryRouter><Ordering /></MemoryRouter>); });
  await userEvent.click(screen.getByRole("button", { name: "Bajar Alfa" }));
  expect(changed.map(value => value.localId)).toEqual(["last", "removed", "first"]);
  expect(screen.getAllByRole("button", { name: /^Editar (Alfa|Gama)$/ }).map(button => button.getAttribute("aria-label"))).toEqual(["Editar Gama", "Editar Alfa"]);
  expect(screen.getByRole("button", { name: "Subir Gama" })).toBeDisabled();
  await userEvent.click(screen.getByRole("button", { name: "Subir Alfa" }));
  expect(changed.map(value => value.localId)).toEqual(["first", "removed", "last"]);
  expect(screen.getAllByRole("button", { name: /^Editar (Alfa|Gama)$/ }).map(button => button.getAttribute("aria-label"))).toEqual(["Editar Alfa", "Editar Gama"]);
  expect(screen.getByRole("button", { name: "Subir Alfa" })).toBeDisabled();
});

it("shows a removed field rejected by a concurrent use and restores its identity without losing other edits", async () => {
  const other: CatalogFieldDraft = { ...newCatalogField("other", 2), name: { es: "Otro cambio" }, key: "other" };
  let savedFields: readonly CatalogFieldDraft[] = [field, other], confirmed: readonly string[] = [];
  const serverErrors = { saved: { isActive: ["El campo está en uso. Sacá esos usos para quitarlo."] } };
  function Recovery({ errors = {} as Readonly<Record<string, Readonly<Record<string, readonly string[]>>>> }) {
    const [values, setValues] = useState<readonly CatalogFieldDraft[]>([field, other]);
    const [removals, setRemovals] = useState<readonly string[]>([]);
    return <CatalogFieldsSection fields={values} presentation={null} culture="es" original="es" scope={{ actorId: "author", culture: "es", permissions: ["formcatalogs.read", "formcatalogs.manage"] }} readOnly={false} errors={errors} confirmedRemovals={removals} onChange={(next, nextRemovals) => { savedFields = next; confirmed = nextRemovals; setValues(next); setRemovals(nextRemovals); }} />;
  }
  let rendered!: ReturnType<typeof renderWithProviders>;
  await act(async () => { rendered = renderWithProviders(<MemoryRouter><Recovery /></MemoryRouter>); });
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
// The limit is the reason of the disabled Add field (tooltip and accessible description); saving or a review only turns it off.
it("explains the limit of fields on the disabled Add field", async () => {
  const full = Array.from({ length: 20 }, (_, index) => ({ ...field, localId: "saved-" + index, id: "01990000-0000-7000-8000-0000000001" + String(index).padStart(2, "0"), key: "field_" + index, name: { es: "Campo " + index } }));
  await mount(full);
  const add = screen.getByRole("button", { name: "Agregar campo" });
  expect(add).toBeDisabled();
  expect(add).toHaveAccessibleDescription("Un catálogo admite hasta 20 campos.");
  await userEvent.hover(add);
  expect(await screen.findByRole("tooltip")).toHaveTextContent("Un catálogo admite hasta 20 campos.");
  cleanup();
  // With the same 20 fields while saving or under review (`readOnly`), Add field is only off: the limit is not its reason.
  await mount(full, true);
  expect(screen.getByRole("button", { name: "Agregar campo" })).toBeDisabled();
  expect(screen.getByRole("button", { name: "Agregar campo" })).not.toHaveAccessibleDescription();
});
