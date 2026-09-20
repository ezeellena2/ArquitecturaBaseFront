import { Navigate, Outlet, useLocation } from "react-router";
import { useAuth } from "react-oidc-context";
import { Spinner } from "@/shared/ui/Spinner";
import { usePermissions } from "./usePermissions";

/// Exige sesión y, si se pide, un permiso (sección 7.3). Sin sesión manda a /login guardando a dónde iba.
export function ProtectedRoute({ permission }: { permission?: string } = {}) {
  const auth = useAuth();
  const location = useLocation();
  const { has, isPending } = usePermissions();

  if (auth.isLoading) {
    return <Spinner />;
  }

  if (!auth.isAuthenticated) {
    return <Navigate to="/login" state={{ returnTo: location.pathname + location.search }} replace />;
  }

  if (!permission) {
    return <Outlet />;
  }

  if (isPending) {
    return <Spinner />;
  }

  return has(permission) ? <Outlet /> : <Navigate to="/sin-permiso" replace />;
}
