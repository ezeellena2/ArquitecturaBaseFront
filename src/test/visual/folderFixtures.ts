import type { FormFolder, FormMenu } from "@/features/business-forms/api/folders";

// Synthetic doubles of the folders (CP1-A to CP5-A) for the catalog, its scenes and the listings' tests; never a capture of the
// backend, whose bodies the HTTP contract tests consume. Outside the «*-folders» scenarios there are no folders yet, so the
// listings show only «Todos» and «Sin carpeta».
export const folderFixtureIds = {
  billing: "0199a0c0-0000-7000-8000-0000000000f1",
  delivery: "0199a0c0-0000-7000-8000-0000000000f2",
  north: "0199a0c0-0000-7000-8000-0000000000f3",
  south: "0199a0c0-0000-7000-8000-0000000000f4",
  sowing: "0199a0c0-0000-7000-8000-0000000000f5",
} as const;
const formIds = { route: "0199a0c0-0000-7000-8000-0000000000a1", visit: "0199a0c0-0000-7000-8000-0000000000a2", invoice: "0199a0c0-0000-7000-8000-0000000000a3" };

function sampleTree(english: boolean): FormFolder[] {
  const folder = (id: string, parentId: string | null, name: string, menuPlacement: FormFolder["menuPlacement"] = "None", menuIcon: FormFolder["menuIcon"] = null): FormFolder =>
    ({ id, parentId, name, revision: 1, menuPlacement, menuIcon });
  return [
    folder(folderFixtureIds.billing, null, english ? "Billing" : "Facturación", "Administration"),
    folder(folderFixtureIds.delivery, null, english ? "Deliveries" : "Repartos", "Own", "truck"),
    folder(folderFixtureIds.north, folderFixtureIds.delivery, english ? "North" : "Norte"),
    folder(folderFixtureIds.south, folderFixtureIds.delivery, english ? "South" : "Sur"),
    folder(folderFixtureIds.sowing, null, english ? "Sowing and harvest" : "Siembra y cosecha"),
  ];
}
function sampleMenu(english: boolean): FormMenu {
  const route = { id: formIds.route, name: english ? "Route sheet" : "Hoja de ruta" };
  return {
    menus: [{ folderId: folderFixtureIds.delivery, name: english ? "Deliveries" : "Repartos", icon: "truck", forms: [route],
      groups: [{ folderId: folderFixtureIds.north, name: english ? "North" : "Norte", forms: [{ id: formIds.visit, name: english ? "Customer visit" : "Visita a cliente" }] }] }],
    forms: [],
    administration: [{ folderId: folderFixtureIds.billing, name: english ? "Billing" : "Facturación", forms: [{ id: formIds.invoice, name: english ? "Invoice" : "Factura" }] }],
  };
}

export function createFolderVisualFixtures(language: "es" | "en", scenario: string | null, permissions: readonly string[]) {
  const english = language === "en";
  const sample = scenario?.endsWith("-folders") ?? false;
  let folders = sample ? sampleTree(english) : [];
  const memberships = new Map<string, string[]>();
  let serial = 0x10;
  const canManage = permissions.includes("formtemplates.manage") || permissions.includes("formcatalogs.manage");
  const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
  const subtree = (id: string): string[] => [id, ...folders.filter(folder => folder.parentId === id).flatMap(folder => subtree(folder.id))];
  async function handle(request: Request): Promise<Response | undefined> {
    const path = new URL(request.url).pathname;
    if (path === "/api/forms/menu") return json(sample ? sampleMenu(english) : { menus: [], forms: [], administration: [] });
    if (path === "/api/forms/folders" && request.method === "GET") return json({ folders, canManage });
    if (path === "/api/forms/folders" && request.method === "POST") {
      const body = await request.json() as { parentId: string | null; name: string };
      const created: FormFolder = { id: `0199a0c0-0000-7000-8000-0000000001${(serial++).toString(16).padStart(2, "0")}`, parentId: body.parentId, name: body.name.trim(), revision: 1, menuPlacement: "None", menuIcon: null };
      folders = [...folders, created].sort((left, right) => left.name.localeCompare(right.name, language));
      return json(created);
    }
    const item = /^\/api\/forms\/(?:definitions|catalogs)\/([^/]+)\/folders$/.exec(path);
    if (item) {
      if (request.method === "PUT") memberships.set(item[1], (await request.json() as { folderIds: string[] }).folderIds);
      return json({ folderIds: memberships.get(item[1]) ?? [] });
    }
    const one = /^\/api\/forms\/folders\/([^/]+)(\/deletion|\/menu)?$/.exec(path);
    const current = one ? folders.find(folder => folder.id === one[1]) : undefined;
    if (!one) return undefined;
    if (!current) return json({ code: "Forms.Folder.NotFound" }, 404);
    if (one[2] === "/deletion") return json({ revision: current.revision, subfolderCount: subtree(current.id).length - 1, formCount: 3, catalogCount: 2 });
    if (request.method === "DELETE") { const gone = subtree(current.id); folders = folders.filter(folder => !gone.includes(folder.id)); return new Response(null, { status: 204 }); }
    const body = await request.json() as { name?: string; parentId?: string | null; placement?: FormFolder["menuPlacement"]; icon?: FormFolder["menuIcon"] };
    const changed: FormFolder = one[2] === "/menu"
      ? { ...current, revision: current.revision + 1, menuPlacement: body.placement ?? "None", menuIcon: body.placement === "Own" ? body.icon ?? "folder" : null }
      : { ...current, revision: current.revision + 1, name: body.name?.trim() ?? current.name, parentId: body.parentId ?? null };
    folders = folders.map(folder => folder.id === current.id ? changed : folder).sort((left, right) => left.name.localeCompare(right.name, language));
    return json(changed);
  }
  return { handle };
}
