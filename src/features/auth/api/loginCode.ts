import { api } from "@/shared/api/httpClient";

export interface RequestLoginCodeResponse {
  readonly resendAfterSeconds: number;
}

export interface VerifyLoginCodeResponse {
  readonly returnUrl: string;
}

export function requestLoginCode(email: string): Promise<RequestLoginCodeResponse> {
  return api.post<RequestLoginCodeResponse>("/account/login-code", { email });
}

export function verifyLoginCode(input: { email: string; code: string; returnUrl: string }): Promise<VerifyLoginCodeResponse> {
  return api.post<VerifyLoginCodeResponse>("/account/login-code/verify", input);
}

/// El ingreso con Google es una navegación del navegador, no una llamada de la Api.
export function externalLoginUrl(returnUrl: string): string {
  return `/account/external/google?returnUrl=${encodeURIComponent(returnUrl)}`;
}
