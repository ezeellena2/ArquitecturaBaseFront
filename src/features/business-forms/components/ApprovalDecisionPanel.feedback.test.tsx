import { useLayoutEffect, useState } from "react";
import { act, screen, waitFor } from "@testing-library/react";
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
import { approvalTaskFixture, approvalTaskId } from "@/test/approvalFixtures";
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
  await userEvent.click(await screen.findByRole("button", { name: "Aprobar" }));
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
