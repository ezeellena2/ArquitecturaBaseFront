import { act, cleanup, screen, waitFor } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { beforeEach, expect, it, vi } from "vitest";
import { queryClient } from "@/shared/api/queryClient";
import { server } from "@/test/mocks/server";
import { renderRouteWithProviders } from "@/test/utils/renderWithProviders";
import { createFormFixtureStore, fixtureDefinition, fixtureFormId } from "@/test/visual/formFixtures";
vi.mock("react-oidc-context", async () => ({ ...await vi.importActual<typeof import("react-oidc-context")>("react-oidc-context"), useAuth: () => ({ isAuthenticated: true, isLoading: false, user: { access_token: "test" } }) }));

// In the "forms-catalog" form the first question, «Cliente», draws its options from this catalog: the kind of question a catalog field's use points to.
const catalogId = "01990000-0000-7000-8000-000000000080";
const catalogPage = { filterCounts: { byKind: { all: 1, manual: 0, filters: 1 } }, items: [{ id: catalogId, name: "Clientes", description: null, origin: "Filters", valueType: "Text", optionsCount: null, usageCount: 1, state: "Active", stateReason: null, canEdit: true }], page: 1, pageSize: 20, totalCount: 1, totalPages: 1, hasPrevious: false, hasNext: false };
const catalogDetail = { id: catalogId, key: catalogId.replaceAll("-", ""), name: { es: "Clientes", en: "Customers" }, description: { es: "Clientes para las visitas", en: "Customers for visits" }, kind: "Filters", valueType: "Text", revision: 1, isActive: true, itemsCount: null, usageCount: 1, originalCulture: "es", unavailableReasonCode: null, filters: { textColumn: "name", detailColumn: null, conditions: [], excludeRecipient: false, sortColumn: "name", sortDescending: false }, proposal: null, fields: null, presentation: null, presentationCheck: null };
let releaseCatalogs: () => void = () => {};

beforeEach(() => {
  queryClient.clear();
  const store = createFormFixtureStore("es", "forms-catalog");
  const catalogsArrive = new Promise<void>(resolve => { releaseCatalogs = resolve; });
  server.use(
    http.get("/api/forms/catalogs", async () => { await catalogsArrive; return HttpResponse.json(catalogPage); }),
    http.get("/api/forms/catalogs/:catalogId", () => HttpResponse.json(catalogDetail)),
    http.all("/api/forms/*", ({ request }) => store.handle(request)),
    http.get("/api/me", () => HttpResponse.json({ id: "actor", displayName: "Ana", email: "ana@example.com", emailConfirmed: true, phoneNumber: null, formattedPhoneNumber: null, maskedPhoneNumber: null, phoneNumberConfirmed: false, hasGoogleLogin: false, culture: "es", timeZoneId: "America/Argentina/Buenos_Aires", lastLoginAtUtc: null, roles: [], permissions: ["formtemplates.read", "formtemplates.manage", "formcatalogs.read"] })));
});
const expandedQuestions = () => screen.getAllByRole("button", { name: /^Editar / }).filter(button => button.getAttribute("aria-expanded") === "true");

it("opens the question named by the catalog usage link and focuses its catalog once it can be chosen", async () => {
  const customer = fixtureDefinition().draft.fields[0]!;
  renderRouteWithProviders("/formularios/" + fixtureFormId, { state: { questionFieldId: customer.fieldId } });
  const label = await screen.findByRole("textbox", { name: "Pregunta" });
  expect(label).toHaveValue("Cliente");
  expect(expandedQuestions().map(button => button.getAttribute("aria-label"))).toEqual(["Editar Cliente"]);
  // While the catalog list loads the catalog cannot be chosen, so the question's label holds the focus.
  const catalog = screen.getByRole("combobox", { name: "Catálogo" });
  await act(async () => { await new Promise(resolve => requestAnimationFrame(resolve)); });
  expect(catalog).toBeDisabled();
  expect(label).toHaveFocus();

  act(() => releaseCatalogs());
  await waitFor(() => expect(catalog).toBeEnabled());
  expect(catalog).toHaveValue(catalogId);
  await waitFor(() => expect(catalog).toHaveFocus());
  cleanup();

  queryClient.clear();
  renderRouteWithProviders("/formularios/" + fixtureFormId, { state: { questionFieldId: "01990000-0000-7000-8000-000000000099" } });
  await screen.findByLabelText("Nombre");
  await act(async () => { await new Promise(resolve => requestAnimationFrame(resolve)); });
  expect(expandedQuestions()).toHaveLength(0);
  expect(screen.queryByRole("textbox", { name: "Pregunta" })).not.toBeInTheDocument();
});
