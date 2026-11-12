import { describe, expect, it } from "vitest";
import type { PermissionGroup } from "../api/roles";
import { areaColumns, areaHelp, areaProgress, hasOtherPermissions, sameSelection, toggleArea } from "./permissionPicker";

// Las tres áreas del núcleo, con los textos del backend en español, más dos con permisos que no son ver ni
// administrar: una de ejemplo y la de IA, cuyo segundo par (`ai.business.*`) también termina en `.read` y `.manage`.
const users: PermissionGroup = {
  area: "users",
  name: "Usuarios",
  permissions: [
    { code: "users.read", name: "Ver usuarios", description: "El listado y el detalle de cada cuenta." },
    {
      code: "users.manage",
      name: "Administrar usuarios",
      description: "Dar de alta, editar, desactivar y eliminar cuentas.",
    },
  ],
};

const roles: PermissionGroup = {
  area: "roles",
  name: "Roles",
  permissions: [
    { code: "roles.read", name: "Ver roles", description: "Los roles y qué permisos da cada uno." },
    { code: "roles.manage", name: "Administrar roles", description: "Crear, editar y eliminar roles." },
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
    },
  ],
};

const billing: PermissionGroup = {
  area: "billing",
  name: "Facturación",
  permissions: [
    { code: "billing.read", name: "Ver comprobantes", description: "Facturas, notas de crédito y su estado." },
    { code: "billing.emit", name: "Emitir comprobantes", description: "Crear y enviar facturas." },
    { code: "billing.void", name: "Anular comprobantes", description: "Anular una factura ya emitida." },
  ],
};

const ai: PermissionGroup = {
  area: "ai",
  name: "Inteligencia artificial",
  permissions: [
    { code: "ai.read", name: "Ver conexión", description: "Consultar la configuración de IA sin ver su clave." },
    { code: "ai.manage", name: "Administrar conexión", description: "Configurar la conexión y probar el proveedor de IA." },
    { code: "ai.business.read", name: "Ver información del negocio", description: "Consultar los datos del negocio sin modificarlos." },
    { code: "ai.business.manage", name: "Administrar información del negocio", description: "Editar y guardar los datos del negocio." },
  ],
};

const codes = (items: readonly { code: string }[]) => items.map((item) => item.code);

describe("areaColumns", () => {
  it("puts the area's read and manage permissions in their columns and nothing else", () => {
    const columns = areaColumns(users);

    expect(columns.read?.code).toBe("users.read");
    expect(columns.manage?.code).toBe("users.manage");
    expect(columns.others).toEqual([]);
  });

  it("leaves a column empty when the area does not have that permission", () => {
    const columns = areaColumns(settings);

    expect(columns.read).toBeUndefined();
    expect(columns.manage?.code).toBe("settings.manage");
  });

  it("puts the rest in the other permissions, in the catalog order", () => {
    const columns = areaColumns(billing);

    expect(columns.read?.code).toBe("billing.read");
    expect(columns.manage).toBeUndefined();
    expect(codes(columns.others)).toEqual(["billing.emit", "billing.void"]);
  });

  it("only reads the area's own code: a second pair that also ends in read and manage goes to the others", () => {
    const columns = areaColumns(ai);

    expect(columns.read?.code).toBe("ai.read");
    expect(columns.manage?.code).toBe("ai.manage");
    expect(codes(columns.others)).toEqual(["ai.business.read", "ai.business.manage"]);
  });
});

describe("hasOtherPermissions", () => {
  it("is false when every permission is to read or to manage, as in the core without modules", () => {
    expect(hasOtherPermissions([users, roles, settings])).toBe(false);
  });

  it("is true when any area has another permission", () => {
    expect(hasOtherPermissions([users, billing])).toBe(true);
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
    expect(areaProgress(users, ["users.manage", "roles.read", "users.read"])).toEqual({
      picked: 2,
      total: 2,
      all: true,
    });
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

  it("adds a code only once when the area repeats it", () => {
    const read = { code: "users.read", name: "Ver usuarios", description: "El listado y el detalle de cada cuenta." };
    const repeated: PermissionGroup = { area: "users", name: "Usuarios", permissions: [read, read] };

    expect(toggleArea(repeated, [])).toEqual(["users.read"]);
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
