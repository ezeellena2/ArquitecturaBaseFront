import { afterEach, describe, expect, it } from "vitest";
import { http, HttpResponse } from "msw";
import { server } from "@/test/mocks/server";
import { resetHttpClient } from "@/shared/api/httpClient";
import { fetchCatalog, fetchCatalogLookup, fetchCatalogPage, lookupCatalogParty } from "./catalogs";

// Synthetic values matching the DTO source of External catalogs (FormCatalogDetailResponse.Feed, FormCatalogOriginCounts.External)
// and of «Completar con …» (FormCatalogLookupResponse, FormCatalogLookupResultResponse), without HTTP captures.
const id = "01990000-0000-7000-8000-000000000301";
const fieldId = "01990000-0000-7000-8000-000000000302";
const option = "01990000-0000-7000-8000-000000000303";
const check = { cultures: [{ culture: "es", titleTooLongCount: 0, titleExamples: [], descriptionTooLongCount: 0, descriptionExamples: [] }] };
const external = { id, key: "arca.vat-conditions", name: { es: "Condición frente al IVA", en: "VAT condition" }, description: {}, originalCulture: "es", kind: "External", revision: 3, isActive: true,
  itemsCount: 9, usageCount: 1, unavailableReasonCode: null, filters: null, proposal: null, valueType: "Integer", fields: [], presentation: null, presentationCheck: check,
  feed: { refreshedAtUtc: "2026-11-08T10:00:00Z", failedAtUtc: "2026-11-11T14:45:00Z", failureCode: "Arca.Connection.Unavailable" } };
const library = { ...external, key: "arca.customers", kind: "Manual", valueType: "Text", feed: undefined };
const row = { id, name: "Condición frente al IVA", description: null, origin: "External", valueType: "Integer", optionsCount: 9, usageCount: 1, state: "Active", stateReason: null, canEdit: true };
const page = (byKind: Record<string, number>) => ({ items: [row], page: 1, pageSize: 20, totalCount: 1, totalPages: 1, hasPrevious: false, hasNext: false, filterCounts: { byKind } });
const detail = (body: object) => server.use(http.get("/api/forms/catalogs/" + id, () => HttpResponse.json(body)));
afterEach(resetHttpClient);

describe("catalogs a module keeps (External)", () => {
  it("reads the detail with its feed and the stable key of its source", async () => {
    detail(external);
    const read = await fetchCatalog(id);
    expect(read.kind).toBe("External");
    expect(read.feed).toEqual(external.feed);
  });
  it("reads a catalog a standard created with its stable key, which is not the id", async () => {
    detail(library);
    expect((await fetchCatalog(id)).key).toBe("arca.customers");
  });
  it.each([
    ["an External catalog without its feed", { ...external, feed: undefined }],
    ["a Manual catalog with a feed", { ...library, feed: external.feed }],
    ["a failure without its code", { ...external, feed: { ...external.feed, failureCode: null } }],
    ["a key that is neither the id nor a stable key", { ...external, key: "Arca Customers" }],
    ["a stable key longer than 32 characters", { ...external, key: "arca." + "x".repeat(28) }],
  ])("rejects %s", async (_, body) => {
    detail(body);
    await expect(fetchCatalog(id)).rejects.toThrow("Unsupported catalog response.");
  });
  it("lists the origin External, filters by it and counts it only when there is one", async () => {
    const queries: (string | null)[] = [];
    server.use(http.get("/api/forms/catalogs", ({ request }) => { queries.push(new URL(request.url).searchParams.get("kind")); return HttpResponse.json(page({ all: 6, manual: 1, filters: 0, external: 5 })); }));
    const listed = await fetchCatalogPage({ page: 1, pageSize: 20, kind: "External" });
    expect(listed.items[0]!.origin).toBe("External");
    expect(listed.filterCounts.byKind.external).toBe(5);
    expect(queries).toEqual(["External"]);
    server.use(http.get("/api/forms/catalogs", () => HttpResponse.json(page({ all: 6, manual: 1, filters: 0 }))));
    expect((await fetchCatalogPage({ page: 1, pageSize: 20 })).filterCounts.byKind.external).toBeUndefined();
  });
});

describe("«Completar con …» (CA1)", () => {
  it("reads the registry and the tax-id field, or null when no registry completes the catalog", async () => {
    server.use(http.get("/api/forms/catalogs/" + id + "/lookup", () => HttpResponse.json({ name: { es: "ARCA", en: "ARCA" }, fieldId })));
    expect(await fetchCatalogLookup(id)).toEqual({ name: { es: "ARCA", en: "ARCA" }, fieldId });
    server.use(http.get("/api/forms/catalogs/" + id + "/lookup", () => HttpResponse.json({ title: "No", code: "Forms.Catalog.LookupUnavailable" }, { status: 404 })));
    expect(await fetchCatalogLookup(id)).toBeNull();
    server.use(http.get("/api/forms/catalogs/" + id + "/lookup", () => HttpResponse.json({ title: "No", code: "Forms.Catalog.NotFound" }, { status: 404 })));
    await expect(fetchCatalogLookup(id)).rejects.toMatchObject({ status: 404, code: "Forms.Catalog.NotFound" });
  });
  it("sends the tax id as typed and reads what the registry knows, or why it could not", async () => {
    const bodies: unknown[] = [];
    const found = { text: "Agro del Sur S.A.", fields: [{ fieldId, value: "30500010912" }, { fieldId: option, value: option }], failureCode: null, failureMessage: null };
    server.use(http.post("/api/forms/catalogs/" + id + "/lookup", async ({ request }) => { bodies.push(await request.json()); return HttpResponse.json(found); }));
    expect(await lookupCatalogParty(id, "30-50001091-2")).toEqual(found);
    expect(bodies).toEqual([{ taxId: "30-50001091-2" }]);
    const failed = { text: null, fields: [], failureCode: "Arca.Registry.PersonNotFound", failureMessage: "ARCA no tiene datos de esa CUIT en el padrón." };
    server.use(http.post("/api/forms/catalogs/" + id + "/lookup", () => HttpResponse.json(failed)));
    expect(await lookupCatalogParty(id, "20123456786")).toEqual(failed);
  });
  it.each([
    ["a failure without its message", { text: null, fields: [], failureCode: "Arca.Registry.PersonNotFound", failureMessage: null }],
    ["a failure that still fills fields", { text: null, fields: [{ fieldId, value: "x" }], failureCode: "Arca.Connection.Unavailable", failureMessage: "ARCA no respondió." }],
    ["the same field twice", { text: "X", fields: [{ fieldId, value: "1" }, { fieldId: fieldId.toUpperCase(), value: "2" }], failureCode: null, failureMessage: null }],
    ["an answer without the failure properties", { text: "X", fields: [] }],
  ])("rejects %s", async (_, body) => {
    server.use(http.post("/api/forms/catalogs/" + id + "/lookup", () => HttpResponse.json(body)));
    await expect(lookupCatalogParty(id, "20123456786")).rejects.toThrow("Unsupported catalog response.");
  });
});
