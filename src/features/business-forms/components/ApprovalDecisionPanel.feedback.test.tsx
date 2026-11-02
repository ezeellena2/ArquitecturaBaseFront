import { useLayoutEffect, useState } from "react";
import { act, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { http, HttpResponse } from "msw";
import { beforeEach, expect, it, vi } from "vitest";
import { ApiError } from "@/shared/api/ApiError";
import { currentUserQueryKey } from "@/auth/useCurrentUser";
import i18n from "@/shared/i18n";
import { renderWithProviders } from "@/test/utils/renderWithProviders";
import { server } from "@/test/mocks/server";
import { currentUser } from "@/test/mocks/handlers";
import { approvalTaskFixture, approvalTaskId, approveAndConfirm } from "@/test/approvalFixtures";
import { ApprovalDecisionPanel } from "./ApprovalDecisionPanel";
vi.mock("react-oidc-context", async () => ({ ...await vi.importActual<typeof import("react-oidc-context")>("react-oidc-context"), useAuth: () => ({ isAuthenticated: true, isLoading: false, user: { access_token: "test" } }) }));
beforeEach(() => { toast.dismiss(); });
it("keeps the confirmed decision in the real notification store after its panel unmounts", async () => {
  const task = approvalTaskFixture();
  server.use(http.get("/api/me", () => HttpResponse.json({ ...currentUser, permissions: ["formapprovals.decide"] })),
    http.get("/api/forms/approvals/" + approvalTaskId, () => HttpResponse.json(task)),
    http.post("/api/forms/approvals/:id/decisions", () => HttpResponse.json({ taskId: task.id, recordId: task.recordId, revision: 2, state: "Approved", decidedAtUtc: "2026-10-17T13:00:00Z", decidedBy: { userId: currentUser.id, displayName: "Luz" }, reason: null })));
  function Host() {
    const [open, setOpen] = useState(true);
    return open ? <ApprovalDecisionPanel taskId={approvalTaskId} onDecided={() => setOpen(false)}/> : <p>Panel cerrado</p>;
  }
  renderWithProviders(<Host/>);
  await approveAndConfirm();
  await screen.findByText("Panel cerrado");
  await waitFor(() => expect(toast.getToasts().some(notice => "title" in notice && notice.title === "Respuesta aprobada.")).toBe(true));
});
it.each([400, 401, 403, 404])("does not render cached task metadata in the first commit of nontransient HTTP%s failure", async status => {
  const permissions = ["formapprovals.decide"];
  const owner = [currentUser.id, i18n.language, permissions.join(",")].join(":");
  const key = ["form-approvals", owner, "task", approvalTaskId];
  const privateRole = "Private cached role";
  let visibleAtFirstCommit: boolean | undefined;
  function ObserveCommit() { useLayoutEffect(() => { visibleAtFirstCommit = document.body.textContent?.includes(privateRole) ?? false; }, []); return null; }
  function SeededPanel() {
    const client = useQueryClient();
    useState(() => {
      client.setQueryData(currentUserQueryKey, { ...currentUser, permissions });
      client.setQueryDefaults(key, { enabled: false });
      client.setQueryData(key, { ...approvalTaskFixture(), role: { id: approvalTaskId, name: privateRole } });
      client.getQueryCache().find({ queryKey: key, exact: true })!.setState({ error: new ApiError(status, { code: "Authorization.Forbidden" }), status: "error" });
      return true;
    });
    return <><ApprovalDecisionPanel taskId={approvalTaskId}/><ObserveCommit/></>;
  }
  await act(async () => { renderWithProviders(<SeededPanel/>); });
  expect(visibleAtFirstCommit).toBe(false);
  expect(screen.queryByText(privateRole)).not.toBeInTheDocument();
});

// Why Approve and Reject are disabled is not written under them: it is the help (tooltip and description) of each disabled button.
it("explains an own response as help of the decision buttons", async () => {
  const reason = "No podés aprobar ni rechazar tu propia respuesta.";
  server.use(http.get("/api/me", () => HttpResponse.json({ ...currentUser, permissions: ["formapprovals.decide"] })),
    http.get("/api/forms/approvals/" + approvalTaskId, () => HttpResponse.json({ ...approvalTaskFixture(), canDecide: false, cannotDecideReason: "OwnResponse" })));
  renderWithProviders(<ApprovalDecisionPanel taskId={approvalTaskId}/>);
  const approve = await screen.findByRole("button", { name: "Aprobar" });
  for (const button of [approve, screen.getByRole("button", { name: "Rechazar" })]) {
    expect(button).toBeDisabled();
    expect(button).toHaveAccessibleDescription(reason);
  }
  for (const text of screen.getAllByText(reason)) expect(text).not.toBeVisible();
  await userEvent.hover(approve);
  expect(await screen.findByRole("tooltip")).toHaveTextContent(reason);
});
it("explains the decision wait as help of the decision buttons and of the reject dialog", async () => {
  const wait = /^Esperá [0-9]+ segundos para volver a intentar\.$/;
  let decisions = 0;
  server.use(http.get("/api/me", () => HttpResponse.json({ ...currentUser, permissions: ["formapprovals.decide"] })),
    http.get("/api/forms/approvals/" + approvalTaskId, () => HttpResponse.json(approvalTaskFixture())),
    http.post("/api/forms/approvals/:id/decisions", () => { decisions++; return HttpResponse.json({ code: "RateLimit.Exceeded", detail: "Esperá antes de decidir.", retryAfter: 60 }, { status: 429 }); }));
  renderWithProviders(<ApprovalDecisionPanel taskId={approvalTaskId}/>);
  await userEvent.click(await screen.findByRole("button", { name: "Rechazar" }));
  const dialog = await screen.findByRole("dialog", { name: "Rechazar VIS-00001" });
  await userEvent.type(within(dialog).getByRole("textbox", { name: /Motivo/ }), "Falta la firma");
  await userEvent.click(within(dialog).getByRole("button", { name: "Rechazar" }));
  await waitFor(() => expect(within(dialog).getByRole("button", { name: "Rechazar" })).toHaveAccessibleDescription(wait));
  expect(within(dialog).getByRole("button", { name: "Rechazar" })).toBeDisabled();
  for (const text of within(dialog).getAllByText(wait)) expect(text).not.toBeVisible();
  await userEvent.click(within(dialog).getByRole("button", { name: "Cancelar" }));
  for (const name of ["Aprobar", "Rechazar"]) {
    expect(screen.getByRole("button", { name })).toBeDisabled();
    expect(screen.getByRole("button", { name })).toHaveAccessibleDescription(wait);
  }
  for (const text of screen.getAllByText(wait)) expect(text).not.toBeVisible();
  expect(decisions).toBe(1);
});

it("keeps a live task query when one of two panels leaves and purges it after permission revocation", async () => {
  const user = { ...currentUser, permissions: ["formapprovals.decide"] };
  server.use(http.get("/api/me", () => HttpResponse.json(user)), http.get("/api/forms/approvals/" + approvalTaskId, () => HttpResponse.json(approvalTaskFixture())));
  let client: ReturnType<typeof useQueryClient> | undefined;
  const otherKey = ["form-approvals", "another-owner", "task", approvalTaskId];
  function Host() {
    const current = useQueryClient();
    useLayoutEffect(() => { client = current; }, [current]);
    const [first, setFirst] = useState(true);
    return <><button type="button" onClick={() => setFirst(false)}>Cerrar primero</button>{first ? <ApprovalDecisionPanel taskId={approvalTaskId}/> : null}<ApprovalDecisionPanel taskId={approvalTaskId}/></>;
  }
  renderWithProviders(<Host/>);
  await screen.findAllByText("Supervisión");
  client!.setQueryData(otherKey, { private: "Other actor metadata" });
  const taskQuery = () => client!.getQueryCache().findAll({ predicate: query => query.queryKey[0] === "form-approvals" && query.queryKey[1] !== "another-owner" && query.queryKey[2] === "task" })[0];
  const originalQuery = taskQuery();
  expect(originalQuery?.getObserversCount()).toBe(2);
  await userEvent.click(screen.getByRole("button", { name: "Cerrar primero" }));
  await act(async () => { await Promise.resolve(); });
  expect(taskQuery()).toBe(originalQuery);
  expect(taskQuery()?.getObserversCount()).toBe(1);
  expect(screen.getByText("Supervisión")).toBeInTheDocument();
  await act(async () => { client!.setQueryData(currentUserQueryKey, { ...user, permissions: [] }); });
  await waitFor(() => expect(screen.queryByText("Supervisión")).not.toBeInTheDocument());
  await waitFor(() => expect(taskQuery()).toBeUndefined());
  expect(client!.getQueryData(otherKey)).toEqual({ private: "Other actor metadata" });
});

// A decision that waits for the server says so on its own button (board LC1-A), not only by turning the buttons off.
function decided(state: "Approved" | "Rejected", reason: string | null = null) {
  const task = approvalTaskFixture();
  return { taskId: task.id, recordId: task.recordId, revision: 2, state, decidedAtUtc: "2026-10-17T13:00:00Z", decidedBy: { userId: currentUser.id, displayName: "Luz" }, reason };
}
// Aprobar asks first, with the number, who loaded it and when (board AP1-A): a habitual click on the same place does not
// decide the next response. The dialog starts on Cancelar, so Enter does not approve either.
it("asks to confirm an approval with its number, author and date, starting on Cancelar", async () => {
  const decisions = vi.fn();
  server.use(http.get("/api/me", () => HttpResponse.json({ ...currentUser, permissions: ["formapprovals.decide"] })),
    http.get("/api/forms/approvals/" + approvalTaskId, () => HttpResponse.json(approvalTaskFixture())),
    http.post("/api/forms/approvals/:id/decisions", () => { decisions(); return HttpResponse.json(decided("Approved")); }));
  renderWithProviders(<ApprovalDecisionPanel taskId={approvalTaskId}/>);
  await userEvent.click(await screen.findByRole("button", { name: "Aprobar" }));
  const dialog = await screen.findByRole("dialog", { name: "¿Aprobar VIS-00001?" });
  expect(dialog).toHaveAccessibleDescription(/^Ana · 16 oct 2026/);
  await waitFor(() => expect(within(dialog).getByRole("button", { name: "Cancelar" })).toHaveFocus());
  await userEvent.click(within(dialog).getByRole("button", { name: "Cancelar" }));
  await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  expect(decisions).not.toHaveBeenCalled();
  await approveAndConfirm();
  await waitFor(() => expect(decisions).toHaveBeenCalledOnce());
  await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
});
it("waits in the approval dialog with Aprobando… and its close turned off, and closes it with the answer", async () => {
  let release!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  server.use(http.get("/api/me", () => HttpResponse.json({ ...currentUser, permissions: ["formapprovals.decide"] })),
    http.get("/api/forms/approvals/" + approvalTaskId, () => HttpResponse.json(approvalTaskFixture())),
    http.post("/api/forms/approvals/:id/decisions", async () => { await gate; return HttpResponse.json(decided("Approved")); }));
  renderWithProviders(<ApprovalDecisionPanel taskId={approvalTaskId}/>);
  await approveAndConfirm();
  const dialog = screen.getByRole("dialog", { name: "¿Aprobar VIS-00001?" });
  expect(await within(dialog).findByRole("button", { name: "Aprobando…" })).toHaveAttribute("aria-busy", "true");
  expect(within(dialog).getByRole("button", { name: "Cancelar" })).toBeDisabled();
  await act(async () => release());
  await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  expect(screen.queryByRole("button", { name: "Aprobar" })).not.toBeInTheDocument();
});
it("waits in the reject dialog with Rechazando… and its close turned off, and closes it with the answer", async () => {
  let release!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  server.use(http.get("/api/me", () => HttpResponse.json({ ...currentUser, permissions: ["formapprovals.decide"] })),
    http.get("/api/forms/approvals/" + approvalTaskId, () => HttpResponse.json(approvalTaskFixture())),
    http.post("/api/forms/approvals/:id/decisions", async () => { await gate; return HttpResponse.json(decided("Rejected", "Falta la firma")); }));
  renderWithProviders(<ApprovalDecisionPanel taskId={approvalTaskId}/>);
  await userEvent.click(await screen.findByRole("button", { name: "Rechazar" }));
  const dialog = await screen.findByRole("dialog", { name: "Rechazar VIS-00001" });
  expect(screen.queryByText("El motivo queda en el historial de la respuesta.")).not.toBeInTheDocument();
  expect(dialog).not.toHaveAccessibleDescription();
  await userEvent.type(within(dialog).getByRole("textbox", { name: /Motivo/ }), "Falta la firma");
  await userEvent.click(within(dialog).getByRole("button", { name: "Rechazar" }));
  expect(within(dialog).getByRole("button", { name: "Rechazando…" })).toHaveAttribute("aria-busy", "true");
  expect(within(dialog).getByRole("button", { name: "Cancelar" })).toBeDisabled();
  const close = within(dialog).getByRole("button", { name: "Cerrar" });
  expect(close).toBeDisabled();
  expect(close).toHaveAccessibleDescription("Rechazando…");
  await userEvent.keyboard("{Escape}");
  expect(screen.getByRole("dialog", { name: "Rechazar VIS-00001" })).toBeInTheDocument();
  await act(async () => release());
  await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
});
// Without a task read yet, Reintentar goes back to the first load's spinner; once one was shown, the button stays and says it.
it("says Reintentando… while it reads again a task that failed after being shown", async () => {
  let reads = 0;
  let release!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  server.use(http.get("/api/me", () => HttpResponse.json({ ...currentUser, permissions: ["formapprovals.decide"] })),
    http.get("/api/forms/approvals/" + approvalTaskId, async () => {
      if (++reads === 2) return HttpResponse.json({ code: "Test.Approval", detail: "No se pudo leer." }, { status: 400 });
      if (reads > 2) await gate;
      return HttpResponse.json(approvalTaskFixture());
    }));
  function Host() {
    const client = useQueryClient();
    return <><button type="button" onClick={() => { void client.invalidateQueries({ queryKey: ["form-approvals"] }); }}>Leer de nuevo</button><ApprovalDecisionPanel taskId={approvalTaskId}/></>;
  }
  renderWithProviders(<Host/>);
  await screen.findByRole("button", { name: "Aprobar" });
  await userEvent.click(screen.getByRole("button", { name: "Leer de nuevo" }));
  await userEvent.click(await screen.findByRole("button", { name: "Reintentar" }));
  expect(await screen.findByRole("button", { name: "Reintentando…" })).toHaveAttribute("aria-busy", "true");
  await act(async () => release());
  expect(await screen.findByRole("button", { name: "Aprobar" })).toBeEnabled();
});
it("shows it reads the task again next to the decision buttons it turns off", async () => {
  let reads = 0;
  let release!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  server.use(http.get("/api/me", () => HttpResponse.json({ ...currentUser, permissions: ["formapprovals.decide"] })),
    http.get("/api/forms/approvals/" + approvalTaskId, async () => { if (++reads > 1) await gate; return HttpResponse.json(approvalTaskFixture()); }));
  function Host() {
    const client = useQueryClient();
    return <><button type="button" onClick={() => { void client.invalidateQueries({ queryKey: ["form-approvals"] }); }}>Leer de nuevo</button><ApprovalDecisionPanel taskId={approvalTaskId}/></>;
  }
  renderWithProviders(<Host/>);
  const approve = await screen.findByRole("button", { name: "Aprobar" });
  expect(screen.queryByRole("status")).not.toBeInTheDocument();
  await userEvent.click(screen.getByRole("button", { name: "Leer de nuevo" }));
  await waitFor(() => expect(approve).toBeDisabled());
  expect(screen.getByRole("status")).toHaveTextContent("Cargando…");
  await act(async () => release());
  await waitFor(() => expect(screen.queryByRole("status")).not.toBeInTheDocument());
  expect(screen.getByRole("button", { name: "Aprobar" })).toBeEnabled();
});
