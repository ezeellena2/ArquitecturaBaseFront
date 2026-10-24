import { MemoryRouter } from "react-router";
import { act, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HttpResponse, http } from "msw";
import { expect, it, vi } from "vitest";
import { renderWithProviders } from "@/test/utils/renderWithProviders";
import { server } from "@/test/mocks/server";
import { currentUser } from "@/test/mocks/handlers";
import { PersonDataPage } from "./PersonDataPage";
vi.mock("react-oidc-context", async () => { const actual = await vi.importActual<typeof import("react-oidc-context")>("react-oidc-context"); return { ...actual, useAuth: () => ({ isAuthenticated: true, isLoading: false, user: { access_token: "t" } }) }; });
const id = "01990000-0000-7000-8000-000000000001", userId = "01990000-0000-7000-8000-000000000002";
const attribute = { id, key: "branch", name: { es: "Sucursal", en: "Branch" }, type: "Text", sourceCatalogId: null, sourceCatalogName: null, position: 1, isActive: true, revision: 1, usedBy: [] };
const people = { items: [{ userId, displayName: "Juan Gómez", values: { [id]: { value: "Centro", text: "Centro" } } }], page: 1, pageSize: 20, totalCount: 1, totalPages: 1, hasPrevious: false, hasNext: false };
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
it("keeps attribute administration available without requesting people who cannot be read", async () => {
 const reads = await mount(["formpersondata.manage"]);
 expect(await screen.findByText("Sucursal")).toBeInTheDocument();
 expect(screen.getByText("Para ver las personas necesitás Ver usuarios.")).toBeInTheDocument();
 expect(reads()).toBe(0);
 expect(screen.queryByText("Juan Gómez")).not.toBeInTheDocument();
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
