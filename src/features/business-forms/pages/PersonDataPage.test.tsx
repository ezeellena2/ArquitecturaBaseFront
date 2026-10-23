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
async function mount(permissions: string[]) {
 let reads = 0;
 server.use(http.get("/api/me", () => HttpResponse.json({ ...currentUser, permissions })), http.get("/api/forms/person-attributes", () => HttpResponse.json({ items: [attribute] })), http.get("/api/forms/person-data", () => { reads++; return HttpResponse.json(people); }));
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
