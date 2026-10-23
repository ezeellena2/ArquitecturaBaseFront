import { z } from "zod";
import { api, type ApiFile } from "@/shared/api/httpClient";
import { catalogId, readCatalogSave, UnsupportedCatalogResponse } from "./catalogResponse";

export type CatalogImportMode = "Replace" | "Append";
const count = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER);
const guid = z.string().uuid();
const previewSchema = z.strictObject({
  catalogId: guid, revision: z.number().int().positive().max(Number.MAX_SAFE_INTEGER), mode: z.enum(["Replace", "Append"]),
  sheetSha256: z.string().regex(/^[a-fA-F0-9]{64}$/), sheetName: z.string(), rowsRead: count,
  counts: z.strictObject({ added: count, changed: count, deactivated: count, reactivated: count, unchanged: count, errorRows: count, warnings: count }),
  issues: z.array(z.strictObject({ row: count, column: z.string(), severity: z.enum(["Error", "Warning"]), code: z.string(), message: z.string(), relatedRow: count.nullable(), length: count.nullable() })),
  added: z.array(z.strictObject({ row: count, code: z.string(), text: z.string(), value: z.string().nullable(), fields: z.record(guid, z.string().max(300).nullable()).optional(), fieldTexts: z.record(guid, z.string().max(200)).optional() })).max(100),
  changed: z.array(z.strictObject({ row: count, itemId: guid, code: z.string(), changes: z.array(z.strictObject({ column: z.string(), before: z.string().nullable(), after: z.string().nullable(), beforeText: z.string().max(200).optional(), afterText: z.string().max(200).optional() })) })).max(100),
  deactivated: z.array(z.strictObject({ itemId: guid, code: z.string(), text: z.string() })).max(100),
  listsTruncated: z.boolean(), confirmations: z.strictObject({ deactivations: count, emptySheet: z.boolean(), manyErrors: z.boolean() }),
  alreadyAppliedAtUtc: z.iso.datetime().nullable(),
});
export type CatalogImportPreview = z.infer<typeof previewSchema>;
export interface CatalogImportFile { file: File; mode: CatalogImportMode; expectedRevision: number }
export interface CatalogImportApply extends CatalogImportFile { sheetSha256: string; confirmDeactivations: number; confirmEmpty: boolean; confirmErrors: boolean }
export function readCatalogImportPreview(value: unknown, id: string, revision: number, mode: CatalogImportMode): CatalogImportPreview {
  const parsed = previewSchema.safeParse(value);
  if (!parsed.success || parsed.data.catalogId.toLowerCase() !== id.toLowerCase() || parsed.data.revision !== revision || parsed.data.mode !== mode) throw new UnsupportedCatalogResponse();
  return parsed.data;
}
function formData(body: CatalogImportFile | CatalogImportApply): FormData {
  const data = new FormData(); data.append("file", body.file); data.append("mode", body.mode); data.append("expectedRevision", String(body.expectedRevision));
  if ("sheetSha256" in body) { data.append("sheetSha256", body.sheetSha256); data.append("confirmDeactivations", String(body.confirmDeactivations)); data.append("confirmEmpty", String(body.confirmEmpty)); data.append("confirmErrors", String(body.confirmErrors)); }
  return data;
}
export async function previewCatalogImport(id: string, body: CatalogImportFile, signal?: AbortSignal) {
  return readCatalogImportPreview(await api.post<unknown>("/api/forms/catalogs/" + catalogId(id) + "/import-previews", formData(body), { signal, cache: "no-store" }), id, body.expectedRevision, body.mode);
}
export async function applyCatalogImport(id: string, body: CatalogImportApply, signal?: AbortSignal) {
  const saved = readCatalogSave(await api.post<unknown>("/api/forms/catalogs/" + catalogId(id) + "/imports", formData(body), { signal, cache: "no-store" }), [], id);
  if (saved.catalog.revision < body.expectedRevision) throw new UnsupportedCatalogResponse();
  return saved;
}
export async function exportCatalog(id: string, template: boolean, signal?: AbortSignal): Promise<ApiFile> {
  const file = await api.file("/api/forms/catalogs/" + catalogId(id) + "/export?template=" + template, { signal, headers: { accept: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" } });
  if (file.blob.type.split(";")[0] !== "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" || file.blob.size === 0) throw new UnsupportedCatalogResponse();
  return file;
}
