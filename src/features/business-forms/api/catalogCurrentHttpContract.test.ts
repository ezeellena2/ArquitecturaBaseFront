import { httpCohort } from "@/test/httpCohort";
import { expect, it } from "vitest";
import { http, HttpResponse } from "msw";
import { server } from "@/test/mocks/server";
import { createManualCatalog, fetchCatalogPage, fetchCatalog, updateManualCatalog, type ManualCatalogBody, type UpdateManualCatalogBody } from "./catalogs";

// Current producer cohort, separate from the immutable pre-K4 fixtures.
const cohort=httpCohort("manualCatalogs");
const raw=(name:string)=>cohort.bytes(name).toString("utf8");
it("verifies all twenty-seven exact current Manual captures from the common run", () => {
 const provenance=cohort.verify();
 expect(provenance.sources.some(source=>source.path.endsWith("FormCatalogEndpointsTests.cs"))).toBe(true);
 expect(provenance.captures.map(entry=>entry.name).sort()).toEqual(["created.json","updated.json","detail.json","items.json","list-es.json","list-en.json","conflict-es.json","conflict-en.json","create-request.request.json","create-duplicate-positions-request.request.json","missing-revision-request.request.json","inactive-request.request.json","conflict-request.request.json","queued-moves-request.request.json","update-request.request.json", ...["text","integer","decimal","date"].flatMap(type=>["typed-"+type+"-created.json","typed-"+type+"-items.json"]), "typed-invalid-value-es.json","typed-invalid-value-en.json","typed-required-value.json","typed-type-change-rejected.json"].sort());
});
it("consumes current Manual receipts and detail with filters:null", async () => {
  const createdBody = raw("created.json"), updatedBody = raw("updated.json"), detailBody = raw("detail.json");
  const created = JSON.parse(createdBody) as { catalog: { id: string } }; const id = created.catalog.id;
  const json = (body: string, status = 200) => new HttpResponse(body, { status, headers: { "content-type": "application/json" } });
  server.use(http.post("/api/forms/catalogs", () => json(createdBody, 201)), http.put("/api/forms/catalogs/" + id, () => json(updatedBody)), http.get("/api/forms/catalogs/" + id, () => json(detailBody)));
  const createBody = JSON.parse(raw("create-request.request.json")) as ManualCatalogBody; const updateBody = JSON.parse(raw("update-request.request.json")) as UpdateManualCatalogBody;
  expect(await createManualCatalog(createBody)).toEqual(JSON.parse(createdBody)); expect(await updateManualCatalog(id, updateBody)).toEqual(JSON.parse(updatedBody));
  const detail = await fetchCatalog(id); expect(detail).toEqual(JSON.parse(detailBody)); expect(detail.filters).toBeNull();
});

for (const culture of ["es", "en"] as const) it("consumes current localized Manual pages and origin facets in " + culture, async () => {
  const body = raw("list-" + culture + ".json");
  server.use(http.get("/api/forms/catalogs", () => new HttpResponse(body, { headers: { "content-type": "application/json" } })));
  const page = await fetchCatalogPage({ page: 2, pageSize: 1, sort: "name" });
  expect(page).toEqual(JSON.parse(body)); expect(page.filterCounts.byKind.all).toBeGreaterThanOrEqual(page.items.length);
});
