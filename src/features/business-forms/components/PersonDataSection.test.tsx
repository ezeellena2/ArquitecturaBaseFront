import { act, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HttpResponse, http } from "msw";
import { expect, it, vi } from "vitest";
import { renderWithProviders } from "@/test/utils/renderWithProviders";
import { currentUser } from "@/test/mocks/handlers";
import { server } from "@/test/mocks/server";
import type { UserDataSaveState } from "@/shared/hooks/userDataSectionContext";
import { PersonDataSection } from "./PersonDataSection";
vi.mock("react-oidc-context", async () => { const actual = await vi.importActual<typeof import("react-oidc-context")>("react-oidc-context"); return { ...actual, useAuth: () => ({ isAuthenticated: true, isLoading: false, user: { access_token: "t" } }) }; });
// The list of a catalog datum opens with the keyboard, like the other Radix lists in the tests.
async function openList(name: string) {
 const trigger = await screen.findByRole("button", { name });
 await act(async () => { trigger.focus(); });
 await userEvent.keyboard("{Enter}");
 return screen.findByRole("listbox");
}
it("selects source options with UsersManage alone and reports a failed independent save in Data", async () => {
 const id = "01990000-0000-7000-8000-000000000001", userId = "01990000-0000-7000-8000-000000000002", source = "01990000-0000-7000-8000-000000000003", center = "01990000-0000-7000-8000-000000000004", north = "01990000-0000-7000-8000-000000000005";
 const writes: unknown[] = []; let catalogReads = 0;
 server.use(http.get("/api/me", () => HttpResponse.json({ ...currentUser, permissions: ["users.manage"] })), http.get("/api/forms/person-attributes", () => HttpResponse.json({ items: [{ id, key: "zone", name: { es: "Zona" }, originalCulture: "es", type: "Catalog", sourceCatalogId: source, sourceCatalogName: "Zonas", position: 0, isActive: true, revision: 1, usedBy: [] }] })), http.get(`/api/forms/person-data/${userId}`, () => HttpResponse.json({ userId, revision: 3, values: { [id]: { value: center, text: "Centro" } } })), http.get(`/api/forms/person-attributes/${id}/options`, () => HttpResponse.json({ items: [{ id: center, text: "Centro" }, { id: north, text: "Norte" }], page: 1, pageSize: 50, totalCount: 2, totalPages: 1, hasPrevious: false, hasNext: false })), http.get("/api/forms/catalogs", () => { catalogReads++; return new HttpResponse(null, { status: 403 }); }), http.put(`/api/forms/person-data/${userId}`, async ({ request }) => { writes.push(await request.json()); return HttpResponse.json({ code: "Unexpected.Error", traceId: "test" }, { status: 500 }); }));
 let state: UserDataSaveState | null = null;
 await act(async () => { renderWithProviders(<PersonDataSection userId={userId} disabled={false} userSaved onState={next => { state = next; }} />); });
 const list = await openList("Zona Centro");
 expect(within(list).getByRole("option", { name: "Centro" })).toHaveAttribute("aria-selected", "true");
 await userEvent.click(await within(list).findByRole("option", { name: "Norte" }));
 expect(await screen.findByRole("button", { name: "Zona Norte" })).toBeInTheDocument();
 await waitFor(() => expect(state?.dirty).toBe(true));
 await act(async () => expect(await state!.save()).toBe(false));
 expect(writes).toEqual([{ expectedRevision: 3, values: { [id]: north } }]);
 expect(screen.getByRole("alert")).toHaveTextContent("No se pudieron guardar los datos. Probá de nuevo. El resto del usuario ya se guardó.");
 expect(catalogReads).toBe(0);
});
it("names the values of attributes named only in the other language with that name", async () => {
 const zone = "01990000-0000-7000-8000-000000000001", branch = "01990000-0000-7000-8000-000000000006", userId = "01990000-0000-7000-8000-000000000002", source = "01990000-0000-7000-8000-000000000003";
 const attribute = { originalCulture: "en", isActive: true, revision: 1, usedBy: [] };
 server.use(http.get("/api/me", () => HttpResponse.json({ ...currentUser, permissions: ["users.manage"] })), http.get("/api/forms/person-attributes", () => HttpResponse.json({ items: [{ ...attribute, id: zone, key: "zone", name: { en: "Zone" }, type: "Catalog", sourceCatalogId: source, sourceCatalogName: "Zones", position: 0 }, { ...attribute, id: branch, key: "branch", name: { en: "Branch" }, type: "Text", sourceCatalogId: null, sourceCatalogName: null, position: 1 }] })), http.get(`/api/forms/person-data/${userId}`, () => HttpResponse.json({ userId, revision: 1, values: {} })), http.get(`/api/forms/person-attributes/${zone}/options`, () => HttpResponse.json({ items: [], page: 1, pageSize: 50, totalCount: 0, totalPages: 0, hasPrevious: false, hasNext: false })));
 await act(async () => { renderWithProviders(<PersonDataSection userId={userId} disabled={false} userSaved={false} onState={vi.fn()} />); });
 expect(await screen.findByRole("button", { name: "Zone Sin zone" })).toBeInTheDocument();
 expect(screen.getByRole("textbox", { name: "Branch" })).toBeInTheDocument();
});

// Every wait shows itself (2026-10-31): the options of a catalog datum say inside their list that they are being searched, that
// they failed and that a retry searches again, and reloading the data waits in its confirmation.
const waitIds = { zone: "01990000-0000-7000-8000-000000000011", user: "01990000-0000-7000-8000-000000000012", source: "01990000-0000-7000-8000-000000000013", center: "01990000-0000-7000-8000-000000000014", north: "01990000-0000-7000-8000-000000000015" };
function serveSection(options: (search: string, call: number, params: URLSearchParams) => Response | Promise<Response>, data: (call: number) => Response | Promise<Response> = () => HttpResponse.json({ userId: waitIds.user, revision: 3, values: { [waitIds.zone]: { value: waitIds.center, text: "Centro" } } })) {
 let optionCalls = 0, dataCalls = 0;
 const writes: unknown[] = [];
 server.use(http.get("/api/me", () => HttpResponse.json({ ...currentUser, permissions: ["users.manage"] })),
  http.get("/api/forms/person-attributes", () => HttpResponse.json({ items: [{ id: waitIds.zone, key: "zone", name: { es: "Zona" }, originalCulture: "es", type: "Catalog", sourceCatalogId: waitIds.source, sourceCatalogName: "Zonas", position: 0, isActive: true, revision: 1, usedBy: [] }] })),
  http.get(`/api/forms/person-data/${waitIds.user}`, () => data(++dataCalls)),
  http.get(`/api/forms/person-attributes/${waitIds.zone}/options`, ({ request }) => { const params = new URL(request.url).searchParams; return options(params.get("search") ?? "", ++optionCalls, params); }),
  http.put(`/api/forms/person-data/${waitIds.user}`, async ({ request }) => { writes.push(await request.json()); return HttpResponse.json({ code: "Unexpected.Error", traceId: "test" }, { status: 500 }); }));
 return { writes };
}
const optionsPage = (items: { id: string; text: string }[], page = 1, totalCount = items.length) => HttpResponse.json({ items, page, pageSize: 50, totalCount, totalPages: Math.ceil(totalCount / 50), hasPrevious: page > 1, hasNext: page * 50 < totalCount });

it("says it is searching in the open list while the options load, and that none matches", async () => {
 let release!: () => void; const gate = new Promise<void>(resolve => { release = resolve; });
 serveSection(async search => { if (search) { await gate; return optionsPage([]); } return optionsPage([{ id: waitIds.center, text: "Centro" }]); });
 await act(async () => { renderWithProviders(<PersonDataSection userId={waitIds.user} disabled={false} userSaved={false} onState={vi.fn()} />); });
 await openList("Zona Centro");
 await userEvent.type(screen.getByRole("combobox", { name: "Buscar en Zona" }), "zzz");
 expect(await screen.findByRole("status", { name: "Buscando…" })).toBeInTheDocument();
 await act(async () => release());
 expect(await screen.findByText("Ninguna opción coincide con «zzz».")).toBeInTheDocument();
});

it("says in the open list that the options failed, and searches again after Retry", async () => {
 let release!: () => void; const gate = new Promise<void>(resolve => { release = resolve; });
 serveSection(async (_search, call) => { if (call === 1) return HttpResponse.json({ code: "Unexpected.Error" }, { status: 500 }); await gate; return optionsPage([{ id: waitIds.center, text: "Centro" }, { id: waitIds.north, text: "Norte" }]); });
 await act(async () => { renderWithProviders(<PersonDataSection userId={waitIds.user} disabled={false} userSaved={false} onState={vi.fn()} />); });
 const list = await openList("Zona Centro");
 expect(await screen.findByText("No se pudieron traer las opciones.")).toBeInTheDocument();
 await userEvent.click(screen.getByRole("button", { name: "Reintentar" }));
 expect(await screen.findByRole("status", { name: "Buscando…" })).toBeInTheDocument();
 await act(async () => release());
 expect(await within(list).findByRole("option", { name: "Norte" })).toBeInTheDocument();
 expect(screen.queryByRole("status", { name: "Buscando…" })).not.toBeInTheDocument();
 expect(screen.queryByRole("button", { name: "Reintentar" })).not.toBeInTheDocument();
});

it("asks for the options only while the list is open, fifty at a time, and brings fifty more", async () => {
 const fifty = Array.from({ length: 50 }, (_, index) => ({ id: `01990000-0000-7000-8000-0000000002${String(index).padStart(2, "0")}`, text: `Zona ${index + 1}` }));
 const asked: string[] = [];
 serveSection((_search, _call, params) => { asked.push(`${params.get("page")}/${params.get("pageSize")}`); return params.get("page") === "1" ? optionsPage(fifty, 1, 51) : optionsPage([{ id: waitIds.north, text: "Norte" }], 2, 51); });
 await act(async () => { renderWithProviders(<PersonDataSection userId={waitIds.user} disabled={false} userSaved={false} onState={vi.fn()} />); });
 expect(await screen.findByRole("button", { name: "Zona Centro" })).toBeInTheDocument();
 expect(asked).toEqual([]);
 const list = await openList("Zona Centro");
 expect(await screen.findByText("51 opciones")).toBeInTheDocument();
 expect(asked).toEqual(["1/50"]);
 await userEvent.click(screen.getByRole("button", { name: "Mostrar 50 más" }));
 expect(await within(list).findByRole("option", { name: "Norte" })).toBeInTheDocument();
 expect(asked).toEqual(["1/50", "2/50"]);
 expect(screen.queryByRole("button", { name: "Mostrar 50 más" })).not.toBeInTheDocument();
});

it("clears the value with «Sin zona», the first option", async () => {
 const { writes } = serveSection(() => optionsPage([{ id: waitIds.center, text: "Centro" }, { id: waitIds.north, text: "Norte" }]));
 let state: UserDataSaveState | null = null;
 await act(async () => { renderWithProviders(<PersonDataSection userId={waitIds.user} disabled={false} userSaved onState={next => { state = next; }} />); });
 const list = await openList("Zona Centro");
 const first = within(list).getAllByRole("option")[0];
 expect(first).toHaveAccessibleName("Sin zona");
 expect(first).toHaveAttribute("aria-selected", "false");
 await userEvent.click(first);
 expect(await screen.findByRole("button", { name: "Zona Sin zona" })).toBeInTheDocument();
 await waitFor(() => expect(state?.dirty).toBe(true));
 await act(async () => { await state!.save(); });
 expect(writes).toEqual([{ expectedRevision: 3, values: { [waitIds.zone]: null } }]);
});

it("keeps the reload confirmation open with «Volviendo a cargar…» until the data arrive", async () => {
 let release!: () => void; const gate = new Promise<void>(resolve => { release = resolve; });
 const saved = () => HttpResponse.json({ userId: waitIds.user, revision: 3, values: { [waitIds.zone]: { value: waitIds.center, text: "Centro" } } });
 serveSection(() => optionsPage([{ id: waitIds.center, text: "Centro" }, { id: waitIds.north, text: "Norte" }]), async call => { if (call > 1) await gate; return saved(); });
 let state: UserDataSaveState | null = null;
 await act(async () => { renderWithProviders(<PersonDataSection userId={waitIds.user} disabled={false} userSaved onState={next => { state = next; }} />); });
 const list = await openList("Zona Centro");
 await userEvent.click(await within(list).findByRole("option", { name: "Norte" }));
 await waitFor(() => expect(state?.dirty).toBe(true));
 await act(async () => { await state!.save(); });
 await userEvent.click(await screen.findByRole("button", { name: "Volver a cargar los datos" }));
 const dialog = await screen.findByRole("dialog", { name: "Volver a cargar los datos" });
 await userEvent.click(within(dialog).getByRole("button", { name: "Volver a cargar los datos" }));
 const working = await within(dialog).findByRole("button", { name: "Volviendo a cargar…" });
 expect(working).toHaveAttribute("aria-busy", "true");
 await act(async () => release());
 await waitFor(() => expect(screen.queryByRole("dialog", { name: "Volver a cargar los datos" })).not.toBeInTheDocument());
 expect(screen.queryByRole("alert")).not.toBeInTheDocument();
});
