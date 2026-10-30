import type { FormEntry, FormEntryOption } from "@/features/business-forms/api/entries";
import type { FormOverview, FormOverviewRow } from "@/features/business-forms/api/overview";
import { responseFormId } from "../responseFixtures";

const id = (value: number) => "0199a0c0-0000-7000-8000-" + String(value).padStart(12, "0");
export const formEntryFixtureIds = { sowing: id(601), sheet: responseFormId };

/**
 * Explicit synthetic doubles for loading from the app: «Siembra» (CW2-A to CW5), the sheet's form next to the panel (CW2-B)
 * and MF1 with «Cargar» (CW1-B). The bodies exported by the backend qualify the HTTP contract separately.
 */
export function createFormEntryVisualFixtures(language: "es" | "en", scenario: string) {
  const en = language === "en";
  const fields = { lot: id(611), crop: id(612), seed: id(613), density: id(614), hectares: id(615), date: id(616), notes: id(617), photos: id(618), amount: id(619), detail: id(620), confirmed: id(621) };
  const lots: FormEntryOption[] = Array.from({ length: 58 }, (_, index) => ({ id: id(700 + index), title: (en ? "Lot " : "Lote ") + (index + 1),
    description: ["La Esperanza", "El Ombú", "Don Pedro", "La Unión"][index % 4] }));
  const seeds: FormEntryOption[] = ["DM 46i20", "NS 4955", "SY 3x5", "DK 72-10"].map((title, index) => ({ id: id(780 + index), title, description: null }));
  const missingData = scenario === "entries-missing-data";
  const sowing: FormEntry = { definitionId: formEntryFixtureIds.sowing, versionId: id(602), versionNumber: 3, prefix: "SIE", name: en ? "Sowing" : "Siembra", culture: language,
    submitLabel: en ? "Send" : "Enviar", maxFileSizeMiB: 25, questions: [
      { fieldId: fields.lot, type: "choice", label: en ? "Lot" : "Lote", help: en ? "Only the lots of your field in the 2026/27 season." : "Solo los lotes de tu campo en la campaña 2026/27.",
        required: true, maxLength: null, options: null, selection: null, files: null,
        catalog: missingData ? { onlyOption: null, issue: "Forms.Record.RecipientDataMissing", missingData: en ? "Field" : "Campo" } : { onlyOption: null, issue: null, missingData: null } },
      { fieldId: fields.crop, type: "choice", label: en ? "Crop" : "Cultivo", help: null, required: true, maxLength: null,
        options: (en ? ["1st soybean", "2nd soybean", "Corn", "Wheat", "Sunflower"] : ["Soja 1ª", "Soja 2ª", "Maíz", "Trigo", "Girasol"]).map((label, index) => ({ id: id(790 + index), label })),
        selection: null, files: null, catalog: null },
      { fieldId: fields.seed, type: "choice", label: en ? "Seed" : "Semilla", help: null, required: true, maxLength: null, options: null, selection: null, files: null,
        catalog: { onlyOption: null, issue: null, missingData: null } },
      { fieldId: fields.density, type: "decimal", label: en ? "Density (kg/ha)" : "Densidad (kg/ha)", help: null, required: true, maxLength: null, options: null, selection: null, files: null, catalog: null },
      { fieldId: fields.hectares, type: "decimal", label: en ? "Sown hectares (ha)" : "Hectáreas sembradas (ha)", help: null, required: true, maxLength: null, options: null, selection: null, files: null, catalog: null },
      { fieldId: fields.date, type: "date", label: en ? "Sowing date" : "Fecha de siembra", help: null, required: true, maxLength: null, options: null, selection: null, files: null, catalog: null },
      { fieldId: fields.notes, type: "longText", label: en ? "Notes" : "Observaciones", help: null, required: false, maxLength: 500, options: null, selection: null, files: null, catalog: null },
      { fieldId: fields.photos, type: "photo", label: en ? "Lot photos" : "Fotos del lote", help: null, required: false, maxLength: null, options: null, selection: null,
        files: { minFiles: 0, maxFiles: 3, photoSource: "cameraOrGallery" }, catalog: null },
    ] };
  const sheetEntry: FormEntry = { definitionId: formEntryFixtureIds.sheet, versionId: id(603), versionNumber: 2, prefix: "TEST", name: en ? "Delivery report" : "Informe de entregas", culture: language,
    submitLabel: en ? "Send" : "Enviar", maxFileSizeMiB: 25, questions: [
      { fieldId: fields.amount, type: "decimal", label: en ? "Amount" : "Importe", help: null, required: true, maxLength: null, options: null, selection: null, files: null, catalog: null },
      { fieldId: fields.notes, type: "longText", label: en ? "Notes" : "Observaciones", help: null, required: false, maxLength: 500, options: null, selection: null, files: null, catalog: null },
      { fieldId: fields.confirmed, type: "boolean", label: en ? "Confirmed" : "Confirmado", help: null, required: false, maxLength: null, options: null, selection: null, files: null, catalog: null },
      { fieldId: fields.detail, type: "shortText", label: en ? "Optional detail" : "Detalle opcional", help: null, required: false, maxLength: 120, options: null, selection: null, files: null, catalog: null },
    ] };
  const entries = new Map([[sowing.definitionId, sowing], [sheetEntry.definitionId, sheetEntry]]);
  const createOnly = scenario === "entries-create-only";
  const names = en ? ["Sowing", "Rain", "Application", "Harvest", "Previous survey"] : ["Siembra", "Lluvia", "Aplicación", "Cosecha", "Relevamiento anterior"];
  const rows: FormOverviewRow[] = names.map((name, index) => ({ id: index === 0 ? sowing.definitionId : id(640 + index), name, prefix: ["SIE", "LLU", "APL", "COS", "REL"][index],
    deactivatedAtUtc: index === 4 ? "2026-10-20T15:00:00Z" : null, pendingApprovalCount: null,
    responseCount: createOnly ? null : [12, 321, 125, 0, 4][index],
    lastResponse: createOnly || index === 3 ? null : { id: id(660 + index), number: ["SIE", "LLU", "APL", "COS", "REL"][index] + "-" + String([12, 321, 125, 0, 4][index]).padStart(6, "0"),
      submittedAtUtc: "2026-10-" + String(29 - index).padStart(2, "0") + "T13:52:00Z", state: "Received" } }));
  const calls: { method: string; path: string }[] = [];
  return {
    permissions: scenario.startsWith("entries") ? createOnly ? ["formrecords.create"] : ["formrecords.read", "formrecords.create"] : undefined,
    calls,
    async handle(request: Request): Promise<Response | null> {
      const url = new URL(request.url);
      calls.push({ method: request.method, path: url.pathname });
      if (url.pathname === "/api/forms/overview" && scenario.startsWith("entries")) {
        const state = url.searchParams.get("state") ?? "Active";
        const selected = rows.filter(row => createOnly ? row.deactivatedAtUtc === null : (state === "Deactivated") === (row.deactivatedAtUtc !== null));
        const body: FormOverview = { forms: { items: selected, page: 1, pageSize: 20, totalCount: selected.length, totalPages: 1, hasPrevious: false, hasNext: false },
          filterCounts: { active: rows.filter(row => row.deactivatedAtUtc === null).length, deactivated: createOnly ? 0 : 1, deactivatedPending: null } };
        return Response.json(body);
      }
      const match = /^\/api\/forms\/entries\/([^/]+)(?:\/versions\/[^/]+\/questions\/([^/]+)\/options)?$/.exec(url.pathname);
      if (!match) return null;
      const entry = entries.get(match[1]);
      if (!entry) return Response.json({ code: "Forms.Definition.NotFound" }, { status: 404 });
      if (match[2]) {
        const source = match[2] === fields.seed ? seeds : lots;
        const search = (url.searchParams.get("search") ?? "").toLocaleLowerCase(language);
        const matching = source.filter(option => (option.title + " " + (option.description ?? "")).toLocaleLowerCase(language).includes(search));
        const page = Number(url.searchParams.get("page") ?? 1);
        const items = matching.slice((page - 1) * 50, page * 50);
        return Response.json({ items, page, pageSize: 50, totalCount: matching.length, totalPages: Math.ceil(matching.length / 50), hasPrevious: page > 1, hasNext: page * 50 < matching.length });
      }
      // The send goes by XMLHttpRequest, outside this fetch double: each scene answers it with its own route.
      return request.method === "GET" ? Response.json(entry) : Response.json({ code: "Test.UnexpectedFetch" }, { status: 405 });
    },
  };
}
