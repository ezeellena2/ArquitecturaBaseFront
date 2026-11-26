import { act, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HttpResponse, http } from "msw";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { toast } from "sonner";
import { queryClient } from "@/shared/api/queryClient";
import { currentUser } from "@/test/mocks/handlers";
import { server } from "@/test/mocks/server";
import { renderRouteWithProviders } from "@/test/utils/renderWithProviders";

vi.mock("react-oidc-context", async () => ({ ...(await vi.importActual<typeof import("react-oidc-context")>("react-oidc-context")), useAuth: () => ({ isAuthenticated: true, isLoading: false, user: { access_token: "t" } }) }));
// Configuración › WhatsApp (RC3-A, board confirmed on 2026-11-22): the three values of the installation, saved whole with their revision.
const defaults = { revision: 2, flowSessionLifetimeHours: 24, allowedCountries: ["AR", "UY"], messageRetentionDays: 90 };
let settings = { ...defaults };
let writes: unknown[];
beforeEach(() => {
  queryClient.clear(); settings = { ...defaults }; writes = [];
  server.use(http.get("/api/me", () => HttpResponse.json({ ...currentUser, permissions: ["settings.manage"] })),
    http.get("/api/whatsapp/settings", () => HttpResponse.json(settings)),
    http.put("/api/whatsapp/settings", async ({ request }) => {
      const body = await request.json() as { expectedRevision: number; flowSessionLifetimeHours: number; allowedCountries: string[]; messageRetentionDays: number };
      writes.push(body);
      const { expectedRevision: _, ...values } = body;
      settings = { ...values, revision: settings.revision + 1 };
      return HttpResponse.json(settings);
    }));
});
afterEach(() => { queryClient.clear(); toast.dismiss(); vi.restoreAllMocks(); });
// Choosing in the shared list takes several steps: the walks that change countries take longer than five seconds.
vi.setConfig({ testTimeout: 15_000 });

const hours = () => screen.findByRole("spinbutton", { name: "Tiempo para contestar un formulario" });
const days = () => screen.findByRole("spinbutton", { name: "Conservar el contenido de los mensajes" });
const countries = () => screen.findByRole("button", { name: /^Países que reciben códigos/ });
async function type(field: HTMLElement, value: string) {
  await userEvent.clear(field);
  if (value) await userEvent.type(field, value);
}
async function openCountries() {
  const trigger = await countries();
  await act(async () => { trigger.focus(); });
  await userEvent.keyboard("{Enter}");
  return screen.findByRole("listbox", { name: "Países que reciben códigos" });
}
// The list has more than ten countries: it is searched by name and the option chosen marks or unmarks it.
async function toggleCountry(name: string) {
  const list = screen.queryByRole("listbox", { name: "Países que reciben códigos" }) ?? await openCountries();
  const search = screen.getByRole("combobox", { name: "Buscar en Países que reciben códigos" });
  await userEvent.clear(search);
  await userEvent.type(search, name);
  await userEvent.click(within(list).getByRole("option", { name }));
}
const header = () => screen.getByRole("heading", { level: 1, name: "WhatsApp" }).closest("header") as HTMLElement;

describe("WhatsAppSettingsPage", () => {
  it("shows the three values in their sections, with Guardar off until something changes", async () => {
    renderRouteWithProviders("/configuracion/whatsapp");
    expect(await hours()).toHaveValue(24);
    expect(await days()).toHaveValue(90);
    expect(await countries()).toHaveAccessibleName("Países que reciben códigos Argentina, Uruguay");
    for (const section of ["Formularios enviados", "Ingreso con WhatsApp", "Retención"]) expect(screen.getByRole("region", { name: section })).toBeInTheDocument();
    // What each value does goes in its (i): the cost of the codes and that the privacy policy promises the same period.
    expect(await countries()).toHaveAccessibleDescription(/Cada código se paga, con la tarifa de Meta para el país del número\.$/);
    expect(await days()).toHaveAccessibleDescription(/La política de privacidad tiene que prometer este mismo plazo\.$/);
    expect(within(header()).getByRole("button", { name: "Guardar cambios" })).toBeDisabled();
  });

  it("saves the three values whole, with the revision read", async () => {
    const success = vi.spyOn(toast, "success");
    renderRouteWithProviders("/configuracion/whatsapp");
    await type(await hours(), "48");
    await type(await days(), "30");
    await userEvent.click(within(header()).getByRole("button", { name: "Guardar cambios" }));
    await waitFor(() => expect(writes).toEqual([{ expectedRevision: 2, flowSessionLifetimeHours: 48, allowedCountries: ["AR", "UY"], messageRetentionDays: 30 }]));
    await waitFor(() => expect(success).toHaveBeenCalledWith("Guardamos la configuración de WhatsApp.", expect.anything()));
    expect(within(header()).getByRole("button", { name: "Guardar cambios" })).toBeDisabled();
  });

  it("says what a new country costs when it is chosen, and not for one already saved", async () => {
    const warning = vi.spyOn(toast, "warning");
    renderRouteWithProviders("/configuracion/whatsapp");
    await toggleCountry("Brasil");
    expect(warning).toHaveBeenCalledTimes(1);
    expect(warning).toHaveBeenCalledWith("Los códigos a números de Brasil se pagan con la tarifa de Meta para ese país.", expect.anything());
    // Uruguay is saved: quitting it and choosing it again costs nothing new.
    await toggleCountry("Uruguay");
    await toggleCountry("Uruguay");
    expect(warning).toHaveBeenCalledTimes(1);
    await userEvent.keyboard("{Escape}");
    expect(await countries()).toHaveAccessibleName("Países que reciben códigos Argentina, Brasil, Uruguay");
    await userEvent.click(within(header()).getByRole("button", { name: "Guardar cambios" }));
    await waitFor(() => expect(writes).toEqual([{ expectedRevision: 2, flowSessionLifetimeHours: 24, allowedCountries: ["AR", "BR", "UY"], messageRetentionDays: 90 }]));
  });

  it("checks each number and the countries before sending, at their fields", async () => {
    renderRouteWithProviders("/configuracion/whatsapp");
    await type(await hours(), "169");
    await toggleCountry("Argentina");
    await toggleCountry("Uruguay");
    await userEvent.keyboard("{Escape}");
    expect(await countries()).toHaveAccessibleName("Países que reciben códigos Sin países");
    await userEvent.click(within(header()).getByRole("button", { name: "Guardar cambios" }));
    expect(await hours()).toHaveAccessibleDescription(/Elegí un número entre 1 y 168\./);
    expect(await hours()).toHaveFocus();
    expect(await countries()).toHaveAccessibleDescription(/Elegí al menos un país\./);
    expect(writes).toHaveLength(0);
    // Correcting a field takes away only its own error.
    await type(await hours(), "12");
    expect(await hours()).not.toHaveAccessibleDescription(/Elegí un número/);
    expect(await countries()).toHaveAccessibleDescription(/Elegí al menos un país\./);
  });

  it("puts a 400 that names a country by its place at the field of the countries, without a notification", async () => {
    const error = vi.spyOn(toast, "error");
    server.use(http.put("/api/whatsapp/settings", () => HttpResponse.json({ errors: { "allowedCountries[1]": ["Elegí un país admitido."] } }, { status: 400 })));
    renderRouteWithProviders("/configuracion/whatsapp");
    await toggleCountry("Brasil");
    await userEvent.keyboard("{Escape}");
    await userEvent.click(within(header()).getByRole("button", { name: "Guardar cambios" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Elegí un país admitido.");
    expect(await countries()).toHaveAttribute("aria-invalid", "true");
    expect(error).not.toHaveBeenCalled();
  });

  it("says a conflict with what to do and without a code to report, which is for an unexpected error (O53)", async () => {
    const error = vi.spyOn(toast, "error");
    server.use(http.put("/api/whatsapp/settings", () => HttpResponse.json({ code: "WhatsApp.Settings.RevisionConflict", traceId: "conflict-trace" }, { status: 409 })));
    renderRouteWithProviders("/configuracion/whatsapp");
    await type(await hours(), "48");
    await userEvent.click(within(header()).getByRole("button", { name: "Guardar cambios" }));
    await waitFor(() => expect(error).toHaveBeenCalledWith("Otro administrador cambió la configuración de WhatsApp. Revisá los valores actuales.",
      expect.objectContaining({ description: undefined })));
  });

  it("compares a conflict and saves what was edited over the other person's values, with the new revision", async () => {
    server.use(http.put("/api/whatsapp/settings", async ({ request }) => {
      const body = await request.json() as Record<string, unknown>;
      writes.push(body);
      if (writes.length === 1) {
        settings = { ...settings, messageRetentionDays: 60, revision: 3 };
        return HttpResponse.json({ code: "WhatsApp.Settings.RevisionConflict" }, { status: 409 });
      }
      settings = { ...settings, flowSessionLifetimeHours: 48, revision: 4 };
      return HttpResponse.json(settings);
    }));
    renderRouteWithProviders("/configuracion/whatsapp");
    await type(await hours(), "48");
    await userEvent.click(within(header()).getByRole("button", { name: "Guardar cambios" }));
    await userEvent.click(await within(header()).findByRole("button", { name: "Revisar valores actuales" }));
    const comparison = await screen.findByRole("region", { name: "Revisar cambios" });
    // Only what differs, each value as the screen says it.
    expect(within(comparison).getAllByRole("rowheader").map(cell => cell.textContent)).toEqual(["Tiempo para contestar un formulario", "Conservar el contenido de los mensajes"]);
    for (const value of ["24 horas", "48 horas", "60 días", "90 días"]) expect(within(comparison).getByRole("cell", { name: value })).toBeInTheDocument();
    await userEvent.click(within(comparison).getByRole("button", { name: "Conservar mis cambios" }));
    expect(await days()).toHaveValue(60);
    await userEvent.click(within(header()).getByRole("button", { name: "Guardar cambios" }));
    await waitFor(() => expect(writes).toEqual([
      { expectedRevision: 2, flowSessionLifetimeHours: 48, allowedCountries: ["AR", "UY"], messageRetentionDays: 90 },
      { expectedRevision: 3, flowSessionLifetimeHours: 48, allowedCountries: ["AR", "UY"], messageRetentionDays: 60 },
    ]));
  });

  it("offers to try again, instead of an editor, when the read fails", async () => {
    server.use(http.get("/api/whatsapp/settings", () => HttpResponse.json({ code: "General.Unexpected" }, { status: 500 })));
    renderRouteWithProviders("/configuracion/whatsapp");
    expect(await screen.findByText("Configuración no disponible")).toBeInTheDocument();
    expect(screen.queryByRole("spinbutton", { name: "Tiempo para contestar un formulario" })).not.toBeInTheDocument();
    server.use(http.get("/api/whatsapp/settings", () => HttpResponse.json(settings)));
    await userEvent.click(screen.getByRole("button", { name: "Reintentar" }));
    expect(await hours()).toHaveValue(24);
  });

  it("sends whoever cannot manage the settings to the screen without permission", async () => {
    server.use(http.get("/api/me", () => HttpResponse.json(currentUser)));
    renderRouteWithProviders("/configuracion/whatsapp");
    expect(await screen.findByRole("heading", { name: /no tenés permiso/i })).toBeInTheDocument();
    expect(screen.queryByRole("spinbutton", { name: "Tiempo para contestar un formulario" })).not.toBeInTheDocument();
  });

  it("guards a draft when leaving and discards it without saving", async () => {
    renderRouteWithProviders("/configuracion/whatsapp");
    await type(await days(), "30");
    await userEvent.click(within(screen.getByRole("navigation", { name: "Navegación principal" })).getByRole("link", { name: "Inicio" }));
    await userEvent.click(within(await screen.findByRole("dialog")).getByRole("button", { name: "Descartar cambios" }));
    await waitFor(() => expect(screen.queryByRole("spinbutton", { name: "Conservar el contenido de los mensajes" })).not.toBeInTheDocument());
    expect(writes).toHaveLength(0);
  });
});
