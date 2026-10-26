import { act, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import i18n from "@/shared/i18n";
import { queryClient } from "@/shared/api/queryClient";
import { notify } from "@/shared/ui/notifications";
import { hasUnsavedChanges } from "@/shared/hooks/useUnsavedChangesGuard";
import { server } from "@/test/mocks/server";
import { renderRouteWithProviders } from "@/test/utils/renderWithProviders";
import { createFormFixtureStore, fixtureFormId, fixtureLifecycle } from "@/test/visual/formFixtures";
import type { FormPublicationCheck } from "../api/response";
import type { FormCulture } from "../model";
vi.mock("react-oidc-context", async () => ({ ...await vi.importActual<typeof import("react-oidc-context")>("react-oidc-context"), useAuth: () => ({ isAuthenticated: true, isLoading: false, user: { access_token: "test" } }) }));
vi.mock("@/shared/ui/notifications", async () => ({ ...await vi.importActual<typeof import("@/shared/ui/notifications")>("@/shared/ui/notifications"), notify: vi.fn() }));

// There is no content language selector: the form is edited in the menu language, and the other language is the optional translation.
async function setup(culture: FormCulture, permissions = ["formtemplates.read", "formtemplates.manage"]) {
  await act(() => i18n.changeLanguage(culture));
  const store = createFormFixtureStore("es");
  server.use(http.all("/api/forms/*", ({ request }) => store.handle(request)),
    http.get("/api/me", () => HttpResponse.json({ id: "actor", displayName: "Ana", email: "ana@example.com", emailConfirmed: true, phoneNumber: null, formattedPhoneNumber: null, maskedPhoneNumber: null, phoneNumberConfirmed: false, hasGoogleLogin: false,
      culture, timeZoneId: "America/Argentina/Buenos_Aires", lastLoginAtUtc: null, roles: [], permissions })));
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
  expect(screen.queryAllByRole("button", { name: /^(Español|Inglés|Spanish|English)\b/ })).toHaveLength(0);
  expect(name).toHaveValue("");
  expect(name).toHaveAttribute("placeholder", "Untranslated");
  expect(name).toHaveAccessibleDescription("Original (Spanish): Registrar visita");
  // Without a selector, the old note about editing per language has nothing to point at: it is gone.
  expect(screen.queryByText("Text is edited per language and is not translated automatically.")).not.toBeInTheDocument();
});

// Translating is changing the menu language and editing the same draft: nothing unsaved is lost, so the menu does not ask.
it("keeps the unsaved draft when the menu language changes and shows the other translation", async () => {
  const store = await setup("es", ["formtemplates.read", "formtemplates.manage", "formrules.manage"]);
  const saved = vi.fn();
  server.use(http.put("/api/forms/definitions/:id/draft", async ({ request }) => { saved(await request.clone().json()); return store.handle(request); }));
  renderRouteWithProviders("/formularios/" + fixtureFormId);
  await userEvent.click(await screen.findByRole("textbox", { name: "Nombre" }));
  await userEvent.paste(" editado");
  await userEvent.click(await screen.findByRole("button", { name: "Agregar regla" }));
  const rules = screen.getAllByRole("region", { name: /^Regla \d+$/ }).length;
  expect(hasUnsavedChanges()).toBe(false);
  await act(() => i18n.changeLanguage("en"));
  const name = await screen.findByRole("textbox", { name: "Name" });
  expect(await screen.findAllByRole("region", { name: /^Rule \d+$/ })).toHaveLength(rules);
  expect(screen.getByRole("button", { name: "Save rules" })).toBeEnabled();
  expect(name).toHaveValue("Register visit");
  expect(name).toHaveAccessibleDescription("Original (Spanish): Registrar visita editado");
  await userEvent.click(name);
  await userEvent.paste(" again");
  await act(() => i18n.changeLanguage("es"));
  expect(await screen.findByRole("textbox", { name: "Nombre" })).toHaveValue("Registrar visita editado");
  await userEvent.click(screen.getByRole("button", { name: "Guardar borrador" }));
  await waitFor(() => expect(saved).toHaveBeenCalledWith(expect.objectContaining({ name: { es: "Registrar visita editado", en: "Register visit again" } })));
});

it("titles the form in the menu language and falls back to the original when it has no translation", async () => {
  await setup("en");
  renderRouteWithProviders("/formularios/" + fixtureFormId);
  const name = await screen.findByRole("textbox", { name: "Name" });
  expect(name).toHaveValue("Register visit");
  expect(screen.getByRole("heading", { level: 1, name: "Register visit" })).toBeVisible();
  expect(within(screen.getByRole("navigation", { name: "Breadcrumb" })).getAllByRole("listitem").at(-1)).toHaveTextContent(/^Register visit$/);
  await userEvent.clear(name);
  expect(screen.getByRole("heading", { level: 1, name: "Registrar visita" })).toBeVisible();
  expect(within(screen.getByRole("navigation", { name: "Breadcrumb" })).getAllByRole("listitem").at(-1)).toHaveTextContent(/^Registrar visita$/);
});

// Like the title, the save notice and the lifecycle dialogs name the form in the menu language, with the original as fallback.
it("names the form in the menu language in the save notice and the deletion dialog", async () => {
  const store = await setup("en");
  store.lifecycles.set(fixtureFormId, fixtureLifecycle(1, { responseCount: 0, canDelete: true }));
  renderRouteWithProviders("/formularios/" + fixtureFormId);
  await userEvent.click(await screen.findByRole("textbox", { name: "Name" }));
  await userEvent.paste(" edited");
  await userEvent.click(screen.getByRole("button", { name: "Save draft" }));
  await waitFor(() => expect(notify).toHaveBeenCalledWith(expect.objectContaining({ kind: "success", message: "Saved the draft of Register visit edited." })));
  const menu = screen.getByRole("button", { name: "Form actions" });
  act(() => menu.focus()); await userEvent.keyboard("{Enter}");
  await userEvent.click(within(await screen.findByRole("menu")).getByRole("menuitem", { name: /Delete/ }));
  expect(await screen.findByRole("dialog", { name: "Delete “Register visit edited”" })).toBeVisible();
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

// The check blocks on texts of each language; locating one of the language not on screen shows it under the field the menu edits.
async function openBlockedCheck(issues: (store: ReturnType<typeof createFormFixtureStore>) => FormPublicationCheck["issues"]) {
  const store = await setup("es", ["formtemplates.read", "formtemplates.manage", "formtemplates.publish"]);
  server.use(http.post("/api/forms/definitions/:id/publication-checks", async ({ request }) => {
    const checked = await (await store.handle(request)).json() as FormPublicationCheck;
    return HttpResponse.json({ ...checked, compatibility: "Blocked", canAccept: false, acceptanceAvailability: "Unavailable", checkToken: null, checkExpiresAtUtc: null, issues: issues(store) });
  }));
  renderRouteWithProviders("/formularios/" + fixtureFormId);
  await screen.findByRole("textbox", { name: "Nombre" });
  await userEvent.click(screen.getByRole("button", { name: "Publicar en WhatsApp" }));
  return await screen.findByRole("dialog", { name: "Publicar la versión 1 en WhatsApp" });
}
const tooLong = { channelId: null, code: "WhatsApp.Flow.TextTooLong", message: "Usá hasta 30 caracteres.", limit: 30, culture: "en" } as const;

it("shows a blocking check problem of the other language under the option it locates, until the next change", async () => {
  const dialog = await openBlockedCheck(store => {
    const customer = store.definitions.get(fixtureFormId)!.draft.fields[0]!;
    if (customer.type !== "choice" || !customer.options) throw new Error("The fixture's first question has its own options.");
    return [{ ...tooLong, fieldId: customer.fieldId, choiceId: customer.options[1]!.choiceId, path: "draft.fields[0].options[1].label.en" }];
  });
  await userEvent.click(await within(dialog).findByRole("button", { name: "Ir a la pregunta" }));
  const option = await screen.findByRole("textbox", { name: "Opción 2" });
  await waitFor(() => expect(option).toHaveFocus());
  expect(option).toHaveValue("Distribuidora Norte");
  expect(option).toHaveAttribute("aria-invalid", "true");
  expect(option).toHaveAccessibleDescription("En inglés: Usá hasta 30 caracteres.");
  await userEvent.paste(" S.A.");
  expect(option).not.toHaveAttribute("aria-invalid", "true");
  expect(option).not.toHaveAccessibleDescription(/En inglés/);
});

it("shows a blocking check problem of the other language under the form text it locates", async () => {
  const dialog = await openBlockedCheck(() => [{ ...tooLong, fieldId: null, choiceId: null, path: "name.en" }]);
  await userEvent.click(await within(dialog).findByRole("button", { name: "Ir al texto" }));
  const name = screen.getByRole("textbox", { name: "Nombre" });
  await waitFor(() => expect(name).toHaveFocus());
  expect(name).toHaveAttribute("aria-invalid", "true");
  expect(name).toHaveAccessibleDescription("En inglés: Usá hasta 30 caracteres.");
});
