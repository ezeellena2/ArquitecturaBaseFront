import type { CatalogDetail, CatalogField, CatalogItem } from "@/features/business-forms/api/catalogResponse";

const guid = (number: number) => "01990000-0000-7000-8000-" + String(number).padStart(12, "0");
export const catalogExtraFieldFixtureIds = { catalog: guid(701), source: guid(702), cuit: guid(711), zone: guid(712), days: guid(713), gps: guid(714), form: guid(741), question: guid(742) };

// Explicit CE1/CE2 synthetic transport. Database writes and the HTTP contract have separate real producers.
export function createCatalogExtraFieldsFixtures(language: "es" | "en", scenario = "catalogs-extra-fields") {
  const ids = catalogExtraFieldFixtureIds;
  const calls: { method: string; path: string }[] = [], writes: { method: string; path: string }[] = [];
  // CE1 «En uso»: Zona filters one question in the active version and the draft of a form, the payment term is used only
  // by its active version, and the catalog's own «En WhatsApp» shows the CUIT. Naming forms needs formtemplates.read.
  const inUse = scenario === "catalogs-extra-fields-in-use";
  const question = { definitionId: ids.form, formName: language === "es" ? "Pedir repuesto" : "Request a spare part", question: language === "es" ? "Proveedores a consultar" : "Suppliers to ask", questionId: ids.question };
  const usedBy: Readonly<Record<string, CatalogField["usedBy"]>> = inUse ? { [ids.zone]: [{ ...question, stage: "Active" }, { ...question, stage: "Draft" }], [ids.days]: [{ ...question, stage: "Active" }], [ids.cuit]: [{ definitionId: null, formName: language === "es" ? "Proveedores" : "Suppliers", question: null, questionId: null, stage: "Catalog" }] } : {};
  const field = (id: string, key: string, es: string, en: string, type: CatalogField["type"], position: number): CatalogField => ({ id, key, name: { es, en }, type, sourceCatalogId: type === "catalog" ? ids.source : null, required: false, unique: false, min: null, max: null, maxLength: type === "text" ? 300 : null, role: "data", position, isActive: true, hasValues: true, usedBy: usedBy[id] ?? [] });
  const fields: CatalogField[] = [{ ...field(ids.cuit, "cuit", "CUIT", "CUIT", "text", 1), required: true, unique: true, maxLength: 13 }, { ...field(ids.zone, "zone", "Zona", "Zone", "catalog", 2), required: true, role: "filter" }, { ...field(ids.days, "days", "Plazo de pago (días)", "Payment term (days)", "integer", 3), min: "0", max: "180" }, field(ids.gps, "gps", "Usa GPS", "Uses GPS", "boolean", 4)];
  const base = (id: string, es: string, en: string): CatalogDetail => ({ id, key: id.replaceAll("-", ""), name: { es, en }, description: { es: "Lista para pedir repuestos", en: "Parts suppliers" }, kind: "Manual", valueType: "Text", revision: 3, isActive: true, itemsCount: 3, usageCount: 1, unavailableReasonCode: null, filters: null, proposal: null, fields: [], presentation: null, presentationCheck: { cultures: [{ culture: "es", titleTooLongCount: 0, titleExamples: [], descriptionTooLongCount: 0, descriptionExamples: [] }, { culture: "en", titleTooLongCount: 0, titleExamples: [], descriptionTooLongCount: 0, descriptionExamples: [] }] } });
  const names = ["Frío Sur S.A.", "Repuestos Norte", "Electro Centro", "Aislaciones del Plata", "Refrigeración Oeste", "Compresores Unidos"];
  const zones: CatalogItem[] = ["Centro", "Norte", "Oeste"].map((name, index) => ({ id: guid(731 + index), code: "ZONE-" + (index + 1), text: { es: name, en: ["Central", "North", "West"][index]! }, detail: { es: null, en: null }, value: null, position: index + 1, isActive: true, fields: {}, fieldTexts: {} }));
  const items: CatalogItem[] = names.map((name, index) => ({ id: guid(721 + index), code: "PRV-" + String(index + 1).padStart(4, "0"), text: { es: name, en: name }, detail: { es: "Provisión de repuestos", en: "Parts supplier" }, value: null, position: index + 1, isActive: true, fields: { [ids.cuit]: "30-" + String(71234567 + index) + "-8", [ids.zone]: zones[index % 3]!.id, [ids.days]: String(index === 1 ? 15 : 30), [ids.gps]: index % 2 ? "false" : "true" }, fieldTexts: { [ids.zone]: { es: zones[index % 3]!.text.es!, en: zones[index % 3]!.text.en! } } }));
  const catalog = { ...base(ids.catalog, "Proveedores", "Suppliers"), fields, itemsCount: items.length, presentation: inUse ? { title: ["text"], description: ["detail", ids.cuit] } : null };
  const source = base(ids.source, "Zonas", "Zones");
  const page = <T,>(rows: readonly T[], query: URLSearchParams) => { const number = Number(query.get("page") ?? 1), size = Number(query.get("pageSize") ?? 20), pages = Math.ceil(rows.length / size); return { items: rows.slice((number - 1) * size, number * size), page: number, pageSize: size, totalCount: rows.length, totalPages: pages, hasPrevious: number > 1, hasNext: number < pages }; };
  return { calls, writes, permissions: inUse ? ["formcatalogs.read", "formcatalogs.manage", "formtemplates.read"] : undefined, async handle(request: Request): Promise<Response | null> {
    const url = new URL(request.url), path = url.pathname;
    if (!path.startsWith("/api/forms/catalogs")) return null;
    calls.push({ method: request.method, path });
    if (request.method !== "GET") { writes.push({ method: request.method, path }); return Response.json({ code: "Test.SyntheticReadOnly" }, { status: 405 }); }
    const search = (url.searchParams.get("search") ?? "").toLocaleLowerCase(language);
    if (path === "/api/forms/catalogs") {
      const rows = [catalog, source].map(value => ({ id: value.id, name: value.name[language]!, description: value.description[language]!, origin: "Manual", valueType: "Text", optionsCount: value.itemsCount, usageCount: value.usageCount, state: "Active", stateReason: null, canEdit: true })).filter(value => value.name.toLocaleLowerCase(language).includes(search));
      return Response.json({ ...page(rows, url.searchParams), filterCounts: { byKind: { all: rows.length, manual: rows.length, filters: 0 } } });
    }
    if (path === `/api/forms/catalogs/${ids.catalog}`) return Response.json(catalog);
    if (path === `/api/forms/catalogs/${ids.source}`) return Response.json(source);
    if (path.endsWith("/items")) {
      const rows = path.includes(ids.source) ? zones : items;
      return Response.json(page(rows.filter(value => (value.text[language] ?? value.text.es ?? "").toLocaleLowerCase(language).includes(search)), url.searchParams));
    }
    return Response.json({ code: "Test.SyntheticRouteNotFound" }, { status: 404 });
  } };
}
