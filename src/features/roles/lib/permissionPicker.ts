import type { PermissionGroup } from "../api/roles";

export interface AreaProgress {
  readonly picked: number;
  readonly total: number;
  /// Si ya están todos: la casilla del área pasa de "Elegir todos" a "Quitar todos".
  readonly all: boolean;
}

/// Lo que un rol permite de verdad: lo elegido más lo que incluye cada permiso, en cadena («Administrar usuarios» incluye
/// «Ver usuarios»). La lista de qué incluye cada uno la manda el backend en el catálogo; el front no la repite.
///
/// Conserva el orden de lo elegido y suma lo que falta al final, así un rol que ya tenía todo se lee igual y no aparece
/// un cambio sin guardar. Un código que el catálogo no declara queda como está: el editor lo nombra antes de guardar sin él
/// (B2).
export function allowedPermissions(groups: readonly PermissionGroup[], picked: readonly string[]): string[] {
  const includes = new Map(groups.flatMap((group) => group.permissions.map((permission) => [permission.code, permission.includes] as const)));
  const allowed = [...new Set(picked)];
  const codes = new Set(allowed);

  // La lista crece mientras se recorre: lo incluido también suma lo suyo.
  for (let index = 0; index < allowed.length; index++) {
    for (const code of includes.get(allowed[index]) ?? []) {
      if (!codes.has(code)) {
        codes.add(code);
        allowed.push(code);
      }
    }
  }

  return allowed;
}

/// Quién incluye a un permiso marcado: los nombres de los marcados que lo incluyen, en el orden del catálogo. Mientras
/// alguno lo incluye, su casilla queda marcada y apagada con ese motivo; vacío, se puede tocar.
export function includedBy(groups: readonly PermissionGroup[], picked: readonly string[], code: string): string[] {
  const pickedCodes = new Set(picked);

  return groups.flatMap((group) => group.permissions)
    .filter((permission) => permission.code !== code && pickedCodes.has(permission.code) && permission.includes.includes(code))
    .map((permission) => permission.name);
}

/// Marcar un permiso suma lo que incluye; desmarcarlo saca sólo ese, y lo que incluía queda marcado y vuelve a poder tocarse.
export function changePermission(groups: readonly PermissionGroup[], picked: readonly string[], code: string, checked: boolean): string[] {
  return checked ? allowedPermissions(groups, [...picked, code]) : picked.filter((item) => item !== code);
}

/// Si un área arranca abierta (RO3-D): la que tiene algo en lo guardado o en lo elegido. Lo guardado la deja abierta aunque
/// se le quite todo, para que lo quitado siga a la vista. Cuando la persona abre o cierra un área, manda lo que eligió.
export function areaStartsOpen(group: PermissionGroup, saved: readonly string[], picked: readonly string[]): boolean {
  return group.permissions.some((permission) => saved.includes(permission.code) || picked.includes(permission.code));
}

/// La (i) del área: qué permite cada uno de sus permisos, uno por renglón. La lista muestra sólo el nombre de cada permiso,
/// y una leyenda debajo de cada fila es justo lo que no va (sin leyendas, 2026-10-31).
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
/// Actúa sobre todos los permisos del área y deja lo demás como estaba; lo que incluyen lo suma quien la usa.
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
