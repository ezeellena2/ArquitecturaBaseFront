import { createHash } from "node:crypto";
import { expect, it, vi } from "vitest";
import { http } from "msw";
import { z } from "zod";
import { httpCohort } from "@/test/httpCohort";
import { server } from "@/test/mocks/server";
import { applyCatalogImport, exportCatalog, previewCatalogImport, readCatalogImportPreview, type CatalogImportMode } from "./catalogImports";
import { readCatalogSave } from "./catalogResponse";

// Every response and workbook comes unchanged from the joint backend export.
const cohort = httpCohort("catalogImports");
const cultures = ["es", "en"] as const;
const names = ["replace-preview.json", "append-preview.json", "already-applied.json", "empty-preview.json", "applied.json", "conflict.json", "confirmation-required.json", "round-trip-preview.json", "export.xlsx", "export.http.json", "template.xlsx", "template.http.json", "extra-source-preview.json", "extra-source-applied.json", "extra-source-unchanged.json"];
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

// With the menu in Spanish, the preview and the export of a catalog whose original is English.
const englishOriginal = ["es/en-original-preview.json", "es/en-original-export.xlsx", "es/en-original-export.http.json"];

it("qualifies the 33 intact import captures and their actual producers", () => {
  const provenance = cohort.verify();
  expect(provenance.captures).toHaveLength(33);
  expect(provenance.captures.map(item => item.name).sort()).toEqual([...cultures.flatMap(culture => names.map(name => capture(culture, name))), ...englishOriginal].sort());
  for (const source of ["FormCatalogImportHttpTests.cs", "FormCatalogImportFieldsHttpTests.cs", "FormCatalogEndpointsTests.cs", "FormCatalogImportContractCapture.cs", "FormCatalogImportModels.cs", "FormCatalogImportTemplate.cs", "Catalogs.resx", "Catalogs.en.resx"]) {
    expect(provenance.sources.some(item => item.path.endsWith("/" + source))).toBe(true);
  }
});

it("reads the Spanish translation column of an English original catalog and downloads its export", async () => {
  // The producer created the catalog in English and previewed «Código,Texto,Texto en español» with the menu in Spanish.
  const plan = preview("es", "en-original-preview.json", 1, "Append");
  expect(plan).toMatchObject({ rowsRead: 3, issues: [], counts: { added: 1, changed: 2, deactivated: 0, errorRows: 0 } });
  expect(plan.added).toEqual([{ row: 4, code: "W", text: "Oeste", value: null }]);
  expect(plan.changed.map(item => [item.code, item.changes])).toEqual([
    ["N", [{ column: "textEs", before: "Norte", after: "Norte cambiado" }]],
    ["E", [{ column: "textEs", before: null, after: "Este" }]],
  ]);
  server.use(http.get("/api/forms/catalogs/" + plan.catalogId + "/export", () =>
    cohort.capturedResponse("es/en-original-export.xlsx", "es/en-original-export.http.json")));
  const file = await exportCatalog(plan.catalogId, false);
  const raw = cohort.bytes("es/en-original-export.xlsx");
  expect(file.contentLanguage).toBe("es");
  expect(file.fileName).toMatch(/\.xlsx$/);
  expect(file.blob.size).toBe(raw.length);
  expect(sha256(new Uint8Array(await file.blob.arrayBuffer()))).toBe(sha256(raw));
});

for (const culture of cultures) {
  it("reads the real " + culture + " source field labels and an import receipt with no revision change", () => {
    const plan = preview(culture, "extra-source-preview.json", 2, "Append");
    expect(plan.issues).toEqual([]);
    const added = plan.added[0]!;
    const change = plan.changed[0]!.changes[0]!;
    const fieldId = change.column;
    expect(added.fields?.[fieldId]).toBe(change.before);
    expect(added.fieldTexts?.[fieldId]).toBe(culture === "en" ? "Central" : "Centro");
    expect(change.beforeText).toBe(added.fieldTexts?.[fieldId]);
    expect(change.afterText).toBe("Sur");
    const applied = readCatalogSave(cohort.json(capture(culture, "extra-source-applied.json")), [], plan.catalogId, 2);
    expect(applied.catalog.revision).toBe(3);
    expect(applied.fieldIdentityMap).toEqual({});
    const unchanged = readCatalogSave(cohort.json(capture(culture, "extra-source-unchanged.json")), [], plan.catalogId);
    expect(unchanged.catalog.revision).toBe(applied.catalog.revision);
  });
  it("reads the real " + culture + " preview revisions counts issues and workbook round trip", () => {
    const replace = preview(culture, "replace-preview.json", 1, "Replace");
    const id = replace.catalogId;
    expect(replace).toMatchObject({ rowsRead: 3, sheetSha256: sha256(csv), alreadyAppliedAtUtc: null, listsTruncated: false,
      counts: { added: 1, changed: 1, deactivated: 2, reactivated: 0, unchanged: 0, errorRows: 1 },
      confirmations: { deactivations: 2, emptySheet: false, manyErrors: true } });
    expect(replace.issues).toEqual([{ row: 4, column: "text", severity: "Error", code: "Forms.CatalogImport.TextTooLong", message: expect.any(String), relatedRow: null, length: 31 }]);
    expect(replace.issues[0].message.length).toBeGreaterThan(0);
    expect(replace.added).toEqual([{ row: 3, code: "NEW", text: "Nueva", value: null }]);
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
    const body = { file: new File([csv], "catalog.csv", { type: "text/csv" }), mode: "Replace" as const, expectedRevision: 1 };
    const captures = [["replace-preview.json", 200], ["applied.json", 200], ["confirmation-required.json", 400], ["conflict.json", 409]] as const;
    // jsdom FormData stays at the fetch boundary, as in the shared HTTP client tests.
    const fetch = vi.spyOn(globalThis, "fetch").mockImplementation(async (path, init) => {
      const index = requests.length;
      const captured = captures[index];
      if (!captured) throw new Error("Unexpected import request.");
      expect(path).toBe(route + (index === 0 ? "/import-previews" : "/imports"));
      expect(init?.method).toBe("POST");
      expect(init?.cache).toBe("no-store");
      expect(new Headers(init?.headers).get("content-type")).toBeNull();
      const data = init?.body;
      if (!(data instanceof FormData)) throw new Error("Expected the original import form.");
      expect(data.get("file")).toBe(body.file);
      expect(body.file.name).toBe("catalog.csv");
      requests.push(Object.fromEntries([...data.entries()].filter((entry): entry is [string, string] => typeof entry[1] === "string")));
      return cohort.response(capture(culture, captured[0]), captured[1], {
        "content-type": captured[1] === 200 ? "application/json" : "application/problem+json",
      });
    });
    try {
      expect(await previewCatalogImport(id, body)).toEqual(plan);
      const apply = { ...body, sheetSha256: plan.sheetSha256, confirmDeactivations: 2, confirmEmpty: false, confirmErrors: true };
      expect(await applyCatalogImport(id, apply)).toEqual(readCatalogSave(cohort.json(capture(culture, "applied.json")), [], id, 1));
      expect(requests).toEqual([{ mode: "Replace", expectedRevision: "1" }, { mode: "Replace", expectedRevision: "1", sheetSha256: plan.sheetSha256, confirmDeactivations: "2", confirmEmpty: "false", confirmErrors: "true" }]);
      for (const [name, status, code] of [["confirmation-required.json", 400, "Forms.CatalogImport.ConfirmationRequired"], ["conflict.json", 409, "Forms.Catalog.RevisionConflict"]] as const) {
        await expect(applyCatalogImport(id, apply)).rejects.toMatchObject({ status, code, problem: cohort.json(capture(culture, name)) });
      }
      expect(requests).toHaveLength(4);
      expect(requests.slice(2)).toEqual([requests[1], requests[1]]);
    } finally { fetch.mockRestore(); }
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
