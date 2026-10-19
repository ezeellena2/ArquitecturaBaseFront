import { StrictMode, type PropsWithChildren } from "react";
import { QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@/shared/api/ApiError";
import { createQueryClient } from "@/shared/api/queryClient";
import * as chatApi from "../api/chat";
import type { Thread } from "../api/chat";
import { useChatThread } from "./useChatThread";

const scope = { actor: "operator-a", culture: "es", permissions: ["whatsapp.read", "formrecords.read"] };
function thread(body: string, older = false, more = false): Thread {
  return { assistantSuggestion: null, assistantAvailability: { state: "notInstalled" }, contact: { id: "chat-a", profileName: "Recipient", phoneNumber: null, mode: "Manual", modeRevision: 1,
    lastInboundAtUtc: "2026-10-11T12:00:00Z", lastInboundSequence: 1, unreadCount: 0, preview: null },
    messages: [{ audio: null, quickReplies: null, assistant: null, origin: "Conversation" as const, id: older ? more ? "older-first" : "older-last" : "latest", direction: "Inbound", body, kind: "Text", occurredAtUtc: older ? "2026-10-10T12:00:00Z" : "2026-10-11T12:00:00Z",
      inboundSequence: 1, operatorUserId: null, status: null, errorCode: null }], outgoing: [],
    beforeAtUtc: older && !more ? null : "2026-10-11T12:00:00Z", beforeId: older ? more ? "older-first" : null : "latest" };
}
function harness(strict = false) {
  const client = createQueryClient(); client.setDefaultOptions({ queries: { retry: false } });
  function Wrapper({ children }: PropsWithChildren) { return <QueryClientProvider client={client}>{strict ? <StrictMode>{children}</StrictMode> : children}</QueryClientProvider>; }
  return { client, wrapper: Wrapper };
}
afterEach(() => vi.restoreAllMocks());

describe("chat private read context", () => {
  it.each(["permission", "actor", "culture", "conversation"])("removes all historical pages and the latest cached payload after %s changes", async change => {
    const h = harness(); let oldContext = true;
    vi.spyOn(chatApi, "getThread").mockImplementation(async (_id, cursor) => thread(oldContext ? cursor ? cursor.id === "latest" ? "private older marker" : "private oldest marker" : "private latest marker" : "new context", Boolean(cursor), cursor?.id === "latest"));
    const hook = renderHook(({ context, id }) => useChatThread(id, context, false), { ...h, initialProps: { context: scope, id: "chat-a" } });
    await waitFor(() => expect(hook.result.current.messages.some(m => m.body === "private latest marker")).toBe(true));
    await act(async () => { await hook.result.current.history.fetchNextPage(); });
    await waitFor(() => expect(hook.result.current.messages.some(m => m.body === "private older marker")).toBe(true));
    await act(async () => { await hook.result.current.history.fetchNextPage(); });
    await waitFor(() => expect(hook.result.current.messages.some(m => m.body === "private oldest marker")).toBe(true));
    expect(hook.result.current.messages).toHaveLength(3);
    oldContext = false;
    const context = { ...scope, ...(change === "actor" ? { actor: "operator-b" } : change === "culture" ? { culture: "en" } : change === "permission" ? { permissions: ["whatsapp.read"] } : {}) };
    hook.rerender({ context, id: change === "conversation" ? "chat-b" : "chat-a" });
    expect(hook.result.current.messages.every(m => !m.body?.includes("private"))).toBe(true);
    await waitFor(() => expect(JSON.stringify(h.client.getQueryCache().getAll().map(q => q.state.data))).not.toContain("private"));
    await waitFor(() => expect(hook.result.current.messages.some(m => m.body === "new context")).toBe(true));
    hook.unmount(); expect(h.client.getQueryCache().getAll()).toHaveLength(0);
  });
  it("does not read without whatsapp.read or reapply an old result arriving after revocation", async () => {
    const h = harness(); let resolve!: (value: Thread) => void;
    const reads = vi.spyOn(chatApi, "getThread").mockImplementation(() => new Promise<Thread>(done => { resolve = done; }));
    const hook = renderHook(({ context }) => useChatThread("chat-a", context, false), { ...h, initialProps: { context: scope } });
    await waitFor(() => expect(reads).toHaveBeenCalledOnce());
    hook.rerender({ context: { ...scope, permissions: [] } });
    await act(async () => { resolve(thread("late private marker")); });
    expect(hook.result.current.messages).toEqual([]);
    expect(JSON.stringify(h.client.getQueryCache().getAll().map(q => q.state.data))).not.toContain("late private");
    await act(async () => { await hook.result.current.history.fetchNextPage(); });
    expect(reads).toHaveBeenCalledOnce(); hook.unmount();
  });
  it("keeps the same context when permission ordering or duplication changes", async () => {
    const h = harness(); const reads = vi.spyOn(chatApi, "getThread").mockResolvedValue(thread("current context"));
    const hook = renderHook(({ context }) => useChatThread("chat-a", context, false), { ...h, initialProps: { context: scope } });
    await waitFor(() => expect(hook.result.current.messages).toHaveLength(1));
    hook.rerender({ context: { ...scope, permissions: ["formrecords.read", "whatsapp.read", "whatsapp.read"] } });
    expect(hook.result.current.messages).toHaveLength(1); expect(reads).toHaveBeenCalledOnce(); hook.unmount();
  });
  it("keeps a usable current result under StrictMode and removes it on unmount", async () => {
    const h = harness(true); vi.spyOn(chatApi, "getThread").mockResolvedValue(thread("current context"));
    const hook = renderHook(() => useChatThread("chat-a", scope, false), h);
    await waitFor(() => expect(hook.result.current.messages).toHaveLength(1));
    hook.unmount(); expect(h.client.getQueryCache().getAll()).toHaveLength(0);
  });
});


it("cancels an in-flight value-bearing read on loss of formrecords.read while keeping chat read enabled", async () => {
  const h = harness(); let resolve!: (value: Thread) => void;
  const reads = vi.spyOn(chatApi, "getThread").mockImplementationOnce(() => new Promise<Thread>(done => { resolve = done; })).mockResolvedValue(thread("Authorized chat text"));
  const hook = renderHook(({ context }) => useChatThread("chat-a", context, false), { ...h, initialProps: { context: scope } });
  await waitFor(() => expect(reads).toHaveBeenCalledOnce());
  const oldSignal = reads.mock.calls[0][2]!;
  hook.rerender({ context: { ...scope, permissions: ["whatsapp.read"] } });
  expect(oldSignal.aborted).toBe(true);
  await waitFor(() => expect(hook.result.current.messages.some(m => m.body === "Authorized chat text")).toBe(true));
  await act(async () => { resolve(thread("revoked late private marker")); });
  expect(JSON.stringify(h.client.getQueryCache().getAll().map(q => q.state.data))).not.toContain("revoked late private");
  expect(hook.result.current.messages.every(m => m.body === "Authorized chat text")).toBe(true);
  hook.unmount();
});

// Synthetic projection samples exercise cache authorization; they are not captured HTTP bodies.
function replyThread(marker: string | null, allow: boolean, older = false, more = false): Thread {
  const base = thread('Safe chat text', older, more);
  const message = { ...base.messages[0], kind: 'FlowReply', body: null,
    formReply: { state: 'Completed', name: 'Historical form', definitionId: '01a120d4-1415-7ca1-a73d-cabbfa72e695',
      versionId: '01a120d3-7f84-7471-ae4f-fa71986768f5', versionNumber: 1, recordId: '01a10cf6-23c4-7641-b084-a486091df430', number: 'VIS-000001',
      values: marker === null ? null : [{ fieldId: '01a125cf-b2a7-70ee-b027-9a7e8e4c4031', key: 'notes', type: 'longText', label: 'Historical notes', value: marker }] } };
  return Object.assign(base, { canReadFormRecords: allow, messages: [message] });
}
it('honors authoritative server revocation across every cached page with unchanged actor and permissions', async () => {
  const h = harness(); let revoked = false;
  vi.spyOn(chatApi, 'getThread').mockImplementation(async (_id, cursor) => replyThread(revoked ? null : cursor ? cursor.id === 'latest' ? 'private middle answer' : 'private oldest answer' : 'private current answer', !revoked, Boolean(cursor), cursor?.id === 'latest'));
  const hook = renderHook(() => useChatThread('chat-a', scope, false), h);
  await waitFor(() => expect(JSON.stringify(hook.result.current.messages)).toContain('private current answer'));
  await act(async () => { await hook.result.current.history.fetchNextPage(); });
  await waitFor(() => expect(hook.result.current.history.data?.pages).toHaveLength(1));
  await act(async () => { await hook.result.current.history.fetchNextPage(); });
  await waitFor(() => expect(hook.result.current.history.data?.pages).toHaveLength(2));
  const cacheObservedAfterRevocation: string[] = [];
  const unsubscribe = h.client.getQueryCache().subscribe(event => {
    const data = event.query.state.data as { canReadFormRecords?: boolean } | undefined;
    if (data?.canReadFormRecords === false) cacheObservedAfterRevocation.push(JSON.stringify(h.client.getQueryCache().getAll().map(q => q.state.data)));
  });
  revoked = true;
  await act(async () => { await hook.result.current.latest.refetch(); });
  expect(cacheObservedAfterRevocation.length).toBeGreaterThan(0);
  expect(cacheObservedAfterRevocation.every(data => !data.includes('private'))).toBe(true);
  expect(JSON.stringify(hook.result.current.messages)).not.toContain('private');
  expect(JSON.stringify(h.client.getQueryCache().getAll().map(q => q.state.data))).not.toContain('private');
  expect(hook.result.current.history.data?.pages).toHaveLength(2);
  expect(hook.result.current.messages).toHaveLength(3);
  expect(JSON.stringify(hook.result.current.messages)).toContain('Historical form');
  expect(scope.permissions).toContain('formrecords.read');
  unsubscribe(); hook.unmount();
});
it('cancels late older values after authoritative false and never grants access from an older page', async () => {
  const h = harness(); let resolveOlder!: (value: Thread) => void; let revoked = false;
  const reads = vi.spyOn(chatApi, 'getThread').mockImplementation((_id, cursor) => cursor
    ? cursor.id === 'latest' ? Promise.resolve(replyThread('private cached older answer', true, true, true)) : new Promise<Thread>(done => { resolveOlder = done; })
    : Promise.resolve(replyThread(revoked ? null : 'private current answer', !revoked)));
  const hook = renderHook(() => useChatThread('chat-a', scope, false), h);
  await waitFor(() => expect(hook.result.current.messages).toHaveLength(1));
  await act(async () => { await hook.result.current.history.fetchNextPage(); });
  await waitFor(() => expect(hook.result.current.history.data?.pages).toHaveLength(1));
  let pendingOlder!: Promise<unknown>;
  act(() => { pendingOlder = hook.result.current.history.fetchNextPage(); });
  await waitFor(() => expect(reads).toHaveBeenCalledTimes(3));
  const olderSignal = reads.mock.calls[2][2]!;
  revoked = true;
  await act(async () => { await hook.result.current.latest.refetch(); });
  expect(olderSignal.aborted).toBe(true);
  expect(hook.result.current.history.data?.pages).toHaveLength(1);
  await act(async () => { resolveOlder(replyThread('private late answer', true, true)); await pendingOlder; });
  expect(JSON.stringify(hook.result.current.messages)).not.toContain('private');
  expect(JSON.stringify(h.client.getQueryCache().getAll().map(q => q.state.data))).not.toContain('private');
  expect(scope.permissions).toContain('formrecords.read');
  hook.unmount();
});

it('keeps authoritative denial until a fresh latest read grants access, including an older false and stale latest true', async () => {
  const h = harness(); let latestReads = 0; let resolveLatest!: (value: Thread) => void;
  vi.spyOn(chatApi, 'getThread').mockImplementation((_id, cursor) => {
    if (cursor) return Promise.resolve(replyThread(cursor.id === 'latest' ? null : 'private newer older answer', cursor.id !== 'latest', true, cursor.id === 'latest'));
    latestReads++;
    if (latestReads === 2) return new Promise<Thread>(done => { resolveLatest = done; });
    return Promise.resolve(replyThread(latestReads === 1 ? 'private initial answer' : 'authorized fresh answer', true));
  });
  const hook = renderHook(() => useChatThread('chat-a', scope, false), h);
  await waitFor(() => expect(JSON.stringify(hook.result.current.messages)).toContain('private initial answer'));
  let pendingLatest!: Promise<unknown>;
  act(() => { pendingLatest = hook.result.current.latest.refetch(); });
  await waitFor(() => expect(latestReads).toBe(2));
  await act(async () => { await hook.result.current.history.fetchNextPage(); });
  expect(JSON.stringify(h.client.getQueryCache().getAll().map(q => q.state.data))).not.toContain('private');
  await act(async () => { resolveLatest(replyThread('private stale latest answer', true)); await pendingLatest; });
  expect(JSON.stringify(hook.result.current.messages)).not.toContain('private');
  await act(async () => { await hook.result.current.history.fetchNextPage(); });
  expect(JSON.stringify(h.client.getQueryCache().getAll().map(q => q.state.data))).not.toContain('private');
  await act(async () => { await hook.result.current.latest.refetch(); });
  await waitFor(() => expect(JSON.stringify(hook.result.current.messages)).toContain('authorized fresh answer'));
  expect(JSON.stringify(hook.result.current.messages)).not.toContain('private');
  expect(hook.result.current.history.data?.pages).toHaveLength(2);
  hook.unmount();
});
it('requires both local permission and authoritative true before retaining values', async () => {
  const h = harness(); vi.spyOn(chatApi, 'getThread').mockResolvedValue(replyThread('private denied answer', true));
  const hook = renderHook(() => useChatThread('chat-a', { ...scope, permissions: ['whatsapp.read'] }, false), h);
  await waitFor(() => expect(hook.result.current.messages).toHaveLength(1));
  expect(JSON.stringify(hook.result.current.messages)).not.toContain('private');
  expect(JSON.stringify(h.client.getQueryCache().getAll().map(q => q.state.data))).not.toContain('private');
  expect(hook.result.current.latest.data?.canReadFormRecords).toBe(false);
  hook.unmount();
});

it("withdraws automatic form action bodies from every history page and pending operation on server revocation",async()=>{const h=harness();let revoked=false;const automatic=(older:boolean):Thread=>{const base=thread("safe conversation",older);return {...base,canReadFormRecords:!revoked,messages:[...base.messages,{...base.messages[0],id:older?"action-old":"action-new",direction:"Outbound",origin:"FormAction",kind:"Document",body:"private automatic receipt"}],outgoing:[{ quickReplies: null, assistant: null,id:"action-pending",requestId:"action-pending",operatorUserId:null,origin:"FormAction",kind:"Text",body:"private automatic notice",requestedAtUtc:"2026-10-16T12:00:00Z",state:"Uncertain",waMessageId:null}]};};vi.spyOn(chatApi,"getThread").mockImplementation(async(_id,cursor)=>automatic(!!cursor));const hook=renderHook(()=>useChatThread("chat-a",scope,false),h);await waitFor(()=>expect(JSON.stringify(hook.result.current.messages)).toContain("private automatic receipt"));await act(async()=>{await hook.result.current.history.fetchNextPage();});revoked=true;await act(async()=>{await hook.result.current.latest.refetch();});expect(JSON.stringify(h.client.getQueryCache().getAll().map(query=>query.state.data))).not.toContain("private automatic");expect(hook.result.current.latest.data?.outgoing[0].body).toBeNull();expect(JSON.stringify(hook.result.current.messages)).toContain("safe conversation");hook.unmount();});

it("withdraws the complete conversation scope after a thread GET confirms loss of WhatsAppRead", async () => {
  const h = harness(); let forbidden = false;
  const reads = vi.spyOn(chatApi, "getThread").mockImplementation(async (_id, cursor) => {
    if (forbidden) throw new ApiError(403, {});
    const value = thread(cursor ? "PRIVATE older chat" : "PRIVATE latest chat", Boolean(cursor));
    return { ...value, canReadFormRecords: true };
  });
  const hook = renderHook(() => useChatThread("chat-a", scope, false), h);
  await waitFor(() => expect(hook.result.current.messages).toHaveLength(1));
  await act(async () => { await hook.result.current.history.fetchNextPage(); });
  h.client.setQueryData(["other-private-owner"], { marker: "unrelated scope" });
  forbidden = true;
  await act(async () => { await hook.result.current.latest.refetch(); });
  await waitFor(() => {
    expect(hook.result.current.latest.error).toMatchObject({ status: 403 });
    expect(hook.result.current.messages).toEqual([]);
    expect(hook.result.current.latest.data).toBeUndefined();
    expect(hook.result.current.history.data).toBeUndefined();
    expect(JSON.stringify(h.client.getQueryCache().getAll().map(query => query.state.data))).not.toContain("PRIVATE");
    expect(h.client.getQueryData(["other-private-owner"])).toEqual({ marker: "unrelated scope" });
  });
  const count = reads.mock.calls.length;
  await act(async () => { await hook.result.current.latest.refetch(); await hook.result.current.history.fetchNextPage(); });
  expect(reads).toHaveBeenCalledTimes(count);
  hook.unmount();
});
it("cancels historical reads on thread GET403 and refuses a late private page without rollback", async () => {
  const h = harness(); let forbidden = false; let resolve!: (value: Thread) => void;
  const reads = vi.spyOn(chatApi, "getThread").mockImplementation(async (_id, cursor) => {
    if (cursor) return new Promise<Thread>(done => { resolve = done; });
    if (forbidden) throw new ApiError(403, {});
    return { ...thread("PRIVATE latest chat"), canReadFormRecords: true };
  });
  const hook = renderHook(() => useChatThread("chat-a", scope, false), h);
  await waitFor(() => expect(hook.result.current.messages).toHaveLength(1));
  let loading!: Promise<unknown>;
  await act(async () => { loading = hook.result.current.history.fetchNextPage(); });
  await waitFor(() => expect(reads).toHaveBeenCalledTimes(2));
  const olderSignal = reads.mock.calls[1][2]!;
  forbidden = true;
  await act(async () => { await hook.result.current.latest.refetch(); });
  await waitFor(() => {
    expect(hook.result.current.latest.error).toMatchObject({ status: 403 });
    expect(olderSignal.aborted).toBe(true);
    expect(hook.result.current.messages).toEqual([]);
    expect(hook.result.current.latest.data).toBeUndefined();
    expect(hook.result.current.history.data).toBeUndefined();
    expect(JSON.stringify(h.client.getQueryCache().getAll().map(query => query.state.data))).not.toContain("PRIVATE");
  });
  await act(async () => { resolve({ ...thread("PRIVATE late chat", true), canReadFormRecords: true }); await loading; });
  expect(hook.result.current.messages).toEqual([]);
  expect(JSON.stringify(h.client.getQueryCache().getAll().map(query => query.state.data))).not.toContain("PRIVATE");
  hook.unmount();
});
