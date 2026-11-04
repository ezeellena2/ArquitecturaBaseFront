import { act, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { beforeEach, expect, it, vi } from "vitest";
import { queryClient } from "@/shared/api/queryClient";
import i18n from "@/shared/i18n";
import { currentUser } from "@/test/mocks/handlers";
import { server } from "@/test/mocks/server";
import { renderRouteWithProviders } from "@/test/utils/renderWithProviders";
import { createFormFixtureStore } from "@/test/visual/formFixtures";
vi.mock("react-oidc-context", async () => ({ ...await vi.importActual<typeof import("react-oidc-context")>("react-oidc-context"), useAuth: () => ({ isAuthenticated: true, isLoading: false, user: { access_token: "test" } }) }));
// «Armar con la IA» (IA4): the request begun travels in the navigation state to a new Home conversation, never in the URL.
const topic = { id: "11111111-1111-4111-8111-111111111111", revision: 2, name: "Reclamos de clientes", description: "Dejar asentado qué pasó y qué pide.", originalCulture: "es",
  requestCount: 5, personCount: 3, lastRequestedAtUtc: "2026-10-17T12:00:00Z", state: "Pending", discardedBy: null, discardedAtUtc: null };
const empty = { items: [], page: 1, pageSize: 20, totalCount: 0, totalPages: 0, hasPrevious: false, hasNext: false };
function setup(permissions: string[], features = ["forms", "assistant"]) {
  const store = createFormFixtureStore("es", "");
  server.use(http.get("/api/me", () => HttpResponse.json({ ...currentUser, permissions })),
    http.get("/api/settings/presentation", () => HttpResponse.json({ defaultCulture: "es", defaultTimeZoneId: "America/Argentina/Buenos_Aires", defaultPageSize: 20, installedFeatures: features })),
    http.all("/api/forms/definitions*", ({ request }) => store.handle(request)),
    http.get("/api/forms/catalogs", () => HttpResponse.json({ ...empty, filterCounts: { byKind: { all: 0, manual: 0, filters: 0 } } })),
    http.get("/api/forms/missing-requests", () => HttpResponse.json({ ...empty, items: [topic], totalCount: 1, totalPages: 1, totalRequests: 5, stateCounts: { pending: 1, discarded: 0 } })),
    http.get("/api/ai/assistant/bootstrap", () => HttpResponse.json({ availability: "available", connectionRevision: 1, suggestions: [], limits: { questionMaxLength: 4000 }, configurationDestination: null })),
    http.get("/api/ai/assistant/conversations", () => HttpResponse.json(empty)));
}
async function open(path: string) {
  let router!: ReturnType<typeof renderRouteWithProviders>["router"];
  await act(async () => { router = renderRouteWithProviders(path).router; });
  return router;
}
beforeEach(async () => { queryClient.clear(); await i18n.changeLanguage("es"); });

it.each([
  ["/formularios", ["formtemplates.read", "formtemplates.manage", "ai.assistant.use"], "Armar con la IA", "Armame un formulario para "],
  ["/catalogos",["formcatalogs.read", "formcatalogs.manage", "ai.assistant.use"], "Armar con la IA", "Armame un catálogo de "],
  ["/formularios/faltantes", ["formtemplates.read", "formtemplates.manage", "ai.assistant.use"], "Armar con la IA un formulario para Reclamos de clientes", "Armame un formulario para registrar reclamos de clientes"],
])("«Armar con la IA» on %s opens a new Home conversation with the request begun, unsent", async (path, permissions, label, draft) => {
  setup(permissions);
  const router = await open(path);
  await userEvent.click(await screen.findByRole("link", { name: label }));
  expect(await screen.findByRole("textbox", { name: "Tu pregunta" })).toHaveValue(draft);
  expect(router.state.location).toMatchObject({ pathname: "/", search: "", state: { assistantDraft: draft } });
});

it("offers nothing to build without the assistant or without managing forms", async () => {
  setup(["formtemplates.read", "formtemplates.manage"]);
  await open("/formularios");
  expect(await screen.findByRole("link", { name: "Nuevo formulario" })).toBeInTheDocument();
  expect(screen.queryByRole("link", { name: "Armar con la IA" })).not.toBeInTheDocument();
  setup(["formtemplates.read", "formtemplates.manage", "ai.assistant.use"], ["forms"]);
  queryClient.clear();
  await open("/formularios");
  expect(await screen.findAllByRole("link", { name: "Nuevo formulario" })).not.toHaveLength(0);
  expect(screen.queryByRole("link", { name: "Armar con la IA" })).not.toBeInTheDocument();
});
