import type { FormFolder, FormMenu } from "@/features/business-forms/api/folders";
import { responseFormId } from "../responseFixtures";

// Synthetic doubles of the folders (CM1 a CM6) for the catalog and its scenes; never a capture of the backend, whose bodies the
// HTTP contract tests consume. The «*-folders» scenarios have three folders of the menu, one with two subfolders, and the menu is
// read from the folders the scene has: a folder created there shows up open, and one deleted leaves. Whoever administers forms gets
// every folder, also the empty ones; anyone else, only what has forms. `forms-without-folders` has none and `forms-failed-folders`
// cannot read the menu. Outside those scenarios there are no folders: the «Carpeta» filter has only «Todas» and «Sin carpeta», and
// whoever administers forms sees only «Nueva carpeta» in the menu.
const ids = {
  billing: "0199a0c0-0000-7000-8000-0000000000f1",
  delivery: "0199a0c0-0000-7000-8000-0000000000f2",
  north: "0199a0c0-0000-7000-8000-0000000000f3",
  south: "0199a0c0-0000-7000-8000-0000000000f4",
  sowing: "0199a0c0-0000-7000-8000-0000000000f5",
} as const;

function sampleTree(english: boolean): FormFolder[] {
  const folder = (id: string, parentId: string | null, name: string, icon: FormFolder["icon"] = null): FormFolder => ({ id, parentId, name, revision: 1, icon });
  return [
    folder(ids.billing, null, english ? "Billing" : "Facturación", "receipt"),
    folder(ids.delivery, null, english ? "Deliveries" : "Repartos", "truck"),
    folder(ids.north, ids.delivery, english ? "North" : "Norte"),
    folder(ids.south, ids.delivery, english ? "South" : "Sur"),
    folder(ids.sowing, null, english ? "Sowing and harvest" : "Siembra y cosecha", "leaf"),
  ];
}

// The active forms right in each folder, and the catalogs. «Control de carga» is the form of the responses' scenes, so the one opened
// from the menu shows its sheet.
function sampleContents(english: boolean) {
  const forms = new Map<string, { id: string; name: string }[]>([
    [ids.billing, [{ id: "0199a0c0-0000-7000-8000-0000000000a3", name: english ? "Invoice" : "Factura" }]],
    [ids.delivery, [{ id: "0199a0c0-0000-7000-8000-0000000000a1", name: english ? "Route sheet" : "Hoja de ruta" }]],
    [ids.north, [{ id: responseFormId, name: english ? "Load check" : "Control de carga" }]],
  ]);
  return { forms, catalogs: new Map<string, number>([[ids.sowing, 2]]) };
}

export function createFolderVisualFixtures(language: "es" | "en", scenario: string | null, permissions: readonly string[]) {
  const english = language === "en";
  const sample = (scenario?.endsWith("-folders") ?? false) && scenario !== "forms-without-folders";
  let folders = sample ? sampleTree(english) : [];
  const contents = sampleContents(english);
  const memberships = new Map<string, string[]>();
  const folderForms = new Map<string, string[]>();
  let serial = 0x10;
  const canManage = permissions.includes("formtemplates.manage");
  const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
  const subtree = (id: string): string[] => [id, ...folders.filter(folder => folder.parentId === id).flatMap(folder => subtree(folder.id))];
  const formsIn = (id: string) => contents.forms.get(id) ?? [];
  function menu(): FormMenu {
    const menus = folders.filter(folder => folder.parentId === null).map(folder => ({
      folderId: folder.id, name: folder.name, icon: folder.icon ?? "folder", revision: folder.revision, forms: formsIn(folder.id),
      catalogCount: canManage ? subtree(folder.id).reduce((total, id) => total + (contents.catalogs.get(id) ?? 0), 0) : 0,
      groups: folders.filter(child => child.parentId === folder.id).map(child => ({ folderId: child.id, name: child.name, revision: child.revision, forms: formsIn(child.id) }))
        .filter(group => canManage || group.forms.length > 0),
    }));
    return { canManage, menus: canManage ? menus : menus.filter(section => section.forms.length > 0 || section.groups.length > 0) };
  }
  async function handle(request: Request): Promise<Response | undefined> {
    const path = new URL(request.url).pathname;
    if (path === "/api/forms/menu") return scenario === "forms-failed-folders" ? json({ code: "General.Unexpected", traceId: "folders-fixture" }, 500) : json(menu());
    if (path === "/api/forms/folders" && request.method === "GET") return json({ folders, canManage });
    if (path === "/api/forms/folders" && request.method === "POST") {
      const body = await request.json() as { parentId: string | null; name: string; icon: FormFolder["icon"] };
      const created: FormFolder = { id: `0199a0c0-0000-7000-8000-0000000001${(serial++).toString(16).padStart(2, "0")}`, parentId: body.parentId, name: body.name.trim(), revision: 1,
        icon: body.parentId === null ? body.icon ?? "folder" : null };
      folders = [...folders, created].sort((left, right) => left.name.localeCompare(right.name, language));
      return json(created);
    }
    const item = /^\/api\/forms\/(?:definitions|catalogs)\/([^/]+)\/folders$/.exec(path);
    if (item) {
      if (request.method === "PUT") memberships.set(item[1], (await request.json() as { folderIds: string[] }).folderIds);
      return json({ folderIds: memberships.get(item[1]) ?? [] });
    }
    const one = /^\/api\/forms\/folders\/([^/]+)(\/deletion|\/forms)?$/.exec(path);
    const current = one ? folders.find(folder => folder.id === one[1]) : undefined;
    if (!one) return undefined;
    if (!current) return json({ code: "Forms.Folder.NotFound" }, 404);
    if (one[2] === "/deletion") return json({ revision: current.revision, subfolderCount: subtree(current.id).length - 1, formCount: 3, catalogCount: 2 });
    if (one[2] === "/forms") {
      if (request.method === "PUT") folderForms.set(current.id, (await request.json() as { formIds: string[] }).formIds);
      return json({ formIds: folderForms.get(current.id) ?? [] });
    }
    if (request.method === "DELETE") { const gone = subtree(current.id); folders = folders.filter(folder => !gone.includes(folder.id)); return new Response(null, { status: 204 }); }
    const body = await request.json() as { name?: string; parentId?: string | null; icon?: FormFolder["icon"] };
    const parentId = body.parentId ?? null;
    const changed: FormFolder = { ...current, revision: current.revision + 1, name: body.name?.trim() ?? current.name, parentId, icon: parentId === null ? body.icon ?? current.icon ?? "folder" : null };
    folders = folders.map(folder => folder.id === current.id ? changed : folder).sort((left, right) => left.name.localeCompare(right.name, language));
    return json(changed);
  }
  return { handle };
}
