import { api } from "./httpClient";

/// Los medios de ingreso que ofrece el servidor, además del correo, que está siempre (`GET /account/login-methods`).
///
/// Vive en `shared/api` porque lo piden dos features: el ingreso (`/login` y `/ingresar`) y el perfil, que solo ofrece
/// vincular WhatsApp si está prendido y con los países de acá.
export interface LoginMethods {
  readonly google: boolean;
  readonly whatsapp: boolean;
  /// Los países a los que se mandan códigos por WhatsApp, en ISO 3166-1 alfa-2 ("AR"), en el orden de la
  /// configuración. Vacío con WhatsApp apagado.
  readonly whatsappCountries: readonly string[];
  /// El número del bot, solo con dígitos, para el enlace "Volver a WhatsApp" (Tarea 12). Null con WhatsApp apagado.
  readonly whatsappNumber: string | null;
}

export const loginMethodsQueryKey = ["login-methods"] as const;

export function getLoginMethods(): Promise<LoginMethods> {
  return api.get<LoginMethods>("/account/login-methods");
}
