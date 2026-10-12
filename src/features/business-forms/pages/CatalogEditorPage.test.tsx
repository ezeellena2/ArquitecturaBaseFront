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
import { CatalogEditorPage } from "./CatalogEditorPage";

vi.mock("react-oidc-context", async () => ({ ...await vi.importActual<typeof import("react-oidc-context")>("react-oidc-context"), useAuth: () => ({ isAuthenticated: true, isLoading: false, user: { access_token: "test" } }) }));
vi.mock("@/shared/ui/notifications", async () => ({ ...await vi.importActual<typeof import("@/shared/ui/notifications")>("@/shared/ui/notifications"), notify: vi.fn() }));
const id = "01990000-0000-7000-8000-000000000020";
const itemId = "01990000-0000-7000-8000-000000000021";
const initial = { id, key: id.replaceAll("-", ""), name: { es: "Clientes", en: "Customers" }, description: { es: "Visitas", en: "Visits" }, kind: "Manual", revision: 1, isActive: true, itemsCount: 1, usageCount: null, unavailableReasonCode: null };
const option = { id: itemId, code: "C1", text: { es: "Pérez", en: null }, detail: { es: null, en: null }, position: 1, isActive: true };
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
afterEach(() => { cleanup(); queryClient.clear(); });
describe("Manual catalog page with synthetic current DTO responses", () => {
  it("creates bilingual metadata and one item in a single request and reloads its canonical identity", async () => {
    setup(); const bodies: Record<string, unknown>[] = [];
    server.use(http.post("/api/forms/catalogs", async ({ request }) => { const body = await request.json() as Record<string, unknown>; bodies.push(body); const items = body.items as { localId: string }[]; return HttpResponse.json({ catalog: initial, itemIdentityMap: { [items[0]!.localId]: itemId } }, { status: 201 }); }));
    const router = await mount("/catalogos/nuevo"); const user = userEvent.setup();
    await user.type(await screen.findByRole("textbox", { name: "Nombre" }), "Clientes");
    await user.type(screen.getByRole("textbox", { name: "Descripción" }), "Visitas");
    await user.click(screen.getByRole("button", { name: "Inglés" }));
    await user.type(screen.getByRole("textbox", { name: "Nombre" }), "Customers");
    await user.type(screen.getByRole("textbox", { name: "Descripción" }), "Visits");
    await user.click(screen.getByRole("button", { name: "Español" }));
    await user.click(screen.getByRole("button", { name: "Agregar opción" }));
    await user.type(screen.getByRole("textbox", { name: "Texto" }), "Pérez");
    await user.type(screen.getByRole("textbox", { name: "Código" }), "C1");
    await user.click(screen.getByRole("button", { name: "Guardar" }));
    await waitFor(() => expect(router.state.location.pathname).toBe("/catalogos/" + id));
    await screen.findByRole("button", { name: "Editar Pérez" });
    expect(bodies).toHaveLength(1);
    expect(bodies[0]).toMatchObject({ name: initial.name, description: initial.description, items: [{ itemId: null, code: "C1", text: { es: "Pérez", en: null }, isActive: true }] });
    expect(bodies[0]).not.toHaveProperty("requestId");
    expect(vi.mocked(notify).mock.calls.filter(([message]) => message.kind === "success")).toHaveLength(1);
  });
  it("updates the existing item code while keeping its identity and submits only the changed row", async () => {
    setup(); const bodies: unknown[] = []; let savedOption = option;
    server.use(http.get("/api/forms/catalogs/" + id + "/items", () => HttpResponse.json({ items: [savedOption], page: 1, pageSize: 20, totalCount: 1, totalPages: 1, hasPrevious: false, hasNext: false })), http.put("/api/forms/catalogs/" + id, async ({ request }) => { const body = await request.json() as { items: { code: string }[] }; bodies.push(body); savedOption = { ...option, code: body.items[0]!.code }; return HttpResponse.json({ catalog: { ...initial, revision: 2 }, itemIdentityMap: {} }); }));
    await mount("/catalogos/" + id); const user = userEvent.setup();
    await user.click(await screen.findByRole("button", { name: "Editar Pérez" }));
    const code = screen.getByRole("textbox", { name: "Código" }); await user.clear(code); await user.type(code, "C2");
    await user.click(screen.getByRole("button", { name: "Guardar" }));
    await waitFor(() => expect(bodies).toHaveLength(1));
    expect(bodies[0]).toMatchObject({ expectedRevision: 1, items: [{ itemId, code: "C2", text: { es: "Pérez", en: null } }] });
    await screen.findByText("C2");
    await user.click(screen.getByRole("button", { name: "Editar Pérez" }));
    expect(screen.getByRole("textbox", { name: "Código" })).toHaveValue("C2");
  });
  it("retains a conflicted draft through reread and requires an explicit adoption without a second write", async () => {
    setup(); let writes = 0;
    server.use(http.put("/api/forms/catalogs/" + id, () => { writes++; return HttpResponse.json({ code: "Forms.Catalog.RevisionConflict" }, { status: 409 }); }));
    await mount("/catalogos/" + id); const user = userEvent.setup();
    const name = await screen.findByRole("textbox", { name: "Nombre" }); await user.clear(name); await user.type(name, "Mi catálogo");
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
  it("allows catalog Read without form template Read and hides all writes without Manage", async () => {
    setup(["formcatalogs.read"]); await mount("/catalogos/" + id);
    expect(await screen.findByRole("textbox", { name: "Nombre" })).toHaveAttribute("readonly");
    await screen.findByText("Pérez");
    expect(screen.queryByRole("button", { name: "Guardar" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Agregar opción" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Editar Pérez" })).not.toBeInTheDocument();
  });
  it("keeps the draft read-only when Manage is revoked while Read remains", async () => {
    setup(); await mount("/catalogos/" + id); const user = userEvent.setup();
    const name = await screen.findByRole("textbox", { name: "Nombre" }); await user.clear(name); await user.type(name, "Borrador conservado");
    act(() => queryClient.setQueryData<CurrentUser>(["current-user"], previous => previous ? ({ ...previous, permissions: ["formcatalogs.read"] }) : previous));
    await waitFor(() => expect(screen.getByRole("textbox", { name: "Nombre" })).toHaveAttribute("readonly"));
    expect(screen.getByRole("textbox", { name: "Nombre" })).toHaveValue("Borrador conservado");
    expect(screen.queryByRole("button", { name: "Guardar" })).not.toBeInTheDocument();
  });
  it("preserves a failed new catalog and allows an explicit retry without a nonexistent resource review", async () => {
    setup(); let calls = 0;
    server.use(http.post("/api/forms/catalogs", async ({ request }) => { calls++; const body = await request.json() as { items: { localId: string }[] }; return calls === 1 ? HttpResponse.json({}, { status: 500 }) : HttpResponse.json({ catalog: { ...initial, itemsCount: 0 }, itemIdentityMap: Object.fromEntries(body.items.map(item => [item.localId, itemId])) }, { status: 201 }); }));
    const router = await mount("/catalogos/nuevo"); const user = userEvent.setup();
    await user.type(await screen.findByRole("textbox", { name: "Nombre" }), "Clientes"); await user.type(screen.getByRole("textbox", { name: "Descripción" }), "Visitas");
    await user.click(screen.getByRole("button", { name: "Inglés" })); await user.type(screen.getByRole("textbox", { name: "Nombre" }), "Customers"); await user.type(screen.getByRole("textbox", { name: "Descripción" }), "Visits");
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
      return HttpResponse.json({ catalog: { ...initial, revision: 2, itemsCount: 2 }, itemIdentityMap: {} });
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
    server.use(http.get("/api/forms/catalogs/" + id + "/items", () => HttpResponse.json({ items: [option, { ...option, id: "01990000-0000-7000-8000-000000000022", code: "C2", text: { es: "López", en: null }, position: 2 }], page: 1, pageSize: 20, totalCount: 2, totalPages: 1, hasPrevious: false, hasNext: false })), http.put("/api/forms/catalogs/" + id, async ({ request }) => { bodies.push(await request.json()); return HttpResponse.json({ catalog: { ...initial, revision: 2 }, itemIdentityMap: {} }); }));
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
    setup(); server.use(http.put("/api/forms/catalogs/" + id, () => HttpResponse.json({ code: "Validation.Failed", errors: { "items[0].code": ["Ingresá un código."], "items[0].text.es": ["Ingresá el texto." ] } }, { status: 400 })));
    await mount("/catalogos/" + id); const user = userEvent.setup();
    await user.click(await screen.findByRole("button", { name: "Editar Pérez" }));
    await user.clear(screen.getByRole("textbox", { name: "Código" }));
    await user.click(screen.getByRole("button", { name: "Listo" }));
    await user.click(screen.getByRole("button", { name: "Guardar" }));
    const code = await screen.findByRole("textbox", { name: "Código" });
    expect(code).toHaveAttribute("aria-invalid", "true");
    expect(code).toHaveAccessibleDescription("Ingresá un código.");
    expect(screen.getByRole("textbox", { name: "Texto" })).toHaveAccessibleDescription("Ingresá el texto.");
    expect(vi.mocked(notify).mock.calls.filter(([message]) => message.kind === "error")).toHaveLength(0);
  });

  it.each(["es", "en"] as const)("translates the pending draft status in %s", async culture => {
    setup(undefined, culture); await i18n.changeLanguage(culture);
    await mount("/catalogos/" + id); const user = userEvent.setup();
    const name = await screen.findByRole("textbox", { name: culture === "es" ? "Nombre" : "Name" });
    await user.clear(name); await user.type(name, "Borrador");
    expect(screen.getByText(culture === "es" ? "Cambios sin guardar" : "Unsaved changes", { exact: true })).toBeInTheDocument();
    expect(screen.queryByText("unsaved", { exact: true })).not.toBeInTheDocument();
  });

});
