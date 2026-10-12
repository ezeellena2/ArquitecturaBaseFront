import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { http, HttpResponse } from "msw";
import { server } from "@/test/mocks/server";
import { configureHttpClient, resetHttpClient } from "@/shared/api/httpClient";
import producerProvenance from "@/test/fixtures/catalogs-http/provenance.json";
import createdRawFixture from "@/test/fixtures/catalogs-http/manual/created.json?raw";
import updatedRawFixture from "@/test/fixtures/catalogs-http/manual/updated.json?raw";
import detailRawFixture from "@/test/fixtures/catalogs-http/manual/detail.json?raw";
import itemsRawFixture from "@/test/fixtures/catalogs-http/manual/items.json?raw";
import createRequestRawFixture from "@/test/fixtures/catalogs-http/manual/create-request.request.json?raw";
import updateRequestRawFixture from "@/test/fixtures/catalogs-http/manual/update-request.request.json?raw";
import conflictRequestRawFixture from "@/test/fixtures/catalogs-http/manual/conflict-request.request.json?raw";
import conflictEsRawFixture from "@/test/fixtures/catalogs-http/manual/conflict-es.json?raw";
import conflictEnRawFixture from "@/test/fixtures/catalogs-http/manual/conflict-en.json?raw";
import listEsRawFixture from "@/test/fixtures/catalogs-http/manual/list-es.json?raw";
import listEnRawFixture from "@/test/fixtures/catalogs-http/manual/list-en.json?raw";
import { createManualCatalog, fetchCatalog, fetchCatalogItems, fetchCatalogPage, updateManualCatalog, type ManualCatalogBody } from "./catalogs";

const input = process.env.FORMS_CATALOG_HTTP_CONTRACT_INPUT;
const body = (fallback: string, name: string): string => input ? readFileSync(resolve(input, "manual-bilingual", name), "utf8") : fallback;
const createdRaw = createdRawFixture;
const updatedRaw = updatedRawFixture;
const detailRaw = detailRawFixture;
const itemsRaw = body(itemsRawFixture, "items.json");
const createRequestRaw = body(createRequestRawFixture, "create-request.request.json");
const updateRequestRaw = body(updateRequestRawFixture, "update-request.request.json");
const conflictRequestRaw = body(conflictRequestRawFixture, "conflict-request.request.json");
const conflictEsRaw = body(conflictEsRawFixture, "conflict-es.json");
const conflictEnRaw = body(conflictEnRawFixture, "conflict-en.json");
const listEsRaw = body(listEsRawFixture, "list-es.json");
const listEnRaw = body(listEnRawFixture, "list-en.json");

const created = JSON.parse(createdRaw) as { catalog: { id: string } };
const id = created.catalog.id;
const json = (body: string, status = 200) => new HttpResponse(body, { status, headers: { "content-type": "application/json" } });
afterEach(resetHttpClient);

describe("Historical catalog HTTP exports and current contract rejection", () => {
  it("retains the unchanged producer provenance and exact exported bytes", () => {
    const directory = input ? resolve(input, "manual-bilingual") : resolve("src/test/fixtures/catalogs-http/manual");
    const provenance: typeof producerProvenance = input ? JSON.parse(readFileSync(resolve(directory, "provenance.json"), "utf8")) : producerProvenance;
    expect(provenance.producer.test).toBe("ArquitecturaBase.Api.IntegrationTests.Modules.BusinessForms.FormCatalogEndpointsTests");
    for (const entry of provenance.runner.exportFiles) {
      const bytes = readFileSync(resolve(directory, entry.path));
      expect(bytes.length, entry.path).toBe(entry.length);
      expect(createHash("sha256").update(bytes).digest("hex"), entry.path).toBe(entry.sha256);
    }
  });

  it("rejects historical detail and save bodies without the now-required filters field", async () => {
    // These immutable pre-K4 exports no longer qualify the current detail/save contract.
    // Positive real HTTP coverage resumes with the producer's K4 cohort at closure.
    const createBody = JSON.parse(createRequestRaw) as ManualCatalogBody;
    const updateBody = JSON.parse(updateRequestRaw) as ManualCatalogBody & { expectedRevision: number };
    const sent: unknown[] = [];
    server.use(http.post("/api/forms/catalogs", async ({ request }) => { sent.push(await request.json()); return json(createdRaw, 201); }), http.put("/api/forms/catalogs/" + id, async ({ request }) => { sent.push(await request.json()); return json(updatedRaw); }), http.get("/api/forms/catalogs/" + id, () => json(detailRaw)));
    expect(JSON.parse(createdRaw).catalog).not.toHaveProperty("filters");
    expect(JSON.parse(updatedRaw).catalog).not.toHaveProperty("filters");
    expect(JSON.parse(detailRaw)).not.toHaveProperty("filters");
    await expect(createManualCatalog(createBody)).rejects.toThrow("Unsupported catalog response.");
    await expect(updateManualCatalog(id, updateBody)).rejects.toThrow("Unsupported catalog response.");
    await expect(fetchCatalog(id)).rejects.toThrow("Unsupported catalog response.");
    expect(sent).toEqual([createBody, updateBody]);
  });
  it("continues to consume the unchanged real item page", async () => {
    server.use(http.get("/api/forms/catalogs/" + id + "/items", () => json(itemsRaw)));
    expect(await fetchCatalogItems(id, { page: 1, pageSize: 20 })).toEqual(JSON.parse(itemsRaw));
  });
  for (const [culture, raw] of [["es", listEsRaw], ["en", listEnRaw]] as const) it("preserves the real localized page 2 and hidden usage count in " + culture, async () => {
    configureHttpClient({ getLanguage: () => culture });
    server.use(http.get("/api/forms/catalogs", ({ request }) => { expect(request.headers.get("accept-language")).toBe(culture); const params = new URL(request.url).searchParams; expect(params.get("page")).toBe("2"); expect(params.get("pageSize")).toBe("1"); expect(params.get("sort")).toBe("name"); return json(raw); }));
    const page = await fetchCatalogPage({ page: 2, pageSize: 1, sort: "name" });
    expect(page).toEqual(JSON.parse(raw));
    expect(page.totalCount).toBe(3);
    expect(page.items[0]!.usageCount).toBeNull();
    expect(page.items[0]!.canEdit).toBe(false);
  });
  for (const [culture, raw] of [["es", conflictEsRaw], ["en", conflictEnRaw]] as const) it("retains real translated 409 details and makes only one write in " + culture, async () => {
    configureHttpClient({ getLanguage: () => culture }); let calls = 0;
    server.use(http.put("/api/forms/catalogs/" + id, ({ request }) => { calls++; expect(request.headers.get("accept-language")).toBe(culture); return json(raw, 409); }));
    const conflictBody = JSON.parse(conflictRequestRaw) as ManualCatalogBody & { expectedRevision: number };
    await expect(updateManualCatalog(id, conflictBody)).rejects.toMatchObject({ status: 409, code: "Forms.Catalog.RevisionConflict", detail: JSON.parse(raw).detail });
    expect(calls).toBe(1);
  });
});
