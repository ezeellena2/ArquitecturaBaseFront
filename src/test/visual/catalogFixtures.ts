import type { CatalogDetail, CatalogItem } from "@/features/business-forms/api/catalogResponse";
import type { ManualCatalogBody, UpdateManualCatalogBody } from "@/features/business-forms/api/catalogs";

// Browser-only simulated persistence. The real app/API harness qualifies database behavior separately.
export const visualCatalogId = "01990000-0000-7000-8000-000000000080";
export function createCatalogFixtureStore(culture: "es" | "en", scenario: string) {
  let catalog: CatalogDetail = { id: visualCatalogId, key: visualCatalogId.replaceAll("-", ""), name: { es: "Clientes", en: "Customers" }, description: { es: "Clientes para las visitas", en: "Customers for visits" }, kind: "Manual", revision: 1, isActive: true, itemsCount: 3, usageCount: null, unavailableReasonCode: null };
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
    if (url.pathname === "/api/forms/catalogs") return json(page([{ id: catalog.id, name: catalog.name[culture], description: catalog.description[culture], origin: "Manual", optionsCount: items.length, usageCount: null, state: "Active", stateReason: null, canEdit: scenario !== "catalogs-read" }], url.searchParams));
    return json(catalog);
  } };
}
