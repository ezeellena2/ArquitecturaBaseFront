import { StrictMode, useEffect } from "react";

import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@/shared/api/ApiError";
import { acceptFormPublication, fetchFormPublication } from "../api/forms";
import { fixtureDefinition } from "@/test/visual/formFixtures";
import { openDraftSession } from "../draftSession";
import { useFormPublication } from "./useFormPublication";
vi.mock("../api/forms", () => ({ acceptFormPublication: vi.fn(), fetchFormPublication: vi.fn() }));
const definition = fixtureDefinition();
const body = { ...openDraftSession({ actorId: "a", editorId: "p" }, definition).value, expectedRevision: 1 };
const scope = { actorId: "a", culture: "es" as const, permissions: ["formtemplates.read", "formtemplates.publish"] };
const checked = { definitionId: definition.id, draftRevision: 1, compatibility: "LocallyValidated" as const,
  canAccept: true, acceptanceAvailability: "Available" as const, checkToken: "private-ticket", checkExpiresAtUtc: "2099-10-10T16:00:00Z",
  channels: [], issues: [], diff: { baseVersionId: null, added: [], changed: [], removed: [] } };
const identity = { definitionId: definition.id, requestId: "01990000-0000-7000-8000-000000000090", operationId: "01990000-0000-7000-8000-000000000091",
  versionId: "01990000-0000-7000-8000-000000000092", versionNumber: 1, draftRevision: 1, acceptedAtUtc: "2026-10-10T16:00:00Z" } as const;
const receipt = { ...identity, state: "Accepted" as const, recoveryPath: `/api/forms/definitions/${definition.id}/publications/${identity.requestId}` };
const status = { ...identity, state: "Publishing" as const, stage: "Validate", updatedAtUtc: identity.acceptedAtUtc, nextCheckAtUtc: null, canRetry: false, requiresReview: false, issues: [] };
beforeEach(() => { vi.mocked(acceptFormPublication).mockReset(); vi.mocked(fetchFormPublication).mockReset(); vi.spyOn(crypto, "randomUUID").mockReturnValue(identity.requestId); });
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });
describe("owned publication attempt", () => {
  it("preserves a publication attempt when only Manage changes", async () => {
    let resolve: (value: typeof receipt) => void = () => {};
    vi.mocked(acceptFormPublication).mockImplementation(() => new Promise(done => { resolve = done; }));
    const { result, rerender } = renderHook(({ permissions }) => useFormPublication({ ...scope, permissions }), { initialProps: { permissions: [...scope.permissions, "formtemplates.manage"] } });
    act(() => { void result.current.accept(definition.id, body, checked); });
    rerender({ permissions: scope.permissions });
    await act(async () => resolve(receipt));
    expect(result.current.receipt).toEqual(receipt);
  });
  it("clears private attempts on loss of Publish and permits a fresh attempt after access returns", async () => {
    vi.mocked(acceptFormPublication).mockRejectedValueOnce(ApiError.network()).mockResolvedValueOnce(receipt);
    const { result, rerender } = renderHook(({ permissions }) => useFormPublication({ ...scope, permissions }), { initialProps: { permissions: scope.permissions } });
    await act(() => result.current.accept(definition.id, body, checked));
    rerender({ permissions: ["formtemplates.read"] });
    expect(result.current.phase).toBe("Idle");
    rerender({ permissions: scope.permissions });
    await act(() => result.current.accept(definition.id, body, checked));
    expect(result.current.receipt).toEqual(receipt);
  });

  it("polls only GET after acceptance and stops when publication is confirmed", async () => {
    vi.useFakeTimers();
    vi.mocked(acceptFormPublication).mockResolvedValue(receipt);
    vi.mocked(fetchFormPublication).mockResolvedValue({ ...status, state: "Published", stage: "Complete" });
    const { result } = renderHook(() => useFormPublication(scope));
    await act(() => result.current.accept(definition.id, body, checked));
    await act(() => vi.advanceTimersByTimeAsync(30000));
    expect(result.current.status?.state).toBe("Published");
    await act(() => vi.advanceTimersByTimeAsync(60000));
    expect(fetchFormPublication).toHaveBeenCalledTimes(1);
    expect(acceptFormPublication).toHaveBeenCalledTimes(1);
  });
  it("keeps its receipt when status belongs to another version", async () => {
    vi.mocked(acceptFormPublication).mockResolvedValue(receipt);
    vi.mocked(fetchFormPublication).mockResolvedValue({ ...status, versionId: "01990000-0000-7000-8000-000000000099" });
    const { result } = renderHook(() => useFormPublication(scope));
    await act(() => result.current.accept(definition.id, body, checked));
    await act(() => result.current.consult());
    expect(result.current.receipt).toEqual(receipt);
    expect(result.current.status).toBeNull();
    expect(result.current.error).toBeInstanceOf(Error);
    expect(result.current.confirmed).toBe(true);
  });
  it("freezes all nested content at acceptance rather than sharing editable maps", async () => {
    vi.mocked(acceptFormPublication).mockRejectedValue(ApiError.network());
    const { result } = renderHook(() => useFormPublication(scope));
    const mutable = structuredClone(body);
    await act(() => result.current.accept(definition.id, mutable, checked));
    Reflect.set(mutable.name, "es", "Changed after sending");
    Reflect.set(mutable.draft.fields[0]!.label, "es", "Changed question");
    const posted = vi.mocked(acceptFormPublication).mock.calls[0]![1];
    expect(posted.name.es).toBe(body.name.es);
    expect(posted.draft.fields[0]!.label.es).toBe(body.draft.fields[0]!.label.es);
  });

  it("accepts only on explicit click with Read and Publish, without Manage", async () => {
    vi.mocked(acceptFormPublication).mockResolvedValue(receipt);
    const { result } = renderHook(() => useFormPublication(scope));
    expect(acceptFormPublication).not.toHaveBeenCalled();
    await act(() => result.current.accept(definition.id, body, checked));
    expect(result.current.receipt?.state).toBe("Accepted");
    expect(result.current.status).toBeNull();
    expect(result.current.confirmed).toBe(true);
    expect(fetchFormPublication).not.toHaveBeenCalled();
  });
  it("keeps UUID, ticket and body after uncertainty; 404 permits only explicit exact replay", async () => {
    vi.mocked(acceptFormPublication).mockRejectedValueOnce(ApiError.network()).mockResolvedValueOnce(receipt);
    vi.mocked(fetchFormPublication).mockRejectedValue(new ApiError(404, { code: "Forms.Publication.NotFound" }));
    const { result } = renderHook(() => useFormPublication(scope));
    await act(() => result.current.accept(definition.id, body, checked));
    expect(result.current.phase).toBe("Unconfirmed");
    expect(acceptFormPublication).toHaveBeenCalledTimes(1);
    await act(() => result.current.accept(definition.id, { ...body, prefix: "OTHER" }, checked));
    expect(acceptFormPublication).toHaveBeenCalledTimes(1);
    await act(() => result.current.consult());
    expect(result.current.canReplay).toBe(true);
    expect(result.current.confirmed).toBe(false);
    await act(() => result.current.replay());
    const first = vi.mocked(acceptFormPublication).mock.calls[0]![1];
    const second = vi.mocked(acceptFormPublication).mock.calls[1]![1];
    expect(second).toBe(first);
    expect(first).toMatchObject({ requestId: identity.requestId, checkToken: "private-ticket", prefix: body.prefix });
    expect(crypto.randomUUID).toHaveBeenCalledTimes(1);
  });
  it("consults the same operation after acceptance and does not interpret Publishing as Published", async () => {
    vi.mocked(acceptFormPublication).mockResolvedValue(receipt); vi.mocked(fetchFormPublication).mockResolvedValue(status);
    const { result } = renderHook(() => useFormPublication(scope));
    await act(() => result.current.accept(definition.id, body, checked));
    await act(() => result.current.consult());
    expect(result.current.status?.state).toBe("Publishing");
    expect(result.current.receipt?.versionId).toBe(receipt.versionId);
    expect(acceptFormPublication).toHaveBeenCalledTimes(1);
  });
  it("rejects a late response after ownership changes even if cancellation is ignored", async () => {
    let resolve: (value: typeof receipt) => void = () => {};
    vi.mocked(acceptFormPublication).mockImplementation(() => new Promise(done => { resolve = done; }));
    const { result, rerender } = renderHook(({ actorId }) => useFormPublication({ ...scope, actorId }), { initialProps: { actorId: "a" } });
    act(() => { void result.current.accept(definition.id, body, checked); });
    rerender({ actorId: "b" });
    await act(async () => resolve(receipt));
    await waitFor(() => expect(result.current.receipt).toBeNull());
    expect(result.current.confirmed).toBe(false);
    expect(result.current.phase).toBe("Idle");
  });
  it("suppresses duplicate acceptance while the first request is running", async () => {
    vi.mocked(acceptFormPublication).mockImplementation(() => new Promise(() => {}));
    const { result, unmount } = renderHook(() => useFormPublication(scope));
    act(() => { void result.current.accept(definition.id, body, checked); void result.current.accept(definition.id, body, checked); });
    expect(acceptFormPublication).toHaveBeenCalledTimes(1);
    unmount();
    expect(vi.mocked(acceptFormPublication).mock.calls[0]![2]?.aborted).toBe(true);
  });
  it.each(["formtemplates.read", "formtemplates.publish"])("requires %s before accepting", async permission => {
    const { result } = renderHook(() => useFormPublication({ ...scope, permissions: scope.permissions.filter(p => p !== permission) }));
    await act(() => result.current.accept(definition.id, body, checked));
    expect(acceptFormPublication).not.toHaveBeenCalled();
  });
  it("does not accept an expired or mismatched check", async () => {
    const { result } = renderHook(() => useFormPublication(scope));
    await act(() => result.current.accept(definition.id, body, { ...checked, checkExpiresAtUtc: "2000-01-01T00:00:00Z" }));
    await act(() => result.current.accept(definition.id, body, { ...checked, draftRevision: 2 }));
    expect(acceptFormPublication).not.toHaveBeenCalled();
  });
  it("requires a new check on a definitive CheckExpired response", async () => {
    vi.mocked(acceptFormPublication).mockRejectedValue(new ApiError(409, { code: "Forms.Publication.CheckExpired" }));
    const { result } = renderHook(() => useFormPublication(scope));
    await act(() => result.current.accept(definition.id, body, checked));
    expect(result.current.phase).toBe("Rejected");
    expect(result.current.confirmed).toBe(false);
    expect(result.current.canReplay).toBe(false);
  });
});

describe("publication recovery from safe detail",()=>{
 const projection={activeVersion:null,currentOperation:{versionId:identity.versionId,versionNumber:1,draftRevision:1,state:"Publishing" as const,stage:"Publishing",requiresReview:false,canRetry:false as const,requestId:identity.requestId,recoveryPath:receipt.recoveryPath},displayState:"Publishing" as const};
 it("recovers its authorized UUID without reconstructing or posting an acceptance body",async()=>{
  vi.mocked(fetchFormPublication).mockResolvedValue({...status,state:"Published"});
  const {result}=renderHook(()=>useFormPublication(scope));
  await act(()=>result.current.resume(definition.id,projection));
  expect(fetchFormPublication).toHaveBeenCalledWith(definition.id,identity.requestId,expect.any(AbortSignal));
  expect(result.current.status?.state).toBe("Published");expect(result.current.canReplay).toBe(false);expect(acceptFormPublication).not.toHaveBeenCalled();
 });
 it("never consults an aggregate operation owned by another actor",async()=>{
  const {result}=renderHook(()=>useFormPublication(scope));
  await act(()=>result.current.resume(definition.id,{...projection,currentOperation:{...projection.currentOperation,requestId:null,recoveryPath:null}}));
  expect(fetchFormPublication).not.toHaveBeenCalled();expect(acceptFormPublication).not.toHaveBeenCalled();
 });
 it("keeps GET-only recovery after a missing reloaded operation",async()=>{
  vi.mocked(fetchFormPublication).mockRejectedValue(new ApiError(404,{code:"Forms.Publication.NotFound"}));
  const {result}=renderHook(()=>useFormPublication(scope));await act(()=>result.current.resume(definition.id,projection));
  expect(result.current.canReplay).toBe(false);await act(()=>result.current.replay());expect(acceptFormPublication).not.toHaveBeenCalled();
 });
});

describe("publication recovery lifecycle", () => {
 it("completes GET-only recovery under StrictMode effect replay", async () => {
  vi.mocked(fetchFormPublication).mockImplementation(async (_definition, _request, signal) => {
   await Promise.resolve();
   if (signal?.aborted) throw new DOMException("Aborted", "AbortError");
   return { ...status, state: "Failed", stage: "Create" };
  });
  const projection = {activeVersion:null,currentOperation:{versionId:identity.versionId,versionNumber:1,draftRevision:1,state:"Failed" as const,stage:"Create",requiresReview:false,canRetry:false as const,requestId:identity.requestId,recoveryPath:receipt.recoveryPath},displayState:"Failed" as const};
  const { result } = renderHook(() => {
   const publication = useFormPublication(scope);
   const { resume } = publication;
   useEffect(() => { void resume(definition.id, projection); }, [resume]);
   return publication;
  }, {wrapper: StrictMode});
  await waitFor(() => expect(result.current.busy).toBe(false));
  expect(result.current.status?.state).toBe("Failed");
  expect(result.current.canReplay).toBe(false);
  expect(acceptFormPublication).not.toHaveBeenCalled();
 });
});
