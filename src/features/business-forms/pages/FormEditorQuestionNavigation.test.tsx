import { act, cleanup, screen, waitFor } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { beforeEach, expect, it, vi } from "vitest";
import { queryClient } from "@/shared/api/queryClient";
import { server } from "@/test/mocks/server";
import { renderRouteWithProviders } from "@/test/utils/renderWithProviders";
import { createFormFixtureStore, fixtureDefinition, fixtureFormId } from "@/test/visual/formFixtures";
vi.mock("react-oidc-context", async () => ({ ...await vi.importActual<typeof import("react-oidc-context")>("react-oidc-context"), useAuth: () => ({ isAuthenticated: true, isLoading: false, user: { access_token: "test" } }) }));

beforeEach(() => {
  queryClient.clear();
  const store = createFormFixtureStore("es");
  server.use(http.all("/api/forms/*", ({ request }) => store.handle(request)), http.get("/api/me", () => HttpResponse.json({ id: "actor", displayName: "Ana", email: "ana@example.com", emailConfirmed: true, phoneNumber: null, formattedPhoneNumber: null, maskedPhoneNumber: null, phoneNumberConfirmed: false, hasGoogleLogin: false, culture: "es", timeZoneId: "America/Argentina/Buenos_Aires", lastLoginAtUtc: null, roles: [], permissions: ["formtemplates.read", "formtemplates.manage", "formcatalogs.read"] })));
});
const expandedQuestions = () => screen.getAllByRole("button", { name: /^Editar / }).filter(button => button.getAttribute("aria-expanded") === "true");

it("opens and focuses the question named by the catalog usage link", async () => {
  const contact = fixtureDefinition().draft.fields[1]!;
  renderRouteWithProviders("/formularios/" + fixtureFormId, { state: { questionFieldId: contact.fieldId } });
  const label = await screen.findByRole("textbox", { name: "Pregunta" });
  expect(label).toHaveValue("Contacto");
  await waitFor(() => expect(label).toHaveFocus());
  expect(expandedQuestions().map(button => button.getAttribute("aria-label"))).toEqual(["Editar Contacto"]);
  cleanup();

  queryClient.clear();
  renderRouteWithProviders("/formularios/" + fixtureFormId, { state: { questionFieldId: "01990000-0000-7000-8000-000000000099" } });
  await screen.findByLabelText("Nombre");
  await act(async () => { await new Promise(resolve => requestAnimationFrame(resolve)); });
  expect(expandedQuestions()).toHaveLength(0);
  expect(screen.queryByRole("textbox", { name: "Pregunta" })).not.toBeInTheDocument();
});
