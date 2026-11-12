import type { PermissionGroup, PermissionItem } from "../api/roles";

export interface AreaProgress {
  readonly picked: number;
  readonly total: number;
  /// Si ya están todos: la casilla del área pasa de "Elegir todos" a "Quitar todos".
  readonly all: boolean;
}

/// Las columnas de un área en la matriz (RO1-A): «Ver» es `<área>.read`, «Administrar» es `<área>.manage` y lo demás
/// (publicar, exportar, emitir, responder chats…) va en «Otros permisos», en el orden del catálogo. Sólo cuenta el código
/// del área: el segundo par de IA (`ai.business.read` y `ai.business.manage`) también termina en `.read` y `.manage`,
/// y va en otros permisos con su nombre.
export interface AreaColumns {
  readonly read: PermissionItem | undefined;
  readonly manage: PermissionItem | undefined;
  readonly others: readonly PermissionItem[];
}

export function areaColumns(group: PermissionGroup): AreaColumns {
  const read = group.permissions.find((permission) => permission.code === `${group.area}.read`);
  const manage = group.permissions.find((permission) => permission.code === `${group.area}.manage`);

  return { read, manage, others: group.permissions.filter((permission) => permission !== read && permission !== manage) };
}

/// Si alguna área tiene otros permisos. Sin módulos, todo es ver o administrar y la columna no aparece.
export function hasOtherPermissions(groups: readonly PermissionGroup[]): boolean {
  return groups.some((group) => areaColumns(group).others.length > 0);
}

/// La (i) del área: qué permite cada uno de sus permisos, uno por renglón. La matriz no tiene lugar para la descripción
/// de cada permiso, y una leyenda debajo de cada fila es justo lo que no va (sin leyendas, 2026-10-31).
export function areaHelp(group: PermissionGroup): string {
  return group.permissions.map((permission) => `${permission.name} — ${permission.description}`).join("\n");
}

/// Cuántos permisos del área están elegidos, sobre todos los suyos.
export function areaProgress(group: PermissionGroup, picked: readonly string[]): AreaProgress {
  const pickedCodes = new Set(picked);
  const count = group.permissions.filter((permission) => pickedCodes.has(permission.code)).length;

  return { picked: count, total: group.permissions.length, all: count === group.permissions.length };
}

/// "Elegir todos" y "Quitar todos": si el área ya tiene todos elegidos, los saca; si no, suma los que faltan.
/// Actúa sobre todos los permisos del área y deja lo demás como estaba.
///
/// Lo que devuelve no repite códigos, aunque los elegidos o el área los repitan. Con los datos de hoy no pasa
/// (el catálogo sale de `Permissions.All` y el backend guarda cada permiso una vez), pero el `Set` hace que
/// esta función no dependa de eso.
export function toggleArea(group: PermissionGroup, picked: readonly string[]): string[] {
  const codes = group.permissions.map((permission) => permission.code);
  const next = areaProgress(group, picked).all
    ? picked.filter((code) => !codes.includes(code))
    : [...picked, ...codes];

  return [...new Set(next)];
}

/// Si dos listas de permisos son el mismo conjunto. El orden en que se marcaron no es un cambio: es lo que
/// permite que desmarcar y volver a marcar un permiso deje la pantalla sin cambios sin guardar.
export function sameSelection(first: readonly string[], second: readonly string[]): boolean {
  const firstCodes = new Set(first);
  const secondCodes = new Set(second);

  return firstCodes.size === secondCodes.size && [...firstCodes].every((code) => secondCodes.has(code));
}
