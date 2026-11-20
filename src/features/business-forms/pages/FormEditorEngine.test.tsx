import { act, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { beforeEach, expect, it, vi } from "vitest";
import { queryClient } from "@/shared/api/queryClient";
import { server } from "@/test/mocks/server";
import { renderRouteWithProviders } from "@/test/utils/renderWithProviders";
import { createFormFixtureStore, fixtureDefinition, fixtureFormId } from "@/test/visual/formFixtures";
vi.mock("react-oidc-context", async () => ({ ...await vi.importActual<typeof import("react-oidc-context")>("react-oidc-context"), useAuth: () => ({ isAuthenticated: true, isLoading: false, user: { access_token: "test" } }) }));

// BI1-A in the editor: a draft copied from the library names its standard and locks the questions it needs; CA1-A and CO1-A:
// a calculation or a condition still to complete stops Guardar at its question. Synthetic doubles over the visual fixture store.
const amount = fixtureDefinition().draft.fields.find(field => field.type === "decimal")!.fieldId;
let store: ReturnType<typeof createFormFixtureStore>;
let listed: readonly Record<string, unknown>[];
beforeEach(() => {
  queryClient.clear();
  store = createFormFixtureStore("es");
  listed = [{ key: "arca.invoice", version: 1, name: "Factura", description: "La factura con sus ítems.", prefix: "FAC", copies: 1, culture: "es", suggestedPrefix: "FAC2" }];
  server.use(
    http.get("/api/forms/library", () => HttpResponse.json({ standards: listed })),
    http.get("/api/forms/definitions/:id", async ({ request }) => {
      const body = await (await store.handle(request)).json() as { definition: Record<string, unknown> };
      return HttpResponse.json({ ...body, definition: { ...body.definition, standard: { key: "arca.invoice", version: 1, bound: { amount } } } });
    }),
    http.all("/api/forms/*", ({ request }) => store.handle(request)),
    http.get("/api/me", () => HttpResponse.json({ id: "actor", displayName: "Ana", email: "ana@example.com", emailConfirmed: true, phoneNumber: null, formattedPhoneNumber: null, maskedPhoneNumber: null, phoneNumberConfirmed: false, hasGoogleLogin: false, culture: "es", timeZoneId: "America/Argentina/Buenos_Aires", lastLoginAtUtc: null, roles: [], permissions: ["formtemplates.read", "formtemplates.manage", "formcatalogs.read"] })));
});

it("names the standard it came from and locks the questions it needs, which still move and change their text (BI1-A)", async () => {
  renderRouteWithProviders("/formularios/" + fixtureFormId);

  expect(await screen.findByText("· De la biblioteca: Factura, versión 1", {}, { timeout: 15000 })).toBeVisible();
  const row = document.querySelector<HTMLElement>(`[data-question-local-id="${amount}"]`)!;
  expect(within(row).getByRole("button", { name: "La necesita el estándar de la biblioteca: se cambian el texto, la ayuda y el orden." })).toBeVisible();
  expect(within(row).getByRole("button", { name: "Quitar Importe cobrado" })).toHaveAccessibleDescription("La necesita el estándar de la biblioteca: no se puede quitar.");
  expect(within(row).getByRole("button", { name: "Subir Importe cobrado" })).toBeEnabled();
  // A question it does not need is removed as always.
  expect(screen.getByRole("button", { name: "Quitar Contacto" })).not.toHaveAttribute("aria-disabled");
}, 30000);

it("names the standard by its key when the library does not list it", async () => {
  listed = [];
  renderRouteWithProviders("/formularios/" + fixtureFormId);
  expect(await screen.findByText("· De la biblioteca: arca.invoice, versión 1", {}, { timeout: 15000 })).toBeVisible();
}, 30000);

it("stops Guardar at a calculation still to complete, says what is missing and takes the focus there (CA1-A)", async () => {
  const user = userEvent.setup();
  renderRouteWithProviders("/formularios/" + fixtureFormId);
  await user.click(await screen.findByRole("button", { name: "Agregar pregunta" }, { timeout: 15000 }));
  const added = [...document.querySelectorAll<HTMLElement>("[data-question-local-id]")].at(-1)!;
  await user.type(within(added).getByRole("textbox", { name: "Pregunta" }), "Total");
  await act(async () => { within(added).getByRole("button", { name: /^Tipo de respuesta / }).focus(); });
  await user.keyboard("{Enter}");
  await user.click(within(await screen.findByRole("listbox", { name: "Tipo de respuesta" })).getByRole("option", { name: "Cálculo" }));
  // Another type is another question in the list: it is drawn again under its new local identity.
  const total = [...document.querySelectorAll<HTMLElement>("[data-question-local-id]")].at(-1)!;
  const writes = store.writes.length;

  await act(async () => { await user.click(screen.getByRole("button", { name: "Guardar borrador" })); });

  expect(store.writes).toHaveLength(writes);
  expect(within(total).getByText("Elegí las preguntas que usa el cálculo.")).toBeVisible();
  await waitFor(() => expect(within(total).getByRole("button", { name: /^Multiplica / })).toHaveFocus());
}, 30000);

it("stops Guardar at a condition still to complete and takes the focus to the question to choose (CO1-A)", async () => {
  const user = userEvent.setup();
  renderRouteWithProviders("/formularios/" + fixtureFormId);
  await user.click(await screen.findByRole("button", { name: "Agregar pregunta" }, { timeout: 15000 }));
  const added = [...document.querySelectorAll<HTMLElement>("[data-question-local-id]")].at(-1)!;
  await user.type(within(added).getByRole("textbox", { name: "Pregunta" }), "Detalle");
  await user.click(within(added).getByRole("button", { name: "Según otra respuesta" }));
  const writes = store.writes.length;

  await act(async () => { await user.click(screen.getByRole("button", { name: "Guardar borrador" })); });

  // «Si» is the only piece to choose: the focus goes to its button, still without a question.
  expect(store.writes).toHaveLength(writes);
  await waitFor(() => expect(within(added).getByRole("button", { name: "Si Elegí una pregunta" })).toHaveFocus());
}, 30000);
