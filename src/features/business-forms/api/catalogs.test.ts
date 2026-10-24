import { afterEach, describe, expect, it } from "vitest";
import { http, HttpResponse } from "msw";
import { server } from "@/test/mocks/server";
import { configureHttpClient, resetHttpClient } from "@/shared/api/httpClient";
import { checkCatalogPresentation, createManualCatalog, fetchCatalog, fetchCatalogItems, updateManualCatalog } from "./catalogs";

// Synthetic values matching current DTO source. Raw backend exports will qualify this adapter later.
const id = "01990000-0000-7000-8000-000000000020";
const itemId = "01990000-0000-7000-8000-000000000021";
const otherId = "01990000-0000-7000-8000-000000000022";
const catalog = { valueType: "Text" as const, proposal: null, id, key: id.replaceAll("-", ""), name: { es: "Clientes", en: "Customers" }, description: { es: "Personas a visitar", en: "People to visit" }, kind: "Manual", revision: 1, isActive: true, itemsCount: 1, usageCount: 0, originalCulture: "es", unavailableReasonCode: null, filters: null, fields: [], presentation: null, presentationCheck: { cultures: [{ culture: "es", titleTooLongCount: 0, titleExamples: [], descriptionTooLongCount: 0, descriptionExamples: [] }, { culture: "en", titleTooLongCount: 0, titleExamples: [], descriptionTooLongCount: 0, descriptionExamples: [] }] } };
const item = { value: null, id: itemId, code: "C-001", text: { es: "Pérez Hnos.", en: null }, detail: { es: "Av. Colón 1234", en: null }, position: 1, isActive: false, fields: {}, fieldTexts: {} };
const body = { name: catalog.name, description: catalog.description, items: [{ localId: "new-option", itemId: null, code: item.code, text: item.text, detail: item.detail, isActive: false }] };
afterEach(resetHttpClient);

describe("Manual catalog adapter against current DTO source", () => {
  it("sends metadata and item delta in one create request without filling optional English", async () => {
    const received: unknown[] = [];
    server.use(http.post("/api/forms/catalogs", async ({ request }) => { received.push(await request.json()); return HttpResponse.json({ catalog, itemIdentityMap: { "new-option": itemId }, fieldIdentityMap: {} }, { status: 201 }); }));
    const saved = await createManualCatalog(body);
    expect(received).toEqual([body]);
    expect(saved.catalog.name).toEqual(catalog.name);
    expect(saved.itemIdentityMap).toEqual({ "new-option": itemId });
    expect(received[0]).not.toHaveProperty("kind");
    expect(received[0]).not.toHaveProperty("requestId");
    expect((received[0] as { items: unknown[] }).items[0]).not.toHaveProperty("position");
  });
  it("updates an existing identity and editable code with one expectedRevision body", async () => {
    const update = { ...body, expectedRevision: 1, items: [{ ...body.items[0]!, itemId, code: "C-099", isActive: true }] };
    const received: unknown[] = [];
    server.use(http.put("/api/forms/catalogs/" + id, async ({ request }) => { received.push(await request.json()); return HttpResponse.json({ catalog: { ...catalog, revision: 2 }, itemIdentityMap: {}, fieldIdentityMap: {} }); }));
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
  it("requests catalog options by repeated ids", async () => {
    const urls: string[] = [];
    server.use(http.get("/api/forms/catalogs/" + id + "/items", ({ request }) => { urls.push(request.url); return HttpResponse.json({ items: [item], page: 1, pageSize: 2, totalCount: 1, totalPages: 1, hasPrevious: false, hasNext: false }); }));
    await fetchCatalogItems(id, { page: 1, pageSize: 2, ids: [itemId, otherId] });
    const query = new URL(urls[0]!).searchParams;
    expect(query.getAll("ids")).toEqual([itemId, otherId]);
    expect(new URL(urls[0]!).search).toBe(`?page=1&pageSize=2&ids=${itemId}&ids=${otherId}`);
  });
  it("rejects wrong-catalog save replies and incomplete local identity maps", async () => {
    server.use(http.put("/api/forms/catalogs/" + id, () => HttpResponse.json({ catalog: { ...catalog, id: otherId, key: otherId.replaceAll("-", ""), revision: 2 }, itemIdentityMap: { "new-option": itemId }, fieldIdentityMap: {} })));
    await expect(updateManualCatalog(id, { ...body, expectedRevision: 1 })).rejects.toThrow("Unsupported catalog response.");
    server.use(http.post("/api/forms/catalogs", () => HttpResponse.json({ catalog, itemIdentityMap: {}, fieldIdentityMap: {} }, { status: 201 })));
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
  it("preserves a hidden usage count as null in detail and write receipts", async () => {
    const hidden = { ...catalog, usageCount: null };
    server.use(http.get("/api/forms/catalogs/" + id, () => HttpResponse.json(hidden)),
      http.post("/api/forms/catalogs", () => HttpResponse.json({ catalog: hidden, itemIdentityMap: { "new-option": itemId }, fieldIdentityMap: {} }, { status: 201 })),
      http.put("/api/forms/catalogs/" + id, () => HttpResponse.json({ catalog: { ...hidden, revision: 2 }, itemIdentityMap: {}, fieldIdentityMap: {} })));
    expect((await fetchCatalog(id)).usageCount).toBeNull();
    expect((await createManualCatalog(body)).catalog.usageCount).toBeNull();
    expect((await updateManualCatalog(id, { ...body, expectedRevision: 1, items: [] })).catalog.usageCount).toBeNull();
  });

});

it("posts only a question's own presentation to the presentation check and reads the closed per-language result", async () => {
  const presentation = { title: ["code", "text"], description: [] };
  const check = { cultures: [{ culture: "es", titleTooLongCount: 1, titleExamples: [{ itemId, title: "C-001 · Pérez Hnos. y Asociados" }], descriptionTooLongCount: 0, descriptionExamples: [] }] };
  const received: unknown[] = [];
  server.use(http.post("/api/forms/catalogs/" + id + "/presentation-checks", async ({ request }) => { received.push(await request.json()); return HttpResponse.json(received.length === 1 ? check : { ...check, private: "PRIVATE" }); }));
  expect(await checkCatalogPresentation(id, presentation)).toEqual(check);
  expect(received).toEqual([{ presentation }]);
  await expect(checkCatalogPresentation(id, presentation)).rejects.toThrow("Unsupported catalog response.");
  await expect(checkCatalogPresentation("not-an-id", presentation)).rejects.toThrow("Unsupported catalog response.");
  expect(received).toHaveLength(2);
});
