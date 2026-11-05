import { act, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { beforeEach, expect, it, vi } from "vitest";
import { queryClient } from "@/shared/api/queryClient";
import { server } from "@/test/mocks/server";
import { renderRouteWithProviders } from "@/test/utils/renderWithProviders";
import { createFormFixtureStore, fixtureFormId } from "@/test/visual/formFixtures";
vi.mock("react-oidc-context", async () => ({ ...await vi.importActual<typeof import("react-oidc-context")>("react-oidc-context"), useAuth: () => ({ isAuthenticated: true, isLoading: false, user: { access_token: "test" } }) }));

// CW15-B in the list: «Agregar título» adds a title row at the end, ↑ ↓ move it among the questions and Guardar sends it apart.
let store: ReturnType<typeof createFormFixtureStore>;
beforeEach(() => {
  queryClient.clear();
  store = createFormFixtureStore("es");
  server.use(
    http.all("/api/forms/*", ({ request }) => store.handle(request)),
    http.get("/api/me", () => HttpResponse.json({ id: "actor", displayName: "Ana", email: "ana@example.com", emailConfirmed: true, phoneNumber: null, formattedPhoneNumber: null, maskedPhoneNumber: null, phoneNumberConfirmed: false, hasGoogleLogin: false, culture: "es", timeZoneId: "America/Argentina/Buenos_Aires", lastLoginAtUtc: null, roles: [], permissions: ["formtemplates.read", "formtemplates.manage", "formcatalogs.read"] })));
});
// The list as it reads: «#» before a title.
const list = () => [...document.querySelectorAll<HTMLElement>("[data-question-local-id], [data-section-local-id]")]
  .map(row => (row.dataset.sectionLocalId ? "#" : "") + row.querySelector("p")!.textContent);

it("adds a title at the end, moves it among the questions and saves it apart from them", async () => {
  renderRouteWithProviders("/formularios/" + fixtureFormId);
  await userEvent.click(await screen.findByRole("button", { name: "Agregar título" }));

  const title = screen.getByRole("textbox", { name: "Título" });
  expect(title).toHaveFocus();
  await userEvent.type(title, "Cierre");
  expect(screen.getByText("Título de sección")).toBeInTheDocument();
  await userEvent.click(screen.getByRole("button", { name: "Subir Cierre" }));

  expect(list()).toEqual(["Cliente", "Contacto", "Importe cobrado", "Fecha de visita", "Visita completada", "#Cierre", "Observaciones"]);
  await act(async () => { await userEvent.click(screen.getByRole("button", { name: "Guardar borrador" })); });
  expect(store.writes.at(-1)?.draft.sections).toEqual([{ start: 5, title: { es: "Cierre" } }]);
  // Six questions: the title is not one of them.
  expect(screen.getByText("6 preguntas")).toBeInTheDocument();
});

it("moves a question across a title into the other section and removes a title without asking", async () => {
  renderRouteWithProviders("/formularios/" + fixtureFormId);
  await userEvent.click(await screen.findByRole("button", { name: "Agregar título" }));
  await userEvent.type(screen.getByRole("textbox", { name: "Título" }), "Cierre");
  await userEvent.click(screen.getByRole("button", { name: "Listo" }));
  await userEvent.click(screen.getByRole("button", { name: "Subir Cierre" }));

  await userEvent.click(screen.getByRole("button", { name: "Bajar Visita completada" }));
  expect(list()).toEqual(["Cliente", "Contacto", "Importe cobrado", "Fecha de visita", "#Cierre", "Visita completada", "Observaciones"]);
  await userEvent.click(screen.getByRole("button", { name: "Quitar Cierre" }));

  expect(list()).toEqual(["Cliente", "Contacto", "Importe cobrado", "Fecha de visita", "Visita completada", "Observaciones"]);
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
});
