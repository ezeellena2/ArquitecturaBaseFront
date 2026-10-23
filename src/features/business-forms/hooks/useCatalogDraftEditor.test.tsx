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
const initial: CatalogDetail = { valueType: "Text" as const, proposal: null, id, key: id.replaceAll("-", ""), kind: "Manual", revision: 1, name: { es: "Clientes", en: "Customers" }, description: { es: "Visitas", en: "Visits" }, isActive: true, itemsCount: 1, usageCount: 0, unavailableReasonCode: null, filters: null, fields: [], presentation: null, presentationCheck: { titleTooLongCount: 0, examples: [] } };
const scope = { actorId: "actor-a", culture: "es" as const, permissions: ["formcatalogs.read", "formcatalogs.manage"] };
function harness() {
  const client = createQueryClient();
  function Wrapper({ children }: PropsWithChildren) { return <QueryClientProvider client={client}>{children}</QueryClientProvider>; }
  return { client, wrapper: Wrapper };
}
describe("Manual catalog editor ownership", () => {
  it("commits once, clears changes and loaded originals, and keeps bodies out of MutationCache", async () => {
    const h = harness(); const received: unknown[] = [];
    server.use(http.put("/api/forms/catalogs/" + id, async ({ request }) => { received.push(await request.json()); return HttpResponse.json({ catalog: { ...initial, revision: 2 }, itemIdentityMap: {}, fieldIdentityMap: {} }); }));
    const { result } = renderHook(() => useCatalogDraftEditor(scope, initial), h);
    act(() => result.current.loadItems([{ value: null, id: itemId, code: "C1", text: { es: "Uno", en: null }, detail: {}, position: 1, isActive: true, fields: {}, fieldTexts: {} }]));
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
    server.use(http.put("/api/forms/catalogs/" + id, async () => { calls++; await gate; return HttpResponse.json({ catalog: { ...initial, revision: 2 }, itemIdentityMap: {}, fieldIdentityMap: {} }); }));
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
    server.use(http.put("/api/forms/catalogs/" + id, () => { calls++; return HttpResponse.json({ catalog: { ...initial, revision: 2 }, itemIdentityMap: {}, fieldIdentityMap: {} }); }));
    const { result, rerender } = renderHook(({ permissions }) => useCatalogDraftEditor({ ...scope, permissions }, initial), { ...harness(), initialProps: { permissions: ["formcatalogs.read"] } });
    await act(() => result.current.save());
    expect(calls).toBe(0);
    rerender({ permissions: ["formcatalogs.manage"] });
    expect(result.current.draft).toBeNull();
    expect(result.current.canSave).toBe(false);
  });
  it.each(["network", "500", "503"])("keeps a draft retryable after %s and repeats the expected revision", async failure => {
    const bodies: unknown[] = [];
    server.use(http.put("/api/forms/catalogs/" + id, async ({ request }) => {
      bodies.push(await request.json());
      return bodies.length === 1 ? failure === "network" ? HttpResponse.error() : HttpResponse.json({}, { status: Number(failure) })
        : HttpResponse.json({ catalog: { ...initial, revision: 2 }, itemIdentityMap: {}, fieldIdentityMap: {} });
    }));
    const { result } = renderHook(() => useCatalogDraftEditor(scope, initial), harness());
    act(() => result.current.changeMetadata({ name: { es: "Privado", en: "Private" } }));
    await act(() => result.current.save());
    expect(result.current.draft!.name.es).toBe("Privado");
    expect(result.current.requiresReview).toBe(false);
    expect(result.current.canSave).toBe(true);
    await act(() => result.current.save());
    expect(bodies).toHaveLength(2);
    expect(bodies[1]).toEqual(bodies[0]);
    expect(bodies[0]).toMatchObject({ expectedRevision: 1 });
    expect(result.current.saved!.catalog.revision).toBe(2);
  });
  it("requires review only when an explicit retry returns 409 after a lost save response", async () => {
    let calls = 0;
    server.use(http.put("/api/forms/catalogs/" + id, () => ++calls === 1 ? HttpResponse.error()
      : HttpResponse.json({ code: "Forms.Catalog.RevisionConflict" }, { status: 409 })));
    const { result } = renderHook(() => useCatalogDraftEditor(scope, initial), harness());
    act(() => result.current.changeMetadata({ name: { es: "Conservar", en: "Keep" } }));
    await act(() => result.current.save());
    expect(result.current.requiresReview).toBe(false);
    await act(() => result.current.save());
    expect(result.current.requiresReview).toBe(true);
    expect(result.current.draft!.name.es).toBe("Conservar");
    await act(() => result.current.save());
    expect(calls).toBe(2);
  });
  it("resets loaded originals and pending values when the catalog identity changes", () => {
    const nextId = "01990000-0000-7000-8000-000000000022";
    const { result, rerender } = renderHook(({ catalog }) => useCatalogDraftEditor(scope, catalog), { ...harness(), initialProps: { catalog: initial } });
    act(() => result.current.loadItems([{ value: null, id: itemId, code: "C1", text: { es: "Uno", en: null }, detail: {}, position: 1, isActive: true, fields: {}, fieldTexts: {} }]));
    act(() => result.current.changeItem({ ...Object.values(result.current.draft!.items.originals)[0]!, code: "PRIVATE" }));
    rerender({ catalog: { ...initial, id: nextId, key: nextId.replaceAll("-", ""), name: { es: "Otro", en: "Other" } } });
    expect(result.current.draft).toMatchObject({ id: nextId, name: { es: "Otro", en: "Other" }, items: { originals: {}, changes: {} } });
    expect(result.current.dirty).toBe(false);
  });
  it("clears a validation error after a subsequent confirmed save", async () => {
    let calls = 0;
    server.use(http.put("/api/forms/catalogs/" + id, () => { calls++; return calls === 1 ? HttpResponse.json({ code: "Request.Invalid", errors: { "name.es": ["Required"] } }, { status: 400 }) : HttpResponse.json({ catalog: { ...initial, revision: 2 }, itemIdentityMap: {}, fieldIdentityMap: {} }); }));
    const { result } = renderHook(() => useCatalogDraftEditor(scope, initial), harness());
    await act(() => result.current.save());
    expect(result.current.error).toMatchObject({ status: 400 });
    expect(result.current.requiresReview).toBe(false);
    await act(() => result.current.save());
    expect(result.current.error).toBeNull();
    expect(result.current.saved!.catalog.revision).toBe(2);
    expect(calls).toBe(2);
  });
  it.each(["catalog", "actor"] as const)("rejects old-owner metadata, item and page callbacks after changing %s at the same revision", transition => {
    const nextId = "01990000-0000-7000-8000-000000000022";
    const { result, rerender } = renderHook(({ catalog, actorId }) => useCatalogDraftEditor({ ...scope, actorId }, catalog), { ...harness(), initialProps: { catalog: initial, actorId: "actor-a" } });
    const old = { loadItems: result.current.loadItems, changeMetadata: result.current.changeMetadata, changeItem: result.current.changeItem };
    rerender({ catalog: transition === "catalog" ? { ...initial, id: nextId, key: nextId.replaceAll("-", ""), name: { es: "Otro", en: "Other" } } : initial, actorId: transition === "actor" ? "actor-b" : "actor-a" });
    act(() => {
      old.loadItems([{ value: null, id: itemId, code: "OLD-PRIVATE", text: { es: "Previous private row", en: null }, detail: {}, position: 1, isActive: true, fields: {}, fieldTexts: {} }], 1);
      old.changeMetadata({ name: { es: "Previous private name", en: "Old owner" } });
      old.changeItem({ value: null, localId: "old-new-item", itemId: null, label: { es: "Previous private option" }, detail: {}, position: 2, code: "OLD-NEW", isActive: true });
    });
    expect(result.current.draft!.name).toEqual(transition === "catalog" ? { es: "Otro", en: "Other" } : initial.name);
    expect(result.current.draft!.items).toEqual({ originals: {}, changes: {} });
    expect(result.current.dirty).toBe(false);
  });
  it.each(["catalog", "actor"] as const)("rejects an old save callback before sending a request after changing %s", async transition => {
    let calls = 0; server.use(http.put("/api/forms/catalogs/:id", () => { calls++; return HttpResponse.json({ catalog: { ...initial, revision: 2 }, itemIdentityMap: {}, fieldIdentityMap: {} }); }));
    const nextId = "01990000-0000-7000-8000-000000000022";
    const { result, rerender } = renderHook(({ catalog, actorId }) => useCatalogDraftEditor({ ...scope, actorId }, catalog), { ...harness(), initialProps: { catalog: initial, actorId: "actor-a" } });
    const oldSave = result.current.save;
    rerender({ catalog: transition === "catalog" ? { ...initial, id: nextId, key: nextId.replaceAll("-", "") } : initial, actorId: transition === "actor" ? "actor-b" : "actor-a" });
    await act(() => oldSave());
    expect(calls).toBe(0);
    expect(result.current.saved).toBeNull();
  });
  it("rejects stale edit callbacks after Manage is revoked without losing Read", () => {
    const { result, rerender } = renderHook(({ permissions }) => useCatalogDraftEditor({ ...scope, permissions }, initial), { ...harness(), initialProps: { permissions: scope.permissions } });
    const oldMetadata = result.current.changeMetadata; const oldItem = result.current.changeItem;
    rerender({ permissions: ["formcatalogs.read"] });
    act(() => { oldMetadata({ name: { es: "Forbidden edit", en: "Edit" } }); oldItem({ value: null, localId: "forbidden-option", itemId: null, label: { es: "No" }, detail: {}, code: "NO", position: 1, isActive: true }); });
    expect(result.current.draft!.name).toEqual(initial.name);
    expect(result.current.draft!.items.changes).toEqual({});
    expect(result.current.canSave).toBe(false);
  });
  it.each(["catalog", "actor"] as const)("rejects a delayed item page from the previous %s even when both revisions are one", transition => {
    const nextId = "01990000-0000-7000-8000-000000000022";
    const { result, rerender } = renderHook(({ catalog, actorId }) => useCatalogDraftEditor({ ...scope, actorId }, catalog), { ...harness(), initialProps: { catalog: initial, actorId: "actor-a" } });
    const oldLoadItems = result.current.loadItems;
    rerender({ catalog: transition === "catalog" ? { ...initial, id: nextId, key: nextId.replaceAll("-", "") } : initial, actorId: transition === "actor" ? "actor-b" : "actor-a" });
    act(() => oldLoadItems([{ value: null, id: itemId, code: "OLD", text: { es: "Private row A", en: null }, detail: {}, position: 1, isActive: true, fields: {}, fieldTexts: {} }], 1));
    expect(result.current.draft!.items).toEqual({ originals: {}, changes: {} });
  });
  it("rejects callbacks from an earlier editor epoch when the original actor returns", async () => {
    let calls = 0; server.use(http.put("/api/forms/catalogs/" + id, () => { calls++; return HttpResponse.json({ catalog: { ...initial, revision: 2 }, itemIdentityMap: {}, fieldIdentityMap: {} }); }));
    const { result, rerender } = renderHook(({ actorId }) => useCatalogDraftEditor({ ...scope, actorId }, initial), { ...harness(), initialProps: { actorId: "actor-a" } });
    const oldChange = result.current.changeMetadata; const oldSave = result.current.save;
    rerender({ actorId: "actor-b" });
    rerender({ actorId: "actor-a" });
    act(() => oldChange({ name: { es: "Old editor private text", en: "Old epoch" } }));
    await act(() => oldSave());
    expect(result.current.draft!.name).toEqual(initial.name);
    expect(calls).toBe(0);
    act(() => result.current.changeMetadata({ name: { es: "Actor actual", en: "Current actor" } }));
    expect(result.current.draft!.name.es).toBe("Actor actual");
  });
  it.each(["catalog", "actor"] as const)("rejects old reread and adoption callbacks after changing %s", async transition => {
    let calls = 0; const nextId = "01990000-0000-7000-8000-000000000022";
    server.use(http.get("/api/forms/catalogs/:id", ({ params }) => { calls++; const currentId = String(params.id); return HttpResponse.json({ ...initial, id: currentId, key: currentId.replaceAll("-", ""), revision: 2 }); }));
    const { result, rerender } = renderHook(({ catalog, actorId }) => useCatalogDraftEditor({ ...scope, actorId }, catalog), { ...harness(), initialProps: { catalog: initial, actorId: "actor-a" } });
    const oldRead = result.current.readCurrent; const oldAdopt = result.current.adoptCurrent;
    rerender({ catalog: transition === "catalog" ? { ...initial, id: nextId, key: nextId.replaceAll("-", "") } : initial, actorId: transition === "actor" ? "actor-b" : "actor-a" });
    await act(() => oldRead());
    expect(calls).toBe(0);
    act(() => result.current.changeMetadata({ name: { es: "Borrador actual", en: "Current draft" } }));
    await act(() => result.current.readCurrent());
    act(() => oldAdopt());
    expect(result.current.draft!.name.es).toBe("Borrador actual");
    expect(result.current.draft!.revision).toBe(1);
    expect(result.current.current!.revision).toBe(2);
    expect(calls).toBe(1);
  });
  it.each(["save", "adopt"] as const)("rejects old page callbacks after %s while the current callback loads canonical items", async decision => {
    server.use(http.put("/api/forms/catalogs/" + id, () => decision === "adopt" ? HttpResponse.json({ code: "Forms.Catalog.RevisionConflict" }, { status: 409 }) : HttpResponse.json({ catalog: { ...initial, revision: 2 }, itemIdentityMap: {}, fieldIdentityMap: {} })), http.get("/api/forms/catalogs/" + id, () => HttpResponse.json({ ...initial, revision: 2 })));
    const { result } = renderHook(() => useCatalogDraftEditor(scope, initial), harness());
    const oldLoadItems = result.current.loadItems;
    await act(() => result.current.save());
    if (decision === "adopt") { await act(() => result.current.readCurrent()); act(() => result.current.adoptCurrent()); }
    const item = { value: null, id: itemId, code: "CANONICAL", text: { es: "Confirmed option", en: null }, detail: {}, position: 1, isActive: true, fields: {}, fieldTexts: {} };
    act(() => oldLoadItems([{ ...item, code: "OLD" }], 2));
    expect(result.current.draft!.items).toEqual({ originals: {}, changes: {} });
    act(() => result.current.loadItems([item], 2));
    expect(Object.values(result.current.draft!.items.originals)[0]!.code).toBe("CANONICAL");
    act(() => result.current.changeMetadata({ name: { es: "Cambio actual", en: "Current change" } }));
    expect(result.current.draft!.name.es).toBe("Cambio actual");
  });
});

const filterInitial: CatalogDetail = { ...initial, kind: "Filters", filters: { textColumn: "name", detailColumn: null, conditions: [], excludeRecipient: true, sortColumn: "name", sortDescending: false }, fields: null, presentation: null, presentationCheck: null };
const previewResult = { items: [{ id: itemId, text: "Ana", detail: null, canSend:true }], totalCount: 1, exceedsLimit: false };
describe("Filters catalog editor", () => {
  it("tests the chosen sample before saving configuration and clears the dirty baseline", async () => {
    const events: string[] = []; const writes: unknown[] = []; const h = harness();
    server.use(http.post("/api/forms/catalog-previews", async ({ request }) => { events.push("preview"); expect(await request.json()).toMatchObject({ sampleUserId: itemId, filters: { conditions: [{ column: "role", operator: "has", value: "Operario" }] } }); return HttpResponse.json(previewResult); }), http.put("/api/forms/catalogs/" + id + "/filters", async ({ request }) => { events.push("save"); const body = await request.json() as { filters: CatalogDetail["filters"] }; writes.push(body); return HttpResponse.json({ catalog: { ...filterInitial, filters: body.filters, revision: 2 }, itemIdentityMap: {}, fieldIdentityMap: {} }); }));
    const { result } = renderHook(() => useCatalogDraftEditor(scope, filterInitial), h);
    act(() => result.current.changeFilters({ ...result.current.draft!.filters!, conditions: [{ localId: "private-row", column: "role", operator: "has", value: "Operario" }] }));
    expect(result.current.dirty).toBe(true);
    await act(() => result.current.save(itemId));
    expect(events).toEqual(["preview", "save"]);
    expect(writes[0]).not.toHaveProperty("sampleUserId"); expect(writes[0]).not.toHaveProperty("items"); expect(JSON.stringify(writes)).not.toContain("private-row");
    expect(result.current.draft!.revision).toBe(2); expect(result.current.dirty).toBe(false); expect(h.client.getMutationCache().getAll()).toEqual([]);
  });
  it("requires an explicit sample and does not save an oversized preview", async () => {
    let previews = 0; let writes = 0;
    server.use(http.post("/api/forms/catalog-previews", () => { previews++; return HttpResponse.json({ items: [], totalCount: 201, exceedsLimit: true }); }), http.put("/api/forms/catalogs/" + id + "/filters", () => { writes++; return HttpResponse.json({}); }));
    const { result } = renderHook(() => useCatalogDraftEditor(scope, filterInitial), harness());
    await act(() => result.current.save()); expect(previews).toBe(0);
    await act(() => result.current.save(itemId)); expect(previews).toBe(1); expect(writes).toBe(0); expect(result.current.previewResult!.exceedsLimit).toBe(true); expect(result.current.requiresReview).toBe(false);
  });
  it("preserves filters on 409 and adopts a reread only after a decision", async () => {
    let writes = 0;
    server.use(http.post("/api/forms/catalog-previews", () => HttpResponse.json(previewResult)), http.put("/api/forms/catalogs/" + id + "/filters", () => { writes++; return HttpResponse.json({ code: "Forms.Catalog.RevisionConflict" }, { status: 409 }); }), http.get("/api/forms/catalogs/" + id, () => HttpResponse.json({ ...filterInitial, revision: 2 })));
    const { result } = renderHook(() => useCatalogDraftEditor(scope, filterInitial), harness());
    act(() => result.current.changeFilters({ ...result.current.draft!.filters!, sortDescending: true }));
    await act(() => result.current.save(itemId)); await act(() => result.current.readCurrent());
    expect(result.current.draft!.filters!.sortDescending).toBe(true); expect(result.current.requiresReview).toBe(true); expect(writes).toBe(1);
    act(() => result.current.adoptCurrent()); expect(result.current.draft!.filters!.sortDescending).toBe(false); expect(result.current.draft!.revision).toBe(2); expect(result.current.dirty).toBe(false);
  });
  it("does not preview without Manage and keeps a failed preview editable", async () => {
    let calls = 0; server.use(http.post("/api/forms/catalog-previews", () => { calls++; return HttpResponse.json({}, { status: 500 }); }));
    const { result, rerender } = renderHook(({ permissions }) => useCatalogDraftEditor({ ...scope, permissions }, filterInitial), { ...harness(), initialProps: { permissions: ["formcatalogs.read"] } });
    await act(() => result.current.preview(itemId)); expect(calls).toBe(0);
    rerender({ permissions: scope.permissions }); await act(() => result.current.save(itemId));
    expect(calls).toBe(1); expect(result.current.requiresReview).toBe(false); expect(result.current.canSave).toBe(true);
  });
});

it("keeps an incomplete typed item in memory and blocks a direct save without a request or MutationCache entry", async () => {
  const h = harness(); let writes = 0;
  server.use(http.put("/api/forms/catalogs/" + id, () => { writes++; return HttpResponse.json({}); }));
  const { result } = renderHook(() => useCatalogDraftEditor(scope, { ...initial, valueType: "Integer" }), h);
  act(() => result.current.loadItems([{ value: "12", id: itemId, code: "C1", text: { es: "Uno" }, detail: {}, position: 1, isActive: true, fields: {}, fieldTexts: {} }]));
  act(() => result.current.changeItem({ ...Object.values(result.current.draft!.items.originals)[0]!, value: "-" }));
  await act(() => result.current.save());
  expect(result.current.draft!.items.changes["item:" + itemId]?.value).toBe("-");
  expect(result.current.dirty).toBe(true); expect(writes).toBe(0);
  expect(h.client.getMutationCache().getAll()).toEqual([]);
});

it("adopts an import baseline only while clean and keeps a concurrent local edit", () => {
 const {result}=renderHook(()=>useCatalogDraftEditor(scope,initial),harness());
 act(()=>result.current.observeCatalog({...initial,revision:2,name:{es:"Importado",en:"Imported"}}));
 expect(result.current.draft!.revision).toBe(2);expect(result.current.draft!.name.es).toBe("Importado");expect(result.current.dirty).toBe(false);
 act(()=>result.current.changeMetadata({name:{es:"Mi edición",en:"My edit"}}));
 act(()=>result.current.observeCatalog({...initial,revision:3}));
 expect(result.current.draft!.revision).toBe(2);expect(result.current.draft!.name.es).toBe("Mi edición");expect(result.current.dirty).toBe(true);
});
it("stages one alphabetical command and rejects mixing it with captured moves", () => {
 const {result}=renderHook(()=>useCatalogDraftEditor(scope,initial),harness());
 act(()=>result.current.loadItems([{id:itemId,code:"C1",value:null,text:{es:"Uno",en:null},detail:{},position:1,isActive:true, fields: {}, fieldTexts: {}}]));
 act(()=>result.current.changeSort(true));act(()=>result.current.changeMove(itemId,"down"));
 expect(result.current.draft).toMatchObject({sortAlphabetically:true,moves:[]});expect(result.current.dirty).toBe(true);
 act(()=>result.current.changeSort(false));act(()=>result.current.changeMove(itemId,"down"));act(()=>result.current.changeSort(true));
 expect(result.current.draft).toMatchObject({sortAlphabetically:false,moves:[{itemId,direction:"down"}]});
});
