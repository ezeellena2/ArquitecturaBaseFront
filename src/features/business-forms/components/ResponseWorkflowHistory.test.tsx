import { act, screen, within, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useQueryClient } from "@tanstack/react-query";
import { MemoryRouter } from "react-router";
import { http, HttpResponse } from "msw";
import { it, expect, vi } from "vitest";
import i18n from "@/shared/i18n";
import { currentUser } from "@/test/mocks/handlers";
import { server } from "@/test/mocks/server";
import { renderWithProviders } from "@/test/utils/renderWithProviders";
import { responseDetailFixture, responseFormId, responseRecordId, responseWorkflowFixture } from "@/test/responseFixtures";
import type { ReactNode } from "react";
import type { ResponseAction, ResponseWorkflow } from "../api/workflow";
import type { ResponseDetail } from "../api/responses";
import { useResponseWorkflow } from "../hooks/useResponseWorkflow";
import { ResponseAssistance } from "./ResponseAssistance";
import { ResponseWorkflowHistory } from "./ResponseWorkflowHistory";

vi.mock("react-oidc-context", async () => ({ ...(await vi.importActual<typeof import("react-oidc-context")>("react-oidc-context")),
  useAuth: () => ({ isAuthenticated: true, isLoading: false, user: { access_token: "test" } }) }));
const id = (value: number) => "0199a0c0-0000-7000-8000-" + String(value).padStart(12, "0");
const instant = (second: string) => "2026-10-17T12:00:" + second + "Z";
function action(overrides: Partial<ResponseAction> = {}): ResponseAction {
  return { id: id(1), ruleId: id(2), kind: "NotifyAuthor", event: "Received", order: 0, revision: 1, state: "Completed", reasonCode: null, reason: null, canConsult: false, canRetry: false, recipients: [], createdAtUtc: instant("00"), updatedAtUtc: instant("01"), completedAtUtc: instant("01"), ...overrides };
}
type IssuedDocument = ResponseWorkflow["documents"][number];
function ActivityHarness({ documentActions }: { documentActions?: (document: IssuedDocument) => ReactNode }) {
  const workflow = useResponseWorkflow(responseFormId, responseRecordId);
  return <ResponseWorkflowHistory record={responseDetailFixture()} workflow={workflow} timeZoneId="UTC" documentActions={documentActions} />;
}
function showActivity(workflow: ResponseWorkflow, documentActions?: (document: IssuedDocument) => ReactNode) {
  server.use(http.get("/api/me", () => HttpResponse.json({ ...currentUser, permissions: ["formrecords.read", "formrules.manage"] })),
    http.get("/api/forms/records/:id/workflow", () => HttpResponse.json(workflow)));
  return renderWithProviders(<ActivityHarness documentActions={documentActions} />);
}
// The response is there before its workflow: the rows of its actions arrive with it, in the same band.
async function receivedBand() {
  const band = await screen.findByRole("listitem", { name: "Al recibirla" });
  await waitFor(() => expect(band.querySelector('li[tabindex="-1"]')).not.toBeNull());
  return band;
}
const bandNames = () => screen.getAllByRole("listitem").map(item => item.getAttribute("aria-label")).filter(name => name !== null && !name.startsWith("Destinatario"));

it("groups request evidence once with its real task time and preserves receiving effects", async () => {
  const task: NonNullable<ResponseWorkflow["task"]> = { id: id(3), roleId: id(4), roleName: "Supervisión", requestedAtUtc: instant("03"), state: "Open", revision: 1, decidedAtUtc: null, decidedBy: null, reason: null };
  const workflow: ResponseWorkflow = { ...responseWorkflowFixture(), recordState: "PendingApproval", task,
    actions: [action(), action({ id: id(5), kind: "RequestApproval", order: 1 })] };
  showActivity(workflow);
  const received = await screen.findByRole("listitem", { name: "Al recibirla" });
  expect(within(received).getByText("Se respondió el formulario")).toBeInTheDocument();
  expect(await within(received).findByText("Mandarle un mensaje a quien la cargó")).toBeInTheDocument();
  expect(bandNames()).toEqual(["Al recibirla", "Aprobación"]);
  const approval = screen.getByRole("listitem", { name: "Aprobación" });
  expect(approval.querySelector('time[datetime="' + instant("03") + '"]')).toBeInTheDocument();
  expect(within(approval).getByText("Se pidió aprobación")).toBeInTheDocument();
  expect(within(approval).getByText("Rol Supervisión")).toBeInTheDocument();
  expect(within(approval).getByText("Por aprobar")).toBeInTheDocument();
  expect(screen.queryByText("Pedir aprobación a una persona con un rol")).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Aprobar" })).not.toBeInTheDocument();
});

it("keeps a failed approval request visible inside the receiving moment without a pending task", async () => {
  showActivity({ ...responseWorkflowFixture(), actions: [action({ kind: "RequestApproval", state: "Failed", reasonCode: "Forms.Rule.RoleUnavailable", reason: "El rol ya no está disponible." })] });
  const effects = await receivedBand();
  expect(within(effects).getByText("Pedir aprobación a una persona con un rol")).toBeInTheDocument();
  expect(within(effects).getByText("El rol ya no está disponible.")).toBeInTheDocument();
  expect(within(effects).getByText("No se pudo")).toBeInTheDocument();
  expect(screen.queryByRole("listitem", { name: "Aprobación" })).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Reintentar" })).not.toBeInTheDocument();
});

it("preserves delivery, human review and recovery controls inside an effect moment", async () => {
  const user = userEvent.setup();
  showActivity({ ...responseWorkflowFixture(), actions: [action({ kind: "NotifyRole", state: "Uncertain", completedAtUtc: null, canConsult: true,
    recipients: [{ user: { userId: id(8), displayName: "Ana" }, channelId: "whatsapp", state: "Accepted", reasonCode: null, reason: null, canReview: false, canRetry: false,
      deliveredAtUtc: instant("05"), readAtUtc: instant("06"), review: { wasSent: false, reviewedAtUtc: instant("04"), reviewedBy: { userId: id(9), displayName: "Luz" } } },
      { user: { userId: id(10), displayName: "Beto" }, channelId: "whatsapp", state: "Uncertain", reasonCode: null, reason: null, canReview: true, canRetry: false, deliveredAtUtc: null, readAtUtc: null, review: null },
      { user: { userId: id(11), displayName: "Ciro" }, channelId: "whatsapp", state: "Accepted", reasonCode: null, reason: null, canReview: false, canRetry: false, deliveredAtUtc: instant("05"), readAtUtc: null, review: null }] })] });
  const effects = await receivedBand();
  expect(within(effects).getByText("3 personas")).toBeInTheDocument();
  const ana = within(within(effects).getByRole("listitem", { name: "Destinatario: Ana" }));
  expect(ana.getByText("Enviado")).toBeInTheDocument();
  expect(ana.getByText("Leído")).toBeInTheDocument();
  expect(ana.getByText("Luz indicó que no salió.")).toBeInTheDocument();
  expect(within(within(effects).getByRole("listitem", { name: "Destinatario: Ciro" })).getByText("Entregado")).toBeInTheDocument();
  const beto = within(within(effects).getByRole("listitem", { name: "Destinatario: Beto" }));
  expect(beto.getByText("Envío sin confirmar")).toBeInTheDocument();
  expect(beto.getByRole("button", { name: "Resolver envío" })).toBeEnabled();
  expect(within(effects).getByRole("button", { name: "Consultar" })).toBeEnabled();
  await user.click(within(effects).getByRole("button", { name: "Resolver envío" }));
  const dialog = screen.getByRole("dialog", { name: "Resolver el envío" });
  await user.click(within(dialog).getByRole("button", { name: "Cancelar" }));
  await waitFor(() => expect(within(effects).getByRole("button", { name: "Resolver envío" })).toHaveFocus());
});

// The wait of a 429 is not written under the history nor in the dialog: it is the reason of each disabled action.
it("explains the action wait as the reason of the recovery buttons and of the review confirmation", async () => {
  const user = userEvent.setup();
  const wait = /^Esperá [0-9]+ segundos para volver a intentar\.$/;
  showActivity({ ...responseWorkflowFixture(), actions: [action({ kind: "NotifyRole", state: "Uncertain", completedAtUtc: null, canConsult: true,
    recipients: [{ user: { userId: id(10), displayName: "Beto" }, channelId: "whatsapp", state: "Uncertain", reasonCode: null, reason: null, canReview: true, canRetry: false, deliveredAtUtc: null, readAtUtc: null, review: null }] })] });
  server.use(http.post("/api/forms/records/:id/actions/:runId/review", () => HttpResponse.json({ code: "RateLimit.Exceeded", detail: "Esperá antes de resolver.", retryAfter: 30 }, { status: 429 })));
  const effects = await receivedBand();
  await user.click(within(effects).getByRole("button", { name: "Resolver envío" }));
  const dialog = screen.getByRole("dialog", { name: "Resolver el envío" });
  await user.click(within(dialog).getByRole("radio", { name: /Salió/ }));
  await user.click(within(dialog).getByRole("button", { name: "Confirmar que salió" }));
  const confirm = within(dialog).getByRole("button", { name: "Confirmar que salió" });
  await waitFor(() => expect(confirm).toHaveAccessibleDescription(wait));
  expect(confirm).toHaveAttribute("aria-disabled", "true");
  for (const text of within(dialog).getAllByText(wait)) expect(text).not.toBeVisible();
  await user.click(within(dialog).getByRole("button", { name: "Cancelar" }));
  for (const name of ["Resolver envío", "Consultar"]) {
    const button = within(effects).getByRole("button", { name });
    expect(button).toHaveAttribute("aria-disabled", "true");
    expect(button).toHaveAccessibleDescription(wait);
  }
  for (const text of screen.getAllByText(wait)) expect(text).not.toBeVisible();
});

// A background refetch (every 2 s while an action runs) is not the history working: the wait stays as the reason,
// so the button is not remounted under the mouse or the keyboard focus.
it("keeps the wait as the reason of Retry while a running action refetches the history", async () => {
  const user = userEvent.setup();
  const wait = /^Esperá [0-9]+ segundos para volver a intentar\.$/;
  const workflow: ResponseWorkflow = { ...responseWorkflowFixture(), actions: [action({ state: "Failed", canRetry: true, completedAtUtc: null }),
    action({ id: id(5), kind: "NotifyRole", order: 1, state: "Running", completedAtUtc: null })] };
  let reads = 0;
  server.use(http.get("/api/me", () => HttpResponse.json({ ...currentUser, permissions: ["formrecords.read", "formrules.manage"] })),
    http.get("/api/forms/records/:id/workflow", () => ++reads === 1 ? HttpResponse.json(workflow) : new Promise<never>(() => undefined)),
    http.post("/api/forms/records/:id/actions/:runId/retry", () => HttpResponse.json({ code: "RateLimit.Exceeded", detail: "Esperá antes de reintentar.", retryAfter: 30 }, { status: 429 })));
  renderWithProviders(<ActivityHarness />);
  const effects = await receivedBand();
  await user.click(within(effects).getByRole("button", { name: "Reintentar" }));
  const retry = within(effects).getByRole("button", { name: "Reintentar" });
  await waitFor(() => expect(retry).toHaveAccessibleDescription(wait));
  await waitFor(() => expect(reads).toBe(2), { timeout: 3000 });
  expect(within(effects).getByRole("button", { name: "Reintentar" })).toBe(retry);
  expect(retry).toHaveAttribute("aria-disabled", "true");
  expect(retry).toHaveAccessibleDescription(wait);
});

it("names the app and whoever loaded the response once, under the submission", async () => {
  const record = responseDetailFixture();
  const loaded = { ...record, channel: "app" as const, origin: { ...record.origin!, channelId: "app", conversationId: null, maskedAddress: null } };
  function AppHarness() {
    const workflow = useResponseWorkflow(responseFormId, responseRecordId);
    return <ResponseWorkflowHistory record={loaded} workflow={workflow} timeZoneId="UTC" />;
  }
  server.use(http.get("/api/me", () => HttpResponse.json({ ...currentUser, permissions: ["formrecords.read"] })),
    http.get("/api/forms/records/:id/workflow", () => HttpResponse.json(responseWorkflowFixture())));
  renderWithProviders(<AppHarness />);
  const received = await screen.findByRole("listitem", { name: "Al recibirla" });
  expect(within(received).getByText("En la app · " + record.actor.displayName)).toBeInTheDocument();
  expect(within(received).queryByText(/Se lo mandó/)).not.toBeInTheDocument();
});

// Each recovery button says what it is doing while its POST works (board LC1-A); the others only turn off.
it("says Consultando… only on the action being consulted", async () => {
  const user = userEvent.setup();
  let release!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  const workflow: ResponseWorkflow = { ...responseWorkflowFixture(), actions: [action({ kind: "NotifyRole", state: "Uncertain", completedAtUtc: null, canConsult: true }),
    action({ id: id(5), order: 1, state: "Failed", canRetry: true, completedAtUtc: null })] };
  showActivity(workflow);
  server.use(http.post("/api/forms/records/:id/actions/:runId/consult", async () => { await gate; return HttpResponse.json(workflow); }));
  const effects = await receivedBand();
  await user.click(within(effects).getByRole("button", { name: "Consultar" }));
  expect(within(effects).getByRole("button", { name: "Consultando…" })).toHaveAttribute("aria-busy", "true");
  expect(within(effects).getByRole("button", { name: "Reintentar" })).toBeDisabled();
  expect(within(effects).getAllByRole("button", { name: "Consultando…" })).toHaveLength(1);
  await act(async () => release());
  await waitFor(() => expect(within(effects).getByRole("button", { name: "Consultar" })).toBeEnabled());
});

it("says Reintentando… on an action being retried, not Consultando…", async () => {
  const user = userEvent.setup();
  let release!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  const workflow: ResponseWorkflow = { ...responseWorkflowFixture(), actions: [action({ state: "Failed", canRetry: true, completedAtUtc: null })] };
  showActivity(workflow);
  server.use(http.post("/api/forms/records/:id/actions/:runId/retry", async () => { await gate; return HttpResponse.json({ ...workflow, actions: [action()] }); }));
  const effects = await receivedBand();
  await user.click(within(effects).getByRole("button", { name: "Reintentar" }));
  expect(within(effects).getByRole("button", { name: "Reintentando…" })).toHaveAttribute("aria-busy", "true");
  expect(within(effects).queryByText("Consultando…")).not.toBeInTheDocument();
  await act(async () => release());
  await waitFor(() => expect(within(effects).queryByRole("button", { name: "Reintentando…" })).not.toBeInTheDocument());
});

// Explanations are not written under the history (decision of 2026-10-31): what still helps goes in the (i).
it("tells what Retry resumes in the (i) next to it, only where the button is", async () => {
  showActivity({ ...responseWorkflowFixture(), actions: [action({ state: "Failed", canRetry: true, completedAtUtc: null }),
    action({ id: id(5), kind: "NotifyRole", order: 1, state: "Uncertain", completedAtUtc: null, canConsult: true })] });
  const effects = await receivedBand();
  const help = "Reintentar retoma sólo lo que no salió: no repite lo confirmado ni arma otro PDF.";
  expect(within(effects).getAllByRole("button", { name: "Más información sobre Reintentar" })).toHaveLength(1);
  expect(within(effects).getByRole("button", { name: "Más información sobre Reintentar" })).toHaveAccessibleDescription(help);
  for (const text of screen.getAllByText(help)) expect(text).not.toBeVisible();
  expect(screen.queryByText(/No sabemos si salió/)).not.toBeInTheDocument();
});

it("has no Retry help without a Retry button", async () => {
  server.use(http.get("/api/me", () => HttpResponse.json({ ...currentUser, permissions: ["formrecords.read"] })),
    http.get("/api/forms/records/:id/workflow", () => HttpResponse.json({ ...responseWorkflowFixture(), actions: [action({ state: "Failed", canRetry: true, completedAtUtc: null })] })));
  renderWithProviders(<ActivityHarness />);
  const effects = await receivedBand();
  expect(within(effects).getByText("No se pudo")).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Más información sobre Reintentar" })).not.toBeInTheDocument();
  expect(screen.queryByText(/Reintentar retoma/)).not.toBeInTheDocument();
});

// Board RT1-A: a person of a role notice whose failure is confirmed has Retry in their own row, with its (i).
function roleNotice(overrides: Partial<ResponseAction> = {}): ResponseAction {
  return action({ kind: "NotifyRole", revision: 3, recipients: [
    { user: { userId: id(8), displayName: "Ana" }, channelId: "phone", state: "Accepted", reasonCode: null, reason: null, canReview: false, canRetry: false, deliveredAtUtc: instant("05"), readAtUtc: null, review: null },
    { user: { userId: id(10), displayName: "Beto" }, channelId: "phone", state: "Failed", reasonCode: "WhatsApp.FormAction.RecipientUnavailable", reason: "El destinatario no está disponible para recibir el aviso.",
      canReview: false, canRetry: true, deliveredAtUtc: null, readAtUtc: null, review: null }], ...overrides });
}
const betoRow = (effects: HTMLElement) => within(within(effects).getByRole("listitem", { name: "Destinatario: Beto" }));

it("offers Retry in the row of the person whose failure is confirmed, with what it does in the (i)", async () => {
  showActivity({ ...responseWorkflowFixture(), actions: [roleNotice()] });
  const effects = await receivedBand();
  const beto = betoRow(effects);
  expect(beto.getByText("No se pudo enviar")).toBeInTheDocument();
  expect(beto.getByRole("button", { name: "Reintentar" })).toBeEnabled();
  expect(beto.getByRole("button", { name: "Más información sobre Reintentar" })).toHaveAccessibleDescription(
    "Le manda el aviso sólo a esta persona; a las demás no se les repite. Antes, revisá que tenga el WhatsApp vinculado en su perfil y que haya escrito en las últimas 24 horas.");
  expect(within(within(effects).getByRole("listitem", { name: "Destinatario: Ana" })).queryByRole("button")).not.toBeInTheDocument();
  expect(within(effects).getAllByRole("button", { name: "Reintentar" })).toHaveLength(1);
});

it("retries only that person with the revision of the notice and says Reintentando… on its button", async () => {
  const user = userEvent.setup();
  let release!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  const workflow: ResponseWorkflow = { ...responseWorkflowFixture(), actions: [roleNotice()] };
  const [ana, beto] = workflow.actions[0].recipients;
  let posted: unknown;
  let person: unknown;
  showActivity(workflow);
  server.use(http.post("/api/forms/records/:id/actions/:runId/recipients/:userId/retry", async ({ request, params }) => {
    person = params.userId; posted = await request.json(); await gate;
    return HttpResponse.json({ ...workflow, actions: [roleNotice({ state: "Waiting", completedAtUtc: null, recipients: [ana, { ...beto, canRetry: false }] })] }, { status: 202 });
  }));
  const effects = await receivedBand();
  await user.click(betoRow(effects).getByRole("button", { name: "Reintentar" }));
  expect(within(effects).getByRole("button", { name: "Reintentando…" })).toHaveAttribute("aria-busy", "true");
  expect(person).toBe(beto.user.userId);
  expect(posted).toEqual({ expectedRevision: 3 });
  await act(async () => release());
  await waitFor(() => expect(within(effects).queryByRole("button", { name: /^Reintent/ })).not.toBeInTheDocument());
});

it("reads the activity again after a conflict instead of retrying the person twice", async () => {
  const user = userEvent.setup();
  const workflow: ResponseWorkflow = { ...responseWorkflowFixture(), actions: [roleNotice()] };
  const [ana, beto] = workflow.actions[0].recipients;
  const sent: ResponseWorkflow = { ...workflow, actions: [roleNotice({ revision: 4, recipients: [ana, { ...beto, state: "Accepted", reasonCode: null, reason: null, canRetry: false }] })] };
  let reads = 0;
  let retries = 0;
  server.use(http.get("/api/me", () => HttpResponse.json({ ...currentUser, permissions: ["formrecords.read", "formrules.manage"] })),
    http.get("/api/forms/records/:id/workflow", () => HttpResponse.json(++reads === 1 ? workflow : sent)),
    http.post("/api/forms/records/:id/actions/:runId/recipients/:userId/retry", () => { retries++; return HttpResponse.json({ code: "Forms.Action.StateConflict", detail: "La acción cambió. Actualizá antes de reintentar." }, { status: 409 }); }));
  renderWithProviders(<ActivityHarness />);
  const effects = await receivedBand();
  await user.click(betoRow(effects).getByRole("button", { name: "Reintentar" }));
  await waitFor(() => expect(betoRow(effects).getByText("Enviado")).toBeInTheDocument());
  expect(betoRow(effects).queryByRole("button", { name: "Reintentar" })).not.toBeInTheDocument();
  expect(retries).toBe(1);
});

it("has no person Retry without rule management", async () => {
  server.use(http.get("/api/me", () => HttpResponse.json({ ...currentUser, permissions: ["formrecords.read"] })),
    http.get("/api/forms/records/:id/workflow", () => HttpResponse.json({ ...responseWorkflowFixture(), actions: [roleNotice()] })));
  renderWithProviders(<ActivityHarness />);
  const effects = await receivedBand();
  expect(betoRow(effects).getByText("No se pudo enviar")).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Reintentar" })).not.toBeInTheDocument();
});

it("tells that a human review does not confirm the delivery in the (i) next to it", async () => {
  showActivity({ ...responseWorkflowFixture(), actions: [action({ kind: "NotifyRole", recipients: [{ user: { userId: id(8), displayName: "Ana" }, channelId: "whatsapp", state: "Accepted", reasonCode: null, reason: null, canReview: false, canRetry: false,
    deliveredAtUtc: null, readAtUtc: null, review: { wasSent: true, reviewedAtUtc: instant("04"), reviewedBy: { userId: id(9), displayName: "Luz" } } }] })] });
  const effects = await receivedBand();
  expect(within(effects).getByText("Luz indicó que salió.")).toBeVisible();
  expect(within(effects).getByRole("button", { name: "Más información sobre Luz indicó que salió." })).toHaveAccessibleDescription("Revisión humana: no confirma la entrega de WhatsApp.");
  for (const text of screen.getAllByText("Revisión humana: no confirma la entrega de WhatsApp.")) expect(text).not.toBeVisible();
});

it("resolves a send without a description, with each option's consequence in its (i), and waits with Confirmando…", async () => {
  const user = userEvent.setup();
  let release!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  const recipient = { user: { userId: id(10), displayName: "Beto" }, channelId: "whatsapp", state: "Uncertain" as const, reasonCode: null, reason: null, canReview: true, canRetry: false, deliveredAtUtc: null, readAtUtc: null, review: null };
  const workflow: ResponseWorkflow = { ...responseWorkflowFixture(), actions: [action({ kind: "NotifyRole", state: "Uncertain", completedAtUtc: null, canConsult: true, recipients: [recipient] })] };
  showActivity(workflow);
  server.use(http.post("/api/forms/records/:id/actions/:runId/review", async () => { await gate;
    return HttpResponse.json({ ...workflow, actions: [action({ kind: "NotifyRole", recipients: [{ ...recipient, state: "Accepted", canReview: false, canRetry: false, review: { wasSent: true, reviewedAtUtc: instant("09"), reviewedBy: { userId: id(9), displayName: "Luz" } } }] })] }); }));
  const effects = await receivedBand();
  await user.click(within(effects).getByRole("button", { name: "Resolver envío" }));
  const dialog = screen.getByRole("dialog", { name: "Resolver el envío" });
  expect(dialog).not.toHaveAccessibleDescription();
  expect(within(dialog).getByRole("radio", { name: "Salió" })).toHaveAccessibleDescription("La regla continúa sin volver a mandar este aviso.");
  expect(within(dialog).getByRole("radio", { name: "No salió" })).toHaveAccessibleDescription("El aviso queda para reintentar a esta persona.");
  await user.click(within(dialog).getByRole("radio", { name: "Salió" }));
  await user.click(within(dialog).getByRole("button", { name: "Confirmar que salió" }));
  expect(within(dialog).getByRole("button", { name: "Confirmando…" })).toHaveAttribute("aria-busy", "true");
  expect(within(dialog).getByRole("button", { name: "Cancelar" })).toBeDisabled();
  expect(within(dialog).getByRole("button", { name: "Cerrar" })).toHaveAccessibleDescription("Confirmando…");
  await act(async () => release());
  await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
});

// DL (2026-11-11): the recipient reads in its row of two columns, never «Destinatario: Beto»; and after a lost confirmation whose
// reading also failed, why the options are off is their reason, not a grey sentence under them.
it("reads the recipient in its row and gives why the options are off as their reason", async () => {
  const user = userEvent.setup();
  const recipient = { user: { userId: id(10), displayName: "Beto" }, channelId: "whatsapp", state: "Uncertain" as const, reasonCode: null, reason: null, canReview: true, canRetry: false, deliveredAtUtc: null, readAtUtc: null, review: null };
  const workflow: ResponseWorkflow = { ...responseWorkflowFixture(), actions: [action({ kind: "NotifyRole", state: "Uncertain", completedAtUtc: null, canConsult: true, recipients: [recipient] })] };
  let reads = 0;
  server.use(http.get("/api/me", () => HttpResponse.json({ ...currentUser, permissions: ["formrecords.read", "formrules.manage"] })),
    http.get("/api/forms/records/:id/workflow", () => ++reads === 1 ? HttpResponse.json(workflow) : HttpResponse.error()),
    http.post("/api/forms/records/:id/actions/:runId/review", () => HttpResponse.error()));
  renderWithProviders(<ActivityHarness />);
  const effects = await receivedBand();
  await user.click(within(effects).getByRole("button", { name: "Resolver envío" }));
  const dialog = screen.getByRole("dialog", { name: "Resolver el envío" });
  expect(within(dialog).getByText("Destinatario", { selector: "dt" }).nextElementSibling).toHaveTextContent(/^Beto$/);
  expect(within(dialog).queryByText(/Destinatario:/)).not.toBeInTheDocument();
  await user.click(within(dialog).getByRole("radio", { name: "Salió" }));
  await user.click(within(dialog).getByRole("button", { name: "Confirmar que salió" }));
  expect(await within(dialog).findByRole("button", { name: "Consultar" })).toBeEnabled();
  const reason = "Consultá el estado antes de volver a confirmar la revisión.";
  for (const [name, help] of [["Salió", "La regla continúa sin volver a mandar este aviso."], ["No salió", "El aviso queda para reintentar a esta persona."]]) {
    const option = within(dialog).getByRole("radio", { name });
    expect(option).toHaveAttribute("aria-disabled", "true");
    expect(option).toHaveAccessibleDescription(help + " " + reason);
  }
  // Nothing written under the options: the reason is only on them.
  for (const text of within(dialog).getAllByText(reason)) expect(text).not.toBeVisible();
  expect(within(dialog).queryByText(/quedó guardada/)).not.toBeInTheDocument();
});

it("says Reintentando… while it reads again a history that failed after being shown", async () => {
  const user = userEvent.setup();
  let reads = 0;
  let release!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  server.use(http.get("/api/me", () => HttpResponse.json({ ...currentUser, permissions: ["formrecords.read", "formrules.manage"] })),
    http.get("/api/forms/records/:id/workflow", async () => {
      if (++reads === 2) return HttpResponse.json({ code: "Test.Workflow", detail: "No se pudo leer." }, { status: 400 });
      if (reads > 2) await gate;
      return HttpResponse.json(responseWorkflowFixture());
    }));
  function Host() {
    const client = useQueryClient();
    return <><button type="button" onClick={() => { void client.invalidateQueries({ queryKey: ["form-responses"] }); }}>Leer de nuevo</button><ActivityHarness /></>;
  }
  renderWithProviders(<Host />);
  await screen.findByRole("listitem", { name: "Al recibirla" });
  await waitFor(() => expect(screen.queryByRole("status")).not.toBeInTheDocument());
  await user.click(screen.getByRole("button", { name: "Leer de nuevo" }));
  await user.click(await screen.findByRole("button", { name: "Reintentar" }));
  expect(await screen.findByRole("button", { name: "Reintentando…" })).toHaveAttribute("aria-busy", "true");
  await act(async () => release());
  await waitFor(() => expect(screen.queryByRole("button", { name: /^Reintent/ })).not.toBeInTheDocument());
});

// Board TL3-A: each thing in a fixed column (the time, what happened with who under it, the state and the actions), the
// moments as bands, the day once and the state once.
it("reads each row in fixed columns, by moment, with the day once and the state once", async () => {
  const task: NonNullable<ResponseWorkflow["task"]> = { id: id(3), roleId: id(4), roleName: "Agrónomo", requestedAtUtc: instant("03"), state: "Approved", revision: 2, decidedAtUtc: instant("04"), decidedBy: { userId: id(9), displayName: "Marcos" }, reason: null };
  const pdf = action({ id: id(5), kind: "GeneratePdf", event: "Approved", completedAtUtc: instant("05") });
  const notice = action({ id: id(6), event: "Approved", order: 1, completedAtUtc: instant("06"), recipients: [{ user: { userId: id(8), displayName: "Ana" }, channelId: "whatsapp", state: "Accepted", reasonCode: null, reason: null, canReview: false, canRetry: false, deliveredAtUtc: instant("07"), readAtUtc: instant("08"), review: null }] });
  showActivity({ ...responseWorkflowFixture(), recordState: "Approved", task, actions: [action({ id: id(7), kind: "RequestApproval" }), pdf, notice],
    documents: [{ id: id(12), runId: pdf.id, culture: "es", name: "Visita-TEST.pdf", size: 10, createdAtUtc: instant("05") }] }, document => <button type="button">Abrir {document.name}</button>);
  const approved = await screen.findByRole("listitem", { name: "Al aprobarla" });
  expect(bandNames()).toEqual(["Al recibirla", "Aprobación", "Al aprobarla"]);
  expect(screen.getByText("Qué pasó")).toBeInTheDocument();
  const approval = within(screen.getByRole("listitem", { name: "Aprobación" }));
  expect(approval.getByText("Marcos la aprobó")).toBeInTheDocument();
  expect(approval.getAllByText(/Agrónomo/).map(role => role.textContent)).toEqual(["Rol Agrónomo"]);
  expect(approval.getAllByText(/^(Aprobada|Por aprobar)$/).map(badge => badge.textContent)).toEqual(["Aprobada"]);
  const file = within(approved.querySelector('[tabindex="-1"]') as HTMLElement);
  expect(file.getByText("Armar el PDF")).toBeInTheDocument();
  // NI1-A (2026-11-03): the copy names its language only when it is not the menu's.
  expect(file.getByText("Visita-TEST.pdf")).toBeInTheDocument();
  expect(file.getByText("Hecho")).toBeInTheDocument();
  expect(file.getByRole("button", { name: "Abrir Visita-TEST.pdf" })).toBeInTheDocument();
  // The message to whoever loaded it is one row: their name under the action and the receipts with their time.
  const message = within(within(approved).getByText("Mandarle un mensaje a quien la cargó").closest("li")!);
  expect(message.getByText("Ana")).toBeInTheDocument();
  expect(message.getByText("Hecho")).toBeInTheDocument();
  expect(message.getByText("Leído")).toBeInTheDocument();
  expect(within(approved).queryByRole("listitem", { name: "Destinatario: Ana" })).not.toBeInTheDocument();
  expect(screen.getAllByText("16/10/2026")).toHaveLength(1);
  expect(screen.getAllByText("17/10/2026")).toHaveLength(1);
});

it("tells who rejected it and the reason in its box, without repeating the state", async () => {
  const task: NonNullable<ResponseWorkflow["task"]> = { id: id(3), roleId: id(4), roleName: "Agrónomo", requestedAtUtc: instant("03"), state: "Rejected", revision: 2, decidedAtUtc: instant("04"), decidedBy: { userId: id(9), displayName: "Luz" }, reason: "La dosis no coincide con la receta." };
  showActivity({ ...responseWorkflowFixture(), recordState: "Rejected", task, actions: [] });
  const approval = within(await screen.findByRole("listitem", { name: "Aprobación" }));
  expect(approval.getByText("Luz la rechazó")).toBeInTheDocument();
  expect(approval.getByText("La dosis no coincide con la receta.")).toBeInTheDocument();
  expect(approval.getAllByText("Rechazada")).toHaveLength(1);
  expect(screen.queryByText(/→/)).not.toBeInTheDocument();
});

// W3: the location and the contact can each bring the form back at the same instant: two rows, each with its own key.
function RecordActivity({ record }: { record: ResponseDetail }) {
  const workflow = useResponseWorkflow(responseFormId, responseRecordId);
  return <ResponseWorkflowHistory record={record} workflow={workflow} timeZoneId="UTC" />;
}
it("shows two forms sent again at the same instant as two rows without repeating a key", async () => {
  const errors = vi.spyOn(console, "error").mockImplementation(() => {});
  try {
    const at = instant("05");
    const record: ResponseDetail = { ...responseDetailFixture(), history: [{ kind: "Sent", atUtc: instant("00"), actor: null },
      { kind: "LocationReceived", atUtc: at, actor: null, questions: ["Dirección de entrega"] }, { kind: "ContactReceived", atUtc: at, actor: null, questions: ["Recibió"] },
      { kind: "SentAgain", atUtc: at, actor: null }, { kind: "SentAgain", atUtc: at, actor: null }] };
    server.use(http.get("/api/me", () => HttpResponse.json({ ...currentUser, permissions: ["formrecords.read"] })),
      http.get("/api/forms/records/:id/workflow", () => HttpResponse.json(responseWorkflowFixture())));
    renderWithProviders(<RecordActivity record={record} />);
    const received = within(await screen.findByRole("listitem", { name: "Al recibirla" }));
    expect(received.getAllByText("Se volvió a mandar el formulario")).toHaveLength(2);
    expect(errors.mock.calls.some(call => call.some(part => /same key/i.test(String(part))))).toBe(false);
  } finally {
    errors.mockRestore();
  }
});

// W3 (UC2, UC3 and UC6): what the person shared says under it, in grey, which questions it completed (the labels of the version,
// joined like the rest of the texts), and the form that came back is a row of its own, without repeating who sent it.
const ana = { userId: id(30), displayName: "Ana Pérez" };
const sharedHistory = (questions: { location: string; name: string; phone: string }): ResponseDetail["history"] => [
  { kind: "Sent", atUtc: instant("00"), actor: ana },
  { kind: "LocationReceived", atUtc: instant("05"), actor: null, questions: [questions.location] }, { kind: "SentAgain", atUtc: instant("05"), actor: ana },
  { kind: "ContactReceived", atUtc: instant("07"), actor: null, questions: [questions.name, questions.phone] }, { kind: "SentAgain", atUtc: instant("07"), actor: ana },
  { kind: "Submitted", atUtc: instant("09"), actor: ana }, { kind: "Saved", atUtc: instant("09"), actor: null }];
async function receivedRows(record: ResponseDetail) {
  server.use(http.get("/api/me", () => HttpResponse.json({ ...currentUser, permissions: ["formrecords.read"] })),
    http.get("/api/forms/records/:id/workflow", () => HttpResponse.json(responseWorkflowFixture())));
  renderWithProviders(<RecordActivity record={record} />);
  const band = await screen.findByRole("listitem", { name: /^(Al recibirla|On receipt)$/ });
  return within(band).getAllByRole("listitem").map(row => [...row.querySelectorAll("p")].map(line => line.textContent));
}
it("says under the shared location and contact the questions they completed, and the form sent again without its sender", async () => {
  const rows = await receivedRows({ ...responseDetailFixture(), history: sharedHistory({ location: "Dirección de entrega", name: "Recibió", phone: "Teléfono de quien recibe" }) });

  expect(rows).toEqual([["Se mandó el formulario", "Ana Pérez"], ["Llegó la ubicación", "Completó «Dirección de entrega»"], ["Se volvió a mandar el formulario"],
    ["Llegó el contacto", "Completó «Recibió» y «Teléfono de quien recibe»"], ["Se volvió a mandar el formulario"],
    ["Se respondió el formulario", "Por WhatsApp · Ana Pérez"], ["Se guardó la respuesta"]]);
});
it("names the only question a contact completed, and keeps the location of W1-A without questions", async () => {
  const rows = await receivedRows({ ...responseDetailFixture(), history: [{ kind: "LocationRequested", atUtc: instant("00"), actor: null },
    { kind: "LocationReceived", atUtc: instant("01"), actor: null }, { kind: "Sent", atUtc: instant("01"), actor: ana },
    { kind: "ContactReceived", atUtc: instant("03"), actor: null, questions: ["Teléfono de quien recibe"] }, { kind: "SentAgain", atUtc: instant("03"), actor: null }] });

  expect(rows).toEqual([["Se pidió la ubicación"], ["Llegó la ubicación"], ["Se mandó el formulario", "Ana Pérez"],
    ["Llegó el contacto", "Completó «Teléfono de quien recibe»"], ["Se volvió a mandar el formulario"]]);
});
it("says what the shared location and contact completed in English", async () => {
  await act(async () => { await i18n.changeLanguage("en"); });
  try {
    const rows = await receivedRows({ ...responseDetailFixture(), history: sharedHistory({ location: "Delivery address", name: "Received by", phone: "Recipient's phone" }) });

    expect(rows.slice(1, 5)).toEqual([["Location received", "Filled in “Delivery address”"], ["Form sent again"],
      ["Contact received", "Filled in “Received by” and “Recipient's phone”"], ["Form sent again"]]);
  } finally {
    await act(async () => { await i18n.changeLanguage("es"); });
  }
});

// VC1-A: a response that came from a row of a spreadsheet starts, in the activity, when its spreadsheet arrived, with the file and the row
// under it; «Cómo empezó» names the spreadsheet and the row instead of «Salió de un documento».
const fromRow = (sheet: string | null): ResponseDetail => {
  const record = responseDetailFixture();
  return { ...record, origin: { ...record.origin!, document: { id: id(40), name: "cobranzas-semana.xlsx", row: { sheet, number: 5, receivedAtUtc: "2026-10-17T11:59:00Z" } } },
    history: [{ kind: "Sent", atUtc: instant("00"), actor: ana }, { kind: "Submitted", atUtc: instant("09"), actor: ana }] };
};
it("starts a response that came from a row of a spreadsheet when its spreadsheet arrived, with the file and the row", async () => {
  const rows = await receivedRows(fromRow(null));
  expect(rows[0]).toEqual(["Salió de una planilla", "cobranzas-semana.xlsx, fila 5"]);
  expect(rows[1]).toEqual(["Se mandó el formulario", "Ana Pérez"]);
});
it("names the spreadsheet, its sheet and its row in «Cómo empezó»", async () => {
  renderWithProviders(<MemoryRouter><ResponseAssistance record={fromRow("Ventas")} actor="me" busy={false} onForbidden={vi.fn()} onError={vi.fn()} /></MemoryRouter>);
  expect(await screen.findByText("Salió de una planilla · cobranzas-semana.xlsx, fila 5 de «Ventas»")).toBeInTheDocument();
  expect(screen.getByRole("link", { name: "Ver en Documentos recibidos" })).toHaveAttribute("href", "/formularios/documentos/" + id(40));
});
