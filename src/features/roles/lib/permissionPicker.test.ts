import { describe, expect, it } from "vitest";
import type { PermissionGroup } from "../api/roles";
import { allowedPermissions, areaHelp, areaProgress, areaStartsOpen, changePermission, includedBy, sameSelection, toggleArea } from "./permissionPicker";

// Las áreas del núcleo y la de Formularios, con los textos del backend en español y sus inclusiones: «Administrar»
// incluye «Ver», y en Formularios también «Publicar» incluye «Ver formularios».
const users: PermissionGroup = {
  area: "users",
  name: "Usuarios",
  permissions: [
    { code: "users.read", name: "Ver usuarios", description: "El listado y el detalle de cada cuenta.", includes: [] },
    {
      code: "users.manage",
      name: "Administrar usuarios",
      description: "Dar de alta, editar, desactivar y eliminar cuentas.",
      includes: ["users.read"],
    },
  ],
};

const roles: PermissionGroup = {
  area: "roles",
  name: "Roles",
  permissions: [
    { code: "roles.read", name: "Ver roles", description: "Los roles y qué permisos da cada uno.", includes: [] },
    { code: "roles.manage", name: "Administrar roles", description: "Crear, editar y eliminar roles.", includes: ["roles.read"] },
  ],
};

const settings: PermissionGroup = {
  area: "settings",
  name: "Configuración",
  permissions: [
    {
      code: "settings.manage",
      name: "Administrar la configuración",
      description: "El modo de registro y los ajustes del sistema.",
      includes: [],
    },
  ],
};

const forms: PermissionGroup = {
  area: "formtemplates",
  name: "Formularios",
  permissions: [
    { code: "formtemplates.read", name: "Ver formularios", description: "Consultar los formularios y sus borradores.", includes: [] },
    { code: "formtemplates.manage", name: "Administrar formularios", description: "Crear y editar borradores de formularios.", includes: ["formtemplates.read"] },
    { code: "formtemplates.publish", name: "Publicar formularios", description: "Publicar un formulario en WhatsApp.", includes: ["formtemplates.read"] },
  ],
};

// Un área de ejemplo con inclusiones en cadena: anular incluye emitir, y emitir incluye ver. Hoy ningún permiso real
// lo hace, pero lo que un rol permite sigue la cadena entera.
const billing: PermissionGroup = {
  area: "billing",
  name: "Facturación",
  permissions: [
    { code: "billing.read", name: "Ver comprobantes", description: "Facturas, notas de crédito y su estado.", includes: [] },
    { code: "billing.emit", name: "Emitir comprobantes", description: "Crear y enviar facturas.", includes: ["billing.read"] },
    { code: "billing.void", name: "Anular comprobantes", description: "Anular una factura ya emitida.", includes: ["billing.emit"] },
  ],
};

const catalog = [users, roles, settings, forms, billing];

describe("allowedPermissions", () => {
  it("adds what each picked permission includes", () => {
    expect(allowedPermissions(catalog, ["users.manage"])).toEqual(["users.manage", "users.read"]);
  });

  it("keeps the picked order when nothing is missing, so a saved role reads the same", () => {
    expect(allowedPermissions(catalog, ["users.read", "users.manage", "roles.read"])).toEqual(["users.read", "users.manage", "roles.read"]);
  });

  it("follows what is included in a chain", () => {
    expect(allowedPermissions(catalog, ["billing.void"])).toEqual(["billing.void", "billing.emit", "billing.read"]);
  });

  it("never returns a code twice, even when two picked permissions include the same one", () => {
    expect(allowedPermissions(catalog, ["formtemplates.manage", "formtemplates.publish", "formtemplates.manage"])).toEqual([
      "formtemplates.manage", "formtemplates.publish", "formtemplates.read",
    ]);
  });

  it("keeps a code the catalog does not declare, which the editor names before saving without it", () => {
    expect(allowedPermissions(catalog, ["reports.export", "users.manage"])).toEqual(["reports.export", "users.manage", "users.read"]);
  });
});

describe("includedBy", () => {
  it("names the picked permissions that include it, in the catalog order", () => {
    const picked = ["formtemplates.publish", "formtemplates.read", "formtemplates.manage"];

    expect(includedBy(catalog, picked, "formtemplates.read")).toEqual(["Administrar formularios", "Publicar formularios"]);
  });

  it("is empty when no picked permission includes it, and the permission can be changed", () => {
    expect(includedBy(catalog, ["users.read"], "users.read")).toEqual([]);
    expect(includedBy(catalog, ["users.read", "users.manage"], "users.manage")).toEqual([]);
  });
});

describe("changePermission", () => {
  it("adds a permission with what it includes", () => {
    expect(changePermission(catalog, ["roles.read"], "users.manage", true)).toEqual(["roles.read", "users.manage", "users.read"]);
  });

  it("removes only that permission: what it included stays picked", () => {
    expect(changePermission(catalog, ["users.manage", "users.read", "roles.read"], "users.manage", false)).toEqual(["users.read", "roles.read"]);
  });
});

describe("areaStartsOpen", () => {
  it("opens an area with something saved, even when nothing of it is picked any more", () => {
    expect(areaStartsOpen(users, ["users.read"], [])).toBe(true);
  });

  it("opens an area with something picked", () => {
    expect(areaStartsOpen(users, [], ["users.manage", "users.read"])).toBe(true);
  });

  it("leaves closed an area with nothing saved or picked, as every area of a new role", () => {
    expect(areaStartsOpen(users, ["roles.read"], ["roles.read", "settings.manage"])).toBe(false);
    expect(areaStartsOpen(users, [], [])).toBe(false);
  });
});

describe("areaHelp", () => {
  it("says what each permission of the area allows, one per line, in the catalog order", () => {
    expect(areaHelp(users)).toBe(
      "Ver usuarios — El listado y el detalle de cada cuenta.\n" +
        "Administrar usuarios — Dar de alta, editar, desactivar y eliminar cuentas.",
    );
  });
});

describe("areaProgress", () => {
  it("counts over every permission of the area", () => {
    expect(areaProgress(users, ["users.read", "roles.read"])).toEqual({ picked: 1, total: 2, all: false });
    expect(areaProgress(users, [])).toEqual({ picked: 0, total: 2, all: false });
  });

  it("says when every permission of the area is picked", () => {
    expect(areaProgress(users, ["users.manage", "roles.read", "users.read"])).toEqual({ picked: 2, total: 2, all: true });
  });
});

describe("toggleArea", () => {
  it("adds the missing permissions of the area without duplicating the picked ones", () => {
    expect(toggleArea(users, ["roles.read", "users.read"])).toEqual(["roles.read", "users.read", "users.manage"]);
  });

  it("removes every permission of the area when all were picked", () => {
    expect(toggleArea(users, ["users.read", "roles.read", "users.manage"])).toEqual(["roles.read"]);
  });

  it("never returns a code twice, even when the picked list repeats one", () => {
    expect(toggleArea(users, ["users.read", "users.read"])).toEqual(["users.read", "users.manage"]);
    expect(toggleArea(users, ["roles.read", "users.read", "roles.read", "users.manage"])).toEqual(["roles.read"]);
  });
});

describe("sameSelection", () => {
  it("compares the picked permissions as a set", () => {
    expect(sameSelection(["users.read", "roles.read"], ["roles.read", "users.read"])).toBe(true);
    expect(sameSelection([], [])).toBe(true);
  });

  it("tells apart different selections", () => {
    expect(sameSelection(["users.read"], ["users.read", "roles.read"])).toBe(false);
    expect(sameSelection(["users.read", "roles.read"], ["users.read"])).toBe(false);
    expect(sameSelection(["users.read"], ["roles.read"])).toBe(false);
  });
});
