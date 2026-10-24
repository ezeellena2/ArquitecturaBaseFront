import { QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook } from "@testing-library/react";
import type { PropsWithChildren } from "react";
import { toast } from "sonner";
import { afterEach, expect, it, vi } from "vitest";
import { createQueryClient } from "@/shared/api/queryClient";
import { ApiError } from "@/shared/api/ApiError";
import * as assistantApi from "../api/assistant";
import { useAssistantSuggestion } from "./useAssistantSuggestion";

afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });
it("pauses pending consultation after 429 and resumes only on an explicit read after Retry-After", async () => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-10-17T12:00:00Z"));
  const pending: assistantApi.AssistantSuggestion = { requestId: "request", sourceMessageId: "source", state: "Pending", proposal: null, outgoing: null };
  const request = vi.spyOn(assistantApi, "requestAssistantSuggestion").mockResolvedValue(pending);
  const read = vi.spyOn(assistantApi, "getAssistantSuggestion").mockRejectedValueOnce(new ApiError(429, { retryAfter: 30 })).mockResolvedValue({ ...pending, state: "NoReply" });
  const client = createQueryClient();
  function Wrapper({ children }: PropsWithChildren) { return <QueryClientProvider client={client}>{children}</QueryClientProvider>; }
  const hook = renderHook(() => useAssistantSuggestion("chat", 7, { sourceMessageId: "source", pointer: null, owner: "operator:chat:source", available: true }, true, true, true), { wrapper: Wrapper });
  await act(async () => {});
  expect(request).toHaveBeenCalledOnce();
  await act(async () => { await vi.advanceTimersByTimeAsync(5000); });
  expect(read).toHaveBeenCalledOnce();
  await act(async () => { await hook.result.current.consult(); });
  expect(read).toHaveBeenCalledOnce();
  await act(async () => { await vi.advanceTimersByTimeAsync(31000); });
  expect(read).toHaveBeenCalledOnce();
  await act(async () => { await hook.result.current.consult(); });
  expect(read).toHaveBeenCalledTimes(2);
  expect(request).toHaveBeenCalledOnce();
  hook.unmount();
});

it("says one second, not «1 segundos», for a one-second wait", async () => {
  vi.spyOn(assistantApi, "requestAssistantSuggestion").mockRejectedValue(new ApiError(429, { retryAfter: 1 }));
  const client = createQueryClient();
  function Wrapper({ children }: PropsWithChildren) { return <QueryClientProvider client={client}>{children}</QueryClientProvider>; }
  const hook = renderHook(() => useAssistantSuggestion("chat", 7, { sourceMessageId: "source", pointer: null, owner: "operator:chat:source", available: true }, true, true, true), { wrapper: Wrapper });
  await act(async () => {});
  expect(toast.getToasts().map(item => "title" in item ? item.title : null)).toContain("Esperá 1 segundo antes de volver a consultar o enviar.");
  hook.unmount();
  toast.dismiss();
});
