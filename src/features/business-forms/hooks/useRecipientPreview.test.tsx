import { act, renderHook, waitFor } from "@testing-library/react";
import { QueryClientProvider } from "@tanstack/react-query";
import type { PropsWithChildren } from "react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { ApiError } from "@/shared/api/ApiError";
import { createQueryClient } from "@/shared/api/queryClient";
import { fetchRecipientMaximum, previewRecipient } from "../api/recipientPreview";
import type { DraftQuestionSource } from "../model";
import { useRecipientMaximum, useRecipientPreview } from "./useRecipientPreview";
vi.mock("../api/recipientPreview", () => ({ previewRecipient: vi.fn(), fetchRecipientMaximum: vi.fn() }));
const scope = { actorId: "actor", culture: "es" as const, permissions: ["formtemplates.read", "formtemplates.manage", "formcatalogs.read"] };
const source = { catalog: "catalog", match: [{ fieldId: "branch", personAttributeId: "attribute" }] };
const data = (name: string) => ({ recipient: { id: name, name, values: [] }, state: "Ready" as const, optionCount: 1, limit: 200 as const, exceedsLimit: false, options: [{ id: "option", title: name, description: null }] });
function mount(permissions = scope.permissions) { const client = createQueryClient(); function Wrapper({ children }: PropsWithChildren) { return <QueryClientProvider client={client}>{children}</QueryClientProvider>; }
 const hook = renderHook(({ actorId, catalog }) => useRecipientPreview({ ...scope, actorId, permissions }, "form", "question", "choice", { ...source, catalog }), { wrapper: Wrapper, initialProps: { actorId: "actor", catalog: "catalog" } }); return { ...hook, client }; }
beforeEach(() => { vi.clearAllMocks(); vi.mocked(previewRecipient).mockImplementation((_id, body) => Promise.resolve(data(body.sampleUserId))); });
afterEach(() => { vi.useRealTimers(); });
it("previews an explicit sample outside mutation and query caches without persisting the draft", async () => { const { result, client } = mount(); expect(previewRecipient).not.toHaveBeenCalled(); act(() => result.current.select({ id: "Ana", name: "Ana" })); await waitFor(() => expect(result.current.result?.recipient.id).toBe("Ana")); expect(previewRecipient).toHaveBeenCalledWith("form", { type: "choice", source, sampleUserId: "Ana", culture: "es" }, expect.any(AbortSignal)); expect(client.getMutationCache().getAll()).toEqual([]); expect(client.getQueryCache().getAll()).toEqual([]); });
it("ignores another recipient's late preview and immediately hides stale options", async () => { const { result } = mount(); let finish!: (value: ReturnType<typeof data>) => void; let firstSignal!: AbortSignal;
 vi.mocked(previewRecipient).mockImplementationOnce((_id, _body, signal) => { firstSignal = signal!; return new Promise(resolve => { finish = resolve; }); }); act(() => result.current.select({ id: "Ana", name: "Ana" })); await waitFor(() => expect(previewRecipient).toHaveBeenCalledTimes(1)); act(() => result.current.select({ id: "Luis", name: "Luis" })); expect(result.current.result).toBeNull(); await waitFor(() => expect(result.current.result?.recipient.id).toBe("Luis")); expect(firstSignal.aborted).toBe(true); await act(async () => { finish(data("Ana")); }); expect(result.current.result?.recipient.id).toBe("Luis"); });
it("retires the selected person when ownership changes and never applies the old result", async () => { const { result, rerender } = mount(); act(() => result.current.select({ id: "Ana", name: "Ana" })); await waitFor(() => expect(result.current.result).not.toBeNull()); rerender({ actorId: "other", catalog: "catalog" }); expect(result.current.person).toBeNull(); expect(result.current.result).toBeNull(); });
it("clears stale options after a source change and a failed preview", async () => { const { result, rerender } = mount(); act(() => result.current.select({ id: "Ana", name: "Ana" })); await waitFor(() => expect(result.current.result).not.toBeNull()); vi.mocked(previewRecipient).mockRejectedValue(new ApiError(409, { code: "Forms.Catalog.FilterUnavailable" })); rerender({ actorId: "actor", catalog: "other" }); expect(result.current.result).toBeNull(); await waitFor(() => expect(result.current.error).toBeInstanceOf(ApiError)); expect(result.current.result).toBeNull(); });
it("does not prepare a recipient preview without formcatalogs.read", async () => { const { result } = mount(["formtemplates.read", "formtemplates.manage"]); expect(result.current.available).toBe(false); act(() => result.current.select({ id: "Ana", name: "Ana" })); await act(async () => {}); expect(result.current.person).toBeNull(); expect(result.current.busy).toBe(false); expect(previewRecipient).not.toHaveBeenCalled(); });
it("retries a failed preview only by explicit action and waits the Retry-After of a 429", async () => { const { result } = mount();
 vi.mocked(previewRecipient).mockRejectedValueOnce(new ApiError(500, { traceId: "trace" })); act(() => result.current.select({ id: "Ana", name: "Ana" })); await waitFor(() => expect(result.current.error).toBeInstanceOf(ApiError)); expect(result.current).toMatchObject({ canRetry: true, waitSeconds: 0 }); expect(previewRecipient).toHaveBeenCalledTimes(1);
 act(() => result.current.retry()); await waitFor(() => expect(result.current.result?.state).toBe("Ready")); expect(previewRecipient).toHaveBeenCalledTimes(2);
 vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "performance"] }); vi.mocked(previewRecipient).mockRejectedValueOnce(new ApiError(429, { retryAfter: 2 })); act(() => result.current.select({ id: "Luis", name: "Luis" })); await act(() => vi.advanceTimersByTimeAsync(0));
 expect(result.current.error).toBeInstanceOf(ApiError); expect(result.current).toMatchObject({ canRetry: false, waitSeconds: 2 }); act(() => result.current.retry()); expect(previewRecipient).toHaveBeenCalledTimes(3);
 await act(() => vi.advanceTimersByTimeAsync(1000)); expect(result.current).toMatchObject({ canRetry: false, waitSeconds: 1 });
 await act(() => vi.advanceTimersByTimeAsync(1000)); expect(result.current).toMatchObject({ canRetry: true, waitSeconds: 0 }); expect(previewRecipient).toHaveBeenCalledTimes(3);
 act(() => result.current.retry()); await act(() => vi.advanceTimersByTimeAsync(0)); expect(result.current.result?.recipient.id).toBe("Luis"); expect(previewRecipient).toHaveBeenCalledTimes(4); });
it("does not show the wait of a 429 on a later preview that cannot be retried", async () => { const { result } = mount();
 vi.mocked(previewRecipient).mockRejectedValueOnce(new ApiError(429, {})); act(() => result.current.select({ id: "Ana", name: "Ana" })); await waitFor(() => expect(result.current.error).toBeInstanceOf(ApiError)); expect(result.current).toMatchObject({ canRetry: false, waitSeconds: 60 });
 vi.mocked(previewRecipient).mockRejectedValueOnce(new ApiError(409, { code: "Forms.Catalog.FilterUnavailable" })); act(() => result.current.select({ id: "Luis", name: "Luis" })); await waitFor(() => expect((result.current.error as ApiError | null)?.status).toBe(409));
 expect(result.current).toMatchObject({ canRetry: false, waitSeconds: 0 }); expect(previewRecipient).toHaveBeenCalledTimes(2); });

const shared = (maximum: number) => ({ maximum, maximumLabel: null });
const fixed = (value: string | null): DraftQuestionSource => ({ catalog: "catalog", match: [{ fieldId: "kind", value }] });
function mountMaximum(initial: DraftQuestionSource | null, permissions = scope.permissions) {
  return renderHook(({ value, actorId }) => useRecipientMaximum({ ...scope, actorId, permissions }, value), { initialProps: { value: initial, actorId: "actor" } });
}
it("reads the maximum only for complete filters with the three permissions, without the presentation or a body cache", async () => {
  vi.mocked(fetchRecipientMaximum).mockImplementation(body => Promise.resolve(shared(body.match?.length ?? 0)));
  const denied = mountMaximum(source, ["formtemplates.read", "formtemplates.manage"]);
  const { result, rerender } = mountMaximum(fixed(null));
  rerender({ value: { catalog: "catalog", match: [] }, actorId: "actor" });
  await act(async () => {});
  expect(denied.result.current.result).toBeNull();
  expect(result.current.result).toBeNull();
  expect(fetchRecipientMaximum).not.toHaveBeenCalled();
  rerender({ value: { ...source, presentation: { title: ["code"], description: [] } }, actorId: "actor" });
  await waitFor(() => expect(result.current.result).toEqual(shared(1)));
  expect(fetchRecipientMaximum).toHaveBeenCalledExactlyOnceWith(source, expect.any(AbortSignal));
  // The presentation does not change the maximum: choosing another one reads nothing again.
  rerender({ value: { ...source, presentation: { title: ["text"], description: [] } }, actorId: "actor" });
  expect(result.current.result).toEqual(shared(1));
  // Another owner drops the answer at once; losing the filters aborts its read.
  let signal!: AbortSignal;
  vi.mocked(fetchRecipientMaximum).mockImplementationOnce((_body, abort) => { signal = abort!; return new Promise(() => {}); });
  rerender({ value: source, actorId: "other" });
  expect(result.current.result).toBeNull();
  await waitFor(() => expect(fetchRecipientMaximum).toHaveBeenCalledTimes(2));
  rerender({ value: null, actorId: "other" });
  expect(signal.aborted).toBe(true);
});
it("reads the maximum once, 300 ms after the last filter change, and shows nothing meanwhile", async () => {
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "performance"] });
  vi.mocked(fetchRecipientMaximum).mockReset().mockResolvedValue(shared(3));
  const { result, rerender } = mountMaximum(fixed("F"));
  // Typing a fixed value changes the filters on every key: the route shares the forms write limit with Guardar.
  for (const value of ["Fr", "Frí", "Frío"]) {
    await act(() => vi.advanceTimersByTimeAsync(100));
    rerender({ value: fixed(value), actorId: "actor" });
  }
  await act(() => vi.advanceTimersByTimeAsync(299));
  expect(fetchRecipientMaximum).not.toHaveBeenCalled();
  expect(result.current.result).toBeNull();
  await act(() => vi.advanceTimersByTimeAsync(1));
  expect(fetchRecipientMaximum).toHaveBeenCalledExactlyOnceWith(fixed("Frío"), expect.any(AbortSignal));
  expect(result.current.result).toEqual(shared(3));
  // Another value hides the previous answer at once and is never read if it does not last 300 ms.
  rerender({ value: fixed("Fríos"), actorId: "actor" });
  expect(result.current.result).toBeNull();
  await act(() => vi.advanceTimersByTimeAsync(200));
  rerender({ value: fixed("Frío"), actorId: "actor" });
  await act(() => vi.advanceTimersByTimeAsync(300));
  expect(fetchRecipientMaximum).toHaveBeenCalledTimes(2);
  expect(fetchRecipientMaximum).toHaveBeenLastCalledWith(fixed("Frío"), expect.any(AbortSignal));
});
it("retries a failed maximum only by explicit action and waits the Retry-After of a 429", async () => {
  vi.mocked(fetchRecipientMaximum).mockReset().mockRejectedValueOnce(new ApiError(500, { traceId: "trace" })).mockResolvedValue(shared(18));
  const { result, rerender } = mountMaximum(source);
  await waitFor(() => expect(result.current.failed).toBe(true));
  expect(result.current).toMatchObject({ result: null, canRetry: true, waitSeconds: 0 });
  act(() => result.current.retry());
  await waitFor(() => expect(result.current.result).toEqual(shared(18)));
  expect(result.current.failed).toBe(false);
  expect(fetchRecipientMaximum).toHaveBeenCalledTimes(2);
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "performance"] });
  vi.mocked(fetchRecipientMaximum).mockRejectedValueOnce(new ApiError(429, { retryAfter: 2 }));
  rerender({ value: fixed("cold"), actorId: "actor" });
  await act(() => vi.advanceTimersByTimeAsync(300));
  expect(result.current).toMatchObject({ result: null, failed: true, canRetry: false, waitSeconds: 2 });
  act(() => result.current.retry());
  await act(() => vi.advanceTimersByTimeAsync(2000));
  expect(result.current).toMatchObject({ failed: true, canRetry: true, waitSeconds: 0 });
  expect(fetchRecipientMaximum).toHaveBeenCalledTimes(3);
  act(() => result.current.retry());
  await act(() => vi.advanceTimersByTimeAsync(300));
  expect(result.current.result).toEqual(shared(18));
  expect(fetchRecipientMaximum).toHaveBeenCalledTimes(4);
  // Rejected filters are not a failure to retry: the filters themselves say what is wrong.
  vi.mocked(fetchRecipientMaximum).mockRejectedValueOnce(new ApiError(400, { code: "Forms.Publication.MatchInvalid" }));
  rerender({ value: fixed("other"), actorId: "actor" });
  await act(() => vi.advanceTimersByTimeAsync(300));
  expect(result.current).toMatchObject({ result: null, failed: false, canRetry: false, waitSeconds: 0 });
});
