import { act, renderHook, waitFor } from "@testing-library/react";
import { QueryClientProvider } from "@tanstack/react-query";
import type { PropsWithChildren } from "react";
import { describe, expect, it } from "vitest";
import { http, HttpResponse } from "msw";
import { server } from "@/test/mocks/server";
import { createQueryClient } from "@/shared/api/queryClient";
import { useCatalogDetail, useCatalogItems } from "./useCatalogQueries";

const id = "01990000-0000-7000-8000-000000000020";
const detail = { id, key: id.replaceAll("-", ""), name: { es: "Clientes", en: "Customers" }, description: { es: "Visitas", en: "Visits" }, kind: "Manual", revision: 1, isActive: true, itemsCount: 1, usageCount: 0, unavailableReasonCode: null };
const scope = { actorId: "actor-a", culture: "es" as const, permissions: ["formcatalogs.read"] };
function harness() {
  const client = createQueryClient(); client.setDefaultOptions({ queries: { retry: false } });
  function Wrapper({ children }: PropsWithChildren) { return <QueryClientProvider client={client}>{children}</QueryClientProvider>; }
  return { client, wrapper: Wrapper };
}
describe("Private catalog reads", () => {
  it("allows catalog readers without form template permissions and removes data on loss of Read", async () => {
    server.use(http.get("/api/forms/catalogs/" + id, () => HttpResponse.json(detail)));
    const h = harness(); const { result, rerender } = renderHook(({ permissions }) => useCatalogDetail({ ...scope, permissions }, id), { ...h, initialProps: { permissions: scope.permissions } });
    await waitFor(() => expect(result.current.data?.name.es).toBe("Clientes"));
    expect(h.client.getQueryCache().getAll().some(query => query.meta?.errorOwner === "local")).toBe(true);
    rerender({ permissions: [] });
    await waitFor(() => expect(result.current.data).toBeUndefined());
    expect(h.client.getQueryCache().getAll().some(query => query.state.data !== undefined)).toBe(false);
  });
  it("loads canonical pages afresh for a confirmed revision and keeps previous pages out of a new catalog", async () => {
    const calls: string[] = [];
    server.use(http.get("/api/forms/catalogs/:id/items", ({ params }) => { calls.push(String(params.id)); return HttpResponse.json({ items: [{ id: "01990000-0000-7000-8000-000000000021", code: "C1", text: { es: "Uno", en: null }, detail: {}, position: 1, isActive: true }], page: 1, pageSize: 20, totalCount: 1, totalPages: 1, hasPrevious: false, hasNext: false }); }));
    const h = harness(); const { result, rerender } = renderHook(({ catalogId, revision }) => useCatalogItems(scope, catalogId, revision, { page: 1, pageSize: 20 }), { ...h, initialProps: { catalogId: id, revision: 1 } });
    await waitFor(() => expect(result.current.data?.items).toHaveLength(1));
    await act(async () => { rerender({ catalogId: id, revision: 2 }); });
    await waitFor(() => expect(calls).toHaveLength(2));
    const nextId = "01990000-0000-7000-8000-000000000022";
    rerender({ catalogId: nextId, revision: 1 });
    expect(result.current.data).toBeUndefined();
    await waitFor(() => expect(calls).toEqual([id, id, nextId]));
    expect(h.client.getQueryCache().getAll().filter(query => query.state.data !== undefined)).toHaveLength(1);
  });
  it("does not request private content for Manage without Read", async () => {
    let calls = 0; server.use(http.get("/api/forms/catalogs/" + id, () => { calls++; return HttpResponse.json(detail); }));
    const { result } = renderHook(() => useCatalogDetail({ ...scope, permissions: ["formcatalogs.manage"] }, id), harness());
    await act(async () => { await Promise.resolve(); });
    expect(result.current.data).toBeUndefined();
    expect(calls).toBe(0);
  });
});
