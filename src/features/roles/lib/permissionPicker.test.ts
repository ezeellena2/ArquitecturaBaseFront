import { describe, expect, it } from "vitest";
import type { PermissionGroup } from "../api/roles";
import {
  areaProgress,
  initialOpenAreas,
  normalizeForSearch,
  pickedSummary,
  sameSelection,
  toggleArea,
  visibleAreas,
  type AreaSubset,
} from "./permissionPicker";

// Las tres áreas reales, con los textos del backend en español, más una de ejemplo del tablero: en el
// catálogo real cada permiso nombra a su área, así que sin ella no hay forma de ver que coincidir por el
// área muestra permisos que por su cuenta no coinciden.
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

const catalog = [users, roles, settings, billing];

/// Lo que se ve, reducido a cada área con sus códigos y en su orden, que es lo que importa comparar.
function codesOf(areas: readonly AreaSubset[]): [string, string[]][] {
  return areas.map((item) => [item.group.area, item.permissions.map((permission) => permission.code)]);
}

const everything: [string, string[]][] = [
  ["users", ["users.read", "users.manage"]],
  ["roles", ["roles.read", "roles.manage"]],
  ["settings", ["settings.manage"]],
  ["billing", ["billing.read", "billing.emit", "billing.void"]],
];

describe("normalizeForSearch", () => {
  it("trims, lowercases and drops the accents", () => {
    expect(normalizeForSearch("  Configuración ")).toBe("configuracion");
    expect(normalizeForSearch("ÁÉÍÓÚ Ü Ñ")).toBe("aeiou u n");
  });
});

describe("visibleAreas", () => {
  it("shows every area and permission when nothing filters", () => {
    expect(codesOf(visibleAreas(catalog, { query: "", onlyPicked: false, picked: [] }))).toEqual(everything);
  });

  it("does not filter with a query made only of spaces", () => {
    expect(codesOf(visibleAreas(catalog, { query: "   ", onlyPicked: false, picked: [] }))).toEqual(everything);
  });

  it("matches permission names regardless of case and surrounding spaces", () => {
    expect(codesOf(visibleAreas(catalog, { query: "  VER ", onlyPicked: false, picked: [] }))).toEqual([
      ["users", ["users.read"]],
      ["roles", ["roles.read"]],
      ["billing", ["billing.read"]],
    ]);
  });

  it("matches descriptions too", () => {
    expect(codesOf(visibleAreas(catalog, { query: "detalle", onlyPicked: false, picked: [] }))).toEqual([
      ["users", ["users.read"]],
    ]);
  });

  it("shows the whole area when its name matches, without minding the accents", () => {
    // Ningún permiso de Facturación dice "facturacion": se ven los tres porque coincide el área.
    expect(codesOf(visibleAreas(catalog, { query: "facturacion", onlyPicked: false, picked: [] }))).toEqual([
      ["billing", ["billing.read", "billing.emit", "billing.void"]],
    ]);
    expect(codesOf(visibleAreas(catalog, { query: "factura", onlyPicked: false, picked: [] }))).toEqual([
      ["billing", ["billing.read", "billing.emit", "billing.void"]],
    ]);
    expect(codesOf(visibleAreas(catalog, { query: "configuracion", onlyPicked: false, picked: [] }))).toEqual([
      ["settings", ["settings.manage"]],
    ]);
  });

  it("shows only the picked permissions and leaves out the areas without any", () => {
    expect(
      codesOf(visibleAreas(catalog, { query: "", onlyPicked: true, picked: ["settings.manage", "users.manage"] })),
    ).toEqual([
      ["users", ["users.manage"]],
      ["settings", ["settings.manage"]],
    ]);
  });

  it("combines the query with the picked filter", () => {
    expect(
      codesOf(visibleAreas(catalog, { query: "ver", onlyPicked: true, picked: ["users.read", "users.manage"] })),
    ).toEqual([["users", ["users.read"]]]);
  });

  it("returns no area when nothing matches", () => {
    expect(visibleAreas(catalog, { query: "auditoría", onlyPicked: false, picked: [] })).toEqual([]);
    expect(visibleAreas(catalog, { query: "", onlyPicked: true, picked: [] })).toEqual([]);
  });

  it("keeps the whole area next to the visible permissions", () => {
    // La píldora "N de M" y "Elegir todos" cuentan sobre el área entera, no sobre lo que se ve.
    const [area] = visibleAreas(catalog, { query: "detalle", onlyPicked: false, picked: [] });

    expect(area?.group).toBe(users);
    expect(area?.permissions).toHaveLength(1);
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

describe("pickedSummary", () => {
  it("groups the picked permissions by area in the catalog order and counts them", () => {
    const summary = pickedSummary(catalog, ["roles.read", "users.manage", "users.read"]);

    expect(codesOf(summary.groups)).toEqual([
      ["users", ["users.read", "users.manage"]],
      ["roles", ["roles.read"]],
    ]);
    expect(summary.permissions).toBe(3);
    expect(summary.areas).toBe(2);
  });

  it("is empty when nothing is picked", () => {
    expect(pickedSummary(catalog, [])).toEqual({ groups: [], permissions: 0, areas: 0 });
  });

  it("does not count codes that are not in the catalog", () => {
    // Un permiso que el backend ya no declara no tiene chip que mostrar, así que tampoco suma al conteo.
    const summary = pickedSummary(catalog, ["users.read", "reports.read"]);

    expect(summary.permissions).toBe(1);
    expect(summary.areas).toBe(1);
  });
});

describe("initialOpenAreas", () => {
  it("opens the areas that have something picked", () => {
    expect(initialOpenAreas(catalog, ["settings.manage", "roles.read"])).toEqual(["roles", "settings"]);
  });

  it("opens the first area when nothing is picked", () => {
    expect(initialOpenAreas(catalog, [])).toEqual(["users"]);
  });

  it("opens nothing when the catalog is empty", () => {
    expect(initialOpenAreas([], [])).toEqual([]);
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
