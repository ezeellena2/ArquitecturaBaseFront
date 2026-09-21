import { ApiError } from "@/shared/api/ApiError";

/// Firma mínima que necesitamos de `t`, la misma que usa `columns.tsx` en la feature de usuarios.
type Translate = (key: string, options?: Record<string, unknown>) => string;

/// El front decide por el `code`, que es estable, nunca por el texto. `Roles.Role.HasUsers` es el caso
/// especial: el `detail` del backend es genérico, pero el ProblemDetails trae `userCount` como extensión, que
/// es justo el dato que hace falta para poder reasignar a esa gente antes de borrar el rol. El texto con el
/// número se arma acá, porque es el front el que sabe pluralizar en el idioma de la interfaz.
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
    case "Roles.Role.HasUsers": {
      // Si el metadato no vino (una versión vieja del backend, o un intermediario que lo sacó), queda el
      // texto del servidor, que ya viene traducido: peor sería inventar un número.
      const userCount = error.problem.userCount;

      return typeof userCount === "number"
        ? t("errors.hasUsers", { count: userCount })
        : (error.detail ?? t("common:states.error"));
    }
    default:
      return error.detail ?? t("common:states.error");
  }
}
