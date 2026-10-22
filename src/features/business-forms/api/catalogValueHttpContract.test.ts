import { httpCohort } from "@/test/httpCohort";
import { expect, it } from "vitest";
import { http, HttpResponse } from "msw";
import { server } from "@/test/mocks/server";
import { catalogValueTypes, isCanonicalCatalogValue } from "../catalogValues";
import { readCatalogSave, readCatalogItems } from "./catalogResponse";
import { fetchCatalogItems } from "./catalogs";

const cohort = httpCohort("manualCatalogs");
// These bodies are produced by FormCatalogValueHttpTests at the final integration export, never filled here.
for (const valueType of catalogValueTypes) it("consumes the real " + valueType + " catalog value and identity without localization or numeric coercion", async () => {
  const name = valueType.toLowerCase();
  const createdBody = cohort.bytes("typed-" + name + "-created.json").toString("utf8");
  const itemsBody = cohort.bytes("typed-" + name + "-items.json").toString("utf8");
  const saved = readCatalogSave(JSON.parse(createdBody), ["one"]);
  const page = readCatalogItems(JSON.parse(itemsBody));
  expect(saved.catalog.valueType).toBe(valueType);
  expect(page.items).toHaveLength(1);
  const item = page.items[0]!;
  expect(item.id).toBe(saved.itemIdentityMap.one);
  expect(isCanonicalCatalogValue(valueType, item.value)).toBe(true);
  expect(item.value).toBe(({ Text: null, Integer: "1500", Decimal: "1500.25", Date: "2026-10-22" } as const)[valueType]);
  const requests: string[] = [];
  server.use(http.get("/api/forms/catalogs/" + saved.catalog.id + "/items", ({ request }) => {
    requests.push(new URL(request.url).search);
    return new HttpResponse(itemsBody, { headers: { "content-type": "application/json" } });
  }));
  expect(await fetchCatalogItems(saved.catalog.id, { page: 1, pageSize: 20, sort: "position" })).toEqual(JSON.parse(itemsBody));
  expect(requests).toEqual(["?page=1&pageSize=20&sort=position"]);
});

it("retains the localized real typed-value field errors and the type-change rejection", () => {
  for (const culture of ["es", "en"]) {
    const error = JSON.parse(cohort.bytes("typed-invalid-value-" + culture + ".json").toString("utf8"));
    expect(error.code).toBe("Forms.Catalog.ItemValueInvalid");
    expect(error.errors["items[1].value"]).toEqual([expect.any(String)]);
  }
  const required = JSON.parse(cohort.bytes("typed-required-value.json").toString("utf8"));
  expect(required.code).toBe("Forms.Catalog.ItemValueRequired");
  expect(required.errors["items[0].value"]).toEqual([expect.any(String)]);
  const rejected = JSON.parse(cohort.bytes("typed-type-change-rejected.json").toString("utf8"));
  expect(rejected.status).toBe(400);
});
