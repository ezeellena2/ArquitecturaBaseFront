import { act, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { delay, http, HttpResponse } from "msw";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { queryClient } from "@/shared/api/queryClient";
import { savePrivateBlob } from "@/shared/hooks/usePrivateFormFile";
import { notify } from "@/shared/ui/notifications";
import { currentUser } from "@/test/mocks/handlers";
import { server } from "@/test/mocks/server";
import { responseDetailFixture, responseFormId, responseRecordId, responseSheetFixture, responseWorkflowFixture } from "@/test/responseFixtures";
import { renderRouteWithProviders } from "@/test/utils/renderWithProviders";
import type { ResponseDetail } from "../api/responses";
import type { ResponseAction, ResponseWorkflow } from "../api/workflow";

vi.mock("react-oidc-context", async () => ({ ...await vi.importActual<typeof import("react-oidc-context")>("react-oidc-context"),
  useAuth: () => ({ isAuthenticated: true, isLoading: false, user: { access_token: "test" } }) }));
vi.mock("@/shared/ui/notifications", async () => ({ ...await vi.importActual<typeof import("@/shared/ui/notifications")>("@/shared/ui/notifications"), notify: vi.fn() }));
vi.mock("@/shared/hooks/usePrivateFormFile", async () => ({ ...await vi.importActual<typeof import("@/shared/hooks/usePrivateFormFile")>("@/shared/hooks/usePrivateFormFile"), savePrivateBlob: vi.fn() }));

// Synthetic behavior DTOs for the zone «Comprobante» (EM1-A), its review and void (NC1-A) and «Esperando que lo confirmes» (EM2-A).
const id = (value: number) => "0199a0c0-0000-7000-8000-" + String(value).padStart(12, "0");
const sheet = "/formularios/" + responseFormId + "/respuestas";
const issueRun = id(801), reversalRun = id(802);
const action = (changes: Partial<ResponseAction>): ResponseAction => ({
  id: issueRun, ruleId: id(800), kind: "IssueDocument", event: "Received", order: 0, revision: 3, state: "Completed", reasonCode: null, reason: null,
  canConsult: false, canRetry: false, recipients: [], createdAtUtc: "2026-11-09T12:00:00Z", updatedAtUtc: "2026-11-09T12:01:00Z", completedAtUtc: "2026-11-09T12:01:00Z", ...changes,
});
const invoice = { source: "arca.invoice", name: "Comprobante de ARCA", recordedAtUtc: "2026-11-09T12:01:00Z", values: [
  { key: "voucher", label: "Comprobante", kind: "text" as const, value: "Factura C" },
  { key: "number", label: "Número", kind: "text" as const, value: "00004-00000012" },
  { key: "cae", label: "CAE", kind: "text" as const, value: "75123456789012" },
  { key: "caeDueOn", label: "Vence el CAE", kind: "date" as const, value: "2026-11-19" },
  { key: "total", label: "Total", kind: "number" as const, value: "605500" },
] };
const fiscalPdf = { id: id(803), runId: issueRun, culture: "es" as const, name: "Factura C 00004-00000012.pdf", size: 2048, createdAtUtc: "2026-11-09T12:01:00Z" };

function setup(detail: Partial<ResponseDetail>, workflow: Partial<ResponseWorkflow>, permissions = ["formrecords.read", "formrecords.create"]) {
  const posts: { path: string; body: unknown }[] = [];
  const flow = { current: { ...responseWorkflowFixture(responseRecordId), ...workflow } as ResponseWorkflow };
  const record = { current: { ...responseDetailFixture(responseRecordId), ...detail } as ResponseDetail };
  const answer = (path: string, next?: Partial<ResponseWorkflow>) => async ({ request }: { request: Request }) => {
    posts.push({ path, body: await request.json() });
    if (next) flow.current = { ...flow.current, ...next };
    return HttpResponse.json(flow.current, { status: 202 });
  };
  server.use(
    http.get("/api/me", () => HttpResponse.json({ ...currentUser, permissions })),
    http.post("/api/forms/definitions/:id/records/search", () => HttpResponse.json(responseSheetFixture())),
    http.post("/api/forms/definitions/:id/records/:recordId/navigation", ({ params }) => HttpResponse.json({ recordId: params.recordId, previousId: null, nextId: null, position: 1, totalCount: 2 })),
    http.get("/api/forms/records/:id", () => HttpResponse.json(record.current)),
    http.get("/api/forms/records/:id/workflow", () => HttpResponse.json(flow.current)),
    http.post("/api/forms/records/:id/actions/:runId/confirmation", ({ request, params }) => answer("confirmation:" + String(params.runId), { actions: [action({ state: "Running", completedAtUtc: null })], confirmation: undefined })({ request })),
    http.post("/api/forms/records/:id/actions/:runId/review", ({ request, params }) => answer("review:" + String(params.runId), { actions: [action({ state: "Running", completedAtUtc: null })] })({ request })),
    http.post("/api/forms/definitions/:formId/records/:recordId/void", async ({ request }) => {
      posts.push({ path: "void", body: await request.json() });
      flow.current = { ...flow.current, actions: [...flow.current.actions, action({ id: reversalRun, event: "Voided", state: "Waiting", completedAtUtc: null })] };
      return new HttpResponse(null, { status: 204 });
    }),
    http.get("/api/forms/records/:recordId/documents/:documentId/content", () => new HttpResponse(new Uint8Array([37, 80, 68, 70]),
      { headers: { "content-type": "application/pdf", "content-language": "es", "content-disposition": "attachment; filename=\"Factura C 00004-00000012.pdf\"" } })),
  );
  return { posts, flow, record };
}
// The first test pays the lazy route: under load its first reading takes longer than the default second.
const zone = () => screen.findByRole("region", { name: "Comprobante" }, { timeout: 10_000 });

beforeEach(() => { queryClient.clear(); vi.mocked(notify).mockClear(); vi.mocked(savePrivateBlob).mockClear(); });

describe("the zone «Comprobante» (EM1-A)", () => {
  it("shows what was issued first, offers «PDF fiscal» before ⋮ and, in ⋮, voids it with a credit note", { timeout: 20_000 }, async () => {
    setup({ canAmend: true, results: [invoice] }, { actions: [action({})], documents: [fiscalPdf] });
    const user = userEvent.setup({ delay: null });
    renderRouteWithProviders(sheet + "/" + responseRecordId);
    const issued = within(await zone()).getByRole("group", { name: "Comprobante de ARCA" });
    expect(within(issued).getByText("00004-00000012")).toBeInTheDocument();
    expect(within(issued).getByText("19/11/2026")).toBeInTheDocument();

    // VF1-A: «Corregir» is in view, off with why; ⋮ keeps «Anular con nota de crédito».
    const correct = screen.getByRole("button", { name: "Corregir" });
    expect(correct).toHaveAttribute("aria-disabled", "true");
    expect(correct).toHaveAccessibleDescription("Tiene un comprobante emitido o en curso: anulala y cargá otra.");
    await user.click(screen.getByRole("button", { name: "Más acciones" }));
    const menu = await screen.findByRole("menu");
    expect(within(menu).getAllByRole("menuitem").map(item => item.textContent)).toEqual(["Anular con nota de crédito"]);
    await user.keyboard("{Escape}");

    // «PDF fiscal» is an icon before ⋮ and «Descargar ▾» keeps only the other copies: here there are none.
    const pdf = screen.getByRole("button", { name: "PDF fiscal" });
    expect(pdf.compareDocumentPosition(screen.getByRole("button", { name: "Más acciones" })) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Descargar" })).not.toBeInTheDocument();
    await user.click(pdf);
    await waitFor(() => expect(savePrivateBlob).toHaveBeenCalledWith(expect.anything(), "Factura C 00004-00000012.pdf"));
  });

  it("says the issuance is being issued while it runs, without data nor actions", async () => {
    setup({}, { actions: [action({ state: "Running", completedAtUtc: null })] });
    renderRouteWithProviders(sheet + "/" + responseRecordId);
    expect(within(await zone()).getByRole("status")).toHaveTextContent("Se está emitiendo el comprobante. La página se actualiza sola.");
    expect(within(await zone()).queryByRole("button")).not.toBeInTheDocument();
  });

  it("says what the issuer refused, with its code when the server has no text for it, and that correcting sends it again", async () => {
    setup({}, { actions: [action({ state: "Failed", reasonCode: "wsfe.10015", reason: "wsfe.10015", completedAtUtc: null })] });
    renderRouteWithProviders(sheet + "/" + responseRecordId);
    expect(within(await zone()).getByRole("alert")).toHaveTextContent("No se emitió el comprobante · wsfe.10015 No se emitió nada. Corregí la respuesta y el comprobante sale con la corrección.");
  });

  // The text of the rejection is the issuer's, as the server sends it: its code and its message, never the raw code alone.
  it("says the issuer's text of a rejection, not its raw code", async () => {
    setup({}, { actions: [action({ state: "Failed", reasonCode: "wsfe.10015", reason: "10015 · El número de documento del receptor no es válido.", completedAtUtc: null })] });
    renderRouteWithProviders(sheet + "/" + responseRecordId);
    expect(within(await zone()).getByRole("alert")).toHaveTextContent(
      "No se emitió el comprobante · 10015 · El número de documento del receptor no es válido. No se emitió nada. Corregí la respuesta y el comprobante sale con la corrección.");
    expect(within(await zone()).queryByText(/wsfe\./)).not.toBeInTheDocument();
  });

  it("says the issuer's text of a credit note that did not go out", async () => {
    setup({ results: [invoice] }, { actions: [action({}), action({ id: reversalRun, event: "Voided", state: "Failed", reasonCode: "wsfe.10016", reason: "10016 · El número de comprobante no es correlativo.", completedAtUtc: null })] });
    renderRouteWithProviders(sheet + "/" + responseRecordId);
    expect(within(await zone()).getByRole("alert")).toHaveTextContent(/^No se pudo anular · 10016 · El número de comprobante no es correlativo\.$/);
  });

  // «En cola» (falla 7): while the issuer does not answer, a yellow notice with its reason, when it tries again and how many
  // times it tried, instead of «Se está emitiendo…».
  it("says when an issuance the issuer did not answer tries again and how many times it tried", async () => {
    // The reason of the wait asks to try again later; here the system tries again by itself, so the title is the zone's own.
    setup({}, { actions: [action({ state: "Running", completedAtUtc: null, reasonCode: "Arca.Connection.Unavailable", reason: "ARCA no respondió. Probá de nuevo en unos minutos.",
      nextAttemptAtUtc: "2026-01-02T13:45:00Z", attempts: 3 })] });
    renderRouteWithProviders(sheet + "/" + responseRecordId);
    expect(within(await zone()).getByRole("status")).toHaveTextContent(/^Todavía no se pudo emitir · Volvemos a probar el 02\/01\/2026 a las 10:45\. Ya probamos 3 veces\.$/);
    expect(within(await zone()).queryByText(/Se está emitiendo|Probá de nuevo/)).not.toBeInTheDocument();
  });

  it("says it is being issued when it keeps a next attempt without tries, as an authorized one while its PDF is made", async () => {
    setup({}, { actions: [action({ state: "Running", completedAtUtc: null, nextAttemptAtUtc: "2026-01-02T13:45:00Z" })] });
    renderRouteWithProviders(sheet + "/" + responseRecordId);
    expect(within(await zone()).getByRole("status")).toHaveTextContent("Se está emitiendo el comprobante. La página se actualiza sola.");
  });
});

describe("the place of the zone while the flow is read (5.2)", () => {
  // The flow is read apart from the detail: a response with an issuance keeps the zone's place, so nothing jumps when it arrives.
  it("keeps the zone's place for a response with an issuance until the flow arrives", async () => {
    setup({ hasIssuance: true, results: undefined }, { actions: [action({ state: "Running", completedAtUtc: null })] });
    server.use(http.get("/api/forms/records/:id/workflow", async () => { await delay("infinite"); return HttpResponse.json({}); }));
    renderRouteWithProviders(sheet + "/" + responseRecordId);
    const section = await zone();
    expect(section.querySelector("[data-slot=skeleton]")).not.toBeNull();
    expect(within(section).queryByRole("status")).not.toBeInTheDocument();
  });

  it("draws no zone while the flow is read for a response without an issuance", async () => {
    setup({ results: undefined }, { actions: [] });
    server.use(http.get("/api/forms/records/:id/workflow", async () => { await delay("infinite"); return HttpResponse.json({}); }));
    renderRouteWithProviders(sheet + "/" + responseRecordId);
    expect(await screen.findByRole("region", { name: "Detalle de la respuesta" }, { timeout: 10_000 })).toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "Comprobante" })).not.toBeInTheDocument();
  });
});

describe("an issuance in review (NC1-A)", () => {
  // The texts of the review are the issuer's (`review`): the feature has none of its own (4.8).
  const review = action({ state: "Uncertain", reasonCode: "arca.invoice.numberTaken", reason: "arca.invoice.numberTaken", completedAtUtc: null, review: {
    title: { es: "El número ya figura en ARCA con otros datos", en: "The number is already in ARCA with other data" },
    detail: { es: "Puede haber otro sistema usando el mismo punto de venta.", en: "Another system may be using the same point of sale." },
    proceed: { es: "Emitir con el número siguiente", en: "Issue with the next number" },
    advice: { es: "Antes de decidir, mirá «Mis comprobantes» en ARCA.", en: "Before deciding, check “Mis comprobantes” in ARCA." },
  } });

  it("says why with the text tied to its code and decides it with «Revisar», without a person", { timeout: 20_000 }, async () => {
    const { posts } = setup({}, { actions: [{ ...review, canReview: true }] });
    const user = userEvent.setup({ delay: null });
    renderRouteWithProviders(sheet + "/" + responseRecordId);
    const section = await zone();
    expect(within(section).getByRole("status")).toHaveTextContent("El número ya figura en ARCA con otros datos · Puede haber otro sistema usando el mismo punto de venta.");
    await user.click(within(section).getByRole("button", { name: "Revisar" }));
    const dialog = await screen.findByRole("dialog", { name: "Revisar la emisión de TEST-000002" });
    expect(within(dialog).getByText("Antes de decidir, mirá «Mis comprobantes» en ARCA.")).toBeInTheDocument();
    // «Qué hacer con la emisión» is the only piece to choose (2026-11-22); going on comes chosen.
    expect(within(dialog).getByRole("button", { name: "Qué hacer con la emisión Emitir con el número siguiente" })).toBeInTheDocument();
    await user.click(within(dialog).getByRole("button", { name: "Confirmar" }));
    await waitFor(() => expect(posts).toEqual([{ path: "review:" + issueRun, body: { expectedRevision: 3, wasSent: true } }]));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(notify).toHaveBeenCalledWith(expect.objectContaining({ kind: "info", message: "Se sigue con la emisión de TEST-000002." }));
  });

  // Falla 8: «No emitir» in the review voids the response, without a document, once the server processes it.
  it("says that «No emitir» voids the response and decides it without a person", { timeout: 20_000 }, async () => {
    const { posts } = setup({}, { actions: [{ ...review, canReview: true }] });
    const user = userEvent.setup({ delay: null });
    renderRouteWithProviders(sheet + "/" + responseRecordId);
    await user.click(within(await zone()).getByRole("button", { name: "Revisar" }));
    const dialog = await screen.findByRole("dialog", { name: "Revisar la emisión de TEST-000002" });
    const choice = within(dialog).getByRole("button", { name: "Qué hacer con la emisión Emitir con el número siguiente" });
    await act(async () => { choice.focus(); });
    await user.keyboard("{Enter}");
    const stop = within(await screen.findByRole("listbox", { name: "Qué hacer con la emisión" })).getByRole("option", { name: "No emitir" });
    expect(stop).toHaveAccessibleDescription("La respuesta queda anulada, sin comprobante.");
    await user.click(stop);
    expect(choice).toHaveAccessibleName("Qué hacer con la emisión No emitir");
    await user.click(within(dialog).getByRole("button", { name: "Confirmar" }));
    await waitFor(() => expect(posts).toEqual([{ path: "review:" + issueRun, body: { expectedRevision: 3, wasSent: false } }]));
    await waitFor(() => expect(notify).toHaveBeenCalledWith(expect.objectContaining({ kind: "success", message: "TEST-000002 se anula, sin comprobante." })));
  });

  it("tells who cannot decide that someone else resolves it, without «Revisar»", async () => {
    setup({}, { actions: [review] });
    renderRouteWithProviders(sheet + "/" + responseRecordId);
    const section = await zone();
    expect(within(section).getByRole("status")).toHaveTextContent("Lo resuelve alguien que puede emitir comprobantes.");
    expect(within(section).queryByRole("button", { name: "Revisar" })).not.toBeInTheDocument();
  });
});

describe("«Esperando que lo confirmes» (EM2-A)", () => {
  const waiting = action({ state: "Uncertain", reasonCode: "Forms.Action.AwaitingConfirmation", reason: "La emisión espera que la confirme quien cargó la respuesta.", completedAtUtc: null });
  const confirmation = { runId: issueRun, document: { es: "Factura A", en: "Invoice A" }, receiver: "Agro del Sur S.A.", total: "605000",
    info: { es: "Lo decide el sistema: sos responsable inscripto y tu cliente también.", en: "The system decides it." }, date: "2026-11-09",
    amounts: [{ label: { es: "Importe neto gravado", en: "Net taxed amount" }, value: "500000" }, { label: { es: "IVA 21%", en: "VAT 21%" }, value: "105000" }] };

  it("shows what «¿La emito?» said to whoever loaded it and issues it with «Emitir»", { timeout: 20_000 }, async () => {
    const { posts } = setup({}, { actions: [waiting], confirmation });
    const user = userEvent.setup({ delay: null });
    renderRouteWithProviders(sheet + "/" + responseRecordId);
    const section = await zone();
    const summary = within(section).getByRole("group", { name: "Esperando que lo confirmes" });
    for (const text of ["Factura A", "Agro del Sur S.A.", "09/11/2026", "Importe neto gravado", "$ 500.000", "IVA 21%", "$ 105.000", "$ 605.000"]) expect(within(summary).getByText(text)).toBeInTheDocument();
    expect(within(summary).getByRole("button", { name: "Por qué este comprobante" })).toBeInTheDocument();
    await user.click(within(section).getByRole("button", { name: "Emitir" }));
    await waitFor(() => expect(posts).toEqual([{ path: "confirmation:" + issueRun, body: { issue: true } }]));
    expect(await within(await zone()).findByText("Se está emitiendo el comprobante. La página se actualiza sola.")).toBeInTheDocument();
    expect(notify).toHaveBeenCalledWith(expect.objectContaining({ kind: "info", message: "Se está emitiendo el comprobante de TEST-000002." }));
  });

  it("asks before «No emitir», which voids it without issuing", { timeout: 20_000 }, async () => {
    const { posts } = setup({}, { actions: [waiting], confirmation });
    const user = userEvent.setup({ delay: null });
    renderRouteWithProviders(sheet + "/" + responseRecordId);
    await user.click(within(await zone()).getByRole("button", { name: "No emitir" }));
    const dialog = await screen.findByRole("alertdialog", { name: "¿No emitir TEST-000002?" }).catch(() => screen.findByRole("dialog", { name: "¿No emitir TEST-000002?" }));
    expect(within(dialog).getByText("TEST-000002 queda anulada, sin comprobante.")).toBeInTheDocument();
    await user.click(within(dialog).getByRole("button", { name: "No emitir" }));
    await waitFor(() => expect(posts).toEqual([{ path: "confirmation:" + issueRun, body: { issue: false } }]));
    await waitFor(() => expect(notify).toHaveBeenCalledWith(expect.objectContaining({ kind: "success", message: "TEST-000002 quedó anulada, sin comprobante." })));
  });

  // Decision 4 (falla 6): the summary could not be made; it says why and offers «Volver a probar» instead of «Emitir».
  it("says why a summary could not be made and tries again with «Volver a probar»", { timeout: 20_000 }, async () => {
    const failed = { runId: issueRun, document: null, receiver: null, total: null, failureCode: "Arca.Registry.PersonNotFound", failureMessage: "ARCA no tiene datos de esa CUIT en el padrón." };
    const { posts } = setup({}, { actions: [waiting], confirmation: failed });
    const user = userEvent.setup({ delay: null });
    renderRouteWithProviders(sheet + "/" + responseRecordId);
    const section = await zone();
    expect(within(section).getByRole("status")).toHaveTextContent("Todavía no se puede emitir · ARCA no tiene datos de esa CUIT en el padrón.");
    expect(within(section).queryByRole("group", { name: "Esperando que lo confirmes" })).not.toBeInTheDocument();
    expect(within(section).queryByRole("button", { name: "Emitir" })).not.toBeInTheDocument();
    expect(within(section).getByRole("button", { name: "No emitir" })).toBeInTheDocument();
    await user.click(within(section).getByRole("button", { name: "Volver a probar" }));
    await waitFor(() => expect(posts).toEqual([{ path: "confirmation:" + issueRun, body: { issue: true, retry: true } }]));
    expect(await within(await zone()).findByText("Se está emitiendo el comprobante. La página se actualiza sola.")).toBeInTheDocument();
    expect(notify).toHaveBeenCalledWith(expect.objectContaining({ kind: "info", message: "Volvemos a probar la emisión de TEST-000002." }));
  });

  it("tells anyone else that it waits for whoever loaded it, without deciding", async () => {
    setup({}, { actions: [waiting] });
    renderRouteWithProviders(sheet + "/" + responseRecordId);
    const section = await zone();
    expect(within(section).getByText("Espera que lo confirme quien la cargó.")).toBeInTheDocument();
    expect(within(section).queryByRole("button")).not.toBeInTheDocument();
  });
});

describe("voiding with a credit note (NC1-A)", () => {
  it("asks for the reason, says it is being voided and keeps the detail with «Anulándose»", { timeout: 25_000 }, async () => {
    const { posts } = setup({ canAmend: true, results: [invoice] }, { actions: [action({})], documents: [fiscalPdf] });
    const user = userEvent.setup({ delay: null });
    const { router } = renderRouteWithProviders(sheet + "/" + responseRecordId);
    await zone();
    await user.click(screen.getByRole("button", { name: "Más acciones" }));
    await user.click(await screen.findByRole("menuitem", { name: "Anular con nota de crédito" }));
    const dialog = await screen.findByRole("dialog", { name: "¿Anular TEST-000002?" });
    expect(within(dialog).getByText("Se emite una nota de crédito por el total del comprobante de TEST-000002, que lo anula. No se puede deshacer.")).toBeInTheDocument();
    await user.type(within(dialog).getByLabelText(/^Motivo/), "Cliente equivocado.");
    await user.click(within(dialog).getByRole("button", { name: "Anular con nota de crédito" }));
    await waitFor(() => expect(posts).toEqual([{ path: "void", body: { reason: "Cliente equivocado." } }]));
    await waitFor(() => expect(notify).toHaveBeenCalledWith(expect.objectContaining({ kind: "info", message: "Se está emitiendo la nota de crédito de TEST-000002." })));
    expect(await screen.findByText("Anulándose")).toBeInTheDocument();
    expect(within(await zone()).getByRole("status")).toHaveTextContent("Se está emitiendo la nota de crédito. La página se actualiza sola.");
    expect(router.state.location.pathname).toBe(sheet + "/" + responseRecordId);

    // Back from the dialog the focus is on ⋮ again: the keyboard opens it.
    const more = screen.getByRole("button", { name: "Más acciones" });
    act(() => more.focus());
    await user.keyboard("{Enter}");
    const items = within(await screen.findByRole("menu")).getAllByRole("menuitem");
    expect(items.map(item => item.textContent)).toEqual(["Anular con nota de créditoLa respuesta se está anulando."]);
    expect(items[0]).toHaveAttribute("aria-disabled", "true");
    await user.keyboard("{Escape}");
    expect(screen.getByRole("button", { name: "Corregir" })).toHaveAccessibleDescription("La respuesta se está anulando.");
  });

  it("keeps the invoice issued with the notice of a credit note that did not go out", async () => {
    setup({ canAmend: true, results: [invoice] }, { actions: [action({}), action({ id: reversalRun, event: "Voided", state: "Failed", reasonCode: "wsfe.10016", reason: "wsfe.10016", completedAtUtc: null })] });
    renderRouteWithProviders(sheet + "/" + responseRecordId);
    const section = await zone();
    expect(within(section).getByRole("alert")).toHaveTextContent("No se pudo anular · wsfe.10016");
    expect(within(section).getByRole("group", { name: "Comprobante de ARCA" })).toBeInTheDocument();
    expect(screen.queryByText("Anulándose")).not.toBeInTheDocument();
  });

  it("shows the invoice and its credit note once voided, and «PDF fiscal» offers both", { timeout: 20_000 }, async () => {
    const creditNote = { ...invoice, recordedAtUtc: "2026-11-10T12:00:00Z", values: invoice.values.map(value => value.key === "voucher" ? { ...value, value: "Nota de crédito C" } : value) };
    setup({ results: [invoice, creditNote], void: { atUtc: "2026-11-10T12:00:00Z", by: { userId: id(377), displayName: "Juan Gómez" }, reason: "Cliente equivocado." } },
      { recordState: "Voided", actions: [action({}), action({ id: reversalRun, event: "Voided" })],
        documents: [fiscalPdf, { ...fiscalPdf, id: id(804), runId: reversalRun, name: "Nota de crédito C 00004-00000003.pdf" }] });
    const user = userEvent.setup({ delay: null });
    renderRouteWithProviders(sheet + "/" + responseRecordId);
    const groups = within(await zone()).getAllByRole("group", { name: "Comprobante de ARCA" });
    expect(groups.map(group => within(group).getAllByRole("definition")[0].textContent)).toEqual(["Factura C", "Nota de crédito C"]);
    expect(screen.getAllByText("Anulada").length).toBeGreaterThan(0);
    await user.click(screen.getByRole("button", { name: "PDF fiscal" }));
    const menu = await screen.findByRole("menu");
    expect(within(menu).getAllByRole("menuitem").map(item => item.textContent)).toEqual(["Factura C 00004-00000012.pdf", "Nota de crédito C 00004-00000003.pdf"]);
  });
});
