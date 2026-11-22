import { act, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { delay, http, HttpResponse } from "msw";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { queryClient } from "@/shared/api/queryClient";
import { notify } from "@/shared/ui/notifications";
import { currentUser } from "@/test/mocks/handlers";
import { server } from "@/test/mocks/server";
import { renderRouteWithProviders } from "@/test/utils/renderWithProviders";
import { cellUnder } from "@/test/utils/tableCells";
import { receivedDocumentDetailFixture, receivedDocumentFields, receivedDocumentForms, receivedDocumentIds, receivedDocumentOptions, receivedDocumentsPageFixture } from "@/test/visual/receivedDocumentFixtures";
import type { ReceivedDocumentDetail, ReceivedDocumentsPage } from "../api/receivedDocuments";

vi.mock("react-oidc-context", async () => ({ ...await vi.importActual<typeof import("react-oidc-context")>("react-oidc-context"), useAuth: () => ({ isAuthenticated: true, isLoading: false, user: { access_token: "test" } }) }));
vi.mock("@/shared/ui/notifications", async () => ({ ...await vi.importActual<typeof import("@/shared/ui/notifications")>("@/shared/ui/notifications"), notify: vi.fn() }));

// «Documentos recibidos» (DOC5-A, task 10) with the real routes and synthetic bodies on the backend's shape of task 7 and «7b»: the list
// with one datum per column and its private filters in memory, the panel in the route with the viewer, the form, the data and the
// history, and what «Revisar documentos» does. The cohort `forms-documents-http` arrives with the coordinator's export.
const reviewer = ["formdocuments.read", "formdocuments.review", "formrecords.read"];
const requestId = "0199b0c0-0000-7000-8000-000000000901";
type Body = Record<string, unknown> & { page: number; pageSize: number };
// The state is the button of the bar of the only piece to choose (2026-11-22): «Estado» and the chosen one, and its list without
// counts. With the keyboard, for the known mismatch of userEvent with the `pointerdown` of Radix.
async function openStates(current = "Todos") {
  const trigger = await screen.findByRole("button", { name: `Estado ${current}` }, { timeout: 10_000 });
  await act(async () => { trigger.focus(); });
  await userEvent.keyboard("{Enter}");
  return screen.findByRole("listbox", { name: "Estado" });
}
async function chooseState(option: string, current?: string) {
  await userEvent.click(within(await openStates(current)).getByRole("option", { name: option }));
}

function setup({ permissions = reviewer, details = {}, list, counts }: { permissions?: string[]; details?: Record<string, ReceivedDocumentDetail>;
  list?: (body: Body) => Response; counts?: unknown } = {}) {
  const requests = { list: [] as Body[], writes: [] as { path: string; body: unknown }[], details: [] as string[], extraction: 0, files: 0 };
  const current: Record<string, ReceivedDocumentDetail> = { ...details };
  const detail = (id: string) => current[id] ?? receivedDocumentDetailFixture(id, "es", permissions.includes("formdocuments.review"));
  const write = (respond: (id: string, body: unknown) => Response | Promise<Response>) => async ({ request, params }: { request: Request; params: Record<string, string | readonly string[] | undefined> }) => {
    const body = await request.json(); requests.writes.push({ path: new URL(request.url).pathname, body }); return respond(String(params.id), body);
  };
  server.use(
    http.get("/api/me", () => HttpResponse.json({ ...currentUser, permissions })),
    http.get("/api/forms/documents/counts", () => HttpResponse.json(counts ?? { forReview: 2, unclassified: 5, total: 7 })),
    http.post("/api/forms/documents/search", async ({ request }) => {
      const body = await request.json() as Body; requests.list.push(body);
      if (list) return list(body);
      return HttpResponse.json({ ...receivedDocumentsPageFixture(), page: body.page, pageSize: body.pageSize });
    }),
    http.get("/api/forms/documents/:id", ({ params }) => { requests.details.push(String(params.id)); return HttpResponse.json(detail(String(params.id))); }),
    http.get("/api/forms/documents/:id/file", () => { requests.files++; return new HttpResponse("jpeg", { headers: { "content-type": "image/jpeg" } }); }),
  );
  return { requests, current, write };
}

beforeEach(() => {
  queryClient.clear();
  vi.mocked(notify).mockClear();
  URL.createObjectURL = vi.fn(() => "blob:document");
  URL.revokeObjectURL = vi.fn();
});

const lastList = (requests: { list: Body[] }) => requests.list.at(-1)!;
// «Armar formulario con la IA» (DOC6): whoever also designs forms, and the request its page asks for (it waits, empty).
const builder = [...reviewer, "formtemplates.read", "formtemplates.manage"];
const topicId = "0199b0c0-0000-7000-8000-000000000951";
function proposalHandlers(topic: { id: string; name: string } | null) {
  const asks: unknown[] = [];
  const pending = (requestId: unknown) => ({ requestId, state: "pending", failureCode: null, topic, documents: [], proposal: null, definitionId: null });
  server.use(
    http.post("/api/forms/documents/form-proposals", async ({ request }) => {
      const body = await request.json() as { requestId: string };
      asks.push(body);
      return HttpResponse.json(pending(body.requestId), { status: 202 });
    }),
    http.get("/api/forms/documents/form-proposals/:requestId", ({ params }) => HttpResponse.json(pending(params.requestId))),
  );
  return asks;
}
const panel = () => screen.findByRole("region", { name: "Documento" }, { timeout: 10_000 });
const pause = (milliseconds: number) => new Promise(resolve => setTimeout(resolve, milliseconds));
const notices = (kind: string) => vi.mocked(notify).mock.calls.filter(([options]) => options.kind === kind).map(([options]) => options.message);
// A change of form that runs, asked by Marta Ruiz unless said otherwise.
function running(base: ReceivedDocumentDetail, request = requestId, form = { definitionId: receivedDocumentForms.expenses, name: "Gastos" }): ReceivedDocumentDetail {
  return { ...base, document: { ...base.document, revision: 2 }, extraction: { requestId: request, definitionId: form.definitionId, requestedAtUtc: "2026-11-12T12:00:00Z" },
    history: [...base.history, { atUtc: "2026-11-12T12:00:00Z", kind: "extractionRequested", actor: { userId: "0199b0c0-0000-7000-8000-000000000999", displayName: "Marta Ruiz" }, detail: form.name }] };
}

/** A filter or a searched catalog choice is the only piece to choose (DS1-A): its list opens with the keyboard, like the other Radix
 * lists in the tests. */
async function openPicker(user: ReturnType<typeof userEvent.setup>, trigger: HTMLElement) {
  await act(async () => { trigger.focus(); });
  await user.keyboard("{Enter}");
  return screen.findByRole("listbox");
}
async function pickOption(user: ReturnType<typeof userEvent.setup>, trigger: HTMLElement, option: string | RegExp) {
  await user.click(within(await openPicker(user, trigger)).getByRole("option", { name: option }));
}

describe("the list", () => {
  it("shows one document per row with each datum read in its column, the states without counts and its menu entry with its number", async () => {
    setup();
    const { router } = renderRouteWithProviders("/formularios/documentos");
    const table = await screen.findByRole("table", {}, { timeout: 10_000 });
    expect(within(table).getAllByRole("columnheader").map(header => header.textContent))
      .toEqual(["Documento", "Recibido", "Mandó", "Formulario", "Monto", "Banco o billetera de origen", "CUIT o CUIL de origen", "Estado", "Se borra", "Respuesta"]);
    const rows = within(table).getAllByRole("row").slice(1);
    expect(cellUnder(table, rows[4]!, "Mandó")).toHaveTextContent(/^Pablo Sosa$/);
    expect(cellUnder(table, rows[4]!, "Monto")).toHaveTextContent(/^68\.500$/);
    expect(cellUnder(table, rows[4]!, "CUIT o CUIL de origen")).toHaveTextContent(/^20-23456789-7$/);
    expect(cellUnder(table, rows[0]!, "CUIT o CUIL de origen")).toHaveTextContent(/^—$/);
    expect(cellUnder(table, rows[4]!, "Estado")).toHaveTextContent(/^Para revisar$/);
    expect(cellUnder(table, rows[5]!, "Estado")).toHaveTextContent(/^Propuesto$/);
    expect(cellUnder(table, rows[2]!, "Se borra")).toHaveTextContent(/^20\/01\/2027$/);
    expect(cellUnder(table, rows[2]!, "Formulario")).toHaveTextContent(/^—$/);
    expect(within(cellUnder(table, rows[1]!, "Respuesta")).getByRole("link", { name: "REC-000124" })).toHaveAttribute("href", `/formularios/${receivedDocumentForms.payments}/respuestas/0199b0c0-0000-7000-8000-000000000601`);
    const states = await openStates();
    expect(within(states).getAllByRole("option").map(option => option.textContent)).toEqual(["Todos", "Propuestos", "Sin clasificar", "Confirmados", "Descartados"]);
    expect(within(states).getByRole("option", { name: "Todos" })).toHaveAttribute("aria-selected", "true");
    await userEvent.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("listbox")).not.toBeInTheDocument());
    // Under «Formularios», with the documents that wait for someone of the team.
    expect(await screen.findByRole("link", { name: "Documentos recibidos (7)" })).toHaveAttribute("aria-current", "page");
    expect(router.state.location.pathname).toBe("/formularios/documentos");
  }, 20_000);

  it("writes the count of the menu with the region's grouping", async () => {
    setup({ counts: { forReview: 1205, unclassified: 5, total: 1210 }, list: body => HttpResponse.json({ ...receivedDocumentsPageFixture(), page: body.page, pageSize: body.pageSize,
      totalCount: 1227, counts: { proposed: 1208, forReview: 1205, unclassified: 5, confirmed: 10, discarded: 4 } }) });
    renderRouteWithProviders("/formularios/documentos");
    expect(await screen.findByRole("link", { name: "Documentos recibidos (1.210)" })).toBeInTheDocument();
  }, 20_000);

  it("keeps the search and the state in memory, never in the address, and asks for three digits before searching", async () => {
    const { requests } = setup();
    const user = userEvent.setup();
    const { router } = renderRouteWithProviders("/formularios/documentos");
    await screen.findByRole("table", {}, { timeout: 10_000 });
    const search = screen.getByRole("searchbox", { name: "Monto, CUIT u operación" });
    await user.click(search);
    await user.paste("15");
    expect(await screen.findByRole("alert")).toHaveTextContent("Escribí al menos 3 números: un monto, un CUIT o una operación.");
    expect(lastList(requests)).not.toHaveProperty("search");
    await user.paste("0.000");
    await waitFor(() => expect(lastList(requests).search).toBe("150.000"));
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.getByText("Búsqueda: 150.000")).toBeInTheDocument();
    await chooseState("Propuestos");
    await waitFor(() => expect(lastList(requests).state).toBe("proposed"));
    expect(router.state.location.search).not.toMatch(/search|state|150/);
    await user.click(screen.getByRole("button", { name: "Limpiar todo" }));
    await waitFor(() => expect(lastList(requests)).not.toHaveProperty("state"));
    expect(lastList(requests)).not.toHaveProperty("search");
  }, 20_000);

  it("filters by the form and the person who sent it, with the options the page brings, in memory", async () => {
    const { requests } = setup();
    const user = userEvent.setup();
    const { router } = renderRouteWithProviders("/formularios/documentos");
    await screen.findByRole("table", {}, { timeout: 10_000 });
    await user.click(screen.getByRole("button", { name: "Filtros" }));
    const form = await openPicker(user, await screen.findByRole("button", { name: "Formulario Todos" }));
    expect(within(form).getAllByRole("option").map(option => option.textContent)).toEqual(["Todos", "Pagos de clientes", "Gastos"]);
    await user.click(within(form).getByRole("option", { name: "Pagos de clientes" }));
    await waitFor(() => expect(lastList(requests).definitionId).toBe(receivedDocumentForms.payments));
    expect(await screen.findByRole("button", { name: "Formulario Pagos de clientes" })).toBeInTheDocument();
    // The section of the panel: the header «Mandó» of the table is a button too, because it orders (OT1-C).
    await user.click(within(screen.getByRole("dialog", { name: "Filtros" })).getByRole("button", { name: /^Mandó/ }));
    // Three people: their list has no search (DS1-A), and a letter goes to the first one that starts with it.
    const sender = await openPicker(user, await screen.findByRole("button", { name: "Mandó Todos" }));
    expect(screen.queryByRole("combobox", { name: "Buscar en Mandó" })).not.toBeInTheDocument();
    await user.keyboard("p");
    expect(sender).toHaveAttribute("aria-activedescendant", within(sender).getByRole("option", { name: "Pablo Sosa" }).id);
    await user.keyboard("{Enter}");
    await waitFor(() => expect(lastList(requests).senderUserId).toBe("0199b0c0-0000-7000-8000-000000000302"));
    await user.keyboard("{Escape}");
    expect(await screen.findByText("Formulario: Pagos de clientes")).toBeInTheDocument();
    expect(screen.getByText("Mandó: Pablo Sosa")).toBeInTheDocument();
    expect(router.state.location.search).not.toMatch(/definition|sender|0199b0c0/);
    await user.click(screen.getByRole("button", { name: "Quitar Formulario: Pagos de clientes" }));
    await waitFor(() => expect(lastList(requests)).not.toHaveProperty("definitionId"));
    expect(lastList(requests).senderUserId).toBe("0199b0c0-0000-7000-8000-000000000302");
    await user.click(screen.getByRole("button", { name: "Limpiar todo" }));
    await waitFor(() => expect(lastList(requests)).not.toHaveProperty("senderUserId"));
  }, 20_000);

  it("says in the filter when its list shows only the people with the most documents", async () => {
    setup({ list: body => { const page = receivedDocumentsPageFixture(); return HttpResponse.json({ ...page, page: body.page, pageSize: body.pageSize, facets: { ...page.facets, sendersTruncated: true } }); } });
    const user = userEvent.setup();
    renderRouteWithProviders("/formularios/documentos");
    await screen.findByRole("table", {}, { timeout: 10_000 });
    await user.click(screen.getByRole("button", { name: "Filtros" }));
    await openPicker(user, await screen.findByRole("button", { name: "Formulario Todos" }));
    expect(screen.queryByText("Se muestran los 100 con más documentos.")).not.toBeInTheDocument();
    await user.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("listbox")).not.toBeInTheDocument());
    await user.click(within(screen.getByRole("dialog", { name: "Filtros" })).getByRole("button", { name: /^Mandó/ }));
    await openPicker(user, await screen.findByRole("button", { name: "Mandó Todos" }));
    expect(screen.getByText("Se muestran los 100 con más documentos.")).toBeInTheDocument();
  }, 20_000);

  it("says when nothing arrived yet, when nothing matches and when the list could not be read", async () => {
    const empty: Omit<ReceivedDocumentsPage, "pageSize"> = { items: [], page: 1, totalCount: 0, counts: { proposed: 0, forReview: 0, unclassified: 0, confirmed: 0, discarded: 0 },
      facets: { forms: [], senders: [], formsTruncated: false, sendersTruncated: false }, groups: [], discardedRetentionDays: 90 };
    let failing = true;
    setup({ list: body => body.state ? HttpResponse.json({ ...empty, pageSize: body.pageSize })
      : failing ? HttpResponse.json({ status: 500, traceId: "trace" }, { status: 500 }) : HttpResponse.json({ ...empty, pageSize: body.pageSize }) });
    const user = userEvent.setup();
    renderRouteWithProviders("/formularios/documentos");
    expect(await screen.findByText("No pudimos cargar los documentos.", {}, { timeout: 10_000 })).toBeInTheDocument();
    failing = false;
    await user.click(screen.getByRole("button", { name: "Reintentar" }));
    expect(await screen.findByText("Todavía no llegaron documentos")).toBeInTheDocument();
    await chooseState("Confirmados");
    expect(await screen.findByText("Ningún documento coincide")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Limpiar todo" }));
    expect(await screen.findByText("Todavía no llegaron documentos")).toBeInTheDocument();
  }, 20_000);

  // DOC6: the notice of similar documents, above the sheet, for whoever reviews documents and designs forms.
  it("shows the similar documents no form takes above the sheet and asks for a form from their topic under a new request", async () => {
    const groups = [{ topic: { id: topicId, name: "tickets de combustible" }, count: 5, documentIds: [receivedDocumentIds.unclassified, receivedDocumentIds.other] }];
    setup({ permissions: builder, list: body => HttpResponse.json({ ...receivedDocumentsPageFixture(), page: body.page, pageSize: body.pageSize, groups }) });
    const asks = proposalHandlers(groups[0]!.topic);
    const user = userEvent.setup();
    const { router } = renderRouteWithProviders("/formularios/documentos");
    const notice = await screen.findByText("Llegaron 5 documentos parecidos que no encajan en ningún formulario: tickets de combustible.", {}, { timeout: 10_000 });
    expect(notice.compareDocumentPosition(screen.getByRole("table")) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Armar formulario con la IA: tickets de combustible" }));
    await waitFor(() => expect(asks).toHaveLength(1));
    expect(asks[0]).toEqual({ requestId: expect.stringMatching(/^[0-9a-f-]{36}$/), topicId });
    await waitFor(() => expect(router.state.location.pathname).toBe(`/formularios/documentos/armar/${(asks[0] as { requestId: string }).requestId}`));
  }, 20_000);

  it("does not show the notice of similar documents without «Diseñar formularios»", async () => {
    const groups = [{ topic: { id: topicId, name: "tickets de combustible" }, count: 5, documentIds: [receivedDocumentIds.unclassified] }];
    setup({ permissions: [...reviewer, "formtemplates.read"], list: body => HttpResponse.json({ ...receivedDocumentsPageFixture(), page: body.page, pageSize: body.pageSize, groups }) });
    renderRouteWithProviders("/formularios/documentos");
    expect(await screen.findByRole("link", { name: "REC-000124" }, { timeout: 10_000 })).toBeInTheDocument();
    expect(screen.queryByText(/documentos parecidos/)).not.toBeInTheDocument();
  }, 20_000);

  it("takes the inbox away on a 403", async () => {
    setup({ list: () => HttpResponse.json({ status: 403 }, { status: 403 }) });
    renderRouteWithProviders("/formularios/documentos");
    expect(await screen.findByRole("heading", { name: "No tenés permiso" }, { timeout: 10_000 })).toBeInTheDocument();
  }, 20_000);
});

// OT1-C (2026-11-22): every column with a datum orders in the server, by its header and by «Ordenar por», with the same `sort` in the
// body. The data read stay without order: they are kept encrypted.
describe("the order", () => {
  const header = (name: string) => within(within(screen.getByRole("table")).getByRole("columnheader", { name })).getByRole("button", { name });

  it("orders by a header in its useful direction, back on the first page, without touching the private filters, and keeps it in the address", async () => {
    const { requests } = setup();
    const { router } = renderRouteWithProviders("/formularios/documentos?page=2");
    const table = await screen.findByRole("table", {}, { timeout: 10_000 });
    // Without an order chosen, the usual one is a column: its arrow is seen and the button says it, and the body does not carry it.
    expect(lastList(requests)).not.toHaveProperty("sort");
    expect(within(table).getByRole("columnheader", { name: "Recibido" })).toHaveAttribute("aria-sort", "descending");
    expect(screen.getByRole("button", { name: "Ordenar por: Recibido, más reciente primero" })).toBeVisible();

    await userEvent.click(header("Documento"));
    await waitFor(() => expect(lastList(requests).sort).toBe("document"));
    expect(lastList(requests).page).toBe(1);
    const params = new URLSearchParams(router.state.location.search);
    expect(params.get("sort")).toBe("document");
    expect(params.has("page")).toBe(false);
    expect(within(screen.getByRole("table")).getByRole("columnheader", { name: "Documento" })).toHaveAttribute("aria-sort", "ascending");
    expect(within(screen.getByRole("table")).getByRole("columnheader", { name: "Recibido" })).toHaveAttribute("aria-sort", "none");

    // A private filter keeps the order, and the order keeps the filter.
    await chooseState("Propuestos");
    await waitFor(() => expect(lastList(requests)).toMatchObject({ state: "proposed", sort: "document" }));
    await userEvent.click(header("Documento"));
    await waitFor(() => expect(lastList(requests)).toMatchObject({ state: "proposed", sort: "-document" }));
    expect(new URLSearchParams(router.state.location.search).get("sort")).toBe("-document");
    expect(router.state.location.search).not.toMatch(/state|proposed/);
  }, 20_000);

  it("orders each column by its server field, and the data read do not order", async () => {
    const { requests } = setup();
    renderRouteWithProviders("/formularios/documentos");
    const table = await screen.findByRole("table", {}, { timeout: 10_000 });
    for (const datum of ["Monto", "Banco o billetera de origen", "CUIT o CUIL de origen"])
      expect(within(within(table).getByRole("columnheader", { name: datum })).queryByRole("button")).not.toBeInTheDocument();
    // The first touch on «Recibido» turns the usual order around; each other column starts in the useful direction of its datum.
    for (const [name, sort] of [["Recibido", "receivedAtUtc"], ["Documento", "document"], ["Mandó", "sender"], ["Formulario", "form"], ["Estado", "state"],
      ["Se borra", "-deleteAfterUtc"], ["Respuesta", "record"]] as const) {
      await userEvent.click(header(name));
      await waitFor(() => expect(lastList(requests).sort).toBe(sort));
    }
  }, 20_000);

  it("changes the order from «Ordenar por», last in the bar, which moves the arrow of the header", async () => {
    const { requests } = setup();
    renderRouteWithProviders("/formularios/documentos?sort=-deleteAfterUtc");
    await screen.findByRole("table", {}, { timeout: 10_000 });
    expect(lastList(requests).sort).toBe("-deleteAfterUtc");
    const trigger = screen.getByRole("button", { name: "Ordenar por: Se borra, más reciente primero" });
    expect(within(trigger.closest<HTMLElement>('[data-slot="filter-bar"]')!).getAllByRole("button").at(-1)).toBe(trigger);
    act(() => trigger.focus());
    await userEvent.keyboard("{Enter}");
    const columns = within(await screen.findByRole("menu")).getByRole("group", { name: "Columna" });
    expect(within(columns).getAllByRole("menuitemradio").map(item => item.textContent)).toEqual(["Documento", "Recibido", "Mandó", "Formulario", "Estado", "Se borra", "Respuesta"]);
    await userEvent.click(within(columns).getByRole("menuitemradio", { name: "Mandó" }));
    await waitFor(() => expect(lastList(requests).sort).toBe("sender"));
    await userEvent.click(within(screen.getByRole("menu")).getByRole("menuitemradio", { name: "De la Z a la A" }));
    await waitFor(() => expect(lastList(requests).sort).toBe("-sender"));
    await userEvent.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("menu")).not.toBeInTheDocument());
    expect(within(screen.getByRole("table")).getByRole("columnheader", { name: "Mandó" })).toHaveAttribute("aria-sort", "descending");
    expect(screen.getByRole("button", { name: "Ordenar por: Mandó, de la Z a la A" })).toHaveFocus();
  }, 20_000);

  it("leaves out an order the server does not know", async () => {
    const { requests } = setup();
    renderRouteWithProviders("/formularios/documentos?sort=-datum:Monto");
    await screen.findByRole("table", {}, { timeout: 10_000 });
    expect(lastList(requests)).not.toHaveProperty("sort");
    expect(screen.getByRole("button", { name: "Ordenar por: Recibido, más reciente primero" })).toBeVisible();
  }, 20_000);
});

describe("the panel", () => {
  it("opens a document in the route with the viewer, the form the AI recognized and its data, and goes through the list with the arrows", async () => {
    setup();
    const user = userEvent.setup();
    const { router } = renderRouteWithProviders("/formularios/documentos");
    const table = await screen.findByRole("table", {}, { timeout: 10_000 });
    await user.click(within(within(table).getAllByRole("row")[5]!).getByRole("link", { name: "comprobante.jpg" }));
    const frame = await panel();
    expect(router.state.location.pathname).toBe(`/formularios/documentos/${receivedDocumentIds.forReview}`);
    expect(await within(frame).findByText("Pablo Sosa · 21/10/2026, 18:12")).toBeInTheDocument();
    expect(within(frame).getByText("Para revisar")).toBeInTheDocument();
    expect(within(frame).getByText("5 de 27")).toBeInTheDocument();
    expect(within(frame).getByRole("toolbar", { name: "Ver comprobante.jpg" })).toBeInTheDocument();
    expect(await within(frame).findByRole("button", { name: "Acercar" })).toBeEnabled();
    expect(within(frame).getByText("Venció sin que Pablo Sosa lo confirmara en WhatsApp.")).toBeInTheDocument();
    // The forms the server can read it for, in the only piece to choose.
    const form = within(frame).getByRole("button", { name: "Formulario Pagos de clientes" });
    expect(within(await openPicker(user, form)).getAllByRole("option").map(option => option.textContent)).toEqual(["Pagos de clientes", "Gastos"]);
    await user.keyboard("{Escape}");
    await waitFor(() => expect(form).toHaveFocus());
    expect(within(frame).getByText("Seguro")).toBeInTheDocument();
    expect(within(frame).getByRole("textbox", { name: /^Monto/ })).toHaveValue("68500,00");
    expect(within(frame).getByRole("textbox", { name: /^Número de operación/ })).toHaveAccessibleName(/Revisá/);
    // A choice is chosen among its options: its button says its label, the mark of the one the server completed and the chosen one.
    expect(within(frame).getByRole("button", { name: /^Cliente/ })).toHaveAccessibleName("Cliente Del catálogo Panadería Don Ángel");
    // Eight data and the rest folded, unfolded and folded again.
    await user.click(within(frame).getByRole("button", { name: "Ver los 7 datos más" }));
    expect(within(frame).getByRole("textbox", { name: /^Cuenta de destino/ })).toHaveValue("");
    expect(within(frame).getByRole("button", { name: /^Banco o billetera de destino/ })).toHaveAccessibleName("Banco o billetera de destino No se leyó Elegí una opción");
    expect(within(frame).getAllByText("No se leyó")).toHaveLength(2);
    await user.click(within(frame).getByRole("button", { name: "Ver menos datos" }));
    expect(within(frame).queryByRole("textbox", { name: /^Cuenta de destino/ })).not.toBeInTheDocument();
    await user.keyboard("{Escape}");
    await waitFor(() => expect(router.state.location.pathname).toBe("/formularios/documentos"));
    await user.click(within(within(table).getAllByRole("row")[5]!).getByRole("link", { name: "comprobante.jpg" }));
    const reopened = await panel();
    await user.click(within(reopened).getByRole("button", { name: "Siguiente" }));
    await waitFor(() => expect(router.state.location.pathname).toBe(`/formularios/documentos/${receivedDocumentIds.waiting}`));
  }, 20_000);

  it("passes the reviewed data to the form; without an answer it says it is uncertain, reads it again and repeats the same request", async () => {
    const { requests, write } = setup();
    let attempt = 0;
    server.use(http.post("/api/forms/documents/:id/records", write(id => ++attempt === 1
      ? HttpResponse.json({ status: 503, traceId: "trace" }, { status: 503 })
      : HttpResponse.json({ documentId: id, recordId: requestId, number: "REC-000125", state: "Received" }))));
    const user = userEvent.setup();
    renderRouteWithProviders(`/formularios/documentos/${receivedDocumentIds.forReview}`);
    const frame = await panel();
    const operation = await within(frame).findByRole("textbox", { name: /^Número de operación/ });
    await user.clear(operation);
    await user.click(operation);
    await user.paste("6120093745");
    await pickOption(user, within(frame).getByRole("button", { name: /^Moneda/ }), "Dólares");
    const reads = requests.details.length;
    await user.click(within(frame).getByRole("button", { name: "Pasar al formulario" }));
    await waitFor(() => expect(notify).toHaveBeenCalledWith(expect.objectContaining({ kind: "warning",
      message: "No pudimos confirmar el resultado. Revisá el estado actual antes de repetir la operación. Referencia: trace" })));
    await waitFor(() => expect(requests.details.length).toBeGreaterThan(reads));
    await user.click(within(frame).getByRole("button", { name: "Pasar al formulario" }));
    await waitFor(() => expect(notify).toHaveBeenCalledWith(expect.objectContaining({ kind: "success", message: "Se cargó como REC-000125." })));
    const [first, second] = requests.writes.map(entry => entry.body as { requestId: string; versionId: string; expectedRevision: number; answers: { fieldId: string; value: string }[] });
    expect(second!.requestId).toBe(first!.requestId);
    expect(first!.expectedRevision).toBe(1);
    expect(first!.answers).toEqual(expect.arrayContaining([{ fieldId: receivedDocumentFields.operation, value: "6120093745" }, { fieldId: receivedDocumentFields.amount, value: "68500.00" },
      { fieldId: receivedDocumentFields.currency, value: receivedDocumentOptions.dollars }]));
    expect(first!.answers.some(answer => answer.fieldId === receivedDocumentFields.destinationAccount)).toBe(false);
  }, 20_000);

  it("warns that a response repeats a saved one and passes it again with the reviewer's mark", async () => {
    const { requests, write } = setup();
    let attempt = 0;
    server.use(http.post("/api/forms/documents/:id/records", write(id => ++attempt === 1
      ? HttpResponse.json({ status: 409, code: "Forms.ReceivedDocument.Repeated", detail: "Ya hay una respuesta.", recordNumber: "REC-000007" }, { status: 409 })
      : HttpResponse.json({ documentId: id, recordId: requestId, number: "REC-000125", state: "Received" }))));
    const user = userEvent.setup();
    renderRouteWithProviders(`/formularios/documentos/${receivedDocumentIds.forReview}`);
    const frame = await panel();
    const operation = await within(frame).findByRole("textbox", { name: /^Número de operación/ });
    await user.clear(operation);
    await user.click(operation);
    await user.paste("6120093745");
    await pickOption(user, within(frame).getByRole("button", { name: /^Moneda/ }), "Dólares");
    await user.click(within(frame).getByRole("button", { name: "Pasar al formulario" }));
    await waitFor(() => expect(notify).toHaveBeenCalledWith(expect.objectContaining({ kind: "warning",
      message: "Ya hay una respuesta con los mismos datos de este documento: REC-000007.", action: expect.objectContaining({ label: "Pasarlo igual" }) })));
    const warning = vi.mocked(notify).mock.calls.map(([notice]) => notice).find(notice => notice.action?.label === "Pasarlo igual")!;
    warning.action!.onClick();
    await waitFor(() => expect(notify).toHaveBeenCalledWith(expect.objectContaining({ kind: "success", message: "Se cargó como REC-000125." })));
    const [first, second] = requests.writes.map(entry => entry.body as { requestId: string; confirmRepeated?: boolean });
    expect(first!.confirmRepeated).toBeUndefined();
    expect(second).toMatchObject({ confirmRepeated: true });
    expect(second!.requestId).not.toBe(first!.requestId);
  }, 20_000);

  it("asks for a required choice that was not read, with its options, before sending", async () => {
    const base = receivedDocumentDetailFixture(receivedDocumentIds.forReview);
    const candidate = base.proposal!.candidates[0]!;
    const values = candidate.values.map(value => value.fieldId === receivedDocumentFields.currency ? { ...value, value: null, text: null, mark: "notRead" as const } : value);
    const { requests, write } = setup({ details: { [receivedDocumentIds.forReview]: { ...base, proposal: { ...base.proposal!, candidates: [{ ...candidate, values }] } } } });
    server.use(http.post("/api/forms/documents/:id/records", write(id => HttpResponse.json({ documentId: id, recordId: requestId, number: "REC-000125", state: "Received" }))));
    const user = userEvent.setup();
    renderRouteWithProviders(`/formularios/documentos/${receivedDocumentIds.forReview}`);
    const frame = await panel();
    // Not read, it invites to choose, with its mark; its list brings «Sin respuesta» first and then its options.
    const currency = await within(frame).findByRole("button", { name: /^Moneda/ });
    expect(currency).toHaveAccessibleName("Moneda No se leyó Elegí una opción");
    expect(within(await openPicker(user, currency)).getAllByRole("option").map(option => option.textContent)).toEqual(["Sin respuesta", "Pesos", "Dólares"]);
    await user.click(screen.getByRole("option", { name: "Dólares" }));
    expect(currency).toHaveAccessibleName("Moneda No se leyó Dólares");
    // «Sin respuesta» leaves it empty again, so passing it still asks for it.
    await pickOption(user, currency, "Sin respuesta");
    expect(currency).toHaveAccessibleName("Moneda No se leyó Elegí una opción");
    await user.click(within(frame).getByRole("button", { name: "Pasar al formulario" }));
    expect(await within(frame).findByText("Completá este dato.")).toBeInTheDocument();
    await waitFor(() => expect(currency).toHaveFocus());
    expect(requests.writes).toHaveLength(0);
    await pickOption(user, currency, "Pesos");
    await user.click(within(frame).getByRole("button", { name: "Pasar al formulario" }));
    await waitFor(() => expect(requests.writes).toHaveLength(1));
    expect((requests.writes[0]!.body as { answers: unknown[] }).answers).toContainEqual({ fieldId: receivedDocumentFields.currency, value: receivedDocumentOptions.pesos });
  }, 20_000);

  it("groups the options of a choice that chooses first by a field, so two alike can be told apart", async () => {
    const base = receivedDocumentDetailFixture(receivedDocumentIds.forReview);
    const candidate = base.proposal!.candidates[0]!;
    const towns = [{ id: "0199b0c0-0000-7000-8000-000000000711", text: "San Martín", group: "Buenos Aires" }, { id: "0199b0c0-0000-7000-8000-000000000712", text: "San Martín", group: "Mendoza" }];
    const values = candidate.values.map(value => value.fieldId === receivedDocumentFields.client ? { ...value, label: "Localidad", value: towns[1]!.id, text: "San Martín", options: towns } : value);
    setup({ details: { [receivedDocumentIds.forReview]: { ...base, proposal: { ...base.proposal!, candidates: [{ ...candidate, values }] } } } });
    const user = userEvent.setup();
    renderRouteWithProviders(`/formularios/documentos/${receivedDocumentIds.forReview}`);
    const frame = await panel();
    const town = await within(frame).findByRole("button", { name: /^Localidad/ });
    expect(town).toHaveAccessibleName("Localidad Del catálogo San Martín");
    // «Sin respuesta» first; the options of each group go together after a line, each with its group in grey under its name.
    const [none, buenosAires, mendoza, ...rest] = within(await openPicker(user, town)).getAllByRole("option");
    expect(rest).toEqual([]);
    expect(none).toHaveAccessibleName("Sin respuesta");
    expect(buenosAires).toHaveAccessibleName("San Martín");
    expect(buenosAires).toHaveAccessibleDescription("Buenos Aires");
    expect(mendoza).toHaveAccessibleName("San Martín");
    expect(mendoza).toHaveAccessibleDescription("Mendoza");
    expect(mendoza).toHaveAttribute("aria-selected", "true");
    expect([buenosAires, mendoza].map(option => option!.previousElementSibling?.getAttribute("role"))).toEqual(["presentation", "presentation"]);
  }, 20_000);

  it("searches the options of a choice the server does not list, and passes the one chosen", async () => {
    const base = receivedDocumentDetailFixture(receivedDocumentIds.forReview);
    const candidate = base.proposal!.candidates[0]!;
    const values = candidate.values.map(value => value.fieldId === receivedDocumentFields.client
      ? { ...value, required: true, value: null, text: null, mark: "notRead" as const, options: [], optionsUnavailable: { reason: "tooMany" as const } } : value);
    const { requests, write } = setup({ details: { [receivedDocumentIds.forReview]: { ...base, proposal: { ...base.proposal!, candidates: [{ ...candidate, values }] } } } });
    const searches: unknown[] = [];
    server.use(http.post("/api/forms/documents/:id/options", async ({ request }) => {
      searches.push(await request.json());
      return HttpResponse.json({ items: [{ id: receivedDocumentOptions.hardware, text: "Ferretería Norte", group: "Rosario" }], truncated: true });
    }), http.post("/api/forms/documents/:id/records", write(id => HttpResponse.json({ documentId: id, recordId: requestId, number: "REC-000125", state: "Received" }))));
    const user = userEvent.setup();
    renderRouteWithProviders(`/formularios/documentos/${receivedDocumentIds.forReview}`);
    const frame = await panel();
    const client = await within(frame).findByRole("button", { name: /^Cliente/ });
    // Its button says the mark of its label, as the other data.
    expect(client).toHaveAccessibleName("Cliente No se leyó Elegí una opción");
    await openPicker(user, client);
    // The search is inside the list, with the focus on it.
    await user.paste("fer");
    const option = await screen.findByRole("option", { name: "Ferretería Norte" });
    expect(option).toHaveAccessibleDescription("Rosario");
    expect(screen.getByText("Se muestran las primeras 50: escribí para buscar otras.")).toBeInTheDocument();
    await waitFor(() => expect(searches.at(-1)).toEqual({ fieldId: receivedDocumentFields.client, search: "fer" }));
    await user.click(option);
    expect(await within(frame).findByRole("button", { name: /^Cliente.* Ferretería Norte$/ })).toBe(client);
    await user.click(within(frame).getByRole("button", { name: "Pasar al formulario" }));
    await waitFor(() => expect(requests.writes).toHaveLength(1));
    expect((requests.writes[0]!.body as { answers: unknown[] }).answers).toContainEqual({ fieldId: receivedDocumentFields.client, value: receivedDocumentOptions.hardware });
  }, 20_000);

  it("reads the document again when its options answer that it can no longer be changed", async () => {
    const base = receivedDocumentDetailFixture(receivedDocumentIds.forReview);
    const candidate = base.proposal!.candidates[0]!;
    const values = candidate.values.map(value => value.fieldId === receivedDocumentFields.client
      ? { ...value, required: true, value: null, text: null, mark: "notRead" as const, options: [], optionsUnavailable: { reason: "tooMany" as const } } : value);
    const { requests } = setup({ details: { [receivedDocumentIds.forReview]: { ...base, proposal: { ...base.proposal!, candidates: [{ ...candidate, values }] } } } });
    server.use(http.post("/api/forms/documents/:id/options", () => HttpResponse.json({ status: 409, code: "Forms.ReceivedDocument.StateConflict",
      detail: "Este documento ya no se puede cambiar." }, { status: 409 })));
    const user = userEvent.setup();
    renderRouteWithProviders(`/formularios/documentos/${receivedDocumentIds.forReview}`);
    const frame = await panel();
    const client = await within(frame).findByRole("button", { name: /^Cliente/ });
    const reads = requests.details.length;
    await act(async () => { client.focus(); });
    await user.keyboard("{Enter}");
    await waitFor(() => expect(notify).toHaveBeenCalledWith(expect.objectContaining({ kind: "warning", message: "Este documento ya no se puede cambiar." })));
    await waitFor(() => expect(requests.details.length).toBeGreaterThan(reads));
  }, 20_000);

  it("says why a choice has no options for its sender, and stops the pass only when it is required", async () => {
    const base = receivedDocumentDetailFixture(receivedDocumentIds.forReview);
    const candidate = base.proposal!.candidates[0]!;
    const values = candidate.values.map(value => value.fieldId === receivedDocumentFields.client
      ? { ...value, required: true, value: null, text: null, mark: "notRead" as const, options: [], optionsUnavailable: { reason: "missingData" as const, datum: "Provincia" } } : value);
    const { requests } = setup({ details: { [receivedDocumentIds.forReview]: { ...base, proposal: { ...base.proposal!, candidates: [{ ...candidate, values }] } } } });
    const user = userEvent.setup();
    renderRouteWithProviders(`/formularios/documentos/${receivedDocumentIds.forReview}`);
    const frame = await panel();
    const reason = "No hay opciones para Pablo Sosa: le falta «Provincia». Completalo en Datos de las personas.";
    expect(await within(frame).findByText(reason)).toBeInTheDocument();
    expect(within(frame).queryByRole("button", { name: /^Cliente/ })).not.toBeInTheDocument();
    await user.click(within(frame).getByRole("button", { name: "Pasar al formulario" }));
    await waitFor(() => expect(document.getElementById("received-document-" + receivedDocumentFields.client)).toHaveFocus());
    expect(within(frame).getByRole("alert")).toHaveTextContent(reason);
    expect(within(frame).queryByText("Completá este dato.")).not.toBeInTheDocument();
    expect(requests.writes).toHaveLength(0);
  }, 20_000);

  it("reads it again for its own form from the panel, which choosing it again in its list does not do", async () => {
    const base = receivedDocumentDetailFixture(receivedDocumentIds.other);
    const own = { definitionId: receivedDocumentForms.payments, name: "Pagos de clientes" };
    const { requests, write } = setup({ details: { [receivedDocumentIds.other]: { ...base, document: { ...base.document, form: own } } } });
    server.use(http.put("/api/forms/documents/:id/form", write((_id, body) => HttpResponse.json({ requestId: (body as { requestId: string }).requestId, state: "pending", failureCode: null }, { status: 202 }))),
      http.get("/api/forms/documents/:id/extraction", ({ request }) => HttpResponse.json({ requestId: new URL(request.url).searchParams.get("requestId"), state: "pending", failureCode: null })));
    const user = userEvent.setup();
    renderRouteWithProviders(`/formularios/documentos/${receivedDocumentIds.other}`);
    const frame = await panel();
    await pickOption(user, await within(frame).findByRole("button", { name: "Formulario Pagos de clientes" }), "Pagos de clientes");
    expect(within(frame).queryByText("Leyendo los datos para «Pagos de clientes»…")).not.toBeInTheDocument();
    await user.click(within(frame).getByRole("button", { name: "Volver a leer para «Pagos de clientes»" }));
    await waitFor(() => expect(requests.writes).toHaveLength(1));
    expect(requests.writes[0]!.body).toEqual(expect.objectContaining({ definitionId: receivedDocumentForms.payments, expectedRevision: 1 }));
    expect(await within(frame).findByText("Leyendo los datos para «Pagos de clientes»…")).toBeInTheDocument();
  }, 20_000);

  it("stops before sending what is missing and leaves the server's problem under its datum", async () => {
    const { requests, write } = setup();
    server.use(http.post("/api/forms/documents/:id/records", write(() => HttpResponse.json({ status: 400, code: "Forms.ReceivedDocument.ContentInvalid", detail: "Revisá los datos.",
      errors: { [`answers.${receivedDocumentFields.account}`]: ["Revisá la cuenta: los números no dan. Copiala del comprobante."] } }, { status: 400 }))));
    const user = userEvent.setup();
    renderRouteWithProviders(`/formularios/documentos/${receivedDocumentIds.forReview}`);
    const frame = await panel();
    const amount = await within(frame).findByRole("textbox", { name: /^Monto/ });
    await user.clear(amount);
    await user.click(within(frame).getByRole("button", { name: "Pasar al formulario" }));
    expect(await within(frame).findByText("Completá este dato.")).toBeInTheDocument();
    await waitFor(() => expect(amount).toHaveFocus());
    expect(requests.writes).toHaveLength(0);
    await user.paste("68500");
    await user.click(within(frame).getByRole("button", { name: "Pasar al formulario" }));
    expect(await within(frame).findByText("Revisá la cuenta: los números no dan. Copiala del comprobante.")).toBeInTheDocument();
    await waitFor(() => expect(within(frame).getByRole("textbox", { name: /^Cuenta de origen/ })).toHaveFocus());
    expect(notify).toHaveBeenCalledWith(expect.objectContaining({ kind: "error", message: "No se pasó al formulario.", description: "Revisá Cuenta de origen." }));
  }, 20_000);

  it("discards with a confirmation and reopens, with the revision it saw", async () => {
    const { requests, write, current } = setup();
    const base = receivedDocumentDetailFixture(receivedDocumentIds.forReview);
    const discarded: ReceivedDocumentDetail = { ...base, document: { ...base.document, state: "discarded", forReview: false, reasonCode: "reviewer", deleteAfterUtc: "2027-02-10T12:00:00Z", revision: 2 },
      history: [...base.history, { atUtc: "2026-11-12T12:00:00Z", kind: "discarded", actor: { userId: currentUser.id, displayName: "Ana" }, detail: null }] };
    server.use(http.post("/api/forms/documents/:id/discard", write(id => { current[id] = discarded; return HttpResponse.json(discarded); })),
      http.post("/api/forms/documents/:id/reopen", write(id => { const reopened = { ...base, document: { ...base.document, revision: 3 } }; current[id] = reopened; return HttpResponse.json(reopened); })));
    const user = userEvent.setup();
    renderRouteWithProviders(`/formularios/documentos/${receivedDocumentIds.forReview}`);
    const frame = await panel();
    await user.click(await within(frame).findByRole("button", { name: "Descartar" }));
    const dialog = await screen.findByRole("dialog", { name: "¿Descartar comprobante.jpg?" });
    await user.click(within(dialog).getByRole("button", { name: "Descartar" }));
    await waitFor(() => expect(notify).toHaveBeenCalledWith(expect.objectContaining({ kind: "success", message: "Se descartó comprobante.jpg." })));
    expect(await within(frame).findByText("Lo descartó Ana.")).toBeInTheDocument();
    await user.click(within(frame).getByRole("button", { name: "Volver a abrir" }));
    await waitFor(() => expect(notify).toHaveBeenCalledWith(expect.objectContaining({ kind: "success", message: "Se volvió a abrir comprobante.jpg." })));
    expect(requests.writes.map(entry => [entry.path.split("/").at(-1), entry.body])).toEqual([["discard", { expectedRevision: 1 }], ["reopen", { expectedRevision: 2 }]]);
  }, 20_000);

  it("keeps the actions of a document its person was sent in place, off, with the reason and its deadline over them", async () => {
    setup();
    renderRouteWithProviders(`/formularios/documentos/${receivedDocumentIds.waiting}`);
    const frame = await panel();
    const pass = await within(frame).findByRole("button", { name: "Pasar al formulario" });
    const reason = "Le mandamos este documento a Juan Gómez. Si no lo confirma hasta el 22/10/2026, 16:05, lo podés revisar acá.";
    expect(pass).toHaveAttribute("aria-disabled", "true");
    expect(pass).toHaveAccessibleDescription(reason);
    expect(within(frame).getByRole("button", { name: "Descartar" })).toHaveAccessibleDescription(reason);
    // Its data are read, not edited.
    expect(within(frame).queryByRole("textbox", { name: /^Monto/ })).not.toBeInTheDocument();
    expect(within(frame).getByText("412.000")).toBeInTheDocument();
  }, 20_000);

  it("maps a conflict the server answers by reading the document again and saying why", async () => {
    const { write } = setup();
    server.use(http.post("/api/forms/documents/:id/records", write(() => HttpResponse.json({ status: 409, code: "Forms.ReceivedDocument.AwaitingSender",
      detail: "Quien lo mandó todavía puede completarlo." }, { status: 409 }))));
    const user = userEvent.setup();
    renderRouteWithProviders(`/formularios/documentos/${receivedDocumentIds.forReview}`);
    const frame = await panel();
    await user.click(await within(frame).findByRole("button", { name: "Pasar al formulario" }));
    await waitFor(() => expect(notify).toHaveBeenCalledWith(expect.objectContaining({ kind: "warning", message: "Quien lo mandó todavía puede completarlo." })));
  }, 20_000);

  it("offers to read it again for its form when the form was published again after it was read", async () => {
    const { requests, write, current } = setup();
    server.use(http.post("/api/forms/documents/:id/records", write(() => HttpResponse.json({ status: 409, code: "Forms.Entry.VersionChanged",
      detail: "Se publicó una versión nueva del formulario." }, { status: 409 }))),
    http.put("/api/forms/documents/:id/form", write((id, body) => {
      const asked = (body as { requestId: string }).requestId;
      current[id] = running(receivedDocumentDetailFixture(id), asked, { definitionId: receivedDocumentForms.payments, name: "Pagos de clientes" });
      return HttpResponse.json({ requestId: asked, state: "pending", failureCode: null }, { status: 202 });
    })),
    http.get("/api/forms/documents/:id/extraction", ({ request }) => HttpResponse.json({ requestId: new URL(request.url).searchParams.get("requestId"), state: "pending", failureCode: null })));
    const user = userEvent.setup();
    renderRouteWithProviders(`/formularios/documentos/${receivedDocumentIds.forReview}`);
    const frame = await panel();
    await user.click(await within(frame).findByRole("button", { name: "Pasar al formulario" }));
    await waitFor(() => expect(notify).toHaveBeenCalledWith(expect.objectContaining({ kind: "warning",
      message: "Se publicó otra versión de «Pagos de clientes» después de leerlo: volvé a leer sus datos para pasarlo." })));
    const action = vi.mocked(notify).mock.calls.at(-1)![0].action!;
    expect(action.label).toBe("Volver a leer para «Pagos de clientes»");
    action.onClick();
    expect(await within(frame).findByText("Leyendo los datos para «Pagos de clientes»…")).toBeInTheDocument();
    expect(requests.writes.at(-1)).toEqual({ path: `/api/forms/documents/${receivedDocumentIds.forReview}/form`, body: expect.objectContaining({ definitionId: receivedDocumentForms.payments, expectedRevision: 1 }) });
  }, 20_000);

  it("changes the form and reads its data again like a dictation, only until it ends", async () => {
    const base = receivedDocumentDetailFixture(receivedDocumentIds.forReview);
    const expenses = { ...base.proposal!.candidates[0]!, definitionId: receivedDocumentForms.expenses, versionId: "0199b0c0-0000-7000-8000-000000000412", name: "Gastos" };
    const doubt: ReceivedDocumentDetail = { ...base, proposal: { ...base.proposal!, outcome: "doubt", candidates: [base.proposal!.candidates[0]!, expenses] } };
    const { requests, write, current } = setup({ details: { [receivedDocumentIds.forReview]: doubt } });
    server.use(http.put("/api/forms/documents/:id/form", write((id, body) => {
      current[id] = running(doubt, (body as { requestId: string }).requestId);
      return HttpResponse.json({ requestId: (body as { requestId: string }).requestId, state: "pending", failureCode: null }, { status: 202 });
    })),
    http.get("/api/forms/documents/:id/extraction", ({ request, params }) => {
      requests.extraction++;
      current[String(params.id)] = { ...doubt, document: { ...doubt.document, form: { definitionId: receivedDocumentForms.expenses, name: "Gastos" }, revision: 3 } };
      return HttpResponse.json({ requestId: new URL(request.url).searchParams.get("requestId"), state: "completed", failureCode: null });
    }),
    // A detail that takes a while, as over a network: while it comes, the change that ended is not read again.
    http.get("/api/forms/documents/:id", async ({ params }) => { await delay(300); requests.details.push(String(params.id)); return HttpResponse.json(current[String(params.id)] ?? receivedDocumentDetailFixture(String(params.id))); }));
    const user = userEvent.setup();
    renderRouteWithProviders(`/formularios/documentos/${receivedDocumentIds.forReview}`);
    const frame = await panel();
    const form = await within(frame).findByRole("button", { name: "Formulario Pagos de clientes" });
    expect(within(frame).getByText("Con dudas")).toBeInTheDocument();
    await pickOption(user, form, "Gastos");
    expect(await within(frame).findByText("Leyendo los datos para «Gastos»…")).toBeInTheDocument();
    expect(requests.writes[0]!.body).toEqual(expect.objectContaining({ definitionId: receivedDocumentForms.expenses, expectedRevision: 1 }));
    await waitFor(() => expect(within(frame).getByRole("button", { name: "Formulario Gastos" })).toBeInTheDocument(), { timeout: 8000 });
    expect(within(frame).queryByText("Leyendo los datos para «Gastos»…")).not.toBeInTheDocument();
    await pause(2600);
    expect(requests.extraction).toBe(1);
  }, 20_000);

  it("follows a change of form someone else asked for until it ends, with everything else off", async () => {
    const base = receivedDocumentDetailFixture(receivedDocumentIds.forReview);
    const { current } = setup({ details: { [receivedDocumentIds.forReview]: running(base) } });
    let asked: string | null = null;
    server.use(http.get("/api/forms/documents/:id/extraction", ({ request, params }) => {
      asked = new URL(request.url).searchParams.get("requestId");
      current[String(params.id)] = { ...base, document: { ...base.document, form: { definitionId: receivedDocumentForms.expenses, name: "Gastos" }, revision: 3 } };
      return HttpResponse.json({ requestId: asked, state: "completed", failureCode: null });
    }));
    renderRouteWithProviders(`/formularios/documentos/${receivedDocumentIds.forReview}`);
    const frame = await panel();
    expect(await within(frame).findByText("Leyendo los datos para «Gastos»…")).toBeInTheDocument();
    expect(within(frame).getByRole("button", { name: "Pasar al formulario" })).toBeDisabled();
    await waitFor(() => expect(within(frame).queryByText("Leyendo los datos para «Gastos»…")).not.toBeInTheDocument(), { timeout: 8000 });
    expect(asked).toBe(requestId);
    expect(within(frame).getByRole("button", { name: "Pasar al formulario" })).toBeEnabled();
  }, 20_000);

  it("stops reading a change of form whose reading fails, leaves the actions on and reads it again with «Reintentar»", async () => {
    const base = receivedDocumentDetailFixture(receivedDocumentIds.forReview);
    const { requests, current } = setup({ details: { [receivedDocumentIds.forReview]: running(base) } });
    let failing = true;
    server.use(http.get("/api/forms/documents/:id/extraction", ({ request, params }) => {
      requests.extraction++;
      if (failing) return HttpResponse.json({ status: 500, traceId: "t" }, { status: 500 });
      current[String(params.id)] = { ...base, document: { ...base.document, form: { definitionId: receivedDocumentForms.expenses, name: "Gastos" }, revision: 3 } };
      return HttpResponse.json({ requestId: new URL(request.url).searchParams.get("requestId"), state: "completed", failureCode: null });
    }));
    const user = userEvent.setup();
    renderRouteWithProviders(`/formularios/documentos/${receivedDocumentIds.forReview}`);
    const frame = await panel();
    expect(await within(frame).findByText("Leyendo los datos para «Gastos»…")).toBeInTheDocument();
    expect(await within(frame).findByText("No pudimos saber si terminó la lectura para «Gastos».", {}, { timeout: 8000 })).toBeInTheDocument();
    expect(within(frame).queryByText("Leyendo los datos para «Gastos»…")).not.toBeInTheDocument();
    expect(within(frame).getByRole("button", { name: "Pasar al formulario" })).toBeEnabled();
    await pause(2600);
    expect(requests.extraction).toBe(1);
    expect(notices("error")).toEqual([]);
    failing = false;
    await user.click(within(frame).getByRole("button", { name: "Reintentar" }));
    await waitFor(() => expect(within(frame).getByRole("button", { name: "Formulario Gastos" })).toBeInTheDocument(), { timeout: 8000 });
    expect(requests.extraction).toBe(2);
    expect(within(frame).queryByText(/No pudimos saber/)).not.toBeInTheDocument();
  }, 20_000);

  it("leaves «Leyendo…» when the engine refuses a change of form, and says so in the notice and the history", async () => {
    const base = receivedDocumentDetailFixture(receivedDocumentIds.forReview);
    const asking = running(base);
    const { current } = setup({ details: { [receivedDocumentIds.forReview]: asking } });
    server.use(http.get("/api/forms/documents/:id/extraction", ({ request, params }) => {
      current[String(params.id)] = { ...asking, extraction: null, document: { ...asking.document, revision: 3 }, history: [...asking.history,
        { atUtc: "2026-11-12T12:00:05Z", kind: "extractionFailed", actor: { userId: "0199b0c0-0000-7000-8000-000000000999", displayName: "Marta Ruiz" }, detail: "Forms.ReceivedDocument.ExtractionRefused" }] };
      return HttpResponse.json({ requestId: new URL(request.url).searchParams.get("requestId"), state: "failed", failureCode: "Forms.ReceivedDocument.ExtractionRefused" });
    }));
    const user = userEvent.setup();
    renderRouteWithProviders(`/formularios/documentos/${receivedDocumentIds.forReview}`);
    const frame = await panel();
    expect(await within(frame).findByText("Leyendo los datos para «Gastos»…")).toBeInTheDocument();
    await waitFor(() => expect(notify).toHaveBeenCalledWith(expect.objectContaining({ kind: "warning", message: "No se pudo leer para «Gastos»: el motor no lo permitió." })), { timeout: 8000 });
    await waitFor(() => expect(within(frame).queryByText("Leyendo los datos para «Gastos»…")).not.toBeInTheDocument());
    await user.click(await within(frame).findByRole("tab", { name: "Historial (3)" }));
    expect(within(frame).getByText("No se pudo leer para «Gastos»: el motor no lo permitió.")).toBeInTheDocument();
  }, 20_000);

  it("says the server's text and when to try again when the AI's quota stops a change of form", async () => {
    const base = receivedDocumentDetailFixture(receivedDocumentIds.forReview);
    const expenses = { ...base.proposal!.candidates[0]!, definitionId: receivedDocumentForms.expenses, versionId: "0199b0c0-0000-7000-8000-000000000412", name: "Gastos" };
    const doubt: ReceivedDocumentDetail = { ...base, proposal: { ...base.proposal!, outcome: "doubt", candidates: [base.proposal!.candidates[0]!, expenses] } };
    const { write } = setup({ details: { [receivedDocumentIds.forReview]: doubt } });
    server.use(http.put("/api/forms/documents/:id/form", write(() => HttpResponse.json({ status: 429, title: "Too many requests", code: "Ai.Assistant.QuotaExceeded",
      detail: "Se terminó el cupo de la IA por hoy.", retryAfter: 120 }, { status: 429 }))));
    const user = userEvent.setup();
    renderRouteWithProviders(`/formularios/documentos/${receivedDocumentIds.forReview}`);
    const frame = await panel();
    await pickOption(user, await within(frame).findByRole("button", { name: "Formulario Pagos de clientes" }), "Gastos");
    await waitFor(() => expect(vi.mocked(notify)).toHaveBeenCalledWith(expect.objectContaining({ kind: "error", message: "Se terminó el cupo de la IA por hoy.",
      description: "Esperá 120 segundos para volver a intentar." })));
  }, 20_000);

  it("waits the time a 429 asked before reading a change of form again", async () => {
    setup({ details: { [receivedDocumentIds.forReview]: running(receivedDocumentDetailFixture(receivedDocumentIds.forReview)) } });
    server.use(http.get("/api/forms/documents/:id/extraction", () => HttpResponse.json({ status: 429, retryAfter: 30 }, { status: 429 })));
    renderRouteWithProviders(`/formularios/documentos/${receivedDocumentIds.forReview}`);
    const frame = await panel();
    const retry = await within(frame).findByRole("button", { name: "Reintentar" }, { timeout: 8000 });
    await waitFor(() => expect(retry).toHaveAttribute("aria-disabled", "true"));
    expect(retry).toHaveAccessibleDescription(/^Esperá (29|30) segundos para volver a intentar\.$/);
  }, 20_000);

  it("does not read the change of form of someone else without «Revisar documentos»", async () => {
    const { requests } = setup({ permissions: ["formdocuments.read"], details: { [receivedDocumentIds.forReview]: running(receivedDocumentDetailFixture(receivedDocumentIds.forReview, "es", false)) } });
    server.use(http.get("/api/forms/documents/:id/extraction", () => { requests.extraction++; return HttpResponse.json({ status: 403 }, { status: 403 }); }));
    renderRouteWithProviders(`/formularios/documentos/${receivedDocumentIds.forReview}`);
    const frame = await panel();
    expect(await within(frame).findByText("Leyendo los datos para «Gastos»…")).toBeInTheDocument();
    await pause(2600);
    expect(requests.extraction).toBe(0);
    expect(notices("error")).toEqual([]);
  }, 20_000);

  it("lets another document be reviewed while a pass runs, and says how the pass went", async () => {
    const { requests, write } = setup();
    server.use(http.post("/api/forms/documents/:id/records", write(async id => { await delay(2500); return HttpResponse.json({ documentId: id, recordId: requestId, number: "REC-000125", state: "Received" }); })),
      http.post("/api/forms/documents/:id/discard", write(id => {
        const base = receivedDocumentDetailFixture(id);
        return HttpResponse.json({ ...base, document: { ...base.document, state: "discarded", reasonCode: "reviewer", deleteAfterUtc: "2027-02-10T12:00:00Z", revision: 2 } });
      })));
    const user = userEvent.setup();
    renderRouteWithProviders(`/formularios/documentos/${receivedDocumentIds.forReview}`);
    const frame = await panel();
    const pass = await within(frame).findByRole("button", { name: "Pasar al formulario" });
    await waitFor(() => expect(pass).toBeEnabled());
    await screen.findByRole("table", {}, { timeout: 10_000 });
    await user.click(pass);
    await waitFor(() => expect(requests.writes).toHaveLength(1));
    const previous = within(frame).getByRole("button", { name: "Anterior" });
    await waitFor(() => expect(previous).toBeEnabled());
    await user.click(previous);
    await waitFor(() => expect(within(frame).getByRole("heading", { name: "ticket.jpg" })).toBeInTheDocument(), { timeout: 5000 });
    const discard = await within(frame).findByRole("button", { name: "Descartar" });
    await waitFor(() => expect(discard).toBeEnabled());
    await user.click(discard);
    const dialog = await screen.findByRole("dialog", { name: "¿Descartar ticket.jpg?" });
    await user.click(within(dialog).getByRole("button", { name: "Descartar" }));
    await waitFor(() => expect(notify).toHaveBeenCalledWith(expect.objectContaining({ kind: "success", message: "Se descartó ticket.jpg." })));
    expect(requests.writes.map(entry => entry.path.split("/").at(-1))).toEqual(["records", "discard"]);
    await waitFor(() => expect(notify).toHaveBeenCalledWith(expect.objectContaining({ kind: "success", message: "Se cargó como REC-000125." })), { timeout: 8000 });
  }, 20_000);

  it("still says how a pass went and reads the inbox again after the panel closed", async () => {
    const { requests, write } = setup();
    let answered = false;
    server.use(http.post("/api/forms/documents/:id/records", write(async id => { await delay(1000); answered = true; return HttpResponse.json({ documentId: id, recordId: requestId, number: "REC-000125", state: "Received" }); })));
    const user = userEvent.setup();
    const { router } = renderRouteWithProviders(`/formularios/documentos/${receivedDocumentIds.forReview}`);
    const frame = await panel();
    const pass = await within(frame).findByRole("button", { name: "Pasar al formulario" });
    await waitFor(() => expect(pass).toBeEnabled());
    await screen.findByRole("table", {}, { timeout: 10_000 });
    await user.click(pass);
    await waitFor(() => expect(requests.writes).toHaveLength(1));
    await user.click(within(frame).getByRole("button", { name: "Cerrar" }));
    await waitFor(() => expect(router.state.location.pathname).toBe("/formularios/documentos"));
    const lists = requests.list.length;
    await waitFor(() => expect(answered).toBe(true), { timeout: 4000 });
    await waitFor(() => expect(notify).toHaveBeenCalledWith(expect.objectContaining({ kind: "success", message: "Se cargó como REC-000125." })));
    await waitFor(() => expect(requests.list.length).toBeGreaterThan(lists));
  }, 20_000);

  it("waits the time a 429 asked before reading the file again", async () => {
    setup();
    server.use(http.get("/api/forms/documents/:id/file", () => HttpResponse.json({ status: 429, retryAfter: 5 }, { status: 429 })));
    renderRouteWithProviders(`/formularios/documentos/${receivedDocumentIds.forReview}`);
    const frame = await panel();
    expect(await within(frame).findByText("No pudimos cargar el documento.")).toBeInTheDocument();
    const retry = within(frame).getByRole("button", { name: "Reintentar" });
    await waitFor(() => expect(retry).toHaveAttribute("aria-disabled", "true"));
    expect(retry).toHaveAccessibleDescription(/^Esperá [45] segundos para volver a intentar\.$/);
  }, 20_000);

  it("only reads without «Revisar documentos», and shows the history in its tab, in the address", async () => {
    setup({ permissions: ["formdocuments.read"] });
    const user = userEvent.setup();
    const { router } = renderRouteWithProviders(`/formularios/documentos/${receivedDocumentIds.pdf}`);
    const frame = await panel();
    expect(await within(frame).findByText("Confirmado")).toBeInTheDocument();
    expect(within(frame).queryByRole("button", { name: "Pasar al formulario" })).not.toBeInTheDocument();
    expect(within(frame).queryByRole("button", { name: "Descartar" })).not.toBeInTheDocument();
    expect(within(frame).queryByRole("button", { name: /^Formulario / })).not.toBeInTheDocument();
    // Without «Ver respuestas» the response is its number, without a link.
    expect(within(frame).getByText("REC-000124")).toBeInTheDocument();
    expect(within(frame).queryByRole("link", { name: "REC-000124" })).not.toBeInTheDocument();
    await user.click(within(frame).getByRole("tab", { name: "Historial (2)" }));
    expect(router.state.location.search).toContain("tab=history");
    expect(within(frame).getByText("Llegó y la IA lo reconoció")).toBeInTheDocument();
    expect(within(frame).getByText("De Juan Gómez, por WhatsApp")).toBeInTheDocument();
    expect(within(frame).getByText("Se cargó como REC-000124")).toBeInTheDocument();
  }, 20_000);

  // DOC6: an unclassified document with its reading and its copy, for whoever reviews documents and designs forms.
  it("asks for a form from an unclassified document under a new request, only to whoever also designs forms", async () => {
    setup({ permissions: builder });
    const asks = proposalHandlers(null);
    const user = userEvent.setup();
    const { router } = renderRouteWithProviders(`/formularios/documentos/${receivedDocumentIds.unclassified}`);
    const frame = await panel();
    await user.click(await within(frame).findByRole("button", { name: "Armar formulario con la IA" }, { timeout: 10_000 }));
    await waitFor(() => expect(asks).toHaveLength(1));
    expect(asks[0]).toEqual({ requestId: expect.stringMatching(/^[0-9a-f-]{36}$/), documentId: receivedDocumentIds.unclassified });
    await waitFor(() => expect(router.state.location.pathname).toBe(`/formularios/documentos/armar/${(asks[0] as { requestId: string }).requestId}`));
  }, 20_000);

  it("leaves «Armar formulario con la IA» off, with its reason, while the document's data are read for a form", async () => {
    setup({ permissions: builder, details: { [receivedDocumentIds.unclassified]: running(receivedDocumentDetailFixture(receivedDocumentIds.unclassified)) } });
    renderRouteWithProviders(`/formularios/documentos/${receivedDocumentIds.unclassified}`);
    const build = await within(await panel()).findByRole("button", { name: "Armar formulario con la IA" }, { timeout: 10_000 });
    expect(build).toHaveAttribute("aria-disabled", "true");
    expect(build).toHaveAccessibleDescription("Esperá a que termine lo que se está haciendo con este documento.");
  }, 20_000);

  it("does not offer a form from a document that is not unclassified", async () => {
    setup({ permissions: builder });
    renderRouteWithProviders(`/formularios/documentos/${receivedDocumentIds.forReview}`);
    expect(await within(await panel()).findByRole("button", { name: "Pasar al formulario" }, { timeout: 10_000 })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Armar formulario con la IA" })).not.toBeInTheDocument();
  }, 20_000);

  it("does not offer a form from an unclassified document to whoever only reviews documents", async () => {
    setup();
    renderRouteWithProviders(`/formularios/documentos/${receivedDocumentIds.unclassified}`);
    expect(await within(await panel()).findByRole("button", { name: "Descartar" }, { timeout: 10_000 })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Armar formulario con la IA" })).not.toBeInTheDocument();
  }, 20_000);

  it("shows a rejected file the inbox kept no copy of with its name and its reason, without asking for it", async () => {
    // Over the limit, WhatsApp never said its size.
    const rejected = receivedDocumentDetailFixture(receivedDocumentIds.rejected);
    const { requests } = setup({ details: { [receivedDocumentIds.rejected]: { ...rejected, document: { ...rejected.document, file: { ...rejected.document.file, size: null } } } } });
    renderRouteWithProviders(`/formularios/documentos/${receivedDocumentIds.rejected}`);
    const frame = await panel();
    expect(await within(frame).findByRole("heading", { name: "planilla-vieja.doc" })).toBeInTheDocument();
    expect(within(frame).getByText("Es de un formato viejo: no se pudo abrir.")).toBeInTheDocument();
    expect(within(frame).queryByRole("toolbar")).not.toBeInTheDocument();
    expect(within(frame).queryByRole("button", { name: "Descargar" })).not.toBeInTheDocument();
    // Never read, it is not reopened: nothing would be left to review. Without its size, nothing says one.
    expect(within(frame).queryByRole("button", { name: "Volver a abrir" })).not.toBeInTheDocument();
    expect(within(frame).queryByText(/\b(?:bytes|KB|MB)\b/)).not.toBeInTheDocument();
    await pause(300);
    expect(requests.files).toBe(0);
  }, 20_000);

  it("names the person who chose a form of a doubt in the channel", async () => {
    setup();
    const user = userEvent.setup();
    renderRouteWithProviders(`/formularios/documentos/${receivedDocumentIds.waiting}`);
    const frame = await panel();
    await user.click(await within(frame).findByRole("tab", { name: "Historial (2)" }));
    expect(within(frame).getByText("Llegó y la IA dudó entre formularios")).toBeInTheDocument();
    expect(within(frame).getByText("Eligió el formulario")).toBeInTheDocument();
    expect(within(frame).getByText("Juan Gómez, por WhatsApp")).toBeInTheDocument();
  }, 20_000);
});
