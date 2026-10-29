import { useState } from "react";
import { MemoryRouter, RouterProvider, createMemoryRouter } from "react-router";
import { act, cleanup, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, expect, it, vi, type MockInstance } from "vitest";
import { http, HttpResponse } from "msw";
import i18n from "@/shared/i18n";
import { server } from "@/test/mocks/server";
import { renderWithProviders } from "@/test/utils/renderWithProviders";
import { catalogFieldsBody, newCatalogField, type CatalogFieldDraft, type CatalogFieldType } from "../catalogFields";
import type { CatalogFieldFeedback } from "../api/catalogFieldFeedback";
import type { CatalogPresentation } from "../api/catalogResponse";
import type { FormCulture } from "../model";
import { CatalogFieldsDialog } from "./CatalogFieldsDialog";
import { CatalogFieldsButton, CatalogFieldsNotice } from "./CatalogFieldsNotice";

type Errors = Readonly<Record<string, Readonly<Record<string, readonly string[]>>>>;
const field: CatalogFieldDraft = { ...newCatalogField("saved", 1), id: "01990000-0000-7000-8000-000000000001", key: "tax_id", name: { es: "CUIT" }, valuesCount: 2 };
const zone: CatalogFieldDraft = { ...newCatalogField("zone", 2), id: "01990000-0000-7000-8000-000000000003", key: "zone", name: { es: "Zona" }, role: "filter" };
const catalogPermissions = ["formcatalogs.read", "formcatalogs.manage"] as const;
const optionalFirst = "Un campo nuevo nace opcional: para hacerlo obligatorio, todas las opciones activas necesitan un valor.";

// As in the catalog editor: «Agregar campos» in the options header, the notice above the table and the modal, mounted while open.
function Harness({ initial = [] as readonly CatalogFieldDraft[], readOnly = false, errors = {} as Errors, feedback = null as CatalogFieldFeedback | null, permissions = catalogPermissions as readonly string[], presentation = null as CatalogPresentation | null, savedTypes = undefined as Readonly<Record<string, CatalogFieldType>> | undefined, culture = "es" as FormCulture, original = "es" as FormCulture, onChange = (() => undefined) as (fields: readonly CatalogFieldDraft[], confirmed: readonly string[]) => void }) {
  const [fields, setFields] = useState(initial);
  const [confirmedRemovals, setConfirmedRemovals] = useState<readonly string[]>([]);
  const [open, setOpen] = useState<{ fieldId: string | null } | null>(null);
  const scope = { actorId: "author", culture, permissions };
  return <>
    <CatalogFieldsButton fields={fields} errors={errors} canManage={permissions.includes("formcatalogs.manage")} onOpen={() => setOpen({ fieldId: null })} />
    <CatalogFieldsNotice fields={fields} errors={errors} feedback={feedback} culture={culture} onReview={fieldId => setOpen({ fieldId })} />
    {open ? <CatalogFieldsDialog catalogName="Proveedores" fields={fields} presentation={presentation} culture={culture} original={original} scope={scope} readOnly={readOnly} confirmedRemovals={confirmedRemovals} errors={errors} feedback={feedback} savedTypes={savedTypes} initialFieldId={open.fieldId}
      onApply={(next, confirmed) => { setFields(next); setConfirmedRemovals(confirmed); onChange(next, confirmed); }} onClose={() => setOpen(null)} /> : null}
  </>;
}
// From 640 px the modal shows the list and the chosen field side by side; below, first the list and then the field.
const onDesktop = () => vi.spyOn(globalThis, "matchMedia").mockImplementation(query => ({ matches: query === "(min-width: 640px)", media: query, onchange: null, addListener: vi.fn(), removeListener: vi.fn(), addEventListener: vi.fn(), removeEventListener: vi.fn(), dispatchEvent: vi.fn() }) as MediaQueryList);
let media: MockInstance | null = null;
beforeEach(() => { media = onDesktop(); });
afterEach(() => { media?.mockRestore(); media = null; });
async function mount(props: Parameters<typeof Harness>[0] = {}) {
  let rendered!: ReturnType<typeof renderWithProviders>;
  await act(async () => { rendered = renderWithProviders(<MemoryRouter><Harness {...props} /></MemoryRouter>); });
  return rendered;
}
async function openFields(name: RegExp | string = /^Agregar campos/) {
  await userEvent.click(screen.getByRole("button", { name }));
  return screen.getByRole("dialog");
}

it("opens every field from «Agregar campos», with their count, in a modal with the list and the chosen field", async () => {
  await mount({ initial: [field, zone] });
  const dialog = await openFields("Agregar campos · 2");
  expect(dialog).toHaveAccessibleName("Campos de «Proveedores»");
  const cuit = within(dialog).getByRole("button", { name: "Editar CUIT" });
  expect(cuit).toHaveAttribute("aria-current", "true");
  expect(cuit).toHaveTextContent(/1\s*CUIT\s*Texto · Dato/);
  expect(within(dialog).getByRole("button", { name: "Editar Zona" })).toHaveTextContent(/2\s*Zona\s*Texto · Filtro/);
  expect(within(dialog).getByText("Campo 1 de 2")).toBeInTheDocument();
  expect(within(dialog).getByRole("textbox", { name: "Nombre" })).toHaveValue("CUIT");
  expect(within(dialog).getByText("2 de 20")).toBeInTheDocument();
  await userEvent.click(within(dialog).getByRole("button", { name: "Editar Zona" }));
  expect(within(dialog).getByRole("textbox", { name: "Nombre" })).toHaveValue("Zona");
  expect(within(dialog).getByText("Campo 2 de 2")).toBeInTheDocument();
  expect(within(dialog).getByRole("button", { name: "Filtro" })).toHaveAttribute("aria-pressed", "true");
  cleanup();
  // Without fields «Agregar campos» has no count and opens on a new field, with the cursor in its name; untouched, «Listo»
  // leaves nothing in the catalog.
  const onChange = vi.fn();
  await mount({ onChange });
  const empty = await openFields("Agregar campos");
  expect(within(empty).getByRole("heading", { name: "Nuevo campo" })).toBeInTheDocument();
  expect(within(empty).getByRole("textbox", { name: "Nombre" })).toHaveFocus();
  await userEvent.click(within(empty).getByRole("button", { name: "Listo" }));
  expect(onChange).not.toHaveBeenCalled();
});

it("leaves the modal's changes in the catalog with «Listo» and discards them with «Cancelar»", async () => {
  const onChange = vi.fn();
  await mount({ initial: [field], onChange });
  let dialog = await openFields();
  await userEvent.type(within(dialog).getByRole("textbox", { name: "Nombre" }), " del proveedor");
  await userEvent.click(within(dialog).getByRole("button", { name: "Cancelar" }));
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  expect(onChange).not.toHaveBeenCalled();
  expect(screen.getByRole("button", { name: "Agregar campos · 1" })).toHaveFocus();
  dialog = await openFields();
  expect(within(dialog).getByRole("textbox", { name: "Nombre" })).toHaveValue("CUIT");
  await userEvent.type(within(dialog).getByRole("textbox", { name: "Nombre" }), " del proveedor");
  await userEvent.click(within(dialog).getByRole("button", { name: "Listo" }));
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  expect(onChange).toHaveBeenCalledTimes(1);
  expect(onChange.mock.calls[0]![0][0].name).toEqual({ es: "CUIT del proveedor" });
  // «Listo» without changes leaves the catalog as it is.
  await openFields();
  await userEvent.click(screen.getByRole("button", { name: "Listo" }));
  expect(onChange).toHaveBeenCalledTimes(1);
});

it("adds an optional field at the end, with the cursor in its name, and says why it starts optional", async () => {
  await mount({ initial: [field] });
  const dialog = await openFields();
  await userEvent.click(within(dialog).getByRole("button", { name: "Agregar campo" }));
  const name = within(dialog).getByRole("textbox", { name: "Nombre" });
  expect(name).toHaveFocus();
  expect(name).toHaveValue("");
  expect(within(dialog).getByRole("button", { name: "Editar Nuevo campo" })).toHaveAttribute("aria-current", "true");
  expect(within(dialog).getByText("Nuevo")).toBeInTheDocument();
  expect(within(dialog).getByText("2 de 20")).toBeInTheDocument();
  expect(within(dialog).getByRole("textbox", { name: "Clave" })).not.toHaveAttribute("readonly");
  const required = within(dialog).getByRole("checkbox", { name: "Obligatorio" });
  expect(required).toBeDisabled();
  expect(required).toHaveAccessibleDescription(optionalFirst);
  expect(within(dialog).queryByText(optionalFirst, { selector: "p" })).not.toBeInTheDocument();
  expect(within(dialog).getByRole("button", { name: "Dato" })).toHaveAttribute("aria-pressed", "true");
  // A saved field can be made required.
  await userEvent.click(within(dialog).getByRole("button", { name: "Editar CUIT" }));
  expect(within(dialog).getByRole("checkbox", { name: "Obligatorio" })).toBeEnabled();
});

it("edits the field name in the menu language with a single name field", async () => {
  await i18n.changeLanguage("en");
  try {
    let changed: readonly CatalogFieldDraft[] = [];
    await mount({ culture: "en", original: "en", onChange: next => { changed = next; } });
    const dialog = await openFields("Add fields");
    expect(within(dialog).queryByRole("textbox", { name: "Name in English" })).not.toBeInTheDocument();
    const name = within(dialog).getByRole("textbox", { name: "Name" });
    expect(within(dialog).getByText("Name", { selector: "label" })).toHaveTextContent(/^Name \*$/);
    expect(name).not.toHaveAttribute("placeholder");
    await userEvent.type(name, "Zone");
    await userEvent.click(within(dialog).getByRole("button", { name: "Done" }));
    expect(changed[0]?.name).toEqual({ en: "Zone" });
    expect(catalogFieldsBody(changed)[0]?.name).toEqual({ en: "Zone" });
  } finally {
    await i18n.changeLanguage("es");
  }
});

it("translates a field name with the original as reference, and «Review» shows an error of the original under it", async () => {
  await i18n.changeLanguage("en");
  try {
    let changed: readonly CatalogFieldDraft[] = [];
    const rendered = await mount({ initial: [field], culture: "en", original: "es", onChange: next => { changed = next; } });
    const dialog = await openFields(/^Add fields/);
    await userEvent.click(within(dialog).getByRole("button", { name: "Edit CUIT" }));
    const name = within(dialog).getByRole("textbox", { name: "Name" });
    expect(within(dialog).getByText("Name", { selector: "label" })).toHaveTextContent(/^Name$/);
    expect(name).toHaveValue("");
    expect(name).toHaveAttribute("placeholder", "Untranslated");
    expect(name).toHaveAccessibleDescription("Original (Spanish): CUIT");
    await userEvent.type(name, "Tax ID");
    await userEvent.click(within(dialog).getByRole("button", { name: "Done" }));
    expect(changed[0]?.name).toEqual({ es: "CUIT", en: "Tax ID" });
    await act(async () => { rendered.rerender(<MemoryRouter><Harness initial={[field]} culture="en" original="es" errors={{ saved: { "name.es": ["Enter the name."] } }} /></MemoryRouter>); });
    await userEvent.click(within(screen.getByRole("alert")).getByRole("button", { name: "Review" }));
    const reviewed = screen.getByRole("textbox", { name: "Name" });
    expect(reviewed).toHaveAttribute("aria-invalid", "true");
    expect(reviewed).toHaveAccessibleDescription("In Spanish: Enter the name.");
  } finally {
    await i18n.changeLanguage("es");
  }
});

it("shows a field named only in the other language with that name in the list", async () => {
  await mount({ initial: [{ ...field, name: { en: "Phone" } }], original: "en" });
  const dialog = await openFields();
  expect(within(dialog).getByRole("button", { name: "Editar Phone" })).toBeInTheDocument();
  // The Spanish name is the optional translation: empty, with the original as its reference.
  const name = within(dialog).getByRole("textbox", { name: "Nombre" });
  expect(name).toHaveValue("");
  expect(name).toHaveAttribute("placeholder", "Sin traducir");
  expect(name).toHaveAccessibleDescription("Original (Inglés): Phone");
});

it("keeps a saved key immutable and requires a checked confirmation before removing values", async () => {
  const onChange = vi.fn();
  await mount({ initial: [field], onChange });
  const dialog = await openFields();
  expect(within(dialog).getByRole("textbox", { name: "Clave" })).toHaveAttribute("readonly");
  await userEvent.click(within(dialog).getByRole("button", { name: "Quitar campo" }));
  const confirm = screen.getByRole("dialog", { name: "Quitar «CUIT»" });
  expect(within(confirm).getByRole("button", { name: "Quitar el campo" })).toBeDisabled();
  await userEvent.click(within(confirm).getByRole("checkbox"));
  await userEvent.click(within(confirm).getByRole("button", { name: "Quitar el campo" }));
  expect(screen.queryByRole("dialog", { name: "Quitar «CUIT»" })).not.toBeInTheDocument();
  expect(within(dialog).queryByRole("button", { name: "Editar CUIT" })).not.toBeInTheDocument();
  await userEvent.click(within(dialog).getByRole("button", { name: "Listo" }));
  expect(onChange).toHaveBeenCalledWith([{ ...field, isActive: false }], [field.id]);
});

it("asks to confirm removing the field and its values with their count", async () => {
  const open = async (initial: CatalogFieldDraft) => {
    await mount({ initial: [initial] });
    await userEvent.click(within(await openFields()).getByRole("button", { name: "Quitar campo" }));
    return screen.getByRole("dialog", { name: "Quitar «CUIT»" });
  };
  for (const [valuesCount, label] of [[1200, "Sí, quitar el campo y sus 1.200 valores"], [1, "Sí, quitar el campo y su valor"]] as const) {
    const confirm = await open({ ...field, valuesCount });
    expect(within(confirm).getByRole("button", { name: "Quitar el campo" })).toBeDisabled();
    await userEvent.click(within(confirm).getByRole("checkbox", { name: label }));
    expect(within(confirm).getByRole("button", { name: "Quitar el campo" })).toBeEnabled();
    cleanup();
  }
  const empty = await open({ ...field, valuesCount: 0 });
  expect(within(empty).queryByRole("checkbox")).not.toBeInTheDocument();
  expect(within(empty).getByRole("button", { name: "Quitar el campo" })).toBeEnabled();
});

it("puts the type's detail beside the type and changes it with the type", async () => {
  await mount({ initial: [{ ...field, maxLength: 13 }] });
  const dialog = await openFields();
  expect(within(dialog).getByRole("spinbutton", { name: "Máximo de caracteres" })).toHaveValue(13);
  await userEvent.selectOptions(within(dialog).getByRole("combobox", { name: "Tipo" }), "integer");
  expect(within(dialog).queryByRole("spinbutton", { name: "Máximo de caracteres" })).not.toBeInTheDocument();
  await userEvent.type(within(dialog).getByRole("textbox", { name: "Mínimo" }), "0");
  await userEvent.type(within(dialog).getByRole("textbox", { name: "Máximo" }), "180");
  expect(within(dialog).getByRole("textbox", { name: "Máximo" })).toHaveValue("180");
  await userEvent.click(within(dialog).getByRole("checkbox", { name: "Único" }));
  expect(within(dialog).getByRole("checkbox", { name: "Único" })).toBeChecked();
  await userEvent.click(within(dialog).getByRole("checkbox", { name: "Obligatorio" }));
  expect(within(dialog).getByRole("checkbox", { name: "Obligatorio" })).toBeChecked();
  await userEvent.click(within(dialog).getByRole("button", { name: "Filtro" }));
  expect(within(dialog).getByRole("button", { name: "Filtro" })).toHaveAttribute("aria-pressed", "true");
  expect(within(dialog).getByText("Para mostrarle a cada persona lo suyo, o para un filtro fijo de una pregunta.")).toBeInTheDocument();
  await userEvent.selectOptions(within(dialog).getByRole("combobox", { name: "Tipo" }), "boolean");
  expect(within(dialog).queryByRole("textbox", { name: "Mínimo" })).not.toBeInTheDocument();
});

it.each([
  ["Qué es la clave", "La usan la plantilla, la importación y lo guardado. No cambia después de guardar."],
  ["Qué es el papel", "Filtro: para mostrarle a cada persona lo suyo, o para un filtro fijo de una pregunta. Dato: se guarda con la opción y viaja con la respuesta."],
])("explains a control with a tooltip: %s", async (help, text) => {
  await mount({ initial: [field] });
  const dialog = await openFields();
  await userEvent.hover(within(dialog).getByRole("button", { name: help }));
  expect(await screen.findByRole("tooltip")).toHaveTextContent(text);
  expect(screen.queryByText(text, { selector: "p" })).not.toBeInTheDocument();
});

it("shows the fields as text to someone who can only read them", async () => {
  const source = "01990000-0000-7000-8000-000000000009";
  const cultures = [{ culture: "es", titleTooLongCount: 0, titleExamples: [], descriptionTooLongCount: 0, descriptionExamples: [] }, { culture: "en", titleTooLongCount: 0, titleExamples: [], descriptionTooLongCount: 0, descriptionExamples: [] }];
  server.use(http.get("/api/forms/catalogs/" + source, () => HttpResponse.json({ id: source, key: source.replaceAll("-", ""), name: { es: "Zonas", en: "Zones" }, description: { es: "Zonas de reparto", en: "Delivery zones" }, kind: "Manual", valueType: "Text", revision: 1, isActive: true, itemsCount: 73, usageCount: 1, originalCulture: "es", unavailableReasonCode: null, filters: null, proposal: null, fields: [], presentation: null, presentationCheck: { cultures } })),
    // One of the 73 options of «Zonas» is inactive: the count is of the 72 that can be chosen, as in the catalog list.
    http.get("/api/forms/catalogs/" + source + "/items", ({ request }) => { const active = new URL(request.url).searchParams.get("isActive") === "true"; return HttpResponse.json({ items: [], page: 1, pageSize: 1, totalCount: active ? 72 : 73, totalPages: active ? 72 : 73, hasPrevious: false, hasNext: true }); }));
  const saved = (localId: string, number: number, values: Partial<CatalogFieldDraft>): CatalogFieldDraft => ({ ...newCatalogField(localId, number), id: "01990000-0000-7000-8000-0000000001" + String(number).padStart(2, "0"), key: localId, name: { es: localId }, ...values });
  const fields = [
    saved("cuit", 1, { name: { es: "CUIT" }, maxLength: 13, required: true, unique: true }),
    saved("gone", 2, { name: { es: "Viejo" }, isActive: false }),
    saved("zone", 3, { name: { es: "Zona" }, type: "catalog", sourceCatalogId: source, role: "filter" }),
    saved("days", 4, { name: { es: "Plazo" }, type: "integer", min: "0", max: "180" }),
    saved("amount", 5, { name: { es: "Monto" }, type: "decimal", min: "1.500,5" }),
    saved("due", 6, { name: { es: "Vence" }, type: "date", max: "2026-12-31" }),
    saved("gps", 7, { name: { es: "GPS" }, type: "boolean" }),
  ];
  await mount({ initial: fields, readOnly: true, permissions: ["formcatalogs.read"] });
  const dialog = await openFields("Campos · 6");
  expect(within(dialog).queryByRole("button", { name: "Ver Viejo" })).not.toBeInTheDocument();
  for (const [name, number, type, detail] of [["CUIT", "1", "Texto", "13 caracteres"], ["Zona", "2", "Elegir de un catálogo", "Zonas · 72 opciones"], ["Plazo", "3", "Entero", "De 0 a 180"], ["Monto", "4", "Decimal", "Desde 1.500,5"], ["Vence", "5", "Fecha", "Hasta 31/12/2026"], ["GPS", "6", "Sí o no", null]] as const) {
    const row = within(dialog).getByRole("button", { name: "Ver " + name });
    expect(row).toHaveTextContent(new RegExp("^" + number));
    await userEvent.click(row);
    const type_ = within(dialog).getByRole("definition", { name: "Tipo" });
    expect(type_).toHaveTextContent(new RegExp("^" + type));
    if (detail) expect(await within(type_).findByText(detail)).toBeInTheDocument();
  }
  await userEvent.click(within(dialog).getByRole("button", { name: "Ver CUIT" }));
  expect(within(dialog).getByRole("definition", { name: "Clave" })).toHaveTextContent("cuit");
  expect(within(dialog).getByRole("definition", { name: "Reglas" })).toHaveTextContent("Obligatorio · Único");
  expect(within(dialog).getByRole("definition", { name: "Papel" })).toHaveTextContent("Dato");
  expect(within(dialog).queryByRole("textbox")).not.toBeInTheDocument();
  for (const name of ["Agregar campo", "Quitar campo", "Subir CUIT", "Bajar CUIT", "Listo", "Cancelar"]) expect(within(dialog).queryByRole("button", { name })).not.toBeInTheDocument();
  await userEvent.click(within(dialog).getAllByRole("button", { name: "Cerrar" }).at(-1)!);
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  cleanup();
  // Without fields, someone who can only read them has nothing to open.
  await mount({ readOnly: true, permissions: ["formcatalogs.read"] });
  expect(screen.queryByRole("button", { name: /^Campos/ })).not.toBeInTheDocument();
});

it("shows the fields as text while saving or a pending review makes them read-only for a Manage user", async () => {
  await mount({ initial: [field], readOnly: true });
  const dialog = await openFields();
  expect(within(dialog).queryByRole("textbox")).not.toBeInTheDocument();
  expect(within(dialog).queryByRole("button", { name: "Agregar campo" })).not.toBeInTheDocument();
  expect(within(dialog).getByRole("button", { name: "Ver CUIT" })).toBeInTheDocument();
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
    await userEvent.click(within(await openFields()).getByRole("button", { name: "Quitar campo" }));
    const confirm = screen.getByRole("dialog", { name: "Quitar «CUIT»" });
    const items = within(confirm).getAllByRole("listitem");
    expect(items).toHaveLength(1);
    expect(items[0]).toHaveTextContent("«Proveedor» en Pedir repuesto, en la versión activa y en el borrador");
    expect(within(confirm).queryByRole("button", { name: "Quitar el campo" })).not.toBeInTheDocument();
    if (!canOpenForms) {
      expect(within(confirm).queryByRole("link")).not.toBeInTheDocument();
      cleanup();
      continue;
    }
    const link = within(confirm).getByRole("link", { name: "Ir a la pregunta «Proveedor» de Pedir repuesto" });
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
  await mount({ initial: [{ ...field, usedBy: [{ ...hidden, stage: "Active" }, { ...hidden, stage: "Draft" }] }] });
  await userEvent.click(within(await openFields()).getByRole("button", { name: "Quitar campo" }));
  const confirm = screen.getByRole("dialog", { name: "Quitar «CUIT»" });
  expect(within(confirm).getAllByRole("listitem").map(item => item.textContent)).toEqual(["La versión activa de un formulario", "El borrador de un formulario"]);
  expect(within(confirm).queryByRole("button", { name: "Quitar el campo" })).not.toBeInTheDocument();
});

it("shows the stage of a field-in-use conflict whose form the reader cannot see", async () => {
  const uses = [{ definitionId: null, formName: null, question: null, questionId: null, stage: "Draft" as const }];
  await mount({ initial: [{ ...field, isActive: false }], errors: { saved: { isActive: ["El campo está en uso."] } }, feedback: { uses } });
  await userEvent.click(within(screen.getByRole("alert")).getByRole("button", { name: "Revisar" }));
  expect(within(screen.getByRole("dialog")).getByText("El borrador de un formulario")).toBeInTheDocument();
});

it("shows the catalog's own WhatsApp use as part of this catalog instead of a form", async () => {
  const used: CatalogFieldDraft = { ...field, usedBy: [{ definitionId: null, formName: "Proveedores", question: null, questionId: null, stage: "Catalog" }] };
  await mount({ initial: [used], presentation: { title: ["text"], description: ["detail", field.id!] } });
  const dialog = await openFields();
  await userEvent.click(within(dialog).getByRole("button", { name: "Quitar campo" }));
  const confirm = screen.getByRole("dialog", { name: "Quitar «CUIT»" });
  expect(within(confirm).queryByText(/Proveedores/)).not.toBeInTheDocument();
  expect(within(confirm).getByText("También se saca de «En WhatsApp» de este catálogo.")).toBeInTheDocument();
  await userEvent.click(within(confirm).getByRole("checkbox"));
  await userEvent.click(within(confirm).getByRole("button", { name: "Quitar el campo" }));
  expect(within(dialog).queryByRole("button", { name: "Editar CUIT" })).not.toBeInTheDocument();
});

it("moves the chosen field down and up past a removed field in one step and leaves the removed field in its place", async () => {
  const first: CatalogFieldDraft = { ...newCatalogField("first", 1), id: "01990000-0000-7000-8000-000000000011", key: "alpha", name: { es: "Alfa" } };
  const removed: CatalogFieldDraft = { ...newCatalogField("removed", 2), id: "01990000-0000-7000-8000-000000000012", key: "beta", name: { es: "Beta" }, isActive: false };
  const last: CatalogFieldDraft = { ...newCatalogField("last", 3), id: "01990000-0000-7000-8000-000000000013", key: "gamma", name: { es: "Gama" } };
  const onChange = vi.fn();
  await mount({ initial: [first, removed, last], onChange });
  const dialog = await openFields();
  const rows = () => within(dialog).getAllByRole("button", { name: /^Editar (Alfa|Gama)$/ }).map(button => button.getAttribute("aria-label"));
  // The arrows go with the chosen field.
  expect(within(dialog).queryByRole("button", { name: "Bajar Gama" })).not.toBeInTheDocument();
  expect(within(dialog).getByRole("button", { name: "Subir Alfa" })).toBeDisabled();
  await userEvent.click(within(dialog).getByRole("button", { name: "Bajar Alfa" }));
  expect(rows()).toEqual(["Editar Gama", "Editar Alfa"]);
  expect(within(dialog).getByRole("button", { name: "Bajar Alfa" })).toBeDisabled();
  await userEvent.click(within(dialog).getByRole("button", { name: "Listo" }));
  expect(onChange.mock.calls[0]![0].map((value: CatalogFieldDraft) => value.localId)).toEqual(["last", "removed", "first"]);
  const again = await openFields();
  await userEvent.click(within(again).getByRole("button", { name: "Editar Alfa" }));
  await userEvent.click(within(again).getByRole("button", { name: "Subir Alfa" }));
  await userEvent.click(within(again).getByRole("button", { name: "Listo" }));
  expect(onChange.mock.calls[1]![0].map((value: CatalogFieldDraft) => value.localId)).toEqual(["first", "removed", "last"]);
});

it("shows a removed field rejected by a concurrent use and restores its identity without losing other edits", async () => {
  const other: CatalogFieldDraft = { ...newCatalogField("other", 2), name: { es: "Otro cambio" }, key: "other" };
  let savedFields: readonly CatalogFieldDraft[] = [], confirmed: readonly string[] = [];
  const onChange = (next: readonly CatalogFieldDraft[], removals: readonly string[]) => { savedFields = next; confirmed = removals; };
  const message = "El campo está en uso. Sacá esos usos para quitarlo.";
  const rendered = await mount({ initial: [field, other], onChange });
  const dialog = await openFields();
  await userEvent.click(within(dialog).getByRole("button", { name: "Quitar campo" }));
  const confirm = screen.getByRole("dialog", { name: "Quitar «CUIT»" });
  await userEvent.click(within(confirm).getByRole("checkbox"));
  await userEvent.click(within(confirm).getByRole("button", { name: "Quitar el campo" }));
  await userEvent.click(within(dialog).getByRole("button", { name: "Listo" }));
  expect(savedFields[0]?.isActive).toBe(false);
  expect(confirmed).toEqual([field.id]);
  await act(async () => { rendered.rerender(<MemoryRouter><Harness initial={[field, other]} onChange={onChange} errors={{ saved: { isActive: [message] } }} /></MemoryRouter>); });
  const notice = screen.getByRole("alert");
  expect(notice).toHaveTextContent("«CUIT»: " + message);
  await userEvent.click(within(notice).getByRole("button", { name: "Revisar" }));
  const reviewed = screen.getByRole("dialog");
  expect(within(reviewed).getByRole("button", { name: "Editar CUIT" })).toHaveAttribute("aria-current", "true");
  expect(within(reviewed).getByText(message)).toBeInTheDocument();
  await userEvent.click(within(reviewed).getByRole("button", { name: "Restaurar el campo" }));
  expect(within(reviewed).getByRole("textbox", { name: "Nombre" })).toHaveValue("CUIT");
  await userEvent.click(within(reviewed).getByRole("button", { name: "Listo" }));
  expect(savedFields[0]).toMatchObject({ id: field.id, localId: field.localId, isActive: true });
  expect(savedFields[1]?.name.es).toBe("Otro cambio");
  expect(confirmed).toEqual([]);
});

// The limit is the reason of the disabled Add field (tooltip and accessible description).
it("explains the limit of fields on the disabled Add field", async () => {
  const full = Array.from({ length: 20 }, (_, index) => ({ ...field, localId: "saved-" + index, id: "01990000-0000-7000-8000-0000000001" + String(index).padStart(2, "0"), key: "field_" + index, name: { es: "Campo " + index } }));
  await mount({ initial: full });
  const add = within(await openFields()).getByRole("button", { name: "Agregar campo" });
  expect(add).toBeDisabled();
  expect(add).toHaveAccessibleDescription("Un catálogo admite hasta 20 campos.");
  await userEvent.hover(add);
  expect(await screen.findByRole("tooltip")).toHaveTextContent("Un catálogo admite hasta 20 campos.");
});

it("says a server error above the table, and «Revisar» opens the field with the focus on the marked control", async () => {
  await mount({ initial: [field, zone], errors: { zone: { key: ["Ya hay un campo con esa clave."] } } });
  const notice = screen.getByRole("alert");
  expect(notice).toHaveTextContent("«Zona» · Clave: Ya hay un campo con esa clave.");
  await userEvent.click(within(notice).getByRole("button", { name: "Revisar" }));
  const dialog = screen.getByRole("dialog");
  expect(within(dialog).getByRole("button", { name: "Editar Zona" })).toHaveAttribute("aria-current", "true");
  const key = within(dialog).getByRole("textbox", { name: "Clave" });
  expect(key).toBeInvalid();
  expect(key).toHaveAccessibleDescription("Ya hay un campo con esa clave.");
  expect(key).toHaveFocus();
  expect(within(dialog).getByRole("textbox", { name: "Nombre" })).toBeValid();
  // Editing in the modal clears what the server said, as anywhere else on the page.
  await userEvent.type(within(dialog).getByRole("textbox", { name: "Nombre" }), "s");
  expect(within(dialog).getByRole("textbox", { name: "Clave" })).toBeValid();
});

it("warns that saving checks the values only when the type of a field with values changes", async () => {
  const warning = "Al guardar se revisan todos los valores. Si alguno no convierte, el cambio no se guarda.";
  await mount({ initial: [field, { ...newCatalogField("new", 2), key: "zone" }], savedTypes: { [field.id!]: "text" } });
  const dialog = await openFields();
  expect(within(dialog).queryByText(warning)).not.toBeInTheDocument();
  await userEvent.selectOptions(within(dialog).getByRole("combobox", { name: "Tipo" }), "integer");
  expect(within(dialog).getByRole("combobox", { name: "Tipo" })).toHaveAccessibleDescription(warning);
  await userEvent.selectOptions(within(dialog).getByRole("combobox", { name: "Tipo" }), "text");
  expect(within(dialog).queryByText(warning)).not.toBeInTheDocument();
  await userEvent.click(within(dialog).getByRole("button", { name: "Editar Nuevo campo" }));
  await userEvent.selectOptions(within(dialog).getByRole("combobox", { name: "Tipo" }), "integer");
  expect(within(dialog).queryByText(warning)).not.toBeInTheDocument();
});

it("chooses the source catalog of a field by searching it", async () => {
  const zones = "01990000-0000-7000-8000-000000000009";
  server.use(http.get("/api/forms/catalogs", () => HttpResponse.json({ items: [{ valueType: "Text", id: zones, name: "Zonas", description: null, origin: "Manual", optionsCount: 6, usageCount: null, state: "Active", stateReason: null, canEdit: true }], page: 1, pageSize: 20, totalCount: 1, totalPages: 1, hasPrevious: false, hasNext: false, filterCounts: { byKind: { all: 1, manual: 1, filters: 0 } } })));
  await mount({ initial: [field] });
  const dialog = await openFields();
  await userEvent.selectOptions(within(dialog).getByRole("combobox", { name: "Tipo" }), "catalog");
  await userEvent.type(within(dialog).getByRole("combobox", { name: "Catálogo" }), "Zon");
  await userEvent.click(await screen.findByRole("option", { name: "Zonas · 6 opciones" }));
  expect(within(dialog).getByRole("combobox", { name: "Catálogo" })).toHaveValue("Zonas");
});

it("shows the restore error of an active field next to its name", async () => {
  const message = "Hay valores que no cumplen las reglas del campo.";
  await mount({ initial: [field], errors: { saved: { isActive: [message] } }, feedback: { invalidCount: 2 } });
  expect(screen.getByRole("alert")).toHaveTextContent("«CUIT»: " + message);
  await userEvent.click(within(screen.getByRole("alert")).getByRole("button", { name: "Revisar" }));
  const dialog = screen.getByRole("dialog");
  expect(within(dialog).getByRole("textbox", { name: "Nombre" })).toHaveAccessibleDescription(message);
  expect(within(dialog).getAllByText(message)).toHaveLength(1);
});

it.each([["maxLength", "text", "Máximo de caracteres"], ["min", "integer", "Mínimo"], ["max", "integer", "Máximo"], ["unique", "text", "Único"]] as const)("shows incompatible values of a %s change on that control", async (path, type, label) => {
  const message = "Hay valores que no cumplen las reglas del campo.";
  await mount({ initial: [{ ...field, type }], errors: { saved: { [path]: [message] } }, feedback: { invalidCount: 2 } });
  await userEvent.click(within(screen.getByRole("alert")).getByRole("button", { name: "Revisar" }));
  const dialog = screen.getByRole("dialog");
  expect(within(dialog).getByLabelText(label)).toHaveAccessibleDescription(message);
  expect(within(dialog).getAllByText(message)).toHaveLength(1);
});

it("counts the values of a rule change as not meeting the field rules, and only a type change as not converting", async () => {
  const rendered = await mount({ initial: [field], errors: { saved: { maxLength: ["Hay valores que no cumplen las reglas del campo."] } }, feedback: { invalidCount: 2 } });
  expect(screen.getByRole("alert")).toHaveTextContent("2 opciones tienen valores que no cumplen las reglas del campo.");
  expect(screen.queryByText(/no convierten/)).not.toBeInTheDocument();
  await act(async () => { rendered.rerender(<MemoryRouter><Harness initial={[field]} errors={{ saved: { type: ["Hay valores que no se convierten al tipo nuevo."] } }} feedback={{ convertedCount: 0, invalidCount: 2 }} /></MemoryRouter>); });
  expect(screen.getByText("2 opciones tienen valores que no convierten.")).toBeInTheDocument();
});

it("shows the server's missing count next to the failed field", async () => {
  await mount({ initial: [field], errors: { saved: { required: ["Completá las opciones activas."] } }, feedback: { missingCount: 12 } });
  const notice = screen.getByRole("alert");
  expect(notice).toHaveTextContent("«CUIT» · Obligatorio: Completá las opciones activas.");
  expect(notice).toHaveTextContent("Faltan valores en 12 opciones activas.");
});

// The server's counts carry a thousands separator, as CE1 draws them («1.200») and as «Cambiar el tipo» shows them.
it.each([
  ["es", { missingCount: 1200 }, "Faltan valores en 1.200 opciones activas.", { saved: { required: ["Completá las opciones activas."] } }],
  ["en", { missingCount: 1200 }, "Values are missing from 1,200 active options.", { saved: { required: ["Complete the active options."] } }],
  ["es", { invalidCount: 1200 }, "1.200 opciones tienen valores que no cumplen las reglas del campo.", { saved: { maxLength: ["Hay valores que no cumplen las reglas del campo."] } }],
  ["es", { convertedCount: 1188, invalidCount: 1200 }, "1.188 valores pueden convertirse.", { saved: { type: ["Hay valores que no se convierten al tipo nuevo."] } }],
  ["en", { convertedCount: 1188, invalidCount: 1200 }, "1,200 options have values that cannot convert.", { saved: { type: ["Some values do not convert to the new type."] } }],
] as const)("groups the thousands of a server count in %s: %j", async (language, feedback, text, errors) => {
  await i18n.changeLanguage(language);
  try {
    await mount({ initial: [field], errors, feedback });
    expect(screen.getByText(text)).toBeInTheDocument();
  } finally {
    await i18n.changeLanguage("es");
  }
});

it.each(["role", "type", "sourceCatalogId"])("shows the uses next to an in-use %s error inside the modal", async path => {
  const filter: CatalogFieldDraft = { ...field, role: "filter", type: path === "sourceCatalogId" ? "catalog" : "text", sourceCatalogId: path === "sourceCatalogId" ? "01990000-0000-7000-8000-000000000009" : null };
  const uses = [{ definitionId: "01990000-0000-7000-8000-000000000002", formName: "Pedir repuesto", question: "Proveedor", questionId: "01990000-0000-7000-8000-000000000004", stage: "Active" as const }];
  server.use(http.get("/api/forms/catalogs", () => HttpResponse.json({ items: [{ valueType: "Text", id: "01990000-0000-7000-8000-000000000009", name: "Proveedores", description: null, origin: "Manual", optionsCount: 2, usageCount: null, state: "Active", stateReason: null, canEdit: true }], page: 1, pageSize: 20, totalCount: 1, totalPages: 1, hasPrevious: false, hasNext: false, filterCounts: { byKind: { all: 1, manual: 1, filters: 0 } } })));
  await mount({ initial: [filter, zone], errors: { saved: { [path]: ["El campo está en uso."] } }, feedback: { uses } });
  await userEvent.click(within(screen.getByRole("alert")).getByRole("button", { name: "Revisar" }));
  const dialog = screen.getByRole("dialog");
  expect(within(dialog).getByText("El campo está en uso.")).toBeInTheDocument();
  expect(within(dialog).getAllByText("«Proveedor» en Pedir repuesto, en la versión activa")).toHaveLength(1);
  expect(within(dialog).getByRole("textbox", { name: "Clave" })).toHaveValue("tax_id");
});

it("shows the list first on the phone and opens the field with «Volver a la lista»", async () => {
  media?.mockRestore(); media = null;
  await mount({ initial: [field, zone] });
  const dialog = await openFields();
  expect(within(dialog).queryByRole("textbox", { name: "Nombre" })).not.toBeInTheDocument();
  expect(within(dialog).getByRole("button", { name: "Listo" })).toBeInTheDocument();
  await userEvent.click(within(dialog).getByRole("button", { name: "Editar Zona" }));
  expect(within(dialog).getByRole("textbox", { name: "Nombre" })).toHaveValue("Zona");
  expect(within(dialog).queryByRole("button", { name: "Editar CUIT" })).not.toBeInTheDocument();
  expect(within(dialog).queryByRole("button", { name: "Listo" })).not.toBeInTheDocument();
  await userEvent.type(within(dialog).getByRole("textbox", { name: "Nombre" }), "s");
  await userEvent.click(within(dialog).getByRole("button", { name: "Volver a la lista" }));
  expect(within(dialog).getByRole("button", { name: "Editar Zonas" })).toHaveFocus();
  // A review on the phone opens the field directly.
  cleanup();
  await mount({ initial: [field, zone], errors: { zone: { key: ["Ya hay un campo con esa clave."] } } });
  await userEvent.click(within(screen.getByRole("alert")).getByRole("button", { name: "Revisar" }));
  expect(within(screen.getByRole("dialog")).getByRole("textbox", { name: "Clave" })).toHaveFocus();
});
