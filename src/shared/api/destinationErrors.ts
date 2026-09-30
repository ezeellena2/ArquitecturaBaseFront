import { ApiError } from "./ApiError";

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

