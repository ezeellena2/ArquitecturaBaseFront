import type { CatalogDetail } from "@/features/business-forms/api/catalogResponse";
import type { CatalogImportMode, CatalogImportPreview } from "@/features/business-forms/api/catalogImports";
import { catalogImportPreviewFixture } from "../catalogImportFixtures";

interface BaseStore { writes: unknown[]; reads: string[]; handle(request: Request): Promise<Response> }
interface ImportSubmission { mode: CatalogImportMode; expectedRevision: number; fileName: string; bytes: number }
export interface CatalogImportVisualStore extends BaseStore { previews: ImportSubmission[]; applies: ImportSubmission[] }

// Explicit simulated transport. No parser, database or actual producer evidence is claimed here.
export function createCatalogImportVisualStore(culture: "es" | "en", catalogId: string,
  createBase: () => BaseStore): CatalogImportVisualStore {
  const base = createBase();
  const previews: ImportSubmission[] = [], applies: ImportSubmission[] = [];
  let applied = false;
  const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
    status, headers: { "content-type": "application/json", "cache-control": "no-store" },
  });
  const preview = (mode: CatalogImportMode): CatalogImportPreview => {
    const original = catalogImportPreviewFixture();
    const issues: CatalogImportPreview["issues"] = Array.from({ length: 24 }, (_, index) => ({
      row: index + 4, column: "code", severity: "Error", code: "Forms.CatalogImport.DuplicateCode",
      message: culture === "es" ? "Repetido: también está en otra fila."
        : "Duplicate: it is also in another row.", relatedRow: 2, length: null,
    }));
    issues.push({ row: 1, column: culture === "es" ? "Responsable" : "Supervisor", severity: "Warning", code: "Forms.CatalogImport.UnknownColumn",
      message: culture === "es" ? "Esta columna no es del catálogo: se ignora." : "This column is not part of the catalog: it is ignored.", relatedRow: null, length: null });
    return { ...original, catalogId, revision: applied ? 2 : 1, mode, sheetName: culture === "es" ? "Clientes" : "Customers", rowsRead: 27,
      counts: { added: 1, changed: 1, deactivated: mode === "Replace" ? 1 : 0, reactivated: 0, unchanged: 1, errorRows: 24, warnings: 1 },
      issues, added: [{ row: 2, code: "N", text: "Norte", value: null }],
      changed: [{ row: 3, itemId: "01990000-0000-7000-8000-000000000081", code: "C1", changes: [{ column: "text", before: "Pérez", after: "Pérez Norte" }] }],
      deactivated: mode === "Replace" ? [{ itemId: "01990000-0000-7000-8000-000000000083", code: "C3", text: "Ríos" }] : [],
      confirmations: { deactivations: mode === "Replace" ? 1 : 0, emptySheet: false, manyErrors: true } };
  };
  return { writes: base.writes, reads: base.reads, previews, applies, async handle(request) {
    const url = new URL(request.url);
    if (url.pathname.endsWith("/import-previews") || url.pathname.endsWith("/imports")) {
      if (request.method !== "POST") return json({ code: "MethodNotAllowed" }, 405);
      const form = await request.formData(); const file = form.get("file"), mode = form.get("mode");
      if (!(file instanceof File) || (mode !== "Replace" && mode !== "Append")) return json({ code: "General.Validation" }, 400);
      const submission: ImportSubmission = { mode, expectedRevision: Number(form.get("expectedRevision")), fileName: file.name, bytes: file.size };
      if (url.pathname.endsWith("/import-previews")) { previews.push(submission); return json(preview(mode)); }
      applies.push(submission); applied = true;
      const current = await base.handle(new Request(url.origin + "/api/forms/catalogs/" + catalogId));
      const catalog = await current.json() as CatalogDetail;
      return json({ catalog: { ...catalog, revision: 2 }, itemIdentityMap: {} });
    }
    if (applied && request.method === "GET" && url.pathname === "/api/forms/catalogs/" + catalogId) {
      const response = await base.handle(request); const catalog = await response.json() as CatalogDetail;
      return json({ ...catalog, revision: 2 });
    }
    return base.handle(request);
  } };
}
