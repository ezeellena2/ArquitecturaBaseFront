import type { PermissionGroup, PermissionItem } from "../api/roles";

/// Un área con una parte de sus permisos: los que se ven con la búsqueda y el filtro puestos
/// (`visibleAreas`) o los elegidos (`pickedSummary`). `group` es siempre el área entera, porque la píldora
/// "N de M" y "Elegir todos" cuentan sobre todos sus permisos, se vean o no.
export interface AreaSubset {
  readonly group: PermissionGroup;
  readonly permissions: readonly PermissionItem[];
}

export interface PickerFilter {
  readonly query: string;
  /// El segmentado "Elegidos": solo los permisos marcados.
  readonly onlyPicked: boolean;
  readonly picked: readonly string[];
}

export interface AreaProgress {
  readonly picked: number;
  readonly total: number;
  /// Si ya están todos: el botón del área pasa de "Elegir todos" a "Quitar todos".
  readonly all: boolean;
}

export interface PickedSummary {
  /// Las áreas con algún elegido, en el orden del catálogo, cada una con sus elegidos.
  readonly groups: readonly AreaSubset[];
  readonly permissions: number;
  readonly areas: number;
}

/// El texto con el que se compara una búsqueda: recortado, en minúsculas y sin tildes, así "factura"
/// encuentra "Facturación" y "configuracion", "Configuración". `NFD` separa cada letra de su tilde, y lo que
/// se saca son esas marcas.
export function normalizeForSearch(text: string): string {
  return text.trim().normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
}

/// Las áreas que se ven y, de cada una, sus permisos visibles. La búsqueda coincide con el nombre del área,
/// el del permiso o su descripción, y si coincide el área se ven todos sus permisos. "Elegidos" deja solo los
/// marcados y se combina con la búsqueda. Un área sin nada a la vista no aparece.
///
/// Una búsqueda de solo espacios queda vacía al normalizarla, y el texto vacío está en cualquier texto: no
/// filtra, que es lo que se espera de un buscador en el que quedó un espacio.
export function visibleAreas(groups: readonly PermissionGroup[], filter: PickerFilter): AreaSubset[] {
  const query = normalizeForSearch(filter.query);
  const picked = new Set(filter.picked);
  const matches = (text: string) => normalizeForSearch(text).includes(query);

  return groups
    .map((group) => {
      const areaMatches = matches(group.name);

      const permissions = group.permissions.filter(
        (permission) =>
          (areaMatches || matches(permission.name) || matches(permission.description)) &&
          (!filter.onlyPicked || picked.has(permission.code)),
      );

      return { group, permissions };
    })
    .filter((area) => area.permissions.length > 0);
}

/// Cuántos permisos del área están elegidos, sobre todos los suyos y no sobre los que se ven.
export function areaProgress(group: PermissionGroup, picked: readonly string[]): AreaProgress {
  const pickedCodes = new Set(picked);
  const count = group.permissions.filter((permission) => pickedCodes.has(permission.code)).length;

  return { picked: count, total: group.permissions.length, all: count === group.permissions.length };
}

/// "Elegir todos" y "Quitar todos": si el área ya tiene todos elegidos, los saca; si no, suma los que faltan.
/// Actúa sobre todos los permisos del área, estén o no a la vista, y deja lo demás como estaba.
export function toggleArea(group: PermissionGroup, picked: readonly string[]): string[] {
  const codes = group.permissions.map((permission) => permission.code);

  if (areaProgress(group, picked).all) {
    return picked.filter((code) => !codes.includes(code));
  }

  return [...picked, ...codes.filter((code) => !picked.includes(code))];
}

/// Lo que va a poder hacer el rol: los elegidos por área, que es lo mismo que muestra el filtro "Elegidos"
/// sin búsqueda. Cuenta lo que el catálogo conoce: un código que el backend ya no declara no tiene chip que
/// mostrar, y un conteo que no coincide con los chips no se puede explicar.
export function pickedSummary(groups: readonly PermissionGroup[], picked: readonly string[]): PickedSummary {
  const pickedGroups = visibleAreas(groups, { query: "", onlyPicked: true, picked });

  return {
    groups: pickedGroups,
    permissions: pickedGroups.reduce((total, area) => total + area.permissions.length, 0),
    areas: pickedGroups.length,
  };
}

/// Las áreas que arrancan abiertas: las que tienen algún elegido, que es lo que se viene a revisar. Sin
/// ninguno, como en un rol nuevo, la primera, para que la pantalla no arranque con todo cerrado.
export function initialOpenAreas(groups: readonly PermissionGroup[], picked: readonly string[]): string[] {
  const withPicked = pickedSummary(groups, picked).groups.map((area) => area.group.area);

  return withPicked.length > 0 ? withPicked : groups.slice(0, 1).map((group) => group.area);
}

/// Si dos listas de permisos son el mismo conjunto. El orden en que se marcaron no es un cambio: es lo que
/// permite que desmarcar y volver a marcar un permiso deje la pantalla sin cambios sin guardar.
export function sameSelection(first: readonly string[], second: readonly string[]): boolean {
  const firstCodes = new Set(first);
  const secondCodes = new Set(second);

  return firstCodes.size === secondCodes.size && [...firstCodes].every((code) => secondCodes.has(code));
}
