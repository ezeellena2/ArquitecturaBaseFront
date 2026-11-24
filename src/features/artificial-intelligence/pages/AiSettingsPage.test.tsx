import { act, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { toast } from "sonner";
import { queryClient } from "@/shared/api/queryClient";
import { server } from "@/test/mocks/server";
import { currentUser } from "@/test/mocks/handlers";
import { renderRouteWithProviders } from "@/test/utils/renderWithProviders";
import type { AiConnection, AiSaveRequest } from "../api/aiConnection";

vi.mock("react-oidc-context", async () => ({ ...(await vi.importActual<typeof import("react-oidc-context")>("react-oidc-context")), useAuth: () => ({ isAuthenticated: true, isLoading: false, user: { access_token: "t" } }) }));
let current: AiConnection;
let writes: AiSaveRequest[];
let tests: unknown[];
beforeEach(() => {
  queryClient.clear(); writes = []; tests = [];
  current = { provider: "OpenAI", model: "fictional-model", hasCredential: true, enabled: true, revision: 1, providers: ["OpenAI", "Anthropic"], conversationRetentionDays: 30, conversationRetentionCeilingDays: 30 };
  server.use(http.get("/api/me", () => HttpResponse.json({ ...currentUser, permissions: ["ai.read", "ai.manage"] })),
    http.get("/api/ai/connection", () => HttpResponse.json(current)),
    http.post("/api/ai/connection/models", () => HttpResponse.json({ provider: current.provider, revision: current.revision, models: [] })),
    http.put("/api/ai/connection", async ({ request }) => { const body = await request.json() as AiSaveRequest; writes.push(body); current = { ...current, provider: body.provider, model: body.model, enabled: body.enabled, hasCredential: body.credentialChange !== "Remove", revision: current.revision + 1, conversationRetentionDays: body.conversationRetentionDays }; return HttpResponse.json({ requestId: body.requestId, connection: current }); }),
    http.post("/api/ai/connection/test", async ({ request }) => { tests.push(await request.json()); return HttpResponse.json({ revision: current.revision, inputTokens: 4, outputTokens: 1 }); }));
});
afterEach(() => { queryClient.clear(); toast.dismiss(); vi.restoreAllMocks(); });
const keyField = () => screen.getByLabelText("Nueva clave de API");
// The provider, the availability (both since 2026-11-22) and a model of the list go in the shared piece for choosing
// (DS1-A): the button names the chosen one.
const providers = (options?: { hidden?: boolean }) => screen.getByRole("button", { name: /^Proveedor /, ...options });
async function chooseProvider(name: string) {
  await userEvent.click(providers());
  await userEvent.click(within(await screen.findByRole("listbox", { name: "Proveedor" })).getByRole("option", { name }));
}
const modelPicker = () => screen.findByRole("button", { name: /^Modelo / });
async function openModels() {
  const trigger = await modelPicker();
  await act(async () => { trigger.focus(); });
  await userEvent.keyboard("{Enter}");
  return screen.findByRole("listbox", { name: "Modelo" });
}
async function chooseModel(name: string) {
  await userEvent.click(within(await openModels()).getByRole("option", { name }));
}

describe("AI settings", () => {
  // SP1-B (2026-11-24): a 403 when reading keeps the address and the name of the screen.
  it("a 403 when reading shows the lack of permission in place, with the name of the screen", async () => {
    server.use(http.get("/api/ai/connection", () => HttpResponse.json({ status: 403, title: "Forbidden" }, { status: 403 })));
    const { router } = renderRouteWithProviders("/configuracion/ia");
    expect(await screen.findByRole("heading", { level: 3, name: "No tenés permiso" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 1, name: "Inteligencia artificial" })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe("/configuracion/ia");
  });
  it("keeps the whole connection in one zone, in the order it is filled in, with each button beside its value (IA1-A)", async () => {
    server.use(http.post("/api/ai/connection/models", () => HttpResponse.json({ provider: "OpenAI", revision: 1, models: [{ id: "fictional-model", displayName: "Fictional model" }] })));
    renderRouteWithProviders("/configuracion/ia");
    const zone = await screen.findByRole("region", { name: "Conexión con el proveedor" });
    const model = await within(zone).findByRole("button", { name: "Modelo Fictional model" });
    // Una cosa, una zona: ya no hay una zona por tipo de control.
    for (const name of ["Proveedor y modelo", "Clave y prueba de conexión", "Disponibilidad"]) expect(screen.queryByRole("region", { name })).not.toBeInTheDocument();
    // El orden en que se completa: los modelos se cargan con la clave, así que la clave va antes que el modelo.
    const key = within(zone).getByRole("group", { name: "Clave de API" });
    const order = [within(zone).getByRole("button", { name: /^Proveedor / }), key, model, within(zone).getByRole("button", { name: /^Disponibilidad de la conexión / })];
    for (const [index, element] of order.slice(1).entries()) expect(order[index].compareDocumentPosition(element) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    // Cada botón en el renglón del dato que toca; quitar va en rojo.
    expect(within(key).getByText("Configurada")).toBeInTheDocument();
    expect(within(key).getAllByRole("button").filter(button => !button.getAttribute("aria-label")?.startsWith("Más información")).map(button => button.textContent)).toEqual(["Reemplazar clave", "Quitar clave"]);
    expect(within(key).getByRole("button", { name: "Quitar clave" })).toHaveAttribute("data-variant", "destructive-outline");
    expect(model.parentElement).toContainElement(screen.getByRole("button", { name: "Actualizar modelos" }));
    expect(model.parentElement).toContainElement(screen.getByRole("button", { name: "Ingresar modelo manualmente" }));
    expect(within(zone).getByText("Disponibilidad")).toBeInTheDocument();
  });
  it("says that a provider this version does not know left the connection paused, to choose another (I4)", async () => {
    current = { provider: "OpenAI", model: "", hasCredential: false, enabled: false, revision: 7, providers: ["OpenAI", "Anthropic"], unsupportedProvider: true, conversationRetentionDays: 30, conversationRetentionCeilingDays: 30 };
    renderRouteWithProviders("/configuracion/ia");
    const notice = await screen.findByText(/La conexión guardada usa un proveedor que esta versión de la app no conoce, así que quedó pausada/);
    expect(notice.closest("[role=status]")).not.toBeNull();
    expect(screen.getByRole("button", { name: "Disponibilidad de la conexión Pausada" })).toBeInTheDocument();
    expect(notice).toHaveTextContent("Elegí un proveedor, cargá su clave y guardá.");
  });
  it("tells who only reads that a provider this version does not know left it paused, without what to do to fix it (I4, review)", async () => {
    server.use(http.get("/api/me", () => HttpResponse.json({ ...currentUser, permissions: ["ai.read"] })));
    current = { provider: "OpenAI", model: "", hasCredential: false, enabled: false, revision: 7, providers: ["OpenAI", "Anthropic"], unsupportedProvider: true, conversationRetentionDays: 30, conversationRetentionCeilingDays: 30 };
    renderRouteWithProviders("/configuracion/ia");
    const notice = await screen.findByText(/La conexión guardada usa un proveedor que esta versión de la app no conoce, así que quedó pausada/);
    expect(notice.closest("[role=status]")).not.toBeNull();
    expect(notice).not.toHaveTextContent(/Elegí un proveedor/);
  });
  it("replaces the key in its own row and cancels back to the saved one", async () => {
    renderRouteWithProviders("/configuracion/ia");
    await userEvent.click(await screen.findByRole("button", { name: "Reemplazar clave" }));
    expect(keyField().parentElement).toContainElement(screen.getByRole("button", { name: "Cancelar reemplazo" }));
    expect(screen.queryByRole("group", { name: "Clave de API" })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Cancelar reemplazo" }));
    expect(within(screen.getByRole("group", { name: "Clave de API" })).getByText("Configurada")).toBeInTheDocument();
    expect(screen.queryByLabelText("Nueva clave de API")).not.toBeInTheDocument();
  });
  it("loads saved-key models automatically and tests the selected identifier without saving", async () => {
    const catalogs: unknown[] = [];
    server.use(http.post("/api/ai/connection/models", async ({ request }) => {
      catalogs.push(await request.json());
      return HttpResponse.json({ provider: "OpenAI", revision: 1, models: [{ id: "fictional-model", displayName: "Fictional model" }, { id: "next-model", displayName: "Next model" }] });
    }));
    renderRouteWithProviders("/configuracion/ia");
    await modelPicker();
    expect(catalogs).toEqual([{ provider: "OpenAI", credentialChange: "Keep", apiKey: null, expectedRevision: 1 }]);
    await chooseModel("Next model");
    expect(screen.getByRole("button", { name: "Modelo Next model" })).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Probar conexión" }));
    await waitFor(() => expect(tests).toHaveLength(1));
    expect(tests[0]).toMatchObject({ provider: "OpenAI", model: "next-model", apiKey: null });
    expect(writes).toHaveLength(0);
  });
  it("lists with a candidate key before choosing a model without retaining secrets in caches", async () => {
    current = { ...current, model: "", hasCredential: false, enabled: false, revision: 0 };
    const catalogs: unknown[] = [];
    server.use(http.post("/api/ai/connection/models", async ({ request }) => {
      catalogs.push(await request.json());
      return HttpResponse.json({ provider: "OpenAI", revision: 0, models: [{ id: "next-model", displayName: "Next model" }] });
    }));
    renderRouteWithProviders("/configuracion/ia");
    await userEvent.type(await screen.findByLabelText("Clave de API"), "fictional-private-key");
    await userEvent.click(screen.getByRole("button", { name: "Cargar modelos" }));
    // Nothing is chosen for them: the field invites to choose one.
    expect(await screen.findByRole("button", { name: "Modelo Elegí un modelo" })).toBeInTheDocument();
    await chooseModel("Next model");
    expect(screen.getByRole("button", { name: "Modelo Next model" })).toBeInTheDocument();
    expect(catalogs).toEqual([{ provider: "OpenAI", credentialChange: "Replace", apiKey: "fictional-private-key", expectedRevision: 0 }]);
    expect(writes).toHaveLength(0);
    expect(tests).toHaveLength(0);
    expect(JSON.stringify(queryClient.getQueryCache().getAll().map(x => x.state))).not.toContain("fictional-private-key");
    expect(queryClient.getMutationCache().getAll()).toHaveLength(0);
  });
  it("keeps manual entry available when a saved model is missing from the catalog", async () => {
    server.use(http.post("/api/ai/connection/models", () => HttpResponse.json({ provider: "OpenAI", revision: 1, models: [{ id: "next-model", displayName: "Next model" }] })));
    renderRouteWithProviders("/configuracion/ia");
    expect(await screen.findByRole("button", { name: "Modelo fictional-model" })).toBeInTheDocument();
    // The saved model goes first, with «Fuera de la lista» in grey; the ones of the list say their identifier there.
    const options = within(await openModels()).getAllByRole("option");
    expect(options.map(option => option.querySelector('[id$="-label"]')?.textContent)).toEqual(["fictional-model", "Next model"]);
    expect(options[0]).toHaveAttribute("aria-selected", "true");
    expect(options[0]).toHaveAccessibleDescription("Fuera de la lista");
    expect(options[1]).toHaveAccessibleDescription("next-model");
    await userEvent.keyboard("{Escape}");
    expect(screen.getByRole("button", { name: "Guardar cambios" })).toBeDisabled();
    await userEvent.click(screen.getByRole("button", { name: "Ingresar modelo manualmente" }));
    expect(screen.getByRole("textbox", { name: "Modelo" })).toHaveValue("fictional-model");
  });
  it("reports a catalog error once and preserves the key and manual model without retrying", async () => {
    const error = vi.spyOn(toast, "error");
    current = { ...current, hasCredential: false };
    let catalogs = 0;
    server.use(http.post("/api/ai/connection/models", () => { catalogs++; return HttpResponse.json({ code: "Ai.Provider.CredentialInvalid" }, { status: 400 }); }));
    renderRouteWithProviders("/configuracion/ia");
    await userEvent.type(await screen.findByLabelText("Clave de API"), "fictional-private-key");
    await userEvent.click(screen.getByRole("button", { name: "Cargar modelos" }));
    await waitFor(() => expect(error).toHaveBeenCalledTimes(1));
    expect(screen.getByLabelText("Clave de API")).toHaveValue("fictional-private-key");
    expect(screen.getByRole("textbox", { name: "Modelo" })).toHaveValue("fictional-model");
    expect(catalogs).toBe(1);
  });
  // I7: a saved key the server can no longer decrypt is explained next to the key, with «Reemplazar clave» highlighted, not as an
  // unexpected error in the Toaster; replacing the key withdraws the message.
  it("explains an unreadable saved key beside the key and highlights replacing it", async () => {
    const error = vi.spyOn(toast, "error");
    const unreadable = { code: "Ai.Connection.CredentialUnavailable", detail: "Server text", status: 409, title: "Conflicto", traceId: "trace" };
    let probes = 0;
    server.use(http.post("/api/ai/connection/models", () => HttpResponse.json(unreadable, { status: 409 })),
      http.post("/api/ai/connection/test", () => { probes++; return HttpResponse.json(unreadable, { status: 409 }); }));
    renderRouteWithProviders("/configuracion/ia");
    const key = await screen.findByRole("group", { name: "Clave de API" });
    expect(await within(key).findByRole("alert")).toHaveTextContent("No pudimos leer la clave guardada: reemplazala.");
    const replace = within(key).getByRole("button", { name: "Reemplazar clave" });
    expect(replace).toHaveAttribute("data-variant", "default");
    expect(replace).toHaveAccessibleDescription("No pudimos leer la clave guardada: reemplazala.");
    expect(within(key).getByRole("button", { name: "Quitar clave" })).toHaveAttribute("data-variant", "destructive-outline");
    await userEvent.click(screen.getByRole("button", { name: "Probar conexión" }));
    await waitFor(() => expect(probes).toBe(1));
    await waitFor(() => expect(screen.getByRole("button", { name: "Probar conexión" })).not.toHaveAttribute("aria-busy", "true"));
    expect(within(key).getAllByRole("alert")).toHaveLength(1);
    expect(error).not.toHaveBeenCalled();
    expect(screen.queryByText(/Ocurrió un error inesperado/)).not.toBeInTheDocument();
    await userEvent.click(replace);
    expect(keyField()).toBeInTheDocument();
    expect(screen.queryByText("No pudimos leer la clave guardada: reemplazala.")).not.toBeInTheDocument();
  });
  it("ignores a late catalog after changing the candidate key", async () => {
    current = { ...current, hasCredential: false };
    let release: (() => void) | undefined;
    server.use(http.post("/api/ai/connection/models", async () => {
      await new Promise<void>(resolve => { release = resolve; });
      return HttpResponse.json({ provider: "OpenAI", revision: 1, models: [{ id: "old-model", displayName: "Old model" }] });
    }));
    renderRouteWithProviders("/configuracion/ia");
    const key = await screen.findByLabelText("Clave de API");
    await userEvent.type(key, "fictional-first-key");
    await userEvent.click(screen.getByRole("button", { name: "Cargar modelos" }));
    await waitFor(() => expect(release).toBeDefined());
    await userEvent.type(key, "-changed");
    release!();
    await waitFor(() => expect(screen.getByRole("button", { name: "Cargar modelos" })).toBeEnabled());
    // The late list is not offered: the model stays a text field, without the Picker of a list.
    expect(screen.queryByRole("button", { name: /^Modelo / })).not.toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "Modelo" })).toBeInTheDocument();
  });
  it("clears provider models and never sends the saved key to the new provider", async () => {
    const catalogs: unknown[] = [];
    server.use(http.post("/api/ai/connection/models", async ({ request }) => {
      catalogs.push(await request.json());
      return HttpResponse.json({ provider: "OpenAI", revision: 1, models: [{ id: "fictional-model", displayName: "Fictional model" }] });
    }));
    renderRouteWithProviders("/configuracion/ia");
    await modelPicker();
    await chooseProvider("Anthropic / Claude");
    const confirm = await screen.findByRole("dialog");
    // The saved key asks first: the provider does not change until it is confirmed (the open dialog hides the page).
    expect(providers({ hidden: true })).toHaveAccessibleName("Proveedor OpenAI");
    await userEvent.click(within(confirm).getByRole("button", { name: "Cambiar proveedor" }));
    expect(providers()).toHaveAccessibleName("Proveedor Anthropic / Claude");
    expect(screen.queryByRole("button", { name: /^Modelo / })).not.toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "Modelo" })).toHaveValue("");
    expect(screen.getByRole("button", { name: "Cargar modelos" })).toBeDisabled();
    expect(catalogs).toHaveLength(1);
  });
  it("blocks catalog requests during cooldown and does not query with read-only permission", async () => {
    let catalogs = 0;
    server.use(http.post("/api/ai/connection/models", () => { catalogs++; return HttpResponse.json({ code: "Ai.Provider.RateLimited", retryAfter: 60 }, { status: 429 }); }));
    const view = renderRouteWithProviders("/configuracion/ia");
    const reason = "Esperá 60 segundos antes de consultar los modelos otra vez.";
    await waitFor(() => expect(screen.getByRole("button", { name: "Cargar modelos" })).toHaveAccessibleDescription(reason));
    expect(screen.getByRole("button", { name: "Cargar modelos" })).toHaveAttribute("aria-disabled", "true");
    // La espera es el motivo del botón deshabilitado: tooltip y descripción accesible, sin texto debajo.
    for (const text of screen.queryAllByText(reason)) expect(text).not.toBeVisible();
    await userEvent.hover(screen.getByRole("button", { name: "Cargar modelos" }));
    expect(await screen.findByRole("tooltip")).toHaveTextContent(reason);
    expect(catalogs).toBe(1);
    view.unmount(); queryClient.clear();
    server.use(http.get("/api/me", () => HttpResponse.json({ ...currentUser, permissions: ["ai.read"] })));
    renderRouteWithProviders("/configuracion/ia");
    expect(await screen.findByRole("textbox", { name: "Modelo" })).toBeDisabled();
    expect(screen.queryByRole("button", { name: "Cargar modelos" })).not.toBeInTheDocument();
    expect(catalogs).toBe(1);
  });
  it("starts an unconfigured connection with empty technical fields and no login autofill", async () => {
    current = { ...current, model: "", hasCredential: false, enabled: false, revision: 0 };
    renderRouteWithProviders("/configuracion/ia");
    const model = await screen.findByRole("textbox", { name: "Modelo" });
    const key = screen.getByLabelText("Clave de API");
    expect(model).toHaveValue("");
    expect(model).toHaveAttribute("autocomplete", "off");
    expect(model).toHaveAttribute("name", "ai-provider-model");
    expect(key).toHaveValue("");
    expect(key).toHaveAttribute("type", "password");
    expect(key).toHaveAttribute("autocomplete", "new-password");
    expect(key).toHaveAttribute("name", "ai-provider-api-key");
    // La clave va antes que el modelo, con su etiqueta y sin un estado «Sin clave configurada» encima.
    expect(key.compareDocumentPosition(model) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(screen.queryByText("Sin clave configurada")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Guardar cambios" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Probar conexión" })).toBeDisabled();
    expect(writes).toHaveLength(0);
    expect(tests).toHaveLength(0);
  });
  it("reviews a conflict without sending a candidate key to a different provider", async () => {
    server.use(http.put("/api/ai/connection", async ({ request }) => {
      writes.push(await request.json() as AiSaveRequest);
      current = { ...current, provider: "Anthropic", model: "remote-model", revision: 2 };
      return HttpResponse.json({ code: "Ai.Connection.RevisionConflict" }, { status: 409 });
    }));
    renderRouteWithProviders("/configuracion/ia");
    await userEvent.click(await screen.findByRole("button", { name: "Reemplazar clave" }));
    await userEvent.type(keyField(), "fictional-private-key");
    await userEvent.click(screen.getByRole("button", { name: "Guardar cambios" }));
    await userEvent.click(await screen.findByRole("button", { name: "Leer configuración actual" }));
    await userEvent.click(await screen.findByRole("button", { name: "Revisar con mi borrador" }));
    expect(providers()).toHaveAccessibleName("Proveedor OpenAI");
    expect(screen.getByRole("textbox", { name: "Modelo" })).toHaveValue("fictional-model");
    expect(screen.getByLabelText("Clave de API")).toHaveValue("fictional-private-key");
    expect(writes).toHaveLength(1);
  });
  it("confirms removing a key, pauses the connection and sends no plaintext", async () => {
    renderRouteWithProviders("/configuracion/ia");
    await userEvent.click(await screen.findByRole("button", { name: "Quitar clave" }));
    // What removing does, without an instruction on how to undo it (lista de chequeo, 2026-11-11).
    const removal = await screen.findByRole("dialog", { name: "¿Quitar la clave?" });
    expect(removal).toHaveAccessibleDescription("La conexión queda pausada cuando guardes.");
    await userEvent.click(within(removal).getByRole("button", { name: "Quitar clave" }));
    await userEvent.click(screen.getByRole("button", { name: "Guardar cambios" }));
    await waitFor(() => expect(writes).toHaveLength(1));
    expect(writes[0]).toMatchObject({ credentialChange: "Remove", apiKey: null, enabled: false });
  });
  it("says one second, not «1 segundos», for a one-second cooldown", async () => {
    server.use(http.post("/api/ai/connection/models", () => HttpResponse.json({ code: "Ai.Provider.RateLimited", retryAfter: 1 }, { status: 429 })));
    const view = renderRouteWithProviders("/configuracion/ia");
    await waitFor(() => expect(screen.getByRole("button", { name: "Cargar modelos" })).toHaveAccessibleDescription("Esperá 1 segundo antes de consultar los modelos otra vez."));
    view.unmount(); queryClient.clear();
    server.use(http.post("/api/ai/connection/models", () => HttpResponse.json({ provider: current.provider, revision: current.revision, models: [] })),
      http.post("/api/ai/connection/test", () => HttpResponse.json({ code: "Ai.Provider.RateLimited", retryAfter: 1 }, { status: 429 })));
    renderRouteWithProviders("/configuracion/ia");
    await userEvent.click(await screen.findByRole("button", { name: "Reemplazar clave" }));
    await userEvent.type(keyField(), "fictional-private-key");
    await userEvent.click(screen.getByRole("button", { name: "Probar conexión" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Probar conexión" })).toHaveAccessibleDescription("Esperá 1 segundo antes de probar otra vez."));
  });
  it("blocks repeated tests during a provider cooldown and preserves the candidate", async () => {
    server.use(http.post("/api/ai/connection/test", () => HttpResponse.json({ code: "Ai.Provider.RateLimited", retryAfter: 60 }, { status: 429 })));
    renderRouteWithProviders("/configuracion/ia");
    await userEvent.click(await screen.findByRole("button", { name: "Reemplazar clave" }));
    await userEvent.type(keyField(), "fictional-private-key");
    await userEvent.click(screen.getByRole("button", { name: "Probar conexión" }));
    const reason = "Esperá 60 segundos antes de probar otra vez.";
    await waitFor(() => expect(screen.getByRole("button", { name: "Probar conexión" })).toHaveAccessibleDescription(reason));
    expect(screen.getByRole("button", { name: "Probar conexión" })).toHaveAttribute("aria-disabled", "true");
    // La espera es el motivo del botón deshabilitado: tooltip y descripción accesible, sin texto al lado.
    for (const text of screen.queryAllByText(reason)) expect(text).not.toBeVisible();
    await userEvent.hover(screen.getByRole("button", { name: "Probar conexión" }));
    expect(await screen.findByRole("tooltip")).toHaveTextContent(reason);
    expect(keyField()).toHaveValue("fictional-private-key");
  });
  it("saves a candidate key without retaining it in QueryCache or MutationCache", async () => {
    renderRouteWithProviders("/configuracion/ia");
    await userEvent.click(await screen.findByRole("button", { name: "Reemplazar clave" }));
    expect(keyField()).toHaveValue("");
    expect(keyField()).toHaveAttribute("autocomplete", "new-password");
    await userEvent.type(keyField(), "fictional-private-key");
    await userEvent.click(screen.getByRole("button", { name: "Guardar cambios" }));
    await waitFor(() => expect(writes).toHaveLength(1));
    await waitFor(() => expect(screen.queryByLabelText("Nueva clave de API")).not.toBeInTheDocument());
    expect(writes[0].credentialChange).toBe("Replace");
    expect(JSON.stringify(queryClient.getQueryCache().getAll().map(x => x.state.data))).not.toContain("fictional-private-key");
    expect(JSON.stringify(queryClient.getMutationCache().getAll().map(x => x.state.variables))).not.toContain("fictional-private-key");
  });
  it("tests the draft without saving and withdraws the result when the model changes", async () => {
    const success = vi.spyOn(toast, "success");
    const dismiss = vi.spyOn(toast, "dismiss");
    renderRouteWithProviders("/configuracion/ia");
    await userEvent.click(await screen.findByRole("button", { name: "Probar conexión" }));
    await waitFor(() => expect(success).toHaveBeenCalledWith("La conexión respondió correctamente.", expect.objectContaining({ id: "ai:test" })));
    expect(writes).toHaveLength(0);
    expect(tests).toHaveLength(1);
    dismiss.mockClear();
    // El resultado vale para el borrador probado: al cambiarlo, la notificación se retira.
    await userEvent.type(screen.getByRole("textbox", { name: "Modelo" }), "-next");
    expect(dismiss).toHaveBeenCalledWith("ai:test");
  });
  it("preserves the candidate on field errors and uses no duplicate toast", async () => {
    const error = vi.spyOn(toast, "error");
    server.use(http.put("/api/ai/connection", () => HttpResponse.json({ code: "Validation.Failed", errors: { apiKey: ["Revisá la clave."] } }, { status: 400 })));
    renderRouteWithProviders("/configuracion/ia");
    await userEvent.click(await screen.findByRole("button", { name: "Reemplazar clave" }));
    await userEvent.type(keyField(), "fictional-private-key");
    await userEvent.click(screen.getByRole("button", { name: "Guardar cambios" }));
    expect(await screen.findByText("Revisá la clave.")).toBeInTheDocument();
    expect(keyField()).toHaveValue("fictional-private-key");
    expect(error).not.toHaveBeenCalled();
  });
  it("recovers a lost response by receipt without repeating the save", async () => {
    let receipt: { requestId: string; connection: AiConnection };
    server.use(http.put("/api/ai/connection", async ({ request }) => { const body = await request.json() as AiSaveRequest; writes.push(body); current = { ...current, model: body.model, revision: 2 }; receipt = { requestId: body.requestId, connection: current }; return HttpResponse.error(); }),
      http.get("/api/ai/connection/changes/:id", () => HttpResponse.json(receipt)));
    renderRouteWithProviders("/configuracion/ia");
    await userEvent.type(await screen.findByRole("textbox", { name: "Modelo" }), "-changed");
    await userEvent.click(screen.getByRole("button", { name: "Guardar cambios" }));
    await userEvent.click(await screen.findByRole("button", { name: "Consultar guardado" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Guardar cambios" })).toBeDisabled());
    expect(writes).toHaveLength(1);
    expect(screen.getByRole("textbox", { name: "Modelo" })).toHaveValue("fictional-model-changed");
  });
  it("does not interpret a missing receipt as rollback and retries with the same identifier", async () => {
    server.use(http.put("/api/ai/connection", async ({ request }) => { const body = await request.json() as AiSaveRequest; writes.push(body); return HttpResponse.error(); }),
      http.get("/api/ai/connection/changes/:id", () => HttpResponse.json({ code: "Ai.Connection.ChangeNotFound" }, { status: 404 })));
    renderRouteWithProviders("/configuracion/ia");
    await userEvent.type(await screen.findByRole("textbox", { name: "Modelo" }), "-changed");
    await userEvent.click(screen.getByRole("button", { name: "Guardar cambios" }));
    await userEvent.click(await screen.findByRole("button", { name: "Consultar guardado" }));
    await userEvent.click(await screen.findByRole("button", { name: "Reintentar el mismo guardado" }));
    await waitFor(() => expect(writes).toHaveLength(2));
    expect(writes[1]).toEqual(writes[0]);
  });
  it("supports read only permission independently of general settings", async () => {
    server.use(http.get("/api/me", () => HttpResponse.json({ ...currentUser, permissions: ["ai.read"] })));
    renderRouteWithProviders("/configuracion/ia");
    expect(await screen.findByRole("textbox", { name: "Modelo" })).toBeDisabled();
    expect(screen.queryByRole("button", { name: "Probar conexión" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Guardar cambios" })).not.toBeInTheDocument();
    // Junto al título va el estado «Sólo lectura», como en Información del negocio, sin un párrafo que lo explique.
    const header = screen.getByRole("heading", { level: 1, name: "Inteligencia artificial" }).closest("header") as HTMLElement;
    expect(header.textContent).toBe("Inteligencia artificialSólo lectura");
    expect(screen.queryByText(/Podés consultar esta conexión/)).not.toBeInTheDocument();
    // Sin el botón de prueba tampoco va su aviso de costo, ni los botones de la clave.
    expect(screen.queryByRole("button", { name: "Más información sobre Conexión con el proveedor" })).not.toBeInTheDocument();
    expect(within(screen.getByRole("group", { name: "Clave de API" })).queryAllByRole("button").filter(button => !button.getAttribute("aria-label")?.startsWith("Más información"))).toEqual([]);
  });
  it("leaves no legend under the controls and puts what is not obvious in the information icons", async () => {
    renderRouteWithProviders("/configuracion/ia");
    const model = await screen.findByRole("textbox", { name: "Modelo" });
    // Que el proveedor no devolvió modelos es el resultado de la consulta: queda, sin la instrucción que lo seguía.
    expect(await screen.findByText("El proveedor no devolvió modelos.")).toHaveAttribute("role", "status");
    expect(screen.queryByText(/Podés actualizar la lista/)).not.toBeInTheDocument();
    expect(model).not.toHaveAccessibleDescription();
    for (const legend of [/Una conexión compartida/, /Ingresá la clave de API/, /Modelos disponibles para esta clave/, /No guarda cambios/, /Deja la conexión preparada/, /Conserva proveedor, modelo y clave/])
      expect(screen.queryByText(legend)).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /^Disponibilidad de la conexión / }));
    const availability = await screen.findByRole("listbox", { name: "Disponibilidad de la conexión" });
    expect(within(availability).getByRole("option", { name: "Disponible" })).not.toHaveAccessibleDescription();
    expect(within(availability).getByRole("option", { name: "Pausada" })).not.toHaveAccessibleDescription();
    await userEvent.keyboard("{Escape}");
    // Por qué no se ve la clave guardada y que la prueba puede tener costo van en la (i), con su tooltip.
    expect(screen.queryByText("La clave guardada nunca se muestra ni se devuelve al navegador.", { selector: "p" })).toBeNull();
    expect(screen.getByRole("button", { name: "Más información sobre Clave de API" })).toHaveAccessibleDescription("La clave guardada nunca se muestra ni se devuelve al navegador.");
    expect(screen.getByRole("button", { name: "Más información sobre Conexión con el proveedor" })).toHaveAccessibleDescription("La prueba envía un pedido breve al proveedor y puede tener costo.");
    await userEvent.click(screen.getByRole("button", { name: "Reemplazar clave" }));
    expect(keyField()).not.toHaveAccessibleDescription();
    expect(screen.queryByText(/Usá una clave de API del proveedor/)).not.toBeInTheDocument();
  });
  it("shows the spinner and the gerund on loading models, testing and saving while each one works", async () => {
    const gates: Partial<Record<"models" | "test" | "save", () => void>> = {};
    const hold = (name: "models" | "test" | "save") => new Promise<void>(resolve => { gates[name] = resolve; });
    server.use(
      http.post("/api/ai/connection/models", async () => { await hold("models"); return HttpResponse.json({ provider: "OpenAI", revision: current.revision, models: [] }); }),
      http.post("/api/ai/connection/test", async ({ request }) => { tests.push(await request.json()); await hold("test"); return HttpResponse.json({ revision: current.revision, inputTokens: 4, outputTokens: 1 }); }),
      http.put("/api/ai/connection", async ({ request }) => { const body = await request.json() as AiSaveRequest; writes.push(body); await hold("save"); current = { ...current, model: body.model, revision: current.revision + 1 }; return HttpResponse.json({ requestId: body.requestId, connection: current }); }));
    renderRouteWithProviders("/configuracion/ia");
    // Los modelos de la clave guardada se piden solos al entrar.
    const loading = await screen.findByRole("button", { name: "Cargando modelos…" });
    expect(loading).toHaveAttribute("aria-busy", "true");
    await waitFor(() => expect(gates.models).toBeDefined());
    gates.models!();
    await screen.findByRole("button", { name: "Actualizar modelos" });
    await userEvent.click(screen.getByRole("button", { name: "Probar conexión" }));
    expect(screen.getByRole("button", { name: "Probando…" })).toHaveAttribute("aria-busy", "true");
    await waitFor(() => expect(gates.test).toBeDefined());
    gates.test!();
    await screen.findByRole("button", { name: "Probar conexión" });
    await userEvent.type(screen.getByRole("textbox", { name: "Modelo" }), "-next");
    await userEvent.click(screen.getByRole("button", { name: "Guardar cambios" }));
    expect(screen.getByRole("button", { name: "Guardando…" })).toHaveAttribute("aria-busy", "true");
    await waitFor(() => expect(gates.save).toBeDefined());
    gates.save!();
    await waitFor(() => expect(screen.getByRole("button", { name: "Guardar cambios" })).toBeDisabled());
    expect(writes).toHaveLength(1);
  });
  it("shows the check of an uncertain save on its own button while Save keeps its name", async () => {
    let receipt: { requestId: string; connection: AiConnection } | undefined;
    let release: (() => void) | undefined;
    server.use(http.put("/api/ai/connection", async ({ request }) => { const body = await request.json() as AiSaveRequest; writes.push(body); current = { ...current, model: body.model, revision: 2 }; receipt = { requestId: body.requestId, connection: current }; return HttpResponse.error(); }),
      http.get("/api/ai/connection/changes/:id", async () => { await new Promise<void>(resolve => { release = resolve; }); return HttpResponse.json(receipt); }));
    renderRouteWithProviders("/configuracion/ia");
    await userEvent.type(await screen.findByRole("textbox", { name: "Modelo" }), "-changed");
    await userEvent.click(screen.getByRole("button", { name: "Guardar cambios" }));
    const review = await screen.findByRole("region", { name: "Revisión del guardado" });
    await userEvent.click(within(review).getByRole("button", { name: "Consultar guardado" }));
    expect(within(review).getByRole("button", { name: "Consultando…" })).toHaveAttribute("aria-busy", "true");
    // Consultar no guarda: el Guardar de la cabecera no dice «Guardando…» ni muestra el aro.
    expect(screen.getByRole("button", { name: "Guardar cambios" })).not.toHaveAttribute("aria-busy");
    expect(screen.queryByRole("button", { name: "Guardando…" })).not.toBeInTheDocument();
    await waitFor(() => expect(release).toBeDefined());
    release!();
    await waitFor(() => expect(screen.queryByRole("region", { name: "Revisión del guardado" })).not.toBeInTheDocument());
    expect(writes).toHaveLength(1);
  });
  it("shows the read of the current configuration after a conflict on its own button", async () => {
    let hold: Promise<void> | undefined;
    server.use(http.get("/api/ai/connection", async () => { if (hold) await hold; return HttpResponse.json(current); }),
      http.put("/api/ai/connection", async ({ request }) => {
        writes.push(await request.json() as AiSaveRequest);
        current = { ...current, provider: "Anthropic", model: "remote-model", revision: 2 };
        return HttpResponse.json({ code: "Ai.Connection.RevisionConflict" }, { status: 409 });
      }));
    renderRouteWithProviders("/configuracion/ia");
    await userEvent.type(await screen.findByRole("textbox", { name: "Modelo" }), "-next");
    await userEvent.click(screen.getByRole("button", { name: "Guardar cambios" }));
    const review = await screen.findByRole("region", { name: "Revisión del guardado" });
    let release!: () => void;
    hold = new Promise<void>(resolve => { release = resolve; });
    await userEvent.click(within(review).getByRole("button", { name: "Leer configuración actual" }));
    expect(within(review).getByRole("button", { name: "Consultando…" })).toHaveAttribute("aria-busy", "true");
    expect(screen.queryByRole("button", { name: "Guardando…" })).not.toBeInTheDocument();
    release();
    expect(await within(review).findByRole("button", { name: "Usar configuración actual" })).toBeEnabled();
  });
  it("shows the retry of the same save on its own button, not on Save", async () => {
    let puts = 0;
    let release: (() => void) | undefined;
    server.use(http.put("/api/ai/connection", async ({ request }) => {
      const body = await request.json() as AiSaveRequest; writes.push(body); puts++;
      if (puts === 1) return HttpResponse.error();
      await new Promise<void>(resolve => { release = resolve; });
      current = { ...current, model: body.model, revision: 2 };
      return HttpResponse.json({ requestId: body.requestId, connection: current });
    }), http.get("/api/ai/connection/changes/:id", () => HttpResponse.json({ code: "Ai.Connection.ChangeNotFound" }, { status: 404 })));
    renderRouteWithProviders("/configuracion/ia");
    await userEvent.type(await screen.findByRole("textbox", { name: "Modelo" }), "-changed");
    await userEvent.click(screen.getByRole("button", { name: "Guardar cambios" }));
    await userEvent.click(await screen.findByRole("button", { name: "Consultar guardado" }));
    await userEvent.click(await screen.findByRole("button", { name: "Reintentar el mismo guardado" }));
    // Una sola señal, en el botón que se tocó: el Guardar de la cabecera conserva su nombre.
    const review = screen.getByRole("region", { name: "Revisión del guardado" });
    expect(within(review).getByRole("button", { name: "Guardando…" })).toHaveAttribute("aria-busy", "true");
    expect(screen.getAllByRole("button", { name: "Guardando…" })).toHaveLength(1);
    expect(screen.getByRole("button", { name: "Guardar cambios" })).not.toHaveAttribute("aria-busy");
    await waitFor(() => expect(release).toBeDefined());
    release!();
    await waitFor(() => expect(screen.queryByRole("region", { name: "Revisión del guardado" })).not.toBeInTheDocument());
    expect(writes[1]).toEqual(writes[0]);
  });
  it("reports a connection test through the notification without a status beside the button", async () => {
    const success = vi.spyOn(toast, "success");
    renderRouteWithProviders("/configuracion/ia");
    const zone = await screen.findByRole("region", { name: "Conexión con el proveedor" });
    await userEvent.click(within(zone).getByRole("button", { name: "Probar conexión" }));
    await waitFor(() => expect(success).toHaveBeenCalledWith("La conexión respondió correctamente.", expect.anything()));
    // El resultado va al Toaster: al lado del botón no queda un estado de la prueba que cambie con cada acción.
    expect(screen.queryByText("Probada para este borrador")).not.toBeInTheDocument();
    expect(screen.queryByText("Sin prueba vigente")).not.toBeInTheDocument();
    // Probar actúa sobre toda la conexión: es la única acción de la banda; Reemplazar y Quitar van en el renglón de la
    // clave (IA1-A). La (i) del título no es una acción y queda fuera de la cuenta.
    const band = within(zone).getByRole("heading", { level: 2, name: "Conexión con el proveedor" }).closest("div") as HTMLElement;
    expect(within(band).queryByRole("status")).not.toBeInTheDocument();
    const actions = (scope: HTMLElement) => within(scope).getAllByRole("button").filter(button => !button.getAttribute("aria-label")?.startsWith("Más información"));
    expect(actions(band).map(button => button.textContent)).toEqual(["Probar conexión"]);
  });
  it("keeps the AI header without an unsaved status", async () => {
    renderRouteWithProviders("/configuracion/ia");
    await userEvent.type(await screen.findByRole("textbox", { name: "Modelo" }), "-next");
    const header = screen.getByRole("heading", { level: 1, name: "Inteligencia artificial" }).closest("header") as HTMLElement;
    // Guardar habilitado ya dice que hay cambios: la banda tiene el título y sus acciones, sin estado del borrador.
    expect(within(header).getByRole("button", { name: "Guardar cambios" })).toBeEnabled();
    expect(header.textContent).toBe("Inteligencia artificialDescartarGuardar cambios");
    expect(screen.queryByText("Cambios sin guardar")).not.toBeInTheDocument();
  });
  it("summarizes the current connection without its revision number", async () => {
    server.use(http.put("/api/ai/connection", async ({ request }) => {
      writes.push(await request.json() as AiSaveRequest);
      current = { ...current, provider: "Anthropic", model: "remote-model", revision: 2 };
      return HttpResponse.json({ code: "Ai.Connection.RevisionConflict" }, { status: 409 });
    }));
    renderRouteWithProviders("/configuracion/ia");
    await userEvent.type(await screen.findByRole("textbox", { name: "Modelo" }), "-next");
    await userEvent.click(screen.getByRole("button", { name: "Guardar cambios" }));
    const review = await screen.findByRole("region", { name: "Revisión del guardado" });
    // Las acciones de la recuperación van al borde derecho de su banda; el cuerpo explica el estado.
    const band = within(review).getByRole("heading", { level: 2, name: "Revisión del guardado" }).parentElement as HTMLElement;
    await userEvent.click(within(band).getByRole("button", { name: "Leer configuración actual" }));
    // RC1-A: the summary also says how many days the current connection keeps Home conversations.
    expect(await within(review).findByText("Anthropic, remote-model. Clave configurada. Disponible. Guarda las conversaciones 30 días.")).toBeInTheDocument();
    // El número de revisión queda en los historiales, no en el resumen de la configuración actual.
    expect(within(review).queryByText(/Revisión 2/)).not.toBeInTheDocument();
    expect(within(band).getAllByRole("button").map(button => button.textContent)).toEqual(["Leer configuración actual", "Usar configuración actual", "Revisar con mi borrador"]);
    expect(within(review).getAllByRole("button")).toEqual(within(band).getAllByRole("button"));
  });
  it("confirms provider changes and clears the candidate key", async () => {
    renderRouteWithProviders("/configuracion/ia");
    await userEvent.click(await screen.findByRole("button", { name: "Reemplazar clave" }));
    await userEvent.type(keyField(), "fictional-private-key");
    // Choosing the provider it already has changes nothing and asks nothing.
    await chooseProvider("OpenAI");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(keyField()).toHaveValue("fictional-private-key");
    await chooseProvider("Anthropic / Claude");
    const dialog = await screen.findByRole("dialog");
    await userEvent.click(within(dialog).getByRole("button", { name: "Cambiar proveedor" }));
    expect(screen.getByRole("textbox", { name: "Modelo" })).toHaveValue("");
    expect(screen.getByLabelText("Clave de API")).toHaveValue("");
    expect(JSON.stringify(queryClient.getMutationCache().getAll().map(x => x.state.variables))).not.toContain("fictional-private-key");
  });

  // RC1-A: the days to keep Home conversations go with the connection; beyond the installation's ceiling they are marked without sending.
  it("saves the days to keep Home conversations with the connection and marks days beyond the ceiling", async () => {
    renderRouteWithProviders("/configuracion/ia");
    const days = await screen.findByRole("spinbutton", { name: /Guardar las conversaciones del asistente de Inicio/ });
    expect(days).toHaveValue(30);
    await userEvent.clear(days); await userEvent.type(days, "31");
    await userEvent.click(screen.getByRole("button", { name: "Guardar cambios" }));
    expect(await screen.findByText("Elegí un número entre 1 y 30.")).toBeInTheDocument();
    expect(writes).toEqual([]);
    await userEvent.clear(days); await userEvent.type(days, "7");
    await userEvent.click(screen.getByRole("button", { name: "Guardar cambios" }));
    await waitFor(() => expect(writes).toHaveLength(1));
    expect(writes[0]).toMatchObject({ conversationRetentionDays: 7, model: "fictional-model", credentialChange: "Keep" });
  });
});
