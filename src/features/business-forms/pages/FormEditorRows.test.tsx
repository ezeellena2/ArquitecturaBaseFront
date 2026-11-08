import { act, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { beforeEach, expect, it, vi } from "vitest";
import i18n from "@/shared/i18n";
import { queryClient } from "@/shared/api/queryClient";
import { server } from "@/test/mocks/server";
import { renderRouteWithProviders } from "@/test/utils/renderWithProviders";
import { createFormFixtureStore, fixtureFormId } from "@/test/visual/formFixtures";
vi.mock("react-oidc-context", async () => ({ ...await vi.importActual<typeof import("react-oidc-context")>("react-oidc-context"), useAuth: () => ({ isAuthenticated: true, isLoading: false, user: { access_token: "test" } }) }));

// RG1-A and RG6-A in the list: a marked question creates the block in its place and goes into its box, and the box adds its own.
// RG10-D: «Agregar bloque», next to «Agregar pregunta», adds it at the end as one more question, open.
const profile = (culture: "es" | "en") => ({ id: "actor", displayName: "Ana", email: "ana@example.com", emailConfirmed: true, phoneNumber: null, formattedPhoneNumber: null, maskedPhoneNumber: null, phoneNumberConfirmed: false, hasGoogleLogin: false,
  culture, timeZoneId: "America/Argentina/Buenos_Aires", lastLoginAtUtc: null, roles: [], permissions: ["formtemplates.read", "formtemplates.manage", "formcatalogs.read"] });
beforeEach(() => {
  queryClient.clear();
  const store = createFormFixtureStore("es");
  server.use(
    http.all("/api/forms/*", ({ request }) => store.handle(request)),
    http.get("/api/me", () => HttpResponse.json(profile("es"))));
});
const numbers = () => screen.getAllByRole("button", { name: /^Editar / }).map(button => button.closest("[data-question-local-id]")!.querySelector("span")!.textContent);
const box = () => screen.getByText("Preguntas de cada ítem").closest("div.rounded-md") as HTMLElement;
const row = (name: string) => screen.getByRole("button", { name }).closest("[data-question-local-id]") as HTMLElement;

// The one that runs first pays the lazy imports of the editor: alone it takes almost the default five seconds, and more with
// the machine busy.
const opened = (name = "Editar Contacto") => screen.findByRole("button", { name }, { timeout: 10_000 });

it("creates the block, named «Bloque», in the place of a marked question and adds questions inside its box", { timeout: 20_000 }, async () => {
  renderRouteWithProviders("/formularios/" + fixtureFormId);
  await userEvent.click(await opened());

  await userEvent.click(screen.getByRole("checkbox", { name: "Se carga varias veces" }));

  expect(numbers()).toEqual(["1", "2", "2.1", "3", "4", "5", "6"]);
  expect(screen.getByRole("button", { name: "Editar Bloque" })).toBeInTheDocument();
  expect(screen.getByText("Bloque · de 1 a 20 ítems · 1 pregunta")).toBeInTheDocument();
  await act(async () => { await userEvent.click(within(box()).getByRole("button", { name: "Agregar pregunta" })); });

  expect(numbers()).toEqual(["1", "2", "2.1", "2.2", "3", "4", "5", "6"]);
  // Seven questions: the block is not one of them.
  expect(screen.getByText("7 preguntas")).toBeInTheDocument();
});

it("adds the block with «Agregar bloque» at the end, open as «Bloque» with 1 to 20 items, and then turns the button off", { timeout: 20_000 }, async () => {
  renderRouteWithProviders("/formularios/" + fixtureFormId);
  await opened();
  const add = screen.getByRole("button", { name: "Agregar bloque" });
  // «Agregar título» and «Agregar pregunta» stay as they were, with «Agregar bloque» next to «Agregar pregunta».
  const actions = screen.getAllByRole("button", { name: /^Agregar (título|pregunta|bloque)$/ }).map(button => button.textContent);
  expect(actions).toEqual(["Agregar título", "Agregar pregunta", "Agregar bloque"]);

  await act(async () => { await userEvent.click(add); });
  const block = row("Editar Bloque");

  expect(numbers()).toEqual(["1", "2", "3", "4", "5", "6", "7"]);
  expect(within(block).getByRole("textbox", { name: "Nombre" })).toHaveValue("Bloque");
  expect(within(block).getByRole("textbox", { name: "Nombre" })).toHaveFocus();
  expect(within(block).getByRole("spinbutton", { name: "Mínimo" })).toHaveValue(1);
  expect(within(block).getByRole("spinbutton", { name: "Máximo" })).toHaveValue(20);
  expect(within(block).getByText("Bloque · de 1 a 20 ítems · 0 preguntas")).toBeInTheDocument();
  expect(within(box()).getByRole("button", { name: "Agregar pregunta" })).toBeEnabled();
  expect(screen.getByRole("button", { name: "Agregar bloque" })).toBeDisabled();
  expect(screen.getByRole("button", { name: "Agregar bloque" })).toHaveAccessibleDescription("Ya hay un bloque.");
  // The block is not one of the questions.
  expect(screen.getByText("6 preguntas")).toBeInTheDocument();
});

// The name fills the original: with the menu in English on a form written in Spanish, the new block is «Bloque», the reference
// of its translation, as with any other text.
it("names a new block in the language of the original, with the menu in the other one", { timeout: 20_000 }, async () => {
  await act(() => i18n.changeLanguage("en"));
  try {
    server.use(http.get("/api/me", () => HttpResponse.json(profile("en"))));
    renderRouteWithProviders("/formularios/" + fixtureFormId);
    await opened("Edit Contact");

    await act(async () => { await userEvent.click(screen.getByRole("button", { name: "Add block" })); });
    const block = row("Edit Bloque");

    expect(within(block).getByRole("textbox", { name: "Name" })).toHaveValue("");
    expect(within(block).getByRole("textbox", { name: "Name" })).toHaveAccessibleDescription("Original (Spanish): Bloque");
    // The line also says that its name lacks the translation.
    expect(within(block).getByText(/^Block · 1 to 20 items · 0 questions · /)).toBeInTheDocument();
  } finally { await act(() => i18n.changeLanguage("es")); }
});
