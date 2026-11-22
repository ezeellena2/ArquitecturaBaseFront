import { act, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { queryClient } from "@/shared/api/queryClient";
import { notify } from "@/shared/ui/notifications";
import { currentUser } from "@/test/mocks/handlers";
import { server } from "@/test/mocks/server";
import { renderRouteWithProviders } from "@/test/utils/renderWithProviders";
import { cellUnder } from "@/test/utils/tableCells";
import { receivedDocumentRowDetailFixture, receivedDocumentRowIds, receivedDocumentRowsPageFixture } from "@/test/visual/receivedDocumentFixtures";

// A 401 tries to renew the session once and then ends it, as the app does: here, with no session to renew.
vi.mock("react-oidc-context", async () => ({ ...await vi.importActual<typeof import("react-oidc-context")>("react-oidc-context"), useAuth: () => ({ isAuthenticated: true, isLoading: false,
  user: { access_token: "test" }, signinSilent: async () => null, removeUser: async () => undefined }) }));
vi.mock("@/shared/ui/notifications", async () => ({ ...await vi.importActual<typeof import("@/shared/ui/notifications")>("@/shared/ui/notifications"), notify: vi.fn() }));

// VC1-A (task 30): the rows of a spreadsheet in «Documentos recibidos», with synthetic bodies on the guards of task 26 and the backend of
// task 28: one entry per row with its «Fila 5» in grey, «Para revisar» and «Propuesto» under «Propuestos», «La fila» in the place of the
// viewer with «Descargar la planilla» (asked only then; a 429 waits as its reason, a 401 or 403 takes the inbox away and leaving the row
// abandons it), a row that waits for its person with its actions off and the reason, the history of a row and the reasons of one that
// fits no form or repeats another. Each row's link is described by its «Fila 5»: the rows of a spreadsheet share its name.
const reviewer = ["formdocuments.read", "formdocuments.review", "formrecords.read"];
type Body = Record<string, unknown> & { page: number; pageSize: number };

const spreadsheetFile = () => new HttpResponse("PK", { headers: { "content-type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" } });
function setup({ file = spreadsheetFile }: { file?: (request: Request) => Response | Promise<Response> } = {}) {
  const requests = { list: [] as Body[], files: 0 };
  server.use(
    http.get("/api/me", () => HttpResponse.json({ ...currentUser, permissions: reviewer })),
    http.get("/api/forms/documents/counts", () => HttpResponse.json({ forReview: 4, unclassified: 1, total: 5 })),
    http.post("/api/forms/documents/search", async ({ request }) => {
      const body = await request.json() as Body; requests.list.push(body);
      return HttpResponse.json({ ...receivedDocumentRowsPageFixture(), page: body.page, pageSize: body.pageSize });
    }),
    http.get("/api/forms/documents/:id", ({ params }) => HttpResponse.json(receivedDocumentRowDetailFixture(String(params.id)))),
    http.get("/api/forms/documents/:id/file", ({ request }) => { requests.files++; return file(request); }),
  );
  return requests;
}

beforeEach(() => {
  queryClient.clear();
  vi.mocked(notify).mockClear();
  URL.createObjectURL = vi.fn(() => "blob:spreadsheet");
  URL.revokeObjectURL = vi.fn();
});
const panel = () => screen.findByRole("region", { name: "Documento" }, { timeout: 10_000 });

describe("the rows of a spreadsheet in the list", () => {
  it("shows each row as its spreadsheet with its row in grey below, with its sheet when the book has several", async () => {
    setup();
    renderRouteWithProviders("/formularios/documentos");
    const table = await screen.findByRole("table", {}, { timeout: 10_000 });
    const rows = within(table).getAllByRole("row");
    const first = within(rows[1]!);
    // The rows of one spreadsheet share the name of their link: each one is told apart by its row, read as its description.
    expect(first.getByRole("link", { name: "cobranzas-semana.xlsx" })).toHaveAccessibleDescription("Fila 2");
    expect(first.getByText("Fila 2")).toBeInTheDocument();
    expect(cellUnder(table, rows[1]!, "Monto")).toHaveTextContent("95.000");
    expect(cellUnder(table, rows[1]!, "Estado")).toHaveTextContent("Propuesto");
    expect(cellUnder(table, rows[4]!, "Estado")).toHaveTextContent("Para revisar");
    expect(within(rows[8]!).getByText("Ventas · fila 3")).toBeInTheDocument();
    expect(within(rows[8]!).getAllByRole("link")[0]).toHaveAccessibleDescription("Ventas · fila 3");
    expect(cellUnder(table, rows[8]!, "Respuesta")).toHaveTextContent("COB-000118");
    // A document that is not a row has no row.
    expect(within(rows[10]!).queryByText(/^Fila/)).not.toBeInTheDocument();
    expect(within(rows[10]!).getAllByRole("link")[0]).not.toHaveAttribute("aria-describedby");
  }, 20_000);

  it("brings, under «Propuestos», the ones for review and the ones that wait for their person", async () => {
    const requests = setup();
    const user = userEvent.setup();
    renderRouteWithProviders("/formularios/documentos");
    // The state is the button of the bar of the piece to choose (2026-11-22), opened with the keyboard as the other Radix lists.
    const states = await screen.findByRole("button", { name: "Estado Todos" }, { timeout: 10_000 });
    await act(async () => { states.focus(); });
    await user.keyboard("{Enter}");
    await user.click(within(await screen.findByRole("listbox", { name: "Estado" })).getByRole("option", { name: "Propuestos" }));
    await waitFor(() => expect(requests.list.at(-1)).toMatchObject({ state: "proposed" }));
  }, 20_000);
});

describe("the panel of a row", () => {
  it("shows «La fila» as it came instead of the viewer, and asks for the spreadsheet only to download it", async () => {
    const requests = setup();
    const user = userEvent.setup();
    renderRouteWithProviders(`/formularios/documentos/${receivedDocumentRowIds.overLimit}`);
    const frame = await panel();
    expect(await within(frame).findByText("Fila 5 · Marta Ruiz · 12/11/2026, 10:40")).toBeInTheDocument();
    const row = within(frame).getByRole("region", { name: "La fila" });
    expect(within(row).getByText("Cliente")).toBeInTheDocument();
    expect(within(row).getByText("Kiosco El Sol")).toBeInTheDocument();
    expect(within(row).getByText("47800")).toBeInTheDocument();
    expect(within(frame).queryByRole("toolbar")).not.toBeInTheDocument();
    // Past the limit of the message it waits for the team because of it, and it is reviewed like a document.
    expect(within(frame).getByText("Pasó el tope de 3 cargas por mensaje.")).toBeInTheDocument();
    expect(await within(frame).findByRole("button", { name: "Pasar al formulario" })).toBeEnabled();
    expect(requests.files).toBe(0);
    await user.click(within(row).getByRole("button", { name: "Descargar la planilla" }));
    await waitFor(() => expect(URL.createObjectURL).toHaveBeenCalled());
    expect(requests.files).toBe(1);
  }, 20_000);

  it("says when the spreadsheet could not be downloaded", async () => {
    setup({ file: () => HttpResponse.json({ title: "Error" }, { status: 500 }) });
    const user = userEvent.setup();
    renderRouteWithProviders(`/formularios/documentos/${receivedDocumentRowIds.overLimit}`);
    const frame = await panel();
    await user.click(await within(frame).findByRole("button", { name: "Descargar la planilla" }));
    await waitFor(() => expect(vi.mocked(notify).mock.calls.some(([options]) => options.message === "No pudimos bajar la planilla.")).toBe(true));
  }, 20_000);

  it("waits the time a 429 asks for with «Descargar la planilla» off, and the wait as its reason", async () => {
    setup({ file: () => HttpResponse.json({ title: "Too many requests", retryAfter: 30 }, { status: 429, headers: { "content-type": "application/problem+json" } }) });
    const user = userEvent.setup();
    renderRouteWithProviders(`/formularios/documentos/${receivedDocumentRowIds.overLimit}`);
    const frame = await panel();
    await user.click(await within(frame).findByRole("button", { name: "Descargar la planilla" }));
    const download = () => within(frame).getByRole("button", { name: "Descargar la planilla" });
    await waitFor(() => expect(download()).toHaveAccessibleDescription(/^Esperá \d+ segundos para volver a intentar\.$/));
    expect(download()).toHaveAttribute("aria-disabled", "true");
  }, 20_000);

  it.each([401, 403])("takes the inbox away when the spreadsheet answers %i, without the notice of a failure", async status => {
    setup({ file: () => HttpResponse.json({ title: "Denied" }, { status, headers: { "content-type": "application/problem+json" } }) });
    const user = userEvent.setup();
    renderRouteWithProviders(`/formularios/documentos/${receivedDocumentRowIds.overLimit}`);
    const frame = await panel();
    await user.click(await within(frame).findByRole("button", { name: "Descargar la planilla" }));
    expect(await screen.findByRole("heading", { name: "No tenés permiso" }, { timeout: 10_000 })).toBeInTheDocument();
    expect(vi.mocked(notify).mock.calls.some(([options]) => options.message === "No pudimos bajar la planilla.")).toBe(false);
  }, 20_000);

  it("abandons the download when the person leaves the row, and saves nothing", async () => {
    let release = () => {};
    const held = new Promise<void>(resolve => { release = resolve; });
    let signal: AbortSignal | undefined;
    setup({ file: async request => { signal = request.signal; await held; return spreadsheetFile(); } });
    const user = userEvent.setup();
    renderRouteWithProviders(`/formularios/documentos/${receivedDocumentRowIds.overLimit}`);
    const frame = await panel();
    await user.click(await within(frame).findByRole("button", { name: "Descargar la planilla" }));
    await waitFor(() => expect(signal).toBeDefined());
    await user.click(within(frame).getByRole("button", { name: "Cerrar" }));
    await waitFor(() => expect(screen.queryByRole("region", { name: "Documento" })).not.toBeInTheDocument());
    await waitFor(() => expect(signal?.aborted).toBe(true));
    release();
    await held;
    expect(URL.createObjectURL).not.toHaveBeenCalled();
    expect(vi.mocked(notify).mock.calls.some(([options]) => options.message === "No pudimos bajar la planilla.")).toBe(false);
  }, 20_000);

  it("keeps the actions of a row its person was sent in place, off, with the reason that names the row", async () => {
    setup();
    renderRouteWithProviders(`/formularios/documentos/${receivedDocumentRowIds.load}`);
    const frame = await panel();
    const pass = await within(frame).findByRole("button", { name: "Pasar al formulario" });
    const reason = "Le mandamos esta fila a Marta Ruiz. Si no la confirma hasta el 13/11/2026, 10:40, la podés revisar acá.";
    expect(pass).toHaveAttribute("aria-disabled", "true");
    expect(pass).toHaveAccessibleDescription(reason);
    expect(within(frame).getByRole("button", { name: "Descartar" })).toHaveAccessibleDescription(reason);
    expect(within(frame).getByText("Propuesto")).toBeInTheDocument();
  }, 20_000);

  it("tells the history of a row: it arrived, the AI recognized it and it was sent as one of the loads", async () => {
    setup();
    const user = userEvent.setup();
    renderRouteWithProviders(`/formularios/documentos/${receivedDocumentRowIds.load2}`);
    const frame = await panel();
    await user.click(await within(frame).findByRole("tab", { name: "Historial (2)" }));
    expect(await within(frame).findByText("Llegó y la IA la reconoció")).toBeInTheDocument();
    expect(within(frame).getByText("Se la mandó prellenada a Marta Ruiz, como 2 de 3.")).toBeInTheDocument();
    expect(within(frame).queryByText(/Leyó/)).not.toBeInTheDocument();
  }, 20_000);

  it("says a row fits no form, and a repeated one which row of its spreadsheet it is equal to", async () => {
    setup();
    renderRouteWithProviders(`/formularios/documentos/${receivedDocumentRowIds.unmatched}`);
    expect(await within(await panel()).findByText("No encaja en ningún formulario.")).toBeInTheDocument();
    queryClient.clear();
    renderRouteWithProviders(`/formularios/documentos/${receivedDocumentRowIds.repeated}`);
    expect(await screen.findByText("Repetida: igual a la fila 3 de «Ventas».", {}, { timeout: 10_000 })).toBeInTheDocument();
  }, 20_000);
});
