import { act, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http } from "msw";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { queryClient } from "@/shared/api/queryClient";
import { renderRouteWithProviders } from "@/test/utils/renderWithProviders";
import { server } from "@/test/mocks/server";
import { createFormFixtureStore, fixtureFormId } from "@/test/visual/formFixtures";
import { notify } from "@/shared/ui/notifications";

vi.mock("react-oidc-context", async () => ({ ...await vi.importActual<typeof import("react-oidc-context")>("react-oidc-context"),
  useAuth: () => ({ isAuthenticated: true, isLoading: false, user: { access_token: "test" } }) }));
vi.mock("@/shared/ui/notifications", async () => ({ ...await vi.importActual<typeof import("@/shared/ui/notifications")>("@/shared/ui/notifications"), notify: vi.fn() }));
function setup(scenario = "", permissions = ["formtemplates.read", "formtemplates.manage"]) {
  const store = createFormFixtureStore("es", scenario);
  server.use(http.all("/api/forms/*", ({ request }) => store.handle(request)),
    http.get("/api/me", () => Response.json({ id: "actor", displayName: "Ana", email: "ana@example.com", emailConfirmed: true,
      phoneNumber: null, formattedPhoneNumber: null, maskedPhoneNumber: null, phoneNumberConfirmed: false, hasGoogleLogin: false,
      culture: "es", timeZoneId: "America/Argentina/Buenos_Aires", lastLoginAtUtc: null, roles: [], permissions })));
  return store;
}
beforeEach(() => { queryClient.clear(); vi.mocked(notify).mockClear(); });
describe("Forms routes", () => {
  it("closes confirmation as acceptance starts and shows progress instead of a misleading Cancel action", async () => {
    const store = setup("forms-publication-ready", ["formtemplates.read", "formtemplates.manage", "formtemplates.publish"]);
    let release: () => void = () => {};
    const pending = new Promise<void>(resolve => { release = resolve; });
    server.use(http.post("/api/forms/definitions/:id/publications", async ({ request }) => { await pending; return store.handle(request); }));
    renderRouteWithProviders("/formularios/" + fixtureFormId);
    await screen.findByLabelText("Nombre");
    await userEvent.click(screen.getByRole("button", { name: "Publicar en WhatsApp" }));
    const dialog = await screen.findByRole("dialog", { name: "Publicar en WhatsApp" });
    await userEvent.click(await within(dialog).findByRole("button", { name: "Publicar" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Aceptando publicación…" })).toBeInTheDocument();
    expect(screen.getByLabelText("Prefijo de numeración")).toHaveAttribute("readonly");
    release();
    await screen.findByRole("heading", { name: "Publicando · versión 1" });
  });

  it("routes a publication revision conflict to explicit draft review with one feedback owner", async () => {
    const store = setup("forms-publication-ready", ["formtemplates.read", "formtemplates.manage", "formtemplates.publish"]);
    let accepts = 0;
    server.use(http.post("/api/forms/definitions/:id/publications", () => {
      accepts++;
      const old = store.definitions.get(fixtureFormId)!;
      store.definitions.set(fixtureFormId, { ...old, revision: 2, name: { ...old.name, es: "Otra persona guardó" } });
      return Response.json({ code: "Forms.Draft.RevisionConflict", traceId: "publication-conflict" }, { status: 409 });
    }));
    renderRouteWithProviders("/formularios/" + fixtureFormId);
    await screen.findByLabelText("Nombre");
    await userEvent.click(screen.getByRole("button", { name: "Publicar en WhatsApp" }));
    const dialog = await screen.findByRole("dialog", { name: "Publicar en WhatsApp" });
    await userEvent.click(await within(dialog).findByRole("button", { name: "Publicar" }));
    const review = await screen.findByRole("button", { name: "Revisar" });
    expect(screen.getByLabelText("Nombre")).toHaveValue("Registrar visita");
    expect(screen.getByRole("button", { name: "Guardar borrador" })).toBeDisabled();
    await userEvent.click(review);
    const comparison = await screen.findByRole("dialog", { name: "Revisión del borrador" });
    expect(within(comparison).getByText("Otra persona guardó", { exact: true })).toBeInTheDocument();
    expect(screen.getByLabelText("Nombre")).toHaveValue("Registrar visita");
    expect(accepts).toBe(1);
    expect(vi.mocked(notify).mock.calls.filter(([message]) => message.description?.includes("publication-conflict"))).toHaveLength(1);
  });

  it("accepts a saved version with Publish and no Manage, while 202 remains pending", async () => {
    const store = setup("forms-publication-ready", ["formtemplates.read", "formtemplates.publish"]);
    renderRouteWithProviders("/formularios/" + fixtureFormId);
    await screen.findByLabelText("Nombre");
    await userEvent.click(screen.getByRole("button", { name: "Publicar en WhatsApp" }));
    const dialog = await screen.findByRole("dialog", { name: "Publicar en WhatsApp" });
    await userEvent.click(await within(dialog).findByRole("button", { name: "Publicar" }));
    await screen.findByRole("heading", { name: "Publicando · versión 1" });
    expect(screen.queryByText("Publicado · versión 1")).not.toBeInTheDocument();
    expect(screen.getByLabelText("Prefijo de numeración")).toHaveAttribute("readonly");
    expect(store.definitions.get(fixtureFormId)?.prefixLocked).toBe(true);
    expect(store.definitions.get(fixtureFormId)?.revision).toBe(1);
    expect(store.calls.filter(call => call.path.endsWith("/publications") && call.method === "POST")).toHaveLength(1);
    expect(store.calls.filter(call => call.method === "PUT")).toHaveLength(0);
  });
  it("shows confirmed progression while preserving a newer unsaved draft", async () => {
    const store = setup("forms-publication-progress", ["formtemplates.read", "formtemplates.manage", "formtemplates.publish"]);
    renderRouteWithProviders("/formularios/" + fixtureFormId);
    await screen.findByLabelText("Nombre");
    await userEvent.click(screen.getByRole("button", { name: "Publicar en WhatsApp" }));
    const dialog = await screen.findByRole("dialog", { name: "Publicar en WhatsApp" });
    await userEvent.click(await within(dialog).findByRole("button", { name: "Publicar" }));
    await screen.findByRole("heading", { name: "Publicando · versión 1" });
    await userEvent.type(screen.getByLabelText("Nombre"), " nuevo borrador");
    await userEvent.click(screen.getByRole("button", { name: "Consultar publicación" }));
    await screen.findByText("Enviada a WhatsApp; esperando confirmación");
    expect(screen.getByLabelText("Nombre")).toHaveValue("Registrar visita nuevo borrador");
    await userEvent.click(screen.getByRole("button", { name: "Consultar publicación" }));
    await screen.findByRole("heading", { name: "Publicado · versión 1" });
    expect(screen.getByLabelText("Nombre")).toHaveValue("Registrar visita nuevo borrador");
    expect(screen.getByLabelText("Prefijo de numeración")).toHaveValue("VIS");
    expect(store.definitions.get(fixtureFormId)?.revision).toBe(1);
    expect(store.calls.filter(call => call.path.endsWith("/publications") && call.method === "POST")).toHaveLength(1);
  });
  it("checks the newly saved revision after an explicit Save without accepting automatically", async () => {
    const store = setup("forms-publication-ready", ["formtemplates.read", "formtemplates.manage", "formtemplates.publish"]);
    renderRouteWithProviders("/formularios/" + fixtureFormId);
    await userEvent.type(await screen.findByLabelText("Nombre"), " editado");
    await userEvent.click(screen.getByRole("button", { name: "Publicar en WhatsApp" }));
    const first = await screen.findByRole("dialog", { name: "Primero guardá los cambios" });
    await userEvent.click(within(first).getByRole("button", { name: "Guardar borrador" }));
    const checked = await screen.findByRole("dialog", { name: "Publicar en WhatsApp" });
    await waitFor(() => expect(within(checked).getByRole("button", { name: "Publicar" })).toBeEnabled());
    expect(store.definitions.get(fixtureFormId)?.revision).toBe(2);
    expect(store.calls.filter(call => call.path.endsWith("/publication-checks"))).toHaveLength(1);
    expect(store.calls.filter(call => call.path.endsWith("/publications"))).toHaveLength(0);
    await userEvent.click(within(checked).getByRole("button", { name: "Cancelar" }));
    expect(screen.getByLabelText("Nombre")).toHaveValue("Registrar visita editado");
  });

  it("checks publication with Read and Publish, without creating a write attempt or requiring Manage", async () => {
    const store = setup("forms-read", ["formtemplates.read", "formtemplates.publish"]);
    let checks = 0;
    server.use(http.post("/api/forms/definitions/:id/publication-checks", () => {
      checks++;
      const current = store.definitions.get(fixtureFormId)!;
      return Response.json({ definitionId: current.id, draftRevision: current.revision, compatibility: "Blocked", canAccept: false,
        acceptanceAvailability: "Unavailable", checkToken: null, checkExpiresAtUtc: null, channels: [], issues: [{ channelId: null, fieldId: current.draft.fields[5]!.fieldId, choiceId: null,
          path: "draft.fields[5].help.en", code: "Forms.Publication.MissingTranslation", message: "Completá la ayuda en inglés.", limit: null, culture: "en" }],
        diff: { baseVersionId: null, added: current.draft.fields.map(q => q.fieldId), changed: [], removed: [] } });
    }));
    renderRouteWithProviders("/formularios/" + fixtureFormId);
    await screen.findByLabelText("Nombre");
    await userEvent.click(screen.getByRole("button", { name: "Publicar en WhatsApp" }));
    const dialog = await screen.findByRole("dialog", { name: "Publicar en WhatsApp" });
    expect(await within(dialog).findByText("Completá la ayuda en inglés.")).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: "Publicar" })).toBeDisabled();
    await userEvent.click(within(dialog).getByRole("button", { name: "Ir a la pregunta" }));
    expect(screen.getByRole("button", { name: /^English/ })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByLabelText("Ayuda para el empleado")).toHaveValue("");
    expect(checks).toBe(1);
    expect(store.calls.filter(call => call.method === "PUT" || call.method === "POST")).toHaveLength(0);
  });
  it("requires a saved draft before checking and never saves merely by opening publication", async () => {
    const store = setup("", ["formtemplates.read", "formtemplates.manage", "formtemplates.publish"]);
    let checks = 0;
    server.use(http.post("/api/forms/definitions/:id/publication-checks", () => { checks++; return Response.json({}); }));
    renderRouteWithProviders("/formularios/" + fixtureFormId);
    await userEvent.type(await screen.findByLabelText("Nombre"), " editado");
    await userEvent.click(screen.getByRole("button", { name: "Publicar en WhatsApp" }));
    const dialog = await screen.findByRole("dialog", { name: "Primero guardá los cambios" });
    expect(within(dialog).getByRole("button", { name: "Guardar borrador" })).toBeEnabled();
    expect(checks).toBe(0);
    expect(store.calls.filter(call => call.method === "PUT" || call.method === "POST")).toHaveLength(0);
    await userEvent.click(within(dialog).getByRole("button", { name: "Cancelar" }));
    expect(screen.getByLabelText("Nombre")).toHaveValue("Registrar visita editado");
  });

  it("edits the selected content language without substituting original text or changing identities", async () => {
    const store = setup();
    const original = store.definitions.get(fixtureFormId)!;
    store.definitions.set(fixtureFormId, { ...original, name: { es: original.name.es, en: "" }, draft: { ...original.draft, fields: original.draft.fields.map(q => q.type === "decimal" ? { ...q, label: { ...q.label, en: "" } } : q) } });
    renderRouteWithProviders("/formularios/" + fixtureFormId);
    await screen.findByLabelText("Nombre");
    await userEvent.click(screen.getByRole("button", { name: /^English/ }));
    expect(screen.getByLabelText("Nombre")).toHaveValue("");
    expect(screen.getByLabelText("Prefijo de numeración")).toHaveAttribute("readonly");
    await userEvent.click(screen.getByRole("button", { name: "Editar Importe cobrado" }));
    expect(screen.getByLabelText("Pregunta")).toHaveValue("");
    expect(screen.getByText("Original (Español): Importe cobrado")).toBeInTheDocument();
    expect(within(screen.getByRole("region", { name: "Vista previa" })).getByRole("radio", { name: "No" })).toBeInTheDocument();
    expect(within(screen.getByRole("region", { name: "Vista previa" })).getByRole("radio", { name: "Yes" })).toBeInTheDocument();
    await userEvent.type(screen.getByLabelText("Nombre"), "Visit report");
    await userEvent.click(screen.getByRole("button", { name: "Guardar borrador" }));
    await waitFor(() => expect(store.definitions.get(fixtureFormId)?.revision).toBe(2));
    const saved = store.definitions.get(fixtureFormId)!;
    expect(saved.name).toEqual({ es: "Registrar visita", en: "Visit report" });
    expect(saved.draft.culture).toBe("es");
    expect(saved.draft.fields.find(q => q.type === "decimal")?.label).toEqual({ es: "Importe cobrado", en: "" });
    expect(saved.draft.fields.find(q => q.type === "longText")?.help).toEqual({ es: "Contá lo que pasó." });
    expect(saved.draft.fields.map(q => q.fieldId)).toEqual(original.draft.fields.map(q => q.fieldId));
    await userEvent.click(screen.getByRole("button", { name: /^Español/ }));
    expect(screen.getByLabelText("Nombre")).toHaveValue("Registrar visita");
  });
  it("selects the language of a validation error and focuses its control without an extra toast", async () => {
    setup();
    server.use(http.put("/api/forms/definitions/:id/draft", () => Response.json({ code: "Validation.Failed", errors: { "name.es": ["Ingresá un nombre original."] } }, { status: 400 })));
    renderRouteWithProviders("/formularios/" + fixtureFormId);
    await screen.findByLabelText("Nombre");
    await userEvent.click(screen.getByRole("button", { name: /^English/ }));
    await userEvent.click(screen.getByRole("button", { name: "Guardar borrador" }));
    expect(await screen.findByText("Ingresá un nombre original.")).toBeInTheDocument();
    await waitFor(() => expect(screen.getByLabelText("Nombre")).toHaveFocus());
    expect(screen.getByRole("button", { name: /^Español/ })).toHaveAttribute("aria-pressed", "true");
    expect(vi.mocked(notify).mock.calls.filter(([notice]) => notice.kind === "error")).toHaveLength(0);
  });
  it("keeps visible validation at the field and reports an unmapped error once with its trace", async () => {
    setup();
    server.use(http.put("/api/forms/definitions/:id/draft", () => Response.json({
      code: "Validation.Failed", traceId: "trace-form", errors: {
        "draft.fields[0].label.es": ["Ingresá la pregunta."],
        "draft.fields[0].fieldId": ["La identidad no está disponible."],
      },
    }, { status: 400 })));
    renderRouteWithProviders("/formularios/" + fixtureFormId);
    await screen.findByLabelText("Nombre");
    await userEvent.click(screen.getByRole("button", { name: "Guardar borrador" }));
    expect(await screen.findByText("Ingresá la pregunta.")).toBeInTheDocument();
    await waitFor(() => expect(vi.mocked(notify).mock.calls.filter(([notice]) => notice.kind === "error")).toHaveLength(1));
    expect(vi.mocked(notify).mock.calls.find(([notice]) => notice.kind === "error")?.[0]).toMatchObject({ description: "Código para reportar: trace-form" });
    expect(screen.getByRole("button", { name: "Guardar borrador" })).toBeEnabled();
  });
  it("reports a failed detail load once while keeping a recovery surface", async () => {
    setup();
    server.use(http.get("/api/forms/definitions/:id", () => Response.json({ code: "General.Unexpected", traceId: "trace-read" }, { status: 500 })));
    renderRouteWithProviders("/formularios/" + fixtureFormId);
    expect(await screen.findByText("No pudimos cargar el formulario.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Reintentar" })).toBeInTheDocument();
    await waitFor(() => expect(vi.mocked(notify).mock.calls.filter(([notice]) => notice.kind === "error")).toHaveLength(1));
  });

  it("creates nothing before save, confirms once, remains in the editor and rereads the saved record", async () => {
    const store = setup("forms-empty");
    const { router } = renderRouteWithProviders("/formularios/nuevo");
    await screen.findByLabelText("Nombre");
    expect(store.calls.filter(call => call.method === "POST")).toHaveLength(0);
    await userEvent.type(screen.getByLabelText("Nombre"), "Registrar entrega");
    expect(screen.getByLabelText("Prefijo de numeración")).toHaveValue("ENT");
    await userEvent.click(screen.getByRole("button", { name: "Guardar borrador" }));
    await waitFor(() => expect(router.state.location.pathname).toMatch(/^\/formularios\/0199/));
    expect(await screen.findByLabelText("Nombre")).toHaveValue("Registrar entrega");
    expect(store.calls.filter(call => call.method === "POST")).toHaveLength(1);
    expect(vi.mocked(notify).mock.calls.filter(([notice]) => notice.kind === "success")).toHaveLength(1);
    await act(() => router.navigate("/formularios"));
    await screen.findByRole("table");
    await userEvent.click(within(screen.getByRole("table")).getByRole("link", { name: "Registrar entrega" }));
    expect(await screen.findByLabelText("Nombre")).toHaveValue("Registrar entrega");
    expect(store.calls.some(call => call.method === "GET" && call.path.includes("/definitions/0199"))).toBe(true);
    expect(screen.queryByRole("button", { name: "Publicar en WhatsApp" })).not.toBeInTheDocument();
  });
  it("keeps server facets and filters in the URL and exposes no future actions", async () => {
    setup();
    const { router } = renderRouteWithProviders("/formularios");
    await screen.findByRole("table");
    expect(screen.getByRole("button", { name: "Publicados (0)" })).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Publicados (0)" }));
    await waitFor(() => expect(router.state.location.search).toContain("publicationFilter=Published"));
    expect(await screen.findByText("Sin coincidencias")).toBeInTheDocument();
    expect(screen.queryByText("Respuestas", { exact: true })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Limpiar filtros" }));
    expect(await screen.findByRole("table")).toBeInTheDocument();
  });
  it("preserves a draft through conflict and requires explicit decisions without an automatic write", async () => {
    const store = setup("forms-conflict");
    renderRouteWithProviders("/formularios/" + fixtureFormId);
    await userEvent.clear(await screen.findByLabelText("Nombre"));
    await userEvent.type(screen.getByLabelText("Nombre"), "Mis cambios");
    await userEvent.click(screen.getByRole("button", { name: "Guardar borrador" }));
    await userEvent.click(await screen.findByRole("button", { name: "Revisar" }));
    const review = await screen.findByRole("dialog", { name: "Revisión del borrador" });
    expect(within(review).getByRole("cell", { name: "Mis cambios" })).toBeInTheDocument();
    expect(screen.getByLabelText("Nombre")).toHaveValue("Mis cambios");
    await userEvent.click(within(review).getByRole("button", { name: "Conservar mis cambios" }));
    expect(within(review).getByRole("button", { name: "Terminar la revisión" })).toBeDisabled();
    for (const select of within(review).getAllByRole("combobox")) await userEvent.selectOptions(select, "mine");
    await userEvent.click(within(review).getByRole("button", { name: "Terminar la revisión" }));
    expect(screen.getByLabelText("Nombre")).toHaveValue("Mis cambios");
    expect(store.calls.filter(call => call.method === "PUT")).toHaveLength(1);
    await userEvent.click(screen.getByRole("button", { name: "Guardar borrador" }));
    await waitFor(() => expect(store.definitions.get(fixtureFormId)?.revision).toBe(3));
    expect(store.definitions.get(fixtureFormId)?.name.es).toBe("Mis cambios");
  });
  it("keeps a confirmed locked prefix selectable and readonly even with no active publication", async () => {
    setup("forms-prefix");
    renderRouteWithProviders("/formularios/" + fixtureFormId);
    const prefix = await screen.findByLabelText("Prefijo de numeración");
    expect(prefix).toHaveAttribute("readonly"); expect(prefix).not.toBeDisabled();
    expect(screen.getByText("El prefijo quedó fijo cuando se aceptó la primera publicación, aunque después no se haya completado.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Guardar borrador" })).toBeEnabled();
  });
  it("does not interpret a missing receipt as rollback and recovers without creating another form", async () => {
    const store = setup("forms-uncertain");
    renderRouteWithProviders("/formularios/nuevo");
    await userEvent.type(await screen.findByLabelText("Nombre"), "Registrar entrega");
    await userEvent.click(screen.getByRole("button", { name: "Guardar borrador" }));
    await userEvent.click(await screen.findByRole("button", { name: "Consultar guardado" }));
    const replay = await screen.findByRole("button", { name: "Repetir el mismo intento" });
    expect(replay).toBeEnabled(); expect(screen.getByRole("button", { name: "Guardar borrador" })).toBeDisabled();
    expect(screen.getByLabelText("Nombre")).toHaveValue("Registrar entrega");
    await userEvent.click(screen.getByRole("button", { name: "Consultar guardado" }));
    await waitFor(() => expect(vi.mocked(notify).mock.calls.some(([notice]) => notice.kind === "success")).toBe(true));
    expect(store.calls.filter(call => call.method === "POST")).toHaveLength(1);
  });
  it("omits writes for read-only permissions while retaining the detail and preview", async () => {
    setup("forms-read", ["formtemplates.read"]);
    renderRouteWithProviders("/formularios/" + fixtureFormId);
    expect(await screen.findByLabelText("Nombre")).toHaveAttribute("readonly");
    expect(screen.queryByRole("button", { name: "Guardar borrador" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Agregar pregunta" })).not.toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Vista previa" })).toBeInTheDocument();
  });
});

it.each([null,1])("shows Failed independently of previous active version %s",async activeVersionNumber=>{
 setup();
 server.use(http.get("/api/forms/definitions",()=>Response.json({items:[{id:fixtureFormId,name:{es:"Visita",en:"Visit"},prefix:"VIS",questionCount:6,activeVersionNumber,displayState:"Failed",lastChangedAtUtc:"2026-10-10T12:00:00Z",lastChangedBy:null,canEdit:true}],page:1,pageSize:20,totalCount:1,totalPages:1,hasNext:false,hasPrevious:false})));
 renderRouteWithProviders("/formularios");
 await screen.findByText("No se pudo publicar",{exact:true});
 expect(screen.queryByText(/^No se pudo publicar · versión/)).not.toBeInTheDocument();
 if(activeVersionNumber)expect(screen.getByText("La versión 1 publicada sigue activa.")).toBeInTheDocument();
});
