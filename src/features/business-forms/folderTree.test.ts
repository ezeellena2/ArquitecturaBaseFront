import { describe, expect, it } from "vitest";
import type { FormFolder } from "./api/folders";
import { menuIconNames } from "@/shared/ui/menuIcons";
import { ancestorIds, canAddSubfolder, firstFreeIcon, folderListQuery, folderPath, hasSubfolders, parseFolderParam, folderParamOf, treeOrder, withoutFolderParam } from "./folderTree";

const folder = (id: string, parentId: string | null, name = id, icon: FormFolder["icon"] = parentId === null ? "folder" : null): FormFolder => ({ id, parentId, name, revision: 1, icon });
// Facturación; Repartos > Norte, Sur; Siembra: two levels (CM1 a CM6).
const folders = [folder("billing", null, "Facturación", "receipt"), folder("delivery", null, "Repartos", "truck"), folder("north", "delivery", "Norte"), folder("south", "delivery", "Sur"),
  folder("sowing", null, "Siembra")];

describe("the folder tree", () => {
  it("keeps the server's alphabetical order and puts each folder under its parent", () => {
    expect(treeOrder(folders).map(entry => [entry.folder.id, entry.depth])).toEqual([["billing", 1], ["delivery", 1], ["north", 2], ["south", 2], ["sowing", 1]]);
    expect(treeOrder(folders).find(entry => entry.folder.id === "delivery")?.hasChildren).toBe(true);
    expect(treeOrder(folders).find(entry => entry.folder.id === "billing")?.hasChildren).toBe(false);
  });

  it("names a folder with the path from the top and knows its ancestors", () => {
    expect(folderPath(folders, "north")).toEqual(["Repartos", "Norte"]);
    expect(folderPath(folders, "missing")).toEqual([]);
    expect(ancestorIds(folders, "south")).toEqual(["delivery"]);
    expect(ancestorIds(folders, "billing")).toEqual([]);
  });

  it("has two levels: a subfolder only in a folder of the first level, and one with subfolders cannot go into another", () => {
    expect(canAddSubfolder(folders, "delivery")).toBe(true);
    expect(canAddSubfolder(folders, "billing")).toBe(true);
    expect(canAddSubfolder(folders, "north")).toBe(false);
    expect(hasSubfolders(folders, "delivery")).toBe(true);
    expect(hasSubfolders(folders, "billing")).toBe(false);
  });

  it("starts a new folder in the first icon that no folder of the first level uses, or the folder once all are taken", () => {
    // Repartos takes the truck and Facturación the receipt; Siembra the folder. A subfolder takes none.
    expect(firstFreeIcon(folders)).toBe("package");
    expect(firstFreeIcon([])).toBe("folder");
    expect(firstFreeIcon([folder("one", null, "Uno", "truck")])).toBe("folder");
    const all = menuIconNames.map((icon, index) => folder(`f${index}`, null, `Carpeta ${index}`, icon));
    expect(firstFreeIcon(all)).toBe("folder");
    expect(firstFreeIcon(all.filter(entry => entry.icon !== "leaf"))).toBe("leaf");
  });

  it("reads the folder of the address and turns it into the listing filter", () => {
    expect(parseFolderParam(null)).toEqual({ kind: "all" });
    expect(parseFolderParam(withoutFolderParam)).toEqual({ kind: "none" });
    expect(parseFolderParam("0199a0c0-0000-7000-8000-0000000000f1")).toEqual({ kind: "folder", id: "0199a0c0-0000-7000-8000-0000000000f1" });
    expect(parseFolderParam("../users")).toEqual({ kind: "all" });
    expect(folderListQuery({ kind: "all" })).toEqual({});
    expect(folderListQuery({ kind: "none" })).toEqual({ withoutFolder: true });
    expect(folderListQuery({ kind: "folder", id: "x" })).toEqual({ folderId: "x" });
    expect(folderParamOf({ kind: "all" })).toBeUndefined();
    expect(folderParamOf({ kind: "none" })).toBe(withoutFolderParam);
    expect(folderParamOf({ kind: "folder", id: "x" })).toBe("x");
  });
});
