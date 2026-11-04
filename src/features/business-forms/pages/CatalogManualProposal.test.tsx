import { act, cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createMemoryRouter, RouterProvider } from "react-router";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { http, HttpResponse } from "msw";
import { AppProviders } from "@/app/providers";
import { queryClient } from "@/shared/api/queryClient";
import i18n from "@/shared/i18n";
import { notify } from "@/shared/ui/notifications";
import { server } from "@/test/mocks/server";
import { CatalogEditorPage } from "./CatalogEditorPage";
vi.mock("react-oidc-context", async () => ({ ...await vi.importActual<typeof import("react-oidc-context")>("react-oidc-context"), useAuth: () => ({ isAuthenticated: true, isLoading: false, user: { access_token: "test" } }) }));
vi.mock("@/shared/ui/notifications", async () => ({ ...await vi.importActual<typeof import("@/shared/ui/notifications")>("@/shared/ui/notifications"), notify: vi.fn() }));
const id = "01990000-0000-7000-8000-000000000060";
const requester = "01990000-0000-7000-8000-000000000061";
const operator = "01990000-0000-7000-8000-000000000062";
const check = { cultures: (["es", "en"] as const).map(culture => ({ culture, titleTooLongCount: 0, titleExamples: [], descriptionTooLongCount: 0, descriptionExamples: [] })) };
// A Manual catalog the Home assistant proposed (IA2): inactive and pending, with what it proposed and where it was asked.
function pending() {
  return { valueType: "Text", id, key: id.replaceAll("-", ""), name: { es: "Transportistas" }, description: { es: "Empresas que traen la carga" }, kind: "Manual", revision: 1,
    isActive: false, itemsCount: 0, usageCount: null, originalCulture: "es", unavailableReasonCode: null, filters: null, fields: [], presentation: null, presentationCheck: check,
    proposal: { state: "Pending" as "Pending" | "Approved" | "Discarded", originalCulture: "es", requestedBy: { userId: requester, displayName: "Ana Pérez" }, requestedAtUtc: "2026-11-03T13:00:00Z",
      decidedBy: null as { userId: string; displayName: string } | null, decidedAtUtc: null as string | null,
      provenance: { modelProfileId: "fictitious-profile", modelProfileVersion: 3, instructionsId: "home-system", instructionsVersion: 2, occurredAtUtc: "2026-11-03T13:00:00Z", channelId: "home" },
      manual: { culture: "es", name: "Transportistas", description: "Empresas que traen la carga", valueType: "text", code: "CUIT", option: "Razón social", fields: [] }, requestedIn: "app" } };
}
let current: ReturnType<typeof pending>;
let approvals: unknown[];
let discards: unknown[];
async function mount() {
  const decided = (state: "Approved" | "Discarded") => ({ ...current, revision: current.revision + 1, isActive: state === "Approved",
    proposal: { ...current.proposal, state, decidedBy: { userId: operator, displayName: "Laura" }, decidedAtUtc: "2026-11-04T13:00:00Z" } });
  server.use(http.get("/api/me", () => HttpResponse.json({ id: operator, displayName: "Laura", email: "laura@example.com", emailConfirmed: true, phoneNumber: null, formattedPhoneNumber: null, maskedPhoneNumber: null, phoneNumberConfirmed: false, hasGoogleLogin: false, culture: "es", timeZoneId: "America/Argentina/Buenos_Aires", lastLoginAtUtc: null, roles: [], permissions: ["formcatalogs.read", "formcatalogs.manage"] })),
    http.get("/api/forms/catalogs/" + id, () => HttpResponse.json(current)),
    http.get("/api/forms/catalogs/" + id + "/items", () => HttpResponse.json({ items: [], page: 1, pageSize: 20, totalCount: 0, totalPages: 0, hasPrevious: false, hasNext: false })),
    http.post("/api/forms/catalogs/" + id + "/proposal/approve", async ({ request }) => { approvals.push(await request.json()); current = decided("Approved"); return HttpResponse.json({ catalog: current, itemIdentityMap: {}, fieldIdentityMap: {} }); }),
    http.post("/api/forms/catalogs/" + id + "/proposal/discard", async ({ request }) => { discards.push(await request.json()); current = decided("Discarded"); return HttpResponse.json(current); }));
  const router = createMemoryRouter([{ path: "/catalogos/:catalogId", Component: CatalogEditorPage }, { path: "/catalogos", element: <p>Catálogos</p> }], { initialEntries: ["/catalogos/" + id] });
  await act(async () => { render(<AppProviders><RouterProvider router={router} /></AppProviders>); });
}
beforeEach(async () => { queryClient.clear(); vi.mocked(notify).mockReset(); current = pending(); approvals = []; discards = []; await i18n.changeLanguage("es"); });
afterEach(() => { cleanup(); queryClient.clear(); });

it("marks a Manual proposal asked in the Home chat and approves it as it is, without a sample person", async () => {
  await mount();
  const approve = await screen.findByRole("button", { name: "Aprobar y activar" });
  expect(screen.getByText(/La pidió Ana Pérez en el chat de Inicio/)).toBeInTheDocument();
  expect(screen.getByText("Propuesta del asistente", { selector: "span" })).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Reactivar" })).not.toBeInTheDocument();
  await userEvent.click(approve);
  expect(await screen.findByText(/La resolvió Laura/)).toBeInTheDocument();
  expect(approvals).toEqual([{ expectedRevision: 1 }]);
  expect(notify).toHaveBeenCalledWith(expect.objectContaining({ kind: "success", message: "Propuesta aprobada: el catálogo quedó activo." }));
  expect(screen.queryByRole("button", { name: "Aprobar y activar" })).not.toBeInTheDocument();
});

it("discards a Manual proposal after confirming, and it stays inactive", async () => {
  await mount();
  await userEvent.click(await screen.findByRole("button", { name: "Descartar propuesta" }));
  const dialog = await screen.findByRole("dialog", { name: "¿Descartar esta propuesta?" });
  await userEvent.click(within(dialog).getByRole("button", { name: "Descartar propuesta" }));
  expect(await screen.findByText(/Propuesta descartada\./)).toBeInTheDocument();
  expect(discards).toEqual([{ expectedRevision: 1 }]);
  expect(screen.queryByRole("button", { name: "Reactivar" })).not.toBeInTheDocument();
});
