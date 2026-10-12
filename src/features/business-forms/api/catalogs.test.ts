import { afterEach, describe, expect, it } from "vitest";
import { http, HttpResponse } from "msw";
import { server } from "@/test/mocks/server";
import { configureHttpClient, resetHttpClient } from "@/shared/api/httpClient";
import { createManualCatalog, fetchCatalog, fetchCatalogItems, updateManualCatalog } from "./catalogs";

// Synthetic values matching current DTO source. Raw backend exports will qualify this adapter later.
const id = "01990000-0000-7000-8000-000000000020";
const itemId = "01990000-0000-7000-8000-000000000021";
const otherId = "01990000-0000-7000-8000-000000000022";
const catalog = { id, key: id.replaceAll("-", ""), name: { es: "Clientes", en: "Customers" }, description: { es: "Personas a visitar", en: "People to visit" }, kind: "Manual", revision: 1, isActive: true, itemsCount: 1, usageCount: 0, unavailableReasonCode: null };
const item = { id: itemId, code: "C-001", text: { es: "Pérez Hnos.", en: null }, detail: { es: "Av. Colón 1234", en: null }, position: 1, isActive: false };
const body = { name: catalog.name, description: catalog.description, items: [{ localId: "new-option", itemId: null, code: item.code, text: item.text, detail: item.detail, position: 1, isActive: false }] };
afterEach(resetHttpClient);

describe("Manual catalog adapter against current DTO source", () => {
  it("sends metadata and item delta in one create request without filling optional English", async () => {
    const received: unknown[] = [];
    server.use(http.post("/api/forms/catalogs", async ({ request }) => { received.push(await request.json()); return HttpResponse.json({ catalog, itemIdentityMap: { "new-option": itemId } }, { status: 201 }); }));
    const saved = await createManualCatalog(body);
    expect(received).toEqual([body]);
    expect(saved.catalog.name).toEqual(catalog.name);
    expect(saved.itemIdentityMap).toEqual({ "new-option": itemId });
    expect(received[0]).not.toHaveProperty("kind");
    expect(received[0]).not.toHaveProperty("requestId");
  });
  it("updates an existing identity and editable code with one expectedRevision body", async () => {
    const update = { ...body, expectedRevision: 1, items: [{ ...body.items[0]!, itemId, code: "C-099", isActive: true }] };
    const received: unknown[] = [];
    server.use(http.put("/api/forms/catalogs/" + id, async ({ request }) => { received.push(await request.json()); return HttpResponse.json({ catalog: { ...catalog, revision: 2 }, itemIdentityMap: {} }); }));
    const saved = await updateManualCatalog(id, update);
    expect(saved.catalog.revision).toBe(2);
    expect(received).toEqual([update]);
    expect(received[0]).not.toHaveProperty("actorId");
  });
  it("consumes the detail and paginated nullable item text maps without modifying them", async () => {
    configureHttpClient({ getLanguage: () => "en" });
    server.use(http.get("/api/forms/catalogs/" + id, ({ request }) => { expect(request.headers.get("accept-language")).toBe("en"); return HttpResponse.json(catalog); }),
      http.get("/api/forms/catalogs/" + id + "/items", ({ request }) => { const query = new URL(request.url).searchParams; expect(query.get("page")).toBe("1"); expect(query.get("pageSize")).toBe("20"); expect(query.get("sort")).toBe("position"); expect(query.get("isActive")).toBe("false"); return HttpResponse.json({ items: [item], page: 1, pageSize: 20, totalCount: 1, totalPages: 1, hasPrevious: false, hasNext: false }); }));
    expect(await fetchCatalog(id)).toEqual(catalog);
    const page = await fetchCatalogItems(id, { page: 1, pageSize: 20, sort: "position", isActive: false });
    expect(page.items).toEqual([item]);
  });
  it("rejects wrong-catalog save replies and incomplete local identity maps", async () => {
    server.use(http.put("/api/forms/catalogs/" + id, () => HttpResponse.json({ catalog: { ...catalog, id: otherId, key: otherId.replaceAll("-", ""), revision: 2 }, itemIdentityMap: { "new-option": itemId } })));
    await expect(updateManualCatalog(id, { ...body, expectedRevision: 1 })).rejects.toThrow("Unsupported catalog response.");
    server.use(http.post("/api/forms/catalogs", () => HttpResponse.json({ catalog, itemIdentityMap: {} }, { status: 201 })));
    await expect(createManualCatalog(body)).rejects.toThrow("Unsupported catalog response.");
  });
  it("rejects incompatible response maps without retaining private values or Zod issues", async () => {
    server.use(http.get("/api/forms/catalogs/" + id, () => HttpResponse.json({ ...catalog, name: { es: "PRIVATE-CATALOG", fr: "Unsupported" } })));
    try { await fetchCatalog(id); throw new Error("Expected a schema rejection."); } catch (error) {
      expect(String(error)).toBe("UnsupportedCatalogResponse: Unsupported catalog response.");
      expect(JSON.stringify(error)).not.toContain("PRIVATE-CATALOG");
      expect(error).not.toHaveProperty("issues");
    }
  });
  it("does not retry a revision conflict or turn it into a partial item update", async () => {
    let calls = 0;
    server.use(http.put("/api/forms/catalogs/" + id, () => { calls++; return HttpResponse.json({ code: "Forms.Catalog.RevisionConflict" }, { status: 409 }); }));
    await expect(updateManualCatalog(id, { ...body, expectedRevision: 1 })).rejects.toMatchObject({ status: 409, code: "Forms.Catalog.RevisionConflict" });
    expect(calls).toBe(1);
  });
});
