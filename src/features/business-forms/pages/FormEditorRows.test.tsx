import { act, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { beforeEach, expect, it, vi } from "vitest";
import { queryClient } from "@/shared/api/queryClient";
import { server } from "@/test/mocks/server";
import { renderRouteWithProviders } from "@/test/utils/renderWithProviders";
import { createFormFixtureStore, fixtureFormId } from "@/test/visual/formFixtures";
vi.mock("react-oidc-context", async () => ({ ...await vi.importActual<typeof import("react-oidc-context")>("react-oidc-context"), useAuth: () => ({ isAuthenticated: true, isLoading: false, user: { access_token: "test" } }) }));

// RG1-A and RG6-A in the list: a marked question creates the block in its place and goes into its box, and the box adds its own.
beforeEach(() => {
  queryClient.clear();
  const store = createFormFixtureStore("es");
  server.use(
    http.all("/api/forms/*", ({ request }) => store.handle(request)),
    http.get("/api/me", () => HttpResponse.json({ id: "actor", displayName: "Ana", email: "ana@example.com", emailConfirmed: true, phoneNumber: null, formattedPhoneNumber: null, maskedPhoneNumber: null, phoneNumberConfirmed: false, hasGoogleLogin: false, culture: "es", timeZoneId: "America/Argentina/Buenos_Aires", lastLoginAtUtc: null, roles: [], permissions: ["formtemplates.read", "formtemplates.manage", "formcatalogs.read"] })));
});
const numbers = () => screen.getAllByRole("button", { name: /^Editar / }).map(button => button.closest("[data-question-local-id]")!.querySelector("span")!.textContent);

it("creates the block in the place of a marked question and adds questions inside its box", async () => {
  renderRouteWithProviders("/formularios/" + fixtureFormId);
  await userEvent.click(await screen.findByRole("button", { name: "Editar Contacto" }));

  await userEvent.click(screen.getByRole("checkbox", { name: "Se carga varias veces" }));

  expect(numbers()).toEqual(["1", "2", "2.1", "3", "4", "5", "6"]);
  expect(screen.getByRole("button", { name: "Editar Renglones" })).toBeInTheDocument();
  expect(screen.getByText("Renglones · de 1 a 20 · 1 pregunta")).toBeInTheDocument();
  const box = screen.getByText("Preguntas de cada renglón").closest("div.rounded-md") as HTMLElement;
  await act(async () => { await userEvent.click(within(box).getByRole("button", { name: "Agregar pregunta" })); });

  expect(numbers()).toEqual(["1", "2", "2.1", "2.2", "3", "4", "5", "6"]);
  // Seven questions: the block is not one of them.
  expect(screen.getByText("7 preguntas")).toBeInTheDocument();
});
