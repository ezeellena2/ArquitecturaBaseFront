import { api } from "@/shared/api/httpClient";

/// Los medios de ingreso de la propia cuenta (sección 12 del spec del ingreso con WhatsApp): vincular el número,
/// agregar el correo y desvincular el número. Agregar cualquiera de los dos pide primero un código, que prueba que el
/// número o el correo es de quien lo agrega.
///
/// Pedir el código responde lo mismo sea el número o el correo libre o de otra cuenta: decirlo antes le contaría a
/// cualquiera qué números y correos están registrados. El 409 llega recién al confirmar, con el código correcto.

export interface RequestEmailCodeResponse {
  readonly resendAfterSeconds: number;
}

export interface RequestPhoneLinkCodeResponse extends RequestEmailCodeResponse {
  /// El número ya interpretado por el servidor, en E.164 ("+5491123456789"): es el que se confirma y se reenvía.
  readonly phone: string;
  /// Para mostrar a dónde se mandó el código ("+54 9 11 •••• 6789").
  readonly maskedPhone: string;
}

/// Solo existe con WhatsApp prendido. `number` va como lo escribió la persona y `country` dice cómo leerlo; al
/// reenviar, el `phone` de la respuesta (con el "+") no necesita el país.
export function requestPhoneLinkCode(input: { country?: string; number: string }): Promise<RequestPhoneLinkCodeResponse> {
  return api.post<RequestPhoneLinkCodeResponse>("/api/me/whatsapp/code", input);
}

/// 204, o 409 `Users.Phone.AlreadyExists` si el número es de otra cuenta. Un código equivocado, vencido o usado
/// responde los mismos `Auth.LoginCode.*` que el ingreso.
export function confirmPhoneLink(input: { phone: string; code: string }): Promise<void> {
  return api.put<void>("/api/me/whatsapp", input);
}

/// 204, o 409 `Users.User.LastLoginMethod` si el número es el único medio de ingreso.
export function unlinkPhone(): Promise<void> {
  return api.delete<void>("/api/me/whatsapp");
}

export function requestEmailCode(email: string): Promise<RequestEmailCodeResponse> {
  return api.post<RequestEmailCodeResponse>("/api/me/email/code", { email });
}

/// 204, o 409 `Users.User.AlreadyExists` si el correo es de otra cuenta.
export function confirmEmail(input: { email: string; code: string }): Promise<void> {
  return api.put<void>("/api/me/email", input);
}
