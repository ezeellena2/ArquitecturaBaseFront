import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { http, HttpResponse } from "msw";
import { server } from "@/test/mocks/server";
import { resetHttpClient } from "@/shared/api/httpClient";
import optionsFixture from "@/test/fixtures/catalogs-http/filters/options.json?raw";
import previewRequestFixture from "@/test/fixtures/catalogs-http/filters/preview-request.json?raw";
import previewFixture from "@/test/fixtures/catalogs-http/filters/preview.json?raw";
import createRequestFixture from "@/test/fixtures/catalogs-http/filters/create-request.json?raw";
import createdFixture from "@/test/fixtures/catalogs-http/filters/created.json?raw";
import detailFixture from "@/test/fixtures/catalogs-http/filters/detail.json?raw";
import updateRequestFixture from "@/test/fixtures/catalogs-http/filters/update-request.json?raw";
import updatedFixture from "@/test/fixtures/catalogs-http/filters/updated.json?raw";
import { createFiltersCatalog, fetchCatalog, fetchCatalogFilterOptions, previewCatalogFilters, updateFiltersCatalog, type CatalogFilterPreviewBody, type FiltersCatalogBody } from "./catalogs";

// Unchanged HTTP exports and automatic provenance from the backend K4 integration test.
const input = process.env.FORMS_CATALOG_FILTER_HTTP_CONTRACT_INPUT;
const directory = input ?? resolve("src/test/fixtures/catalogs-http/filters");
const raw = (fallback: string, name: string) => input ? readFileSync(resolve(input, name), "utf8") : fallback;
const optionsRaw = raw(optionsFixture, "options.json"), previewRequestRaw = raw(previewRequestFixture, "preview-request.json"), previewRaw = raw(previewFixture, "preview.json");
const createRequestRaw = raw(createRequestFixture, "create-request.json"), createdRaw = raw(createdFixture, "created.json"), detailRaw = raw(detailFixture, "detail.json");
const updateRequestRaw = raw(updateRequestFixture, "update-request.json"), updatedRaw = raw(updatedFixture, "updated.json");
const createBody = JSON.parse(createRequestRaw) as FiltersCatalogBody;
const updateBody = JSON.parse(updateRequestRaw) as FiltersCatalogBody & { expectedRevision: number };
const previewBody = JSON.parse(previewRequestRaw) as CatalogFilterPreviewBody;
const id = (JSON.parse(createdRaw) as { catalog: { id: string } }).catalog.id;
const json = (body: string, status = 200) => new HttpResponse(body, { status, headers: { "content-type": "application/json" } });
afterEach(resetHttpClient);
describe("Filters catalog adapter with unchanged real HTTP bodies", () => {
  it("verifies the producer and all eight unchanged HTTP exports", () => {
    const provenance = JSON.parse(readFileSync(resolve(directory, "provenance.json"), "utf8")) as { producer: { test: string }; runner: { exportFiles: { path: string; length: number; sha256: string }[] } };
    expect(provenance.producer.test).toBe("ArquitecturaBase.Api.IntegrationTests.Modules.BusinessForms.FormCatalogFiltersEndpointsTests");
    expect(provenance.runner.exportFiles).toHaveLength(8);
    for (const entry of provenance.runner.exportFiles) {
      const bytes = readFileSync(resolve(directory, entry.path));
      expect(bytes.length, entry.path).toBe(entry.length);
      expect(createHash("sha256").update(bytes).digest("hex"), entry.path).toBe(entry.sha256);
    }
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
