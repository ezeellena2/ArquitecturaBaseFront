import { httpCohort } from "@/test/httpCohort";
import { afterEach, describe, expect, it } from "vitest";
import { http, HttpResponse } from "msw";
import { server } from "@/test/mocks/server";
import { resetHttpClient } from "@/shared/api/httpClient";
import { createFiltersCatalog, fetchCatalog, fetchCatalogFilterOptions, previewCatalogFilters, updateFiltersCatalog, type CatalogFilterPreviewBody, type FiltersCatalogBody } from "./catalogs";

// Unchanged HTTP exports and automatic provenance from the backend K4 integration test.
const cohort=httpCohort("catalogFilters");
const raw=(name:string)=>cohort.bytes(name).toString("utf8");
const optionsRaw = raw("options.json"), previewRequestRaw = raw("preview-request.json"), previewRaw = raw("preview.json");
const createRequestRaw = raw("create-request.json"), createdRaw = raw("created.json"), detailRaw = raw("detail.json");
const updateRequestRaw = raw("update-request.json"), updatedRaw = raw("updated.json");
const createBody = JSON.parse(createRequestRaw) as FiltersCatalogBody;
const updateBody = JSON.parse(updateRequestRaw) as FiltersCatalogBody & { expectedRevision: number };
const previewBody = JSON.parse(previewRequestRaw) as CatalogFilterPreviewBody;
const id = (JSON.parse(createdRaw) as { catalog: { id: string } }).catalog.id;
const json = (body: string, status = 200) => new HttpResponse(body, { status, headers: { "content-type": "application/json" } });
afterEach(resetHttpClient);
describe("Filters catalog adapter with unchanged real HTTP bodies", () => {
  it("verifies all eight exact Filters captures from the common run", () => {
    const provenance=cohort.verify();
    expect(provenance.sources.some(source=>source.path.endsWith("FormCatalogFiltersEndpointsTests.cs"))).toBe(true);
    expect(provenance.captures.map(entry=>entry.name).sort()).toEqual(["options.json","preview-request.json","preview.json","create-request.json","created.json","detail.json","update-request.json","updated.json"].sort());
  });
  it("consumes the permitted columns and sample page from the captured options request", async () => {
    server.use(http.get("/api/forms/catalog-filter-options", ({ request }) => { expect(Object.fromEntries(new URL(request.url).searchParams)).toEqual({ page: "1", pageSize: "20", sort: "name" }); return json(optionsRaw); }));
    const options = await fetchCatalogFilterOptions({ page: 1, pageSize: 20, sort: "name" });
    expect(options).toEqual(JSON.parse(optionsRaw));
    expect(options).not.toHaveProperty("isAvailable"); expect(options).not.toHaveProperty("unavailableReasonCode");
    const roles = options.columns.find(column => column.key === "role")!.choices!;
    expect(roles.length).toBeGreaterThan(0);
    for (const role of roles) { expect(role.key).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i); expect(role.label.trim()).not.toBe(""); }
    const savedRole = previewBody.filters.conditions.find(condition => condition.column === "role")!;
    expect(roles.some(role => role.key === savedRole.value)).toBe(true);
  });
  it("previews as the explicitly captured sample person without saving the catalog", async () => {
    const sent: unknown[] = [];
    server.use(http.post("/api/forms/catalog-previews", async ({ request }) => { sent.push(await request.json()); return json(previewRaw); }));
    expect(await previewCatalogFilters(previewBody)).toEqual(JSON.parse(previewRaw)); expect(sent).toEqual([previewBody]);
  });
  it("creates and updates captured metadata/filters with the actual receipts", async () => {
    const sent: unknown[] = [];
    server.use(http.post("/api/forms/catalogs/filters", async ({ request }) => { sent.push(await request.json()); return json(createdRaw, 201); }), http.put("/api/forms/catalogs/" + id + "/filters", async ({ request }) => { sent.push(await request.json()); return json(updatedRaw); }));
    expect(await createFiltersCatalog(createBody)).toEqual(JSON.parse(createdRaw));
    expect(await updateFiltersCatalog(id, updateBody)).toEqual(JSON.parse(updatedRaw));
    expect(sent).toEqual([createBody, updateBody]);
    for (const request of sent) { expect(request).not.toHaveProperty("sampleUserId"); expect(request).not.toHaveProperty("items"); }
  });
  it("reads the unchanged persisted definition without dropping its filters or hidden count", async () => {
    server.use(http.get("/api/forms/catalogs/" + id, () => json(detailRaw)));
    expect(await fetchCatalog(id)).toEqual(JSON.parse(detailRaw));
  });
  it("does not retry a synthetic revision conflict", async () => {
    let calls = 0; server.use(http.put("/api/forms/catalogs/" + id + "/filters", () => { calls++; return HttpResponse.json({ code: "Forms.Catalog.RevisionConflict" }, { status: 409 }); }));
    await expect(updateFiltersCatalog(id, updateBody)).rejects.toMatchObject({ status: 409 }); expect(calls).toBe(1);
  });
});
