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

/// 204, o 409 `Users.Phone.AlreadyExists` si el número es de otra cuenta (recién con el código correcto). Un código
/// equivocado, vencido o usado responde los mismos `Auth.LoginCode.*` que el ingreso, en el nivel superior.
///
/// Cada medio confirma los cambios del otro (N11): con un correo verificado y un número que cambia, `emailCode` es el
/// código que confirma el cambio, pedido con `requestEmailConfirmationCode("LinkPhone")`. Sin él, 400
/// `Users.User.ConfirmationCodeRequired` en `errors.emailCode`; equivocado, `Auth.LoginCode.*` en `errors.emailCode`, con
/// `attemptsLeft`. Volver a confirmar el mismo número verificado no lo pide. 409 `Users.User.PhoneAlreadySet` con otro
/// número ya verificado, que desde el perfil no se reemplaza (el perfil no lo ofrece).
export function confirmPhoneLink(input: { phone: string; code: string; emailCode?: string }): Promise<void> {
  return api.put<void>("/api/me/whatsapp", input);
}

/// Lo que confirma el código pedido al correo verificado de la cuenta.
export type EmailConfirmedChange = "LinkPhone" | "UnlinkPhone";

/// El código al correo verificado de la cuenta que confirma vincular el número (`LinkPhone`) o desvincularlo
/// (`UnlinkPhone`) (N11). 409 `Users.User.NoVerifiedEmail` sin correo verificado, `Users.User.NoPhone` al desvincular sin
/// número y `Users.User.PhoneAlreadySet` al vincular con un número verificado; 429 por los límites de pedir un código.
export function requestEmailConfirmationCode(change: EmailConfirmedChange): Promise<RequestEmailCodeResponse> {
  return api.post<RequestEmailCodeResponse>("/api/me/email/confirmation-code", { change });
}

export interface RequestPhoneConfirmationCodeResponse extends RequestEmailCodeResponse {
  /// A dónde se mandó el código ("+54 9 11 •••• 6789").
  readonly maskedPhone: string;
}

/// El código al número verificado de la cuenta que confirma agregar un correo (N11), sin cuerpo: es el número de la
/// cuenta. Sólo existe con WhatsApp prendido. 409 `Users.User.NoVerifiedPhone` sin número verificado y
/// `Users.User.EmailAlreadySet` con un correo verificado; 429 por los límites de pedir un código. El de
/// `requestPhoneLinkCode` no sirve para esto.
export function requestPhoneConfirmationCode(): Promise<RequestPhoneConfirmationCodeResponse> {
  return api.post<RequestPhoneConfirmationCodeResponse>("/api/me/whatsapp/confirmation-code");
}

/// 204, o 409 `Users.User.LastLoginMethod` si el número es el único medio de ingreso. Con un correo verificado lleva el
/// código que confirma el cambio (N11, pedido con `requestEmailConfirmationCode("UnlinkPhone")`); sin él, 400
/// `Users.User.ConfirmationCodeRequired` en `errors.code`. Sin correo verificado va sin código.
export function unlinkPhone(code?: string): Promise<void> {
  return api.delete<void>("/api/me/whatsapp", code === undefined ? undefined : { body: JSON.stringify({ code }) });
}

/// 202, o 409 `Users.User.EmailAlreadySet` si la cuenta ya tiene un correo verificado, que desde el perfil no se cambia.
export function requestEmailCode(email: string): Promise<RequestEmailCodeResponse> {
  return api.post<RequestEmailCodeResponse>("/api/me/email/code", { email });
}

/// 204. Los errores del código del correo van en el nivel superior y se miran primero. Con un número verificado,
/// `phoneCode` es el código que confirma el cambio (N11, pedido con `requestPhoneConfirmationCode`): sin él, 400
/// `Users.User.ConfirmationCodeRequired` en `errors.phoneCode`; equivocado, `Auth.LoginCode.*` en `errors.phoneCode`, con
/// `attemptsLeft`. Antes de mirar los códigos, 409 `Users.User.PhoneCodeUnavailable` (WhatsApp no manda códigos),
/// `Users.User.EmailAlreadySet` o `Users.User.InitialAdmin`; después, `Users.User.AlreadyExists` si el correo es de otra
/// cuenta.
export function confirmEmail(input: { email: string; code: string; phoneCode?: string }): Promise<void> {
  return api.put<void>("/api/me/email", input);
}
