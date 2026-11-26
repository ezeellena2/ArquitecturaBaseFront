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

// RC4-A: Configuración › Formularios, board CF1.
const defaults = { maxFileSizeMiB: 25, dailyRereadsPerAsker: 5, similarDocumentsToSuggest: 3, proposedExpiryDays: 90, discardedRetentionDays: 90, revision: 0 };
let settings = { ...defaults };
let writes: unknown[];
beforeEach(() => {
  queryClient.clear(); settings = { ...defaults }; writes = [];
  server.use(http.get("/api/me", () => HttpResponse.json({ ...currentUser, permissions: ["settings.manage"] })),
    http.get("/api/forms/settings", () => HttpResponse.json(settings)),
    http.put("/api/forms/settings", async ({ request }) => {
      const body = await request.json() as Record<string, number>;
      writes.push(body);
      const { expectedRevision, ...values } = body;
      settings = { ...settings, ...values, revision: (expectedRevision ?? 0) + 1 };
      return HttpResponse.json(settings);
    }));
});
afterEach(() => { queryClient.clear(); toast.dismiss(); vi.restoreAllMocks(); });

const field = (name: string) => screen.getByRole("spinbutton", { name: new RegExp(name) });

describe("FormSettingsPage", () => {
  it("shows the files and the received documents with today's values and saves every number with the revision read", async () => {
    renderRouteWithProviders("/configuracion/formularios");
    expect(await screen.findByRole("spinbutton", { name: /Tamaño máximo por archivo/ })).toHaveValue(25);
    expect(screen.getByRole("heading", { name: "Archivos" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Documentos recibidos" })).toBeInTheDocument();
    expect(field("Relecturas por persona y día")).toHaveValue(5);
    expect(field("Sugerir armar un formulario desde")).toHaveValue(3);
    expect(field("Vencer los propuestos sin revisar")).toHaveValue(90);
    expect(field("Borrar los descartados")).toHaveValue(90);
    expect(screen.getByRole("button", { name: "Guardar cambios" })).toBeDisabled();

    await userEvent.clear(field("Tamaño máximo por archivo"));
    await userEvent.type(field("Tamaño máximo por archivo"), "10");
    await userEvent.clear(field("Borrar los descartados"));
    await userEvent.type(field("Borrar los descartados"), "180");
    await userEvent.click(screen.getByRole("button", { name: "Guardar cambios" }));

    await waitFor(() => expect(writes).toEqual([{ expectedRevision: 0, maxFileSizeMiB: 10, dailyRereadsPerAsker: 5, similarDocumentsToSuggest: 3,
      proposedExpiryDays: 90, discardedRetentionDays: 180 }]));
    expect(await screen.findByText("Guardamos la configuración de Formularios.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Guardar cambios" })).toBeDisabled();
  });

  it("marks a number out of its range, sends nothing and checks it again as it is written", async () => {
    renderRouteWithProviders("/configuracion/formularios");
    await userEvent.clear(await screen.findByRole("spinbutton", { name: /Sugerir armar un formulario desde/ }));
    await userEvent.type(field("Sugerir armar un formulario desde"), "1");
    await userEvent.click(screen.getByRole("button", { name: "Guardar cambios" }));

    expect(await screen.findByText("Elegí un número entre 2 y 20.")).toBeInTheDocument();
    expect(field("Sugerir armar un formulario desde")).toHaveFocus();
    expect(writes).toEqual([]);
    await userEvent.type(field("Sugerir armar un formulario desde"), "0");
    expect(screen.queryByText("Elegí un número entre 2 y 20.")).not.toBeInTheDocument();
  });

  it("names the bounds of a long term with the thousands of the language", async () => {
    renderRouteWithProviders("/configuracion/formularios");
    await userEvent.clear(await screen.findByRole("spinbutton", { name: /Vencer los propuestos sin revisar/ }));
    await userEvent.type(field("Vencer los propuestos sin revisar"), "4000");
    await userEvent.click(screen.getByRole("button", { name: "Guardar cambios" }));
    expect(await screen.findByText("Elegí un número entre 1 y 3.650.")).toBeInTheDocument();
  });

  it("keeps the draft after a conflict and lets whoever saves compare it with what is saved before choosing", async () => {
    renderRouteWithProviders("/configuracion/formularios");
    await userEvent.clear(await screen.findByRole("spinbutton", { name: /Relecturas por persona y día/ }));
    await userEvent.type(field("Relecturas por persona y día"), "8");
    settings = { ...settings, maxFileSizeMiB: 12, revision: 1 };
    server.use(http.put("/api/forms/settings", () => HttpResponse.json({ status: 409, code: "Forms.Settings.RevisionConflict", title: "Conflict",
      detail: "La configuración de Formularios cambió. Revisá los valores actuales antes de guardar." }, { status: 409 })));
    await userEvent.click(screen.getByRole("button", { name: "Guardar cambios" }));

    const header = screen.getByRole("heading", { level: 1, name: "Formularios" }).closest("header") as HTMLElement;
    await userEvent.click(await within(header).findByRole("button", { name: "Revisar valores actuales" }));
    const review = (await screen.findByRole("heading", { name: "Revisar cambios" })).closest("section") ?? document.body;
    expect(within(review as HTMLElement).getByText("Tamaño máximo por archivo")).toBeInTheDocument();
    expect(within(review as HTMLElement).getByText("Relecturas por persona y día")).toBeInTheDocument();
    await userEvent.click(within(review as HTMLElement).getByRole("button", { name: "Conservar mis cambios" }));

    expect(field("Tamaño máximo por archivo")).toHaveValue(12);
    expect(field("Relecturas por persona y día")).toHaveValue(8);
    expect(screen.getByRole("button", { name: "Guardar cambios" })).toBeEnabled();
  });

  it("says a conflict with what to do and without a code to report, which is for an unexpected error (O53)", async () => {
    const error = vi.spyOn(toast, "error");
    renderRouteWithProviders("/configuracion/formularios");
    await userEvent.clear(await screen.findByRole("spinbutton", { name: /Relecturas por persona y día/ }));
    await userEvent.type(field("Relecturas por persona y día"), "8");
    server.use(http.put("/api/forms/settings", () => HttpResponse.json({ status: 409, code: "Forms.Settings.RevisionConflict", title: "Conflict",
      detail: "La configuración de Formularios cambió. Revisá los valores actuales antes de guardar.", traceId: "conflict-trace" }, { status: 409 })));
    await userEvent.click(screen.getByRole("button", { name: "Guardar cambios" }));
    await waitFor(() => expect(error).toHaveBeenCalledWith("Otra persona cambió la configuración de Formularios. Revisá los valores actuales.",
      expect.objectContaining({ description: undefined })));
  });

  it("takes a field error from the server under its number", async () => {
    server.use(http.put("/api/forms/settings", () => HttpResponse.json({ status: 400, code: "Validation.Failed", title: "Invalid",
      errors: { maxFileSizeMiB: ["Elegí un número entre 1 y 25."] } }, { status: 400 })));
    renderRouteWithProviders("/configuracion/formularios");
    await userEvent.clear(await screen.findByRole("spinbutton", { name: /Tamaño máximo por archivo/ }));
    await userEvent.type(field("Tamaño máximo por archivo"), "20");
    await userEvent.click(screen.getByRole("button", { name: "Guardar cambios" }));
    expect(await screen.findByText("Elegí un número entre 1 y 25.")).toBeInTheDocument();
  });
});
