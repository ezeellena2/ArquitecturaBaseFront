import { useTranslation } from "react-i18next";
import { Navigate, Outlet, useLocation } from "react-router";
import { useAuth } from "react-oidc-context";
import { usePermissions } from "./usePermissions";
import { ApiError } from "@/shared/api/ApiError";
import { Button } from "@/shared/ui/button";
import { EmptyState } from "@/shared/ui/EmptyState";
import { Spinner } from "@/shared/ui/Spinner";

/// Exige sesión y, si se pide, un permiso (sección 7.3). Sin sesión manda a /login guardando a dónde iba.
export function ProtectedRoute({ permission }: { permission?: string } = {}) {
  const { t } = useTranslation();
  const auth = useAuth();
  const location = useLocation();
  const { has, isPending, isError, error, refetch } = usePermissions();

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

  // Un fallo al consultar el permiso (por ejemplo, un 500 de /api/me) no es lo mismo que no tenerlo: es un
  // error recuperable, con su propio mensaje y un reintento, igual que resuelve DataTable.
  if (isError) {
    const apiError = error instanceof ApiError ? error : undefined;

    return (
      <EmptyState
        title={apiError?.isNetworkError ? t("errors.network") : (apiError?.detail ?? apiError?.message ?? t("states.error"))}
        description={apiError?.traceId ? t("errors.traceId", { traceId: apiError.traceId }) : undefined}
        action={
          <Button type="button" variant="outline" onClick={() => void refetch()}>
            {t("actions.retry")}
          </Button>
        }
      />
    );
  }

  return has(permission) ? <Outlet /> : <Navigate to="/sin-permiso" replace />;
}
