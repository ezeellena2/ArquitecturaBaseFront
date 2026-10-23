import { httpCohort } from "@/test/httpCohort";
import { expect, it } from "vitest";
import { http, HttpResponse } from "msw";
import { readCatalog, readCatalogItems, readCatalogSave } from "./catalogResponse";
import { readCatalogFieldFeedback } from "./catalogFieldFeedback";
import { server } from "@/test/mocks/server";
import { createManualCatalog, fetchCatalogPage, fetchCatalog, updateManualCatalog, type ManualCatalogBody, type UpdateManualCatalogBody } from "./catalogs";

// Current producer cohort, separate from the immutable pre-K4 fixtures.
const cohort=httpCohort("manualCatalogs");
const raw=(name:string)=>cohort.bytes(name).toString("utf8");
const fieldCaptures = ["fields-create.request.json", "fields-update.request.json", "fields-created.json", "fields-required-error.json", "fields-values-saved.json", "fields-conversion-error.json", "fields-unique-error.json", "fields-detail.json", "fields-items.json", "fields-removal-confirmation.json", "fields-removed.json", "fields-presentation.json", "fields-source-items.json", "fields-source-in-use.json"];
it("verifies the exact current Manual and field captures from the common run", () => {
 const provenance=cohort.verify();
 expect(provenance.sources.some(source=>source.path.endsWith("FormCatalogEndpointsTests.cs"))).toBe(true);
 expect(provenance.captures.map(entry=>entry.name).sort()).toEqual(["created.json","updated.json","detail.json","items.json","list-es.json","list-en.json","conflict-es.json","conflict-en.json","create-request.request.json","create-duplicate-positions-request.request.json","missing-revision-request.request.json","inactive-request.request.json","conflict-request.request.json","queued-moves-request.request.json","update-request.request.json", ...["text","integer","decimal","date"].flatMap(type=>["typed-"+type+"-created.json","typed-"+type+"-items.json"]), "typed-invalid-value-es.json","typed-invalid-value-en.json","typed-required-value.json","typed-type-change-rejected.json", ...fieldCaptures].sort());
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


it("reads the actual extra-field receipts, source labels and preserved inactive field", () => {
  expect(cohort.verify().sources.some(source => source.path.endsWith("/FormCatalogEndpointsTests.Fields.cs"))).toBe(true);
  const created = readCatalogSave(cohort.json("fields-created.json"), ["one"], undefined, undefined, ["field"]);
  const fieldId = created.fieldIdentityMap!.field!;
  expect(created.catalog.fields?.[0]?.id).toBe(fieldId);
  const saved = readCatalogSave(cohort.json("fields-values-saved.json"), [], created.catalog.id, 1);
  expect(saved.catalog.revision).toBe(2);
  const detail = readCatalog(cohort.json("fields-detail.json"), created.catalog.id);
  expect(detail.fields?.[0]).toMatchObject({ id: fieldId, type: "integer", required: true, unique: true, hasValues: true });
  const items = readCatalogItems(cohort.json("fields-items.json"));
  expect(items.items[0]?.fields?.[fieldId]).toBe("1");
  const removed = readCatalogSave(cohort.json("fields-removed.json"), []);
  expect(removed.catalog.fields?.[0]).toMatchObject({ isActive: false, name: { es: "Field" } });
  const presentation = readCatalogSave(cohort.json("fields-presentation.json"), []);
  expect(presentation.catalog.presentationCheck?.titleTooLongCount).toBe(1);
  const source = readCatalogItems(cohort.json("fields-source-items.json"));
  const sourceField = presentation.catalog.fields![0]!.id;
  expect(source.items[0]?.fieldTexts?.[sourceField]?.es).toBe("A source choice");
});

it("passes untouched field rejections through the current Manual client", async () => {
  const created = readCatalogSave(cohort.json("fields-created.json"), ["one"], undefined, undefined, ["field"]);
  const body = cohort.json("fields-update.request.json") as UpdateManualCatalogBody;
  const errors = [["fields-required-error.json", 400, "Forms.Catalog.FieldValuesMissing"], ["fields-conversion-error.json", 400, "Forms.Catalog.FieldTypeNotConvertible"], ["fields-unique-error.json", 400, "Forms.Catalog.FieldValueDuplicate"], ["fields-removal-confirmation.json", 400, "Forms.Catalog.FieldRemovalNotConfirmed"], ["fields-source-in-use.json", 409, "Forms.Catalog.SourceInUse"]] as const;
  for (const [name, status, code] of errors) {
    server.use(http.put("/api/forms/catalogs/" + created.catalog.id, () => cohort.response(name, status, { "content-type": "application/problem+json" })));
    await expect(updateManualCatalog(created.catalog.id, body)).rejects.toMatchObject({ status, code, problem: cohort.json(name) });
  }
});
it("reads the row, attempted value and reason of a type change that does not convert", () => {
  const conversion = cohort.json("fields-conversion-error.json") as { invalidRows: { itemId: string }[] };
  expect(readCatalogFieldFeedback(conversion)).toEqual({ convertedCount: 0, invalidCount: 1, invalidRows: [{ itemId: conversion.invalidRows[0]!.itemId, code: "ONE", row: 1, value: "1", reason: "invalid" }] });
});
