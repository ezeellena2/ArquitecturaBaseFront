import { StrictMode, type PropsWithChildren } from "react";
import { QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createQueryClient } from "@/shared/api/queryClient";
import * as chatApi from "../api/chat";
import type { Thread } from "../api/chat";
import { useChatThread } from "./useChatThread";

const scope = { actor: "operator-a", culture: "es", permissions: ["whatsapp.read", "formrecords.read"] };
function thread(body: string, older = false, more = false): Thread {
  return { contact: { id: "chat-a", profileName: "Recipient", phoneNumber: null, mode: "Manual", modeRevision: 1,
    lastInboundAtUtc: "2026-10-11T12:00:00Z", lastInboundSequence: 1, unreadCount: 0, preview: null },
    messages: [{ id: older ? more ? "older-first" : "older-last" : "latest", direction: "Inbound", body, kind: "Text", occurredAtUtc: older ? "2026-10-10T12:00:00Z" : "2026-10-11T12:00:00Z",
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
