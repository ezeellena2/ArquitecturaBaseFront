import { describe, expect, it } from "vitest";
import type { FormMenu } from "./api/folders";
import { menuFolders, menuFormPath, shapeFormMenu } from "./formMenu";

const menu: FormMenu = {
  canManage: true,
  menus: [
    { folderId: "delivery", name: "Repartos", icon: "truck", revision: 3, catalogCount: 2, forms: [{ id: "route", name: "Hoja de ruta" }],
      groups: [{ folderId: "north", name: "Norte", revision: 1, forms: [{ id: "visit", name: "Visita" }] }, { folderId: "south", name: "Sur", revision: 2, forms: [] }] },
    { folderId: "purchases", name: "Compras", icon: "package", revision: 1, catalogCount: 0, forms: [], groups: [] },
  ],
};

describe("the folders in the side menu (CM1)", () => {
  it("opens the sheet to whoever sees or decides responses, the entry to whoever only loads and the design to whoever only administers", () => {
    expect(menuFormPath("route", ["formrecords.read"])).toBe("/formularios/route/respuestas");
    expect(menuFormPath("route", ["formapprovals.decide", "formrecords.create", "formtemplates.manage"])).toBe("/formularios/route/respuestas");
    expect(menuFormPath("route", ["formrecords.create", "formtemplates.manage"])).toBe("/formularios/route/cargar");
    expect(menuFormPath("route", ["formtemplates.read", "formtemplates.manage"])).toBe("/formularios/route");
    expect(menuFormPath("route", ["formtemplates.read"])).toBe("/formularios/route");
    expect(menuFormPath("route", ["formcatalogs.manage"])).toBeNull();
  });

  it("keeps the server's order, the revisions and the catalogs, and puts each form's destination in its link", () => {
    expect(shapeFormMenu(menu, ["formrecords.create"])).toEqual({
      canManage: true,
      menus: [
        { id: "delivery", label: "Repartos", icon: "truck", revision: 3, catalogCount: 2, links: [{ id: "route", label: "Hoja de ruta", to: "/formularios/route/cargar" }],
          groups: [{ id: "north", label: "Norte", revision: 1, links: [{ id: "visit", label: "Visita", to: "/formularios/visit/cargar" }] }, { id: "south", label: "Sur", revision: 2, links: [] }] },
        { id: "purchases", label: "Compras", icon: "package", revision: 1, catalogCount: 0, links: [], groups: [] },
      ],
    });
  });

  it("leaves out the forms the person cannot open", () => {
    expect(shapeFormMenu(menu, ["formcatalogs.manage"]).menus[0].links).toEqual([]);
  });

  it("hands the menu to the folder dialogs as folders of two levels, with the icon only in the first", () => {
    expect(menuFolders(shapeFormMenu(menu, ["formrecords.read"]))).toEqual([
      { id: "delivery", parentId: null, name: "Repartos", revision: 3, icon: "truck" },
      { id: "north", parentId: "delivery", name: "Norte", revision: 1, icon: null },
      { id: "south", parentId: "delivery", name: "Sur", revision: 2, icon: null },
      { id: "purchases", parentId: null, name: "Compras", revision: 1, icon: "package" },
    ]);
  });
});
