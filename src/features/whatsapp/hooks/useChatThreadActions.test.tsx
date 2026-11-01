import type { PropsWithChildren } from "react";
import { QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { createQueryClient } from "@/shared/api/queryClient";
import * as chatApi from "../api/chat";
import { useChatThreadActions } from "./useChatThreadActions";
afterEach(() => vi.restoreAllMocks());
it("keeps only the outgoing identity in confirmation state and mutation variables instead of private captured explanations", async () => {
 const client = createQueryClient();
 function Wrapper({ children }: PropsWithChildren) { return <QueryClientProvider client={client}>{children}</QueryClientProvider>; }
 vi.spyOn(chatApi, "reviewOutgoing").mockResolvedValue(undefined);
 const hook = renderHook(() => useChatThreadActions("chat", async () => {}), { wrapper: Wrapper });
 const operation: chatApi.Outgoing = { id: "outgoing", requestId: "request", operatorUserId: "operator", body: "PRIVATE body", requestedAtUtc: "2026-10-17T12:00:00Z", waMessageId: null, state: "Uncertain", kind: "Flow", origin: "Conversation", quickReplies: null, assistant: { reason: "PRIVATE why", proposedFields: [{ fieldId: "field", label: "PRIVATE label", displayValue: "PRIVATE value" }] } };
 act(() => hook.result.current.setReview(operation));
 expect(hook.result.current.review).toEqual({ requestId: "request" });
 await act(async () => { await hook.result.current.reviewing.mutateAsync(hook.result.current.review!); });
 expect(JSON.stringify(client.getMutationCache().getAll().map(mutation => mutation.state.variables))).not.toContain("PRIVATE");
 expect(chatApi.reviewOutgoing).toHaveBeenCalledWith("chat", "request");
 hook.unmount();
});

// The confirmation waits open with its progress (board LC1-A) and closes when the answer arrives, also when it fails.
it.each(["answers", "fails"] as const)("closes the review and mode confirmations when the change %s", async outcome => {
 const client = createQueryClient();
 function Wrapper({ children }: PropsWithChildren) { return <QueryClientProvider client={client}>{children}</QueryClientProvider>; }
 const review = vi.spyOn(chatApi, "reviewOutgoing");
 const change = vi.spyOn(chatApi, "changeMode");
 if (outcome === "answers") { review.mockResolvedValue(undefined); change.mockResolvedValue({ mode: "Manual", modeRevision: 3, assistantSendInProgress: false }); }
 else { review.mockRejectedValue(new Error("lost")); change.mockRejectedValue(new Error("lost")); }
 const hook = renderHook(() => useChatThreadActions("chat", async () => {}), { wrapper: Wrapper });
 act(() => { hook.result.current.setReview({ requestId: "request" }); hook.result.current.setMode({ mode: "Manual", revision: 2 }); });
 await act(async () => {
  hook.result.current.reviewing.mutate(hook.result.current.review!);
  hook.result.current.changing.mutate(hook.result.current.mode!);
 });
 await vi.waitFor(() => { expect(hook.result.current.review).toBeUndefined(); expect(hook.result.current.mode).toBeUndefined(); });
 hook.unmount();
});
