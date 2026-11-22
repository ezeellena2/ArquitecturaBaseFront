import { act, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { beforeAll, beforeEach, expect, it, vi } from "vitest";
import { queryClient } from "@/shared/api/queryClient";
import { initialAppearance } from "@/shared/lib/appearance";
import { server } from "@/test/mocks/server";
import { renderRouteWithProviders } from "@/test/utils/renderWithProviders";
import { createFormFixtureStore, fixtureFormId } from "@/test/visual/formFixtures";
vi.mock("react-oidc-context", async () => ({ ...await vi.importActual<typeof import("react-oidc-context")>("react-oidc-context"), useAuth: () => ({ isAuthenticated: true, isLoading: false, user: { access_token: "test" } }) }));

// SA1-A, SA2-A and SA5 (2026-11-09): «Dónde se completa» next to the prefix; with «Sólo en la app» the editor has nothing of WhatsApp.
// The first test of a file pays the editor's lazy route; loading it beforehand keeps that wait out of the tests under load.
beforeAll(async () => { await import("./FormEditorPage"); }, 60000);
let store: ReturnType<typeof createFormFixtureStore>;
const presentation = (installedFeatures?: string[]) => http.get("/api/settings/presentation", () => HttpResponse.json({ appearance: initialAppearance,
  defaultCulture: "es", defaultTimeZoneId: "America/Argentina/Buenos_Aires", defaultPageSize: 20, ...installedFeatures ? { installedFeatures } : {} }));
beforeEach(() => {
  queryClient.clear();
  store = createFormFixtureStore("es");
  server.use(
    http.all("/api/forms/*", ({ request }) => store.handle(request)),
    http.get("/api/me", () => HttpResponse.json({ id: "actor", displayName: "Ana", email: "ana@example.com", emailConfirmed: true, phoneNumber: null, formattedPhoneNumber: null, maskedPhoneNumber: null, phoneNumberConfirmed: false, hasGoogleLogin: false, culture: "es", timeZoneId: "America/Argentina/Buenos_Aires", lastLoginAtUtc: null, roles: [], permissions: ["formtemplates.read", "formtemplates.manage", "formtemplates.publish", "formcatalogs.read"] })),
    presentation(["forms", "form-channels"]));
});

it("chooses «Sólo en la app» next to the prefix, leaves WhatsApp out of the editor and saves it with the draft", async () => {
  const offered = store.definitions.get(fixtureFormId)!.offerWhen;
  renderRouteWithProviders("/formularios/" + fixtureFormId);
  // «Dónde se completa» is the only piece to choose (DS1-A, 2026-11-22), with its (i).
  const where = await screen.findByRole("button", { name: "Dónde se completa En la app y por WhatsApp" });
  expect(where).toHaveAccessibleDescription(expect.stringContaining("Con «Sólo en la app» se carga desde «Formularios»"));
  expect(screen.getByRole("textbox", { name: "Cuándo lo ofrece el asistente" })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Publicar en WhatsApp" })).toBeInTheDocument();

  await pick("Dónde se completa En la app y por WhatsApp", "Sólo en la app");
  expect(screen.getByRole("button", { name: "Dónde se completa Sólo en la app" })).toBeInTheDocument();
  expect(screen.queryByRole("textbox", { name: "Cuándo lo ofrece el asistente" })).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Publicar" })).toBeInTheDocument();
  await act(async () => { await userEvent.click(screen.getByRole("button", { name: "Guardar borrador" })); });
  expect(store.writes.at(-1)?.draft.appOnly).toBe(true);
  // What the assistant offered stays saved, without its field.
  expect(store.writes.at(-1)?.offerWhen).toBe(offered);

  await pick("Dónde se completa Sólo en la app", "En la app y por WhatsApp");
  await act(async () => { await userEvent.click(screen.getByRole("button", { name: "Guardar borrador" })); });
  expect(store.writes.at(-1)?.draft).not.toHaveProperty("appOnly");
});

it("without a form channel has no setting and publishes in the app (SA5)", async () => {
  server.use(presentation(["forms"]));
  renderRouteWithProviders("/formularios/" + fixtureFormId);
  expect(await screen.findByRole("button", { name: "Publicar" })).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: /^Dónde se completa/ })).not.toBeInTheDocument();
  expect(screen.queryByRole("textbox", { name: "Cuándo lo ofrece el asistente" })).not.toBeInTheDocument();
});

// The Picker opens with the keyboard, like the other Radix lists in the tests; its button says the label and the chosen one.
async function pick(trigger: string, option: string) {
  const button = screen.getByRole("button", { name: trigger });
  await act(async () => { button.focus(); });
  await userEvent.keyboard("{Enter}");
  await userEvent.click(within(await screen.findByRole("listbox")).getByRole("option", { name: option }));
}
