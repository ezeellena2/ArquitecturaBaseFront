import { act, renderHook, waitFor } from "@testing-library/react";
import { QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { http, HttpResponse } from "msw";
import { beforeEach, expect, it, vi } from "vitest";
import { queryClient } from "@/shared/api/queryClient";
import { server } from "@/test/mocks/server";
import { approvalTaskFixture } from "@/test/approvalFixtures";
import { usePendingApprovalNavigation } from "./usePendingApprovalNavigation";
import type { PendingApprovalNavigation } from "./useResponseWorkspace";
const task = (n: number) => ({ ...approvalTaskFixture(), id: "0199a0c0-0000-7000-8000-" + String(n).padStart(12, "0"), recordId: "0199a0c0-0000-7000-8000-" + String(n + 100).padStart(12, "0") });
const tasks = [1, 2, 3, 4].map(task);
const reference = (index: number) => ({ id: tasks[index].id, recordId: tasks[index].recordId, requestedAtUtc: tasks[index].requestedAtUtc });
const captured = (): PendingApprovalNavigation => ({ tasks: [reference(0), reference(1)], page: 1, pageSize: 2, totalCount: 4 });
const response = (items = [2, 3], direction = "Next") => ({ anchorTaskId: tasks[1].id, definitionId: tasks[0].definitionId, direction,
  items: items.map((index, position) => ({ task: tasks[index], position: position + 2 })), totalCount: 3, hasMore: false });
const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
function props(pending = captured()) { return { owner: "actor:es:decide", formId: tasks[0].definitionId, taskId: tasks[1].id, pending, allowed: true, disabled: false,
  onForbidden: vi.fn(), onQueue: vi.fn(), onNavigate: vi.fn() }; }
beforeEach(() => queryClient.clear());
it("merges a continuation with successors observed while it was loading and separates the return page from the captured count", async () => {
  let release!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  let started!: () => void;
  const ready = new Promise<void>(resolve => { started = resolve; });
  server.use(http.get("/api/forms/approvals/:id/continuation", async () => { started(); await gate; return HttpResponse.json(response()); }));
  const input = props();
  const view = renderHook(usePendingApprovalNavigation, { initialProps: input, wrapper });
  let flight!: Promise<void>;
  act(() => { flight = view.result.current.move(1); }); await ready;
  view.rerender({ ...input, pending: { ...captured(), tasks: [...captured().tasks, reference(2)] } });
  await act(async () => { release(); await flight; });
  const queue = input.onQueue.mock.calls[0][0] as PendingApprovalNavigation;
  expect(queue.tasks.map(item => item.id)).toEqual(tasks.map(item => item.id));
  expect(queue.totalCount).toBe(4); expect(queue.offset).toBe(0);
  expect(input.onNavigate).toHaveBeenCalledWith({ ...reference(2), position: 2 }, queue, 1);
});
it("prepends Previous in ascending order while preserving the captured ordinal and current return position", async () => {
  const input = props({ tasks: [reference(2)], page: 2, pageSize: 2, totalCount: 4 }); input.taskId = tasks[2].id;
  server.use(http.get("/api/forms/approvals/:id/continuation", () => HttpResponse.json({ ...response([], "Previous"), anchorTaskId: tasks[2].id,
    totalCount: 4, items: tasks.slice(0, 2).map((task, index) => ({ task, position: index + 1 })) })));
  const view = renderHook(usePendingApprovalNavigation, { initialProps: input, wrapper });
  await act(() => view.result.current.move(-1));
  const queue = input.onQueue.mock.calls[0][0] as PendingApprovalNavigation;
  expect(queue.tasks.map(item => item.id)).toEqual(tasks.slice(0, 3).map(item => item.id));
  expect(queue).toMatchObject({ offset: 0, totalCount: 4, hasPrevious: false });
  expect(input.onNavigate).toHaveBeenCalledWith({ ...reference(1), position: 2 }, queue, 1);
});
it("remembers an empty exhausted extreme without repeating its GET", async () => {
  let requests = 0;
  server.use(http.get("/api/forms/approvals/:id/continuation", () => { requests++; return HttpResponse.json(response([])); }));
  const input = props(); const view = renderHook(usePendingApprovalNavigation, { initialProps: input, wrapper });
  await act(() => view.result.current.move(1));
  expect(input.onNavigate).not.toHaveBeenCalled();
  view.rerender({ ...input, pending: input.onQueue.mock.calls[0][0] });
  expect(view.result.current.next).toBe(false);
  await act(() => view.result.current.move(1)); expect(requests).toBe(1);
});
it("retries the same anchor only after an explicit retry following a failed read", async () => {
  let requests = 0;
  server.use(http.get("/api/forms/approvals/:id/continuation", () => ++requests === 1 ? HttpResponse.error() : HttpResponse.json(response())));
  const input = props(); const view = renderHook(usePendingApprovalNavigation, { initialProps: input, wrapper });
  await act(() => view.result.current.move(1));
  expect(view.result.current.error).toBeTruthy(); expect(requests).toBe(1);
  act(() => view.result.current.retry());
  await waitFor(() => expect(input.onNavigate).toHaveBeenCalledOnce()); expect(requests).toBe(2);
});
it.each(["owner", "selection", "denied", "unmount"])("cancels and removes private continuation metadata after %s changes the owner", async change => {
  let release!: () => void; const gate = new Promise<void>(resolve => { release = resolve; });
  let started!: () => void; const ready = new Promise<void>(resolve => { started = resolve; });
  let signal!: AbortSignal;
  server.use(http.get("/api/forms/approvals/:id/continuation", async ({ request }) => { signal = request.signal; started(); await gate; return HttpResponse.json(response()); }));
  const input = props(); const view = renderHook(usePendingApprovalNavigation, { initialProps: input, wrapper });
  let flight!: Promise<void>; act(() => { flight = view.result.current.move(1); }); await ready;
  if (change === "unmount") view.unmount(); else view.rerender({ ...input, ...(change === "owner" ? { owner: "another:en:decide" } : change === "selection" ? { taskId: tasks[0].id } : { allowed: false }) });
  await waitFor(() => expect(signal.aborted).toBe(true));
  await act(async () => { release(); await flight; });
  expect(input.onQueue).not.toHaveBeenCalled(); expect(input.onNavigate).not.toHaveBeenCalled();
  expect(queryClient.getQueryCache().findAll({ queryKey: ["form-approvals", input.owner, "continuation"] }).every(query => query.state.data === undefined)).toBe(true);
});
it("delegates a forbidden continuation to the approval owner without retaining a read error", async () => {
  server.use(http.get("/api/forms/approvals/:id/continuation", () => HttpResponse.json({ code: "Authorization.Forbidden" }, { status: 403 })));
  const input = props(); const view = renderHook(usePendingApprovalNavigation, { initialProps: input, wrapper });
  await act(() => view.result.current.move(1));
  expect(input.onForbidden).toHaveBeenCalledOnce(); expect(input.onQueue).not.toHaveBeenCalled(); expect(view.result.current.error).toBeNull();
});

it("does not present a cancelled read as a failed navigation", async () => {
  let release!: () => void; const gate = new Promise<void>(resolve => { release = resolve; });
  let started!: () => void; const ready = new Promise<void>(resolve => { started = resolve; });
  server.use(http.get("/api/forms/approvals/:id/continuation", async () => { started(); await gate; return HttpResponse.json(response()); }));
  const input = props(); const view = renderHook(usePendingApprovalNavigation, { initialProps: input, wrapper });
  let flight!: Promise<void>; act(() => { flight = view.result.current.move(1); }); await ready;
  await act(async () => { await queryClient.cancelQueries({ queryKey: ["form-approvals", input.owner, "continuation"] }); release(); await flight; });
  expect(view.result.current.error).toBeNull(); expect(input.onNavigate).not.toHaveBeenCalled();
});

it("inserts a missing successor before later references observed during the same flight", async () => {
  let release!: () => void; const gate = new Promise<void>(resolve => { release = resolve; });
  let started!: () => void; const ready = new Promise<void>(resolve => { started = resolve; });
  server.use(http.get("/api/forms/approvals/:id/continuation", async () => { started(); await gate; return HttpResponse.json({ ...response(), totalCount: 4, hasMore: true }); }));
  const input = props({ ...captured(), totalCount: 5 }); const view = renderHook(usePendingApprovalNavigation, { initialProps: input, wrapper });
  let flight!: Promise<void>; act(() => { flight = view.result.current.move(1); }); await ready;
  const last = task(5);
  view.rerender({ ...input, pending: { ...input.pending, tasks: [...captured().tasks, reference(3), { id: last.id, recordId: last.recordId, requestedAtUtc: last.requestedAtUtc }] } });
  await act(async () => { release(); await flight; });
  const queue = input.onQueue.mock.calls[0][0] as PendingApprovalNavigation;
  expect(queue.tasks.map(item => item.id)).toEqual([...tasks, last].map(item => item.id));
  expect(input.onNavigate).toHaveBeenCalledWith({ ...reference(2), position: 2 }, queue, 1);
  expect(queue.totalCount).toBe(5);
});

it("retains the immutable order when an observed reference is absent from the later continuation", async () => {
  let release!: () => void; const gate = new Promise<void>(resolve => { release = resolve; });
  let started!: () => void; const ready = new Promise<void>(resolve => { started = resolve; });
  const last = task(5);
  server.use(http.get("/api/forms/approvals/:id/continuation", async () => { started(); await gate; return HttpResponse.json({ ...response(),
    items: [tasks[2], last].map((task, index) => ({ task, position: index + 2 })), hasMore: false }); }));
  const input = props({ ...captured(), totalCount: 5 }); const view = renderHook(usePendingApprovalNavigation, { initialProps: input, wrapper });
  let flight!: Promise<void>; act(() => { flight = view.result.current.move(1); }); await ready;
  view.rerender({ ...input, pending: { ...input.pending, tasks: [...captured().tasks, reference(3)] } });
  await act(async () => { release(); await flight; });
  const queue = input.onQueue.mock.calls[0][0] as PendingApprovalNavigation;
  expect(queue.tasks.map(item => item.id)).toEqual([...tasks, last].map(item => item.id));
  expect(input.onNavigate).toHaveBeenCalledWith({ ...reference(2), position: 2 }, queue, 1);
  expect(queue.totalCount).toBe(5);
});

it.each([
  { label: "equal timestamps use canonical TaskId", existingId: 10, incomingId: 20, existingTime: "2026-10-16T12:00:00Z", incomingTime: "2026-10-16T12:00:00.0000000Z", existingFirst: true },
  { label: "missing fractional zeros precede a nonzero fraction", existingId: 20, incomingId: 10, existingTime: "2026-10-16T12:00:00Z", incomingTime: "2026-10-16T12:00:00.0000001Z", existingFirst: true },
  { label: "submillisecond precision precedes TaskId", existingId: 10, incomingId: 20, existingTime: "2026-10-16T12:00:00.0000002Z", incomingTime: "2026-10-16T12:00:00.0000001Z", existingFirst: false },
])("merges by the immutable UTC and TaskId key: $label", async sample => {
  const initial = tasks.slice(0, 2).map(task => ({ ...task, requestedAtUtc: "2026-10-16T12:00:00Z" }));
  const existing = { ...task(sample.existingId), id: task(sample.existingId).id.toUpperCase(), requestedAtUtc: sample.existingTime };
  const incoming = { ...task(sample.incomingId), requestedAtUtc: sample.incomingTime };
  const ref = (task: typeof incoming) => ({ id: task.id, recordId: task.recordId, requestedAtUtc: task.requestedAtUtc });
  let release!: () => void; const gate = new Promise<void>(resolve => { release = resolve; });
  let started!: () => void; const ready = new Promise<void>(resolve => { started = resolve; });
  server.use(http.get("/api/forms/approvals/:id/continuation", async () => { started(); await gate; return HttpResponse.json({ ...response(),
    items: [{ task: incoming, position: 2 }], totalCount: 2, hasMore: false }); }));
  const input = props({ ...captured(), tasks: initial.map(ref) }); const view = renderHook(usePendingApprovalNavigation, { initialProps: input, wrapper });
  let flight!: Promise<void>; act(() => { flight = view.result.current.move(1); }); await ready;
  view.rerender({ ...input, pending: { ...input.pending, tasks: [...input.pending.tasks, ref(existing)] } });
  await act(async () => { release(); await flight; });
  const queue = input.onQueue.mock.calls[0][0] as PendingApprovalNavigation;
  expect(queue.tasks.map(task => task.id)).toEqual([...initial, ...(sample.existingFirst ? [existing, incoming] : [incoming, existing])].map(task => task.id));
  expect(input.onNavigate.mock.calls[0][0].id).toBe(sample.existingFirst ? existing.id : incoming.id);
});
