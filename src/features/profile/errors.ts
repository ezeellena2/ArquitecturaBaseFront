import { ApiError } from "@/shared/api/ApiError";

/// Firma mínima que hace falta de `t` (la del namespace "profile"), sin acoplar el tipo exacto de react-i18next.
type Translate = (key: string, options?: Record<string, unknown>) => string;

/// El front decide por el `code`, nunca por el texto. Los errores del código (equivocado, vencido, sin intentos,
/// demasiados pedidos) son los mismos que en el ingreso y viven en `shared/api/codeErrors`. Acá queda lo que es del
/// perfil.

export { isTakenError, isSpentCodeError } from "@/shared/api/destinationErrors";

/// Un error de algo que se confirmó en un `ConfirmDialog` (desvincular): va a un aviso, porque el diálogo ya se cerró.
/// `Users.User.LastLoginMethod` trae en su `detail` qué hacer para destrabarlo ("primero agregá un correo").
export function profileActionErrorMessage(error: unknown, t: Translate): string {
  if (!(error instanceof ApiError)) {
    return t("common:states.error");
  }

  if (error.isNetworkError) {
    return t("common:errors.network");
  }

  return error.detail ?? t("common:states.error");
}
