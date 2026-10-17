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
 await act(async () => { await hook.result.current.reviewing.mutateAsync(hook.result.current.review!); });
 expect(JSON.stringify(client.getMutationCache().getAll().map(mutation => mutation.state.variables))).not.toContain("PRIVATE");
 expect(hook.result.current.review).toEqual({ requestId: "request" });
 expect(chatApi.reviewOutgoing).toHaveBeenCalledWith("chat", "request");
 hook.unmount();
});
