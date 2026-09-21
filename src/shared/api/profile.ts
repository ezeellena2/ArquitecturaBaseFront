import { api } from "./httpClient";

/// Lo que `PUT /api/me` deja cambiar del perfil propio (sección 9 del spec de la Fase 4).
///
/// Los tres campos viajan siempre, con el valor que tienen que quedar: el comando **reemplaza** el perfil, no
/// lo parchea, así que mandar solo el idioma le borraría el nombre y la zona horaria a la persona.
export interface UpdateProfileBody {
  readonly displayName: string | null;
  readonly culture: string;
  readonly timeZoneId: string;
}

/// Vive en `shared/api` y no en `features/profile` porque lo piden dos lugares: la pantalla del perfil y el
/// cambio de idioma del menú del usuario, que está en `layouts` y no puede importar de una feature.
export function updateProfile(body: UpdateProfileBody): Promise<void> {
  return api.put<void>("/api/me", body);
}
