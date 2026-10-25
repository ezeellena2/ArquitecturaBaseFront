import { act, cleanup, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { render } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { http, HttpResponse } from "msw";
import type { CurrentUser } from "@/auth/useCurrentUser";
import { AppProviders } from "@/app/providers";
import { queryClient } from "@/shared/api/queryClient";
import i18n from "@/shared/i18n";
import { notify } from "@/shared/ui/notifications";
import { server } from "@/test/mocks/server";
import { proposalCatalog, proposalCatalogId as id, proposalActorId as actor, proposalOptions } from "@/test/mocks/catalogProposal";
import { CatalogEditorPage } from "./CatalogEditorPage";
vi.mock("react-oidc-context", async () => ({ ...await vi.importActual<typeof import("react-oidc-context")>("react-oidc-context"), useAuth: () => ({ isAuthenticated: true, isLoading: false, user: { access_token: "test" } }) }));
vi.mock("@/shared/ui/notifications", async () => ({ ...await vi.importActual<typeof import("@/shared/ui/notifications")>("@/shared/ui/notifications"), notify: vi.fn() }));
const operator = "01990000-0000-7000-8000-000000000022";
let current: ReturnType<typeof proposalCatalog>;
let writes: unknown[];
let discarded: unknown[];
function approved() { return { ...current, isActive: true, revision: current.revision + 1, proposal: { ...current.proposal, state: "Approved", decidedBy: { userId: operator, displayName: "Laura" }, decidedAtUtc: "2026-10-17T13:00:00Z" } }; }
async function mount(permissions = ["formcatalogs.read", "formcatalogs.manage"], culture = "es") {
 await i18n.changeLanguage(culture);
 server.use(http.get("/api/me", () => HttpResponse.json({ id: operator, displayName: "Laura", email: "laura@example.com", emailConfirmed: true, phoneNumber: null, formattedPhoneNumber: null, maskedPhoneNumber: null, phoneNumberConfirmed: false, hasGoogleLogin: false, culture, timeZoneId: "America/Argentina/Buenos_Aires", lastLoginAtUtc: null, roles: [], permissions })),
 http.get("/api/forms/catalogs/" + id, () => HttpResponse.json(current)),
 http.get("/api/forms/catalog-filter-options", () => HttpResponse.json({ ...proposalOptions, sampleUsers: permissions.includes("formcatalogs.manage") ? proposalOptions.sampleUsers : null })),
 http.post("/api/forms/catalog-previews", () => HttpResponse.json({ items: [{ id: actor, text: "Ana Pérez", detail: "Supervisor", canSend: true }], totalCount: 1, exceedsLimit: false })),
 http.post("/api/forms/catalogs/" + id + "/proposal/approve", async ({ request }) => { writes.push(await request.json()); current = approved(); return HttpResponse.json({ catalog: current, itemIdentityMap: {}, fieldIdentityMap: {} }); }),
 http.post("/api/forms/catalogs/" + id + "/proposal/discard", async ({ request }) => { discarded.push(await request.json()); current = { ...current, revision: current.revision + 1, proposal: { ...current.proposal, state: "Discarded", decidedBy: { userId: operator, displayName: "Laura" }, decidedAtUtc: "2026-10-17T13:00:00Z" } }; return HttpResponse.json(current); }));
 const router = createMemoryRouter([{ path: "/catalogos/:catalogId", Component: CatalogEditorPage }, { path: "/catalogos", element: <p>Catalog list</p> }], { initialEntries: ["/catalogos/" + id] });
 await act(async () => { render(<AppProviders><RouterProvider router={router} /></AppProviders>); });
 return router;
}
async function chooseSample() { const input = await screen.findByRole("combobox", { name: "Como si lo recibiera" }); await userEvent.click(input); await userEvent.click(await screen.findByRole("option", { name: "Ana Pérez" })); }
async function rename(value: string) { const input = await screen.findByRole("textbox", { name: "Nombre" }); await userEvent.clear(input); await userEvent.click(input); await userEvent.paste(value); }
beforeEach(async () => { queryClient.clear(); vi.mocked(notify).mockReset(); current = proposalCatalog(); writes = []; discarded = []; await i18n.changeLanguage("es"); });
afterEach(() => { cleanup(); queryClient.clear(); });

it("marks a pending assistant proposal in the existing Filters editor with captured requester and unsupported criteria", async () => {
 await mount(undefined, "en");
 await screen.findByRole("button", { name: "Approve and activate" });
 expect(screen.getByRole("heading", { name: "Supervisores activos" })).toBeInTheDocument();
 expect(screen.getByText(/Ana Pérez.*requested|requested.*Ana Pérez/i)).toBeInTheDocument();
 expect(screen.getByText(/zona norte/)).toBeInTheDocument();
 expect(screen.getByRole("textbox", { name: "Name" })).toHaveAccessibleDescription("Original (Spanish): Supervisores activos");
 expect(screen.queryByText("catalog-profile")).not.toBeInTheDocument();
 expect(screen.queryByText("catalog-instructions")).not.toBeInTheDocument();
 expect(screen.queryByRole("button", { name: "Reactivate" })).not.toBeInTheDocument();
});
it("reviews a proposal in the menu language with its original as reference", async () => {
 await mount(undefined, "en");
 await screen.findByRole("button", { name: "Approve and activate" });
 expect(screen.queryAllByRole("button", { name: /^(Español|Inglés|Spanish|English)\b/ })).toHaveLength(0);
 const name = screen.getByRole("textbox", { name: "Name" }), description = screen.getByRole("textbox", { name: "Description" });
 expect(name).toHaveValue(""); expect(name).toHaveAttribute("placeholder", "Untranslated");
 expect(name).toHaveAccessibleDescription("Original (Spanish): Supervisores activos");
 expect(screen.getByText("Name", { selector: "label" })).toHaveTextContent(/^Name$/);
 expect(description).toHaveValue(""); expect(description).toHaveAccessibleDescription("Original (Spanish): Supervisores disponibles");
 await userEvent.click(name); await userEvent.paste("Active supervisors");
 await userEvent.click(await screen.findByRole("combobox", { name: "As if received by" })); await userEvent.click(await screen.findByRole("option", { name: "Ana Pérez" }));
 await userEvent.click(screen.getByRole("button", { name: "Approve and activate" }));
 await waitFor(() => expect(writes).toHaveLength(1));
 expect(writes[0]).toEqual({ expectedRevision: 1, name: { es: "Supervisores activos", en: "Active supervisors" }, description: { es: "Supervisores disponibles" }, filters: current.filters, sampleUserId: actor });
});
it("approves edited original-language metadata and filters with one revision command and no normal PUT", async () => {
 let normalWrites = 0;
 server.use(http.put("/api/forms/catalogs/" + id + "/filters", () => { normalWrites++; return HttpResponse.json({}); }));
 await mount();
 // Approving does not wait for the sample person: trying it without one marks the person and sends nothing.
 const approve = await screen.findByRole("button", { name: "Aprobar y activar" });
 expect(approve).toBeEnabled();
 await rename("Supervisores revisados"); await userEvent.click(approve);
 const sample = screen.getByRole("combobox", { name: "Como si lo recibiera" });
 await waitFor(() => expect(sample).toHaveFocus()); expect(sample).toHaveAttribute("aria-invalid", "true"); expect(writes).toEqual([]);
 await chooseSample();
 await userEvent.click(screen.getByRole("button", { name: "Aprobar y activar" }));
 await waitFor(() => expect(writes).toHaveLength(1));
 expect(writes[0]).toEqual({ expectedRevision: 1, name: { es: "Supervisores revisados" }, description: { es: "Supervisores disponibles" }, filters: current.filters, sampleUserId: actor });
 await screen.findByRole("button", { name: "Guardar" });
 expect(current.proposal.originalProposal.name).toBe("Supervisores activos");
 expect(normalWrites).toBe(0);
 expect(vi.mocked(notify).mock.calls.filter(([notice]) => notice.kind === "success")).toHaveLength(1);
});
it("cancels discarding at the exact trigger and records an explicit discard without activating the proposal", async () => {
 await mount(); const trigger = await screen.findByRole("button", { name: "Descartar propuesta" });
 await userEvent.click(trigger);
 let dialog = await screen.findByRole("dialog");
 await userEvent.click(within(dialog).getByRole("button", { name: "Cancelar" }));
 expect(trigger).toHaveFocus(); expect(discarded).toEqual([]);
 await userEvent.click(trigger); dialog = await screen.findByRole("dialog");
 await userEvent.click(within(dialog).getByRole("button", { name: "Descartar propuesta" }));
 await waitFor(() => expect(discarded).toEqual([{ expectedRevision: 1 }]));
 await screen.findByText(/Propuesta descartada/);
 expect(screen.queryByRole("button", { name: "Aprobar y activar" })).not.toBeInTheDocument();
 expect(screen.queryByRole("button", { name: "Reactivar" })).not.toBeInTheDocument();
 expect(writes).toEqual([]);
});
it("preserves edits after a conflict and adopts the reread decision only explicitly without another approval", async () => {
 await mount(); server.use(http.post("/api/forms/catalogs/" + id + "/proposal/approve", async ({ request }) => { writes.push(await request.json()); return HttpResponse.json({ code: "Forms.Catalog.RevisionConflict" }, { status: 409 }); }));
 await rename("Mi propuesta"); const draftName = screen.getByRole("textbox", { name: "Nombre" }); await chooseSample(); await userEvent.click(screen.getByRole("button", { name: "Aprobar y activar" }));
 await userEvent.click(await screen.findByRole("button", { name: "Revisar" }));
 current = { ...approved(), name: { es: "Ya aprobado" } };
 const dialog = await screen.findByRole("dialog");
 await userEvent.click(within(dialog).getByRole("button", { name: "Releer" }));
 await within(dialog).findByText("Ya aprobado");
 expect(draftName).toHaveValue("Mi propuesta");
 await userEvent.click(within(dialog).getByRole("button", { name: "Usar la revisión actual" }));
 expect(screen.getByRole("textbox", { name: "Nombre" })).toHaveValue("Ya aprobado");
 expect(writes).toHaveLength(1);
 expect(screen.queryByRole("button", { name: "Aprobar y activar" })).not.toBeInTheDocument();
});
it("keeps an operationally failed edit for one explicit approval retry with its same revision", async () => {
 const actual = await vi.importActual<typeof import("@/shared/ui/notifications")>("@/shared/ui/notifications");
 vi.mocked(notify).mockImplementation(actual.notify);
 await mount(); let count = 0;
 server.use(http.post("/api/forms/catalogs/" + id + "/proposal/approve", async ({ request }) => { writes.push(await request.json()); count++; return count === 1 ? HttpResponse.json({}, { status: 503 }) : HttpResponse.json({ catalog: approved(), itemIdentityMap: {}, fieldIdentityMap: {} }); }));
 await rename("Mi propuesta"); await chooseSample(); await userEvent.click(screen.getByRole("button", { name: "Aprobar y activar" }));
 await waitFor(() => expect(vi.mocked(notify).mock.calls.filter(([notice]) => notice.kind === "error")).toHaveLength(1));
 expect(screen.getByRole("textbox", { name: "Nombre" })).toHaveValue("Mi propuesta");
 expect(writes).toHaveLength(1);
 await userEvent.click(screen.getByRole("button", { name: "Aprobar y activar" }));
 await screen.findByRole("button", { name: "Guardar" });
 expect(writes).toHaveLength(2); expect(writes[1]).toEqual(writes[0]);
 await waitFor(() => expect(document.querySelector('[data-sonner-toast][data-type="success"]')).toHaveTextContent("Catálogo guardado"));
});
it("binds a rejected original-language field without duplicating an operational notice", async () => {
 await mount(); server.use(http.post("/api/forms/catalogs/" + id + "/proposal/approve", () => HttpResponse.json({ code: "Forms.Catalog.ContentInvalid", errors: { "name.es": ["Nombre ocupado"] } }, { status: 400 })));
 await chooseSample(); await userEvent.click(screen.getByRole("button", { name: "Aprobar y activar" }));
 await screen.findByText("Nombre ocupado");
 expect(screen.getByRole("textbox", { name: "Nombre" })).toHaveAttribute("aria-invalid", "true");
 expect(vi.mocked(notify).mock.calls.filter(([notice]) => notice.kind === "error")).toHaveLength(0);
});
it("shows authorized proposal history without write actions or sample identities for Read alone", async () => {
 await mount(["formcatalogs.read"]);
 await screen.findByText(/La pidió Ana Pérez/);
 expect(screen.queryByRole("button", { name: "Aprobar y activar" })).not.toBeInTheDocument();
 expect(screen.queryByRole("button", { name: "Descartar propuesta" })).not.toBeInTheDocument();
 expect(screen.queryByRole("combobox", { name: "Como si lo recibiera" })).not.toBeInTheDocument();
});
it("retires approval controls when Manage is revoked and drops a late confirmed result", async () => {
 await mount(); let resolve!: (value: Response) => void;
 server.use(http.post("/api/forms/catalogs/" + id + "/proposal/approve", () => new Promise<Response>(done => { resolve = done; })));
 await rename("Mi borrador"); await chooseSample(); await userEvent.click(screen.getByRole("button", { name: "Aprobar y activar" }));
 await waitFor(() => expect(resolve).toBeDefined());
 act(() => queryClient.setQueryData<CurrentUser>(["current-user"], previous => previous ? { ...previous, permissions: ["formcatalogs.read"] } : previous));
 await waitFor(() => expect(screen.getByRole("textbox", { name: "Nombre" })).toHaveAttribute("readonly"));
 await act(async () => { resolve(HttpResponse.json({ catalog: approved(), itemIdentityMap: {}, fieldIdentityMap: {} })); });
 expect(screen.getByRole("textbox", { name: "Nombre" })).toHaveValue("Mi borrador");
 expect(screen.getByRole("textbox", { name: "Nombre" })).toHaveAttribute("readonly");
 expect(screen.queryByRole("button", { name: "Aprobar y activar" })).not.toBeInTheDocument();
 expect(vi.mocked(notify).mock.calls.filter(([notice]) => notice.kind === "success")).toHaveLength(0);
});
