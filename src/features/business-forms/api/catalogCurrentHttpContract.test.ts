import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { expect, it } from "vitest";
import { http, HttpResponse } from "msw";
import { server } from "@/test/mocks/server";
import createdRaw from "@/test/fixtures/catalogs-http/manual-current/created.json?raw";
import detailRaw from "@/test/fixtures/catalogs-http/manual-current/detail.json?raw";
import updatedRaw from "@/test/fixtures/catalogs-http/manual-current/updated.json?raw";
import createRequestRaw from "@/test/fixtures/catalogs-http/manual-current/create-request.request.json?raw";
import updateRequestRaw from "@/test/fixtures/catalogs-http/manual-current/update-request.request.json?raw";
import listEsRaw from "@/test/fixtures/catalogs-http/manual-current/list-es.json?raw";
import listEnRaw from "@/test/fixtures/catalogs-http/manual-current/list-en.json?raw";
import { createManualCatalog, fetchCatalogPage, fetchCatalog, updateManualCatalog, type ManualCatalogBody, type UpdateManualCatalogBody } from "./catalogs";

// Current producer cohort, separate from the immutable pre-K4 fixtures.
const input = process.env.FORMS_CATALOG_HTTP_CONTRACT_INPUT;
const directory = input ? resolve(input, "manual-bilingual") : resolve("src/test/fixtures/catalogs-http/manual-current");
const raw = (fallback: string, name: string) => input ? readFileSync(resolve(directory, name), "utf8") : fallback;
it("verifies the current Manual producer and all fifteen unchanged HTTP exports", () => {
  const provenance = JSON.parse(readFileSync(resolve(directory, "provenance.json"), "utf8")) as { producer: { test: string }; runner: { exportFiles: { path: string; length: number; sha256: string }[] } };
  expect(provenance.producer.test).toBe("ArquitecturaBase.Api.IntegrationTests.Modules.BusinessForms.FormCatalogEndpointsTests");
  expect(provenance.runner.exportFiles).toHaveLength(15);
  for (const entry of provenance.runner.exportFiles) {
    const bytes = readFileSync(resolve(directory, entry.path));
    expect(bytes.length, entry.path).toBe(entry.length);
    expect(createHash("sha256").update(bytes).digest("hex"), entry.path).toBe(entry.sha256);
  }
});
it("consumes current Manual receipts and detail with filters:null", async () => {
  const createdBody = raw(createdRaw, "created.json"), updatedBody = raw(updatedRaw, "updated.json"), detailBody = raw(detailRaw, "detail.json");
  const created = JSON.parse(createdBody) as { catalog: { id: string } }; const id = created.catalog.id;
  const json = (body: string, status = 200) => new HttpResponse(body, { status, headers: { "content-type": "application/json" } });
  server.use(http.post("/api/forms/catalogs", () => json(createdBody, 201)), http.put("/api/forms/catalogs/" + id, () => json(updatedBody)), http.get("/api/forms/catalogs/" + id, () => json(detailBody)));
  const createBody = JSON.parse(raw(createRequestRaw, "create-request.request.json")) as ManualCatalogBody; const updateBody = JSON.parse(raw(updateRequestRaw, "update-request.request.json")) as UpdateManualCatalogBody;
  expect(await createManualCatalog(createBody)).toEqual(JSON.parse(createdBody)); expect(await updateManualCatalog(id, updateBody)).toEqual(JSON.parse(updatedBody));
  const detail = await fetchCatalog(id); expect(detail).toEqual(JSON.parse(detailBody)); expect(detail.filters).toBeNull();
});

for (const [culture, fixture] of [["es", listEsRaw], ["en", listEnRaw]] as const) it("consumes current localized Manual pages and origin facets in " + culture, async () => {
  const body = raw(fixture, "list-" + culture + ".json");
  server.use(http.get("/api/forms/catalogs", () => new HttpResponse(body, { headers: { "content-type": "application/json" } })));
  const page = await fetchCatalogPage({ page: 2, pageSize: 1, sort: "name" });
  expect(page).toEqual(JSON.parse(body)); expect(page.filterCounts.byKind.all).toBeGreaterThanOrEqual(page.items.length);
});
