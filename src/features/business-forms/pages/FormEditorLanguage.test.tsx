import { act, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import i18n from "@/shared/i18n";
import { queryClient } from "@/shared/api/queryClient";
import { notify } from "@/shared/ui/notifications";
import { server } from "@/test/mocks/server";
import { renderRouteWithProviders } from "@/test/utils/renderWithProviders";
import { createFormFixtureStore, fixtureFormId } from "@/test/visual/formFixtures";
import type { FormCulture } from "../model";
vi.mock("react-oidc-context", async () => ({ ...await vi.importActual<typeof import("react-oidc-context")>("react-oidc-context"), useAuth: () => ({ isAuthenticated: true, isLoading: false, user: { access_token: "test" } }) }));
vi.mock("@/shared/ui/notifications", async () => ({ ...await vi.importActual<typeof import("@/shared/ui/notifications")>("@/shared/ui/notifications"), notify: vi.fn() }));

// There is no content language selector: the form is edited in the menu language, and the other language is the optional translation.
async function setup(culture: FormCulture) {
  await act(() => i18n.changeLanguage(culture));
  const store = createFormFixtureStore("es");
  server.use(http.all("/api/forms/*", ({ request }) => store.handle(request)),
    http.get("/api/me", () => HttpResponse.json({ id: "actor", displayName: "Ana", email: "ana@example.com", emailConfirmed: true, phoneNumber: null, formattedPhoneNumber: null, maskedPhoneNumber: null, phoneNumberConfirmed: false, hasGoogleLogin: false,
      culture, timeZoneId: "America/Argentina/Buenos_Aires", lastLoginAtUtc: null, roles: [], permissions: ["formtemplates.read", "formtemplates.manage"] })));
  return store;
}
beforeEach(() => { queryClient.clear(); vi.mocked(notify).mockClear(); });
afterEach(async () => { queryClient.clear(); await act(() => i18n.changeLanguage("es")); });

it("edits the form in the menu language without a content language selector", async () => {
  const store = await setup("en");
  const original = store.definitions.get(fixtureFormId)!;
  store.definitions.set(fixtureFormId, { ...original, name: { es: "Registrar visita", en: "" } });
  renderRouteWithProviders("/formularios/" + fixtureFormId);
  const name = await screen.findByRole("textbox", { name: "Name" });
  expect(screen.queryByRole("group", { name: "Content language" })).not.toBeInTheDocument();
  expect(name).toHaveValue("");
  expect(name).toHaveAttribute("placeholder", "Untranslated");
  expect(name).toHaveAccessibleDescription("Original (Spanish): Registrar visita");
});

it("shows a save error of the other language under the visible field", async () => {
  await setup("es");
  server.use(http.put("/api/forms/definitions/:id/draft", () => HttpResponse.json({ code: "Validation.Failed", errors: { "name.en": ["Usá hasta 120 caracteres."] } }, { status: 400 })));
  renderRouteWithProviders("/formularios/" + fixtureFormId);
  const name = await screen.findByRole("textbox", { name: "Nombre" });
  await userEvent.click(name);
  await userEvent.paste(" editado");
  await userEvent.click(screen.getByRole("button", { name: "Guardar borrador" }));
  await waitFor(() => expect(name).toHaveAccessibleDescription("En inglés: Usá hasta 120 caracteres."));
  await waitFor(() => expect(name).toHaveFocus());
  expect(name).toHaveValue("Registrar visita editado");
  expect(vi.mocked(notify).mock.calls.filter(([notice]) => notice.kind === "error")).toHaveLength(0);
});
