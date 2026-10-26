import { act, fireEvent, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HttpResponse, http } from "msw";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { toast } from "sonner";
import { renderRouteWithProviders } from "@/test/utils/renderWithProviders";
import { currentUser } from "@/test/mocks/handlers";
import { server } from "@/test/mocks/server";
import { queryClient } from "@/shared/api/queryClient";
import { initialAppearance } from "@/shared/lib/appearance";

vi.mock("react-oidc-context", async () => ({ ...(await vi.importActual<typeof import("react-oidc-context")>("react-oidc-context")), useAuth: () => ({ isAuthenticated: true, isLoading: false, user: { access_token: "t" } }) }));
let settings = { registrationMode: "InviteOnly", defaultCulture: "es", defaultTimeZoneId: "UTC", defaultPageSize: 20, revision: 7, appearance: { ...initialAppearance } };
let writes: Record<string, unknown>[];
beforeEach(() => {
  queryClient.clear(); writes = [];
  settings = { ...settings, revision: 7, appearance: { ...initialAppearance } };
  server.use(http.get("/api/me", () => HttpResponse.json({ ...currentUser, permissions: ["settings.manage"] })),
    http.get("/api/settings", () => HttpResponse.json(settings)),
    http.get("/api/settings/presentation", () => HttpResponse.json(settings)),
    http.patch("/api/settings", async ({ request }) => { const body = await request.json() as Record<string, unknown>; writes.push(body); settings = { ...settings, ...body, revision: settings.revision + 1 }; return new HttpResponse(null, { status: 204 }); }));
});
afterEach(() => { queryClient.clear(); toast.dismiss(); vi.restoreAllMocks(); });
const edit = async (color = "#335f85") => { const input = await screen.findByLabelText("Botones y enlaces"); fireEvent.change(input, { target: { value: color } }); };

describe("AppearancePage", () => {
  it("shows field validation once next to the color and retains the draft", async () => {
    const error = vi.spyOn(toast, "error");
    server.use(http.patch("/api/settings", () => HttpResponse.json({ code: "Validation.Failed", errors: { "appearance.primaryColor": ["Elegí un color en formato #RRGGBB."] } }, { status: 400 })));
    renderRouteWithProviders("/configuracion/apariencia"); await edit();
    await userEvent.click(screen.getByRole("button", { name: "Guardar cambios" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Elegí un color en formato #RRGGBB.");
    expect(screen.getByLabelText("Botones y enlaces")).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByLabelText("Botones y enlaces")).toHaveValue("#335f85");
    expect(error).not.toHaveBeenCalled();
  });

  it("rereads an uncertain committed write instead of sending it again", async () => {
    const error = vi.spyOn(toast, "error");
    server.use(http.patch("/api/settings", async ({ request }) => {
      const body = await request.json() as Record<string, unknown>; writes.push(body);
      settings = { ...settings, ...body, revision: 8 };
      return HttpResponse.json({ code: "General.Unexpected", traceId: "appearance-trace" }, { status: 500 });
    }));
    renderRouteWithProviders("/configuracion/apariencia"); await edit();
    await userEvent.click(screen.getByRole("button", { name: "Guardar cambios" }));
    await waitFor(() => expect(error).toHaveBeenCalledTimes(1));
    expect(screen.getByLabelText("Botones y enlaces")).toHaveValue("#335f85");
    expect(screen.getByRole("button", { name: "Guardar cambios" })).toBeDisabled();
    await userEvent.click(screen.getAllByRole("button", { name: "Revisar valores actuales" })[0]);
    await userEvent.click(await screen.findByRole("button", { name: "Usar valores actuales" }));
    expect(screen.getByRole("button", { name: "Guardar cambios" })).toBeDisabled();
    expect(writes).toHaveLength(1);
  });
  it("gives the pending review as the reason of the disabled Guardar and Descartar", async () => {
    server.use(http.patch("/api/settings", () => HttpResponse.json({ code: "Settings.System.RevisionConflict" }, { status: 409 })));
    renderRouteWithProviders("/configuracion/apariencia"); await edit();
    await userEvent.click(screen.getByRole("button", { name: "Guardar cambios" }));
    const reason = "Primero revisá los valores actuales y elegí qué conservar.";
    await waitFor(() => expect(screen.getByRole("button", { name: "Guardar cambios" })).toHaveAccessibleDescription(reason));
    for (const name of ["Guardar cambios", "Descartar"]) {
      expect(screen.getByRole("button", { name })).toBeDisabled();
      expect(screen.getByRole("button", { name })).toHaveAccessibleDescription(reason);
    }
    for (const text of screen.getAllByText(reason)) expect(text).not.toBeVisible();
  });

  it("recovers an initial read failure with one notification and a fresh revision", async () => {
    const error = vi.spyOn(toast, "error");
    server.use(http.get("/api/settings", () => HttpResponse.json({ code: "General.Unexpected" }, { status: 500 })));
    renderRouteWithProviders("/configuracion/apariencia");
    expect(await screen.findByText("Configuración no disponible")).toBeInTheDocument();
    expect(screen.queryByLabelText("Botones y enlaces")).not.toBeInTheDocument();
    expect(error).toHaveBeenCalledTimes(1);
    settings.revision = 9;
    server.use(http.get("/api/settings", () => HttpResponse.json(settings)));
    await userEvent.click(screen.getByRole("button", { name: "Reintentar" })); await edit();
    await userEvent.click(screen.getByRole("button", { name: "Guardar cambios" }));
    await waitFor(() => expect(writes[0]?.expectedRevision).toBe(9));
  });

  it("blocks the route without settings.manage", async () => {
    const read = vi.fn(() => HttpResponse.json(settings));
    server.use(http.get("/api/me", () => HttpResponse.json({ ...currentUser, permissions: ["users.read"] })), http.get("/api/settings", read));
    const { router } = renderRouteWithProviders("/configuracion/apariencia");
    await waitFor(() => expect(router.state.location.pathname).toBe("/sin-permiso"));
    expect(read).not.toHaveBeenCalled();
    expect(writes).toEqual([]);
  });

  it("previews a draft locally and saves the complete palette with its revision", async () => {
    renderRouteWithProviders("/configuracion/apariencia");
    await edit();
    expect(document.documentElement.style.getPropertyValue("--primary")).toBe("");
    expect(writes).toEqual([]);
    await userEvent.click(screen.getByRole("button", { name: "Guardar cambios" }));
    await waitFor(() => expect(writes).toEqual([{ expectedRevision: 7, appearance: { ...initialAppearance, primaryColor: "#335f85" } }]));
    await waitFor(() => expect(document.documentElement.style.getPropertyValue("--primary")).toBe("#335f85"));
  });

  it("keeps the header without an unsaved status after picking a color", async () => {
    renderRouteWithProviders("/configuracion/apariencia"); await edit();
    const header = screen.getByRole("heading", { level: 1, name: "Apariencia" }).closest("header") as HTMLElement;
    // Guardar habilitado ya dice que hay cambios: la banda tiene el título y sus acciones, sin estado del borrador.
    expect(within(header).getByRole("button", { name: "Guardar cambios" })).toBeEnabled();
    expect(header.textContent).toBe("AparienciaDescartarGuardar cambios");
    expect(screen.queryByText("Cambios sin guardar")).not.toBeInTheDocument();
  });

  it("offers restoring the initial colors from the colors header", async () => {
    settings.appearance = { ...initialAppearance, primaryColor: "#335F85" };
    renderRouteWithProviders("/configuracion/apariencia");
    const colors = await screen.findByRole("region", { name: "Colores del sistema" });
    // Restaurar actúa sobre los cuatro colores: va al borde derecho de su banda, no al pie de la superficie.
    const band = within(colors).getByRole("heading", { level: 2, name: "Colores del sistema" }).parentElement as HTMLElement;
    expect(within(colors).getAllByRole("button")).toEqual([within(band).getByRole("button", { name: "Restaurar colores iniciales" })]);
    await userEvent.click(within(band).getByRole("button", { name: "Restaurar colores iniciales" }));
    expect(screen.getByRole("button", { name: "Guardar cambios" })).toBeEnabled();
    expect(writes).toEqual([]);
  });

  it("keeps the draft after a conflict and rereads the revision before retrying", async () => {
    server.use(http.patch("/api/settings", () => { settings = { ...settings, revision: 8, appearance: { ...initialAppearance, menuColor: "#243B53" } }; return HttpResponse.json({ code: "Settings.System.RevisionConflict" }, { status: 409 }); }));
    renderRouteWithProviders("/configuracion/apariencia"); await edit();
    await userEvent.click(screen.getByRole("button", { name: "Guardar cambios" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Guardar cambios" })).toBeDisabled());
    // Revisar va en la banda de Page, antes de Descartar; las elecciones, en el encabezado de la comparación.
    const header = screen.getByRole("heading", { level: 1, name: "Apariencia" }).closest("header") as HTMLElement;
    expect(within(header).getAllByRole("button").map(button => button.textContent)).toEqual(["Revisar valores actuales", "Descartar", "Guardar cambios"]);
    await userEvent.click(within(header).getByRole("button", { name: "Revisar valores actuales" }));
    const comparison = await screen.findByRole("region", { name: "Revisar cambios" });
    const title = within(comparison).getByRole("heading", { level: 2, name: "Revisar cambios" });
    const band = title.parentElement as HTMLElement;
    expect(within(band).getAllByRole("button").map(button => button.textContent)).toEqual(["Usar valores actuales", "Conservar mis cambios"]);
    // La comparación aparece después de los colores y la vista previa: el foco va a su título, y el siguiente Tab,
    // a las elecciones.
    expect(title).toHaveFocus();
    await userEvent.tab();
    expect(within(band).getByRole("button", { name: "Usar valores actuales" })).toHaveFocus();
    await userEvent.click(within(band).getByRole("button", { name: "Conservar mis cambios" }));
    expect(screen.getByLabelText("Botones y enlaces")).toHaveValue("#335f85");
    server.use(http.patch("/api/settings", async ({ request }) => { writes.push(await request.json() as Record<string, unknown>); return new HttpResponse(null, { status: 204 }); }));
    await userEvent.click(screen.getByRole("button", { name: "Guardar cambios" }));
    await waitFor(() => expect(writes[0]?.expectedRevision).toBe(8));
  });

  it("guards navigation and restores the initial palette only when the reset draft is saved", async () => {
    settings.appearance = { ...initialAppearance, primaryColor: "#335F85" };
    const { router } = renderRouteWithProviders("/configuracion/apariencia");
    await screen.findByLabelText("Botones y enlaces");
    await userEvent.click(screen.getByRole("button", { name: "Restaurar colores iniciales" }));
    expect(writes).toEqual([]);
    await act(() => router.navigate("/"));
    expect(await screen.findByRole("dialog", { name: "¿Descartar los cambios?" })).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Seguir editando" }));
    await userEvent.click(screen.getByRole("button", { name: "Guardar cambios" }));
    await waitFor(() => expect(writes[0]?.appearance).toEqual(initialAppearance));
  });
});
