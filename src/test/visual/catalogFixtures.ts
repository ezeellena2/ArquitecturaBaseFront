import { createCatalogImportVisualStore } from "./catalogImportVisualFixtures";
import filterOptions from "../fixtures/catalogs-http/filters/options.json" with { type: "json" };
import filterPreview from "../fixtures/catalogs-http/filters/preview.json" with { type: "json" };
import filterPreviewRequest from "../fixtures/catalogs-http/filters/preview-request.json" with { type: "json" };
import type { FiltersCatalogBody, CatalogFilterPreviewBody } from "@/features/business-forms/api/catalogs";
import type { CatalogFilterOptions } from "@/features/business-forms/api/catalogResponse";
import { type CatalogDetail, type CatalogItem } from "@/features/business-forms/api/catalogResponse";
import type { CreateManualCatalogBody, UpdateManualCatalogBody } from "@/features/business-forms/api/catalogs";
import { administrativeName } from "@/features/business-forms/editorModel";

// Browser-only simulated persistence. The real app/API harness qualifies database behavior separately.
export const visualCatalogId = "01990000-0000-7000-8000-000000000080";
export function createCatalogFixtureStore(culture: "es" | "en", scenario: string) {
  if (scenario.startsWith("forms-catalog")) return createQuestionCatalogFixtureStore(culture);
  if (scenario.startsWith("catalogs-filters")) return createFiltersFixtureStore(culture, scenario);
  let catalog: CatalogDetail = { valueType: "Text" as const, proposal: null, id: visualCatalogId, key: visualCatalogId.replaceAll("-", ""), name: { es: "Clientes", en: "Customers" }, description: { es: "Clientes para las visitas", en: "Customers for visits" }, kind: "Manual", revision: 1, isActive: true, itemsCount: 3, usageCount: null, unavailableReasonCode: null, filters: null };
  let items: CatalogItem[] = ["Pérez", "López", "Ríos"].map((name, index) => ({ value: null, id: "01990000-0000-7000-8000-00000000008" + (index + 1), code: "C" + (index + 1), text: { es: name, en: null }, detail: { es: null, en: null }, position: index + 1, isActive: true }));
  if (scenario === "catalogs-typed" || scenario === "catalogs-import-typed") {
    catalog = { ...catalog, valueType: "Decimal", name: { es: "Recargo por zona", en: "Zone surcharge" } };
    items = items.map((item, index) => ({ ...item, value: ["0", "1500.5", "3200"][index]!, text: { es: ["CABA", "GBA", "Interior"][index]!, en: ["CABA", "GBA", "Inland"][index]! } }));
  }
  let conflict = scenario === "catalogs-conflict";
  let identity = 100;
  const writes: { method: string; body: CreateManualCatalogBody | UpdateManualCatalogBody }[] = [];
  const reads: string[] = [];
  const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
  const page = <T,>(rows: T[], params: URLSearchParams) => {
    const number = Number(params.get("page") ?? 1), size = Number(params.get("pageSize") ?? 20), totalPages = Math.ceil(rows.length / size);
    return { items: rows.slice((number - 1) * size, number * size), page: number, pageSize: size, totalCount: rows.length, totalPages, hasPrevious: number > 1, hasNext: number < totalPages };
  };
  const store = { writes, reads, async handle(request: Request): Promise<Response> {
    const url = new URL(request.url);
    if (scenario === "catalogs-denied") return json({ code: "Authorization.Forbidden" }, 403);
    if (request.method === "POST" || request.method === "PUT") {
      const body = await request.json() as CreateManualCatalogBody | UpdateManualCatalogBody;
      writes.push({ method: request.method, body });
      if (scenario === "catalogs-read") return json({ code: "Authorization.Forbidden" }, 403);
      if (request.method === "PUT" && conflict) { conflict = false; catalog = { ...catalog, revision: 2, name: { es: "Clientes actuales", en: "Current customers" } }; return json({ code: "Forms.Catalog.RevisionConflict" }, 409); }
      if ("expectedRevision" in body && body.expectedRevision !== catalog.revision) return json({ code: "Forms.Catalog.RevisionConflict" }, 409);
      if (request.method === "POST") items = [];
      const itemIdentityMap: Record<string, string> = {};
      for (const value of body.items) {
        const itemId = value.itemId ?? "01990000-0000-7000-8000-" + String(++identity).padStart(12, "0");
        if (!value.itemId) itemIdentityMap[value.localId] = itemId;
        const existing = items.find(item => item.id === itemId);
        const next = { value: value.value ?? null, id: itemId, code: value.code, text: { ...value.text }, detail: { ...value.detail }, isActive: value.isActive, position: existing?.position ?? items.length + 1 };
        items = existing ? items.map(item => item.id === itemId ? next : item) : [...items, next];
      }
      if ("moves" in body) for (const move of body.moves ?? []) {
        const index = items.findIndex(item => item.id === move.itemId), target = index + (move.direction === "up" ? -1 : 1);
        if (index >= 0 && target >= 0 && target < items.length) { const item = items.splice(index, 1)[0]!; items.splice(target, 0, item); }
      }
      items = items.map((item, index) => ({ ...item, position: index + 1 }));
      catalog = { ...catalog, valueType: "valueType" in body ? body.valueType ?? "Text" : catalog.valueType, name: { ...body.name }, description: { ...body.description }, isActive: "isActive" in body ? body.isActive ?? catalog.isActive : catalog.isActive, revision: request.method === "POST" ? 1 : catalog.revision + 1, itemsCount: items.length };
      return json({ catalog, itemIdentityMap }, request.method === "POST" ? 201 : 200);
    }
    reads.push(url.pathname + url.search);
    if (url.pathname.endsWith("/items")) return json(page(items.filter(item => !url.searchParams.get("search") || item.text.es?.toLowerCase().includes(url.searchParams.get("search")!.toLowerCase())), url.searchParams));
    if (url.pathname === "/api/forms/catalogs") {
      const matches = (!url.searchParams.get("search") || administrativeName(catalog.name, culture).toLowerCase().includes(url.searchParams.get("search")!.toLowerCase())) && (!url.searchParams.get("state") || url.searchParams.get("state") === (catalog.isActive ? "Active" : "Inactive"));
      const rows = matches && (!url.searchParams.get("kind") || url.searchParams.get("kind") === "Manual") ? [{ valueType: catalog.valueType, id: catalog.id, name: administrativeName(catalog.name, culture), description: administrativeName(catalog.description, culture), origin: "Manual", optionsCount: items.length, usageCount: null, state: catalog.isActive ? "Active" : "Inactive", stateReason: null, canEdit: scenario !== "catalogs-read" }] : [];
      return json({ ...page(rows, url.searchParams), filterCounts: { byKind: { all: matches ? 1 : 0, manual: matches ? 1 : 0, filters: 0 } } });
    }
    return json(catalog);
  } };
  return scenario.startsWith("catalogs-import") ? createCatalogImportVisualStore(culture, catalog, () => store) : store;
}

function createFiltersFixtureStore(culture: "es" | "en", scenario: string) {
  // Synthetic current DTO. Actual producer bodies remain covered by the HTTP contract tests.
  let catalog: CatalogDetail = { valueType: "Text", proposal: null, id: visualCatalogId, key: visualCatalogId.replaceAll("-", ""), name: { es: "Personas por filtro", en: "People by filter" }, description: { es: "Descripción del filtro", en: "Filter description" }, kind: "Filters", revision: 1, isActive: true, itemsCount: 0, usageCount: null, unavailableReasonCode: null, filters: filterPreviewRequest.filters };
  const readOnly = scenario === "catalogs-filters-read";
  const missingRole = scenario === "catalogs-filters-missing-role";
  if (missingRole) catalog = { ...catalog, filters: { ...filterPreviewRequest.filters, conditions: [{ column: "role", operator: "has", value: "01990000-0000-7000-8000-000000000699" }] } };
  let conflict = scenario === "catalogs-filters-conflict";
  const people = [...filterOptions.sampleUsers.items, ...Array.from({ length: 22 }, (_, index) => ({ id: "01990000-0000-7000-8000-" + String(index + 200).padStart(12, "0"), name: "Persona de muestra " + String(index + 1).padStart(2, "0") }))];
  const writes: { method: string; body: FiltersCatalogBody & { expectedRevision?: number; isActive?: boolean } }[] = [];
  const previews: CatalogFilterPreviewBody[] = []; const reads: string[] = [];
  const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
  const paged = <T,>(rows: readonly T[], params: URLSearchParams) => { const page = Number(params.get("page") ?? 1), pageSize = Number(params.get("pageSize") ?? 20), totalPages = Math.ceil(rows.length / pageSize); return { items: rows.slice((page - 1) * pageSize, page * pageSize), page, pageSize, totalCount: rows.length, totalPages, hasPrevious: page > 1, hasNext: page < totalPages }; };
  return { writes, previews, reads, async handle(request: Request): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname === "/api/forms/catalog-filter-options") {
      reads.push(url.pathname + url.search);
      const rows = people.filter(person => person.name.toLowerCase().includes((url.searchParams.get("search") ?? "").toLowerCase()));
      const options: CatalogFilterOptions = { source: "users",
        columns: filterOptions.columns.map(column => ({ ...column, choices: column.key === "active" ? [{ key: "true", label: culture === "es" ? "Activo" : "Active" }, { key: "false", label: culture === "es" ? "Inactivo" : "Inactive" }] : column.choices })), sampleUsers: !readOnly ? paged(rows, url.searchParams) : null };
      return json(options);
    }
    if (url.pathname === "/api/forms/catalog-previews") {
      const body = await request.json() as CatalogFilterPreviewBody; previews.push(body);
      if (readOnly) return json({ code: "Authorization.Forbidden" }, 403);
      if (scenario === "catalogs-filters-limit") return json({ items: [], totalCount: 201, exceedsLimit: true });
      if (missingRole) return json({ items: [], totalCount: 0, exceedsLimit: false });
      if (scenario === "catalogs-filters-long") return json({items:[{id:visualCatalogId,text:"Long display name that exceeds WhatsApp limits",detail:null,canSend:false}],totalCount:1,exceedsLimit:false});
      const active = culture === "es" ? "Activo" : "Active";
      const rows = filterPreview.items.filter(item => !body.filters.excludeRecipient || item.id !== body.sampleUserId).map(item => ({ ...item, text: body.filters.textColumn === "active" ? active : item.text, detail: body.filters.detailColumn === "active" ? active : body.filters.detailColumn === null ? null : item.detail }));
      return json({ items: rows, totalCount: rows.length, exceedsLimit: false });
    }
    if (request.method === "POST" || request.method === "PUT") {
      const body = await request.json() as FiltersCatalogBody & { expectedRevision?: number; isActive?: boolean }; writes.push({ method: request.method, body });
      if (readOnly) return json({ code: "Authorization.Forbidden" }, 403);
      if (request.method === "PUT" && conflict) { conflict = false; catalog = { ...catalog, revision: 2, name: { es: "Personas actuales", en: "Current people" } }; return json({ code: "Forms.Catalog.RevisionConflict" }, 409); }
      if (body.expectedRevision !== undefined && body.expectedRevision !== catalog.revision) return json({ code: "Forms.Catalog.RevisionConflict" }, 409);
      catalog = { ...catalog, name: { ...body.name }, description: { ...body.description }, filters: { ...body.filters, conditions: body.filters.conditions.map(condition => ({ ...condition })) }, isActive: body.isActive ?? catalog.isActive, revision: request.method === "POST" ? 1 : catalog.revision + 1, unavailableReasonCode: null };
      return json({ catalog, itemIdentityMap: {} }, request.method === "POST" ? 201 : 200);
    }
    reads.push(url.pathname + url.search);
    if (url.pathname === "/api/forms/catalogs") {
      const state = catalog.isActive ? "Active" : "Inactive";
      const matches = (!url.searchParams.get("search") || administrativeName(catalog.name, culture).toLowerCase().includes(url.searchParams.get("search")!.toLowerCase())) && (!url.searchParams.get("state") || url.searchParams.get("state") === state);
      const rows = matches && (!url.searchParams.get("kind") || url.searchParams.get("kind") === "Filters") ? [{ valueType: "Text" as const, id: catalog.id, name: administrativeName(catalog.name, culture), description: administrativeName(catalog.description, culture), origin: "Filters", optionsCount: null, usageCount: null, state, stateReason: null, canEdit: !readOnly }] : [];
      return json({ ...paged(rows, url.searchParams), filterCounts: { byKind: { all: matches ? 1 : 0, manual: 0, filters: matches ? 1 : 0 } } });
    }
    return json(catalog);
  } };
}

// K6 selector data in the existing simulated server; not a real HTTP export or database proof.
function createQuestionCatalogFixtureStore(culture: "es" | "en") {
  const base = createCatalogFixtureStore(culture, "catalogs-read");
  const id = (n: number) => "01990000-0000-7000-8000-" + String(n).padStart(12, "0");
  const names = (es: string, en: string) => culture === "es" ? es : en;
  const rows = [
    { valueType: "Text" as const, id: visualCatalogId, name: names("Clientes", "Customers"), description: names("Clientes para las visitas", "Customers for visits"), origin: "Manual", optionsCount: 3, usageCount: null, state: "Active", stateReason: null, canEdit: false },
    { valueType: "Text" as const, id: id(81), name: names("Supervisores activos", "Active supervisors"), description: null, origin: "Filters", optionsCount: null, usageCount: null, state: "Active", stateReason: null, canEdit: false },
    { valueType: "Text" as const, id: id(82), name: names("Responsables de obra", "Site managers"), description: null, origin: "Filters", optionsCount: null, usageCount: null, state: "Unavailable", stateReason: "Forms.Catalog.ContentInvalid", canEdit: false },
    { valueType: "Text" as const, id: id(83), name: names("Archivados", "Archived"), description: null, origin: "Manual", optionsCount: 2, usageCount: null, state: "Inactive", stateReason: null, canEdit: false },
    ...Array.from({ length: 21 }, (_, index) => ({ valueType: "Text" as const, id: id(300 + index), name: names("ZZ catálogo ", "ZZ catalog ") + String(index + 1).padStart(2, "0"), description: null, origin: "Manual", optionsCount: 2, usageCount: null, state: "Active", stateReason: null, canEdit: false })),
  ];
  const calls: { method: string; path: string }[] = [];
  const json = (body: unknown) => new Response(JSON.stringify(body), { status: 200, headers: { "content-type": "application/json" } });
  return { calls, async handle(request: Request): Promise<Response> {
    const url = new URL(request.url); calls.push({ method: request.method, path: url.pathname });
    if (url.pathname === "/api/forms/catalogs") {
      const all = rows.filter(row => row.name.toLowerCase().includes((url.searchParams.get("search") ?? "").toLowerCase())).sort((a, b) => a.name.localeCompare(b.name));
      const page = Number(url.searchParams.get("page") ?? 1), pageSize = Number(url.searchParams.get("pageSize") ?? 20), totalPages = Math.ceil(all.length / pageSize);
      return json({ items: all.slice((page - 1) * pageSize, page * pageSize), page, pageSize, totalCount: all.length, totalPages, hasPrevious: page > 1, hasNext: page < totalPages, filterCounts: { byKind: { all: all.length, manual: all.filter(row => row.origin === "Manual").length, filters: all.filter(row => row.origin === "Filters").length } } });
    }
    const row = rows.find(row => row.id === url.pathname.split("/").at(-1));
    if (row?.id !== visualCatalogId && row) return json({ valueType: "Text" as const, proposal: null, revision: 1, usageCount: null, id: row.id, key: row.id.replaceAll("-", ""), name: { es: row.name, en: row.name }, description: { es: "Catálogo de prueba", en: "Test catalog" }, kind: row.origin, isActive: row.state !== "Inactive", unavailableReasonCode: row.stateReason, itemsCount: row.optionsCount, filters: row.origin === "Filters" ? filterPreviewRequest.filters : null });
    return base.handle(request);
  } };
}
