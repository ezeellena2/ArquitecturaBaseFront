import { createHash } from "node:crypto";
import { expect, it } from "vitest";
import { http } from "msw";
import { z } from "zod";
import { httpCohort } from "@/test/httpCohort";
import { server } from "@/test/mocks/server";
import { applyCatalogImport, exportCatalog, previewCatalogImport, readCatalogImportPreview, type CatalogImportMode } from "./catalogImports";
import { readCatalogSave } from "./catalogResponse";

// Every response and workbook comes unchanged from the joint backend export.
const cohort = httpCohort("catalogImports");
const cultures = ["es", "en"] as const;
const names = ["replace-preview.json", "append-preview.json", "already-applied.json", "empty-preview.json", "applied.json", "conflict.json", "confirmation-required.json", "round-trip-preview.json", "export.xlsx", "export.http.json", "template.xlsx", "template.http.json"];
const csv = "Code,Text,Active\nA,Uno cambiado,Yes\nNEW,Nueva,Yes\nBAD," + "x".repeat(31) + ",Yes\n";
const sha256 = (bytes: Uint8Array | string) => createHash("sha256").update(bytes).digest("hex");
const capture = (culture: typeof cultures[number], name: string) => culture + "/" + name;
function preview(culture: typeof cultures[number], name: string, revision: number, mode: CatalogImportMode, id?: string) {
  const raw = cohort.json(capture(culture, name));
  const identity = z.object({ catalogId: z.string().uuid() }).parse(raw);
  const result = readCatalogImportPreview(raw, id ?? identity.catalogId, revision, mode);
  expect(result).toEqual(raw);
  return result;
}

it("qualifies the twenty-four intact import captures and their actual producers", () => {
  const provenance = cohort.verify();
  expect(provenance.captures.map(item => item.name).sort()).toEqual(cultures.flatMap(culture => names.map(name => capture(culture, name))).sort());
  for (const source of ["FormCatalogImportHttpTests.cs", "FormCatalogEndpointsTests.cs", "FormCatalogImportContractCapture.cs", "FormCatalogImportModels.cs", "FormCatalogImportTemplate.cs", "Catalogs.resx", "Catalogs.en.resx"]) {
    expect(provenance.sources.some(item => item.path.endsWith("/" + source))).toBe(true);
  }
});

for (const culture of cultures) {
  it("reads the real " + culture + " preview revisions counts issues and workbook round trip", () => {
    const replace = preview(culture, "replace-preview.json", 1, "Replace");
    const id = replace.catalogId;
    expect(replace).toMatchObject({ rowsRead: 3, sheetSha256: sha256(csv), alreadyAppliedAtUtc: null, listsTruncated: false,
      counts: { added: 1, changed: 1, deactivated: 2, reactivated: 0, unchanged: 0, errorRows: 1 },
      confirmations: { deactivations: 2, emptySheet: false, manyErrors: true } });
    expect(replace.issues).toEqual([{ row: 4, column: "text", severity: "Error", code: "Forms.CatalogImport.TextTooLong", message: expect.any(String), relatedRow: null, length: 31 }]);
    expect(replace.issues[0].message.length).toBeGreaterThan(0);
    expect(replace.added).toEqual([{ row: 3, code: "NEW", text: "Nueva" }]);
    expect(replace.changed).toHaveLength(1);
    expect(replace.changed[0]).toMatchObject({ row: 2, code: "A" });
    expect(replace.deactivated.map(item => item.code).sort()).toEqual(["B", "C"]);
    const receipt = readCatalogSave(cohort.json(capture(culture, "applied.json")), [], id, replace.revision);
    expect(receipt.catalog).toMatchObject({ id, revision: 2, kind: "Manual", valueType: "Text", itemsCount: 5 });
    expect(receipt.itemIdentityMap).toEqual({});
    const repeated = preview(culture, "already-applied.json", 2, "Replace", id);
    expect(repeated.sheetSha256).toBe(replace.sheetSha256);
    expect(repeated.alreadyAppliedAtUtc).not.toBeNull();
    const append = preview(culture, "append-preview.json", 2, "Append", id);
    expect(append).toMatchObject({ rowsRead: 2, counts: { added: 1, deactivated: 0, reactivated: 1, errorRows: 0 }, alreadyAppliedAtUtc: null });
    const roundTrip = preview(culture, "round-trip-preview.json", 2, "Replace", id);
    expect(roundTrip.sheetSha256).toBe(sha256(cohort.bytes(capture(culture, "export.xlsx"))));
    expect(roundTrip.counts).toEqual({ added: 0, changed: 0, deactivated: 0, reactivated: 0, unchanged: 5, errorRows: 0, warnings: 0 });
    const empty = preview(culture, "empty-preview.json", 2, "Replace", id);
    expect(empty.sheetSha256).toBe(sha256(cohort.bytes(capture(culture, "template.xlsx"))));
    expect(empty.rowsRead).toBe(0);
    expect(empty.issues).toEqual([]);
    expect(empty.confirmations.emptySheet).toBe(true);
  });

  it("passes unchanged " + culture + " preview apply and rejection bodies through the multipart clients", async () => {
    const plan = preview(culture, "replace-preview.json", 1, "Replace");
    const id = plan.catalogId;
    const route = "/api/forms/catalogs/" + id;
    const requests: Record<string, string>[] = [];
    const record = async (request: Request) => {
      expect(request.cache).toBe("no-store");
      expect(request.headers.get("content-type")).toMatch(/^multipart\/form-data; boundary=/);
      const data = await request.formData();
      const uploaded = data.get("file");
      expect(uploaded).not.toBeNull();
      if (uploaded === null || typeof uploaded === "string") throw new Error("Expected the original import file.");
      expect(uploaded.name).toBe("catalog.csv");
      expect(await uploaded.text()).toBe(csv);
      requests.push(Object.fromEntries([...data.entries()].filter((entry): entry is [string, string] => typeof entry[1] === "string")));
    };
    server.use(http.post(route + "/import-previews", async ({ request }) => {
      await record(request);
      return cohort.response(capture(culture, "replace-preview.json"));
    }), http.post(route + "/imports", async ({ request }) => {
      await record(request);
      return cohort.response(capture(culture, "applied.json"));
    }));
    const body = { file: new File([csv], "catalog.csv", { type: "text/csv" }), mode: "Replace" as const, expectedRevision: 1 };
    expect(await previewCatalogImport(id, body)).toEqual(plan);
    const apply = { ...body, sheetSha256: plan.sheetSha256, confirmDeactivations: 2, confirmEmpty: false, confirmErrors: true };
    expect(await applyCatalogImport(id, apply)).toEqual(readCatalogSave(cohort.json(capture(culture, "applied.json")), [], id, 1));
    expect(requests).toEqual([{ mode: "Replace", expectedRevision: "1" }, { mode: "Replace", expectedRevision: "1", sheetSha256: plan.sheetSha256, confirmDeactivations: "2", confirmEmpty: "false", confirmErrors: "true" }]);
    for (const [name, status, code] of [["confirmation-required.json", 400, "Forms.CatalogImport.ConfirmationRequired"], ["conflict.json", 409, "Forms.Catalog.RevisionConflict"]] as const) {
      server.use(http.post(route + "/imports", () => cohort.response(capture(culture, name), status, { "content-type": "application/problem+json" })));
      await expect(applyCatalogImport(id, apply)).rejects.toMatchObject({ status, code, problem: cohort.json(capture(culture, name)) });
    }
  });

  it("downloads the actual " + culture + " export and template bytes with their captured HTTP metadata", async () => {
    const plan = preview(culture, "replace-preview.json", 1, "Replace");
    const requests: string[] = [];
    server.use(http.get("/api/forms/catalogs/" + plan.catalogId + "/export", ({ request }) => {
      expect(request.cache).toBe("no-store");
      expect(request.headers.get("accept")).toBe("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
      const query = new URL(request.url).search;
      requests.push(query);
      const name = query === "?template=true" ? "template" : "export";
      return cohort.capturedResponse(capture(culture, name + ".xlsx"), capture(culture, name + ".http.json"));
    }));
    for (const template of [false, true]) {
      const name = template ? "template" : "export";
      const file = await exportCatalog(plan.catalogId, template);
      const raw = cohort.bytes(capture(culture, name + ".xlsx"));
      const metadata = cohort.capturedResponse(capture(culture, name + ".xlsx"), capture(culture, name + ".http.json"));
      expect(metadata.status).toBe(200);
      expect(file.blob.type).toBe("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
      expect(file.contentLanguage).toBe(metadata.headers.get("content-language"));
      expect(file.fileName).toMatch(/\.xlsx$/);
      expect(metadata.headers.get("content-disposition")).toContain("attachment");
      expect(file.blob.size).toBe(raw.length);
      expect(sha256(new Uint8Array(await file.blob.arrayBuffer()))).toBe(sha256(raw));
    }
    expect(requests).toEqual(["?template=false", "?template=true"]);
  });
}
