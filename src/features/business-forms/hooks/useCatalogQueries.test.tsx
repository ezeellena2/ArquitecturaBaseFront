import { act, renderHook, waitFor } from "@testing-library/react";
import { QueryClientProvider } from "@tanstack/react-query";
import type { PropsWithChildren } from "react";
import { describe, expect, it } from "vitest";
import { http, HttpResponse } from "msw";
import { server } from "@/test/mocks/server";
import { createQueryClient } from "@/shared/api/queryClient";
import { catalogScopeKey, useCatalogDetail, useCatalogItems, useCatalogItemsById, useCatalogFilterOptions } from "./useCatalogQueries";

import options from "@/test/fixtures/catalogs-http/filters/options.json";

const id = "01990000-0000-7000-8000-000000000020";
const detail = { valueType: "Text" as const, proposal: null, id, key: id.replaceAll("-", ""), name: { es: "Clientes", en: "Customers" }, description: { es: "Visitas", en: "Visits" }, kind: "Manual", revision: 1, isActive: true, itemsCount: 1, usageCount: 0, unavailableReasonCode: null, filters: null, fields: [], presentation: null, presentationCheck: { titleTooLongCount: 0, examples: [] } };
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
    server.use(http.get("/api/forms/catalogs/:id/items", ({ params }) => { calls.push(String(params.id)); return HttpResponse.json({ items: [{ value: null, id: "01990000-0000-7000-8000-000000000021", code: "C1", text: { es: "Uno", en: null }, detail: {}, position: 1, isActive: true, fields: {}, fieldTexts: {} }], page: 1, pageSize: 20, totalCount: 1, totalPages: 1, hasPrevious: false, hasNext: false }); }));
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
  it("reads option labels by id without a catalog revision and only with catalog read", async () => {
    const optionId = "01990000-0000-7000-8000-000000000021";
    const requests: URLSearchParams[] = [];
    server.use(http.get("/api/forms/catalogs/:id/items", ({ request }) => { requests.push(new URL(request.url).searchParams); return HttpResponse.json({ items: [{ value: null, id: optionId, code: "S", text: { es: "Sur", en: null }, detail: {}, position: 37, isActive: false, fields: {}, fieldTexts: {} }], page: 1, pageSize: 1, totalCount: 1, totalPages: 1, hasPrevious: false, hasNext: false }); }));
    const h = harness();
    const { result, rerender } = renderHook(({ permissions, ids }) => useCatalogItemsById({ ...scope, permissions }, id, ids), { ...h, initialProps: { permissions: ["formcatalogs.manage"], ids: [optionId] as readonly string[] } });
    await act(async () => { await Promise.resolve(); });
    expect(requests).toHaveLength(0);
    rerender({ permissions: ["formcatalogs.read"], ids: [] });
    await act(async () => { await Promise.resolve(); });
    expect(requests).toHaveLength(0);
    rerender({ permissions: ["formcatalogs.read"], ids: [optionId] });
    await waitFor(() => expect(result.current.data?.items[0]?.text.es).toBe("Sur"));
    expect(requests.map(query => [query.getAll("ids"), query.get("pageSize"), query.get("isActive")])).toEqual([[[optionId], "1", null]]);
    const query = h.client.getQueryCache().getAll().find(entry => entry.state.data !== undefined)!;
    expect(query.queryKey).toEqual([...catalogScopeKey(scope), "items-by-id", id, [optionId]]);
    expect(query.meta?.errorOwner).toBe("global");
    rerender({ permissions: [], ids: [optionId] });
    await waitFor(() => expect(result.current.data).toBeUndefined());
    expect(h.client.getQueryCache().getAll().some(entry => entry.state.data !== undefined)).toBe(false);
  });
  it("does not request private content for Manage without Read", async () => {
    let calls = 0; server.use(http.get("/api/forms/catalogs/" + id, () => { calls++; return HttpResponse.json(detail); }));
    const { result } = renderHook(() => useCatalogDetail({ ...scope, permissions: ["formcatalogs.manage"] }, id), harness());
    await act(async () => { await Promise.resolve(); });
    expect(result.current.data).toBeUndefined();
    expect(calls).toBe(0);
  });
});

it("retains filter metadata only within the same actor, culture and permissions", async () => {
  server.use(http.get("/api/forms/catalog-filter-options", () => HttpResponse.json(options)));
  const { result, rerender } = renderHook(({ actorId, permissions }) => useCatalogFilterOptions({ ...scope, actorId, permissions }, { page: 1, pageSize: 20 }),
    { ...harness(), initialProps: { actorId: "actor-a", permissions: ["formcatalogs.read", "formcatalogs.manage"] } });
  await waitFor(() => expect(result.current.data?.columns).toHaveLength(3));
  rerender({ actorId: "actor-b", permissions: ["formcatalogs.read"] });
  expect(result.current.data).toBeUndefined();
  rerender({ actorId: "actor-b", permissions: [] });
  expect(result.current.data).toBeUndefined();
});
