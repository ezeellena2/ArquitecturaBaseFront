import realPublishedList from "@/test/fixtures/forms-http/published/list-es.json";
import realFailedDetail from "@/test/fixtures/forms-http/failed/detail-es.json";
import realFailedStatus from "@/test/fixtures/forms-http/failed/status-es.json";
import { act, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { queryClient } from "@/shared/api/queryClient";
import { renderRouteWithProviders } from "@/test/utils/renderWithProviders";
import { server } from "@/test/mocks/server";
import { createFormFixtureStore, fixtureFormId, fixtureLifecycle } from "@/test/visual/formFixtures";
import { notify } from "@/shared/ui/notifications";

vi.mock("react-oidc-context", async () => ({ ...await vi.importActual<typeof import("react-oidc-context")>("react-oidc-context"),
  useAuth: () => ({ isAuthenticated: true, isLoading: false, user: { access_token: "test" } }) }));
vi.mock("@/shared/ui/notifications", async () => ({ ...await vi.importActual<typeof import("@/shared/ui/notifications")>("@/shared/ui/notifications"), notify: vi.fn() }));
// These cases verify complete draft values; pasting avoids a full-page render for every character.
async function pasteText(control: HTMLElement, text: string) {
  const user = userEvent.setup();
  await user.click(control);
  await user.paste(text);
}
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
    const dialog = await screen.findByRole("dialog", { name: "Publicar la versión 1 en WhatsApp" });
    await userEvent.click(await within(dialog).findByRole("button", { name: "Publicar versión 1" }));
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
    const dialog = await screen.findByRole("dialog", { name: "Publicar la versión 1 en WhatsApp" });
    await userEvent.click(await within(dialog).findByRole("button", { name: "Publicar versión 1" }));
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
    const dialog = await screen.findByRole("dialog", { name: "Publicar la versión 1 en WhatsApp" });
    await userEvent.click(await within(dialog).findByRole("button", { name: "Publicar versión 1" }));
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
    const dialog = await screen.findByRole("dialog", { name: "Publicar la versión 1 en WhatsApp" });
    await userEvent.click(await within(dialog).findByRole("button", { name: "Publicar versión 1" }));
    await screen.findByRole("heading", { name: "Publicando · versión 1" });
    await pasteText(screen.getByLabelText("Nombre"), " nuevo borrador");
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
    await pasteText(await screen.findByLabelText("Nombre"), " editado");
    await userEvent.click(screen.getByRole("button", { name: "Publicar en WhatsApp" }));
    const first = await screen.findByRole("dialog", { name: "Primero guardá los cambios" });
    await userEvent.click(within(first).getByRole("button", { name: "Guardar borrador" }));
    const checked = await screen.findByRole("dialog", { name: "Publicar la versión 1 en WhatsApp" });
    await waitFor(() => expect(within(checked).getByRole("button", { name: "Publicar versión 1" })).toBeEnabled());
    expect(store.definitions.get(fixtureFormId)?.revision).toBe(2);
    expect(store.calls.filter(call => call.path.endsWith("/publication-checks"))).toHaveLength(1);
    expect(store.calls.filter(call => call.path.endsWith("/publications"))).toHaveLength(0);
    await userEvent.click(within(checked).getByRole("button", { name: "Cancelar" }));
    expect(screen.getByLabelText("Nombre")).toHaveValue("Registrar visita editado");
  });

  it("allows the original with Read and Publish without offering translation editing", async () => {
    const store = setup("forms-publication-ready", ["formtemplates.read", "formtemplates.publish"]);
    const current = store.definitions.get(fixtureFormId)!;
    store.definitions.set(current.id, { ...current, draft: { ...current.draft, fields: current.draft.fields.map(field => field.type === "longText" ? { ...field, help: { es: "Contá lo que pasó." } } : field) } });
    renderRouteWithProviders("/formularios/" + fixtureFormId);
    await screen.findByLabelText("Nombre");
    await userEvent.click(screen.getByRole("button", { name: "Publicar en WhatsApp" }));
    const dialog = await screen.findByRole("dialog", { name: "Publicar la versión 1 en WhatsApp" });
    expect(await within(dialog).findByText("El inglés no se publica.")).toBeInTheDocument();
    expect(within(dialog).getByText("Observaciones · la ayuda")).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: "Publicar versión 1" })).toBeEnabled();
    expect(within(dialog).queryByRole("button", { name: "Completar el inglés" })).not.toBeInTheDocument();
    expect(store.calls.filter(call => call.path.endsWith("/publication-checks"))).toHaveLength(1);
    expect(store.writes).toHaveLength(0);
  });
  it("returns from optional translation completion to its exact control without changing the draft", async () => {
    const store = setup("forms-publication-ready", ["formtemplates.read", "formtemplates.publish", "formtemplates.manage"]);
    const current = store.definitions.get(fixtureFormId)!;
    store.definitions.set(current.id, { ...current, draft: { ...current.draft, fields: current.draft.fields.map(field => field.type === "longText" ? { ...field, help: { es: "Contá lo que pasó." } } : field) } });
    renderRouteWithProviders("/formularios/" + fixtureFormId);
    await screen.findByLabelText("Nombre");
    await userEvent.click(screen.getByRole("button", { name: "Publicar en WhatsApp" }));
    const dialog = await screen.findByRole("dialog");
    await userEvent.click(await within(dialog).findByRole("button", { name: "Completar el inglés" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^English/ })).toHaveAttribute("aria-pressed", "true");
    await waitFor(() => expect(screen.getByLabelText("Ayuda para el empleado")).toHaveFocus());
    expect(screen.getByLabelText("Ayuda para el empleado")).toHaveValue("");
    expect(store.writes).toHaveLength(0);
    expect(store.definitions.get(current.id)?.revision).toBe(current.revision);
  });
  it("requires a saved draft before checking and never saves merely by opening publication", async () => {
    const store = setup("", ["formtemplates.read", "formtemplates.manage", "formtemplates.publish"]);
    let checks = 0;
    server.use(http.post("/api/forms/definitions/:id/publication-checks", () => { checks++; return Response.json({}); }));
    renderRouteWithProviders("/formularios/" + fixtureFormId);
    await pasteText(await screen.findByLabelText("Nombre"), " editado");
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
    expect(screen.getByLabelText("Nombre")).toHaveAttribute("placeholder", "Sin traducir");
    expect(screen.getByRole("button", { name: "Español · original" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "English · 3 sin traducir" })).toBeInTheDocument();
    expect(screen.getByLabelText("Prefijo de numeración")).toHaveAttribute("readonly");
    await userEvent.click(screen.getByRole("button", { name: "Editar Importe cobrado" }));
    expect(screen.getByLabelText("Pregunta")).toHaveValue("");
    expect(screen.getByText("Original (Español): Importe cobrado")).toBeInTheDocument();
    expect(within(screen.getByRole("region", { name: "Vista previa" })).getByRole("radio", { name: "No" })).toBeInTheDocument();
    expect(within(screen.getByRole("region", { name: "Vista previa" })).getByRole("radio", { name: "Sí" })).toBeInTheDocument();
    expect(within(screen.getByRole("region", { name: "Vista previa" })).queryByRole("radio", { name: "Yes" })).not.toBeInTheDocument();
    await pasteText(screen.getByLabelText("Nombre"), "Visit report");
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
    await pasteText(screen.getByLabelText("Nombre"), "Registrar entrega");
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
  it("keeps server lifecycle facets and filters in the URL", async () => {
    setup();
    const { router } = renderRouteWithProviders("/formularios");
    await screen.findByRole("table");
    expect(screen.getByRole("columnheader", { name: "Respuestas" })).toBeInTheDocument();
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
    await pasteText(screen.getByLabelText("Nombre"), "Mis cambios");
    await userEvent.click(screen.getByRole("button", { name: "Guardar borrador" }));
    await userEvent.click(await screen.findByRole("button", { name: "Revisar" }));
    const review = await screen.findByRole("dialog", { name: "Revisión del borrador" });
    expect(within(review).getByRole("cell", { name: "Mis cambios" })).toBeInTheDocument();
    expect(screen.getByLabelText("Nombre")).toHaveValue("Mis cambios");
    await userEvent.click(within(review).getByRole("button", { name: "Conservar mis cambios" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.getByText("Cambios de la otra revisión para revisar")).toBeInTheDocument();
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
    await pasteText(await screen.findByLabelText("Nombre"), "Registrar entrega");
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
    expect(screen.getByRole("textbox", { name: "Cuándo lo ofrece el asistente" })).toHaveAttribute("readonly");
    expect(screen.queryByRole("button", { name: "Guardar borrador" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Agregar pregunta" })).not.toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Vista previa" })).toBeInTheDocument();
  });
});

it.each([null,1])("shows Failed independently of previous active version %s",async activeVersionNumber=>{
 setup();
 server.use(http.get("/api/forms/definitions",()=>Response.json({items:[{id:fixtureFormId,name:{es:"Visita",en:"Visit"},prefix:"VIS",questionCount:6,activeVersionNumber,displayState:"Failed",lastChangedAtUtc:"2026-10-10T12:00:00Z",lastChangedBy:null,canEdit:true,lifecycle:fixtureLifecycle()}],page:1,pageSize:20,totalCount:1,totalPages:1,hasNext:false,hasPrevious:false})));
 renderRouteWithProviders("/formularios");
 await screen.findByText("No se pudo publicar",{exact:true});
 expect(screen.queryByText(/^No se pudo publicar · versión/)).not.toBeInTheDocument();
 if(activeVersionNumber)expect(screen.getByText("La versión 1 publicada sigue activa.")).toBeInTheDocument();
});

it("returns focus to a neighboring row after confirmed question removal", async () => {
  setup();
  renderRouteWithProviders("/formularios/" + fixtureFormId);
  await screen.findByLabelText("Nombre");
  await userEvent.click(screen.getByRole("button", { name: "Quitar Cliente" }));
  const dialog = await screen.findByRole("dialog");
  await userEvent.click(within(dialog).getByRole("button", { name: "Quitar pregunta" }));
  await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  expect(screen.getByRole("button", { name: "Editar Contacto" })).toHaveFocus();
});

it("leaves a clean draft directly when Discard is chosen", async () => {
  setup();
  const { router } = renderRouteWithProviders("/formularios/" + fixtureFormId);
  await screen.findByLabelText("Nombre");
  await userEvent.click(screen.getByRole("button", { name: "Descartar" }));
  await waitFor(() => expect(router.state.location.pathname).toBe("/formularios"));
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
});
it("disables Discard while acceptance is pending and while its result is unconfirmed", async () => {
  const store = setup("forms-publication-uncertain", ["formtemplates.read", "formtemplates.manage", "formtemplates.publish"]);
  let release = () => {};
  const pending = new Promise<void>(resolve => { release = resolve; });
  server.use(http.post("/api/forms/definitions/:id/publications", async ({ request }) => { await pending; return store.handle(request); }));
  renderRouteWithProviders("/formularios/" + fixtureFormId);
  await screen.findByLabelText("Nombre");
  await userEvent.click(screen.getByRole("button", { name: "Publicar en WhatsApp" }));
  const dialog = await screen.findByRole("dialog", { name: "Publicar la versión 1 en WhatsApp" });
  await userEvent.click(await within(dialog).findByRole("button", { name: "Publicar versión 1" }));
  try { expect(screen.getByRole("button", { name: "Descartar" })).toBeDisabled(); } finally { release(); }
  await screen.findByRole("heading", { name: "Publicación sin confirmar" });
  expect(screen.getByRole("button", { name: "Descartar" })).toBeDisabled();
});

it("reports the common server cause and trace for a failed initial list", async () => {
  setup();
  server.use(http.get("/api/forms/definitions", () => Response.json({ traceId: "trace-list" }, { status: 500 })));
  renderRouteWithProviders("/formularios");
  await screen.findByRole("button", { name: "Reintentar" });
  await waitFor(() => expect(vi.mocked(notify).mock.calls.some(([notice]) => notice.message.includes("trace-list"))).toBe(true));
  expect(vi.mocked(notify).mock.calls.filter(([notice]) => notice.kind === "error")).toHaveLength(1);
});
it("shows a missing form without an operational error toast", async () => {
  setup();
  server.use(http.get("/api/forms/definitions/:id", () => Response.json({ code: "Forms.Definition.NotFound", traceId: "missing-form" }, { status: 404 })));
  renderRouteWithProviders("/formularios/" + fixtureFormId);
  await screen.findByRole("button", { name: "Reintentar" });
  expect(vi.mocked(notify).mock.calls.filter(([notice]) => notice.kind === "error")).toHaveLength(0);
});

it("retains the table and sort focus through loading and failure without refetching unchanged facets", async () => {
  const store = setup();
  let reads = 0, release = () => {};
  const pending = new Promise<void>(resolve => { release = resolve; });
  server.use(http.get("/api/forms/definitions", async ({ request }) => {
    reads++;
    if (reads === 1) return store.handle(request);
    await pending;
    return Response.json({ traceId: "sort-refresh" }, { status: 500 });
  }));
  renderRouteWithProviders("/formularios");
  await screen.findByRole("table");
  const sort = screen.getByRole("button", { name: "Formulario" });
  await userEvent.click(sort);
  await waitFor(() => expect(reads).toBe(2));
  try {
    expect(screen.getByRole("table")).toBeInTheDocument();
    expect(sort).toHaveFocus();
  } finally { release(); }
  await waitFor(() => expect(vi.mocked(notify).mock.calls.some(([notice]) => notice.message.includes("sort-refresh"))).toBe(true));
  expect(screen.getByRole("link", { name: "Registrar visita" })).toBeInTheDocument();
  expect(sort).toHaveFocus();
  expect(store.calls.filter(call => call.path.endsWith("/facets"))).toHaveLength(1);
});

it("shows Forbidden without issuing form reads when Read is absent", async () => {
  const store = setup("", ["formtemplates.manage"]);
  renderRouteWithProviders("/formularios/" + fixtureFormId);
  await screen.findByRole("heading", { name: "No tenés permiso" });
  expect(store.calls).toHaveLength(0);
});
it("keeps the read-only list navigable without write actions", async () => {
  setup("forms-read", ["formtemplates.read"]);
  renderRouteWithProviders("/formularios");
  const table = await screen.findByRole("table");
  expect(within(table).getByRole("link", { name: "Registrar visita" })).toBeInTheDocument();
  expect(screen.queryByRole("link", { name: "Nuevo formulario" })).not.toBeInTheDocument();
  expect(within(table).queryByRole("button", { name: /Editar/ })).not.toBeInTheDocument();
});

it("shows Published with its version from an actual backend list response", async () => {
  setup();
  server.use(http.get("/api/forms/definitions", () => Response.json(realPublishedList)));
  renderRouteWithProviders("/formularios");
  await screen.findByText("Publicado · versión 1", { exact: true });
});
it("marks the affected question and focuses the correct language from actual Failed HTTP diagnostics", async () => {
  setup("", ["formtemplates.read", "formtemplates.manage", "formtemplates.publish"]);
  const { definitionId, requestId } = realFailedStatus;
  server.use(http.get("/api/forms/definitions/" + definitionId, () => Response.json(realFailedDetail)),
    http.get("/api/forms/definitions/" + definitionId + "/publications/" + requestId, () => Response.json(realFailedStatus)));
  renderRouteWithProviders("/formularios/" + definitionId);
  await screen.findByRole("heading", { name: "No se pudo publicar · versión 1" });
  await userEvent.click(await screen.findByRole("button", { name: "Ir a la pregunta" }));
  await waitFor(() => expect(screen.getByRole("button", { name: /^English/ })).toHaveAttribute("aria-pressed", "true"));
  const label = screen.getByLabelText("Pregunta");
  expect(label).toHaveFocus();
  expect(label).toHaveAttribute("aria-invalid", "true");
  expect(document.getElementById(label.getAttribute("aria-describedby")!)).toHaveTextContent(realFailedStatus.issues[0]!.message);
});

it("preserves unsaved text and focus when a detail refresh fails", async () => {
  setup();
  renderRouteWithProviders("/formularios/" + fixtureFormId);
  const name = await screen.findByLabelText("Nombre");
  await userEvent.clear(name);
  await pasteText(name, "Mi cambio sin guardar");
  server.use(http.get("/api/forms/definitions/:id", () => Response.json({ traceId: "detail-refresh" }, { status: 500 })));
  await act(() => queryClient.invalidateQueries({ predicate: query => query.queryKey.includes("detail") }));
  await waitFor(() => expect(vi.mocked(notify).mock.calls.some(([notice]) => notice.message.includes("detail-refresh"))).toBe(true));
  expect(name).toHaveValue("Mi cambio sin guardar");
  expect(name).toHaveFocus();
  expect(screen.queryByText("No pudimos cargar el formulario.")).not.toBeInTheDocument();
});
it("reports the common network cause for a failed detail read", async () => {
  setup();
  server.use(http.get("/api/forms/definitions/:id", () => HttpResponse.error()));
  renderRouteWithProviders("/formularios/" + fixtureFormId);
  await screen.findByRole("button", { name: "Reintentar" }, { timeout: 5000 });
  await waitFor(() => expect(vi.mocked(notify).mock.calls.filter(([notice]) => notice.kind === "error")).toHaveLength(1));
  expect(vi.mocked(notify).mock.calls.find(([notice]) => notice.kind === "error")?.[0].message).toBe("No pudimos conectarnos. Revisá tu conexión.");
});
it("offers only Stay when navigation is attempted during an unresolved save", async () => {
  const store = setup();
  let release = () => {};
  const pending = new Promise<void>(resolve => { release = resolve; });
  server.use(http.put("/api/forms/definitions/:id/draft", async ({ request }) => { await pending; return store.handle(request); }));
  const { router } = renderRouteWithProviders("/formularios/" + fixtureFormId);
  await pasteText(await screen.findByLabelText("Nombre"), " cambio");
  await userEvent.click(screen.getByRole("button", { name: "Guardar borrador" }));
  await act(() => router.navigate("/formularios"));
  try {
    const dialog = await screen.findByRole("dialog", { name: "Guardando…" });
    expect(within(dialog).getByRole("button", { name: "Seguir editando" })).toBeInTheDocument();
    expect(within(dialog).queryByRole("button", { name: "Revisar" })).not.toBeInTheDocument();
    expect(within(dialog).queryByRole("button", { name: "Descartar" })).not.toBeInTheDocument();
  } finally { release(); }
});

it("creates a catalog question, reports its missing selection, then saves the selected catalog", async () => {
  const store = setup("forms-empty", ["formtemplates.read","formtemplates.manage","formcatalogs.read"]);
  const catalogId = "01990000-0000-7000-8000-000000000080";
  const sent: unknown[] = [];
  server.use(http.get("/api/forms/catalogs", () => Response.json({items:[{id:catalogId,name:"Clientes",description:null,origin:"Manual",optionsCount:1,usageCount:0,state:"Active",stateReason:null,canEdit:false}],page:1,pageSize:20,totalCount:1,totalPages:1,hasPrevious:false,hasNext:false,filterCounts:{byKind:{all:1,manual:1,filters:0}}})),
    http.post("/api/forms/definitions", async ({request}) => {
      const body = await request.clone().json() as {draft:{fields:{source:{catalog:string|null}}[]}}; sent.push(body);
      if (sent.length===1) {
        expect(body.draft.fields[0]!.source.catalog).toBeNull();
        return Response.json({code:"Validation.Failed",errors:{"draft.fields[0].source.catalog":["Elegí un catálogo."]}},{status:400});
      }
      return store.handle(request);
    }));
  const {router} = renderRouteWithProviders("/formularios/nuevo");
  await pasteText(await screen.findByLabelText("Nombre"),"Visita catálogo");
  await userEvent.click(screen.getByRole("button",{name:"Agregar pregunta"}));
  await pasteText(screen.getAllByRole("textbox",{name:"Pregunta"})[0]!,"Cliente");
  await userEvent.selectOptions(screen.getByLabelText("Tipo de respuesta"),"catalogChoice");
  await userEvent.click(screen.getByRole("button",{name:"Guardar borrador"}));
  expect(await screen.findByText("Elegí un catálogo.")).toBeInTheDocument();
  const catalog = screen.getByRole("combobox",{name:"Catálogo"});
  expect(catalog).toHaveAttribute("aria-invalid","true");
  await screen.findByRole("option",{name:/Clientes ·/});
  await userEvent.selectOptions(catalog,catalogId);
  await userEvent.click(screen.getByRole("button",{name:"Guardar borrador"}));
  await waitFor(()=>expect(router.state.location.pathname).toMatch(/^\/formularios\/0199/));
  expect(sent).toHaveLength(2);
});

it("keeps rule changes under the editor's existing leave guard without changing the form draft", async () => {
  const store = setup("", ["formtemplates.read", "formrules.manage"]);
  const draftWrites = vi.fn();
  server.use(http.get("/api/forms/definitions/:id/rules", () => HttpResponse.json({ id: null, definitionId: fixtureFormId, revision: 0, originalCulture: "es", rules: [], createdAtUtc: null, author: null })),
    http.get("/api/forms/definitions/:id/rules/options", () => HttpResponse.json({ definitionId: fixtureFormId, name: { es: "Registrar visita" }, originalCulture: "es", questions: [], conditionChoices: {}, roles: [] })),
    http.get("/api/forms/definitions/:id/rules/revisions", () => HttpResponse.json({ items: [], page: 1, pageSize: 10, totalCount: 0, totalPages: 0, hasPrevious: false, hasNext: false })),
    http.put("/api/forms/definitions/:id/draft", ({ request }) => { draftWrites(); return store.handle(request); }));
  const { router } = renderRouteWithProviders("/formularios/" + fixtureFormId);
  await screen.findByLabelText("Nombre");
  await userEvent.click(await screen.findByRole("button", { name: "Agregar regla" }));
  expect(screen.getByLabelText("Nombre")).toHaveAttribute("readonly");
  await act(async () => { await router.navigate("/perfil"); });
  const dialog = await screen.findByRole("dialog");
  await userEvent.click(within(dialog).getByRole("button", { name: "Seguir editando" }));
  expect(router.state.location.pathname).toBe("/formularios/" + fixtureFormId);
  expect(screen.getByRole("button", { name: "Agregar acción" })).toBeInTheDocument();
  expect(draftWrites).not.toHaveBeenCalled();
});

it("saves one monolingual offer instruction without changing content language or publishing", async () => {
  const store = setup();
  const writes: Record<string, unknown>[] = [];
  server.use(http.put("/api/forms/definitions/:id/draft", async ({ request }) => {
    writes.push(await request.clone().json() as Record<string, unknown>); return store.handle(request);
  }));
  renderRouteWithProviders("/formularios/" + fixtureFormId);
  const offer = await screen.findByRole("textbox", { name: "Cuándo lo ofrece el asistente" });
  await pasteText(offer, "Cuando visita a un cliente");
  await userEvent.click(screen.getByRole("button", { name: /^English/ }));
  expect(offer).toHaveValue("Cuando visita a un cliente");
  await userEvent.click(screen.getByRole("button", { name: "Guardar borrador" }));
  await waitFor(() => expect(writes).toHaveLength(1));
  expect(writes[0]).toMatchObject({ offerWhen: "Cuando visita a un cliente", expectedRevision: 1 });
  expect(writes[0].draft).not.toHaveProperty("offerWhen");
  await waitFor(() => expect(screen.getByRole("button", { name: "Guardar borrador" })).toBeEnabled());
  expect(offer).toHaveValue("Cuando visita a un cliente");
  expect(queryClient.getMutationCache().getAll().some(mutation => JSON.stringify(mutation.state.variables).includes("Cuando visita"))).toBe(false);
});

it("preserves the offer instruction through 409 review and saves only with the reread revision", async () => {
  const store = setup("forms-conflict");
  const writes: { expectedRevision: number; offerWhen: string | null }[] = [];
  server.use(http.put("/api/forms/definitions/:id/draft", async ({ request }) => { writes.push(await request.clone().json() as (typeof writes)[number]); return store.handle(request); }));
  renderRouteWithProviders("/formularios/" + fixtureFormId);
  await pasteText(await screen.findByRole("textbox", { name: "Cuándo lo ofrece el asistente" }), "Cuando visita a un cliente");
  await userEvent.click(screen.getByRole("button", { name: "Guardar borrador" }));
  await userEvent.click(await screen.findByRole("button", { name: "Revisar" }));
  const review = await screen.findByRole("dialog", { name: "Revisión del borrador" });
  expect(within(review).getByRole("cell", { name: "Cuando visita a un cliente" })).toBeInTheDocument();
  expect(within(review).getByRole("cell", { name: "No lo ofrece el asistente" })).toBeInTheDocument();
  await userEvent.click(within(review).getByRole("button", { name: "Conservar mis cambios" }));
  expect(writes).toHaveLength(1);
  expect(screen.getByRole("textbox", { name: "Cuándo lo ofrece el asistente" })).toHaveValue("Cuando visita a un cliente");
  await userEvent.click(screen.getByRole("button", { name: "Guardar borrador" }));
  await waitFor(() => expect(store.definitions.get(fixtureFormId)?.revision).toBe(3));
  expect(writes.map(write => write.expectedRevision)).toEqual([1, 2]);
  expect(store.definitions.get(fixtureFormId)?.offerWhen).toBe("Cuando visita a un cliente");
});

it("keeps offer validation at its monolingual field, with focus and without a duplicate toast", async () => {
  setup();
  server.use(http.put("/api/forms/definitions/:id/draft", () => HttpResponse.json({ code: "Validation.Failed", errors: { offerWhen: ["Usá hasta 1000 caracteres."] } }, { status: 400 })));
  renderRouteWithProviders("/formularios/" + fixtureFormId);
  const offer = await screen.findByRole("textbox", { name: "Cuándo lo ofrece el asistente" });
  await pasteText(offer, "Texto que se conserva");
  expect(offer).toHaveAttribute("maxlength", "1000");
  await userEvent.click(screen.getByRole("button", { name: "Guardar borrador" }));
  expect(await screen.findByText("Usá hasta 1000 caracteres.")).toBeInTheDocument();
  await waitFor(() => expect(offer).toHaveFocus());
  expect(offer).toHaveValue("Texto que se conserva");
  expect(offer).toHaveAttribute("aria-invalid", "true");
  expect(vi.mocked(notify)).not.toHaveBeenCalled();
});

it("uses the chosen I1 labels when English is the original and Spanish is untranslated", async () => {
  const store = setup();
  const original = store.definitions.get(fixtureFormId)!;
  store.definitions.set(fixtureFormId, { ...original, name: { ...original.name, es: "" }, draft: { ...original.draft, culture: "en" } });
  renderRouteWithProviders("/formularios/" + fixtureFormId);
  await screen.findByLabelText("Nombre");
  expect(screen.getByRole("button", { name: "English · original" })).toHaveAttribute("aria-pressed", "true");
  expect(screen.getByRole("button", { name: "Español · 1 sin traducir" })).toBeInTheDocument();
  expect(screen.getByText("El original (inglés) es obligatorio; el otro idioma es opcional. Mientras le falte algo, el formulario sale entero en el original.")).toBeInTheDocument();
});

 it("labels the default lifecycle scope as Active and offers the deactivated scope", async () => {
  setup();
  renderRouteWithProviders("/formularios");
  await screen.findByRole("table");
  expect(screen.getByRole("button", { name: "Activos (1)" })).toHaveAttribute("aria-pressed", "true");
  expect(screen.getByRole("button", { name: /^Dados de baja/ })).toBeInTheDocument();
 });
