import { ApiError } from "@/shared/api/ApiError";

/// Firma mínima que necesitamos de `t`, la misma que usa `columns.tsx` en la feature de usuarios.
type Translate = (key: string, options?: Record<string, unknown>) => string;

/// El front decide por el `code`, que es estable, nunca por el texto. `Roles.HasUsers` es la excepción a
/// escribir el texto acá, y es a propósito: el backend dice **cuántos** usuarios tiene el rol, que es justo el
/// dato que hace falta para poder reasignarlos, y el front no lo sabe.
export function roleActionErrorMessage(error: unknown, t: Translate): string {
  if (!(error instanceof ApiError)) {
    return t("common:states.error");
  }

  if (error.isNetworkError) {
    return t("common:errors.network");
  }

  switch (error.code) {
    case "Roles.Role.AlreadyExists":
      return t("errors.alreadyExists");
    case "Roles.Role.SystemRoleCannotChange":
      return t("errors.systemRole");
    default:
      return error.detail ?? t("common:states.error");
  }
}
