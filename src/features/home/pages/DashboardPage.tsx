import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { useCurrentUser } from "@/auth/useCurrentUser";
import { PageHeader } from "@/shared/ui/PageHeader";
import { Badge } from "@/shared/ui/badge";
import { Skeleton } from "@/shared/ui/skeleton";

const featureKeys = ["passwordless", "permissions", "i18n", "listings", "dates"] as const;

/// Tarjeta blanca (misma forma que la usa `UsersPage`): un título y su contenido.
function Card({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
      <h2 className="mb-3 text-sm font-semibold text-[var(--color-content)]">{title}</h2>
      {children}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 py-1 text-sm">
      <span className="text-[var(--color-content-muted)]">{label}</span>
      <span className="truncate font-medium text-[var(--color-content)]">{value}</span>
    </div>
  );
}

/// Una fila todavía sin datos: ocupa el mismo alto que `Row` (py-1 + una línea de text-sm) para que la
/// tarjeta no cambie de tamaño cuando llegan.
function RowSkeleton({ label }: { label: string }) {
  return (
    <div className="flex items-center justify-between gap-3 py-1 text-sm">
      <span className="text-[var(--color-content-muted)]">{label}</span>
      <div className="flex h-5 items-center">
        <Skeleton aria-hidden="true" className="h-3.5 w-28" />
      </div>
    </div>
  );
}

/// Los permisos del perfil, o el aviso de que no tiene ninguno.
function PermissionList({ permissions, emptyLabel }: { permissions: readonly string[]; emptyLabel: string }) {
  if (permissions.length === 0) {
    return <p className="text-sm text-[var(--color-content-muted)]">{emptyLabel}</p>;
  }

  return (
    <div className="flex flex-wrap gap-1.5">
      {permissions.map((permission) => (
        <Badge key={permission} variant="outline">
          {permission}
        </Badge>
      ))}
    </div>
  );
}

/// El lugar de los permisos mientras no llegan: unas etiquetas del alto exacto de un `Badge`.
function PermissionListSkeleton() {
  return (
    <div className="flex flex-wrap gap-1.5">
      <Skeleton aria-hidden="true" className="h-[22px] w-28" />
      <Skeleton aria-hidden="true" className="h-[22px] w-20" />
      <Skeleton aria-hidden="true" className="h-[22px] w-24" />
    </div>
  );
}

/// `/` (sección 7.2): el tablero de inicio. Nada de datos inventados, solo el perfil que ya devuelve
/// `/api/me` (roles, permisos, idioma y zona horaria).
export function DashboardPage() {
  const { t } = useTranslation();
  // `isPending` es "el perfil todavía no llegó" (al recargar, mientras se recupera la sesión). La pantalla se
  // dibuja igual y solo los datos que faltan van como bloques de carga, en vez de quedar en blanco.
  const { data: user, isPending } = useCurrentUser();

  // Si `/api/me` falló no hay nada que mostrar acá, como hasta ahora: del error se ocupa quien lo pidió.
  if (!user && !isPending) {
    return null;
  }

  return (
    <div>
      <PageHeader title={t("home.title")} description={t("home.description")} />

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Card title={t("home.session.title")}>
          {user ? (
            <>
              <Row label={t("home.session.email")} value={user.email} />
              <Row label={t("home.session.role")} value={user.roles.length > 0 ? user.roles.join(", ") : "—"} />
            </>
          ) : (
            <>
              <RowSkeleton label={t("home.session.email")} />
              <RowSkeleton label={t("home.session.role")} />
            </>
          )}
        </Card>

        <Card title={t("home.permissions.title")}>
          {user ? <PermissionList permissions={user.permissions} emptyLabel={t("home.permissions.empty")} /> : <PermissionListSkeleton />}
        </Card>

        <Card title={t("home.locale.title")}>
          {user ? (
            <>
              <Row label={t("home.locale.language")} value={t(`language.${user.culture}`)} />
              <Row label={t("home.locale.timeZone")} value={user.timeZoneId} />
            </>
          ) : (
            <>
              <RowSkeleton label={t("home.locale.language")} />
              <RowSkeleton label={t("home.locale.timeZone")} />
            </>
          )}
        </Card>
      </div>

      <div className="mt-4 rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
        <h2 className="mb-3 text-sm font-semibold text-[var(--color-content)]">{t("home.features.title")}</h2>
        <ul className="list-disc space-y-1 pl-5 text-sm text-[var(--color-content-muted)]">
          {featureKeys.map((key) => (
            <li key={key}>{t(`home.features.${key}`)}</li>
          ))}
        </ul>
      </div>
    </div>
  );
}
