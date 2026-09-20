import { Navigate, Outlet, useLocation } from "react-router";
import { useAuth } from "react-oidc-context";
import { useTranslation } from "react-i18next";
import { usePermissions } from "./usePermissions";

// Spinner llega en la Tarea 9; hasta entonces se muestra el texto de carga traducido.
/// Exige sesión y, si se pide, un permiso (sección 7.3). Sin sesión manda a /login guardando a dónde iba.
export function ProtectedRoute({ permission }: { permission?: string } = {}) {
  const { t } = useTranslation();
  const auth = useAuth();
  const location = useLocation();
  const { has, isPending } = usePermissions();

  if (auth.isLoading) {
    return <p>{t("states.loading")}</p>;
  }

  if (!auth.isAuthenticated) {
    return <Navigate to="/login" state={{ returnTo: location.pathname + location.search }} replace />;
  }

  if (!permission) {
    return <Outlet />;
  }

  if (isPending) {
    return <p>{t("states.loading")}</p>;
  }

  return has(permission) ? <Outlet /> : <Navigate to="/sin-permiso" replace />;
}
