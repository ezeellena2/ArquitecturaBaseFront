import { useQuery } from "@tanstack/react-query";
import { useAuth } from "react-oidc-context";
import { api } from "@/shared/api/httpClient";

/// Perfil, roles y permisos del usuario de la sesión (sección 5.6 del spec).
export interface CurrentUser {
  readonly id: string;
  /// Null en una cuenta creada desde WhatsApp, que se identifica con el número. Una cuenta tiene al menos uno de
  /// los dos. Para nombrarla en la interfaz, `accountNameOf` (`auth/accountName`).
  readonly email: string | null;
  readonly emailConfirmed: boolean;
  /// En formato internacional ("+5493511234567"), o null.
  readonly phoneNumber: string | null;
  readonly phoneNumberConfirmed: boolean;
  readonly hasGoogleLogin: boolean;
  readonly displayName: string | null;
  readonly culture: string;
  readonly timeZoneId: string;
  /// Último ingreso, en UTC (sección 9 del spec de la Fase 4). Viene `null` si todavía no hay ninguno guardado.
  readonly lastLoginAtUtc: string | null;
  readonly roles: readonly string[];
  readonly permissions: readonly string[];
}

export const currentUserQueryKey = ["current-user"] as const;

export function useCurrentUser() {
  const auth = useAuth();

  return useQuery({
    queryKey: currentUserQueryKey,
    queryFn: () => api.get<CurrentUser>("/api/me"),
    enabled: auth.isAuthenticated,
    staleTime: 5 * 60_000,
  });
}
