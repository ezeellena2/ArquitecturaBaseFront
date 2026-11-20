import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";
import { server } from "@/test/mocks/server";
import { createFolder, deleteFolder, fetchFolderForms, fetchFolderTree, fetchFormMenu, readFolder, readFolderDeletion, readFolderForms, readFolderTree, readFormMenu, readItemFolders,
  saveFolderForms, saveItemFolders, updateFolder, UnsupportedFolderResponse } from "./folders";

// Synthetic DTO examples for the guards' behavior; the HTTP contract test consumes the backend capture separately.
const billing = "0199a0c0-0000-7000-8000-0000000000f1";
const delivery = "0199a0c0-0000-7000-8000-0000000000f2";
const north = "0199a0c0-0000-7000-8000-0000000000f3";
const sowing = "0199a0c0-0000-7000-8000-0000000000f5";
const form = "0199a0c0-0000-7000-8000-0000000000a1";
function syntheticFolder(id: string, parentId: string | null, name: string, icon: string | null = parentId === null ? "folder" : null) {
  return { id, parentId, name, revision: 1, icon };
}
function syntheticTree() {
  return { folders: [syntheticFolder(billing, null, "Facturación"), syntheticFolder(delivery, null, "Repartos"), syntheticFolder(north, delivery, "Norte")], canManage: true };
}
function syntheticMenu() {
  return {
    canManage: false,
    menus: [
      { folderId: billing, name: "Facturación", icon: "receipt", revision: 2, catalogCount: 0, forms: [{ id: form, name: "Hoja de ruta" }], groups: [] as unknown[] },
      { folderId: delivery, name: "Repartos", icon: "truck", revision: 1, catalogCount: 0, forms: [] as unknown[], groups: [{ folderId: north, name: "Norte", revision: 1, forms: [{ id: form, name: "Hoja de ruta" }] }] },
    ],
  };
}
function rejects(read: () => unknown) {
  expect(read).toThrowError(UnsupportedFolderResponse);
  try { read(); } catch (error) { expect(String(error)).not.toContain("PRIVATE_MARKER"); }
}
type Tree = ReturnType<typeof syntheticTree>;

describe("folder contracts (CM1 a CM6)", () => {
  it("reads a tree of two levels whose parents are in it, with the icon only in the first level", () => {
    const tree = syntheticTree();
    tree.folders[1] = { ...tree.folders[1], icon: "truck" };
    expect(readFolderTree(tree)).toEqual(tree);
    expect(readFolderTree({ folders: [], canManage: false })).toEqual({ folders: [], canManage: false });
  });

  it.each([
    ["an unknown member", (tree: Tree) => ({ ...tree, marker: "PRIVATE_MARKER" })],
    ["an unknown folder member", (tree: Tree) => ({ ...tree, folders: [{ ...tree.folders[0], marker: "PRIVATE_MARKER" }] })],
    ["a parent that is not in the tree", (tree: Tree) => ({ ...tree, folders: tree.folders.slice(2) })],
    ["a repeated folder", (tree: Tree) => ({ ...tree, folders: [...tree.folders, tree.folders[0]] })],
    ["a folder of the first level without an icon", (tree: Tree) => ({ ...tree, folders: [{ ...tree.folders[0], icon: null }] })],
    ["a subfolder with an icon", (tree: Tree) => ({ ...tree, folders: [tree.folders[0], tree.folders[1], { ...tree.folders[2], icon: "truck" }] })],
    ["an icon out of the list", (tree: Tree) => ({ ...tree, folders: [{ ...tree.folders[0], icon: "PRIVATE_MARKER" }] })],
    ["the old place in the menu", (tree: Tree) => ({ ...tree, folders: [{ id: billing, parentId: null, name: "Facturación", revision: 1, menuPlacement: "Own", menuIcon: "truck" }] })],
    ["a name with spaces around", (tree: Tree) => ({ ...tree, folders: [{ ...tree.folders[0], name: " PRIVATE_MARKER " }] })],
    ["a name longer than 80", (tree: Tree) => ({ ...tree, folders: [{ ...tree.folders[0], name: "x".repeat(81) }] })],
  ])("rejects a tree with %s without disclosing it", (_case, change) => rejects(() => readFolderTree(change(syntheticTree()))));

  it("rejects a third level and a cycle", () => {
    const ids = Array.from({ length: 3 }, (_, index) => `0199a0c0-0000-7000-8000-00000000010${index}`);
    const three = ids.map((id, index) => syntheticFolder(id, index === 0 ? null : ids[index - 1], `Nivel ${index + 1}`));
    expect(readFolderTree({ folders: three.slice(0, 2), canManage: true }).folders).toHaveLength(2);
    rejects(() => readFolderTree({ folders: three, canManage: true }));
    rejects(() => readFolderTree({ folders: [syntheticFolder(billing, delivery, "A"), syntheticFolder(delivery, billing, "B")], canManage: true }));
  });

  it("reads the receipt of the folder it changed, the counts before deleting and the set of an item", () => {
    expect(readFolder(syntheticFolder(billing, null, "Facturación"), billing).id).toBe(billing);
    rejects(() => readFolder(syntheticFolder(billing, null, "Facturación"), delivery));
    expect(readFolderDeletion({ revision: 3, subfolderCount: 2, formCount: 5, catalogCount: 4 })).toEqual({ revision: 3, subfolderCount: 2, formCount: 5, catalogCount: 4 });
    rejects(() => readFolderDeletion({ revision: 0, subfolderCount: 0, formCount: 0, catalogCount: 0 }));
    expect(readItemFolders({ folderIds: [billing, north] }).folderIds).toEqual([billing, north]);
    rejects(() => readItemFolders({ folderIds: [billing, billing] }));
  });

  it("reads the forms of a folder: unique and up to the limit of the server", () => {
    expect(readFolderForms({ formIds: [form] })).toEqual({ formIds: [form] });
    expect(readFolderForms({ formIds: [] })).toEqual({ formIds: [] });
    rejects(() => readFolderForms({ formIds: [form, form] }));
    rejects(() => readFolderForms({ formIds: Array.from({ length: 1001 }, (_, index) => `0199a0c0-0000-7000-8000-${index.toString().padStart(12, "0")}`) }));
    rejects(() => readFolderForms({ formIds: [form], marker: "PRIVATE_MARKER" }));
  });

  it("reads the menu, with every folder and its catalogs for whoever administers and nothing empty for anyone else", () => {
    expect(readFormMenu(syntheticMenu())).toEqual(syntheticMenu());
    expect(readFormMenu({ canManage: false, menus: [] }).menus).toEqual([]);
    const empty = { folderId: sowing, name: "Siembra", icon: "leaf", revision: 1, catalogCount: 3, forms: [], groups: [{ folderId: north, name: "Norte", revision: 1, forms: [] }] };
    expect(readFormMenu({ canManage: true, menus: [empty] }).menus[0]).toEqual(empty);
    rejects(() => readFormMenu({ canManage: false, menus: [empty] }));
    rejects(() => readFormMenu({ canManage: false, menus: [{ ...empty, catalogCount: 0, groups: [] }] }));
    rejects(() => readFormMenu({ canManage: false, menus: [{ ...syntheticMenu().menus[0], catalogCount: 2 }] }));
    rejects(() => readFormMenu({ ...syntheticMenu(), menus: [{ ...syntheticMenu().menus[0], icon: "PRIVATE_MARKER" }] }));
    rejects(() => readFormMenu({ ...syntheticMenu(), menus: [{ ...syntheticMenu().menus[0], revision: 0 }] }));
    rejects(() => readFormMenu({ ...syntheticMenu(), marker: "PRIVATE_MARKER" }));
    // The groups in «Gestión de formularios» and «Administración» are gone.
    rejects(() => readFormMenu({ ...syntheticMenu(), forms: [], administration: [] }));
    rejects(() => readFormMenu({ menus: [], forms: [], administration: [] }));
  });

  it("sends each change to its route with the revision or the set it read", async () => {
    const seen: { method: string; url: string; body: unknown }[] = [];
    const record = async ({ request }: { request: Request }) => { seen.push({ method: request.method, url: new URL(request.url).pathname + new URL(request.url).search, body: request.method === "GET" ? null : await request.json() }); };
    server.use(
      http.get("/api/forms/folders", async info => { await record(info); return HttpResponse.json(syntheticTree()); }),
      http.post("/api/forms/folders", async info => { await record(info); return HttpResponse.json(syntheticFolder(north, delivery, "Norte")); }),
      http.put("/api/forms/folders/:id", async info => { await record(info); return HttpResponse.json({ ...syntheticFolder(billing, null, "Cobranzas", "receipt"), revision: 2 }); }),
      http.get("/api/forms/folders/:id/forms", async info => { await record(info); return HttpResponse.json({ formIds: [form] }); }),
      http.put("/api/forms/folders/:id/forms", async info => { await record(info); return HttpResponse.json({ formIds: [] }); }),
      http.delete("/api/forms/folders/:id", async info => { await record(info); return new HttpResponse(null, { status: 204 }); }),
      http.put("/api/forms/catalogs/:id/folders", async info => { await record(info); return HttpResponse.json({ folderIds: [north] }); }),
      http.get("/api/forms/menu", async info => { await record(info); return HttpResponse.json(syntheticMenu()); }),
    );
    await fetchFolderTree("catalogs");
    await createFolder({ parentId: delivery, name: "Norte" });
    await createFolder({ parentId: null, name: "Compras", icon: "package" });
    await updateFolder(billing, { expectedRevision: 1, name: "Cobranzas", parentId: null, icon: "receipt" });
    await fetchFolderForms(delivery);
    await saveFolderForms(delivery, { expectedFormIds: [form], formIds: [] });
    await deleteFolder(north, 4);
    await saveItemFolders("catalogs", form, { expectedFolderIds: [billing], folderIds: [north] });
    await fetchFormMenu();
    expect(seen).toEqual([
      { method: "GET", url: "/api/forms/folders?kind=catalogs", body: null },
      { method: "POST", url: "/api/forms/folders", body: { parentId: delivery, name: "Norte", icon: null } },
      { method: "POST", url: "/api/forms/folders", body: { parentId: null, name: "Compras", icon: "package" } },
      { method: "PUT", url: `/api/forms/folders/${billing}`, body: { expectedRevision: 1, name: "Cobranzas", parentId: null, icon: "receipt" } },
      { method: "GET", url: `/api/forms/folders/${delivery}/forms`, body: null },
      { method: "PUT", url: `/api/forms/folders/${delivery}/forms`, body: { expectedFormIds: [form], formIds: [] } },
      { method: "DELETE", url: `/api/forms/folders/${north}`, body: { expectedRevision: 4 } },
      { method: "PUT", url: `/api/forms/catalogs/${form}/folders`, body: { expectedFolderIds: [billing], folderIds: [north] } },
      { method: "GET", url: "/api/forms/menu", body: null },
    ]);
  });

  it("never composes a route with an id that is not a folder id", async () => {
    await expect(updateFolder("../users", { expectedRevision: 1, name: "x", parentId: null })).rejects.toThrowError("Invalid folder id.");
    await expect(fetchFolderForms("../users")).rejects.toThrowError("Invalid folder id.");
  });
});
