import { ApiError } from "@/shared/api/ApiError";

/// Firma mínima que hace falta de `t` (la del namespace "profile"), sin acoplar el tipo exacto de react-i18next.
type Translate = (key: string, options?: Record<string, unknown>) => string;

/// El front decide por el `code`, nunca por el texto. Los errores del código (equivocado, vencido, sin intentos,
/// demasiados pedidos) son los mismos que en el ingreso y viven en `shared/api/codeErrors`. Acá queda lo que es del
/// perfil.

/// El número o el correo ya es de otra cuenta. Llega recién con el código correcto, que queda gastado: decirlo antes
/// le contaría a cualquiera qué números y correos están registrados.
export function isTakenError(error: ApiError): boolean {
  return error.code === "Users.Phone.AlreadyExists" || error.code === "Users.User.AlreadyExists";
}

/// Este código ya no sirve, aunque se escriba bien: hay que pedir otro. Un vencido o ya usado no entra acá, igual que
/// en el ingreso: el mensaje del servidor ya dice que hay que pedir uno nuevo, y el reenvío es el mismo botón.
export function isSpentCodeError(error: ApiError): boolean {
  return error.code === "Auth.LoginCode.TooManyAttempts";
}

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
