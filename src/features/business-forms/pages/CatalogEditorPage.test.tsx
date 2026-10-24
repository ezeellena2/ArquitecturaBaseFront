import { act, cleanup, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { RouterProvider, createMemoryRouter } from "react-router";
import { render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { http, HttpResponse } from "msw";
import type { CurrentUser } from "@/auth/useCurrentUser";
import { AppProviders } from "@/app/providers";
import { queryClient } from "@/shared/api/queryClient";
import i18n from "@/shared/i18n";
import { server } from "@/test/mocks/server";
import { notify } from "@/shared/ui/notifications";
import capturedOptionsRaw from "@/test/fixtures/catalogs-http/filters/options.json?raw";
import { readCatalogFilterOptions } from "../api/catalogResponse";
import * as catalogImports from "../api/catalogImports";
import { catalogImportPreviewFixture } from "@/test/catalogImportFixtures";
import { CatalogEditorPage } from "./CatalogEditorPage";

vi.mock("react-oidc-context", async () => ({ ...await vi.importActual<typeof import("react-oidc-context")>("react-oidc-context"), useAuth: () => ({ isAuthenticated: true, isLoading: false, user: { access_token: "test" } }) }));
vi.mock("@/shared/ui/notifications", async () => ({ ...await vi.importActual<typeof import("@/shared/ui/notifications")>("@/shared/ui/notifications"), notify: vi.fn() }));
// Whole-value configuration cases do not exercise character-by-character search behavior.
async function pasteText(user: ReturnType<typeof userEvent.setup>, control: HTMLElement, text: string) {
  await user.click(control);
  await user.paste(text);
}
const id = "01990000-0000-7000-8000-000000000020";
const itemId = "01990000-0000-7000-8000-000000000021";
const initial = { valueType: "Text" as const, proposal: null, id, key: id.replaceAll("-", ""), name: { es: "Clientes", en: "Customers" }, description: { es: "Visitas", en: "Visits" }, kind: "Manual", revision: 1, isActive: true, itemsCount: 1, usageCount: null, originalCulture: "es" as const, unavailableReasonCode: null, filters: null, fields: [], presentation: null, presentationCheck: { cultures: [{ culture: "es" as const, titleTooLongCount: 0, titleExamples: [], descriptionTooLongCount: 0, descriptionExamples: [] }, { culture: "en" as const, titleTooLongCount: 0, titleExamples: [], descriptionTooLongCount: 0, descriptionExamples: [] }] } };
const option = { value: null, id: itemId, code: "C1", text: { es: "Pérez", en: null }, detail: { es: null, en: null }, position: 1, isActive: true, fields: {}, fieldTexts: {} };
function setup(permissions = ["formcatalogs.read", "formcatalogs.manage"], culture: "es" | "en" = "es") {
  server.use(http.get("/api/me", () => HttpResponse.json({ id: "actor", displayName: "Ana", email: "ana@example.com", emailConfirmed: true, phoneNumber: null, formattedPhoneNumber: null, maskedPhoneNumber: null, phoneNumberConfirmed: false, hasGoogleLogin: false, culture, timeZoneId: "America/Argentina/Buenos_Aires", lastLoginAtUtc: null, roles: [], permissions })), http.get("/api/forms/catalogs/" + id, () => HttpResponse.json(initial)), http.get("/api/forms/catalogs/" + id + "/items", () => HttpResponse.json({ items: [option], page: 1, pageSize: 20, totalCount: 1, totalPages: 1, hasPrevious: false, hasNext: false })));
}
async function mount(path: string) {
  // The route tests cover production registration; this harness focuses on editor behavior.
  const router = createMemoryRouter([{ path: "/catalogos/nuevo", Component: CatalogEditorPage }, { path: "/catalogos/:catalogId", Component: CatalogEditorPage }, { path: "/catalogos", element: <p>Catalog list</p> }], { initialEntries: [path] });
  await act(async () => { render(<AppProviders><RouterProvider router={router} /></AppProviders>); });
  return router;
}
beforeEach(async () => { queryClient.clear(); vi.mocked(notify).mockClear(); await i18n.changeLanguage("es"); });
afterEach(() => { cleanup(); vi.restoreAllMocks(); queryClient.clear(); });
describe("Manual catalog page with synthetic current DTO responses", () => {
  it("preserves a text beyond WhatsApp length and blocks saving until corrected", async () => {
    setup(); const bodies: unknown[] = [];
    server.use(http.put("/api/forms/catalogs/" + id, async ({ request }) => { bodies.push(await request.json()); return HttpResponse.json({ catalog: { ...initial, revision: 2 }, itemIdentityMap: {}, fieldIdentityMap: {} }); }));
    await mount("/catalogos/" + id); const user = userEvent.setup();
    await user.click(await screen.findByRole("button", {name:"Editar Pérez"}));
    const text = screen.getByRole("textbox", {name:"Texto"});
    await user.clear(text); await pasteText(user, text, "123456789012345678901234567890X");
    expect(text).toHaveValue("123456789012345678901234567890X");
    expect(screen.getByText("31/30")).toBeInTheDocument();
    expect(text).toHaveAttribute("aria-invalid", "true");
    await user.click(screen.getByRole("button",{name:"Guardar"}));
    expect(bodies).toEqual([]); expect(text).toHaveValue("123456789012345678901234567890X");
    expect(screen.getByRole("textbox", {name:"Detalle"})).toHaveAttribute("maxlength", "300");
    await user.clear(text); await pasteText(user, text, "Texto corregido");
    await user.click(screen.getByRole("button",{name:"Guardar"}));
    await waitFor(() => expect(bodies).toHaveLength(1));
  });

  it("creates bilingual metadata and one item in a single request and reloads its canonical identity", async () => {
    setup(); const bodies: Record<string, unknown>[] = [];
    server.use(http.post("/api/forms/catalogs", async ({ request }) => { const body = await request.json() as Record<string, unknown>; bodies.push(body); const items = body.items as { localId: string }[]; return HttpResponse.json({ catalog: initial, itemIdentityMap: { [items[0]!.localId]: itemId }, fieldIdentityMap: {} }, { status: 201 }); }));
    const router = await mount("/catalogos/nuevo"); const user = userEvent.setup();
    await pasteText(user, await screen.findByRole("textbox", { name: "Nombre" }), "Clientes");
    await pasteText(user, screen.getByRole("textbox", { name: "Descripción" }), "Visitas");
    await user.click(screen.getByRole("button", { name: "Inglés" }));
    await pasteText(user, await screen.findByRole("textbox", { name: "Nombre" }), "Customers");
    await pasteText(user, screen.getByRole("textbox", { name: "Descripción" }), "Visits");
    await user.click(screen.getByRole("button", { name: "Español" }));
    await user.click(screen.getByRole("button", { name: "Agregar opción" }));
    await pasteText(user, screen.getByRole("textbox", { name: "Texto" }), "Pérez");
    await pasteText(user, screen.getByRole("textbox", { name: "Código" }), "C1");
    await user.click(screen.getByRole("button", { name: "Guardar" }));
    await waitFor(() => expect(router.state.location.pathname).toBe("/catalogos/" + id));
    await screen.findByRole("button", { name: "Editar Pérez" });
    expect(bodies).toHaveLength(1);
    expect(bodies[0]).toMatchObject({ name: initial.name, description: initial.description, items: [{ itemId: null, code: "C1", text: { es: "Pérez", en: null }, isActive: true }] });
    expect(bodies[0]).not.toHaveProperty("requestId");
    expect(vi.mocked(notify).mock.calls.filter(([message]) => message.kind === "success")).toHaveLength(1);
  });
  it("does not mark a new option's empty fields until saving is attempted, then validates live", async () => {
    setup(); const bodies: unknown[] = [];
    server.use(http.put("/api/forms/catalogs/" + id, async ({ request }) => { bodies.push(await request.json()); return HttpResponse.json({ catalog: { ...initial, revision: 2 }, itemIdentityMap: {}, fieldIdentityMap: {} }); }));
    await mount("/catalogos/" + id); const user = userEvent.setup();
    await user.click(await screen.findByRole("button", { name: "Agregar opción" }));
    const text = screen.getByRole("textbox", { name: "Texto" }), code = screen.getByRole("textbox", { name: "Código" });
    expect(screen.queryByText("Completá este campo.")).not.toBeInTheDocument();
    expect(screen.queryByText("Revisá las opciones marcadas antes de guardar.")).not.toBeInTheDocument();
    expect(text).not.toHaveAttribute("aria-invalid", "true"); expect(code).not.toHaveAttribute("aria-invalid", "true");
    await user.click(screen.getByRole("button", { name: "Guardar" }));
    expect(text).toHaveAttribute("aria-invalid", "true"); expect(text).toHaveAccessibleDescription("Completá este campo.");
    expect(code).toHaveAttribute("aria-invalid", "true"); expect(code).toHaveAccessibleDescription("Completá este campo.");
    expect(bodies).toEqual([]);
    await pasteText(user, text, "Norte");
    expect(text).not.toHaveAttribute("aria-invalid", "true");
    expect(code).toHaveAccessibleDescription("Completá este campo.");
    // Another option added after the attempt starts unmarked too.
    await user.click(screen.getByRole("button", { name: "Agregar opción" }));
    expect(screen.getByRole("textbox", { name: "Texto" })).not.toHaveAttribute("aria-invalid", "true");
    expect(screen.getByRole("textbox", { name: "Código" })).not.toHaveAttribute("aria-invalid", "true");
    expect(bodies).toEqual([]);
  });
  it("marks an empty field when leaving it after touching it", async () => {
    setup(); await mount("/catalogos/" + id); const user = userEvent.setup();
    await user.click(await screen.findByRole("button", { name: "Agregar opción" }));
    const code = screen.getByRole("textbox", { name: "Código" });
    await user.click(code);
    expect(code).not.toHaveAttribute("aria-invalid", "true");
    await user.tab();
    expect(code).toHaveAttribute("aria-invalid", "true"); expect(code).toHaveAccessibleDescription("Completá este campo.");
    // The editor put the cursor in Texto when it opened; leaving it without typing is not touching it.
    expect(screen.getByRole("textbox", { name: "Texto" })).not.toHaveAttribute("aria-invalid", "true");
    expect(screen.queryAllByText("Completá este campo.")).toHaveLength(1);
  });
  it("takes the focus to the first marked control of an option that was already open when saving fails", async () => {
    setup(); const bodies: unknown[] = [];
    server.use(http.put("/api/forms/catalogs/" + id, async ({ request }) => { bodies.push(await request.json()); return HttpResponse.json({ catalog: { ...initial, revision: 2 }, itemIdentityMap: {}, fieldIdentityMap: {} }); }));
    await mount("/catalogos/" + id); const user = userEvent.setup();
    await user.click(await screen.findByRole("button", { name: "Agregar opción" }));
    await pasteText(user, screen.getByRole("textbox", { name: "Texto" }), "Norte");
    // Save is in the header, away from the open option: the attempt does not reopen it, but it takes the focus to what it marks.
    await user.click(screen.getByRole("button", { name: "Guardar" }));
    const code = screen.getByRole("textbox", { name: "Código" });
    expect(code).toHaveAccessibleDescription("Completá este campo.");
    expect(code).toHaveFocus();
    expect(bodies).toEqual([]);
  });
  it("switches «Textos en» to the language of the missing text when saving fails on it", async () => {
    setup(); const bodies: unknown[] = [];
    server.use(http.put("/api/forms/catalogs/" + id, async ({ request }) => { bodies.push(await request.json()); return HttpResponse.json({ catalog: { ...initial, revision: 2 }, itemIdentityMap: {}, fieldIdentityMap: {} }); }));
    await mount("/catalogos/" + id); const user = userEvent.setup();
    await user.click(await screen.findByRole("button", { name: "Inglés" }));
    // The English content waits for its texts before the page shows again.
    await user.click(await screen.findByRole("button", { name: "Agregar opción" }));
    expect(screen.getByRole("textbox", { name: "Texto" })).toHaveAccessibleDescription("Si no completás el texto en inglés, se usa el de español.");
    await user.click(screen.getByRole("button", { name: "Guardar" }));
    expect(await screen.findByRole("button", { name: "Español" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "Inglés" })).toHaveAttribute("aria-pressed", "false");
    const text = screen.getByRole("textbox", { name: "Texto" });
    expect(text).toHaveAttribute("aria-invalid", "true"); expect(text).toHaveAccessibleDescription("Completá este campo.");
    expect(bodies).toEqual([]);
  });
  it("updates the existing item code while keeping its identity and submits only the changed row", async () => {
    setup(); const bodies: unknown[] = []; let savedOption = option;
    server.use(http.get("/api/forms/catalogs/" + id + "/items", () => HttpResponse.json({ items: [savedOption], page: 1, pageSize: 20, totalCount: 1, totalPages: 1, hasPrevious: false, hasNext: false })), http.put("/api/forms/catalogs/" + id, async ({ request }) => { const body = await request.json() as { items: { code: string }[] }; bodies.push(body); savedOption = { ...option, code: body.items[0]!.code }; return HttpResponse.json({ catalog: { ...initial, revision: 2 }, itemIdentityMap: {}, fieldIdentityMap: {} }); }));
    await mount("/catalogos/" + id); const user = userEvent.setup();
    await user.click(await screen.findByRole("button", { name: "Editar Pérez" }));
    const code = screen.getByRole("textbox", { name: "Código" }); await user.clear(code); await pasteText(user, code, "C2");
    await user.click(screen.getByRole("button", { name: "Guardar" }));
    await waitFor(() => expect(bodies).toHaveLength(1));
    expect(bodies[0]).toMatchObject({ expectedRevision: 1, items: [{ itemId, code: "C2", text: { es: "Pérez", en: null } }] });
    await screen.findByText("C2");
    await user.click(screen.getByRole("button", { name: "Editar Pérez" }));
    expect(screen.getByRole("textbox", { name: "Código" })).toHaveValue("C2");
  });
  it("saves an edited inactive option that lacks a required value, as the server allows", async () => {
    setup(); const fieldId = "01990000-0000-7000-8000-000000000031"; const bodies: { items: { itemId: string; text: { es: string }; isActive: boolean }[] }[] = [];
    const taxId = { id: fieldId, key: "tax_id", name: { es: "CUIT" }, type: "text", sourceCatalogId: null, required: true, unique: false, min: null, max: null, maxLength: null, role: "data", position: 1, isActive: true, valuesCount: 0, usedBy: [] };
    server.use(http.get("/api/forms/catalogs/" + id, () => HttpResponse.json({ ...initial, fields: [taxId] })), http.get("/api/forms/catalogs/" + id + "/items", () => HttpResponse.json({ items: [{ ...option, isActive: false }], page: 1, pageSize: 20, totalCount: 1, totalPages: 1, hasPrevious: false, hasNext: false })), http.put("/api/forms/catalogs/" + id, async ({ request }) => {
      bodies.push(await request.json() as typeof bodies[number]);
      return HttpResponse.json({ catalog: { ...initial, revision: 2, fields: [taxId] }, itemIdentityMap: {}, fieldIdentityMap: {} });
    }));
    await mount("/catalogos/" + id); const user = userEvent.setup();
    await user.click(await screen.findByRole("button", { name: "Reactivar Pérez" }));
    await user.click(screen.getByRole("button", { name: "Editar Pérez" }));
    const text = screen.getByRole("textbox", { name: "Texto" }); await user.clear(text); await pasteText(user, text, "Pérez Norte");
    await user.click(screen.getByRole("checkbox", { name: "Activa" }));
    expect(screen.getByRole("button", { name: "Guardar" })).toBeEnabled();
    await user.click(screen.getByRole("button", { name: "Guardar" }));
    await waitFor(() => expect(bodies).toHaveLength(1));
    expect(bodies[0]).toMatchObject({ items: [{ itemId, text: { es: "Pérez Norte" }, isActive: false }] });
  });
  const fieldId = "01990000-0000-7000-8000-000000000031";
  const savedField = (values: { key: string; name: string; type: string }) => ({ id: fieldId, key: values.key, name: { es: values.name }, type: values.type, sourceCatalogId: null, required: false, unique: false, min: null, max: null, maxLength: null, role: "data", position: 1, isActive: true, valuesCount: 1, usedBy: [] });
  function fieldSetup(field: ReturnType<typeof savedField>, values: Record<string, string>, answer: () => Response) {
    setup(); const bodies: { fields: Record<string, unknown>[]; items: Record<string, unknown>[] }[] = [];
    server.use(http.get("/api/forms/catalogs/" + id, () => HttpResponse.json({ ...initial, fields: [field] })), http.get("/api/forms/catalogs/" + id + "/items", () => HttpResponse.json({ items: [{ ...option, fields: values }], page: 1, pageSize: 20, totalCount: 1, totalPages: 1, hasPrevious: false, hasNext: false })), http.put("/api/forms/catalogs/" + id, async ({ request }) => { bodies.push(await request.json() as typeof bodies[number]); return answer(); }));
    return bodies;
  }
  async function renameOption(user: ReturnType<typeof userEvent.setup>) {
    await user.click(await screen.findByRole("button", { name: "Editar Pérez" }));
    const text = screen.getByRole("textbox", { name: "Texto" }); await user.clear(text); await pasteText(user, text, "Pérez Norte");
  }
  it("lets the server review a type change instead of blocking Save", async () => {
    const term = savedField({ key: "term", name: "Plazo", type: "text" });
    const bodies = fieldSetup(term, { [fieldId]: "30 días" }, () => HttpResponse.json({ catalog: { ...initial, revision: 2, fields: [{ ...term, type: "integer" }] }, itemIdentityMap: {}, fieldIdentityMap: {} }));
    await mount("/catalogos/" + id); const user = userEvent.setup();
    await user.click(await screen.findByRole("button", { name: "Editar campos" }));
    await user.click(screen.getByRole("button", { name: "Editar Plazo" }));
    await user.selectOptions(screen.getByRole("combobox", { name: "Tipo" }), "integer");
    await renameOption(user);
    expect(screen.getByRole("button", { name: "Guardar" })).toBeEnabled();
    await user.click(screen.getByRole("button", { name: "Guardar" }));
    await waitFor(() => expect(bodies).toHaveLength(1));
    expect(bodies[0]).toMatchObject({ fields: [{ id: fieldId, type: "integer" }], items: [{ itemId, text: { es: "Pérez Norte" } }] });
    expect(bodies[0]!.items[0]).not.toHaveProperty("fields");
  });
  it("lets the server count missing values when a field becomes required", async () => {
    const message = "Completá el CUIT en las opciones activas.";
    const bodies = fieldSetup(savedField({ key: "tax_id", name: "CUIT", type: "text" }), {}, () => HttpResponse.json({ code: "Forms.Catalog.FieldValuesMissing", detail: message, errors: { "fields[0].required": [message] }, missingCount: 12 }, { status: 400 }));
    await mount("/catalogos/" + id); const user = userEvent.setup();
    await user.click(await screen.findByRole("button", { name: "Editar campos" }));
    await user.click(screen.getByRole("button", { name: "Editar CUIT" }));
    await user.click(screen.getByRole("checkbox", { name: "Obligatorio" }));
    await renameOption(user);
    expect(screen.getByRole("button", { name: "Guardar" })).toBeEnabled();
    await user.click(screen.getByRole("button", { name: "Guardar" }));
    expect(await screen.findByText("Faltan valores en 12 opciones activas.")).toBeInTheDocument();
    expect(bodies).toHaveLength(1);
    expect(bodies[0]).toMatchObject({ fields: [{ id: fieldId, required: true }] });
    expect(bodies[0]!.items[0]).not.toHaveProperty("fields");
    expect(vi.mocked(notify).mock.calls.filter(([notice]) => notice.kind === "error")).toHaveLength(0);
  });
  it("does not send a reformatted value when another column of the option changes", async () => {
    const amount = savedField({ key: "amount", name: "Cantidad", type: "integer" });
    const bodies = fieldSetup(amount, { [fieldId]: "1500" }, () => HttpResponse.json({ catalog: { ...initial, revision: 2, fields: [{ ...amount, type: "text" }] }, itemIdentityMap: {}, fieldIdentityMap: {} }));
    await mount("/catalogos/" + id); const user = userEvent.setup();
    await user.click(await screen.findByRole("button", { name: "Editar campos" }));
    await user.click(screen.getByRole("button", { name: "Editar Cantidad" }));
    await user.selectOptions(screen.getByRole("combobox", { name: "Tipo" }), "text");
    await renameOption(user);
    expect(screen.getByRole("textbox", { name: "Cantidad" })).toHaveValue("1.500");
    await user.click(screen.getByRole("button", { name: "Guardar" }));
    await waitFor(() => expect(bodies).toHaveLength(1));
    expect(bodies[0]).toMatchObject({ fields: [{ id: fieldId, type: "text" }], items: [{ itemId, text: { es: "Pérez Norte" } }] });
    expect(bodies[0]!.items[0]).not.toHaveProperty("fields");
  });
  it("shows a saved value that is not an option yet while a change to a catalog field is pending", async () => {
    fieldSetup(savedField({ key: "zone", name: "Zona", type: "text" }), { [fieldId]: "Sur" }, () => HttpResponse.json({}, { status: 500 }));
    await mount("/catalogos/" + id); const user = userEvent.setup();
    await user.click(await screen.findByRole("button", { name: "Editar campos" }));
    await user.click(screen.getByRole("button", { name: "Editar Zona" }));
    await user.selectOptions(screen.getByRole("combobox", { name: "Tipo" }), "catalog");
    expect(within(await screen.findByRole("table")).getByText("Sur", { exact: true })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Editar Pérez" }));
    expect(screen.getByRole("combobox", { name: "Zona" })).toHaveValue("Sur");
  });
  it("says on the row which edited value is wrong and why, before saving", async () => {
    viewport(true); const bodies = fieldSetup(savedField({ key: "term", name: "Plazo", type: "integer" }), { [fieldId]: "30" }, () => HttpResponse.json({}, { status: 500 }));
    await mount("/catalogos/" + id); const user = userEvent.setup();
    const cell = await screen.findByRole("textbox", { name: "Fila 1 · Plazo" });
    await user.clear(cell); await pasteText(user, cell, "30 días");
    expect(cell).toBeInvalid();
    expect(cell).toHaveAccessibleDescription("Fila 1 · Plazo: «30 días» no es un número entero.");
    await user.click(screen.getByRole("button", { name: "Guardar" }));
    expect(bodies).toEqual([]); expect(cell).toBeInvalid();
  });
  const secondItemId = "01990000-0000-7000-8000-000000000022";
  const termRows = [{ ...option, fields: { [fieldId]: "30 días" } }, { ...option, id: secondItemId, code: "C2", text: { es: "Gómez", en: null }, position: 2, fields: { [fieldId]: "60 días" } }];
  function viewport(desktop: boolean) {
    vi.spyOn(globalThis, "matchMedia").mockImplementation(query => ({ matches: desktop && query === "(min-width: 640px)", media: query, onchange: null, addListener: vi.fn(), removeListener: vi.fn(), addEventListener: vi.fn(), removeEventListener: vi.fn(), dispatchEvent: vi.fn() }) as MediaQueryList);
  }
  // «Plazo» goes from text to integer: the first Save comes back with `invalid` on the given option, later ones succeed.
  function conversionSetup(invalid = termRows[0]!) {
    const term = savedField({ key: "term", name: "Plazo", type: "text" });
    const message = "Hay valores que no se convierten al tipo nuevo.";
    const requests: URLSearchParams[] = []; let saves = 0;
    setup();
    server.use(http.get("/api/forms/catalogs/" + id, () => HttpResponse.json({ ...initial, itemsCount: 2, fields: [term] })),
      http.get("/api/forms/catalogs/" + id + "/items", ({ request }) => {
        const query = new URL(request.url).searchParams; requests.push(query);
        const ids = query.getAll("ids"), items = ids.length ? termRows.filter(row => ids.includes(row.id)) : termRows;
        return HttpResponse.json({ items, page: 1, pageSize: Number(query.get("pageSize")), totalCount: items.length, totalPages: 1, hasPrevious: false, hasNext: false });
      }),
      http.put("/api/forms/catalogs/" + id, () => saves++
        ? HttpResponse.json({ catalog: { ...initial, revision: 2, itemsCount: 2, fields: [{ ...term, type: "integer" }] }, itemIdentityMap: {}, fieldIdentityMap: {} })
        : HttpResponse.json({ code: "Forms.Catalog.FieldTypeNotConvertible", title: "Datos inválidos", detail: message, errors: { "fields[0].type": [message] }, convertedCount: 1, invalidCount: 1, invalidRows: [{ itemId: invalid.id, code: invalid.code, row: invalid.position, value: invalid.fields[fieldId], reason: "invalid" }] }, { status: 400, headers: { "content-type": "application/problem+json" } })));
    return requests;
  }
  async function saveTypeChange(user: ReturnType<typeof userEvent.setup>) {
    await mount("/catalogos/" + id);
    await user.click(await screen.findByRole("button", { name: "Editar campos" }));
    await user.click(screen.getByRole("button", { name: "Editar Plazo" }));
    await user.selectOptions(screen.getByRole("combobox", { name: "Tipo" }), "integer");
    await screen.findByRole("button", { name: "Editar Gómez" });
    await user.click(screen.getByRole("button", { name: "Guardar" }));
    return screen.findByRole("dialog", { name: "Cambiar el tipo de «Plazo»" });
  }
  async function showErrorRows(user: ReturnType<typeof userEvent.setup>) {
    await user.click(within(await saveTypeChange(user)).getByRole("button", { name: "Ver la fila en la tabla" }));
    expect(await screen.findByText("Con error · 1 fila")).toBeInTheDocument();
  }
  it("opens the type change dialog from the server rows and filters the table to them", async () => {
    viewport(true); const requests = conversionSetup(); const user = userEvent.setup();
    const dialog = await saveTypeChange(user);
    expect(within(dialog).getByText("De texto a entero")).toBeInTheDocument();
    expect(within(dialog).getByText("Se revisan los 2 valores cargados: 1 se convierte y 1 no.")).toBeInTheDocument();
    expect(within(dialog).getByRole("cell", { name: "«30 días» no es un número entero." })).toBeInTheDocument();
    expect(screen.queryByText(/Revisá las opciones con código/)).not.toBeInTheDocument();
    await user.click(within(dialog).getByRole("button", { name: "Ver la fila en la tabla" }));
    await waitFor(() => expect(screen.queryByRole("textbox", { name: "Texto de la opción 2" })).not.toBeInTheDocument());
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(requests.at(-1)?.getAll("ids")).toEqual([itemId]);
    expect(requests.at(-1)?.get("pageSize")).toBe("50");
    expect(requests.at(-1)?.get("sort")).toBe("position");
    const cell = screen.getByRole("textbox", { name: "Fila 1 · Plazo" });
    expect(cell).toBeInvalid();
    expect(cell).toHaveAccessibleDescription("Fila 1 · Plazo: «30 días» no es un número entero.");
    expect(screen.getByText("Con error · 1 fila")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Quitar el filtro" }));
    expect(await screen.findByRole("textbox", { name: "Texto de la opción 2" })).toBeInTheDocument();
    expect(screen.queryByText("Con error · 1 fila")).not.toBeInTheDocument();
    expect(requests.at(-1)?.getAll("ids")).toEqual([]);
    expect(screen.getByRole("textbox", { name: "Fila 1 · Plazo" })).toBeInvalid();
    await user.clear(screen.getByRole("textbox", { name: "Fila 1 · Plazo" }));
    await pasteText(user, screen.getByRole("textbox", { name: "Fila 1 · Plazo" }), "30");
    expect(screen.getByRole("textbox", { name: "Fila 1 · Plazo" })).toBeValid();
    expect(vi.mocked(notify).mock.calls.filter(([notice]) => notice.kind === "error")).toHaveLength(0);
  });
  it("marks the value that does not convert on a 390 px screen too", async () => {
    viewport(false); conversionSetup(); const user = userEvent.setup();
    await showErrorRows(user);
    await waitFor(() => expect(screen.queryByRole("row", { name: /Gómez/ })).not.toBeInTheDocument());
    expect(within(screen.getByRole("row", { name: /Pérez/ })).getByText("«30 días» no es un número entero.")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Quitar el filtro" }));
    expect(await screen.findByRole("row", { name: /Gómez/ })).toBeInTheDocument();
    expect(within(screen.getByRole("row", { name: /Pérez/ })).getByText("«30 días» no es un número entero.")).toBeInTheDocument();
    expect(within(screen.getByRole("row", { name: /Gómez/ })).queryByText(/no es un número entero/)).not.toBeInTheDocument();
  });
  it("keeps the catalog's last option from moving down while only the rows with errors show", async () => {
    viewport(true); conversionSetup(termRows[1]); const user = userEvent.setup();
    await showErrorRows(user);
    await waitFor(() => expect(screen.queryByRole("button", { name: "Bajar Pérez" })).not.toBeInTheDocument());
    expect(screen.getByRole("button", { name: "Bajar Gómez" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Subir Gómez" })).toBeEnabled();
  });
  it("goes back to the whole list when searching while the rows with errors show", async () => {
    viewport(true); const requests = conversionSetup(); const user = userEvent.setup();
    await showErrorRows(user);
    await user.type(screen.getByRole("searchbox", { name: "Buscar opción" }), "Gó");
    await waitFor(() => expect(screen.queryByText("Con error · 1 fila")).not.toBeInTheDocument());
    await waitFor(() => expect(requests.at(-1)?.get("search")).toBe("Gó"));
    expect(requests.at(-1)?.getAll("ids")).toEqual([]);
  });
  it("drops the marks and the filter when the field goes back to its saved type", async () => {
    viewport(true); const requests = conversionSetup(); const user = userEvent.setup();
    await showErrorRows(user);
    await user.selectOptions(screen.getByRole("combobox", { name: "Tipo" }), "text");
    expect(await screen.findByRole("textbox", { name: "Texto de la opción 2" })).toBeInTheDocument();
    expect(screen.queryByText("Con error · 1 fila")).not.toBeInTheDocument();
    expect(requests.at(-1)?.getAll("ids")).toEqual([]);
    expect(screen.getByRole("textbox", { name: "Fila 1 · Plazo" })).toBeValid();
  });
  it("drops the filter when saving again", async () => {
    viewport(true); const requests = conversionSetup(); const user = userEvent.setup();
    await showErrorRows(user);
    await user.click(screen.getByRole("button", { name: "Guardar" }));
    await waitFor(() => expect(screen.queryByText("Con error · 1 fila")).not.toBeInTheDocument());
    expect(await screen.findByRole("textbox", { name: "Texto de la opción 2" })).toBeInTheDocument();
    expect(requests.at(-1)?.getAll("ids")).toEqual([]);
  });
  // «Plazo» keeps its type and narrows a rule: the Save comes back with every saved value that breaks it, on that control.
  function rulesSetup(control: "maxLength" | "unique", reason: "length" | "invalid", rows = termRows) {
    const term = savedField({ key: "term", name: "Plazo", type: "text" });
    const message = "Hay valores que no cumplen las reglas del campo.";
    const requests: URLSearchParams[] = [];
    setup();
    server.use(http.get("/api/forms/catalogs/" + id, () => HttpResponse.json({ ...initial, itemsCount: 2, fields: [term] })),
      http.get("/api/forms/catalogs/" + id + "/items", ({ request }) => {
        const query = new URL(request.url).searchParams; requests.push(query);
        const ids = query.getAll("ids"), items = ids.length ? rows.filter(row => ids.includes(row.id)) : rows;
        return HttpResponse.json({ items, page: 1, pageSize: Number(query.get("pageSize")), totalCount: items.length, totalPages: 1, hasPrevious: false, hasNext: false });
      }),
      http.put("/api/forms/catalogs/" + id, () => HttpResponse.json({ code: "Forms.Catalog.FieldValuesIncompatible", title: "Datos inválidos", detail: message, errors: { [`fields[0].${control}`]: [message] }, invalidCount: rows.length, invalidRows: rows.map(row => ({ itemId: row.id, code: row.code, row: row.position, value: row.fields[fieldId], reason })) }, { status: 400, headers: { "content-type": "application/problem+json" } })));
    return requests;
  }
  it("marks every saved value that breaks a narrowed rule and filters the table to them without the type change dialog", async () => {
    viewport(true); const requests = rulesSetup("maxLength", "length"); const user = userEvent.setup();
    await mount("/catalogos/" + id);
    await user.click(await screen.findByRole("button", { name: "Editar campos" }));
    await user.click(screen.getByRole("button", { name: "Editar Plazo" }));
    await pasteText(user, screen.getByRole("spinbutton", { name: "Máximo de caracteres" }), "5");
    await screen.findByRole("button", { name: "Editar Gómez" });
    await user.click(screen.getByRole("button", { name: "Guardar" }));
    expect(await screen.findByText("2 opciones tienen valores que no cumplen las reglas del campo.")).toBeInTheDocument();
    expect(screen.getByRole("spinbutton", { name: "Máximo de caracteres" })).toHaveAccessibleDescription("Hay valores que no cumplen las reglas del campo.");
    expect(screen.getByRole("textbox", { name: "Fila 1 · Plazo" })).toBeInvalid();
    expect(screen.getByRole("textbox", { name: "Fila 1 · Plazo" })).toHaveAccessibleDescription("Fila 1 · Plazo: «30 días» supera los 5 caracteres.");
    expect(screen.getByRole("textbox", { name: "Fila 2 · Plazo" })).toBeInvalid();
    expect(screen.getByRole("textbox", { name: "Fila 2 · Plazo" })).toHaveAccessibleDescription("Fila 2 · Plazo: «60 días» supera los 5 caracteres.");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.queryByText(/^De texto a/)).not.toBeInTheDocument();
    expect(vi.mocked(notify).mock.calls.filter(([notice]) => notice.kind === "error")).toHaveLength(0);
    await user.click(screen.getByRole("button", { name: "Ver los 2 en la tabla" }));
    expect(await screen.findByText("Con error · 2 filas")).toBeInTheDocument();
    await waitFor(() => expect(requests.at(-1)?.getAll("ids")).toEqual([itemId, secondItemId]));
    expect(screen.queryByRole("button", { name: "Ver los 2 en la tabla" })).not.toBeInTheDocument();
    await user.clear(screen.getByRole("spinbutton", { name: "Máximo de caracteres" }));
    await waitFor(() => expect(screen.queryByText("Con error · 2 filas")).not.toBeInTheDocument());
    expect(screen.getByRole("textbox", { name: "Fila 1 · Plazo" })).toBeValid();
  });
  it("says that a value is repeated when switching on «único» finds it in several options", async () => {
    viewport(true); rulesSetup("unique", "invalid", termRows.map(row => ({ ...row, fields: { [fieldId]: "30 días" } }))); const user = userEvent.setup();
    await mount("/catalogos/" + id);
    await user.click(await screen.findByRole("button", { name: "Editar campos" }));
    await user.click(screen.getByRole("button", { name: "Editar Plazo" }));
    await user.click(screen.getByRole("checkbox", { name: "Único" }));
    await screen.findByRole("button", { name: "Editar Gómez" });
    await user.click(screen.getByRole("button", { name: "Guardar" }));
    expect(await screen.findByText("2 opciones tienen valores que no cumplen las reglas del campo.")).toBeInTheDocument();
    for (const name of ["Fila 1 · Plazo", "Fila 2 · Plazo"]) expect(screen.getByRole("textbox", { name })).toHaveAccessibleDescription(name + ": «30 días» se repite en otra opción activa.");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
  it("retains a conflicted draft through reread and requires an explicit adoption without a second write", async () => {
    setup(); let writes = 0;
    server.use(http.put("/api/forms/catalogs/" + id, () => { writes++; return HttpResponse.json({ code: "Forms.Catalog.RevisionConflict" }, { status: 409 }); }));
    await mount("/catalogos/" + id); const user = userEvent.setup();
    const name = await screen.findByRole("textbox", { name: "Nombre" }); await user.clear(name); await pasteText(user, name, "Mi catálogo");
    await user.click(screen.getByRole("button", { name: "Guardar" }));
    await user.click(await screen.findByRole("button", { name: "Revisar" }));
    server.use(http.get("/api/forms/catalogs/" + id, () => HttpResponse.json({ ...initial, revision: 2, name: { es: "Catálogo actual", en: "Current catalog" } })));
    await user.click(screen.getByRole("button", { name: "Releer" }));
    const dialog = await screen.findByRole("dialog", { name: "Revisión del catálogo" });
    expect(within(dialog).getByText("Catálogo actual", { exact: true })).toBeInTheDocument();
    expect(name).toHaveValue("Mi catálogo");
    await user.click(within(dialog).getByRole("button", { name: "Usar la revisión actual" }));
    await waitFor(() => expect(screen.getByRole("textbox", { name: "Nombre" })).toHaveValue("Catálogo actual"));
    expect(writes).toBe(1);
  });
  it("reports a source in use without entering review", async () => {
    setup(); let writes = 0; const detail = "Un campo o un dato de las personas toma sus valores de este catálogo: no se puede dar de baja.";
    server.use(http.put("/api/forms/catalogs/" + id, () => { writes++; return HttpResponse.json({ code: "Forms.Catalog.SourceInUse", detail }, { status: 409 }); }));
    await mount("/catalogos/" + id); const user = userEvent.setup();
    await user.click(await screen.findByRole("button", { name: "Dar de baja" }));
    await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Dar de baja" }));
    await user.click(screen.getByRole("button", { name: "Guardar" }));
    await waitFor(() => expect(vi.mocked(notify).mock.calls.some(([notice]) => notice.kind === "error" && notice.message === detail)).toBe(true));
    expect(writes).toBe(1);
    expect(screen.queryByText("Revisión del catálogo")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Revisar" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Guardar" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Reactivar" })).toBeEnabled();
    expect(screen.getByRole("textbox", { name: "Nombre" })).not.toHaveAttribute("readonly");
  });
  it("shows the uses of a field that became in use and restores it without discarding the draft", async () => {
    setup(); const fieldId = "01990000-0000-7000-8000-000000000031"; const bodies: { name: { es: string }; fields: { id: string | null; isActive: boolean }[] }[] = [];
    const taxId = { id: fieldId, key: "tax_id", name: { es: "CUIT" }, type: "text", sourceCatalogId: null, required: false, unique: false, min: null, max: null, maxLength: null, role: "data", position: 1, isActive: true, valuesCount: 0, usedBy: [] };
    const message = "El campo está en uso. Sacá esos usos para quitarlo.";
    server.use(http.get("/api/forms/catalogs/" + id, () => HttpResponse.json({ ...initial, fields: [taxId] })), http.put("/api/forms/catalogs/" + id, async ({ request }) => {
      const body = await request.json() as typeof bodies[number]; bodies.push(body);
      return bodies.length === 1
        ? HttpResponse.json({ code: "Forms.Catalog.FieldInUse", detail: message, errors: { "fields[0].isActive": [message] }, uses: [{ definitionId: "01990000-0000-7000-8000-000000000032", formName: "Pedir repuesto", question: "Proveedor", questionId: "01990000-0000-7000-8000-000000000033", stage: "Active" }] }, { status: 409 })
        : HttpResponse.json({ catalog: { ...initial, revision: 2, name: { es: body.name.es, en: "Customers" }, fields: [taxId] }, itemIdentityMap: {}, fieldIdentityMap: {} });
    }));
    await mount("/catalogos/" + id); const user = userEvent.setup();
    const name = await screen.findByRole("textbox", { name: "Nombre" }); await user.clear(name); await pasteText(user, name, "Mi catálogo");
    await user.click(screen.getByRole("button", { name: "Editar campos" }));
    await user.click(screen.getByRole("button", { name: "Quitar CUIT" }));
    await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Quitar el campo" }));
    await user.click(screen.getByRole("button", { name: "Guardar" }));
    expect(await screen.findByText("«Proveedor» en Pedir repuesto, en la versión activa")).toBeInTheDocument();
    expect(screen.getByText(message)).toBeInTheDocument();
    expect(screen.queryByText("Revisión del catálogo")).not.toBeInTheDocument();
    expect(vi.mocked(notify).mock.calls.filter(([notice]) => notice.kind === "error")).toHaveLength(0);
    await user.click(screen.getByRole("button", { name: "Restaurar el campo" }));
    expect(screen.queryByText("«Proveedor» en Pedir repuesto, en la versión activa")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Guardar" }));
    await waitFor(() => expect(bodies).toHaveLength(2));
    expect(bodies[0]).toMatchObject({ name: { es: "Mi catálogo" }, fields: [{ id: fieldId, isActive: false }] });
    expect(bodies[1]).toMatchObject({ name: { es: "Mi catálogo" }, fields: [{ id: fieldId, isActive: true }] });
  });
  it("allows catalog Read without form template Read and hides all writes without Manage", async () => {
    setup(["formcatalogs.read"]); await mount("/catalogos/" + id);
    expect(await screen.findByRole("textbox", { name: "Nombre" })).toHaveAttribute("readonly");
    await within(await screen.findByRole("table")).findByText("Pérez");
    expect(screen.queryByRole("button", { name: "Guardar" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Dar de baja" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Agregar opción" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Editar Pérez" })).not.toBeInTheDocument();
  });
  it("keeps the draft read-only when Manage is revoked while Read remains", async () => {
    setup(); await mount("/catalogos/" + id); const user = userEvent.setup();
    const name = await screen.findByRole("textbox", { name: "Nombre" }); await user.clear(name); await pasteText(user, name, "Borrador conservado");
    act(() => queryClient.setQueryData<CurrentUser>(["current-user"], previous => previous ? ({ ...previous, permissions: ["formcatalogs.read"] }) : previous));
    await waitFor(() => expect(screen.getByRole("textbox", { name: "Nombre" })).toHaveAttribute("readonly"));
    expect(screen.getByRole("textbox", { name: "Nombre" })).toHaveValue("Borrador conservado");
    expect(screen.queryByRole("button", { name: "Guardar" })).not.toBeInTheDocument();
  });
  it("preserves a failed new catalog and allows an explicit retry without a nonexistent resource review", async () => {
    setup(); let calls = 0;
    server.use(http.post("/api/forms/catalogs", async ({ request }) => { calls++; const body = await request.json() as { items: { localId: string }[] }; return calls === 1 ? HttpResponse.json({}, { status: 500 }) : HttpResponse.json({ catalog: { ...initial, itemsCount: 0 }, itemIdentityMap: Object.fromEntries(body.items.map(item => [item.localId, itemId])), fieldIdentityMap: {} }, { status: 201 }); }));
    const router = await mount("/catalogos/nuevo"); const user = userEvent.setup();
    await pasteText(user, await screen.findByRole("textbox", { name: "Nombre" }), "Clientes"); await pasteText(user, screen.getByRole("textbox", { name: "Descripción" }), "Visitas");
    await user.click(screen.getByRole("button", { name: "Inglés" })); await pasteText(user, screen.getByRole("textbox", { name: "Nombre" }), "Customers"); await pasteText(user, screen.getByRole("textbox", { name: "Descripción" }), "Visits");
    await user.click(screen.getByRole("button", { name: "Guardar" }));
    await waitFor(() => expect(calls).toBe(1));
    await waitFor(() => expect(screen.getByRole("button", { name: "Guardar" })).toBeEnabled());
    expect(screen.getByRole("textbox", { name: "Nombre" })).toHaveValue("Customers");
    expect(screen.queryByRole("button", { name: "Revisar" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Releer" })).not.toBeInTheDocument();
    expect(vi.mocked(notify).mock.calls.filter(([message]) => message.kind === "error")).toHaveLength(1);
    await user.click(screen.getByRole("button", { name: "Guardar" }));
    await waitFor(() => expect(router.state.location.pathname).toBe("/catalogos/" + id));
    expect(calls).toBe(2);
  });
  it("queues several persisted moves without a request and saves them together without positions", async () => {
    setup(); const secondId = "01990000-0000-7000-8000-000000000022";
    let rows = [option, { ...option, id: secondId, code: "C2", text: { es: "López", en: null }, position: 2 }];
    const bodies: Record<string, unknown>[] = [];
    server.use(http.get("/api/forms/catalogs/" + id + "/items", () => HttpResponse.json({ items: rows, page: 1, pageSize: 20, totalCount: 2, totalPages: 1, hasPrevious: false, hasNext: false })), http.put("/api/forms/catalogs/" + id, async ({ request }) => {
      bodies.push(await request.json() as Record<string, unknown>);
      rows = [rows[1]!, rows[0]!].map((row, index) => ({ ...row, position: index + 1 }));
      return HttpResponse.json({ catalog: { ...initial, revision: 2, itemsCount: 2 }, itemIdentityMap: {}, fieldIdentityMap: {} });
    }));
    await mount("/catalogos/" + id); const user = userEvent.setup();
    await user.click(await screen.findByRole("button", { name: "Bajar Pérez" }));
    await user.click(screen.getByRole("button", { name: "Subir López" }));
    expect(bodies).toHaveLength(0);
    expect(screen.getByRole("status")).toHaveTextContent("2 movimientos pendientes");
    await user.click(screen.getByRole("button", { name: "Guardar" }));
    await waitFor(() => expect(bodies).toHaveLength(1));
    expect(bodies[0]).toMatchObject({ expectedRevision: 1, items: [], moves: [{ itemId, direction: "down" }, { itemId: secondId, direction: "up" }] });
    await waitFor(() => expect(screen.queryByText(/movimientos pendientes/)).not.toBeInTheDocument());
    expect(screen.getByRole("button", { name: "Subir López" })).toBeDisabled();
    expect(bodies[0]).not.toHaveProperty("position");
  });

  it("allows reversing a queued move before saving even when the confirmed position is first", async () => {
    setup(); const bodies: unknown[] = [];
    server.use(http.get("/api/forms/catalogs/" + id + "/items", () => HttpResponse.json({ items: [option, { ...option, id: "01990000-0000-7000-8000-000000000022", code: "C2", text: { es: "López", en: null }, position: 2 }], page: 1, pageSize: 20, totalCount: 2, totalPages: 1, hasPrevious: false, hasNext: false })), http.put("/api/forms/catalogs/" + id, async ({ request }) => { bodies.push(await request.json()); return HttpResponse.json({ catalog: { ...initial, revision: 2 }, itemIdentityMap: {}, fieldIdentityMap: {} }); }));
    await mount("/catalogos/" + id); const user = userEvent.setup();
    expect(await screen.findByRole("button", { name: "Subir Pérez" })).toBeDisabled();
    await user.click(screen.getByRole("button", { name: "Bajar Pérez" }));
    expect(screen.getByRole("button", { name: "Subir Pérez" })).toBeEnabled();
    await user.click(screen.getByRole("button", { name: "Subir Pérez" }));
    expect(bodies).toHaveLength(0);
    await user.click(screen.getByRole("button", { name: "Guardar" }));
    await waitFor(() => expect(bodies).toHaveLength(1));
    expect(bodies[0]).toMatchObject({ items: [], moves: [{ itemId, direction: "down" }, { itemId, direction: "up" }] });
  });

  it("opens the invalid option and binds server validation to its fields without a duplicate toast", async () => {
    setup(); server.use(http.put("/api/forms/catalogs/" + id, () => HttpResponse.json({ code: "Validation.Failed", errors: { "items[0].code": ["Código ya usado en otra página."], "items[0].text.es": ["Revisá el texto." ] } }, { status: 400 })));
    await mount("/catalogos/" + id); const user = userEvent.setup();
    await user.click(await screen.findByRole("button", { name: "Editar Pérez" }));
    await user.clear(screen.getByRole("textbox", { name: "Código" }));
    await pasteText(user, screen.getByRole("textbox", { name: "Código" }), "C99");
    await user.click(screen.getByRole("button", { name: "Listo" }));
    await user.click(screen.getByRole("button", { name: "Guardar" }));
    const code = await screen.findByRole("textbox", { name: "Código" });
    expect(code).toHaveAttribute("aria-invalid", "true");
    expect(code).toHaveAccessibleDescription("Código ya usado en otra página.");
    expect(screen.getByRole("textbox", { name: "Texto" })).toHaveAccessibleDescription("Revisá el texto.");
    expect(vi.mocked(notify).mock.calls.filter(([message]) => message.kind === "error")).toHaveLength(0);
  });

  it.each(["es", "en"] as const)("translates the pending draft status in %s", async culture => {
    setup(undefined, culture); await i18n.changeLanguage(culture);
    await mount("/catalogos/" + id); const user = userEvent.setup();
    const name = await screen.findByRole("textbox", { name: culture === "es" ? "Nombre" : "Name" });
    await user.clear(name); await pasteText(user, name, "Borrador");
    expect(screen.getByText(culture === "es" ? "Cambios sin guardar" : "Unsaved changes", { exact: true })).toBeInTheDocument();
    expect(screen.queryByText("unsaved", { exact: true })).not.toBeInTheDocument();
  });

});

const filtersDetail = { ...initial, kind: "Filters", filters: { textColumn: "name", detailColumn: "role", conditions: [], excludeRecipient: true, sortColumn: "name", sortDescending: false }, fields: null, presentation: null, presentationCheck: null };
function filterSetup(permissions = ["formcatalogs.read", "formcatalogs.manage"]) {
  setup(permissions);
  server.use(http.get("/api/forms/catalogs/" + id, () => HttpResponse.json(filtersDetail)), http.get("/api/forms/catalog-filter-options", () => HttpResponse.json({ source: "users", columns: [
    { key: "name", dataType: "text", canDisplay: true, canFilter: true, canSort: true, operators: ["contains", "equals"], choices: null },
    { key: "role", dataType: "text", canDisplay: true, canFilter: true, canSort: true, operators: ["has"], choices: [{ key: "01990000-0000-7000-8000-000000000601", label: "Operario" }] },
    { key: "active", dataType: "boolean", canDisplay: true, canFilter: true, canSort: true, operators: ["equals"], choices: [{ key: "true", label: "Active" }, { key: "false", label: "Inactive" }] }
  ], sampleUsers: permissions.includes("formcatalogs.manage") ? { items: [{ id: itemId, name: "Ana" }], page: 1, pageSize: 20, totalCount: 1, totalPages: 1, hasPrevious: false, hasNext: false } : null })));
}
async function selectSample() { const user = userEvent.setup(); await user.click(await screen.findByRole("combobox", { name: "Como si lo recibiera" })); await user.click(await screen.findByRole("option", { name: "Ana" })); }
describe("Filters editor connected to current DTOs", () => {
  it("edits conditions, previews explicitly and saves only configuration", async () => {
    filterSetup(); const previews: unknown[] = []; const writes: unknown[] = [];
    server.use(http.post("/api/forms/catalog-previews", async ({ request }) => { previews.push(await request.json()); return HttpResponse.json({ items: [{ id, text: "Beatriz", detail: "Operario", canSend:true }], totalCount: 1, exceedsLimit: false }); }), http.put("/api/forms/catalogs/" + id + "/filters", async ({ request }) => { const body = await request.json() as { filters: typeof filtersDetail.filters }; writes.push(body); return HttpResponse.json({ catalog: { ...filtersDetail, filters: body.filters, revision: 2 }, itemIdentityMap: {}, fieldIdentityMap: {} }); }));
    await mount("/catalogos/" + id); const user = userEvent.setup();
    await user.click(await screen.findByRole("button", { name: "Agregar condición" })); await user.selectOptions(screen.getByRole("combobox", { name: "Columna de la condición 1" }), "role");
    expect(screen.getByRole("combobox", { name: "Comparación de la condición 1" })).toHaveValue("has"); expect(writes).toHaveLength(0);
    await selectSample(); await user.click(screen.getByRole("button", { name: "Probar" })); await screen.findByText("Beatriz");
    await user.click(screen.getByRole("button", { name: "Guardar" })); await waitFor(() => expect(writes).toHaveLength(1));
    expect(previews).toHaveLength(2); expect(writes[0]).toMatchObject({ expectedRevision: 1, filters: { conditions: [{ column: "role", operator: "has", value: "01990000-0000-7000-8000-000000000601" }] } });
    expect(writes[0]).not.toHaveProperty("sampleUserId"); expect(writes[0]).not.toHaveProperty("items");
  });
  it("creates Filters from the new-catalog route and reloads the saved kind", async () => {
    filterSetup(); const writes: unknown[] = [];
    server.use(http.post("/api/forms/catalog-previews", () => HttpResponse.json({ items: [], totalCount: 0, exceedsLimit: false })), http.post("/api/forms/catalogs/filters", async ({ request }) => { writes.push(await request.json()); return HttpResponse.json({ catalog: filtersDetail, itemIdentityMap: {}, fieldIdentityMap: {} }, { status: 201 }); }));
    const router = await mount("/catalogos/nuevo?kind=Filters"); const user = userEvent.setup();
    await pasteText(user, await screen.findByRole("textbox", { name: "Nombre" }), "Clientes"); await pasteText(user, screen.getByRole("textbox", { name: "Descripción" }), "Visitas"); await user.click(screen.getByRole("button", { name: "Inglés" })); await pasteText(user, screen.getByRole("textbox", { name: "Nombre" }), "Customers"); await pasteText(user, screen.getByRole("textbox", { name: "Descripción" }), "Visits");
    await selectSample(); await user.click(screen.getByRole("button", { name: "Guardar" })); await waitFor(() => expect(router.state.location.pathname).toBe("/catalogos/" + id));
    expect(writes).toHaveLength(1); expect(writes[0]).toMatchObject({ name: initial.name, description: initial.description }); expect(writes[0]).not.toHaveProperty("expectedRevision");
    await screen.findByRole("button", { name: "Agregar condición" }); expect(screen.queryByRole("button", { name: "Agregar opción" })).not.toBeInTheDocument();
  });
  it("renders permitted configuration read-only without sample identities or preview writes", async () => {
    filterSetup(["formcatalogs.read"]); await mount("/catalogos/" + id);
    expect(await screen.findByRole("combobox", { name: "Texto de cada opción" })).toBeDisabled(); expect(screen.getByRole("textbox", { name: "Nombre" })).toHaveAttribute("readonly");
    expect(screen.queryByRole("combobox", { name: "Como si lo recibiera" })).not.toBeInTheDocument(); expect(screen.queryByRole("button", { name: "Guardar" })).not.toBeInTheDocument(); expect(screen.queryByRole("button", { name: "Probar" })).not.toBeInTheDocument();
  });
  it("binds filter errors to the field and retains the conditions without a duplicate toast", async () => {
    filterSetup(); server.use(http.post("/api/forms/catalog-previews", () => HttpResponse.json({ code: "Validation.Failed", errors: { "filters.conditions[0]": ["Revisá la condición."] } }, { status: 400 })));
    await mount("/catalogos/" + id); const user = userEvent.setup(); await user.click(await screen.findByRole("button", { name: "Agregar condición" })); await selectSample(); await user.click(screen.getByRole("button", { name: "Probar" }));
    const value = await screen.findByRole("textbox", { name: "Valor de la condición 1" }); await waitFor(() => expect(value).toHaveAccessibleDescription("Revisá la condición.")); expect(value).toHaveAttribute("aria-invalid", "true"); expect(vi.mocked(notify).mock.calls.filter(([message]) => message.kind === "error")).toHaveLength(0);
  });
});

it("edits fixed Users filters without source availability flags", async () => {
  filterSetup();
  server.use(http.post("/api/forms/catalog-previews", () => HttpResponse.json({ items: [{ id: itemId, text: "Beatriz", detail: null, canSend:true }], totalCount: 1, exceedsLimit: false })));
  await mount("/catalogos/" + id);
  expect(await screen.findByRole("combobox", { name: "Texto de cada opción" })).toBeEnabled();
  expect(screen.getByRole("combobox", { name: "Como si lo recibiera" })).toBeEnabled();
  await selectSample();
  expect(screen.getByRole("button", { name: "Probar" })).toBeEnabled();
  await userEvent.setup().click(screen.getByRole("button", { name: "Probar" }));
  expect(await screen.findByText("Beatriz", { exact: true })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Guardar" })).toBeEnabled();
});

it("keeps sample search focused and enabled while its next page is loading", async () => {
  filterSetup(); const options = readCatalogFilterOptions(JSON.parse(capturedOptionsRaw));
  let release!: () => void; const gate = new Promise<void>(resolve => { release = resolve; }); let searches = 0;
  server.use(http.get("/api/forms/catalog-filter-options", async ({ request }) => {
    if (!new URL(request.url).searchParams.get("search")) return HttpResponse.json(options);
    searches++; await gate;
    return HttpResponse.json({ ...options, sampleUsers: { items: [{ id: itemId, name: "Persona buscada" }], page: 1, pageSize: 20, totalCount: 1, totalPages: 1, hasPrevious: false, hasNext: false } });
  }));
  await mount("/catalogos/" + id); const user = userEvent.setup(); const input = await screen.findByRole("combobox", { name: "Como si lo recibiera" });
  await waitFor(() => expect(input).toBeEnabled());
  try { await user.type(input, "Persona"); await waitFor(() => expect(searches).toBeGreaterThan(0)); expect(input).toBeEnabled(); expect(input).toHaveFocus(); expect(screen.getByRole("combobox", { name: "Texto de cada opción" })).toBeInTheDocument(); expect(searches).toBe(1); }
  finally { release(); }
  expect(await screen.findByRole("option", { name: "Persona buscada" })).toBeInTheDocument();
});

 it("preserves the filters editor and its draft when sample search fails", async () => {
  filterSetup();
  server.use(http.get("/api/forms/catalog-filter-options", ({ request }) => new URL(request.url).searchParams.get("search")
    ? HttpResponse.json({}, { status: 503 }) : HttpResponse.json(readCatalogFilterOptions(JSON.parse(capturedOptionsRaw)))));
  await mount("/catalogos/" + id); const user = userEvent.setup();
  const text = await screen.findByRole("combobox", { name: "Texto de cada opción" });
  const detail = screen.getByRole("combobox", { name: "Detalle" });
  await user.selectOptions(detail, "active");
  const input = screen.getByRole("combobox", { name: "Como si lo recibiera" });
  await user.type(input, "Sin respuesta");
  await waitFor(() => expect(vi.mocked(notify).mock.calls.some(([message]) => message.kind === "error")).toBe(true));
  expect(screen.getByRole("combobox", { name: "Texto de cada opción" })).toBe(text);
  expect(text).toHaveValue("name");
  expect(screen.getByRole("combobox", { name: "Detalle" })).toBe(detail);
  expect(detail).toHaveValue("active");
  expect(input).toHaveFocus();
 });

it.each([false, true])("saves and reloads deactivation and reactivation for Filters=%s", async filters => {
  if (filters) filterSetup(); else setup();
  let detail = filters ? filtersDetail : initial; const bodies: unknown[] = [];
  server.use(http.get("/api/forms/catalogs/" + id, () => HttpResponse.json(detail)),
    http.put("/api/forms/catalogs/" + id + (filters ? "/filters" : ""), async ({ request }) => {
      const body = await request.json() as { isActive: boolean; expectedRevision: number }; bodies.push(body);
      detail = { ...detail, isActive: body.isActive, revision: body.expectedRevision + 1 };
      return HttpResponse.json({ catalog: detail, itemIdentityMap: {}, fieldIdentityMap: {} });
    }), http.post("/api/forms/catalog-previews", () => HttpResponse.json({ items: [], totalCount: 0, exceedsLimit: false })));
  await mount("/catalogos/" + id); const user = userEvent.setup();
  await user.click(await screen.findByRole("button", { name: "Dar de baja" }));
  expect(within(screen.getByRole("dialog")).getByText(/tampoco se podrán mandar los formularios publicados/)).toBeInTheDocument();
  await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Dar de baja" }));
  expect(bodies).toHaveLength(0);
  await user.click(screen.getByRole("button", { name: "Guardar" }));
  await waitFor(() => expect(detail.isActive).toBe(false));
  expect(await screen.findByText("Dado de baja", { exact: true })).toBeInTheDocument();
  cleanup(); queryClient.clear(); await mount("/catalogos/" + id);
  await user.click(await screen.findByRole("button", { name: "Reactivar" }));
  await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Reactivar" }));
  if (filters) await selectSample();
  await user.click(screen.getByRole("button", { name: "Guardar" }));
  await waitFor(() => expect(detail.isActive).toBe(true));
  expect(bodies).toMatchObject([{ expectedRevision: 1, isActive: false }, { expectedRevision: 2, isActive: true }]);
});

it("marks the complete unrepresentable person in the filter preview", async () => {
  filterSetup(); const longName = "Una persona con nombre que supera treinta caracteres";
  server.use(http.post("/api/forms/catalog-previews", () => HttpResponse.json({items:[{id,text:longName,detail:null,canSend:false}],totalCount:1,exceedsLimit:false})));
  await mount("/catalogos/" + id);
  await userEvent.type(await screen.findByRole("combobox", {name:"Como si lo recibiera"}), "Ana");
  await userEvent.click(await screen.findByRole("option", {name:"Ana"}));
  await userEvent.click(screen.getByRole("button", {name:"Probar"}));
  expect(await screen.findByText(longName)).toBeInTheDocument();
  expect(screen.getByText("No entra en WhatsApp: máximo 30 caracteres de texto y 300 de detalle.")).toBeInTheDocument();
});

it.each([false,true].flatMap(filters=>["network",500,503].map(failure=>({filters,failure}))))("offers explicit save after $failure for Filters=$filters", async ({filters,failure}) => {
  if(filters)filterSetup();else setup();
  const detail={...(filters?filtersDetail:initial),isActive:false}; let writes=0;
  server.use(http.get("/api/forms/catalogs/"+id,()=>HttpResponse.json(detail)),
    http.put("/api/forms/catalogs/"+id+(filters?"/filters":""),()=>++writes===1?(failure==="network"?HttpResponse.error():HttpResponse.json({traceId:"catalog-save"},{status:Number(failure)})):HttpResponse.json({catalog:{...detail,revision:2},itemIdentityMap:{}, fieldIdentityMap: {}})));
  await mount("/catalogos/"+id);
  await pasteText(userEvent.setup(), await screen.findByRole("textbox",{name:"Nombre"})," editado");
  await userEvent.click(screen.getByRole("button",{name:"Guardar"}));
  await waitFor(()=>expect(vi.mocked(notify).mock.calls.some(([notice])=>notice.kind==="error"&&notice.message.includes("Volvé a guardar."))).toBe(true));
  expect(screen.queryByRole("button",{name:"Revisar"})).not.toBeInTheDocument();
  await userEvent.click(screen.getByRole("button",{name:"Guardar"}));
  await waitFor(()=>expect(writes).toBe(2));
});

it("does not reset the sample page when its initial search is unchanged", async () => {
  filterSetup();
  const options = readCatalogFilterOptions(JSON.parse(capturedOptionsRaw));
  server.use(http.get("/api/forms/catalog-filter-options", ({request}) => {
    const page = Number(new URL(request.url).searchParams.get("page") ?? 1);
    return HttpResponse.json({...options,sampleUsers:{items:[{id:itemId,name:page===1 ? "Primera persona" : "Segunda persona"}],page,pageSize:20,totalCount:21,totalPages:2,hasPrevious:page>1,hasNext:page===1}});
  }));
  await mount("/catalogos/" + id);
  await userEvent.click(await screen.findByRole("button", {name:"Página siguiente"}));
  await screen.findByText("Página 2 de 2", {exact:true});
  await act(async () => { await new Promise(resolve => setTimeout(resolve, 350)); });
  expect(screen.getByText("Página 2 de 2", {exact:true})).toBeInTheDocument();
  expect(screen.getByRole("button", {name:"Página anterior"})).toBeEnabled();
});

it.each(["es", "en"] as const)("edits an exact typed value in %s, retains invalid input and never changes the persisted type", async language => {
  setup(undefined, language); await i18n.changeLanguage(language);
  const typed = { ...initial, valueType: "Decimal" };
  const bodies: Record<string, unknown>[] = [];
  server.use(http.get("/api/forms/catalogs/" + id, () => HttpResponse.json(typed)),
    http.get("/api/forms/catalogs/" + id + "/items", () => HttpResponse.json({ items: [{ ...option, value: "9007199254740993.0123" }], page: 1, pageSize: 20, totalCount: 1, totalPages: 1, hasPrevious: false, hasNext: false })),
    http.put("/api/forms/catalogs/" + id, async ({ request }) => { bodies.push(await request.json() as Record<string, unknown>); return HttpResponse.json({ catalog: { ...typed, revision: 2 }, itemIdentityMap: {}, fieldIdentityMap: {} }); }));
  await mount("/catalogos/" + id + "?valueType=Date");
  const user = userEvent.setup();
  expect(await screen.findByText(language === "es" ? "Escritas a mano · Decimal" : "Written manually · Decimal", { exact: true })).toBeInTheDocument();
  await user.click(await screen.findByRole("button", { name: language === "es" ? "Editar Pérez" : "Edit Pérez" }));
  const value = screen.getByRole("textbox", { name: language === "es" ? "Valor · Decimal" : "Value · Decimal" });
  expect(value).toHaveValue(language === "es" ? "9.007.199.254.740.993,0123" : "9,007,199,254,740,993.0123");
  await user.clear(value); await pasteText(user, value, "mil");
  expect(value).toHaveValue("mil"); expect(value).toHaveAttribute("aria-invalid", "true");
  const save = screen.getByRole("button", { name: language === "es" ? "Guardar" : "Save" });
  await user.click(save);
  expect(value).toHaveValue("mil"); expect(value).not.toHaveAttribute("readonly"); expect(bodies).toEqual([]);
  await user.clear(value); await pasteText(user, value, language === "es" ? "1.500,50" : "1,500.50");
  await user.click(save);
  await waitFor(() => expect(bodies).toHaveLength(1));
  expect(bodies[0]).not.toHaveProperty("valueType");
  expect(bodies[0]).toMatchObject({ expectedRevision: 1, items: [{ itemId, value: "1500.5", code: "C1" }] });
});

it("sends the chosen type only on creation and binds a value error to its unchanged item identity", async () => {
  setup(); const bodies: Record<string, unknown>[] = [];
  server.use(http.post("/api/forms/catalogs", async ({ request }) => {
    const body = await request.json() as Record<string, unknown>; bodies.push(body);
    return HttpResponse.json({ code: "Validation.Failed", errors: { "items[0].value": ["Revisá el valor decimal."] } }, { status: 400 });
  }));
  await mount("/catalogos/nuevo?valueType=Decimal"); const user = userEvent.setup();
  await user.click(await screen.findByRole("button", { name: "Agregar opción" }));
  const text = screen.getByRole("textbox", { name: "Texto" }); await pasteText(user, text, "GBA");
  await pasteText(user, screen.getByRole("textbox", { name: "Código" }), "Z-GBA");
  await pasteText(user, screen.getByRole("textbox", { name: "Valor · Decimal" }), "1.500,50");
  await user.click(screen.getByRole("button", { name: "Guardar" }));
  const value = screen.getByRole("textbox", { name: "Valor · Decimal" });
  await waitFor(() => expect(value).toHaveAccessibleDescription(expect.stringContaining("Revisá el valor decimal.")));
  expect(value).toHaveValue("1.500,50");
  expect(bodies).toHaveLength(1);
  expect(bodies[0]).toMatchObject({ valueType: "Decimal", items: [{ itemId: null, text: { es: "GBA" }, value: "1500.5" }] });
  expect(vi.mocked(notify).mock.calls.filter(([message]) => message.kind === "error")).toHaveLength(0);
});


it("blocks a duplicate code on either row but keeps duplicate labels as a warning", async () => {
  setup(); const other = { ...option, id:"01990000-0000-7000-8000-000000000022", code:"C2", text:{es:"Otro",en:null},position:2 }; const bodies: unknown[] = [];
  server.use(http.get("/api/forms/catalogs/"+id+"/items",()=>HttpResponse.json({items:[option,other],page:1,pageSize:20,totalCount:2,totalPages:1,hasNext:false,hasPrevious:false})), http.put("/api/forms/catalogs/"+id, async ({ request }) => { bodies.push(await request.json()); return HttpResponse.json({ catalog: { ...initial, revision: 2, itemsCount: 2 }, itemIdentityMap: {}, fieldIdentityMap: {} }); }));
  await mount("/catalogos/"+id); const user=userEvent.setup();
  await user.click(await screen.findByRole("button",{name:"Editar Otro"}));
  const code=screen.getByRole("textbox",{name:"Código"}); await user.clear(code); await pasteText(user,code,"c1");
  expect(code).toHaveAttribute("aria-invalid","true");
  expect(code).toHaveAccessibleDescription(expect.stringContaining("fila 1"));
  await user.click(screen.getByRole("button",{name:"Guardar"}));
  expect(bodies).toEqual([]);
  await user.clear(code);await pasteText(user,code,"C2");
  const text=screen.getByRole("textbox",{name:"Texto"});await user.clear(text);await pasteText(user,text,"Pérez");
  expect(text).toHaveAccessibleDescription(expect.stringContaining("fila 1"));
  expect(text).not.toHaveAttribute("aria-invalid","true");
  await user.click(screen.getByRole("button",{name:"Guardar"}));
  await waitFor(() => expect(bodies).toHaveLength(1));
});


it("requires a clean saved catalog to import, while Read still offers export",async()=>{
 setup();await mount("/catalogos/"+id);const user=userEvent.setup();
 const name=await screen.findByRole("textbox",{name:"Nombre"});
 expect(await screen.findByRole("button",{name:"Importar"})).toBeEnabled();
 await pasteText(user,name," editado");
 expect(screen.getByRole("button",{name:"Importar"})).toBeDisabled();
 expect(screen.getByRole("button",{name:"Importar"})).toHaveAccessibleDescription("Guardá o descartá los cambios antes de importar.");
 expect(screen.getByRole("button",{name:"Exportar"})).toBeEnabled();
 cleanup();queryClient.clear();setup(["formcatalogs.read"]);await mount("/catalogos/"+id);
 await screen.findByRole("textbox",{name:"Nombre"});expect(await screen.findByRole("button",{name:"Exportar"})).toBeEnabled();
 expect(screen.queryByRole("button",{name:"Importar"})).not.toBeInTheDocument();
});
it("saves alphabetical ordering as a single command and no movements",async()=>{
 setup();const bodies:Record<string,unknown>[]=[];server.use(http.put("/api/forms/catalogs/"+id,async({request})=>{bodies.push(await request.json() as Record<string,unknown>);return HttpResponse.json({catalog:{...initial,revision:2},itemIdentityMap:{}, fieldIdentityMap: {}});}));
 await mount("/catalogos/"+id);const user=userEvent.setup();
 const more=await screen.findByRole("button",{name:"Más acciones de opciones"});act(()=>more.focus());await user.keyboard("{Enter}");
 await user.click(await screen.findByRole("menuitem",{name:"Ordenar A–Z"}));
 expect(screen.getByRole("status")).toHaveTextContent("Se ordenará A–Z al guardar.");expect(bodies).toEqual([]);
 expect(screen.getByRole("button",{name:"Bajar Pérez"})).toBeDisabled();
 await user.click(screen.getByRole("button",{name:"Guardar"}));await waitFor(()=>expect(bodies).toHaveLength(1));
 expect(bodies[0]).toMatchObject({expectedRevision:1,sortAlphabetically:true,items:[]});expect(bodies[0]).not.toHaveProperty("moves");
});
it("applies an explicitly reviewed paste and adopts the returned clean baseline without saving the draft",async()=>{
 setup();const base=catalogImportPreviewFixture();const check=vi.spyOn(catalogImports,"previewCatalogImport").mockResolvedValue({...base,revision:1,mode:"Append",counts:{...base.counts,errorRows:0,deactivated:0},issues:[],deactivated:[],confirmations:{deactivations:0,emptySheet:false,manyErrors:false}});
 const apply=vi.spyOn(catalogImports,"applyCatalogImport").mockResolvedValue({catalog:{...initial,kind:"Manual",revision:2},itemIdentityMap:{}, fieldIdentityMap: {}});
 await mount("/catalogos/"+id);const user=userEvent.setup();
 await user.click(await screen.findByRole("button",{name:"Pegar desde Excel"}));
 await pasteText(user,screen.getByRole("textbox",{name:"Pegá las filas con encabezados"}),"Code\tText\nN\tNorte");
 await user.click(screen.getByRole("button",{name:"Revisar"}));
 expect(await screen.findByRole("button",{name:"Aplicar"})).toBeEnabled();expect(apply).not.toHaveBeenCalled();
 await user.click(screen.getByRole("button",{name:"Aplicar"}));
 await waitFor(()=>expect(screen.queryByRole("dialog")).not.toBeInTheDocument());expect(apply).toHaveBeenCalledOnce();expect(check).toHaveBeenCalledOnce();
 expect(screen.queryByText("Cambios sin guardar",{exact:true})).not.toBeInTheDocument();expect(queryClient.getMutationCache().getAll()).toEqual([]);
 await user.click(screen.getByRole("button",{name:"Pegar desde Excel"}));await pasteText(user,screen.getByRole("textbox",{name:"Pegá las filas con encabezados"}),"Code\tText\nN\tNorte");
 await user.click(screen.getByRole("button",{name:"Revisar"}));await waitFor(()=>expect(check).toHaveBeenCalledTimes(2));expect(check.mock.calls[1]![1].expectedRevision).toBe(2);
});
it("imports with the fields saved in this session instead of the ones loaded on entry", async () => {
  setup(); const fieldId = "01990000-0000-7000-8000-000000000031";
  const taxId = { id: fieldId, key: "tax_id", name: { es: "CUIT" }, type: "text", sourceCatalogId: null, required: false, unique: false, min: null, max: null, maxLength: null, role: "data", position: 1, isActive: true, valuesCount: 0, usedBy: [] };
  server.use(http.put("/api/forms/catalogs/" + id, async ({ request }) => {
    const body = await request.json() as { fields: { localId: string }[] };
    return HttpResponse.json({ catalog: { ...initial, revision: 2, fields: [taxId] }, itemIdentityMap: {}, fieldIdentityMap: { [body.fields[0]!.localId]: fieldId } });
  }));
  const base = catalogImportPreviewFixture();
  vi.spyOn(catalogImports, "previewCatalogImport").mockResolvedValue({ ...base, revision: 2, mode: "Append", counts: { ...base.counts, errorRows: 0, deactivated: 0, changed: 1 }, issues: [], deactivated: [], confirmations: { deactivations: 0, emptySheet: false, manyErrors: false },
    added: [{ row: 2, code: "N", text: "Norte", value: null, fields: { [fieldId]: "20-1" } }], changed: [{ row: 3, itemId, code: "C1", changes: [{ column: fieldId, before: null, after: "20-2" }] }] });
  await mount("/catalogos/" + id); const user = userEvent.setup();
  await screen.findByRole("textbox", { name: "Nombre" });
  await user.click(screen.getByRole("button", { name: "Agregar campo" }));
  await user.paste("CUIT");
  await user.click(screen.getByRole("button", { name: "Guardar" }));
  await waitFor(() => expect(screen.getByRole("button", { name: "Pegar desde Excel" })).toBeEnabled());
  await user.click(screen.getByRole("button", { name: "Pegar desde Excel" }));
  await pasteText(user, screen.getByRole("textbox", { name: "Pegá las filas con encabezados" }), "Code\tText\ttax_id\nN\tNorte\t20-1");
  await user.click(screen.getByRole("button", { name: "Revisar" }));
  const dialog = await screen.findByRole("dialog");
  expect(await within(dialog).findByRole("columnheader", { name: "CUIT" })).toBeInTheDocument();
  expect(within(dialog).queryByText(fieldId, { exact: false })).not.toBeInTheDocument();
  act(() => within(dialog).getByRole("tab", { name: "Cambios" }).focus()); await user.keyboard("{Enter}");
  expect(await within(dialog).findByText("CUIT: — → 20-2")).toBeInTheDocument();
});
it("warns about long titles with the check of the applied import instead of the one loaded on entry", async () => {
  setup(); const entryTitle = "Pérez · Distribuidora del Litoral Norte", importedTitle = "Norte · Ferretería Industrial del Centro";
  const english = { culture: "en" as const, titleTooLongCount: 0, titleExamples: [], descriptionTooLongCount: 0, descriptionExamples: [] };
  server.use(http.get("/api/forms/catalogs/" + id, () => HttpResponse.json({ ...initial, presentationCheck: { cultures: [{ culture: "es", titleTooLongCount: 1, titleExamples: [{ itemId, title: entryTitle }], descriptionTooLongCount: 0, descriptionExamples: [] }, english] } })));
  const base = catalogImportPreviewFixture();
  vi.spyOn(catalogImports, "previewCatalogImport").mockResolvedValue({ ...base, revision: 1, mode: "Append", counts: { ...base.counts, errorRows: 0, deactivated: 0 }, issues: [], deactivated: [], confirmations: { deactivations: 0, emptySheet: false, manyErrors: false } });
  const importedExamples = [{ itemId, title: importedTitle }, { itemId: "01990000-0000-7000-8000-0000000007a1", title: "Sur · Ferretería Industrial del Centro" }, { itemId: "01990000-0000-7000-8000-0000000007a2", title: "Oeste · Ferretería Industrial del Centro" }];
  vi.spyOn(catalogImports, "applyCatalogImport").mockResolvedValue({ catalog: { ...initial, kind: "Manual", revision: 2, presentationCheck: { cultures: [{ culture: "es", titleTooLongCount: 4, titleExamples: importedExamples, descriptionTooLongCount: 0, descriptionExamples: [] }, english] } }, itemIdentityMap: {}, fieldIdentityMap: {} });
  await mount("/catalogos/" + id); const user = userEvent.setup();
  expect(await screen.findByText("En español: 1 opción supera los 30 caracteres del título.")).toBeInTheDocument();
  expect(screen.getByText(entryTitle)).toBeInTheDocument();
  await user.click(await screen.findByRole("button", { name: "Pegar desde Excel" }));
  await pasteText(user, screen.getByRole("textbox", { name: "Pegá las filas con encabezados" }), "Code\tText\nN\tNorte");
  await user.click(screen.getByRole("button", { name: "Revisar" }));
  await user.click(await screen.findByRole("button", { name: "Aplicar" }));
  await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  expect(await screen.findByText("En español: 4 opciones superan los 30 caracteres del título.")).toBeInTheDocument();
  expect(screen.getByText(importedTitle)).toBeInTheDocument();
  expect(screen.getByText("y 1 más")).toBeInTheDocument();
  expect(screen.queryByText(entryTitle)).not.toBeInTheDocument();
});

it.each(["es", "en"] as const)("localizes discard cancellation and preserves the unsaved catalog in %s", async culture => {
  const label = (es: string, en: string) => culture === "es" ? es : en;
  setup(["formcatalogs.read", "formcatalogs.manage"], culture);
  await act(async () => { await i18n.changeLanguage(culture); });
  const router = await mount("/catalogos/nuevo?valueType=Decimal");
  const user = userEvent.setup();
  const name = await screen.findByRole("textbox", { name: label("Nombre", "Name") });
  await pasteText(user, name, "Catálogo pendiente");
  const previousLocation = router.state.location;
  const discard = screen.getByRole("button", { name: label("Descartar", "Discard") });
  await user.click(discard);
  const dialog = await screen.findByRole("dialog", { name: label("¿Descartar los cambios?", "Discard changes?") });
  const stay = within(dialog).getByRole("button", { name: label("Seguir editando", "Keep editing") });
  expect(within(dialog).queryByRole("button", { name: "keepEditing" })).not.toBeInTheDocument();
  await user.click(stay);
  await waitFor(() => expect(dialog).not.toBeInTheDocument());
  expect(name).toHaveValue("Catálogo pendiente");
  expect(router.state.location.pathname).toBe(previousLocation.pathname);
  expect(router.state.location.search).toBe(previousLocation.search);
  expect(new URLSearchParams(router.state.location.search).get("valueType")).toBe("Decimal");
  await waitFor(() => expect(discard).toHaveFocus());
});
