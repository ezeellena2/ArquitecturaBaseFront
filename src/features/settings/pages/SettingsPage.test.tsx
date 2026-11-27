import { act, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HttpResponse, http } from "msw";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { toast } from "sonner";
import { renderRouteWithProviders } from "@/test/utils/renderWithProviders";
import { currentUser } from "@/test/mocks/handlers";
import { queryClient } from "@/shared/api/queryClient";
import { server } from "@/test/mocks/server";
import { systemSettingsQueryKey } from "../api/settings";

vi.mock("react-oidc-context", async () => ({ ...(await vi.importActual<typeof import("react-oidc-context")>("react-oidc-context")), useAuth: () => ({ isAuthenticated: true, isLoading: false, user: { access_token: "t" } }) }));
const defaults = { registrationMode: "InviteOnly", defaultCulture: "es", defaultTimeZoneId: "America/Argentina/Buenos_Aires", defaultPageSize: 20, revision: 1,
  branding: { appName: "Acceso", emailSenderName: "Acceso", logoVersion: null, iconVersion: null }, retention: { loginAuditMonths: 12, loginCodeDays: 30, invitationDays: 30 } };
let settings = { ...defaults };
let writes: unknown[];
beforeEach(() => {
  queryClient.clear(); settings = { ...defaults }; writes = [];
  server.use(http.get("/api/me", () => HttpResponse.json({ ...currentUser, permissions: ["settings.manage"] })),
    http.get("/api/settings", () => HttpResponse.json(settings)),
    http.patch("/api/settings", async ({ request }) => { const body = await request.json() as Record<string, unknown>; writes.push(body); settings = { ...settings, ...body, revision: settings.revision + 1 }; return new HttpResponse(null, { status: 204 }); }));
});
afterEach(() => { queryClient.clear(); toast.dismiss(); vi.restoreAllMocks(); });
// Each choice opens the list of the shared piece: the walks that change several settings take longer than five seconds.
vi.setConfig({ testTimeout: 15_000 });

// The language, «Filas por página», the registration and the time zone go in the shared piece for choosing (DS1-A, 2026-11-22):
// each button names its field and what is chosen, and its list chooses.
const sizes = () => screen.findByRole("button", { name: /^Filas por página / });
async function shownSize() {
  const [, valueId] = (await sizes()).getAttribute("aria-labelledby")!.split(" ");
  return document.getElementById(valueId!)?.textContent;
}
async function choose(field: RegExp, listName: string, option: string) {
  await userEvent.click(await screen.findByRole("button", { name: field }));
  await userEvent.click(within(await screen.findByRole("listbox", { name: listName })).getByRole("option", { name: option }));
}
async function pickSize(size: string) {
  await choose(/^Filas por página /, "Filas por página", size);
}
async function pickLanguage(language: "Español" | "Inglés") {
  await choose(/^Idioma predeterminado /, "Idioma predeterminado", language);
}
async function pickRegistration(mode: "Solo por invitación" | "Registro abierto") {
  await choose(/^Quién puede entrar /, "Quién puede entrar", mode);
}
async function openZones() {
  const trigger = await screen.findByRole("button", { name: /^Zona horaria predeterminada/ });
  await act(async () => { trigger.focus(); });
  await userEvent.keyboard("{Enter}");
  return screen.findByRole("listbox", { name: "Zona horaria predeterminada" });
}
async function pickZone(city: string) {
  const list = await openZones();
  await userEvent.type(screen.getByRole("combobox", { name: "Buscar en Zona horaria predeterminada" }), city);
  await userEvent.click(within(list).getByRole("option", { name: city }));
}
function expectNoEditor() {
  expect(screen.queryByRole("button", { name: /^Idioma predeterminado / })).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: /^Zona horaria predeterminada/ })).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: /^Filas por página / })).not.toBeInTheDocument();
}

describe("SettingsPage", () => {
  it("waits for the current values when returning with cached settings and saves their revision", async () => {
    const { router } = renderRouteWithProviders("/configuracion/listados");
    expect(await shownSize()).toBe("20");
    await act(() => router.navigate("/"));
    settings = { ...settings, defaultPageSize: 50, revision: 2 };
    let complete: (() => void) | undefined;
    server.use(http.get("/api/settings", async () => {
      await new Promise<void>(resolve => { complete = resolve; });
      return HttpResponse.json(settings);
    }));

    await act(() => router.navigate("/configuracion/listados"));
    await waitFor(() => expect(complete).toBeDefined());
    expect(screen.queryByRole("button", { name: /^Filas por página / })).not.toBeInTheDocument();
    complete?.();
    expect(await shownSize()).toBe("50");
    await pickSize("100");
    await userEvent.click(screen.getByRole("button", { name: "Guardar cambios" }));
    await waitFor(() => expect(writes).toEqual([{ expectedRevision: 2, defaultPageSize: 100 }]));
  });

  it("offers recovery instead of a stale editor when the fresh read fails", async () => {
    const error = vi.spyOn(toast, "error");
    queryClient.setQueryData(systemSettingsQueryKey, defaults);
    settings = { ...settings, defaultPageSize: 50, revision: 2 };
    server.use(http.get("/api/settings", () => HttpResponse.json({ code: "General.Unexpected" }, { status: 500 })));
    renderRouteWithProviders("/configuracion/listados");

    expect(await screen.findByText("Configuración no disponible")).toBeInTheDocument();
    expectNoEditor();
    expect(error).toHaveBeenCalledTimes(1);
    server.use(http.get("/api/settings", () => HttpResponse.json(settings)));
    await userEvent.click(screen.getByRole("button", { name: "Reintentar" }));
    expect(await shownSize()).toBe("50");
    expect(screen.getByRole("button", { name: "Guardar cambios" })).toBeDisabled();
  });

  it.each(["success", "failure"])("preserves the draft and its revision during a background refetch ending in %s", async result => {
    renderRouteWithProviders("/configuracion/listados");
    await pickSize("50");
    settings = { ...settings, defaultPageSize: 100, revision: 2 };
    let complete: (() => void) | undefined;
    server.use(http.get("/api/settings", async () => {
      await new Promise<void>(resolve => { complete = resolve; });
      return result === "success" ? HttpResponse.json(settings) : HttpResponse.json({ code: "General.Unexpected" }, { status: 500 });
    }));
    const refetch = queryClient.refetchQueries({ queryKey: systemSettingsQueryKey });
    await waitFor(() => expect(complete).toBeDefined());
    expect(await shownSize()).toBe("50");
    complete?.();
    await act(() => refetch);
    expect(await shownSize()).toBe("50");
    expect(screen.getByRole("button", { name: "Guardar cambios" })).toBeEnabled();
    await userEvent.click(screen.getByRole("button", { name: "Guardar cambios" }));
    await waitFor(() => expect(writes).toEqual([{ expectedRevision: 1, defaultPageSize: 50 }]));
  });

  it("presents all settings in three sections with one navigation link", async () => {
    const { router } = renderRouteWithProviders("/configuracion");
    expect(await screen.findByRole("heading", { level: 1, name: "Configuración" })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe("/configuracion");
    expect(await screen.findByRole("button", { name: /^Idioma predeterminado / })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^Zona horaria predeterminada/ })).toBeInTheDocument();
    await userEvent.click(await sizes());
    expect(within(await screen.findByRole("listbox", { name: "Filas por página" })).getAllByRole("option").map(option => option.textContent)).toEqual(["10", "20", "50", "100"]);
    await userEvent.keyboard("{Escape}");
    expect(screen.getByRole("region", { name: "Preferencias regionales" })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Listados" })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Registro de cuentas" })).toBeInTheDocument();
    expect(screen.getAllByRole("link").filter(link => link.getAttribute("href") === "/configuracion")).toHaveLength(1);
    for (const topic of ["idioma", "zona-horaria", "listados", "registro"]) expect(screen.getAllByRole("link").some(link => link.getAttribute("href") === `/configuracion/${topic}`)).toBe(false);
  });

  // The only list of time zones (DS1-A): the city and, in grey, the time of its country. The saved alias stays chosen,
  // and what travels is still the IANA identifier.
  it("offers the time zones by their city, with the saved one chosen even if the browser spells it another way", async () => {
    renderRouteWithProviders("/configuracion");
    expect(await screen.findByRole("button", { name: "Zona horaria predeterminada Buenos Aires" })).toBeInTheDocument();

    // It opens on the chosen one. (The option is found by the search's active one: naming some 420 options is slow.)
    const list = await openZones();
    const search = screen.getByRole("combobox", { name: "Buscar en Zona horaria predeterminada" });
    const chosen = document.getElementById(search.getAttribute("aria-activedescendant") ?? "");
    expect(chosen).toHaveAccessibleName("Buenos Aires");
    expect(chosen).toHaveAttribute("aria-selected", "true");
    expect(chosen).toHaveAccessibleDescription(/Argentina · GMT-3$/);
    // The search finds it by its city, its country or its identifier.
    await userEvent.type(search, "Urug");
    await userEvent.click(within(list).getByRole("option", { name: "Montevideo" }));
    await pickLanguage("Inglés");
    await userEvent.click(screen.getByRole("button", { name: "Guardar cambios" }));
    await waitFor(() => expect(writes).toEqual([{ expectedRevision: 1, defaultCulture: "en", defaultTimeZoneId: "America/Montevideo" }]));
  });

  it("puts the explanations in the information icons, with no lines under the titles, fields or options", async () => {
    renderRouteWithProviders("/configuracion");
    const regional = await screen.findByRole("region", { name: "Preferencias regionales" });
    // Que son valores iniciales, y no el idioma de todos, va en la (i) del título de la superficie.
    expect(within(regional).getByRole("button", { name: "Más información sobre Preferencias regionales" })).toHaveAccessibleDescription(
      "Valores iniciales para cuentas nuevas y pantallas públicas. Cada persona conserva sus preferencias.",
    );
    expect(screen.queryByText(/Valores iniciales para cuentas nuevas/, { selector: "p" })).not.toBeInTheDocument();
    // La de «Filas por página», junto a su etiqueta, y es la descripción del desplegable.
    expect(await sizes()).toHaveAccessibleDescription(
      "Cantidad inicial de filas. En cada listado se puede elegir otro tamaño.",
    );
    expect(screen.getByRole("button", { name: "Más información sobre Filas por página" })).toBeInTheDocument();
    expect(screen.queryByText(/Cantidad inicial de filas/, { selector: "p" })).not.toBeInTheDocument();
    // El efecto de cada registro lo explica la confirmación al guardar: las opciones no llevan texto debajo.
    await userEvent.click(screen.getByRole("button", { name: /^Quién puede entrar / }));
    const modes = await screen.findByRole("listbox", { name: "Quién puede entrar" });
    expect(within(modes).getByRole("option", { name: "Solo por invitación" })).not.toHaveAccessibleDescription();
    expect(within(modes).getByRole("option", { name: "Registro abierto" })).not.toHaveAccessibleDescription();
    await userEvent.keyboard("{Escape}");
  });

  it("says it is saving, and takes no second click, while the changes are on their way", async () => {
    let release = () => {};
    const answered = new Promise<void>(resolve => { release = resolve; });
    server.use(http.patch("/api/settings", async ({ request }) => {
      writes.push(await request.json());
      await answered;
      return new HttpResponse(null, { status: 204 });
    }));
    renderRouteWithProviders("/configuracion");
    await pickSize("50");
    await userEvent.click(screen.getByRole("button", { name: "Guardar cambios" }));

    const saving = await screen.findByRole("button", { name: "Guardando…" });
    expect(saving).toHaveAttribute("aria-busy", "true");
    expect(saving).toBeDisabled();
    await userEvent.click(saving);
    expect(writes).toHaveLength(1);

    release();
    await waitFor(() => expect(screen.getByRole("button", { name: "Guardar cambios" })).toBeDisabled());
  });

  it("says a conflict with what to do and without a code to report, which is for an unexpected error (O53)", async () => {
    const error = vi.spyOn(toast, "error");
    server.use(http.patch("/api/settings", () => HttpResponse.json({ code: "Settings.System.RevisionConflict", traceId: "conflict-trace" }, { status: 409 })));
    renderRouteWithProviders("/configuracion");
    await pickSize("50");
    await userEvent.click(screen.getByRole("button", { name: "Guardar cambios" }));
    await waitFor(() => expect(error).toHaveBeenCalledWith("Otro administrador cambió la configuración. Revisá los valores actuales.",
      expect.objectContaining({ description: undefined })));
  });

  it("says it is reading the current values while they arrive", async () => {
    server.use(http.patch("/api/settings", () => HttpResponse.json({ code: "Settings.System.RevisionConflict" }, { status: 409 })));
    renderRouteWithProviders("/configuracion");
    await pickSize("50");
    await userEvent.click(screen.getByRole("button", { name: "Guardar cambios" }));
    const header = screen.getByRole("heading", { level: 1, name: "Configuración" }).closest("header") as HTMLElement;
    const review = await within(header).findByRole("button", { name: "Revisar valores actuales" });
    let release = () => {};
    const answered = new Promise<void>(resolve => { release = resolve; });
    server.use(http.get("/api/settings", async () => { await answered; return HttpResponse.json(settings); }));

    await userEvent.click(review);

    const reading = await within(header).findByRole("button", { name: "Consultando…" });
    expect(reading).toHaveAttribute("aria-busy", "true");
    expect(reading).toBeDisabled();

    release();
    expect(await screen.findByRole("region", { name: "Revisar cambios" })).toBeInTheDocument();
  });

  it.each(["idioma", "zona-horaria", "listados", "registro"])("redirects the former %s URL to the unified screen", async topic => {
    const { router } = renderRouteWithProviders(`/configuracion/${topic}`);
    await screen.findByRole("button", { name: /^Idioma predeterminado / });
    expect(router.state.location.pathname).toBe("/configuracion");
  });

  it("saves changes from all sections in one explicit request", async () => {
    renderRouteWithProviders("/configuracion");
    await pickLanguage("Inglés");
    await pickZone("UTC");
    await pickSize("50");
    await pickRegistration("Registro abierto");
    expect(writes).toHaveLength(0);
    await userEvent.click(screen.getByRole("button", { name: "Guardar cambios" }));
    expect(writes).toHaveLength(0);
    await userEvent.click(within(await screen.findByRole("dialog")).getByRole("button", { name: "Guardar cambios" }));
    await waitFor(() => expect(writes).toEqual([{ expectedRevision: 1, defaultCulture: "en", defaultTimeZoneId: "UTC", defaultPageSize: 50, registrationMode: "Open" }]));
    await waitFor(() => expect(screen.getByRole("button", { name: "Guardar cambios" })).toBeDisabled());
  });
  it("saves only the selected topic and revision after an explicit action", async () => {
    const success = vi.spyOn(toast, "success");
    renderRouteWithProviders("/configuracion/listados");
    await pickSize("50");
    expect(writes).toHaveLength(0);
    await userEvent.click(screen.getByRole("button", { name: "Guardar cambios" }));
    await waitFor(() => expect(writes).toEqual([{ expectedRevision: 1, defaultPageSize: 50 }]));
    await waitFor(() => expect(success).toHaveBeenCalledTimes(1));
  });
  it("confirms the consequence before changing registration", async () => {
    renderRouteWithProviders("/configuracion/registro");
    await pickRegistration("Registro abierto");
    expect(writes).toHaveLength(0);
    await userEvent.click(screen.getByRole("button", { name: "Guardar cambios" }));
    const dialog = await screen.findByRole("dialog");
    await userEvent.click(within(dialog).getByRole("button", { name: "Guardar cambios" }));
    await waitFor(() => expect(writes).toEqual([{ expectedRevision: 1, registrationMode: "Open" }]));
  });
  it("retains the draft and blocks another uncertain write until review", async () => {
    const error = vi.spyOn(toast, "error");
    server.use(http.patch("/api/settings", async ({ request }) => { writes.push(await request.json()); return HttpResponse.error(); }));
    renderRouteWithProviders("/configuracion/listados");
    await pickSize("50");
    await userEvent.click(screen.getByRole("button", { name: "Guardar cambios" }));
    await waitFor(() => expect(error).toHaveBeenCalledTimes(1));
    expect(await shownSize()).toBe("50");
    expect(screen.getByRole("button", { name: "Guardar cambios" })).toHaveAttribute("aria-disabled", "true");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(writes).toHaveLength(1);
  });
  it("gives the pending review as the reason of the disabled Guardar and Descartar", async () => {
    server.use(http.patch("/api/settings", () => HttpResponse.json({ code: "Settings.System.RevisionConflict" }, { status: 409 })));
    renderRouteWithProviders("/configuracion/listados");
    await pickSize("50");
    await userEvent.click(screen.getByRole("button", { name: "Guardar cambios" }));
    const reason = "Primero revisá los valores actuales y elegí qué conservar.";
    await waitFor(() => expect(screen.getByRole("button", { name: "Guardar cambios" })).toHaveAccessibleDescription(reason));
    for (const name of ["Guardar cambios", "Descartar"]) {
      expect(screen.getByRole("button", { name })).toHaveAttribute("aria-disabled", "true");
      expect(screen.getByRole("button", { name })).toHaveAccessibleDescription(reason);
    }
    for (const text of screen.getAllByText(reason)) expect(text).not.toBeVisible();
    await userEvent.hover(screen.getByRole("button", { name: "Guardar cambios" }));
    expect(await screen.findByRole("tooltip")).toHaveTextContent(reason);
  });
  it("keeps validation by the field without an error notification", async () => {
    const error = vi.spyOn(toast, "error");
    server.use(http.patch("/api/settings", () => HttpResponse.json({ errors: { defaultCulture: ["Elegí un idioma admitido."] } }, { status: 400 })));
    renderRouteWithProviders("/configuracion/idioma");
    await pickLanguage("Inglés");
    await userEvent.click(screen.getByRole("button", { name: "Guardar cambios" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Elegí un idioma admitido.");
    expect(error).not.toHaveBeenCalled();
  });
  it("guards navigation with a draft and discards it explicitly", async () => {
    renderRouteWithProviders("/configuracion/idioma");
    await pickLanguage("Inglés");
    await userEvent.click(within(screen.getByRole("navigation", { name: "Navegación principal" })).getByRole("link", { name: "Inicio" }));
    const dialog = await screen.findByRole("dialog");
    await userEvent.click(within(dialog).getByRole("button", { name: "Descartar cambios" }));
    await waitFor(() => expect(writes).toHaveLength(0));
    expect(writes).toHaveLength(0);
  });

  it("compares a conflict and saves the preserved draft with the new revision", async () => {
    server.use(http.patch("/api/settings", async ({ request }) => {
      const body = await request.json(); writes.push(body);
      if (writes.length === 1) { settings = { ...settings, defaultPageSize: 100, revision: 2 }; return HttpResponse.json({ code: "Settings.System.RevisionConflict" }, { status: 409 }); }
      settings = { ...settings, defaultPageSize: 50, revision: 3 }; return new HttpResponse(null, { status: 204 });
    }));
    renderRouteWithProviders("/configuracion/listados");
    await pickSize("50");
    await userEvent.click(screen.getByRole("button", { name: "Guardar cambios" }));
    const main = within(screen.getByRole("main"));
    await userEvent.click(await main.findByRole("button", { name: "Revisar valores actuales" }));
    const table = await main.findByRole("table");
    expect(within(table).getByText("100")).toBeInTheDocument();
    expect(within(table).getByText("50")).toBeInTheDocument();
    await userEvent.click(main.getByRole("button", { name: "Conservar mis cambios" }));
    await userEvent.click(main.getByRole("button", { name: "Guardar cambios" }));
    await waitFor(() => expect(writes).toEqual([{ expectedRevision: 1, defaultPageSize: 50 }, { expectedRevision: 2, defaultPageSize: 50 }]));
  });

  it("keeps the settings header without an unsaved status while the draft changes", async () => {
    renderRouteWithProviders("/configuracion");
    await sizes();
    const header = screen.getByRole("heading", { level: 1, name: "Configuración" }).closest("header") as HTMLElement;
    expect(within(header).getByRole("button", { name: "Guardar cambios" })).toBeDisabled();

    await pickSize("50");

    // Guardar habilitado ya dice que hay cambios: la banda tiene el título y sus acciones, sin estado del borrador.
    expect(within(header).getByRole("button", { name: "Guardar cambios" })).toBeEnabled();
    expect(header.textContent).toBe("ConfiguraciónDescartarGuardar cambios");
    expect(screen.queryByText("Cambios sin guardar")).not.toBeInTheDocument();
  });

  it("puts the conflict choices in the comparison header", async () => {
    server.use(http.patch("/api/settings", async ({ request }) => {
      writes.push(await request.json());
      settings = { ...settings, defaultPageSize: 100, revision: 2 };
      return HttpResponse.json({ code: "Settings.System.RevisionConflict" }, { status: 409 });
    }));
    renderRouteWithProviders("/configuracion/listados");
    await pickSize("50");
    await userEvent.click(screen.getByRole("button", { name: "Guardar cambios" }));

    // Revisar actúa sobre toda la pantalla: va en la banda de Page, antes de Descartar y Guardar.
    const header = screen.getByRole("heading", { level: 1, name: "Configuración" }).closest("header") as HTMLElement;
    const reviewAction = await within(header).findByRole("button", { name: "Revisar valores actuales" });
    expect(within(header).getAllByRole("button").map(button => button.textContent)).toEqual(["Revisar valores actuales", "Descartar", "Guardar cambios"]);
    await userEvent.click(reviewAction);

    // Las elecciones del conflicto van al borde derecho de la banda de la comparación, no debajo de la tabla.
    const comparison = await screen.findByRole("region", { name: "Revisar cambios" });
    const title = within(comparison).getByRole("heading", { level: 2, name: "Revisar cambios" });
    const band = title.parentElement as HTMLElement;
    expect(within(band).getAllByRole("button").map(button => button.textContent)).toEqual(["Usar valores actuales", "Conservar mis cambios"]);
    expect(within(comparison).getAllByRole("button")).toHaveLength(2);

    // Revisar está arriba y la comparación aparece al final: el foco va a su título, y el siguiente Tab, a las
    // elecciones, sin recorrer antes todo el formulario.
    expect(title).toHaveFocus();
    await userEvent.tab();
    expect(within(band).getByRole("button", { name: "Usar valores actuales" })).toHaveFocus();
  });

  it("names the time zone in the comparison by its city, as its list does", async () => {
    server.use(http.patch("/api/settings", async ({ request }) => {
      writes.push(await request.json());
      // The other person also changed the time zone: the comparison shows only what differs (LR2-A).
      settings = { ...settings, defaultPageSize: 100, defaultTimeZoneId: "UTC", revision: 2 };
      return HttpResponse.json({ code: "Settings.System.RevisionConflict" }, { status: 409 });
    }));
    renderRouteWithProviders("/configuracion/listados");
    await pickSize("50");
    await userEvent.click(screen.getByRole("button", { name: "Guardar cambios" }));
    const header = screen.getByRole("heading", { level: 1, name: "Configuración" }).closest("header") as HTMLElement;
    await userEvent.click(await within(header).findByRole("button", { name: "Revisar valores actuales" }));
    const comparison = await screen.findByRole("region", { name: "Revisar cambios" });
    // The saved one and mine, as the list names them, not as the identifier that travels («America/Argentina/Buenos_Aires»).
    expect(within(comparison).getByRole("cell", { name: "UTC" })).toBeInTheDocument();
    expect(within(comparison).getByRole("cell", { name: "Buenos Aires" })).toBeInTheDocument();
    expect(within(comparison).queryByText(/America\//)).not.toBeInTheDocument();
  });

  it("does not repeat a write that was committed before a 500 response", async () => {
    server.use(http.patch("/api/settings", async ({ request }) => {
      writes.push(await request.json()); settings = { ...settings, defaultPageSize: 50, revision: 2 };
      return HttpResponse.json({ code: "General.Unexpected", traceId: "saved-500" }, { status: 500 });
    }));
    renderRouteWithProviders("/configuracion/listados");
    await pickSize("50");
    await userEvent.click(screen.getByRole("button", { name: "Guardar cambios" }));
    const main = within(screen.getByRole("main"));
    await userEvent.click(await main.findByRole("button", { name: "Revisar valores actuales" }));
    await userEvent.click(await main.findByRole("button", { name: "Conservar mis cambios" }));
    expect(main.getByRole("button", { name: "Guardar cambios" })).toBeDisabled();
    expect(writes).toHaveLength(1);
  });

  it("keeps edited fields while adopting concurrent changes to untouched fields", async () => {
    server.use(http.patch("/api/settings", async ({ request }) => {
      writes.push(await request.json());
      if (writes.length === 1) {
        settings = { ...settings, defaultTimeZoneId: "UTC", defaultPageSize: 100, revision: 2 };
        return HttpResponse.json({ code: "Settings.System.RevisionConflict" }, { status: 409 });
      }
      return new HttpResponse(null, { status: 204 });
    }));
    renderRouteWithProviders("/configuracion");
    await pickLanguage("Inglés");
    await pickSize("50");
    await userEvent.click(screen.getByRole("button", { name: "Guardar cambios" }));
    const main = within(screen.getByRole("main"));
    await userEvent.click(await main.findByRole("button", { name: "Revisar valores actuales" }));
    // Only what differs, each setting once with both values side by side (LR2-A): the registration did not change.
    expect(within(await main.findByRole("table")).getAllByRole("rowheader").map(header => header.textContent)).toEqual(["Idioma predeterminado", "Zona horaria predeterminada", "Filas por página"]);
    await userEvent.click(main.getByRole("button", { name: "Conservar mis cambios" }));
    expect(screen.getByRole("button", { name: "Zona horaria predeterminada UTC" })).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Guardar cambios" }));
    await waitFor(() => expect(writes).toEqual([
      { expectedRevision: 1, defaultCulture: "en", defaultPageSize: 50 },
      { expectedRevision: 2, defaultCulture: "en", defaultPageSize: 50 },
    ]));
  });

  it("associates multiple validation errors and clears only the corrected field", async () => {
    const error = vi.spyOn(toast, "error");
    server.use(http.patch("/api/settings", () => HttpResponse.json({ errors: {
      defaultCulture: ["Revisá el idioma."], defaultPageSize: ["Revisá el tamaño."],
    } }, { status: 400 })));
    renderRouteWithProviders("/configuracion");
    await pickLanguage("Inglés");
    await pickSize("50");
    await userEvent.click(screen.getByRole("button", { name: "Guardar cambios" }));
    expect(await screen.findByText("Revisá el idioma.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^Idioma predeterminado / })).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByRole("button", { name: /^Idioma predeterminado / })).toHaveAccessibleDescription("Revisá el idioma.");
    expect(await sizes()).toHaveAttribute("aria-invalid", "true");
    await pickLanguage("Español");
    expect(screen.queryByText("Revisá el idioma.")).not.toBeInTheDocument();
    expect(screen.getByText("Revisá el tamaño.")).toBeInTheDocument();
    expect(error).not.toHaveBeenCalled();
  });

  it("discards all sections without submitting or confirming registration", async () => {
    renderRouteWithProviders("/configuracion");
    await pickLanguage("Inglés");
    await pickSize("50");
    await pickRegistration("Registro abierto");
    await userEvent.click(screen.getByRole("button", { name: "Descartar" }));
    expect(screen.getByRole("button", { name: "Idioma predeterminado Español" })).toBeInTheDocument();
    expect(await sizes()).toHaveAccessibleName("Filas por página 20");
    expect(screen.getByRole("button", { name: "Quién puede entrar Solo por invitación" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Guardar cambios" })).toBeDisabled();
    expect(writes).toHaveLength(0);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("shows one load notification and a separate recovery surface", async () => {
    const error = vi.spyOn(toast, "error");
    server.use(http.get("/api/settings", () => HttpResponse.json({ code: "General.Unexpected", traceId: "load-settings" }, { status: 500 })));
    renderRouteWithProviders("/configuracion/idioma");
    expect(await screen.findByText("Configuración no disponible")).toBeInTheDocument();
    expect(error).toHaveBeenCalledTimes(1);
    expect(within(screen.getByRole("main")).queryByText(/load-settings/)).not.toBeInTheDocument();
  });

  it("denies direct access when settings.manage is absent", async () => {
    server.use(http.get("/api/me", () => HttpResponse.json(currentUser)));
    renderRouteWithProviders("/configuracion/zona-horaria");
    expect(await screen.findByRole("heading", { name: /no tenés permiso/i })).toBeInTheDocument();
    expectNoEditor();
  });

  // SP1-B (2026-11-24): a 403 when saving reads again what is in sight; with the permission gone, the screen shows the lack of
  // permission in place, without a discard dialog.
  it("shows the lack of permission in place after it is revoked, without a discard dialog", async () => {
    server.use(http.patch("/api/settings", () => {
      server.use(http.get("/api/me", () => HttpResponse.json({ ...currentUser, permissions: [] })));
      return HttpResponse.json({ code: "Http.Forbidden" }, { status: 403 });
    }));
    const { router } = renderRouteWithProviders("/configuracion/idioma");
    await pickLanguage("Inglés");
    await userEvent.click(screen.getByRole("button", { name: "Guardar cambios" }));
    expect(await screen.findByRole("heading", { level: 3, name: /no tenés permiso/i })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe("/configuracion");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("identifies a save that fails after leaving settings", async () => {
    const error = vi.spyOn(toast, "error");
    let complete: (() => void) | undefined;
    server.use(http.patch("/api/settings", async () => {
      await new Promise<void>(resolve => { complete = resolve; });
      return HttpResponse.json({ code: "General.Unexpected", traceId: "late-settings" }, { status: 500 });
    }));
    renderRouteWithProviders("/configuracion/listados");
    await pickSize("50");
    await userEvent.click(screen.getByRole("button", { name: "Guardar cambios" }));
    await waitFor(() => expect(complete).toBeDefined());
    await userEvent.click(within(screen.getByRole("navigation", { name: "Navegación principal" })).getByRole("link", { name: "Inicio" }));
    await waitFor(() => expectNoEditor());
    complete?.();
    await waitFor(() => expect(error).toHaveBeenCalledWith(expect.stringContaining("configuración"), expect.objectContaining({ duration: Infinity })));
  });

  // RC1-A: the three sign-in periods are saved together with the revision; one out of range is marked in its box without sending.
  it("saves the sign-in retention periods together and marks one out of range in its box", async () => {
    renderRouteWithProviders("/configuracion");
    const codes = await screen.findByRole("spinbutton", { name: /Borrar los códigos y enlaces de ingreso/ });
    expect(codes).toHaveValue(30);
    const invitations = screen.getByRole("spinbutton", { name: /Borrar las invitaciones viejas/ });
    await userEvent.clear(invitations); await userEvent.type(invitations, "6");
    await userEvent.click(screen.getByRole("button", { name: "Guardar cambios" }));
    expect(await screen.findByText("Elegí un número entre 7 y 3.650.")).toBeInTheDocument();
    expect(writes).toEqual([]);
    await userEvent.clear(invitations); await userEvent.type(invitations, "10");
    await userEvent.clear(codes); await userEvent.type(codes, "2");
    await userEvent.click(screen.getByRole("button", { name: "Guardar cambios" }));
    await waitFor(() => expect(writes).toEqual([{ expectedRevision: 1, retention: { loginAuditMonths: 12, loginCodeDays: 2, invitationDays: 10 } }]));
  });

  it("puts the server's message for a period under its box", async () => {
    server.use(http.patch("/api/settings", () => HttpResponse.json({ code: "Validation.Failed", errors: { "retention.loginAuditMonths": ["Elegí un número entre 1 y 120."] } }, { status: 400 })));
    renderRouteWithProviders("/configuracion");
    const months = await screen.findByRole("spinbutton", { name: /Quitar la IP y el navegador de un ingreso/ });
    await userEvent.clear(months); await userEvent.type(months, "24");
    await userEvent.click(screen.getByRole("button", { name: "Guardar cambios" }));
    await waitFor(() => expect(months).toHaveAccessibleDescription(expect.stringContaining("Elegí un número entre 1 y 120.")));
  });
});
