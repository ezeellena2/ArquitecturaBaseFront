import { api } from "@/shared/api/httpClient";

export interface RequestLoginCodeResponse {
  readonly resendAfterSeconds: number;
}

/// Siempre la misma forma, exista o no la cuenta.
export interface RequestWhatsAppLoginCodeResponse extends RequestLoginCodeResponse {
  /// El número ya interpretado por el servidor, en formato internacional ("+5491123456789"): es el que se manda
  /// después al verificar y al reenviar.
  readonly phone: string;
  /// Para mostrar a dónde se mandó el código ("+54 9 11 •••• 6789").
  readonly maskedPhone: string;
}

export interface VerifyLoginCodeResponse {
  readonly returnUrl: string;
}

/// El código se verifica con el correo **o** con el número, nunca con los dos: el servidor responde un error de
/// validación en `errors.phone` si llegan juntos.
export type VerifyLoginCodeRequest =
  | { readonly email: string; readonly code: string; readonly returnUrl: string }
  | { readonly phone: string; readonly code: string; readonly returnUrl: string };

export function requestLoginCode(email: string): Promise<RequestLoginCodeResponse> {
  return api.post<RequestLoginCodeResponse>("/account/login-code", { email });
}

/// `number` va como lo escribió la persona ("11 2345-6789"), y `country` dice cómo leerlo. Un número en formato
/// internacional (el `phone` de la respuesta, al reenviar) no necesita el país: el servidor lee el "+".
export function requestWhatsAppLoginCode(input: {
  country?: string;
  number: string;
}): Promise<RequestWhatsAppLoginCodeResponse> {
  return api.post<RequestWhatsAppLoginCodeResponse>("/account/login-code/whatsapp", input);
}

export function verifyLoginCode(input: VerifyLoginCodeRequest): Promise<VerifyLoginCodeResponse> {
  return api.post<VerifyLoginCodeResponse>("/account/login-code/verify", input);
}

/// El ingreso con Google es una navegación del navegador, no una llamada de la Api. El `returnUrl` llega ya
/// validado por `authorizeReturnUrl`: con cualquier otro valor el servidor responde el ProblemDetails como
/// página cruda, fuera del SPA.
export function externalLoginUrl(returnUrl: string): string {
  return `/account/external/google?returnUrl=${encodeURIComponent(returnUrl)}`;
}
