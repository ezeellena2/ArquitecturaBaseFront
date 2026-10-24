import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { beforeEach, expect, it, vi } from "vitest";
import i18n from "@/shared/i18n";
import { queryClient } from "@/shared/api/queryClient";
import { server } from "@/test/mocks/server";
import { renderRouteWithProviders } from "@/test/utils/renderWithProviders";
import { createFormFixtureStore, fixtureFormId } from "@/test/visual/formFixtures";
vi.mock("react-oidc-context", async () => ({ ...await vi.importActual<typeof import("react-oidc-context")>("react-oidc-context"), useAuth: () => ({ isAuthenticated: true, isLoading: false, user: { access_token: "test" } }) }));

// The menu stays in Spanish in this file, so the English texts of the screen load only when something asks for them,
// as in a session that never used the English menu.
beforeEach(() => queryClient.clear());

it("keeps editing a translation while emptying a text turns the preview to the English original", async () => {
  expect(i18n.hasResourceBundle("en", "forms")).toBe(false);
  const store = createFormFixtureStore("en");
  const original = store.definitions.get(fixtureFormId)!;
  store.definitions.set(fixtureFormId, { ...original, draft: { ...original.draft, fields: original.draft.fields.map(q => q.help ? { ...q, help: { ...q.help, es: "Contá lo que pasó." } } : q) } });
  server.use(http.all("/api/forms/*", ({ request }) => store.handle(request)),
    http.get("/api/me", () => HttpResponse.json({ id: "actor", displayName: "Ana", email: "ana@example.com", emailConfirmed: true, phoneNumber: null, formattedPhoneNumber: null, maskedPhoneNumber: null, phoneNumberConfirmed: false, hasGoogleLogin: false,
      culture: "es", timeZoneId: "America/Argentina/Buenos_Aires", lastLoginAtUtc: null, roles: [], permissions: ["formtemplates.read", "formtemplates.manage"] })));
  renderRouteWithProviders("/formularios/" + fixtureFormId);
  const name = await screen.findByRole("textbox", { name: "Nombre" });
  const preview = screen.getByRole("region", { name: "Vista previa" });
  expect(within(preview).getByText("Vista previa en español.")).toBeInTheDocument();
  await userEvent.clear(name);
  expect(name).toBeVisible();
  expect(name).toHaveFocus();
  expect(within(preview).getByText("Register visit")).toBeVisible();
});
