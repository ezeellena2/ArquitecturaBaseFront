import { screen, within, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { it, expect, vi } from "vitest";
import { currentUser } from "@/test/mocks/handlers";
import { server } from "@/test/mocks/server";
import { renderWithProviders } from "@/test/utils/renderWithProviders";
import { responseDetailFixture, responseFormId, responseRecordId, responseWorkflowFixture } from "@/test/responseFixtures";
import type { ResponseAction, ResponseWorkflow } from "../api/workflow";
import { useResponseWorkflow } from "../hooks/useResponseWorkflow";
import { ResponseWorkflowHistory } from "./ResponseWorkflowHistory";

vi.mock("react-oidc-context", async () => ({ ...(await vi.importActual<typeof import("react-oidc-context")>("react-oidc-context")),
  useAuth: () => ({ isAuthenticated: true, isLoading: false, user: { access_token: "test" } }) }));
const id = (value: number) => "0199a0c0-0000-7000-8000-" + String(value).padStart(12, "0");
const instant = (second: string) => "2026-10-17T12:00:" + second + "Z";
function action(overrides: Partial<ResponseAction> = {}): ResponseAction {
  return { id: id(1), ruleId: id(2), kind: "NotifyAuthor", event: "Received", order: 0, revision: 1, state: "Completed", reasonCode: null, reason: null, canConsult: false, canRetry: false, recipients: [], createdAtUtc: instant("00"), updatedAtUtc: instant("01"), completedAtUtc: instant("01"), ...overrides };
}
function ActivityHarness() {
  const workflow = useResponseWorkflow(responseFormId, responseRecordId);
  return <ResponseWorkflowHistory record={responseDetailFixture()} workflow={workflow} timeZoneId="UTC" />;
}
function showActivity(workflow: ResponseWorkflow) {
  server.use(http.get("/api/me", () => HttpResponse.json({ ...currentUser, permissions: ["formrecords.read", "formrules.manage"] })),
    http.get("/api/forms/records/:id/workflow", () => HttpResponse.json(workflow)));
  return renderWithProviders(<ActivityHarness />);
}

it("groups request evidence once with its real task time and preserves receiving effects", async () => {
  const task: NonNullable<ResponseWorkflow["task"]> = { id: id(3), roleId: id(4), roleName: "Supervisión", requestedAtUtc: instant("03"), state: "Open", revision: 1, decidedAtUtc: null, decidedBy: null, reason: null };
  const workflow: ResponseWorkflow = { ...responseWorkflowFixture(), recordState: "PendingApproval", task,
    actions: [action(), action({ id: id(5), kind: "RequestApproval", order: 1 })] };
  showActivity(workflow);
  const received = await screen.findByRole("listitem", { name: "Recibida" });
  expect(within(received).getByText("Se respondió el formulario")).toBeInTheDocument();
  const effects = await screen.findByRole("listitem", { name: "Al recibirla" });
  expect(within(effects).getByText("Mandarle un mensaje a quien la cargó")).toBeInTheDocument();
  const approval = screen.getByRole("listitem", { name: "Por aprobar" });
  expect(approval.querySelector('time[datetime="' + instant("03") + '"]')).toBeInTheDocument();
  expect(screen.queryByText("Pedir aprobación a una persona con un rol")).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Aprobar" })).not.toBeInTheDocument();
});

it("keeps a failed approval request visible inside the receiving moment without a pending task", async () => {
  showActivity({ ...responseWorkflowFixture(), actions: [action({ kind: "RequestApproval", state: "Failed", reasonCode: "Forms.Rule.RoleUnavailable", reason: "El rol ya no está disponible." })] });
  const effects = await screen.findByRole("listitem", { name: "Al recibirla" });
  expect(within(effects).getByText("Pedir aprobación a una persona con un rol")).toBeInTheDocument();
  expect(within(effects).getByText("El rol ya no está disponible.")).toBeInTheDocument();
  expect(within(effects).getByText("No se pudo")).toBeInTheDocument();
  expect(screen.queryByRole("listitem", { name: "Por aprobar" })).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Reintentar" })).not.toBeInTheDocument();
});

it("preserves delivery, human review and recovery controls inside an effect moment", async () => {
  const user = userEvent.setup();
  showActivity({ ...responseWorkflowFixture(), actions: [action({ kind: "NotifyRole", state: "Uncertain", completedAtUtc: null, canConsult: true,
    recipients: [{ user: { userId: id(8), displayName: "Ana" }, channelId: "whatsapp", state: "Accepted", reasonCode: null, reason: null, canReview: false,
      deliveredAtUtc: instant("05"), readAtUtc: instant("06"), review: { wasSent: false, reviewedAtUtc: instant("04"), reviewedBy: { userId: id(9), displayName: "Luz" } } },
      { user: { userId: id(10), displayName: "Beto" }, channelId: "whatsapp", state: "Uncertain", reasonCode: null, reason: null, canReview: true, deliveredAtUtc: null, readAtUtc: null, review: null }] })] });
  const effects = await screen.findByRole("listitem", { name: "Al recibirla" });
  expect(within(effects).getByText("Entregado")).toBeInTheDocument();
  expect(within(effects).getByText("Leído")).toBeInTheDocument();
  expect(within(effects).getByText("Luz indicó que no salió.")).toBeInTheDocument();
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
    recipients: [{ user: { userId: id(10), displayName: "Beto" }, channelId: "whatsapp", state: "Uncertain", reasonCode: null, reason: null, canReview: true, deliveredAtUtc: null, readAtUtc: null, review: null }] })] });
  server.use(http.post("/api/forms/records/:id/actions/:runId/review", () => HttpResponse.json({ code: "RateLimit.Exceeded", detail: "Esperá antes de resolver.", retryAfter: 30 }, { status: 429 })));
  const effects = await screen.findByRole("listitem", { name: "Al recibirla" });
  await user.click(within(effects).getByRole("button", { name: "Resolver envío" }));
  const dialog = screen.getByRole("dialog", { name: "Resolver el envío" });
  await user.click(within(dialog).getByRole("radio", { name: /Salió/ }));
  await user.click(within(dialog).getByRole("button", { name: "Confirmar que salió" }));
  const confirm = within(dialog).getByRole("button", { name: "Confirmar que salió" });
  await waitFor(() => expect(confirm).toHaveAccessibleDescription(wait));
  expect(confirm).toBeDisabled();
  for (const text of within(dialog).getAllByText(wait)) expect(text).not.toBeVisible();
  await user.click(within(dialog).getByRole("button", { name: "Cancelar" }));
  for (const name of ["Resolver envío", "Consultar"]) {
    const button = within(effects).getByRole("button", { name });
    expect(button).toBeDisabled();
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
  const effects = await screen.findByRole("listitem", { name: "Al recibirla" });
  await user.click(within(effects).getByRole("button", { name: "Reintentar" }));
  const retry = within(effects).getByRole("button", { name: "Reintentar" });
  await waitFor(() => expect(retry).toHaveAccessibleDescription(wait));
  await waitFor(() => expect(reads).toBe(2), { timeout: 3000 });
  expect(within(effects).getByRole("button", { name: "Reintentar" })).toBe(retry);
  expect(retry).toBeDisabled();
  expect(retry).toHaveAccessibleDescription(wait);
});
