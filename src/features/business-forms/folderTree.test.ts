import { describe, expect, it } from "vitest";
import type { FormFolder } from "./api/folders";
import { ancestorIds, canAddSubfolder, folderListQuery, folderPath, moveTargets, parseFolderParam, folderParamOf, treeOrder, withoutFolderParam } from "./folderTree";

const folder = (id: string, parentId: string | null, name = id): FormFolder => ({ id, parentId, name, revision: 1, menuPlacement: "None", menuIcon: null });
// Facturación; Repartos > Norte > Rosario > Centro > Plaza (five levels); Siembra.
const folders = [folder("billing", null, "Facturación"), folder("delivery", null, "Repartos"), folder("north", "delivery", "Norte"), folder("rosario", "north", "Rosario"),
  folder("center", "rosario", "Centro"), folder("square", "center", "Plaza"), folder("sowing", null, "Siembra")];

describe("the folder tree", () => {
  it("keeps the server's alphabetical order and puts each folder under its parent", () => {
    expect(treeOrder(folders).map(entry => [entry.folder.id, entry.depth])).toEqual([
      ["billing", 1], ["delivery", 1], ["north", 2], ["rosario", 3], ["center", 4], ["square", 5], ["sowing", 1]]);
    expect(treeOrder(folders).find(entry => entry.folder.id === "delivery")?.hasChildren).toBe(true);
    expect(treeOrder(folders).find(entry => entry.folder.id === "billing")?.hasChildren).toBe(false);
  });

  it("names a folder with the path from the top and knows its ancestors", () => {
    expect(folderPath(folders, "rosario")).toEqual(["Repartos", "Norte", "Rosario"]);
    expect(folderPath(folders, "missing")).toEqual([]);
    expect(ancestorIds(folders, "center")).toEqual(["delivery", "north", "rosario"]);
    expect(ancestorIds(folders, "billing")).toEqual([]);
  });

  it("turns off adding a subfolder on the fifth level", () => {
    expect(canAddSubfolder(folders, "center")).toBe(true);
    expect(canAddSubfolder(folders, "square")).toBe(false);
    expect(canAddSubfolder(folders, "billing")).toBe(true);
  });

  it("moves anywhere but into itself, into its subfolders or past five levels", () => {
    // Norte carries four levels (Norte, Rosario, Centro, Plaza): it fits at the top or under a top folder.
    expect(moveTargets(folders, "north").map(target => target.id)).toEqual([null, "billing", "delivery", "sowing"]);
    // A leaf goes under anything of four levels or less.
    expect(moveTargets(folders, "billing").map(target => target.id)).toEqual([null, "delivery", "north", "rosario", "center", "sowing"]);
    expect(moveTargets(folders, "square").find(target => target.id === "square")).toBeUndefined();
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
