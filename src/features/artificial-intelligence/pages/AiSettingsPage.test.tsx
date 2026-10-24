import { screen, waitFor, within } from "@testing-library/react";
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
  current = { provider: "OpenAI", model: "fictional-model", hasCredential: true, enabled: true, revision: 1, providers: ["OpenAI", "Anthropic"] };
  server.use(http.get("/api/me", () => HttpResponse.json({ ...currentUser, permissions: ["ai.read", "ai.manage"] })),
    http.get("/api/ai/connection", () => HttpResponse.json(current)),
    http.post("/api/ai/connection/models", () => HttpResponse.json({ provider: current.provider, revision: current.revision, models: [] })),
    http.put("/api/ai/connection", async ({ request }) => { const body = await request.json() as AiSaveRequest; writes.push(body); current = { ...current, provider: body.provider, model: body.model, enabled: body.enabled, hasCredential: body.credentialChange !== "Remove", revision: current.revision + 1 }; return HttpResponse.json({ requestId: body.requestId, connection: current }); }),
    http.post("/api/ai/connection/test", async ({ request }) => { tests.push(await request.json()); return HttpResponse.json({ revision: current.revision, inputTokens: 4, outputTokens: 1 }); }));
});
afterEach(() => { queryClient.clear(); toast.dismiss(); vi.restoreAllMocks(); });
const keyField = () => screen.getByLabelText("Nueva clave de API");

describe("AI settings", () => {
  it("loads saved-key models automatically and tests the selected identifier without saving", async () => {
    const catalogs: unknown[] = [];
    server.use(http.post("/api/ai/connection/models", async ({ request }) => {
      catalogs.push(await request.json());
      return HttpResponse.json({ provider: "OpenAI", revision: 1, models: [{ id: "fictional-model", displayName: "Fictional model" }, { id: "next-model", displayName: "Next model" }] });
    }));
    renderRouteWithProviders("/configuracion/ia");
    const model = await screen.findByRole("combobox", { name: "Modelo" });
    expect(catalogs).toEqual([{ provider: "OpenAI", credentialChange: "Keep", apiKey: null, expectedRevision: 1 }]);
    await userEvent.selectOptions(model, "next-model");
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
    const model = await screen.findByRole("combobox", { name: "Modelo" });
    expect(model).toHaveValue("");
    await userEvent.selectOptions(model, "next-model");
    expect(catalogs).toEqual([{ provider: "OpenAI", credentialChange: "Replace", apiKey: "fictional-private-key", expectedRevision: 0 }]);
    expect(writes).toHaveLength(0);
    expect(tests).toHaveLength(0);
    expect(JSON.stringify(queryClient.getQueryCache().getAll().map(x => x.state))).not.toContain("fictional-private-key");
    expect(queryClient.getMutationCache().getAll()).toHaveLength(0);
  });
  it("keeps manual entry available when a saved model is missing from the catalog", async () => {
    server.use(http.post("/api/ai/connection/models", () => HttpResponse.json({ provider: "OpenAI", revision: 1, models: [{ id: "next-model", displayName: "Next model" }] })));
    renderRouteWithProviders("/configuracion/ia");
    expect(await screen.findByRole("combobox", { name: "Modelo" })).toHaveValue("fictional-model");
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
    expect(screen.queryByRole("option", { name: "Old model" })).not.toBeInTheDocument();
  });
  it("clears provider models and never sends the saved key to the new provider", async () => {
    const catalogs: unknown[] = [];
    server.use(http.post("/api/ai/connection/models", async ({ request }) => {
      catalogs.push(await request.json());
      return HttpResponse.json({ provider: "OpenAI", revision: 1, models: [{ id: "fictional-model", displayName: "Fictional model" }] });
    }));
    renderRouteWithProviders("/configuracion/ia");
    await screen.findByRole("combobox", { name: "Modelo" });
    await userEvent.selectOptions(screen.getByRole("combobox", { name: "Proveedor" }), "Anthropic");
    await userEvent.click(within(await screen.findByRole("dialog")).getByRole("button", { name: "Cambiar proveedor" }));
    expect(screen.queryByRole("option", { name: /Fictional model/ })).not.toBeInTheDocument();
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
    expect(screen.getByRole("button", { name: "Cargar modelos" })).toBeDisabled();
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
    expect(screen.getByRole("combobox", { name: "Proveedor" })).toHaveValue("OpenAI");
    expect(screen.getByRole("textbox", { name: "Modelo" })).toHaveValue("fictional-model");
    expect(screen.getByLabelText("Clave de API")).toHaveValue("fictional-private-key");
    expect(writes).toHaveLength(1);
  });
  it("confirms removing a key, pauses the connection and sends no plaintext", async () => {
    renderRouteWithProviders("/configuracion/ia");
    await userEvent.click(await screen.findByRole("button", { name: "Quitar clave" }));
    await userEvent.click(within(await screen.findByRole("dialog")).getByRole("button", { name: "Quitar clave" }));
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
    expect(screen.getByRole("button", { name: "Probar conexión" })).toBeDisabled();
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
  });
  it("reports a connection test through the notification without a status beside the button", async () => {
    const success = vi.spyOn(toast, "success");
    renderRouteWithProviders("/configuracion/ia");
    const credential = await screen.findByRole("region", { name: "Clave y prueba de conexión" });
    await userEvent.click(within(credential).getByRole("button", { name: "Probar conexión" }));
    await waitFor(() => expect(success).toHaveBeenCalledWith("La conexión respondió correctamente.", expect.anything()));
    // El resultado va al Toaster: al lado del botón no queda un estado de la prueba que cambie con cada acción.
    expect(screen.queryByText("Probada para este borrador")).not.toBeInTheDocument();
    expect(screen.queryByText("Sin prueba vigente")).not.toBeInTheDocument();
    expect(within(credential).queryByRole("status")).not.toBeInTheDocument();
    // Probar, Reemplazar y Quitar actúan sobre toda la superficie: van al borde derecho de su banda, no en el cuerpo.
    const band = within(credential).getByRole("heading", { level: 2, name: "Clave y prueba de conexión" }).parentElement as HTMLElement;
    expect(within(credential).getAllByRole("button")).toEqual(within(band).getAllByRole("button"));
    expect(within(band).getAllByRole("button").map(button => button.textContent)).toEqual(["Probar conexión", "Reemplazar clave", "Quitar clave"]);
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
    expect(await within(review).findByText("Anthropic, remote-model. Clave configurada. Disponible.")).toBeInTheDocument();
    // El número de revisión queda en los historiales, no en el resumen de la configuración actual.
    expect(within(review).queryByText(/Revisión 2/)).not.toBeInTheDocument();
    expect(within(band).getAllByRole("button").map(button => button.textContent)).toEqual(["Leer configuración actual", "Usar configuración actual", "Revisar con mi borrador"]);
    expect(within(review).getAllByRole("button")).toEqual(within(band).getAllByRole("button"));
  });
  it("confirms provider changes and clears the candidate key", async () => {
    renderRouteWithProviders("/configuracion/ia");
    await userEvent.click(await screen.findByRole("button", { name: "Reemplazar clave" }));
    await userEvent.type(keyField(), "fictional-private-key");
    await userEvent.selectOptions(screen.getByRole("combobox", { name: "Proveedor" }), "Anthropic");
    const dialog = await screen.findByRole("dialog");
    await userEvent.click(within(dialog).getByRole("button", { name: "Cambiar proveedor" }));
    expect(screen.getByRole("textbox", { name: "Modelo" })).toHaveValue("");
    expect(screen.getByLabelText("Clave de API")).toHaveValue("");
    expect(JSON.stringify(queryClient.getMutationCache().getAll().map(x => x.state.variables))).not.toContain("fictional-private-key");
  });
});
