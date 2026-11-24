import { useTranslation } from "react-i18next";
import { Navigate, Outlet, useLocation } from "react-router";
import { useAuth } from "react-oidc-context";
import { useIsRecoveringSession } from "./sessionRecoveryStatus";
import { usePermissions, type PermissionRequirement } from "./usePermissions";
import { screenLinkOf } from "@/layouts/navigation";
import { ApiError } from "@/shared/api/ApiError";
import { Button } from "@/shared/ui/button";
import { EmptyState } from "@/shared/ui/EmptyState";
import { ForbiddenPage } from "@/shared/ui/ForbiddenPage";
import { Page } from "@/shared/ui/Page";
import { PageLoading } from "@/shared/ui/PageLoading";
import { Spinner } from "@/shared/ui/Spinner";

/// Exige sesión y, si se pide, un permiso (sección 7.3). Sin sesión manda a /login guardando a dónde iba. Sin el permiso,
/// la pantalla queda en su dirección con su nombre y «No tenés permiso» (SP1-B, 2026-11-24).
export function ProtectedRoute({ permission }: { permission?: PermissionRequirement } = {}) {
  const { t } = useTranslation();
  const auth = useAuth();
  const location = useLocation();
  const isRecoveringSession = useIsRecoveringSession();
  const { has, isPending, isError, error, refetch } = usePermissions();

  // Mientras `SessionRecovery` canjea la cookie del servidor, que no haya sesión en memoria es un estado
  // intermedio y no una respuesta. Esperar acá es lo que permite que la recuperación no tenga que bloquear el
  // árbol entero: la pantalla se dibuja con lo que hay y sus bloques de carga se rellenan cuando llega.
  const isSessionUndecided = isRecoveringSession && !auth.isAuthenticated;

  if (auth.isLoading && !auth.isAuthenticated && !isSessionUndecided) {
    return <Spinner />;
  }

  if (!auth.isAuthenticated && !isSessionUndecided) {
    return <Navigate to="/login" state={{ returnTo: location.pathname + location.search }} replace />;
  }

  if (!permission) {
    return <Outlet />;
  }

  // También es por acá por donde pasa una recuperación en curso cuando la ruta pide un permiso: /api/me
  // todavía no se consultó (la consulta espera a que haya sesión), así que el permiso sigue sin saberse y la
  // ruta no se abre sola. El resto de la pantalla (sidebar y barra de arriba) ya está dibujado.
  if (isPending) {
    return <PageLoading />;
  }

  // La banda lleva el nombre de la pantalla, el de su entrada del menú o el de la sección de la que cuelga: una ruta
  // con permiso siempre tiene uno (`routes.test.tsx`).
  const link = screenLinkOf(location.pathname);
  const title = link ? t(link.labelKey) : t("errors.forbidden.title");

  // Un fallo al consultar el permiso (por ejemplo, un 500 de /api/me) no es lo mismo que no tenerlo: es un
  // error recuperable, con su propio mensaje y un reintento, igual que resuelve DataTable.
  if (isError) {
    const apiError = error instanceof ApiError ? error : undefined;

    return (
      <Page title={title}>
        <EmptyState
          title={apiError?.isNetworkError ? t("errors.network") : (apiError?.detail ?? apiError?.message ?? t("states.error"))}
          description={apiError?.traceId ? t("errors.traceId", { traceId: apiError.traceId }) : undefined}
          action={
            <Button type="button" variant="outline" onClick={() => void refetch()}>
              {t("actions.retry")}
            </Button>
          }
        />
      </Page>
    );
  }

  return has(permission) ? <Outlet /> : <ForbiddenPage title={title} />;
}
