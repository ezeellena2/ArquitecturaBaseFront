import type { CatalogDetail, CatalogField, CatalogItem } from "@/features/business-forms/api/catalogResponse";
import type { PersonAttribute } from "@/features/business-forms/api/personData";
import type { RecipientMaximum, RecipientPreview, RecipientPreviewBody } from "@/features/business-forms/api/recipientPreview";
import type { FormCulture, FormDefinitionSnapshot, FormQuestionSource } from "@/features/business-forms/model";
import { createFormFixtureStore, fixtureFormId } from "./formFixtures";

const id = (value: number) => "01990000-0000-7000-8000-" + String(value).padStart(12, "0");
export const catalogQuestionFixtureIds = { suppliers: id(700), zones: id(701), question: id(703), tax: id(720), zone: id(721), category: id(722), paymentDays: id(723), attribute: id(730), center: id(740), south: id(741), juan: id(750), pablo: id(751) };

// Synthetic browser transport for CE3-B/CE4-A. No captured HTTP body, API or provider is contacted.
export function createCatalogQuestionVisualFixtures(culture: FormCulture, _scenario: string) {
  const ids = catalogQuestionFixtureIds;
  const forms = createFormFixtureStore(culture, "forms-catalog");
  const original = forms.definitions.get(fixtureFormId)!;
  const definition: FormDefinitionSnapshot = { ...original, name: { es: "Pedir repuesto", en: "Request a spare part" }, prefix: "PDR", draft: { ...original.draft, fields: [
    { fieldId: id(702), key: "field_" + id(702).replaceAll("-", ""), type: "shortText", label: { es: "Sucursal", en: "Branch" }, help: null, required: true, maxLength: 80 },
    { fieldId: id(704), key: "field_" + id(704).replaceAll("-", ""), type: "shortText", label: { es: "Repuesto", en: "Spare part" }, help: null, required: true, maxLength: 80 },
    { fieldId: ids.question, key: "field_" + ids.question.replaceAll("-", ""), type: "multiChoice", label: { es: "Proveedores a consultar", en: "Suppliers to contact" }, help: null, required: true,
      source: { catalog: ids.suppliers, match: [{ fieldId: ids.zone, personAttributeId: ids.attribute }] }, selection: { minSelected: 1, maxSelected: 3 } },
  ] } };
  forms.definitions.set(definition.id, definition);
  const names = (es: string, en: string) => culture === "es" ? es : en;
  const field = (fieldId: string, key: string, es: string, en: string, position: number, type: CatalogField["type"], role: CatalogField["role"]): CatalogField => ({ id: fieldId, key, name: { es, en }, position, type, role, sourceCatalogId: type === "catalog" ? ids.zones : null, required: false, unique: false, min: null, max: null, maxLength: type === "text" ? 80 : null, isActive: true, valuesCount: 16, usedBy: [] });
  const fields: CatalogField[] = [field(ids.tax, "tax_id", "CUIT", "CUIT", 1, "text", "data"), field(ids.zone, "zone", "Zona", "Zone", 2, "catalog", "filter"), field(ids.category, "category", "Rubro", "Category", 3, "text", "filter"), field(ids.paymentDays, "payment_days", "Plazo de pago (días)", "Payment term (days)", 4, "integer", "data")];
  const catalog: CatalogDetail = { id: ids.suppliers, key: ids.suppliers.replaceAll("-", ""), name: { es: "Proveedores", en: "Suppliers" }, description: { es: "Proveedores por zona", en: "Suppliers by zone" }, kind: "Manual", valueType: "Text", revision: 1, isActive: true, itemsCount: 16, usageCount: 1, unavailableReasonCode: null, filters: null, proposal: null, fields, presentation: { title: ["text"], description: [ids.tax, ids.zone] }, presentationCheck: { cultures: [{ culture: "es", titleTooLongCount: 0, titleExamples: [], descriptionTooLongCount: 0, descriptionExamples: [] }, { culture: "en", titleTooLongCount: 0, titleExamples: [], descriptionTooLongCount: 0, descriptionExamples: [] }] } };
  const items: CatalogItem[] = Array.from({ length: 16 }, (_, index) => ({ id: id(800 + index), code: "PRV-" + String(index + 1).padStart(4, "0"), text: { es: ["Frío Sur S.A.", "Electro Centro", "Compresores Unidos", "Servicios Técnicos Centro"][index] ?? "Proveedor " + (index + 1), en: ["South Cooling Ltd.", "Central Electric", "United Compressors", "Central Technical Services"][index] ?? "Supplier " + (index + 1) }, detail: { es: "Servicio técnico", en: "Technical service" }, value: null, position: index + 1, isActive: true,
    fields: { [ids.tax]: "30-" + String(71234567 + index) + "-8", [ids.zone]: index < 14 ? ids.center : ids.south, [ids.category]: index % 2 === 0 ? "Frío" : "Electricidad", [ids.paymentDays]: index % 2 === 0 ? "30" : "15" }, fieldTexts: { [ids.zone]: { es: index < 14 ? "Centro" : "Sur", en: index < 14 ? "Center" : "South" } } }));
  const attribute: PersonAttribute = { id: ids.attribute, key: "zone", name: { es: "Zona", en: "Zone" }, type: "Catalog", sourceCatalogId: ids.zones, sourceCatalogName: names("Zonas", "Zones"), position: 0, isActive: true, revision: 1, usedBy: [{ definitionId: definition.id, name: names("Pedir repuesto", "Request a spare part") }] };
  const samples = [{ id: ids.juan, name: names("Juan Gómez · Centro", "Juan Gómez · Center") }, { id: ids.pablo, name: names("Pablo Sosa · sin zona", "Pablo Sosa · no zone") }];
  const calls: { method: string; path: string }[] = [];
  const previews: RecipientPreviewBody[] = [];
  const json = (value: unknown) => new Response(JSON.stringify(value), { headers: { "Content-Type": "application/json" } });
  const page = <T,>(rows: readonly T[], params: URLSearchParams) => {
    const page = Number(params.get("page") ?? 1), pageSize = Number(params.get("pageSize") ?? 20), totalPages = Math.ceil(rows.length / pageSize);
    return { items: rows.slice((page - 1) * pageSize, page * pageSize), page, pageSize, totalCount: rows.length, totalPages, hasPrevious: page > 1, hasNext: page < totalPages };
  };
  return { forms, calls, previews, permissions: ["formtemplates.read", "formtemplates.manage", "formtemplates.publish", "formcatalogs.read"], async handle(request: Request): Promise<Response | undefined> {
    const url = new URL(request.url), path = url.pathname;
    if (!path.startsWith("/api/forms/")) return undefined;
    calls.push({ method: request.method, path });
    if (path === "/api/forms/catalogs" && request.method === "GET") {
      const rows = [{ id: catalog.id, name: catalog.name[culture]!, description: catalog.description[culture]!, origin: "Manual", valueType: catalog.valueType, optionsCount: items.length, usageCount: 1, state: "Active", stateReason: null, canEdit: false }];
      return json({ ...page(rows.filter(row => row.name.toLowerCase().includes((url.searchParams.get("search") ?? "").toLowerCase())), url.searchParams), filterCounts: { byKind: { all: 1, manual: 1, filters: 0 } } });
    }
    if (path === "/api/forms/catalogs/" + ids.suppliers) return json(catalog);
    if (path === "/api/forms/catalogs/" + ids.suppliers + "/items") return json(page(items, url.searchParams));
    // Every composed title of these options fits: the server check of an own presentation reports nothing in either language.
    if (path === "/api/forms/catalogs/" + ids.suppliers + "/presentation-checks" && request.method === "POST") return json({ cultures: (["es", "en"] as const).map(entry => ({ culture: entry, titleTooLongCount: 0, titleExamples: [], descriptionTooLongCount: 0, descriptionExamples: [] })) });
    if (path === "/api/forms/person-attributes") return json({ items: [attribute] });
    // The largest group of what the fixed filters leave, grouped by the person filters, labelled in the menu language like the server.
    if (path === "/api/forms/recipient-maximums" && request.method === "POST") {
      const { source } = await request.json() as { source: FormQuestionSource };
      const fixed = (source.match ?? []).flatMap(match => "value" in match ? [match] : []);
      const byPerson = (source.match ?? []).flatMap(match => "personAttributeId" in match ? [match.fieldId] : []);
      const groups = new Map<string, CatalogItem[]>();
      for (const item of items.filter(item => fixed.every(match => item.fields?.[match.fieldId] === match.value))) {
        const key = JSON.stringify(byPerson.map(field => item.fields?.[field] ?? null));
        groups.set(key, [...(groups.get(key) ?? []), item]);
      }
      const largest = [...groups.values()].sort((left, right) => right.length - left.length)[0] ?? [], first = largest[0];
      const result: RecipientMaximum = { maximum: largest.length, maximumLabel: byPerson.length && first ? byPerson.map(field => first.fieldTexts?.[field]?.[culture] ?? "").join(" · ") : null };
      return json(result);
    }
    if (path === "/api/forms/recipient-samples") return json(page(samples.filter(sample => sample.name.toLowerCase().includes((url.searchParams.get("search") ?? "").toLowerCase())), url.searchParams));
    if (path === "/api/forms/definitions/" + definition.id + "/recipient-previews" && request.method === "POST") {
      const body = await request.json() as RecipientPreviewBody;
      previews.push(body);
      const sample = samples.find(sample => sample.id === body.sampleUserId)!;
      const missing = body.sampleUserId === ids.pablo;
      const matched = missing ? [] : items.filter(item => (body.source.match ?? []).every(match => item.fields?.[match.fieldId] === ("personAttributeId" in match ? ids.center : match.value)));
      const selected = body.source.presentation ?? catalog.presentation!;
      const part = (item: CatalogItem, field: string): string => field === "text" ? item.text[body.culture] ?? item.text.es! : field === "code" ? item.code : field === "detail" ? item.detail[body.culture] ?? item.detail.es ?? "" : item.fieldTexts?.[field]?.[body.culture] ?? item.fields?.[field] ?? "";
      const limit = body.type === "multiChoice" ? 20 : 200;
      const result: RecipientPreview = { recipient: { id: sample.id, name: sample.name, values: missing ? [] : [{ attributeId: ids.attribute, name: names("Zona", "Zone"), text: names("Centro", "Center") }] }, state: missing ? "RecipientDataMissing" : "Ready", optionCount: matched.length, limit, exceedsLimit: matched.length > limit,
        options: matched.slice(0, limit).map(item => ({ id: item.id, title: selected.title.map(field => part(item, field)).filter(Boolean).join(" · "), description: selected.description.map(field => part(item, field)).filter(Boolean).join(" · ") || null })) };
      return json(result);
    }
    return undefined;
  } };
}
