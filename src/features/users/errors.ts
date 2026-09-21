import { ApiError } from "@/shared/api/ApiError";

/// Firma mínima que necesitamos de `t`, la misma que usa `columns.tsx`: alcanza con la del namespace "users",
/// sin acoplar el tipo exacto de react-i18next, que cambia de versión en versión.
type Translate = (key: string, options?: Record<string, unknown>) => string;

/// El front decide por el `code`, que es estable, nunca por el texto. Las dos reglas que protegen al sistema
/// (sección 8 del spec de la Fase 4) se explican con lo que hay que hacer para destrabarlas, que es algo que
/// el backend no puede saber. El resto de los errores ya vienen traducidos del servidor.
export function userActionErrorMessage(error: unknown, t: Translate): string {
  if (!(error instanceof ApiError)) {
    return t("common:states.error");
  }

  if (error.isNetworkError) {
    return t("common:errors.network");
  }

  switch (error.code) {
    case "Users.User.AlreadyExists":
      return t("errors.alreadyExists");
    case "Users.User.LastAdmin":
      return t("errors.lastAdmin");
    case "Users.User.CannotModifySelf":
      return t("errors.cannotModifySelf");
    default:
      return error.detail ?? t("common:states.error");
  }
}
