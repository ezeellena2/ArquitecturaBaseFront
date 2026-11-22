import { beforeAll, describe, expect, it } from "vitest";
import i18n from "@/shared/i18n";
import { formatTimeInZone } from "@/shared/lib/dateTime";
import { responseDetailFixture, responseWorkflowFixture } from "@/test/responseFixtures";
import type { ResponseDetail } from "./api/responses";
import type { ResponseAction, ResponseRecipient, ResponseWorkflow } from "./api/workflow";
import { workflowActivity, type ActivityBand, type ActivityRow } from "./workflowActivity";

const es = { t: i18n.getFixedT("es", "forms"), language: "es", timeZoneId: "UTC", canManage: true };
const en = { ...es, t: i18n.getFixedT("en", "forms"), language: "en" };
const id = (value: number) => "0199a0c0-0000-7000-8000-" + String(value).padStart(12, "0");
const at = (minute: string) => "2026-10-17T12:" + minute + ":00Z";
const ana = { userId: id(20), displayName: "Ana" };
function action(overrides: Partial<ResponseAction> = {}): ResponseAction {
  return { id: id(1), ruleId: id(2), kind: "NotifyAuthor", event: "Received", order: 0, revision: 1, state: "Completed", reasonCode: null, reason: null, canConsult: false, canRetry: false,
    recipients: [], createdAtUtc: at("00"), updatedAtUtc: at("01"), completedAtUtc: at("01"), ...overrides };
}
function recipient(name: string, overrides: Partial<ResponseRecipient> = {}): ResponseRecipient {
  return { user: { userId: id([...name].reduce((sum, letter) => sum + letter.charCodeAt(0), 0)), displayName: name }, channelId: "phone", state: "Accepted", reasonCode: null, reason: null, canReview: false, canRetry: false,
    deliveredAtUtc: null, readAtUtc: null, review: null, ...overrides };
}
const flow = (overrides: Partial<ResponseWorkflow> = {}): ResponseWorkflow => ({ ...responseWorkflowFixture(), ...overrides });
// One row, read as it is drawn: Fecha, Hora, Qué pasó, Quién, Canal, Detalle and Estado.
const cells = (row: ActivityRow) => [row.date, row.time, row.what, row.who, row.channel, row.detail, row.state];
const band = (bands: readonly ActivityBand[], title: string) => bands.find(item => item.title === title)!;
const row = (bands: readonly ActivityBand[], what: string) => bands.flatMap(item => item.rows).find(item => item.what === what)!;
beforeAll(async () => { await i18n.loadLanguages("en"); });

describe("the activity, row by row (VF2-A)", () => {
  it("reads one row per event of the response, each datum in its column and «—» where it does not apply", () => {
    const bands = workflowActivity(responseDetailFixture(), flow(), es);

    expect(bands.map(item => item.title)).toEqual(["Al recibirla"]);
    expect(bands[0].rows.map(cells)).toEqual([
      ["16/10/2026", "11:59", "Se mandó el formulario", "Ana", "WhatsApp", "—", "—"],
      ["16/10/2026", "12:00", "Se respondió el formulario", "Ana", "WhatsApp", "—", "—"],
      ["16/10/2026", "12:00", "Se guardó la respuesta", "—", "—", "—", "—"],
    ]);
    expect(bands[0].rows.map(item => item.atUtc)).toEqual(["2026-10-16T11:59:00Z", "2026-10-16T12:00:00Z", "2026-10-16T12:00:00Z"]);
    expect(bands[0].rows.every(item => item.tone === null && item.actions.length === 0)).toBe(true);
  });

  it("names the app as the channel of a response loaded in the app", () => {
    const record: ResponseDetail = { ...responseDetailFixture(), channel: "app", origin: null, history: [{ kind: "Submitted", atUtc: at("00"), actor: ana }] };

    expect(workflowActivity(record, flow(), es)[0].rows.map(cells)).toEqual([["17/10/2026", "12:00", "Se respondió el formulario", "Ana", "App", "—", "—"]]);
  });

  // W3 (UC2, UC3 and UC6): what the person shared says which questions it completed, in «Detalle»; the form that came back is the same
  // send and does not repeat who sent it. W1-A: the assistant asks for the location and sends the form.
  it("tells what the person shared in «Detalle» and who asked, sent or shared each thing", () => {
    const record: ResponseDetail = { ...responseDetailFixture(), origin: { ...responseDetailFixture().origin!, senderKind: "Assistant", senderUserId: null, senderName: null }, history: [
      { kind: "LocationRequested", atUtc: at("00"), actor: null }, { kind: "Sent", atUtc: at("01"), actor: null },
      { kind: "LocationReceived", atUtc: at("02"), actor: null, questions: ["Dónde estás"] }, { kind: "SentAgain", atUtc: at("02"), actor: ana },
      { kind: "ContactReceived", atUtc: at("03"), actor: null, questions: ["Recibió", "Teléfono"] }] };

    expect(workflowActivity(record, flow(), es)[0].rows.map(item => [item.what, item.who, item.channel, item.detail])).toEqual([
      ["Se pidió la ubicación", "El asistente", "WhatsApp", "—"], ["Se mandó el formulario", "El asistente", "WhatsApp", "—"],
      ["Llegó la ubicación", "Ana", "WhatsApp", "Completó «Dónde estás»"], ["Se volvió a mandar el formulario", "—", "WhatsApp", "—"],
      ["Llegó el contacto", "Ana", "WhatsApp", "Completó «Recibió» y «Teléfono»"]]);
  });

  it("starts a response that came from a row of a spreadsheet when its spreadsheet arrived (VC1-A)", () => {
    const record: ResponseDetail = { ...responseDetailFixture(), origin: { ...responseDetailFixture().origin!,
      document: { id: id(9), name: "cobranzas-semana.xlsx", row: { sheet: "Ventas", number: 5, receivedAtUtc: "2026-10-16T11:00:00Z" } } } };

    expect(cells(workflowActivity(record, flow(), es)[0].rows[0])).toEqual(["16/10/2026", "11:00", "Salió de una planilla", "—", "—", "cobranzas-semana.xlsx, fila 5 de «Ventas»", "—"]);
  });

  it("splits the approval into its request and its decision, with who decided and the state once", () => {
    const task: NonNullable<ResponseWorkflow["task"]> = { id: id(3), roleId: id(4), roleName: "Agrónomo", requestedAtUtc: at("02"), state: "Approved", revision: 2,
      decidedAtUtc: at("05"), decidedBy: { userId: id(9), displayName: "Marcos Gil" }, reason: null };
    const bands = workflowActivity(responseDetailFixture(), flow({ recordState: "Approved", task }), es);

    expect(bands.map(item => item.title)).toEqual(["Al recibirla", "Aprobación"]);
    expect(band(bands, "Aprobación").rows.map(cells)).toEqual([
      ["17/10/2026", "12:02", "Se pidió aprobación", "—", "—", "Rol Agrónomo", "—"],
      ["17/10/2026", "12:05", "Se aprobó", "Marcos Gil", "App", "—", "Aprobada"]]);
    expect(band(bands, "Aprobación").rows.map(item => item.tone)).toEqual([null, "success"]);
    const open = workflowActivity(responseDetailFixture(), flow({ recordState: "PendingApproval", task: { ...task, state: "Open", decidedAtUtc: null, decidedBy: null } }), es);
    expect(band(open, "Aprobación").rows.map(item => [item.what, item.state, item.tone])).toEqual([["Se pidió aprobación", "Por aprobar", "warning"]]);
  });

  it("keeps the whole reason of a rejection, a correction and a void in «Detalle»", () => {
    const reason = "Falta la dosis aplicada en el lote 4.\nRevisá la receta.";
    const task: NonNullable<ResponseWorkflow["task"]> = { id: id(3), roleId: id(4), roleName: null, requestedAtUtc: at("02"), state: "Rejected", revision: 2,
      decidedAtUtc: at("05"), decidedBy: { userId: id(9), displayName: "Marcos Gil" }, reason };
    const rejected = workflowActivity(responseDetailFixture(), flow({ recordState: "Rejected", task }), es);
    expect(cells(row(rejected, "Se rechazó"))).toEqual(["17/10/2026", "12:05", "Se rechazó", "Marcos Gil", "App", reason, "Rechazada"]);
    expect(row(rejected, "Se pidió aprobación").detail).toBe("Rol no disponible");

    const fixture = responseDetailFixture();
    const record: ResponseDetail = { ...fixture,
      correction: { previousRecordId: id(7), atUtc: "2026-10-16T12:00:00Z", by: ana, reason: "La cantidad era 3.", previousState: "Received", previousDecidedAtUtc: null, previousDecidedBy: null, previousPdfAtUtc: null },
      void: { atUtc: at("30"), by: { userId: id(9), displayName: "Luz" }, reason: "Se cargó dos veces." } };
    const bands = workflowActivity(record, flow({ recordState: "Voided" }), es);
    expect(bands.map(item => item.title)).toEqual(["Al recibirla", "Al anularla"]);
    expect(cells(row(bands, "Se corrigió " + fixture.number))).toEqual(["16/10/2026", "12:00", "Se corrigió " + fixture.number, "Ana", "App", "La cantidad era 3.", "—"]);
    expect(band(bands, "Al anularla").rows.map(cells)).toEqual([["17/10/2026", "12:30", "Se anuló " + fixture.number, "Luz", "App", "Se cargó dos veces.", "Anulada"]]);
  });

  it("makes each PDF a row with its file in «Detalle» and Ver PDF and Descargar, naming only the other language", () => {
    const pdf = action({ id: id(5), kind: "GeneratePdf", event: "Approved", completedAtUtc: at("06") });
    const documents: ResponseWorkflow["documents"] = [
      { id: id(12), runId: pdf.id, culture: "es", name: "Pedido de prueba-PED-000010.pdf", size: 10, createdAtUtc: at("06") },
      { id: id(13), runId: pdf.id, culture: "en", name: "Test order-PED-000010.pdf", size: 10, createdAtUtc: at("06") }];
    const workflow = flow({ recordState: "Approved", actions: [pdf], documents });
    const bands = workflowActivity(responseDetailFixture(), workflow, es);

    expect(band(bands, "Al aprobarla").rows.map(cells)).toEqual([
      ["17/10/2026", "12:06", "Se armó el PDF", "—", "—", "Pedido de prueba-PED-000010.pdf", "Hecho"],
      ["17/10/2026", "12:06", "Se armó el PDF en inglés", "—", "—", "Test order-PED-000010.pdf", "Hecho"]]);
    expect(band(bands, "Al aprobarla").rows.map(item => item.actions)).toEqual(documents.map(document => [{ kind: "document", document }]));
    // The time of the language, as the shared formatter writes it (English puts a narrow space before PM).
    const time = formatTimeInZone(at("06"), "en", "UTC");
    expect(time).toMatch(/^12:06\sPM$/);
    expect(band(workflowActivity(responseDetailFixture(), workflow, en), "On approval").rows.map(item => [item.date, item.time, item.what]))
      .toEqual([["10/17/2026", time, "PDF generated in Spanish"], ["10/17/2026", time, "PDF generated"]]);
  });

  it("keeps the row of an action whose result does not tell it, with its state, its reason and its recovery", () => {
    const failed = action({ kind: "GeneratePdf", state: "Failed", canRetry: true, completedAtUtc: null, reason: "No se pudo armar el PDF." });
    const bands = workflowActivity(responseDetailFixture(), flow({ actions: [failed] }), es);

    expect(cells(row(bands, "Armar el PDF"))).toEqual(["17/10/2026", "12:01", "Armar el PDF", "—", "—", "No se pudo armar el PDF.", "No se pudo"]);
    expect(row(bands, "Armar el PDF").tone).toBe("danger");
    expect(row(bands, "Armar el PDF").actions).toEqual([{ kind: "retry", action: failed }]);
    expect(row(workflowActivity(responseDetailFixture(), flow({ actions: [failed] }), { ...es, canManage: false }), "Armar el PDF").actions).toEqual([]);
    const issued = action({ id: id(6), kind: "IssueDocument" });
    expect(workflowActivity(responseDetailFixture(), flow({ actions: [issued] }), es)[0].rows.map(item => [item.what, item.state])).toContainEqual(["Emitir comprobante", "Hecho"]);
  });

  // RT1-A: each person of a notice is a row with the state of their send; the receipts of WhatsApp are that state.
  it("makes each person of a notice a row with their state, and Retry only on whoever did not get it", () => {
    const marcos = recipient("Marcos Gil", { deliveredAtUtc: at("02"), readAtUtc: at("03") });
    const juan = recipient("Juan Paz", { state: "Failed", reason: "No tiene el WhatsApp vinculado.", canRetry: true });
    const notice = action({ kind: "NotifyRole", recipients: [marcos, juan] });
    const author = recipient("Ana", { deliveredAtUtc: at("02") });
    const message = action({ id: id(6), order: 1, recipients: [author] });
    const rows = workflowActivity(responseDetailFixture(), flow({ actions: [notice, message] }), es)[0].rows.filter(item => item.key.startsWith("recipient:"));

    expect(rows.map(cells)).toEqual([
      ["17/10/2026", "12:01", "Se avisó", "Marcos Gil", "WhatsApp", "—", "Leído"],
      ["17/10/2026", "12:01", "Se avisó", "Juan Paz", "WhatsApp", "No tiene el WhatsApp vinculado.", "No se pudo enviar"],
      ["17/10/2026", "12:01", "Se le avisó a quien la cargó", "Ana", "WhatsApp", "—", "Entregado"]]);
    expect(rows.map(item => item.actions)).toEqual([[], [{ kind: "retryRecipient", action: notice, recipient: juan }], []]);
    expect(rows[1].tone).toBe("danger");
    expect(workflowActivity(responseDetailFixture(), flow({ actions: [notice, message] }), es)[0].rows.map(item => item.what)).not.toContain("Avisar a las personas con un rol");
  });

  it("keeps an unconfirmed notice with Consultar, Resolver envío on its person and the human review as a row of its own", () => {
    const beto = recipient("Beto", { state: "Uncertain", canReview: true });
    const luz = { userId: id(9), displayName: "Luz" };
    const ciro = recipient("Ciro", { review: { wasSent: false, reviewedAtUtc: at("09"), reviewedBy: luz } });
    const notice = action({ kind: "NotifyRole", state: "Uncertain", completedAtUtc: null, canConsult: true, recipients: [beto, ciro],
      lastRequest: { kind: "Consult", by: ana, atUtc: at("10") } });
    const rows = workflowActivity(responseDetailFixture(), flow({ actions: [notice] }), es)[0].rows.filter(item => item.key.includes(notice.id));

    expect(rows.map(cells)).toEqual([
      ["17/10/2026", "12:01", "Avisar a las personas con un rol", "—", "—", "—", "Sin confirmar"],
      ["17/10/2026", "12:01", "Se avisó", "Beto", "WhatsApp", "—", "Envío sin confirmar"],
      ["17/10/2026", "12:01", "Se avisó", "Ciro", "WhatsApp", "—", "Enviado"],
      ["17/10/2026", "12:09", "Se indicó que no salió", "Luz", "App", "—", "—"],
      ["17/10/2026", "12:10", "Se pidió consultar el estado", "Ana", "App", "—", "—"]]);
    expect(rows.map(item => item.actions)).toEqual([[{ kind: "consult", action: notice }], [{ kind: "review", action: notice, recipient: beto }], [], [], []]);
    expect(rows.map(item => item.whatHint)).toEqual([null, null, null, "Revisión humana: no confirma la entrega de WhatsApp.", null]);
    expect(new Set(rows.map(item => item.key)).size).toBe(rows.length);
  });

  it("orders the bands by moment, as separators, with the rows in the order they happened", () => {
    const task: NonNullable<ResponseWorkflow["task"]> = { id: id(3), roleId: id(4), roleName: "Admin", requestedAtUtc: at("02"), state: "Approved", revision: 2,
      decidedAtUtc: at("05"), decidedBy: ana, reason: null };
    const later = action({ id: id(6), event: "Received", order: 1, recipients: [recipient("Ana")], completedAtUtc: "2026-10-16T12:30:00Z", updatedAtUtc: "2026-10-16T12:30:00Z" });
    const early = action({ id: id(7), kind: "NotifyRole", event: "Received", recipients: [recipient("Beto")], completedAtUtc: "2026-10-16T11:30:00Z", updatedAtUtc: "2026-10-16T11:30:00Z" });
    const pdf = action({ id: id(5), kind: "GeneratePdf", event: "Approved", completedAtUtc: at("06") });
    const bands = workflowActivity(responseDetailFixture(), flow({ recordState: "Approved", task, actions: [later, early, action({ id: id(8), kind: "RequestApproval" }), pdf],
      documents: [{ id: id(12), runId: pdf.id, culture: "es", name: "Visita.pdf", size: 10, createdAtUtc: at("06") }] }), es);

    expect(bands.map(item => item.title)).toEqual(["Al recibirla", "Aprobación", "Al aprobarla"]);
    expect(band(bands, "Al recibirla").rows.map(item => item.what + " " + item.who)).toEqual(["Se avisó Beto", "Se mandó el formulario Ana", "Se respondió el formulario Ana",
      "Se guardó la respuesta —", "Se le avisó a quien la cargó Ana"]);
    expect(band(bands, "Al aprobarla").rows.map(item => item.what)).toEqual(["Se armó el PDF"]);
    expect(new Set(bands.flatMap(item => item.rows.map(entry => entry.key))).size).toBe(bands.flatMap(item => item.rows).length);
  });
});
