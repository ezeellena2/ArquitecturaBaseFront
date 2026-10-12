import filterDetail from "../fixtures/catalogs-http/filters/detail.json" with { type: "json" };
import filterOptions from "../fixtures/catalogs-http/filters/options.json" with { type: "json" };
import filterPreview from "../fixtures/catalogs-http/filters/preview.json" with { type: "json" };
import filterPreviewRequest from "../fixtures/catalogs-http/filters/preview-request.json" with { type: "json" };
import type { FiltersCatalogBody, CatalogFilterPreviewBody } from "@/features/business-forms/api/catalogs";
import type { CatalogFilterOptions } from "@/features/business-forms/api/catalogResponse";
import type { CatalogDetail, CatalogItem } from "@/features/business-forms/api/catalogResponse";
import type { ManualCatalogBody, UpdateManualCatalogBody } from "@/features/business-forms/api/catalogs";

// Browser-only simulated persistence. The real app/API harness qualifies database behavior separately.
export const visualCatalogId = "01990000-0000-7000-8000-000000000080";
export function createCatalogFixtureStore(culture: "es" | "en", scenario: string) {
  if (scenario.startsWith("catalogs-filters")) return createFiltersFixtureStore(culture, scenario);
  let catalog: CatalogDetail = { id: visualCatalogId, key: visualCatalogId.replaceAll("-", ""), name: { es: "Clientes", en: "Customers" }, description: { es: "Clientes para las visitas", en: "Customers for visits" }, kind: "Manual", revision: 1, isActive: true, itemsCount: 3, usageCount: null, unavailableReasonCode: null, filters: null };
  let items: CatalogItem[] = ["Pérez", "López", "Ríos"].map((name, index) => ({ id: "01990000-0000-7000-8000-00000000008" + (index + 1), code: "C" + (index + 1), text: { es: name, en: null }, detail: { es: null, en: null }, position: index + 1, isActive: true }));
  let conflict = scenario === "catalogs-conflict";
  let identity = 100;
  const writes: { method: string; body: ManualCatalogBody | UpdateManualCatalogBody }[] = [];
  const reads: string[] = [];
  const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
  const page = <T,>(rows: T[], params: URLSearchParams) => {
    const number = Number(params.get("page") ?? 1), size = Number(params.get("pageSize") ?? 20), totalPages = Math.ceil(rows.length / size);
    return { items: rows.slice((number - 1) * size, number * size), page: number, pageSize: size, totalCount: rows.length, totalPages, hasPrevious: number > 1, hasNext: number < totalPages };
  };
  return { writes, reads, async handle(request: Request) {
    const url = new URL(request.url);
    if (scenario === "catalogs-denied") return json({ code: "Authorization.Forbidden" }, 403);
    if (request.method === "POST" || request.method === "PUT") {
      const body = await request.json() as ManualCatalogBody | UpdateManualCatalogBody;
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
        const next = { id: itemId, code: value.code, text: { ...value.text }, detail: { ...value.detail }, isActive: value.isActive, position: existing?.position ?? items.length + 1 };
        items = existing ? items.map(item => item.id === itemId ? next : item) : [...items, next];
      }
      if ("moves" in body) for (const move of body.moves ?? []) {
        const index = items.findIndex(item => item.id === move.itemId), target = index + (move.direction === "up" ? -1 : 1);
        if (index >= 0 && target >= 0 && target < items.length) { const item = items.splice(index, 1)[0]!; items.splice(target, 0, item); }
      }
      items = items.map((item, index) => ({ ...item, position: index + 1 }));
      catalog = { ...catalog, name: { ...body.name }, description: { ...body.description }, revision: request.method === "POST" ? 1 : catalog.revision + 1, itemsCount: items.length };
      return json({ catalog, itemIdentityMap }, request.method === "POST" ? 201 : 200);
    }
    reads.push(url.pathname + url.search);
    if (url.pathname.endsWith("/items")) return json(page(items.filter(item => !url.searchParams.get("search") || item.text.es?.toLowerCase().includes(url.searchParams.get("search")!.toLowerCase())), url.searchParams));
    if (url.pathname === "/api/forms/catalogs") {
      const matches = (!url.searchParams.get("search") || catalog.name[culture].toLowerCase().includes(url.searchParams.get("search")!.toLowerCase())) && (!url.searchParams.get("state") || url.searchParams.get("state") === "Active");
      const rows = matches && (!url.searchParams.get("kind") || url.searchParams.get("kind") === "Manual") ? [{ id: catalog.id, name: catalog.name[culture], description: catalog.description[culture], origin: "Manual", optionsCount: items.length, usageCount: null, state: "Active", stateReason: null, canEdit: scenario !== "catalogs-read" }] : [];
      return json({ ...page(rows, url.searchParams), filterCounts: { byKind: { all: matches ? 1 : 0, manual: matches ? 1 : 0, filters: 0 } } });
    }
    return json(catalog);
  } };
}

function createFiltersFixtureStore(culture: "es" | "en", scenario: string) {
  // Existing simulated server, using exported fictitious data as a seed. This is not an HTTP producer or database test.
  let catalog: CatalogDetail = { ...filterDetail, id: visualCatalogId, key: visualCatalogId.replaceAll("-", ""), kind: "Filters", filters: filterPreviewRequest.filters };
  const readOnly = scenario === "catalogs-filters-read"; let available = scenario !== "catalogs-filters-unavailable";
  let conflict = scenario === "catalogs-filters-conflict";
  const people = [...filterOptions.sampleUsers.items, ...Array.from({ length: 22 }, (_, index) => ({ id: "01990000-0000-7000-8000-" + String(index + 200).padStart(12, "0"), name: "Persona de muestra " + String(index + 1).padStart(2, "0") }))];
  const writes: { method: string; body: FiltersCatalogBody & { expectedRevision?: number } }[] = [];
  const previews: CatalogFilterPreviewBody[] = []; const reads: string[] = [];
  const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
  const paged = <T,>(rows: readonly T[], params: URLSearchParams) => { const page = Number(params.get("page") ?? 1), pageSize = Number(params.get("pageSize") ?? 20), totalPages = Math.ceil(rows.length / pageSize); return { items: rows.slice((page - 1) * pageSize, page * pageSize), page, pageSize, totalCount: rows.length, totalPages, hasPrevious: page > 1, hasNext: page < totalPages }; };
  return { writes, previews, reads, restoreSource() { available = true; }, async handle(request: Request) {
    const url = new URL(request.url);
    if (url.pathname === "/api/forms/catalog-filter-options") {
      reads.push(url.pathname + url.search);
      const rows = people.filter(person => person.name.toLowerCase().includes((url.searchParams.get("search") ?? "").toLowerCase()));
      const options: CatalogFilterOptions = { source: "users", isAvailable: available, unavailableReasonCode: available ? null : "Forms.Catalog.SourceUnavailable",
        columns: filterOptions.columns.map(column => ({ ...column, choices: column.key === "role" && !available ? [] : column.key === "active" ? [{ key: "true", label: culture === "es" ? "Activo" : "Active" }, { key: "false", label: culture === "es" ? "Inactivo" : "Inactive" }] : column.choices })), sampleUsers: available && !readOnly ? paged(rows, url.searchParams) : null };
      return json(options);
    }
    if (url.pathname === "/api/forms/catalog-previews") {
      const body = await request.json() as CatalogFilterPreviewBody; previews.push(body);
      if (readOnly) return json({ code: "Authorization.Forbidden" }, 403);
      if (!available) return json({ code: "Forms.Catalog.SourceUnavailable" }, 409);
      if (scenario === "catalogs-filters-limit") return json({ items: [], totalCount: 201, exceedsLimit: true });
      const active = culture === "es" ? "Activo" : "Active";
      const rows = filterPreview.items.filter(item => !body.filters.excludeRecipient || item.id !== body.sampleUserId).map(item => ({ ...item, text: body.filters.textColumn === "active" ? active : item.text, detail: body.filters.detailColumn === "active" ? active : body.filters.detailColumn === null ? null : item.detail }));
      return json({ items: rows, totalCount: rows.length, exceedsLimit: false });
    }
    if (request.method === "POST" || request.method === "PUT") {
      const body = await request.json() as FiltersCatalogBody & { expectedRevision?: number }; writes.push({ method: request.method, body });
      if (readOnly) return json({ code: "Authorization.Forbidden" }, 403);
      if (!available) return json({ code: "Forms.Catalog.SourceUnavailable" }, 409);
      if (request.method === "PUT" && conflict) { conflict = false; catalog = { ...catalog, revision: 2, name: { es: "Personas actuales", en: "Current people" } }; return json({ code: "Forms.Catalog.RevisionConflict" }, 409); }
      if (body.expectedRevision !== undefined && body.expectedRevision !== catalog.revision) return json({ code: "Forms.Catalog.RevisionConflict" }, 409);
      catalog = { ...catalog, name: { ...body.name }, description: { ...body.description }, filters: { ...body.filters, conditions: body.filters.conditions.map(condition => ({ ...condition })) }, revision: request.method === "POST" ? 1 : catalog.revision + 1, unavailableReasonCode: null };
      return json({ catalog, itemIdentityMap: {} }, request.method === "POST" ? 201 : 200);
    }
    reads.push(url.pathname + url.search);
    if (url.pathname === "/api/forms/catalogs") {
      const state = available ? "Active" : "Unavailable";
      const matches = (!url.searchParams.get("search") || catalog.name[culture].toLowerCase().includes(url.searchParams.get("search")!.toLowerCase())) && (!url.searchParams.get("state") || url.searchParams.get("state") === state);
      const rows = matches && (!url.searchParams.get("kind") || url.searchParams.get("kind") === "Filters") ? [{ id: catalog.id, name: catalog.name[culture], description: catalog.description[culture], origin: "Filters", optionsCount: null, usageCount: null, state, stateReason: available ? null : "Forms.Catalog.SourceUnavailable", canEdit: !readOnly }] : [];
      return json({ ...paged(rows, url.searchParams), filterCounts: { byKind: { all: matches ? 1 : 0, manual: 0, filters: matches ? 1 : 0 } } });
    }
    return json({ ...catalog, unavailableReasonCode: available ? null : "Forms.Catalog.SourceUnavailable" });
  } };
}
