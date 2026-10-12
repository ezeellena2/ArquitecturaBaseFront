import { act, renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { QueryClientProvider } from "@tanstack/react-query";
import type { PropsWithChildren } from "react";
import { http, HttpResponse } from "msw";
import { server } from "@/test/mocks/server";
import { createQueryClient } from "@/shared/api/queryClient";
import type { CatalogDetail } from "../api/catalogResponse";
import { useCatalogDraftEditor } from "./useCatalogDraftEditor";

const id = "01990000-0000-7000-8000-000000000020";
const itemId = "01990000-0000-7000-8000-000000000021";
const initial: CatalogDetail = { id, key: id.replaceAll("-", ""), kind: "Manual", revision: 1, name: { es: "Clientes", en: "Customers" }, description: { es: "Visitas", en: "Visits" }, isActive: true, itemsCount: 1, usageCount: 0, unavailableReasonCode: null };
const scope = { actorId: "actor-a", culture: "es" as const, permissions: ["formcatalogs.read", "formcatalogs.manage"] };
function harness() {
  const client = createQueryClient();
  function Wrapper({ children }: PropsWithChildren) { return <QueryClientProvider client={client}>{children}</QueryClientProvider>; }
  return { client, wrapper: Wrapper };
}
describe("Manual catalog editor ownership", () => {
  it("commits once, clears changes and loaded originals, and keeps bodies out of MutationCache", async () => {
    const h = harness(); const received: unknown[] = [];
    server.use(http.put("/api/forms/catalogs/" + id, async ({ request }) => { received.push(await request.json()); return HttpResponse.json({ catalog: { ...initial, revision: 2 }, itemIdentityMap: {} }); }));
    const { result } = renderHook(() => useCatalogDraftEditor(scope, initial), h);
    act(() => result.current.loadItems([{ id: itemId, code: "C1", text: { es: "Uno", en: null }, detail: {}, position: 1, isActive: true }]));
    act(() => result.current.changeItem({ ...Object.values(result.current.draft!.items.originals)[0]!, code: "C2" }));
    await act(() => result.current.save());
    expect(received).toHaveLength(1);
    expect(received[0]).toMatchObject({ expectedRevision: 1, items: [{ itemId, code: "C2", text: { es: "Uno", en: null } }] });
    expect(result.current.draft).toMatchObject({ revision: 2, items: { originals: {}, changes: {} } });
    expect(result.current.dirty).toBe(false);
    expect(h.client.getMutationCache().getAll()).toEqual([]);
  });
  it("retains a conflicted draft through reread and only adopts a new baseline on an explicit decision", async () => {
    let writes = 0; const h = harness();
    server.use(http.put("/api/forms/catalogs/" + id, () => { writes++; return HttpResponse.json({ code: "Forms.Catalog.RevisionConflict" }, { status: 409 }); }), http.get("/api/forms/catalogs/" + id, () => HttpResponse.json({ ...initial, revision: 2, name: { es: "Nombre actual", en: "Current name" } })));
    const { result } = renderHook(() => useCatalogDraftEditor(scope, initial), h);
    act(() => result.current.changeMetadata({ name: { es: "Mi nombre", en: "My name" } }));
    await act(() => result.current.save());
    expect(result.current.requiresReview).toBe(true);
    await act(() => result.current.save());
    await act(() => result.current.readCurrent());
    expect(result.current.draft!.name.es).toBe("Mi nombre");
    expect(result.current.draft!.revision).toBe(1);
    expect(result.current.current!.revision).toBe(2);
    expect(writes).toBe(1);
    act(() => result.current.adoptCurrent());
    expect(result.current.draft!.name.es).toBe("Nombre actual");
    expect(result.current.draft!.revision).toBe(2);
    expect(result.current.requiresReview).toBe(false);
    expect(writes).toBe(1);
  });
  it("blocks concurrent saves and ignores a late result after another actor takes ownership", async () => {
    let release!: () => void; const gate = new Promise<void>(resolve => { release = resolve; }); let calls = 0;
    server.use(http.put("/api/forms/catalogs/" + id, async () => { calls++; await gate; return HttpResponse.json({ catalog: { ...initial, revision: 2 }, itemIdentityMap: {} }); }));
    const h = harness(); const { result, rerender } = renderHook(({ actorId }) => useCatalogDraftEditor({ ...scope, actorId }, initial), { ...h, initialProps: { actorId: "actor-a" } });
    act(() => result.current.changeMetadata({ name: { es: "Privado del actor anterior", en: "Previous actor private draft" } }));
    let pending!: Promise<unknown>;
    act(() => { pending = result.current.save(); });
    await waitFor(() => expect(calls).toBe(1));
    await act(() => result.current.save());
    act(() => result.current.changeMetadata({ name: { es: "Mutation while frozen", en: "Frozen" } }));
    expect(result.current.draft!.name.es).toBe("Privado del actor anterior");
    rerender({ actorId: "actor-b" });
    await act(async () => { release(); await pending; });
    expect(calls).toBe(1);
    expect(result.current.saved).toBeNull();
    expect(result.current.draft!.revision).toBe(1);
    expect(result.current.draft!.name.es).toBe("Clientes");
  });
  it("requires Read and Manage for writes and removes the draft on loss of Read", async () => {
    let calls = 0;
    server.use(http.put("/api/forms/catalogs/" + id, () => { calls++; return HttpResponse.json({ catalog: { ...initial, revision: 2 }, itemIdentityMap: {} }); }));
    const { result, rerender } = renderHook(({ permissions }) => useCatalogDraftEditor({ ...scope, permissions }, initial), { ...harness(), initialProps: { permissions: ["formcatalogs.read"] } });
    await act(() => result.current.save());
    expect(calls).toBe(0);
    rerender({ permissions: ["formcatalogs.manage"] });
    expect(result.current.draft).toBeNull();
    expect(result.current.canSave).toBe(false);
  });
  it("keeps the draft and requires reread after a possibly committed server failure", async () => {
    let calls = 0;
    server.use(http.put("/api/forms/catalogs/" + id, () => { calls++; return HttpResponse.json({}, { status: 500 }); }));
    const { result } = renderHook(() => useCatalogDraftEditor(scope, initial), harness());
    act(() => result.current.changeMetadata({ name: { es: "Privado", en: "Private" } }));
    await act(() => result.current.save());
    await act(() => result.current.save());
    expect(calls).toBe(1);
    expect(result.current.draft!.name.es).toBe("Privado");
    expect(result.current.requiresReview).toBe(true);
  });
  it("resets loaded originals and pending values when the catalog identity changes", () => {
    const nextId = "01990000-0000-7000-8000-000000000022";
    const { result, rerender } = renderHook(({ catalog }) => useCatalogDraftEditor(scope, catalog), { ...harness(), initialProps: { catalog: initial } });
    act(() => result.current.loadItems([{ id: itemId, code: "C1", text: { es: "Uno", en: null }, detail: {}, position: 1, isActive: true }]));
    act(() => result.current.changeItem({ ...Object.values(result.current.draft!.items.originals)[0]!, code: "PRIVATE" }));
    rerender({ catalog: { ...initial, id: nextId, key: nextId.replaceAll("-", ""), name: { es: "Otro", en: "Other" } } });
    expect(result.current.draft).toMatchObject({ id: nextId, name: { es: "Otro", en: "Other" }, items: { originals: {}, changes: {} } });
    expect(result.current.dirty).toBe(false);
  });
  it("clears a validation error after a subsequent confirmed save", async () => {
    let calls = 0;
    server.use(http.put("/api/forms/catalogs/" + id, () => { calls++; return calls === 1 ? HttpResponse.json({ code: "Request.Invalid", errors: { "name.es": ["Required"] } }, { status: 400 }) : HttpResponse.json({ catalog: { ...initial, revision: 2 }, itemIdentityMap: {} }); }));
    const { result } = renderHook(() => useCatalogDraftEditor(scope, initial), harness());
    await act(() => result.current.save());
    expect(result.current.error).toMatchObject({ status: 400 });
    expect(result.current.requiresReview).toBe(false);
    await act(() => result.current.save());
    expect(result.current.error).toBeNull();
    expect(result.current.saved!.catalog.revision).toBe(2);
    expect(calls).toBe(2);
  });
});
