import { api } from "@/shared/api/httpClient";

/// A qué cuenta lleva el enlace del chat (`POST /account/login-link/preview`).
export interface LoginLinkPreview {
  /// El nombre, o el correo si la cuenta no tiene nombre. Null si no tiene ninguno de los dos: una cuenta creada
  /// desde WhatsApp.
  readonly displayName: string | null;
  /// Para mostrar el número sin mostrarlo entero ("+54 9 11 •••• 6789"). El número completo nunca sale del servidor.
  readonly maskedPhone: string | null;
}

/// El token va en la clave porque cada enlace es otra cuenta. La caché vive en memoria, como el token.
export function loginLinkPreviewQueryKey(token: string) {
  return ["login-link-preview", token] as const;
}

/// No consume el enlace: la vista previa de WhatsApp, o un antivirus que lo abre, no lo gastan, y repetirlo no rompe
/// nada. El token va siempre en el cuerpo, nunca en la dirección del pedido.
export function previewLoginLink(token: string): Promise<LoginLinkPreview> {
  return api.post<LoginLinkPreview>("/account/login-link/preview", { token });
}

/// Consume el enlace y responde 204 con la cookie de la sesión. Desde ahí, el ingreso sigue con el OIDC de siempre.
export function redeemLoginLink(token: string): Promise<void> {
  return api.post<void>("/account/login-link/redeem", { token });
}
