import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HttpResponse, http } from "msw";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { toast } from "sonner";
import { renderRouteWithProviders } from "@/test/utils/renderWithProviders";
import { currentUser } from "@/test/mocks/handlers";
import { queryClient } from "@/shared/api/queryClient";
import { server } from "@/test/mocks/server";

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
  it("redirects to language and presents one setting per menu", async () => {
    const { router } = renderRouteWithProviders("/configuracion");
    expect(await screen.findByRole("heading", { name: "Idioma" })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe("/configuracion/idioma");
    expect(await screen.findAllByRole("combobox")).toHaveLength(1);
    for (const path of ["idioma", "zona-horaria", "listados", "registro"]) expect(screen.getAllByRole("link").some(link => link.getAttribute("href") === '/configuracion/' + path)).toBe(true);
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
    await userEvent.click(within(dialog).getByRole("button", { name: "Cambiar" }));
    await waitFor(() => expect(writes).toEqual([{ expectedRevision: 1, registrationMode: "Open" }]));
  });
  it("retains the draft and blocks another uncertain write until review", async () => {
    const error = vi.spyOn(toast, "error");
    server.use(http.patch("/api/settings", async ({ request }) => { writes.push(await request.json()); return HttpResponse.error(); }));
    renderRouteWithProviders("/configuracion/listados");
    await userEvent.selectOptions(await screen.findByRole("combobox"), "50");
    await userEvent.click(screen.getByRole("button", { name: "Guardar cambios" }));
    await waitFor(() => expect(error).toHaveBeenCalledTimes(1));
    expect(screen.getByRole("combobox")).toHaveValue("50");
    expect(screen.getByRole("button", { name: "Guardar cambios" })).toBeDisabled();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(writes).toHaveLength(1);
  });
  it("keeps validation by the field without an error notification", async () => {
    const error = vi.spyOn(toast, "error");
    server.use(http.patch("/api/settings", () => HttpResponse.json({ errors: { defaultCulture: ["Elegí un idioma admitido."] } }, { status: 400 })));
    renderRouteWithProviders("/configuracion/idioma");
    await userEvent.selectOptions(await screen.findByRole("combobox"), "en");
    await userEvent.click(screen.getByRole("button", { name: "Guardar cambios" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Elegí un idioma admitido.");
    expect(error).not.toHaveBeenCalled();
  });
  it("guards navigation with a draft and discards it explicitly", async () => {
    renderRouteWithProviders("/configuracion/idioma");
    await userEvent.selectOptions(await screen.findByRole("combobox"), "en");
    await userEvent.click(screen.getByRole("link", { name: "Zona horaria" }));
    const dialog = await screen.findByRole("dialog");
    await userEvent.click(within(dialog).getByRole("button", { name: "Descartar cambios" }));
    expect(await screen.findByRole("heading", { name: "Zona horaria" })).toBeInTheDocument();
    expect(writes).toHaveLength(0);
  });

  it("compares a conflict and saves the preserved draft with the new revision", async () => {
    server.use(http.patch("/api/settings", async ({ request }) => {
      const body = await request.json(); writes.push(body);
      if (writes.length === 1) { settings = { ...settings, defaultPageSize: 100, revision: 2 }; return HttpResponse.json({ code: "Settings.System.RevisionConflict" }, { status: 409 }); }
      settings = { ...settings, defaultPageSize: 50, revision: 3 }; return new HttpResponse(null, { status: 204 });
    }));
    renderRouteWithProviders("/configuracion/listados");
    await userEvent.selectOptions(await screen.findByRole("combobox"), "50");
    await userEvent.click(screen.getByRole("button", { name: "Guardar cambios" }));
    const main = within(screen.getByRole("main"));
    await userEvent.click(await main.findByRole("button", { name: "Revisar valores actuales" }));
    const table = await main.findByRole("table");
    expect(within(table).getByText("100")).toBeInTheDocument();
    expect(within(table).getByText("50")).toBeInTheDocument();
    await userEvent.click(main.getByRole("button", { name: "Conservar mi cambio" }));
    await userEvent.click(main.getByRole("button", { name: "Guardar cambios" }));
    await waitFor(() => expect(writes).toEqual([{ expectedRevision: 1, defaultPageSize: 50 }, { expectedRevision: 2, defaultPageSize: 50 }]));
  });

  it("does not repeat a write that was committed before a 500 response", async () => {
    server.use(http.patch("/api/settings", async ({ request }) => {
      writes.push(await request.json()); settings = { ...settings, defaultPageSize: 50, revision: 2 };
      return HttpResponse.json({ code: "General.Unexpected", traceId: "saved-500" }, { status: 500 });
    }));
    renderRouteWithProviders("/configuracion/listados");
    await userEvent.selectOptions(await screen.findByRole("combobox"), "50");
    await userEvent.click(screen.getByRole("button", { name: "Guardar cambios" }));
    const main = within(screen.getByRole("main"));
    await userEvent.click(await main.findByRole("button", { name: "Revisar valores actuales" }));
    await userEvent.click(await main.findByRole("button", { name: "Conservar mi cambio" }));
    expect(main.getByRole("button", { name: "Guardar cambios" })).toBeDisabled();
    expect(writes).toHaveLength(1);
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
    await userEvent.selectOptions(await screen.findByRole("combobox"), "en");
    await userEvent.click(screen.getByRole("button", { name: "Guardar cambios" }));
    expect(await screen.findByRole("heading", { name: /no tenés permiso/i })).toBeInTheDocument();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("identifies a save that fails after leaving the topic", async () => {
    const error = vi.spyOn(toast, "error");
    let complete: (() => void) | undefined;
    server.use(http.patch("/api/settings", async () => {
      await new Promise<void>(resolve => { complete = resolve; });
      return HttpResponse.json({ code: "General.Unexpected", traceId: "late-settings" }, { status: 500 });
    }));
    renderRouteWithProviders("/configuracion/listados");
    await userEvent.selectOptions(await screen.findByRole("combobox"), "50");
    await userEvent.click(screen.getByRole("button", { name: "Guardar cambios" }));
    await waitFor(() => expect(complete).toBeDefined());
    await userEvent.click(screen.getByRole("link", { name: "Idioma" }));
    expect(await screen.findByRole("heading", { name: "Idioma" })).toBeInTheDocument();
    complete?.();
    await waitFor(() => expect(error).toHaveBeenCalledWith(expect.stringContaining("Listados"), expect.objectContaining({ duration: Infinity })));
  });
});
