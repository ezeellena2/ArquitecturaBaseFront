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
const defaults = { registrationMode: "InviteOnly", defaultCulture: "es", defaultTimeZoneId: "America/Argentina/Buenos_Aires", defaultPageSize: 20, revision: 1 };
let settings = { ...defaults };
let writes: unknown[];
beforeEach(() => {
  queryClient.clear(); settings = { ...defaults }; writes = [];
  server.use(http.get("/api/me", () => HttpResponse.json({ ...currentUser, permissions: ["settings.manage"] })),
    http.get("/api/settings", () => HttpResponse.json(settings)),
    http.patch("/api/settings", async ({ request }) => { const body = await request.json() as Record<string, unknown>; writes.push(body); settings = { ...settings, ...body, revision: settings.revision + 1 }; return new HttpResponse(null, { status: 204 }); }));
});
afterEach(() => { queryClient.clear(); toast.dismiss(); vi.restoreAllMocks(); });

describe("SettingsPage", () => {
  it("waits for the current values when returning with cached settings and saves their revision", async () => {
    const { router } = renderRouteWithProviders("/configuracion/listados");
    expect(await screen.findByRole("combobox", { name: "Filas por página" })).toHaveValue("20");
    await act(() => router.navigate("/"));
    settings = { ...settings, defaultPageSize: 50, revision: 2 };
    let complete: (() => void) | undefined;
    server.use(http.get("/api/settings", async () => {
      await new Promise<void>(resolve => { complete = resolve; });
      return HttpResponse.json(settings);
    }));

    await act(() => router.navigate("/configuracion/listados"));
    await waitFor(() => expect(complete).toBeDefined());
    expect(screen.queryByRole("combobox", { name: "Filas por página" })).not.toBeInTheDocument();
    complete?.();
    expect(await screen.findByRole("combobox", { name: "Filas por página" })).toHaveValue("50");
    await userEvent.selectOptions(screen.getByRole("combobox", { name: "Filas por página" }), "100");
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
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
    expect(error).toHaveBeenCalledTimes(1);
    server.use(http.get("/api/settings", () => HttpResponse.json(settings)));
    await userEvent.click(screen.getByRole("button", { name: "Reintentar" }));
    expect(await screen.findByRole("combobox", { name: "Filas por página" })).toHaveValue("50");
    expect(screen.getByRole("button", { name: "Guardar cambios" })).toBeDisabled();
  });

  it.each(["success", "failure"])("preserves the draft and its revision during a background refetch ending in %s", async result => {
    renderRouteWithProviders("/configuracion/listados");
    await userEvent.selectOptions(await screen.findByRole("combobox", { name: "Filas por página" }), "50");
    settings = { ...settings, defaultPageSize: 100, revision: 2 };
    let complete: (() => void) | undefined;
    server.use(http.get("/api/settings", async () => {
      await new Promise<void>(resolve => { complete = resolve; });
      return result === "success" ? HttpResponse.json(settings) : HttpResponse.json({ code: "General.Unexpected" }, { status: 500 });
    }));
    const refetch = queryClient.refetchQueries({ queryKey: systemSettingsQueryKey });
    await waitFor(() => expect(complete).toBeDefined());
    expect(screen.getByRole("combobox", { name: "Filas por página" })).toHaveValue("50");
    complete?.();
    await act(() => refetch);
    expect(screen.getByRole("combobox", { name: "Filas por página" })).toHaveValue("50");
    expect(screen.getByRole("button", { name: "Guardar cambios" })).toBeEnabled();
    await userEvent.click(screen.getByRole("button", { name: "Guardar cambios" }));
    await waitFor(() => expect(writes).toEqual([{ expectedRevision: 1, defaultPageSize: 50 }]));
  });

  it("presents all settings in three sections with one navigation link", async () => {
    const { router } = renderRouteWithProviders("/configuracion");
    expect(await screen.findByRole("heading", { level: 1, name: "Configuración" })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe("/configuracion");
    expect(await screen.findAllByRole("combobox")).toHaveLength(3);
    expect(screen.getByRole("region", { name: "Preferencias regionales" })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Listados" })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Registro de cuentas" })).toBeInTheDocument();
    expect(screen.getAllByRole("link").filter(link => link.getAttribute("href") === "/configuracion")).toHaveLength(1);
    for (const topic of ["idioma", "zona-horaria", "listados", "registro"]) expect(screen.getAllByRole("link").some(link => link.getAttribute("href") === `/configuracion/${topic}`)).toBe(false);
  });

  it.each(["idioma", "zona-horaria", "listados", "registro"])("redirects the former %s URL to the unified screen", async topic => {
    const { router } = renderRouteWithProviders(`/configuracion/${topic}`);
    await screen.findByRole("combobox", { name: "Idioma predeterminado" });
    expect(router.state.location.pathname).toBe("/configuracion");
  });

  it("saves changes from all sections in one explicit request", async () => {
    renderRouteWithProviders("/configuracion");
    await userEvent.selectOptions(await screen.findByRole("combobox", { name: "Idioma predeterminado" }), "en");
    await userEvent.selectOptions(screen.getByRole("combobox", { name: "Zona horaria predeterminada" }), "UTC");
    await userEvent.selectOptions(screen.getByRole("combobox", { name: "Filas por página" }), "50");
    await userEvent.click(screen.getByRole("radio", { name: "Registro abierto" }));
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
    await userEvent.selectOptions(await screen.findByRole("combobox", { name: "Filas por página" }), "50");
    expect(writes).toHaveLength(0);
    await userEvent.click(screen.getByRole("button", { name: "Guardar cambios" }));
    await waitFor(() => expect(writes).toEqual([{ expectedRevision: 1, defaultPageSize: 50 }]));
    await waitFor(() => expect(success).toHaveBeenCalledTimes(1));
  });
  it("confirms the consequence before changing registration", async () => {
    renderRouteWithProviders("/configuracion/registro");
    await userEvent.click(await screen.findByRole("radio", { name: "Registro abierto" }));
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
    await userEvent.selectOptions(await screen.findByRole("combobox", { name: "Filas por página" }), "50");
    await userEvent.click(screen.getByRole("button", { name: "Guardar cambios" }));
    await waitFor(() => expect(error).toHaveBeenCalledTimes(1));
    expect(screen.getByRole("combobox", { name: "Filas por página" })).toHaveValue("50");
    expect(screen.getByRole("button", { name: "Guardar cambios" })).toBeDisabled();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(writes).toHaveLength(1);
  });
  it("keeps validation by the field without an error notification", async () => {
    const error = vi.spyOn(toast, "error");
    server.use(http.patch("/api/settings", () => HttpResponse.json({ errors: { defaultCulture: ["Elegí un idioma admitido."] } }, { status: 400 })));
    renderRouteWithProviders("/configuracion/idioma");
    await userEvent.selectOptions(await screen.findByRole("combobox", { name: "Idioma predeterminado" }), "en");
    await userEvent.click(screen.getByRole("button", { name: "Guardar cambios" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Elegí un idioma admitido.");
    expect(error).not.toHaveBeenCalled();
  });
  it("guards navigation with a draft and discards it explicitly", async () => {
    renderRouteWithProviders("/configuracion/idioma");
    await userEvent.selectOptions(await screen.findByRole("combobox", { name: "Idioma predeterminado" }), "en");
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
    await userEvent.selectOptions(await screen.findByRole("combobox", { name: "Filas por página" }), "50");
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
    const size = await screen.findByRole("combobox", { name: "Filas por página" });
    const header = screen.getByRole("heading", { level: 1, name: "Configuración" }).closest("header") as HTMLElement;
    expect(within(header).getByRole("button", { name: "Guardar cambios" })).toBeDisabled();

    await userEvent.selectOptions(size, "50");

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
    await userEvent.selectOptions(await screen.findByRole("combobox", { name: "Filas por página" }), "50");
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

  it("does not repeat a write that was committed before a 500 response", async () => {
    server.use(http.patch("/api/settings", async ({ request }) => {
      writes.push(await request.json()); settings = { ...settings, defaultPageSize: 50, revision: 2 };
      return HttpResponse.json({ code: "General.Unexpected", traceId: "saved-500" }, { status: 500 });
    }));
    renderRouteWithProviders("/configuracion/listados");
    await userEvent.selectOptions(await screen.findByRole("combobox", { name: "Filas por página" }), "50");
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
    await userEvent.selectOptions(await screen.findByRole("combobox", { name: "Idioma predeterminado" }), "en");
    await userEvent.selectOptions(screen.getByRole("combobox", { name: "Filas por página" }), "50");
    await userEvent.click(screen.getByRole("button", { name: "Guardar cambios" }));
    const main = within(screen.getByRole("main"));
    await userEvent.click(await main.findByRole("button", { name: "Revisar valores actuales" }));
    expect(within(await main.findByRole("table")).getAllByRole("rowheader")).toHaveLength(4);
    await userEvent.click(main.getByRole("button", { name: "Conservar mis cambios" }));
    expect(screen.getByRole("combobox", { name: "Zona horaria predeterminada" })).toHaveValue("UTC");
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
    await userEvent.selectOptions(await screen.findByRole("combobox", { name: "Idioma predeterminado" }), "en");
    await userEvent.selectOptions(screen.getByRole("combobox", { name: "Filas por página" }), "50");
    await userEvent.click(screen.getByRole("button", { name: "Guardar cambios" }));
    expect(await screen.findByText("Revisá el idioma.")).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Idioma predeterminado" })).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByRole("combobox", { name: "Filas por página" })).toHaveAttribute("aria-invalid", "true");
    await userEvent.selectOptions(screen.getByRole("combobox", { name: "Idioma predeterminado" }), "es");
    expect(screen.queryByText("Revisá el idioma.")).not.toBeInTheDocument();
    expect(screen.getByText("Revisá el tamaño.")).toBeInTheDocument();
    expect(error).not.toHaveBeenCalled();
  });

  it("discards all sections without submitting or confirming registration", async () => {
    renderRouteWithProviders("/configuracion");
    await userEvent.selectOptions(await screen.findByRole("combobox", { name: "Idioma predeterminado" }), "en");
    await userEvent.selectOptions(screen.getByRole("combobox", { name: "Filas por página" }), "50");
    await userEvent.click(screen.getByRole("radio", { name: "Registro abierto" }));
    await userEvent.click(screen.getByRole("button", { name: "Descartar" }));
    expect(screen.getByRole("combobox", { name: "Idioma predeterminado" })).toHaveValue("es");
    expect(screen.getByRole("combobox", { name: "Filas por página" })).toHaveValue("20");
    expect(screen.getByRole("radio", { name: "Solo por invitación" })).toBeChecked();
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
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
  });

  it("redirects after permission is revoked without a discard dialog", async () => {
    server.use(http.patch("/api/settings", () => HttpResponse.json({ code: "Http.Forbidden" }, { status: 403 })));
    renderRouteWithProviders("/configuracion/idioma");
    await userEvent.selectOptions(await screen.findByRole("combobox", { name: "Idioma predeterminado" }), "en");
    await userEvent.click(screen.getByRole("button", { name: "Guardar cambios" }));
    expect(await screen.findByRole("heading", { name: /no tenés permiso/i })).toBeInTheDocument();
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
    await userEvent.selectOptions(await screen.findByRole("combobox", { name: "Filas por página" }), "50");
    await userEvent.click(screen.getByRole("button", { name: "Guardar cambios" }));
    await waitFor(() => expect(complete).toBeDefined());
    await userEvent.click(within(screen.getByRole("navigation", { name: "Navegación principal" })).getByRole("link", { name: "Inicio" }));
    await waitFor(() => expect(screen.queryByRole("combobox")).not.toBeInTheDocument());
    complete?.();
    await waitFor(() => expect(error).toHaveBeenCalledWith(expect.stringContaining("configuración"), expect.objectContaining({ duration: Infinity })));
  });
});
