import { screen, within } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { beforeAll, beforeEach, expect, it, vi } from "vitest";
import { queryClient } from "@/shared/api/queryClient";
import { initialAppearance } from "@/shared/lib/appearance";
import { server } from "@/test/mocks/server";
import { renderRouteWithProviders, renderWithProviders } from "@/test/utils/renderWithProviders";
import { createFormFixtureStore, fixtureFormId, fixtureLifecycle } from "@/test/visual/formFixtures";
import { FormDeactivationDialog } from "../components/FormDeactivationDialog";
vi.mock("react-oidc-context", async () => ({ ...await vi.importActual<typeof import("react-oidc-context")>("react-oidc-context"), useAuth: () => ({ isAuthenticated: true, isLoading: false, user: { access_token: "test" } }) }));

// SA3-A and SA5 (2026-11-09): «Diseñar formularios» says where each form is completed, and deactivating a form of the app says
// nothing of WhatsApp.
beforeAll(async () => { await import("./FormsPage"); }, 60000);
const presentation = (installedFeatures: string[]) => http.get("/api/settings/presentation", () => HttpResponse.json({ appearance: initialAppearance,
  defaultCulture: "es", defaultTimeZoneId: "America/Argentina/Buenos_Aires", defaultPageSize: 20, installedFeatures }));
const row = (n: number, name: string, appOnly?: true) => ({ id: "01990000-0000-7000-8000-00000000090" + n, name: { es: name }, prefix: "F" + n, questionCount: 6,
  activeVersionNumber: n, displayState: "Published", lastChangedAtUtc: "2026-11-09T12:00:00Z", lastChangedBy: null, canEdit: true, lifecycle: fixtureLifecycle(1),
  ...appOnly ? { appOnly } : {} });
const list = { items: [row(1, "Remito de prueba", true), row(2, "Parte diario de labores")], page: 1, pageSize: 20, totalCount: 2, totalPages: 1, hasPrevious: false, hasNext: false };
const scope = { actorId: "actor", culture: "es" as const, permissions: ["formtemplates.read", "formtemplates.publish"] };
beforeEach(() => {
  queryClient.clear();
  const store = createFormFixtureStore("es");
  // The list goes before the store: within one `use`, the first handler that matches answers.
  server.use(http.get("/api/forms/definitions", () => HttpResponse.json(list)), http.all("/api/forms/*", ({ request }) => store.handle(request)),
    http.get("/api/me", () => HttpResponse.json({ id: "actor", displayName: "Ana", email: "ana@example.com", emailConfirmed: true, phoneNumber: null, formattedPhoneNumber: null, maskedPhoneNumber: null, phoneNumberConfirmed: false, hasGoogleLogin: false, culture: "es", timeZoneId: "America/Argentina/Buenos_Aires", lastLoginAtUtc: null, roles: [], permissions: ["formtemplates.read"] })));
});
const cellUnder = (table: HTMLElement, name: string, header: string) => {
  const index = within(table).getAllByRole("columnheader").findIndex(cell => cell.textContent === header);
  expect(index, header).toBeGreaterThanOrEqual(0);
  return within(within(table).getByRole("link", { name }).closest("tr")!).getAllByRole("cell")[index]!;
};

it("says where each form is completed in a column of its own", async () => {
  server.use(presentation(["forms", "form-channels"]));
  renderRouteWithProviders("/formularios");
  const table = await screen.findByRole("table", {}, { timeout: 10000 });
  await within(table).findByRole("link", { name: "Remito de prueba" });
  expect(cellUnder(table, "Remito de prueba", "Dónde se completa")).toHaveTextContent(/^Sólo en la app$/);
  expect(cellUnder(table, "Parte diario de labores", "Dónde se completa")).toHaveTextContent(/^En la app y por WhatsApp$/);
  expect(cellUnder(table, "Remito de prueba", "Estado")).toHaveTextContent(/^Publicado$/);
});

it("has no column of where without a form channel (SA5)", async () => {
  server.use(presentation(["forms"]));
  renderRouteWithProviders("/formularios");
  const table = await screen.findByRole("table", {}, { timeout: 10000 });
  await within(table).findByRole("link", { name: "Remito de prueba" });
  expect(within(table).queryByRole("columnheader", { name: "Dónde se completa" })).not.toBeInTheDocument();
});

it("deactivating a form published only in the app says nothing of the chat or the assistant", async () => {
  server.use(presentation(["forms", "form-channels"]), http.get("/api/forms/definitions/:id/deactivation", () => HttpResponse.json({ definitionId: fixtureFormId, revision: 1,
    lifecycle: fixtureLifecycle(1, { canDeactivate: true, unavailableReason: null, publishedOnlyInApp: true }), affectedSuggestions: [] })));
  renderWithProviders(<FormDeactivationDialog id={fixtureFormId} name="Remito de prueba" scope={scope} onComplete={vi.fn()} onObserved={vi.fn()} onClose={vi.fn()} />);
  const dialog = await screen.findByRole("dialog");
  expect(await within(dialog).findByText("Lo que se conserva")).toBeInTheDocument();
  for (const text of ["Qué deja de pasar", "No se manda más desde el chat", "El asistente no lo ofrece"]) expect(within(dialog).queryByText(text)).not.toBeInTheDocument();
});
