import { QueryObserver } from "@tanstack/react-query";
import { act, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { afterEach, beforeAll, beforeEach, expect, it, vi } from "vitest";
import { queryClient } from "@/shared/api/queryClient";
import { server } from "@/test/mocks/server";
import { renderRouteWithProviders } from "@/test/utils/renderWithProviders";
import { createFormFixtureStore, fixtureFormId, fixtureLifecycle } from "@/test/visual/formFixtures";
import { fetchFormMenu, type FormMenu } from "../api/folders";
import { shapeFormMenu } from "../formMenu";
import { folderScopeKey } from "../hooks/useFormFolders";

vi.mock("react-oidc-context", async () => ({ ...await vi.importActual<typeof import("react-oidc-context")>("react-oidc-context"), useAuth: () => ({ isAuthenticated: true, isLoading: false, user: { access_token: "test" } }) }));
// The first test of a file pays the editor's lazy route; loading it beforehand keeps that wait out of the tests under load.
beforeAll(async () => { await import("./FormEditorPage"); }, 60000);

// Decision 13 (CM6): publishing, deactivating, reactivating or deleting a form reads the side menu again, so with a folder's
// panel open the form comes or goes by itself. The menu's reading is observed as the open panel does, with the key and the
// fetch of `useFormMenu`; what it shows goes through `shapeFormMenu`, as in the side menu. Synthetic menu and store: the HTTP
// contract tests consume the backend captures separately.
const permissions = ["formtemplates.read", "formtemplates.manage", "formtemplates.publish", "formrecords.read"];
const delivery = "0199a0c0-0000-7000-8000-0000000000f2";
const menuOf = (active: boolean): FormMenu => ({ canManage: true, menus: [{ folderId: delivery, name: "Repartos", icon: "truck", revision: 1, catalogCount: 0,
  forms: active ? [{ id: fixtureFormId, name: "Registrar visita" }] : [], groups: [] }] });
type Store = ReturnType<typeof createFormFixtureStore>;
let stopMenu: (() => void) | undefined;
afterEach(() => { stopMenu?.(); stopMenu = undefined; vi.useRealTimers(); });
beforeEach(() => { queryClient.clear(); });

function setup(scenario: string, active: (store: Store) => boolean) {
  const store = createFormFixtureStore("es", scenario);
  const reads = vi.fn();
  server.use(http.all("/api/forms/*", ({ request }) => store.handle(request)), http.get("/api/me", () => HttpResponse.json({ id: "actor", displayName: "Ana", email: "ana@example.com", emailConfirmed: true, phoneNumber: null, formattedPhoneNumber: null, maskedPhoneNumber: null, phoneNumberConfirmed: false, hasGoogleLogin: false, culture: "es", timeZoneId: "America/Argentina/Buenos_Aires", lastLoginAtUtc: null, roles: [], permissions })));
  server.use(http.get("/api/forms/menu", () => { reads(); return HttpResponse.json(menuOf(active(store))); }));
  const observer = new QueryObserver(queryClient, { queryKey: [...folderScopeKey({ actorId: "actor", culture: "es", permissions }), "menu"], queryFn: ({ signal }) => fetchFormMenu(signal) });
  stopMenu = observer.subscribe(() => {});
  const shown = () => { const data = observer.getCurrentResult().data; return data ? shapeFormMenu(data, permissions).menus[0]?.links.map(link => link.label) : undefined; };
  return { store, reads, shown };
}
// The fixture does not end a publication by itself and gives every one the same operation: the server ends it with an
// operation of its own and, for a reactivation, the form is active again.
const reactivation = "01990000-0000-7000-8000-0000000000b0";
type Publication = { versionNumber: number; state: string; operationId: string };
const own = (body: Publication) => body.versionNumber > 1 ? { ...body, operationId: reactivation } : body;
function endPublications(store: Store, ended: () => void) {
  server.use(
    http.post("/api/forms/definitions/:id/publications", async ({ request }) => {
      const response = (await store.handle(request))!;
      return HttpResponse.json(own(await response.json() as Publication), { status: response.status });
    }),
    http.get("/api/forms/definitions/:id/publications/:requestId", async ({ request }) => {
      const body = own(await (await store.handle(request))!.json() as Publication);
      if (body.state === "Published") return HttpResponse.json(body);
      ended();
      return HttpResponse.json({ ...body, state: "Published", stage: "Complete" });
    }));
}
async function openEditorMenu() {
  await screen.findByLabelText("Nombre");
  const menu = screen.getByRole("button", { name: "Acciones del formulario" });
  act(() => menu.focus()); await userEvent.keyboard("{Enter}");
  return screen.findByRole("menu");
}

it.each(["row", "editor"] as const)("reads the menu again when a form is deactivated from the %s, and the form leaves it", async source => {
  const { reads, shown } = setup("forms-lifecycle", store => store.definitions.has(fixtureFormId) && !store.lifecycles.get(fixtureFormId)?.deactivatedAtUtc);
  await waitFor(() => expect(shown()).toEqual(["Registrar visita"]));
  renderRouteWithProviders(source === "row" ? "/formularios" : "/formularios/" + fixtureFormId);
  if (source === "row") await userEvent.click(await screen.findByRole("button", { name: "Dar de baja Registrar visita" }, { timeout: 20_000 }));
  else await userEvent.click(within(await openEditorMenu()).getByRole("menuitem", { name: /Dar de baja/ }));
  const dialog = await screen.findByRole("dialog", { name: "Dar de baja «Registrar visita»" });
  const before = reads.mock.calls.length;
  await userEvent.click(await within(dialog).findByRole("button", { name: "Dar de baja" }));
  await waitFor(() => expect(reads.mock.calls.length).toBeGreaterThan(before));
  await waitFor(() => expect(shown()).toEqual([]));
}, 30_000);

it.each(["row", "editor"] as const)("reads the menu again when a form is deleted from the %s, and the form leaves it", async source => {
  const { store, reads, shown } = setup("forms-lifecycle", store => store.definitions.has(fixtureFormId));
  store.lifecycles.set(fixtureFormId, fixtureLifecycle(1, { canDelete: true, deletionUnavailableReason: null }));
  await waitFor(() => expect(shown()).toEqual(["Registrar visita"]));
  renderRouteWithProviders(source === "row" ? "/formularios" : "/formularios/" + fixtureFormId);
  if (source === "row") await userEvent.click(await screen.findByRole("button", { name: "Eliminar Registrar visita" }, { timeout: 20_000 }));
  else await userEvent.click(within(await openEditorMenu()).getByRole("menuitem", { name: /Eliminar/ }));
  const dialog = await screen.findByRole("dialog", { name: "Eliminar «Registrar visita»" });
  const before = reads.mock.calls.length;
  await userEvent.click(within(dialog).getByRole("button", { name: "Eliminar formulario" }));
  await waitFor(() => expect(store.definitions.has(fixtureFormId)).toBe(false));
  await waitFor(() => expect(reads.mock.calls.length).toBeGreaterThan(before));
  await waitFor(() => expect(shown()).toEqual([]));
}, 30_000);

// Publishing only happens in the editor.
it("reads the menu again when a publication of the editor ends, and the form enters it", async () => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  let published = false;
  const { store, reads, shown } = setup("forms-publication-progress", () => published);
  endPublications(store, () => { published = true; });
  await waitFor(() => expect(shown()).toEqual([]));
  renderRouteWithProviders("/formularios/" + fixtureFormId);
  await userEvent.click(await screen.findByRole("button", { name: "Publicar en WhatsApp" }, { timeout: 20_000 }));
  const dialog = await screen.findByRole("dialog", { name: "Publicar la versión 1 en WhatsApp" });
  await userEvent.click(await within(dialog).findByRole("button", { name: "Publicar versión 1" }));
  await screen.findByText("Publicando · versión 1", { exact: true });
  const before = reads.mock.calls.length;
  await act(() => vi.advanceTimersByTimeAsync(30_000));
  await screen.findByText("Publicado · versión 1", { exact: true });
  await waitFor(() => expect(reads.mock.calls.length).toBeGreaterThan(before));
  await waitFor(() => expect(shown()).toEqual(["Registrar visita"]));
}, 30_000);

// Reactivating from a row opens the editor with its check (BA1-A), where the new version is accepted.
it.each(["row", "editor"] as const)("reads the menu again when a reactivation from the %s ends, and the form enters it again", async source => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  const { store, reads, shown } = setup("forms-lifecycle-deactivated", store => !store.lifecycles.get(fixtureFormId)?.deactivatedAtUtc);
  endPublications(store, () => { store.lifecycles.delete(fixtureFormId); });
  await waitFor(() => expect(shown()).toEqual([]));
  renderRouteWithProviders(source === "row" ? "/formularios?publicationFilter=Deactivated" : "/formularios/" + fixtureFormId);
  if (source === "row") await userEvent.click(await screen.findByRole("button", { name: "Reactivar Registrar visita" }, { timeout: 20_000 }));
  else { await screen.findByLabelText("Nombre", {}, { timeout: 20_000 }); await userEvent.click(screen.getByRole("button", { name: "Reactivar" })); }
  const dialog = await screen.findByRole("dialog", { name: "Reactivar «Registrar visita»" }, { timeout: 20_000 });
  await userEvent.click(await within(dialog).findByRole("button", { name: "Reactivar con la versión 2" }));
  await waitFor(() => expect(store.calls.filter(call => call.method === "POST" && call.path.endsWith("/publications"))).toHaveLength(1));
  const before = reads.mock.calls.length;
  await act(() => vi.advanceTimersByTimeAsync(30_000));
  await waitFor(() => expect(reads.mock.calls.length).toBeGreaterThan(before));
  await waitFor(() => expect(shown()).toEqual(["Registrar visita"]));
}, 30_000);
