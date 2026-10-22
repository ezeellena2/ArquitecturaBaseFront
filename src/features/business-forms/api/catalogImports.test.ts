import { expect, it, vi } from "vitest";
import { api } from "@/shared/api/httpClient";
import { catalogImportPreviewFixture, importCatalogId as id } from "@/test/catalogImportFixtures";
import { readCatalogImportPreview, previewCatalogImport, applyCatalogImport, exportCatalog } from "./catalogImports";
const preview = catalogImportPreviewFixture();
it("reads the complete strict import preview without keeping zod issues or accepting another revision/mode/catalog", () => {
  expect(readCatalogImportPreview(preview, id, 7, "Replace")).toEqual(preview);
  for (const body of [{ ...preview, extra: "private" }, { ...preview, revision: 6 }, { ...preview, mode: "Append" }, { ...preview, catalogId: "01990000-0000-7000-8000-000000000099" }, { ...preview, alreadyAppliedAtUtc: undefined }, { ...preview, confirmations: { ...preview.confirmations, manyErrors: undefined } }, { ...preview, issues: [{ ...preview.issues[0], length: undefined }] }]) {
    expect(() => readCatalogImportPreview(body, id, 7, "Replace")).toThrow("Unsupported catalog response.");
  }
});
it("requires the normalized nullable value in every added preview row", () => {
  for (const value of [null, "1500.5", "2026-04-03"]) {
    const body = { ...preview, added: [{ ...preview.added[0]!, value }] };
    expect(readCatalogImportPreview(body, id, 7, "Replace")).toEqual(body);
  }
  const { value: _value, ...withoutValue } = { ...preview.added[0]!, value: null };
  expect(() => readCatalogImportPreview({ ...preview, added: [withoutValue] }, id, 7, "Replace")).toThrow("Unsupported catalog response.");
});
it("sends the same file and captured revision as private multipart and keeps apply confirmations exact", async () => {
  const post = vi.spyOn(api, "post").mockResolvedValue(preview);
  const body = { file: new File(["Code,Text"], "pasted.csv"), expectedRevision: 7, mode: "Replace" as const }, signal = new AbortController().signal;
  try {
    expect(await previewCatalogImport(id, body, signal)).toEqual(preview);
    const [path, data, init] = post.mock.calls[0]!;
    expect(path).toBe("/api/forms/catalogs/" + id + "/import-previews");
    expect(init).toEqual({ signal, cache: "no-store" });
    expect(data).toBeInstanceOf(FormData); expect((data as FormData).get("file")).toBe(body.file);
    expect((data as FormData).get("expectedRevision")).toBe("7");
    const catalog = { valueType: "Text", proposal: null, id, key: id.replaceAll("-", ""), name: { es: "Lista", en: "List" }, description: { es: "Prueba", en: "Test" }, kind: "Manual", revision: 8, isActive: true, itemsCount: 1, usageCount: 0, unavailableReasonCode: null, filters: null };
    post.mockResolvedValue({ catalog, itemIdentityMap: {} });
    await applyCatalogImport(id, { ...body, sheetSha256: preview.sheetSha256, confirmDeactivations: 1, confirmEmpty: false, confirmErrors: true }, signal);
    const apply = post.mock.calls[1]!;
    expect(apply[0]).toBe("/api/forms/catalogs/" + id + "/imports");
    expect(Object.fromEntries((apply[1] as FormData).entries())).toMatchObject({ mode: "Replace", expectedRevision: "7", sheetSha256: preview.sheetSha256, confirmDeactivations: "1", confirmEmpty: "false", confirmErrors: "true" });
    post.mockResolvedValue({ catalog, itemIdentityMap: { unexpected: id } });
    await expect(applyCatalogImport(id, { ...body, sheetSha256: preview.sheetSha256, confirmDeactivations: 0, confirmEmpty: false, confirmErrors: true })).rejects.toThrow("Unsupported catalog response.");
  } finally { post.mockRestore(); }
});
it("exports by GET with shared binary download metadata and no private content in the URL", async () => {
  const file = { blob: new Blob(["PK"], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }), fileName: "Catálogo.xlsx", contentLanguage: null };
  const get = vi.spyOn(api, "file").mockResolvedValue(file), signal = new AbortController().signal;
  try { expect(await exportCatalog(id, true, signal)).toBe(file); expect(get).toHaveBeenCalledWith("/api/forms/catalogs/" + id + "/export?template=true", { signal, headers: { accept: file.blob.type } }); } finally { get.mockRestore(); }
});
