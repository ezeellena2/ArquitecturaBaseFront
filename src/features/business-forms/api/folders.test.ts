import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";
import { server } from "@/test/mocks/server";
import { createFolder, deleteFolder, fetchFolderTree, fetchFormMenu, readFolder, readFolderDeletion, readFolderTree, readFormMenu, readItemFolders, saveItemFolders, setFolderMenu, updateFolder, UnsupportedFolderResponse } from "./folders";

// Synthetic DTO examples for the guards' behavior; the HTTP contract test consumes the backend capture separately.
const billing = "0199a0c0-0000-7000-8000-0000000000f1";
const delivery = "0199a0c0-0000-7000-8000-0000000000f2";
const north = "0199a0c0-0000-7000-8000-0000000000f3";
const form = "0199a0c0-0000-7000-8000-0000000000a1";
function syntheticFolder(id: string, parentId: string | null, name: string) {
  return { id, parentId, name, revision: 1, menuPlacement: "None" as string, menuIcon: null as string | null };
}
function syntheticTree() {
  return { folders: [syntheticFolder(billing, null, "Facturación"), syntheticFolder(delivery, null, "Repartos"), syntheticFolder(north, delivery, "Norte")], canManage: true };
}
function syntheticMenu() {
  return {
    menus: [{ folderId: delivery, name: "Repartos", icon: "truck", forms: [{ id: form, name: "Hoja de ruta" }], groups: [{ folderId: north, name: "Norte", forms: [{ id: form, name: "Hoja de ruta" }] }] }],
    forms: [] as unknown[], administration: [{ folderId: billing, name: "Facturación", forms: [{ id: form, name: "Hoja de ruta" }] }],
  };
}
function rejects(read: () => unknown) {
  expect(read).toThrowError(UnsupportedFolderResponse);
  try { read(); } catch (error) { expect(String(error)).not.toContain("PRIVATE_MARKER"); }
}

describe("folder contracts", () => {
  it("reads a tree whose parents are in it, and the place in the menu with its icon", () => {
    const tree = syntheticTree();
    tree.folders[1] = { ...tree.folders[1], menuPlacement: "Own", menuIcon: "truck" };
    expect(readFolderTree(tree)).toEqual(tree);
    expect(readFolderTree({ folders: [], canManage: false })).toEqual({ folders: [], canManage: false });
  });

  it.each([
    ["an unknown member", (tree: ReturnType<typeof syntheticTree>) => ({ ...tree, marker: "PRIVATE_MARKER" })],
    ["an unknown folder member", (tree: ReturnType<typeof syntheticTree>) => ({ ...tree, folders: [{ ...tree.folders[0], marker: "PRIVATE_MARKER" }] })],
    ["a parent that is not in the tree", (tree: ReturnType<typeof syntheticTree>) => ({ ...tree, folders: tree.folders.slice(2) })],
    ["a repeated folder", (tree: ReturnType<typeof syntheticTree>) => ({ ...tree, folders: [...tree.folders, tree.folders[0]] })],
    ["an icon without a menu of its own", (tree: ReturnType<typeof syntheticTree>) => ({ ...tree, folders: [{ ...tree.folders[0], menuIcon: "truck" }] })],
    ["a menu of its own without icon", (tree: ReturnType<typeof syntheticTree>) => ({ ...tree, folders: [{ ...tree.folders[0], menuPlacement: "Own" }] })],
    ["an icon out of the list", (tree: ReturnType<typeof syntheticTree>) => ({ ...tree, folders: [{ ...tree.folders[0], menuPlacement: "Own", menuIcon: "PRIVATE_MARKER" }] })],
    ["a name with spaces around", (tree: ReturnType<typeof syntheticTree>) => ({ ...tree, folders: [{ ...tree.folders[0], name: " PRIVATE_MARKER " }] })],
    ["a name longer than 80", (tree: ReturnType<typeof syntheticTree>) => ({ ...tree, folders: [{ ...tree.folders[0], name: "x".repeat(81) }] })],
  ])("rejects a tree with %s without disclosing it", (_case, change) => rejects(() => readFolderTree(change(syntheticTree()))));

  it("rejects a sixth level and a cycle", () => {
    const ids = Array.from({ length: 6 }, (_, index) => `0199a0c0-0000-7000-8000-00000000010${index}`);
    const six = ids.map((id, index) => syntheticFolder(id, index === 0 ? null : ids[index - 1], `Nivel ${index + 1}`));
    expect(readFolderTree({ folders: six.slice(0, 5), canManage: true }).folders).toHaveLength(5);
    rejects(() => readFolderTree({ folders: six, canManage: true }));
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

  it("reads the menu and rejects anything empty or unknown", () => {
    expect(readFormMenu(syntheticMenu())).toEqual(syntheticMenu());
    expect(readFormMenu({ menus: [], forms: [], administration: [] }).menus).toEqual([]);
    rejects(() => readFormMenu({ ...syntheticMenu(), administration: [{ folderId: billing, name: "Facturación", forms: [] }] }));
    rejects(() => readFormMenu({ ...syntheticMenu(), menus: [{ folderId: delivery, name: "Repartos", icon: "truck", forms: [], groups: [] }] }));
    rejects(() => readFormMenu({ ...syntheticMenu(), menus: [{ ...syntheticMenu().menus[0], icon: "PRIVATE_MARKER" }] }));
    rejects(() => readFormMenu({ ...syntheticMenu(), marker: "PRIVATE_MARKER" }));
  });

  it("sends each change to its route with the revision it read", async () => {
    const seen: { method: string; url: string; body: unknown }[] = [];
    const record = async ({ request }: { request: Request }) => { seen.push({ method: request.method, url: new URL(request.url).pathname + new URL(request.url).search, body: request.method === "GET" ? null : await request.json() }); };
    server.use(
      http.get("/api/forms/folders", async info => { await record(info); return HttpResponse.json(syntheticTree()); }),
      http.post("/api/forms/folders", async info => { await record(info); return HttpResponse.json(syntheticFolder(north, delivery, "Norte")); }),
      http.put("/api/forms/folders/:id", async info => { await record(info); return HttpResponse.json({ ...syntheticFolder(billing, null, "Cobranzas"), revision: 2 }); }),
      http.put("/api/forms/folders/:id/menu", async info => { await record(info); return HttpResponse.json({ ...syntheticFolder(delivery, null, "Repartos"), revision: 2, menuPlacement: "Own", menuIcon: "truck" }); }),
      http.delete("/api/forms/folders/:id", async info => { await record(info); return new HttpResponse(null, { status: 204 }); }),
      http.put("/api/forms/catalogs/:id/folders", async info => { await record(info); return HttpResponse.json({ folderIds: [north] }); }),
      http.get("/api/forms/menu", async info => { await record(info); return HttpResponse.json(syntheticMenu()); }),
    );
    await fetchFolderTree("catalogs");
    await createFolder({ parentId: delivery, name: "Norte" });
    await updateFolder(billing, { expectedRevision: 1, name: "Cobranzas", parentId: null });
    await setFolderMenu(delivery, { expectedRevision: 1, placement: "Own", icon: "truck" });
    await deleteFolder(north, 4);
    await saveItemFolders("catalogs", form, { expectedFolderIds: [billing], folderIds: [north] });
    await fetchFormMenu();
    expect(seen).toEqual([
      { method: "GET", url: "/api/forms/folders?kind=catalogs", body: null },
      { method: "POST", url: "/api/forms/folders", body: { parentId: delivery, name: "Norte" } },
      { method: "PUT", url: `/api/forms/folders/${billing}`, body: { expectedRevision: 1, name: "Cobranzas", parentId: null } },
      { method: "PUT", url: `/api/forms/folders/${delivery}/menu`, body: { expectedRevision: 1, placement: "Own", icon: "truck" } },
      { method: "DELETE", url: `/api/forms/folders/${north}`, body: { expectedRevision: 4 } },
      { method: "PUT", url: `/api/forms/catalogs/${form}/folders`, body: { expectedFolderIds: [billing], folderIds: [north] } },
      { method: "GET", url: "/api/forms/menu", body: null },
    ]);
  });

  it("never composes a route with an id that is not a folder id", async () => {
    await expect(updateFolder("../users", { expectedRevision: 1, name: "x", parentId: null })).rejects.toThrowError("Invalid folder id.");
  });
});
