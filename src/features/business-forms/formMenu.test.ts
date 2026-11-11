import { describe, expect, it } from "vitest";
import type { FormMenu } from "./api/folders";
import { menuFormPath, shapeFormMenu } from "./formMenu";

const menu: FormMenu = {
  menus: [{ folderId: "delivery", name: "Repartos", icon: "truck", forms: [{ id: "route", name: "Hoja de ruta" }], groups: [{ folderId: "north", name: "Norte", forms: [{ id: "visit", name: "Visita" }] }] }],
  forms: [{ folderId: "sowing", name: "Siembra", forms: [{ id: "lot", name: "Lote" }] }],
  administration: [{ folderId: "billing", name: "Facturación", forms: [{ id: "invoice", name: "Factura" }] }],
};

describe("the folders in the side menu", () => {
  it("opens the sheet to whoever sees or decides responses, and the entry to whoever only loads", () => {
    expect(menuFormPath("route", ["formrecords.read"])).toBe("/formularios/route/respuestas");
    expect(menuFormPath("route", ["formapprovals.decide", "formrecords.create"])).toBe("/formularios/route/respuestas");
    expect(menuFormPath("route", ["formrecords.create"])).toBe("/formularios/route/cargar");
    expect(menuFormPath("route", ["formtemplates.manage"])).toBeNull();
  });

  it("keeps the server's order and puts each form's destination in its link", () => {
    expect(shapeFormMenu(menu, ["formrecords.create"])).toEqual({
      sections: [{ id: "delivery", label: "Repartos", icon: "truck", links: [{ id: "route", label: "Hoja de ruta", to: "/formularios/route/cargar" }],
        groups: [{ id: "north", label: "Norte", links: [{ id: "visit", label: "Visita", to: "/formularios/visit/cargar" }] }] }],
      formsGroups: [{ id: "sowing", label: "Siembra", links: [{ id: "lot", label: "Lote", to: "/formularios/lot/cargar" }] }],
      administrationGroups: [{ id: "billing", label: "Facturación", links: [{ id: "invoice", label: "Factura", to: "/formularios/invoice/cargar" }] }],
    });
  });

  it("shows nothing to whoever cannot open forms", () => {
    expect(shapeFormMenu(menu, ["formtemplates.read"])).toEqual({ sections: [], formsGroups: [], administrationGroups: [] });
  });
});
