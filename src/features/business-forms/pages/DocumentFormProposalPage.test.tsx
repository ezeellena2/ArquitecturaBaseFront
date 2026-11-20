import { StrictMode } from "react";
import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { RouterProvider, createMemoryRouter } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AppProviders } from "@/app/providers";
import { routes } from "@/app/routes";
import { queryClient } from "@/shared/api/queryClient";
import { notify } from "@/shared/ui/notifications";
import { currentUser } from "@/test/mocks/handlers";
import { server } from "@/test/mocks/server";
import { renderRouteWithProviders } from "@/test/utils/renderWithProviders";
import { cellUnder } from "@/test/utils/tableCells";
import { receivedDocumentsPageFixture } from "@/test/visual/receivedDocumentFixtures";

vi.mock("react-oidc-context", async () => ({ ...await vi.importActual<typeof import("react-oidc-context")>("react-oidc-context"), useAuth: () => ({ isAuthenticated: true, isLoading: false, user: { access_token: "test" } }) }));
vi.mock("@/shared/ui/notifications", async () => ({ ...await vi.importActual<typeof import("@/shared/ui/notifications")>("@/shared/ui/notifications"), notify: vi.fn() }));

// «Armar formulario con la IA» (DOC6, task 14) with the real route and synthetic bodies on the backend's shape (the cohort
// `forms-documents-http` arrives with the coordinator's export): asked under its request, waited for like a dictation, edited, created
// as a draft, and its failures and permissions.
const id = (n: number) => `0199b0c0-0000-7000-8000-${String(n).padStart(12, "0")}`;
const designer = ["formdocuments.read", "formdocuments.review", "formtemplates.read", "formtemplates.manage", "formcatalogs.read"];
const requestId = id(901), proposalId = id(961), definitionId = id(971), topicId = id(951);
const unclassified = receivedDocumentsPageFixture().items.filter(item => item.state === "unclassified");
const content = {
  culture: "es", name: "Tickets de combustible", prefix: "TCB", submitLabel: "Cargar ticket",
  questions: [
    { label: "Estación", type: "shortText", required: true, options: [], catalog: null, sample: "Estación Ruta 9" },
    { label: "Combustible", type: "choice", required: true, options: ["Nafta súper", "Gasoil"], catalog: null, sample: "Nafta súper" },
    { label: "Importe", type: "number", required: false, options: [], catalog: null, sample: "52360" },
  ],
  documentReading: { recognition: "Un ticket de carga de combustible." }, standard: null as { key: string; name: string } | null,
};
const pending = { requestId, state: "pending", failureCode: null, topic: null as { id: string; name: string } | null, documents: [unclassified[0]], proposal: null, definitionId: null as string | null };
const completed = (changes: Record<string, unknown> = {}) => ({ ...pending, state: "completed", proposal: { id: proposalId, capability: "forms.authoring.propose-form", version: 2, content }, ...changes });
const path = `/formularios/documentos/armar/${requestId}`;

function setup({ permissions = designer, ask, read, create, library }: { permissions?: string[]; ask?: () => Response; read?: (count: number) => Response; create?: () => Response | Promise<Response>;
  library?: unknown } = {}) {
  const requests = { asks: [] as unknown[], reads: 0, creates: [] as unknown[] };
  server.use(
    http.get("/api/me", () => HttpResponse.json({ ...currentUser, permissions })),
    http.get("/api/forms/documents/counts", () => HttpResponse.json({ forReview: 0, unclassified: 3, total: 3 })),
    http.post("/api/forms/documents/form-proposals", async ({ request }) => { requests.asks.push(await request.json()); return ask ? ask() : HttpResponse.json(pending, { status: 202 }); }),
    http.get("/api/forms/documents/form-proposals/:requestId", () => { requests.reads++; return read ? read(requests.reads) : HttpResponse.json(completed()); }),
    http.get("/api/forms/documents/:id/file", () => new HttpResponse("jpeg", { headers: { "content-type": "image/jpeg" } })),
    http.post("/api/forms/definitions/document-proposals", async ({ request }) => {
      requests.creates.push(await request.json());
      return create ? create() : HttpResponse.json({ proposalId, definitionId }, { status: 201 });
    }),
    http.get("/api/forms/library", () => HttpResponse.json(library ?? { standards: [] })),
    // What the editor and the menus read after leaving is not this page's.
    http.get("/api/forms/*", () => HttpResponse.json({ status: 404, title: "Not found" }, { status: 404 })),
  );
  return requests;
}

beforeEach(() => {
  queryClient.clear();
  vi.mocked(notify).mockClear();
  URL.createObjectURL = vi.fn(() => "blob:document");
  URL.revokeObjectURL = vi.fn();
});

const notices = (kind: string) => vi.mocked(notify).mock.calls.filter(([options]) => options.kind === kind).map(([options]) => options.message);
const heading = () => screen.findByRole("heading", { level: 1, name: "Armar formulario con la IA" }, { timeout: 10_000 });
const questionsTable = () => within(screen.getByRole("region", { name: "Preguntas (3)" })).getByRole("table");
// The cell under a header of the row that has a text (one datum per column).
const cell = (table: HTMLElement, text: string, header: string) =>
  cellUnder(table, within(table).getAllByRole("row").find(row => within(row).queryByText(text, { exact: true }))!, header);
// The Picker opens with the keyboard, like the other Radix lists in the tests; its button says the label and the chosen one.
async function openList(user: ReturnType<typeof userEvent.setup>, trigger: HTMLElement) {
  await act(async () => { trigger.focus(); });
  await user.keyboard("{Enter}");
  return screen.findByRole("listbox");
}
async function pick(user: ReturnType<typeof userEvent.setup>, trigger: HTMLElement, option: string) {
  await user.click(within(await openList(user, trigger)).getByRole("option", { name: option }));
}

// The whole app in a route, like `renderRouteWithProviders`, inside StrictMode, whose double mount must not ask twice.
function renderStrictRoute(initial: string) {
  const router = createMemoryRouter(routes, { initialEntries: [initial] });
  render(<StrictMode><AppProviders><RouterProvider router={router} /></AppProviders></StrictMode>);
  return { router };
}

describe("asking and waiting", () => {
  it("asks for a form from a document once under its request, also through StrictMode's double mount, waits like a dictation and shows the proposal with what it read", async () => {
    const requests = setup({ read: count => HttpResponse.json(count < 2 ? pending : completed()) });
    const { router } = renderStrictRoute(`${path}?documento=${unclassified[0]!.id}`);
    await heading();
    expect(await screen.findByText("La IA está leyendo el documento y armando la propuesta…", {}, { timeout: 10_000 })).toBeInTheDocument();
    expect(requests.asks).toEqual([{ requestId, documentId: unclassified[0]!.id }]);
    // Once the server keeps the request, the address names only it.
    await waitFor(() => expect(router.state.location.search).toBe(""));
    expect(router.state.location.pathname).toBe(path);
    expect(screen.getByRole("button", { name: "Crear borrador" })).toHaveAttribute("aria-disabled", "true");
    // The documents are there while it builds.
    expect(within(screen.getByRole("region", { name: "Documentos (1)" })).getByRole("button", { name: unclassified[0]!.file.name })).toBeInTheDocument();
    expect(await screen.findByRole("textbox", { name: /^Nombre/ }, { timeout: 10_000 })).toHaveValue("Tickets de combustible");
    expect(screen.getByRole("textbox", { name: /^Prefijo de numeración/ })).toHaveValue("TCB");
    expect(screen.getByRole("textbox", { name: /^Texto del botón final/ })).toHaveValue("Cargar ticket");
    expect(screen.getByRole("textbox", { name: /^Cómo reconocerlo/ })).toHaveValue("Un ticket de carga de combustible.");
    const table = questionsTable();
    expect(within(table).getAllByRole("row")).toHaveLength(4);
    expect(cell(table, "Combustible", "Tipo")).toHaveTextContent("Elegir de una listaNafta súper, Gasoil");
    expect(cell(table, "Estación", "Leído en el primero")).toHaveTextContent("Estación Ruta 9");
    expect(cell(table, "Importe", "Obligatoria")).toHaveTextContent("No");
    expect(screen.getByRole("button", { name: "Crear borrador" })).not.toHaveAttribute("aria-disabled");
    expect(requests.asks).toHaveLength(1);
  }, 20_000);

  it("says why a proposal failed and asks again under a new request for the same group", async () => {
    const requests = setup({ read: () => HttpResponse.json({ ...pending, state: "failed", failureCode: "Ai.Assistant.ProviderUnavailable", topic: { id: topicId, name: "tickets de combustible" } }) });
    const user = userEvent.setup();
    const { router } = renderRouteWithProviders(path);
    expect(await screen.findByText("No se pudo armar la propuesta.", {}, { timeout: 10_000 })).toBeInTheDocument();
    // Nothing to create from a request that failed; its documents stay in their place.
    expect(screen.queryByRole("button", { name: "Crear borrador" })).not.toBeInTheDocument();
    expect(within(screen.getByRole("region", { name: "Documentos (1)" })).getByRole("button", { name: unclassified[0]!.file.name })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Volver a pedir" }));
    await waitFor(() => expect(router.state.location.pathname).not.toBe(path));
    expect(router.state.location.pathname).toMatch(/^\/formularios\/documentos\/armar\/[0-9a-f-]{36}$/);
    await waitFor(() => expect(requests.asks).toHaveLength(1));
    expect(requests.asks[0]).toMatchObject({ topicId });
    expect((requests.asks[0] as { requestId: string }).requestId).not.toBe(requestId);
  }, 20_000);

  it("names the reason of a proposal the assistant did not make", async () => {
    setup({ read: () => HttpResponse.json({ ...pending, state: "failed", failureCode: "Forms.ReceivedDocument.NoFormProposal" }) });
    renderRouteWithProviders(path);
    expect(await screen.findByText("La IA no propuso ningún formulario.", {}, { timeout: 10_000 })).toBeInTheDocument();
  }, 20_000);

  // The assistant reads the first document and up to four more (FormDocumentAuthoringPolicy.MaxReadings), not the 20 of a group.
  it("does not say it reads more documents than the assistant reads", async () => {
    const documents = Array.from({ length: 20 }, (_, index) => ({ ...unclassified[0]!, id: id(500 + index) }));
    setup({ read: () => HttpResponse.json({ ...pending, documents }) });
    renderRouteWithProviders(path);
    expect(await screen.findByText("La IA está leyendo 5 de los 20 documentos y armando la propuesta…", {}, { timeout: 10_000 })).toBeInTheDocument();
  }, 20_000);

  it("stops reading a request whose reading fails while the assistant builds it, until «Reintentar»", async () => {
    const requests = setup({ read: count => count === 2 ? HttpResponse.json({ status: 500, title: "Error" }, { status: 500 }) : HttpResponse.json(count < 2 ? pending : completed()) });
    const user = userEvent.setup();
    renderRouteWithProviders(path);
    expect(await screen.findByText("No pudimos saber cómo sigue la propuesta.", {}, { timeout: 10_000 })).toBeInTheDocument();
    expect(screen.queryByText("La IA está leyendo el documento y armando la propuesta…")).not.toBeInTheDocument();
    // Nothing reads it again until «Reintentar» (it read every two seconds).
    await new Promise(resolve => setTimeout(resolve, 2_500));
    expect(requests.reads).toBe(2);
    await user.click(screen.getByRole("button", { name: "Reintentar" }));
    expect(await screen.findByRole("textbox", { name: /^Nombre/ }, { timeout: 10_000 })).toHaveValue("Tickets de combustible");
    expect(requests.reads).toBe(3);
    expect(screen.queryByText("No pudimos saber cómo sigue la propuesta.")).not.toBeInTheDocument();
  }, 20_000);
});

describe("creating the draft", () => {
  it("creates the draft with what was edited and opens its editor", async () => {
    const requests = setup();
    const user = userEvent.setup();
    const { router } = renderRouteWithProviders(path);
    const name = await screen.findByRole("textbox", { name: /^Nombre/ }, { timeout: 10_000 });
    await user.clear(name);
    await user.type(name, "Tickets de nafta");
    await user.click(within(cell(questionsTable(), "Importe", "Acciones")).getByRole("button", { name: "Quitar Importe" }));
    await user.click(screen.getByRole("button", { name: "Crear borrador" }));
    await waitFor(() => expect(router.state.location.pathname).toBe(`/formularios/${definitionId}`));
    expect(requests.creates).toEqual([{
      requestId, proposalId, name: "Tickets de nafta", prefix: "TCB", submitLabel: "Cargar ticket", recognition: "Un ticket de carga de combustible.",
      questions: [
        { label: "Estación", type: "shortText", required: true, options: [], catalogId: null },
        { label: "Combustible", type: "choice", required: true, options: ["Nafta súper", "Gasoil"], catalogId: null },
      ],
    }]);
    expect(notices("success")).toEqual(["Se creó el borrador «Tickets de nafta»."]);
  }, 20_000);

  it("says what is missing next to its field, and the server's problems where they belong", async () => {
    const requests = setup({ create: () => HttpResponse.json({ status: 400, title: "Validation", code: "Validation", errors: {
      name: ["Ya hay un formulario con ese nombre."], "questions[1].options": ["Revisá las opciones."] } }, { status: 400 }) });
    const user = userEvent.setup();
    renderRouteWithProviders(path);
    const recognition = await screen.findByRole("textbox", { name: /^Cómo reconocerlo/ }, { timeout: 10_000 });
    await user.clear(recognition);
    await user.click(screen.getByRole("button", { name: "Crear borrador" }));
    expect(await screen.findByText("Escribí cómo reconocerlo.")).toBeInTheDocument();
    await waitFor(() => expect(recognition).toHaveFocus());
    expect(requests.creates).toHaveLength(0);
    await user.type(recognition, "Un ticket.");
    await user.click(screen.getByRole("button", { name: "Crear borrador" }));
    expect(await screen.findByText("Ya hay un formulario con ese nombre.")).toBeInTheDocument();
    expect(within(cell(questionsTable(), "Combustible", "Pregunta")).getByRole("alert")).toHaveTextContent("Revisá las opciones.");
    await waitFor(() => expect(screen.getByRole("textbox", { name: /^Nombre/ })).toHaveFocus());
    expect(requests.creates).toHaveLength(1);
    // Changing the name takes its problem away.
    await user.type(screen.getByRole("textbox", { name: /^Nombre/ }), " 2");
    expect(screen.queryByText("Ya hay un formulario con ese nombre.")).not.toBeInTheDocument();
  }, 20_000);

  // A stale proposal (the request pending, failed or closed on another one) answers like an unknown request.
  it("says the server's text when the proposal is no longer there, and reads the request again", async () => {
    let stale = false;
    const requests = setup({ read: () => HttpResponse.json(stale ? { ...pending, state: "failed", failureCode: "Forms.ReceivedDocument.NoFormProposal" } : completed()),
      create: () => { stale = true; return HttpResponse.json({ status: 404, title: "Not found", code: "Forms.ReceivedDocument.ProposalNotFound", detail: "No encontramos esa propuesta." }, { status: 404 }); } });
    const user = userEvent.setup();
    const { router } = renderRouteWithProviders(path);
    await screen.findByRole("textbox", { name: /^Nombre/ }, { timeout: 10_000 });
    const reads = requests.reads;
    await user.click(screen.getByRole("button", { name: "Crear borrador" }));
    await waitFor(() => expect(notices("warning")).toEqual(["No encontramos esa propuesta."]));
    await waitFor(() => expect(requests.reads).toBeGreaterThan(reads));
    // The request read again says how it is now.
    expect(await screen.findByText("La IA no propuso ningún formulario.")).toBeInTheDocument();
    expect(router.state.location.pathname).toBe(path);
  }, 20_000);

  it("says the server's text and when to try again when «Crear borrador» has to wait", async () => {
    setup({ create: () => HttpResponse.json({ status: 429, title: "Too many requests", detail: "Hiciste demasiados pedidos seguidos.", retryAfter: 30 }, { status: 429 }) });
    const user = userEvent.setup();
    renderRouteWithProviders(path);
    await screen.findByRole("textbox", { name: /^Nombre/ }, { timeout: 10_000 });
    await user.click(screen.getByRole("button", { name: "Crear borrador" }));
    await waitFor(() => expect(vi.mocked(notify)).toHaveBeenCalledWith(expect.objectContaining({ kind: "error", message: "Hiciste demasiados pedidos seguidos.",
      description: "Esperá 30 segundos para volver a intentar." })));
    // Off, with its reason, while it waits.
    await waitFor(() => expect(screen.getByRole("button", { name: "Crear borrador" })).toHaveAttribute("aria-disabled", "true"));
  }, 20_000);

  it("opens the draft already created from the header and reads the proposal only", async () => {
    setup({ read: () => HttpResponse.json(completed({ definitionId })) });
    renderRouteWithProviders(path);
    expect(await screen.findByText("Ya se creó el borrador con esta propuesta.", {}, { timeout: 10_000 })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Abrir el borrador" })).toHaveAttribute("href", `/formularios/${definitionId}`);
    expect(screen.getByRole("textbox", { name: /^Nombre/ })).toHaveAttribute("readonly");
    expect(screen.queryByRole("button", { name: "Agregar pregunta" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Crear borrador" })).not.toBeInTheDocument();
  }, 20_000);

  // The engine no longer has the request (it answers failed), but its draft was created: the page opens it and does not ask again.
  it("opens the draft already created when the engine no longer has the request", async () => {
    setup({ read: () => HttpResponse.json({ ...pending, state: "failed", failureCode: "Forms.ReceivedDocument.ProposalNotFound", definitionId }) });
    renderRouteWithProviders(path);
    expect(await screen.findByText("Ya se creó el borrador con esta propuesta.", {}, { timeout: 10_000 })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Abrir el borrador" })).toHaveAttribute("href", `/formularios/${definitionId}`);
    expect(screen.queryByText("Esta propuesta ya no está disponible.")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Volver a pedir" })).not.toBeInTheDocument();
  }, 20_000);

  // Without a clear answer (the network or a 5xx) the draft may exist: the request read again says so, and nothing else is sent.
  it("reads the request again when «Crear borrador» gets no clear answer, and opens the draft it did create", async () => {
    let created = false;
    const requests = setup({ read: () => HttpResponse.json(completed(created ? { definitionId } : {})), create: () => { created = true; return HttpResponse.error(); } });
    const user = userEvent.setup();
    const { router } = renderRouteWithProviders(path);
    await user.type(await screen.findByRole("textbox", { name: /^Nombre/ }, { timeout: 10_000 }), " 2");
    const reads = requests.reads;
    await user.click(screen.getByRole("button", { name: "Crear borrador" }));
    await waitFor(() => expect(requests.reads).toBeGreaterThan(reads));
    expect(await screen.findByRole("link", { name: "Abrir el borrador" })).toHaveAttribute("href", `/formularios/${definitionId}`);
    expect(screen.getByText("Ya se creó el borrador con esta propuesta.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Crear borrador" })).not.toBeInTheDocument();
    expect(requests.creates).toHaveLength(1);
    expect(notices("success")).toEqual([]);
    expect(router.state.location.pathname).toBe(path);
  }, 20_000);

  it("stays where the person went when the draft is created after leaving", async () => {
    let release!: () => void;
    const gate = new Promise<void>(resolve => { release = resolve; });
    const requests = setup({ create: async () => { await gate; return HttpResponse.json({ proposalId, definitionId }, { status: 201 }); } });
    const user = userEvent.setup();
    const { router } = renderRouteWithProviders(path);
    await screen.findByRole("textbox", { name: /^Nombre/ }, { timeout: 10_000 });
    await user.click(screen.getByRole("button", { name: "Crear borrador" }));
    await waitFor(() => expect(requests.creates).toHaveLength(1));
    await user.click(screen.getByRole("button", { name: "Cancelar" }));
    await waitFor(() => expect(router.state.location.pathname).toBe("/formularios/documentos"));
    // The page is gone (the router moves before React draws the other page), and then the draft is created.
    await waitFor(() => expect(screen.queryByRole("heading", { level: 1, name: "Armar formulario con la IA" })).not.toBeInTheDocument());
    release();
    await waitFor(() => expect(notices("success")).toEqual(["Se creó el borrador «Tickets de combustible»."]));
    await new Promise(resolve => setTimeout(resolve, 100));
    expect(router.state.location.pathname).toBe("/formularios/documentos");
  }, 20_000);

  it("asks before leaving with changes", async () => {
    setup();
    const user = userEvent.setup();
    const { router } = renderRouteWithProviders(path);
    await user.type(await screen.findByRole("textbox", { name: /^Nombre/ }, { timeout: 10_000 }), " 2");
    await user.click(screen.getByRole("button", { name: "Cancelar" }));
    const dialog = await screen.findByRole("dialog", { name: "¿Descartar los cambios?" });
    await user.click(within(dialog).getByRole("button", { name: "Seguir editando" }));
    expect(router.state.location.pathname).toBe(path);
    await user.click(screen.getByRole("button", { name: "Cancelar" }));
    await user.click(within(await screen.findByRole("dialog", { name: "¿Descartar los cambios?" })).getByRole("button", { name: "Descartar cambios" }));
    await waitFor(() => expect(router.state.location.pathname).toBe("/formularios/documentos"));
  }, 20_000);
});

describe("the questions", () => {
  it("edits a question in its dialog, adds one with its options and removes one", async () => {
    setup();
    const user = userEvent.setup();
    renderRouteWithProviders(path);
    await screen.findByRole("textbox", { name: /^Nombre/ }, { timeout: 10_000 });
    await user.click(within(cell(questionsTable(), "Combustible", "Acciones")).getByRole("button", { name: "Editar Combustible" }));
    let dialog = await screen.findByRole("dialog", { name: "Editar «Combustible»" });
    expect(within(dialog).getByText("Nafta súper", { selector: "dd" })).toBeInTheDocument();
    const label = within(dialog).getByRole("textbox", { name: /^Pregunta/ });
    await user.clear(label);
    await user.type(label, "Tipo de combustible");
    await user.click(within(dialog).getByRole("button", { name: "Listo" }));
    expect(cell(questionsTable(), "Tipo de combustible", "Tipo")).toHaveTextContent("Elegir de una lista");

    await user.click(screen.getByRole("button", { name: "Agregar pregunta" }));
    dialog = await screen.findByRole("dialog", { name: "Nueva pregunta" });
    await user.type(within(dialog).getByRole("textbox", { name: /^Pregunta/ }), "Medio de pago");
    await pick(user, within(dialog).getByRole("button", { name: "Tipo de respuesta Texto corto" }), "Elegir de una lista");
    await user.click(within(dialog).getByRole("button", { name: "Listo" }));
    expect(await within(dialog).findByText("Agregá al menos una opción.")).toBeInTheDocument();
    await user.click(within(dialog).getByRole("button", { name: "Agregar opción" }));
    await user.type(within(dialog).getByRole("textbox", { name: "Opción 1" }), "Efectivo");
    await user.click(within(dialog).getByRole("button", { name: "Listo" }));
    const table = within(screen.getByRole("region", { name: "Preguntas (4)" })).getByRole("table");
    expect(cell(table, "Medio de pago", "Tipo")).toHaveTextContent("Elegir de una listaEfectivo");
    expect(cell(table, "Medio de pago", "Leído en el primero")).toHaveTextContent("—");

    await user.click(within(cell(table, "Estación", "Acciones")).getByRole("button", { name: "Quitar Estación" }));
    expect(within(screen.getByRole("region", { name: "Preguntas (3)" })).queryByText("Estación")).not.toBeInTheDocument();
  }, 20_000);

  // What the server takes (SaveFormDraftRequestValidator, FormAuthoringProposalPolicy): 160 characters for the final button, a question
  // and an option, and up to 40 questions.
  it("keeps each text within what the server takes and adds questions up to 40", async () => {
    const questions = Array.from({ length: 40 }, (_, index) => ({ label: `Dato ${index + 1}`, type: "shortText", required: false, options: [], catalog: null, sample: null }));
    setup({ read: () => HttpResponse.json(completed({ proposal: { id: proposalId, capability: "forms.authoring.propose-form", version: 2, content: { ...content, questions } } })) });
    const user = userEvent.setup();
    renderRouteWithProviders(path);
    expect(await screen.findByRole("textbox", { name: /^Texto del botón final/ }, { timeout: 10_000 })).toHaveAttribute("maxlength", "160");
    const add = screen.getByRole("button", { name: "Agregar pregunta" });
    expect(add).toHaveAttribute("aria-disabled", "true");
    expect(add).toHaveAccessibleDescription("Podés agregar hasta 40 preguntas. Quitá una para agregar otra.");
    const table = within(screen.getByRole("region", { name: "Preguntas (40)" })).getByRole("table");
    await user.click(within(cell(table, "Dato 40", "Acciones")).getByRole("button", { name: "Quitar Dato 40" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Agregar pregunta" })).not.toHaveAttribute("aria-disabled"));
    await user.click(screen.getByRole("button", { name: "Agregar pregunta" }));
    const dialog = await screen.findByRole("dialog", { name: "Nueva pregunta" });
    expect(within(dialog).getByRole("textbox", { name: /^Pregunta/ })).toHaveAttribute("maxlength", "160");
    await pick(user, within(dialog).getByRole("button", { name: /^Tipo de respuesta / }), "Elegir de una lista");
    await user.click(within(dialog).getByRole("button", { name: "Agregar opción" }));
    expect(within(dialog).getByRole("textbox", { name: "Opción 1" })).toHaveAttribute("maxlength", "160");
  }, 20_000);

  it("leaves the catalog type off with its reason without permission to read catalogs", async () => {
    setup({ permissions: designer.filter(permission => permission !== "formcatalogs.read") });
    const user = userEvent.setup();
    renderRouteWithProviders(path);
    await screen.findByRole("textbox", { name: /^Nombre/ }, { timeout: 10_000 });
    await user.click(screen.getByRole("button", { name: "Agregar pregunta" }));
    const dialog = await screen.findByRole("dialog", { name: "Nueva pregunta" });
    const list = await openList(user, within(dialog).getByRole("button", { name: /^Tipo de respuesta / }));
    const catalog = within(list).getByRole("option", { name: "Elegir de un catálogo" });
    expect(catalog).toHaveAttribute("aria-disabled", "true");
    expect(catalog).toHaveAccessibleDescription("Necesitás permiso para leer catálogos y elegir uno.");
    expect(within(list).getByRole("option", { name: "Elegir de una lista" })).not.toHaveAttribute("aria-disabled");
  }, 20_000);
});

describe("a similar standard", () => {
  it("offers to add the standard with the library's «Agregar» or to build it anyway", async () => {
    const standard = { key: "transfer-receipt", version: 1, name: "Comprobante de transferencia", description: "Un comprobante de una transferencia.", prefix: "REC",
      copies: 0, culture: "es", suggestedPrefix: "REC" };
    content.standard = { key: "transfer-receipt", name: "Comprobante de transferencia" };
    try {
      setup({ library: { standards: [standard] } });
      const user = userEvent.setup();
      renderRouteWithProviders(path);
      expect(await screen.findByText(/^Se parece a «Comprobante de transferencia», de la biblioteca/, {}, { timeout: 10_000 })).toBeInTheDocument();
      // Off with its reason while the library is read; once it is there, the button is another element (without its wrapper).
      await waitFor(() => expect(screen.getByRole("button", { name: "Agregar el estándar" })).not.toHaveAttribute("aria-disabled"));
      await user.click(screen.getByRole("button", { name: "Agregar el estándar" }));
      const dialog = await screen.findByRole("dialog", { name: "Agregar «Comprobante de transferencia»" });
      await user.click(within(dialog).getByRole("button", { name: "Cancelar" }));
      await user.click(screen.getByRole("button", { name: "Armar igual con la IA" }));
      expect(screen.queryByText(/^Se parece a «Comprobante de transferencia»/)).not.toBeInTheDocument();
      // The button left with its notice: the focus goes to the form, not to the page.
      await waitFor(() => expect(screen.getByRole("textbox", { name: /^Nombre/ })).toHaveFocus());
    } finally {
      content.standard = null;
    }
  }, 20_000);
});

describe("what cannot be built and the permissions", () => {
  it("says a request that is no longer there, and the way back", async () => {
    setup({ read: () => HttpResponse.json({ status: 404, title: "Not found", code: "Forms.ReceivedDocument.ProposalNotFound" }, { status: 404 }) });
    renderRouteWithProviders(path);
    expect(await screen.findByText("Esta propuesta ya no está disponible.", {}, { timeout: 10_000 })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Volver a Documentos recibidos" })).toHaveAttribute("href", "/formularios/documentos");
  }, 20_000);

  it("says the server's text when the document cannot be built from", async () => {
    setup({ ask: () => HttpResponse.json({ status: 409, title: "Conflict", code: "Forms.ReceivedDocument.StateConflict", detail: "El documento ya no está sin clasificar." }, { status: 409 }) });
    renderRouteWithProviders(`${path}?documento=${unclassified[0]!.id}`);
    expect(await screen.findByText("El documento ya no está sin clasificar.", {}, { timeout: 10_000 })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Volver a Documentos recibidos" })).toBeInTheDocument();
  }, 20_000);

  it("says the server's text when the AI's quota or capacity stops the request, and waits what it asked before «Reintentar»", async () => {
    setup({ ask: () => HttpResponse.json({ status: 429, title: "Too many requests", code: "Ai.Assistant.CapacityLimited", detail: "La IA está ocupada. Probá en unos minutos.",
      retryAfter: 90 }, { status: 429 }) });
    renderRouteWithProviders(`${path}?documento=${unclassified[0]!.id}`);
    expect(await screen.findByText("La IA está ocupada. Probá en unos minutos.", {}, { timeout: 10_000 })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Reintentar" })).toHaveAttribute("aria-disabled", "true");
    expect(screen.queryByRole("button", { name: "Crear borrador" })).not.toBeInTheDocument();
  }, 20_000);

  it("retries the same request after a network failure", async () => {
    let failing = true;
    const requests = setup({ ask: () => failing ? HttpResponse.error() : HttpResponse.json(completed(), { status: 202 }) });
    const user = userEvent.setup();
    renderRouteWithProviders(`${path}?documento=${unclassified[0]!.id}`);
    expect(await screen.findByText("No pudimos pedir la propuesta.", {}, { timeout: 10_000 })).toBeInTheDocument();
    failing = false;
    await user.click(screen.getByRole("button", { name: "Reintentar" }));
    expect(await screen.findByRole("textbox", { name: /^Nombre/ }, { timeout: 10_000 })).toHaveValue("Tickets de combustible");
    expect(requests.asks).toEqual([{ requestId, documentId: unclassified[0]!.id }, { requestId, documentId: unclassified[0]!.id }]);
  }, 20_000);

  it("takes the page away on a 403", async () => {
    setup({ read: () => HttpResponse.json({ status: 403 }, { status: 403 }) });
    renderRouteWithProviders(path);
    expect(await screen.findByRole("heading", { name: "No tenés permiso" }, { timeout: 10_000 })).toBeInTheDocument();
  }, 20_000);

  it("takes the page away without «Diseñar formularios», without reading the request", async () => {
    const requests = setup({ permissions: designer.filter(permission => permission !== "formtemplates.manage") });
    renderRouteWithProviders(path);
    expect(await screen.findByRole("heading", { name: "No tenés permiso" }, { timeout: 10_000 })).toBeInTheDocument();
    expect(requests.reads).toBe(0);
  }, 20_000);
});
