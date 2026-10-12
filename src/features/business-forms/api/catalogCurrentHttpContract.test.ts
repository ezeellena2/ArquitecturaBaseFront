import { expect, it } from "vitest";
import { http, HttpResponse } from "msw";
import { server } from "@/test/mocks/server";
import createdRaw from "@/test/fixtures/catalogs-http/manual-current/created.json?raw";
import detailRaw from "@/test/fixtures/catalogs-http/manual-current/detail.json?raw";
import updatedRaw from "@/test/fixtures/catalogs-http/manual-current/updated.json?raw";
import createRequestRaw from "@/test/fixtures/catalogs-http/manual-current/create-request.request.json?raw";
import updateRequestRaw from "@/test/fixtures/catalogs-http/manual-current/update-request.request.json?raw";
import { createManualCatalog, fetchCatalog, updateManualCatalog, type ManualCatalogBody, type UpdateManualCatalogBody } from "./catalogs";

// Current HTTP cohort, separate from the immutable pre-K4 fixtures. Producer manifest is pending at final closure.
it("consumes current Manual receipts and detail with filters:null", async () => {
  const created = JSON.parse(createdRaw) as { catalog: { id: string } }; const id = created.catalog.id;
  const json = (body: string, status = 200) => new HttpResponse(body, { status, headers: { "content-type": "application/json" } });
  server.use(http.post("/api/forms/catalogs", () => json(createdRaw, 201)), http.put("/api/forms/catalogs/" + id, () => json(updatedRaw)), http.get("/api/forms/catalogs/" + id, () => json(detailRaw)));
  const createBody = JSON.parse(createRequestRaw) as ManualCatalogBody; const updateBody = JSON.parse(updateRequestRaw) as UpdateManualCatalogBody;
  expect(await createManualCatalog(createBody)).toEqual(JSON.parse(createdRaw)); expect(await updateManualCatalog(id, updateBody)).toEqual(JSON.parse(updatedRaw));
  const detail = await fetchCatalog(id); expect(detail).toEqual(JSON.parse(detailRaw)); expect(detail.filters).toBeNull();
});
