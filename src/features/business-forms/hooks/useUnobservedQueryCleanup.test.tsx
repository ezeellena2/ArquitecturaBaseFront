import { act, renderHook, waitFor } from "@testing-library/react";
import { QueryClientProvider, useQuery } from "@tanstack/react-query";
import type { PropsWithChildren } from "react";
import { expect, it } from "vitest";
import { createQueryClient } from "@/shared/api/queryClient";
import { useUnobservedQueryCleanup } from "./useUnobservedQueryCleanup";
const root = ["form-private", "actor:read"] as const;
const key = [...root, "record"];
function harness() {
  const client = createQueryClient();
  client.setDefaultOptions({ queries: { retry: false, gcTime: Infinity, staleTime: Infinity } });
  function Wrapper({ children }: PropsWithChildren) { return <QueryClientProvider client={client}>{children}</QueryClientProvider>; }
  return { client, wrapper: Wrapper };
}
it("keeps an in-flight private read alive until its last observer leaves", async () => {
  const h = harness();
  let signal: AbortSignal | undefined;
  let release!: (value: string) => void;
  let reads = 0;
  const request = new Promise<string>(resolve => { release = resolve; });
  function usePrivateRecord() {
    useUnobservedQueryCleanup(root);
    return useQuery({ queryKey: key, queryFn: ({ signal: current }) => { signal = current; reads++; return request; } });
  }
  const first = renderHook(usePrivateRecord, h);
  const last = renderHook(usePrivateRecord, h);
  const query = h.client.getQueryCache().find({ queryKey: key, exact: true });
  expect(reads).toBe(1);
  first.unmount();
  await act(async () => { await Promise.resolve(); });
  expect(signal?.aborted).toBe(false);
  expect(h.client.getQueryCache().find({ queryKey: key, exact: true })).toBe(query);
  await act(async () => { release("Private result"); });
  await waitFor(() => expect(last.result.current.data).toBe("Private result"));
  last.unmount();
  await act(async () => { await Promise.resolve(); });
  expect(h.client.getQueryData(key)).toBeUndefined();
  expect(h.client.getQueryCache().find({ queryKey: key, exact: true })).toBeUndefined();
});
it("preserves a remounted observer of the same key before the deferred cleanup runs", async () => {
  const h = harness();
  h.client.setQueryData(key, "Private result");
  function usePrivateRecord() { useUnobservedQueryCleanup(root); return useQuery({ queryKey: key, queryFn: async () => "Changed result" }); }
  const first = renderHook(usePrivateRecord, h);
  const query = h.client.getQueryCache().find({ queryKey: key, exact: true });
  first.unmount();
  const next = renderHook(usePrivateRecord, h);
  await act(async () => { await Promise.resolve(); });
  expect(h.client.getQueryCache().find({ queryKey: key, exact: true })).toBe(query);
  expect(next.result.current.data).toBe("Private result");
  next.unmount();
});
it("removes the old private permission scope after revocation without touching another owner", async () => {
  const h = harness();
  const otherKey = ["form-private", "another-actor:read", "record"];
  h.client.setQueryData(otherKey, "Other actor content");
  const hook = renderHook(({ allowed }) => {
    const scoped = ["form-private", allowed ? "actor:read" : "actor:denied"];
    useUnobservedQueryCleanup(scoped);
    return useQuery({ queryKey: [...scoped, "record"], queryFn: async () => "Private result", enabled: allowed });
  }, { ...h, initialProps: { allowed: true } });
  await waitFor(() => expect(hook.result.current.data).toBe("Private result"));
  hook.rerender({ allowed: false });
  expect(hook.result.current.data).toBeUndefined();
  await act(async () => { await Promise.resolve(); });
  expect(h.client.getQueryData(key)).toBeUndefined();
  expect(h.client.getQueryData(otherKey)).toBe("Other actor content");
  hook.unmount();
});
