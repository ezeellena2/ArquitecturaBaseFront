import { MemoryRouter } from "react-router";
import { act, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HttpResponse, http } from "msw";
import { expect, it, vi } from "vitest";
import i18n from "@/shared/i18n";
import { renderWithProviders } from "@/test/utils/renderWithProviders";
import { server } from "@/test/mocks/server";
import { currentUser } from "@/test/mocks/handlers";
import { UserDataSectionContext } from "@/shared/hooks/userDataSectionContext";
import { PersonDataPage } from "./PersonDataPage";
vi.mock("react-oidc-context", async () => { const actual = await vi.importActual<typeof import("react-oidc-context")>("react-oidc-context"); return { ...actual, useAuth: () => ({ isAuthenticated: true, isLoading: false, user: { access_token: "t" } }) }; });
const id = "01990000-0000-7000-8000-000000000001", userId = "01990000-0000-7000-8000-000000000002";
const attribute = { id, key: "branch", name: { es: "Sucursal", en: "Branch" }, originalCulture: "es", type: "Text", sourceCatalogId: null, sourceCatalogName: null, position: 1, isActive: true, revision: 1, usedBy: [] };
const people = { items: [{ userId, displayName: "Juan Gómez", values: { [id]: { value: "Centro", text: "Centro" } } }], page: 1, pageSize: 20, totalCount: 1, missing: [{ attributeId: id, count: 0 }], totalPages: 1, hasPrevious: false, hasNext: false };
async function mount(permissions: string[], items: unknown[] = [attribute]) {
 let reads = 0;
 server.use(http.get("/api/me", () => HttpResponse.json({ ...currentUser, permissions })), http.get("/api/forms/person-attributes", () => HttpResponse.json({ items })), http.get("/api/forms/person-data", () => { reads++; return HttpResponse.json(people); }));
 await act(async () => { renderWithProviders(<MemoryRouter><PersonDataPage /></MemoryRouter>); });
 return () => reads;
}
it("shows the dedicated people table with field values when both read permissions are present", async () => {
 await mount(["formpersondata.manage", "users.read"]);
 const table = (await screen.findByRole("heading", { name: "Personas" })).closest("section")!;
 expect(await within(table).findByText("Juan Gómez")).toBeInTheDocument();
 expect(within(table).getByText("Centro")).toBeInTheDocument();
 expect(screen.getByRole("button", { name: "Agregar dato" })).toBeEnabled();
});
it("summarizes how many people match and how many lack each attribute used by a filter", async () => {
 const zoneId = "01990000-0000-7000-8000-000000000007";
 const zone = { ...attribute, id: zoneId, key: "zone", name: { es: "Zona", en: "Zone" }, position: 0, usedBy: [{ definitionId: "01990000-0000-7000-8000-000000000008", name: "Pedir repuesto" }] };
 server.use(http.get("/api/me", () => HttpResponse.json({ ...currentUser, permissions: ["formpersondata.manage", "users.read"] })), http.get("/api/forms/person-attributes", () => HttpResponse.json({ items: [zone, attribute] })), http.get("/api/forms/person-data", () => HttpResponse.json({ ...people, totalCount: 6, missing: [{ attributeId: zoneId, count: 2 }, { attributeId: id, count: 1 }] })));
 await act(async () => { renderWithProviders(<MemoryRouter><PersonDataPage /></MemoryRouter>); });
 const table = (await screen.findByRole("heading", { name: "Personas" })).closest("section")!;
 expect(await within(table).findByText("6 personas · 2 sin Zona")).toBeInTheDocument();
 expect(within(table).queryByText(/sin Sucursal/)).not.toBeInTheDocument();
});
it("shows an attribute named only in the other language with that name in both tables", async () => {
 await mount(["formpersondata.manage", "users.read"], [{ ...attribute, name: { en: "Zone" }, originalCulture: "en" }]);
 const definitions = (await screen.findByRole("heading", { name: "Datos" })).closest("section")!;
 expect(await within(definitions).findByRole("cell", { name: "Zone" })).toBeInTheDocument();
 expect(within(definitions).getByRole("button", { name: "Editar Zone" })).toBeInTheDocument();
 const table = (await screen.findByRole("heading", { name: "Personas" })).closest("section")!;
 expect(await within(table).findByRole("columnheader", { name: "Zone" })).toBeInTheDocument();
});
it("keeps attribute administration available without requesting people who cannot be read", async () => {
 const reads = await mount(["formpersondata.manage"]);
 expect(await screen.findByText("Sucursal")).toBeInTheDocument();
 expect(screen.getByText("Para ver las personas necesitás Ver usuarios.")).toBeInTheDocument();
 expect(reads()).toBe(0);
 expect(screen.queryByText("Juan Gómez")).not.toBeInTheDocument();
});
it("refreshes the people table after the user editor closes", async () => {
 const opened: { userId: string; onClosed?: () => void }[] = [];
 let reads = 0;
 server.use(http.get("/api/me", () => HttpResponse.json({ ...currentUser, permissions: ["formpersondata.manage", "users.read", "users.manage"] })), http.get("/api/forms/person-attributes", () => HttpResponse.json({ items: [attribute] })), http.get("/api/forms/person-data", () => HttpResponse.json({ ...people, items: [{ ...people.items[0], displayName: reads++ === 0 ? "Juan Gómez" : "Juan Carlos Gómez" }] })));
 const extension = { Section: () => null, openUser: (opener: string, onClosed?: () => void) => { opened.push({ userId: opener, onClosed }); } };
 await act(async () => { renderWithProviders(<MemoryRouter><UserDataSectionContext.Provider value={extension}><PersonDataPage /></UserDataSectionContext.Provider></MemoryRouter>); });
 await userEvent.click(await screen.findByRole("button", { name: "Editar a Juan Gómez" }));
 expect(opened.map(entry => entry.userId)).toEqual([userId]);
 await act(async () => { opened[0].onClosed?.(); });
 expect(await screen.findByText("Juan Carlos Gómez")).toBeInTheDocument();
});
it("reloads an attribute after a revision conflict and saves with the current revision", async () => {
 const conflict = "Otra persona cambió el dato. Volvé a cargarlo.";
 const saved = { ...attribute, name: { es: "Zona de atención", en: "Branch" }, revision: 2 };
 const bodies: unknown[] = [];
 let current: unknown = attribute;
 await mount(["formpersondata.manage"]);
 server.use(
  http.get("/api/forms/person-attributes", () => HttpResponse.json({ items: [current] })),
  http.put(`/api/forms/person-attributes/${id}`, async ({ request }) => {
   bodies.push(await request.json());
   if (bodies.length === 1) { current = saved; return HttpResponse.json({ type: "https://tools.ietf.org/html/rfc9110#section-15.5.10", title: "Conflict", status: 409, detail: conflict, traceId: "trace", code: "Forms.PersonAttribute.RevisionConflict" }, { status: 409 }); }
   return HttpResponse.json({ ...saved, revision: 3 });
  }));
 await userEvent.click(await screen.findByRole("button", { name: "Editar Sucursal" }));
 const dialog = within(screen.getByRole("dialog", { name: "Editar dato" }));
 const name = dialog.getByRole("textbox", { name: "Nombre" });
 await userEvent.clear(name);
 await userEvent.type(name, "Sucursal central");
 await userEvent.click(dialog.getByRole("button", { name: "Guardar" }));
 expect(await dialog.findByRole("alert")).toHaveTextContent(conflict);
 expect(dialog.getByRole("button", { name: "Guardar" })).toBeDisabled();
 await userEvent.click(dialog.getByRole("button", { name: "Volver a cargar el dato" }));
 const reloaded = () => within(screen.getByRole("dialog", { name: "Editar dato" }));
 await waitFor(() => expect(reloaded().getByRole("textbox", { name: "Nombre" })).toHaveValue("Zona de atención"));
 expect(reloaded().queryByRole("alert")).not.toBeInTheDocument();
 await userEvent.click(reloaded().getByRole("button", { name: "Guardar" }));
 await waitFor(() => expect(screen.queryByRole("dialog", { name: "Editar dato" })).not.toBeInTheDocument());
 expect(bodies).toEqual([
  { expectedRevision: 1, name: { es: "Sucursal central", en: "Branch" }, type: "Text", sourceCatalogId: null, position: 1, isActive: true },
  { expectedRevision: 2, name: { es: "Zona de atención", en: "Branch" }, type: "Text", sourceCatalogId: null, position: 1, isActive: true },
 ]);
 await waitFor(() => expect(screen.getByRole("button", { name: "Editar Zona de atención" })).toHaveFocus());
});
it("creates a text attribute with an immutable key and without reading catalogs", async () => {
 const bodies: unknown[] = [];
 await mount(["formpersondata.manage"]);
 server.use(http.post("/api/forms/person-attributes", async ({ request }) => { bodies.push(await request.json()); return HttpResponse.json({ ...attribute, id: "01990000-0000-7000-8000-000000000003", key: "site", name: { es: "Sede" }, revision: 1 }); }));
 await screen.findByText("Sucursal");
 await userEvent.click(screen.getByRole("button", { name: "Agregar dato" }));
 const dialog = within(screen.getByRole("dialog", { name: "Agregar dato" }));
 await userEvent.type(dialog.getByRole("textbox", { name: "Nombre" }), "Sede");
 await userEvent.type(dialog.getByRole("textbox", { name: "Clave" }), "site");
 await userEvent.selectOptions(dialog.getByRole("combobox", { name: "Tipo" }), "Text");
 await userEvent.click(dialog.getByRole("button", { name: "Guardar" }));
 await waitFor(() => expect(bodies).toEqual([{ key: "site", name: { es: "Sede" }, type: "Text", sourceCatalogId: null }]));
});
it("creates a person attribute named only in the menu language", async () => {
 const zones = "01990000-0000-7000-8000-000000000004";
 const bodies: unknown[] = [];
 server.use(
  http.get("/api/me", () => HttpResponse.json({ ...currentUser, culture: "en", permissions: ["formpersondata.manage", "formcatalogs.read"] })),
  http.get("/api/forms/person-attributes", () => HttpResponse.json({ items: [attribute] })),
  http.get("/api/forms/catalogs", () => HttpResponse.json({ items: [{ valueType: "Text", id: zones, name: "Zones", description: null, origin: "Manual", optionsCount: 2, usageCount: null, state: "Active", stateReason: null, canEdit: true }], page: 1, pageSize: 20, totalCount: 1, totalPages: 1, hasPrevious: false, hasNext: false, filterCounts: { byKind: { all: 1, manual: 1, filters: 0 } } })),
  http.post("/api/forms/person-attributes", async ({ request }) => { bodies.push(await request.json()); return HttpResponse.json({ ...attribute, id: "01990000-0000-7000-8000-000000000003", key: "zone", name: { en: "Zone" }, originalCulture: "en", type: "Catalog", sourceCatalogId: zones, sourceCatalogName: "Zones", revision: 1 }); }));
 await i18n.changeLanguage("en");
 try {
  await act(async () => { renderWithProviders(<MemoryRouter><PersonDataPage /></MemoryRouter>); });
  await screen.findByText("Branch");
  await userEvent.click(screen.getByRole("button", { name: "Add attribute" }));
  const dialog = within(screen.getByRole("dialog", { name: "Add attribute" }));
  expect(dialog.queryByRole("textbox", { name: "Name in English" })).not.toBeInTheDocument();
  await userEvent.type(dialog.getByRole("textbox", { name: "Name" }), "Zone");
  await userEvent.type(dialog.getByRole("textbox", { name: "Key" }), "zone");
  const catalog = dialog.getByRole("combobox", { name: "Catalog" });
  await waitFor(() => expect(catalog).toBeEnabled());
  await userEvent.selectOptions(catalog, zones);
  await userEvent.click(dialog.getByRole("button", { name: "Save" }));
  await waitFor(() => expect(bodies).toEqual([{ key: "zone", name: { en: "Zone" }, type: "Catalog", sourceCatalogId: zones }]));
 } finally {
  await i18n.changeLanguage("es");
 }
});
it("translates a person attribute name with its original as reference and keeps the original", async () => {
 const spanish = { ...attribute, name: { es: "Sucursal" } };
 const bodies: unknown[] = [];
 server.use(
  http.get("/api/me", () => HttpResponse.json({ ...currentUser, culture: "en", permissions: ["formpersondata.manage"] })),
  http.get("/api/forms/person-attributes", () => HttpResponse.json({ items: [spanish] })),
  http.put(`/api/forms/person-attributes/${id}`, async ({ request }) => {
   bodies.push(await request.json());
   return bodies.length === 1
    ? HttpResponse.json({ status: 400, detail: "Invalid", code: "Forms.PersonAttribute.AttributeInvalid", traceId: "trace", errors: { "name.es": ["Enter the name."] } }, { status: 400 })
    : HttpResponse.json({ ...spanish, name: { es: "Sucursal", en: "Branch" }, revision: 2 });
  }));
 await i18n.changeLanguage("en");
 try {
  await act(async () => { renderWithProviders(<MemoryRouter><PersonDataPage /></MemoryRouter>); });
  // Without a translation the name shows in its original.
  await userEvent.click(await screen.findByRole("button", { name: "Edit Sucursal" }));
  const dialog = within(screen.getByRole("dialog", { name: "Edit attribute" }));
  const name = dialog.getByRole("textbox", { name: "Name" });
  expect(dialog.getByText("Name", { selector: "label" })).toHaveTextContent(/^Name$/);
  expect(name).toHaveValue("");
  expect(name).toHaveAttribute("placeholder", "Untranslated");
  expect(name).toHaveAccessibleDescription("Original (Spanish): Sucursal");
  await userEvent.type(name, "Branch");
  await userEvent.click(dialog.getByRole("button", { name: "Save" }));
  // An error of the original shows under the same field, naming its language.
  await waitFor(() => expect(dialog.getByRole("textbox", { name: "Name" })).toHaveAccessibleDescription("In Spanish: Enter the name."));
  await userEvent.click(dialog.getByRole("button", { name: "Save" }));
  await waitFor(() => expect(screen.queryByRole("dialog", { name: "Edit attribute" })).not.toBeInTheDocument());
  expect(bodies).toEqual([
   { expectedRevision: 1, name: { es: "Sucursal", en: "Branch" }, type: "Text", sourceCatalogId: null, position: 1, isActive: true },
   { expectedRevision: 1, name: { es: "Sucursal", en: "Branch" }, type: "Text", sourceCatalogId: null, position: 1, isActive: true },
  ]);
 } finally {
  await i18n.changeLanguage("es");
 }
});
it("asks to confirm clearing stored values when the type changes and resends with the confirmation", async () => {
 const zone = { ...attribute, type: "Catalog", sourceCatalogId: "01990000-0000-7000-8000-000000000004", sourceCatalogName: "Zonas" };
 const notConfirmed = "Confirmá que querés cambiar el dato y borrar los valores que tienen cargados las personas.";
 const bodies: unknown[] = [];
 await mount(["formpersondata.manage"], [zone]);
 server.use(http.put(`/api/forms/person-attributes/${id}`, async ({ request }) => {
  bodies.push(await request.json());
  return bodies.length === 1
   ? HttpResponse.json({ status: 400, detail: notConfirmed, code: "Forms.PersonAttribute.ValueRemovalNotConfirmed", traceId: "trace", errors: { type: [notConfirmed] }, count: 3 }, { status: 400 })
   : HttpResponse.json({ ...zone, type: "Text", sourceCatalogId: null, sourceCatalogName: null, revision: 2 });
 }));
 await userEvent.click(await screen.findByRole("button", { name: "Editar Sucursal" }));
 const dialog = within(screen.getByRole("dialog", { name: "Editar dato" }));
 await userEvent.selectOptions(dialog.getByRole("combobox", { name: "Tipo" }), "Text");
 await userEvent.click(dialog.getByRole("button", { name: "Guardar" }));
 const confirm = await dialog.findByRole("checkbox", { name: "Sí, cambiar el dato y borrar los valores de 3 personas" });
 expect(dialog.getByText(notConfirmed)).toBeInTheDocument();
 await userEvent.click(confirm);
 expect(confirm).toBeChecked();
 await userEvent.selectOptions(dialog.getByRole("combobox", { name: "Tipo" }), "Catalog");
 await userEvent.selectOptions(dialog.getByRole("combobox", { name: "Tipo" }), "Text");
 expect(confirm).not.toBeChecked();
 await userEvent.click(confirm);
 await userEvent.click(dialog.getByRole("button", { name: "Guardar" }));
 await waitFor(() => expect(screen.queryByRole("dialog", { name: "Editar dato" })).not.toBeInTheDocument());
 expect(bodies).toEqual([
  { expectedRevision: 1, name: { es: "Sucursal", en: "Branch" }, type: "Text", sourceCatalogId: null, position: 1, isActive: true },
  { expectedRevision: 1, name: { es: "Sucursal", en: "Branch" }, type: "Text", sourceCatalogId: null, position: 1, isActive: true, confirmValueRemoval: true },
 ]);
});
it("asks to confirm clearing stored values under the catalog when only the source changes and unchecks it on another catalog", async () => {
 const zones = "01990000-0000-7000-8000-000000000004", regions = "01990000-0000-7000-8000-000000000005", branches = "01990000-0000-7000-8000-000000000006";
 const zone = { ...attribute, type: "Catalog", sourceCatalogId: zones, sourceCatalogName: "Zonas" };
 const notConfirmed = "Confirmá que querés cambiar el dato y borrar los valores que tienen cargados las personas.";
 const row = (catalogId: string, name: string) => ({ valueType: "Text", id: catalogId, name, description: null, origin: "Manual", optionsCount: 2, usageCount: null, state: "Active", stateReason: null, canEdit: true });
 const bodies: unknown[] = [];
 await mount(["formpersondata.manage", "formcatalogs.read"], [zone]);
 server.use(
  http.get("/api/forms/catalogs", () => HttpResponse.json({ items: [row(zones, "Zonas"), row(regions, "Regiones"), row(branches, "Sucursales")], page: 1, pageSize: 20, totalCount: 3, totalPages: 1, hasPrevious: false, hasNext: false, filterCounts: { byKind: { all: 3, manual: 3, filters: 0 } } })),
  http.put(`/api/forms/person-attributes/${id}`, async ({ request }) => {
   bodies.push(await request.json());
   return bodies.length === 1
    ? HttpResponse.json({ status: 400, detail: notConfirmed, code: "Forms.PersonAttribute.ValueRemovalNotConfirmed", traceId: "trace", errors: { sourceCatalogId: [notConfirmed] }, count: 1 }, { status: 400 })
    : HttpResponse.json({ ...zone, sourceCatalogId: branches, sourceCatalogName: "Sucursales", revision: 2 });
  }));
 await userEvent.click(await screen.findByRole("button", { name: "Editar Sucursal" }));
 const dialog = within(screen.getByRole("dialog", { name: "Editar dato" }));
 const catalog = dialog.getByRole("combobox", { name: "Catálogo" });
 await waitFor(() => expect(catalog).toBeEnabled());
 await userEvent.selectOptions(catalog, regions);
 await userEvent.click(dialog.getByRole("button", { name: "Guardar" }));
 const confirm = await dialog.findByRole("checkbox", { name: "Sí, cambiar el dato y borrar el valor que tiene cargado una persona" });
 expect(catalog).toHaveAccessibleDescription(notConfirmed);
 await userEvent.click(confirm);
 expect(confirm).toBeChecked();
 await userEvent.selectOptions(catalog, branches);
 expect(confirm).not.toBeChecked();
 await userEvent.click(confirm);
 await userEvent.click(dialog.getByRole("button", { name: "Guardar" }));
 await waitFor(() => expect(screen.queryByRole("dialog", { name: "Editar dato" })).not.toBeInTheDocument());
 expect(bodies).toEqual([
  { expectedRevision: 1, name: { es: "Sucursal", en: "Branch" }, type: "Catalog", sourceCatalogId: regions, position: 1, isActive: true },
  { expectedRevision: 1, name: { es: "Sucursal", en: "Branch" }, type: "Catalog", sourceCatalogId: branches, position: 1, isActive: true, confirmValueRemoval: true },
 ]);
});
it("keeps the value removal confirmation visible while the confirmed save runs and after it fails", async () => {
 const zone = { ...attribute, type: "Catalog", sourceCatalogId: "01990000-0000-7000-8000-000000000004", sourceCatalogName: "Zonas" };
 const notConfirmed = "Confirmá que querés cambiar el dato y borrar los valores que tienen cargados las personas.";
 const bodies: unknown[] = [];
 let release!: () => void;
 const gate = new Promise<void>(resolve => { release = resolve; });
 await mount(["formpersondata.manage"], [zone]);
 server.use(http.put(`/api/forms/person-attributes/${id}`, async ({ request }) => {
  bodies.push(await request.json());
  if (bodies.length === 1) return HttpResponse.json({ status: 400, detail: notConfirmed, code: "Forms.PersonAttribute.ValueRemovalNotConfirmed", traceId: "trace", errors: { type: [notConfirmed] }, count: 3 }, { status: 400 });
  if (bodies.length === 2) { await gate; return HttpResponse.json({ status: 500, title: "Failed save", code: "General.Unexpected", traceId: "trace" }, { status: 500 }); }
  return HttpResponse.json({ ...zone, type: "Text", sourceCatalogId: null, sourceCatalogName: null, revision: 2 });
 }));
 await userEvent.click(await screen.findByRole("button", { name: "Editar Sucursal" }));
 const dialog = within(screen.getByRole("dialog", { name: "Editar dato" }));
 await userEvent.selectOptions(dialog.getByRole("combobox", { name: "Tipo" }), "Text");
 await userEvent.click(dialog.getByRole("button", { name: "Guardar" }));
 const confirmName = "Sí, cambiar el dato y borrar los valores de 3 personas";
 await userEvent.click(await dialog.findByRole("checkbox", { name: confirmName }));
 await userEvent.click(dialog.getByRole("button", { name: "Guardar" }));
 await waitFor(() => expect(bodies).toHaveLength(2));
 expect(dialog.getByRole("checkbox", { name: confirmName })).toBeDisabled();
 expect(dialog.getByRole("checkbox", { name: confirmName })).toBeChecked();
 release();
 await waitFor(() => expect(dialog.getByRole("button", { name: "Guardar" })).toBeEnabled());
 expect(dialog.getByRole("checkbox", { name: confirmName })).toBeEnabled();
 expect(dialog.getByRole("checkbox", { name: confirmName })).toBeChecked();
 await userEvent.click(dialog.getByRole("button", { name: "Guardar" }));
 await waitFor(() => expect(screen.queryByRole("dialog", { name: "Editar dato" })).not.toBeInTheDocument());
 expect(bodies.slice(1)).toEqual([
  { expectedRevision: 1, name: { es: "Sucursal", en: "Branch" }, type: "Text", sourceCatalogId: null, position: 1, isActive: true, confirmValueRemoval: true },
  { expectedRevision: 1, name: { es: "Sucursal", en: "Branch" }, type: "Text", sourceCatalogId: null, position: 1, isActive: true, confirmValueRemoval: true },
 ]);
});
