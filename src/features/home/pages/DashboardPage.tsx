import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { useCurrentUser } from "@/auth/useCurrentUser";
import { PageHeader } from "@/shared/ui/PageHeader";
import { Badge } from "@/shared/ui/badge";

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

/// `/` (sección 7.2): el tablero de inicio. Nada de datos inventados, solo el perfil que ya devuelve
/// `/api/me` (roles, permisos, idioma y zona horaria).
export function DashboardPage() {
  const { t } = useTranslation();
  const { data: user } = useCurrentUser();

  if (!user) {
    return null;
  }

  return (
    <div>
      <PageHeader title={t("home.title")} description={t("home.description")} />

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Card title={t("home.session.title")}>
          <Row label={t("home.session.email")} value={user.email} />
          <Row label={t("home.session.role")} value={user.roles.length > 0 ? user.roles.join(", ") : "—"} />
        </Card>

        <Card title={t("home.permissions.title")}>
          {user.permissions.length > 0 ? (
            <div className="flex flex-wrap gap-1.5">
              {user.permissions.map((permission) => (
                <Badge key={permission} variant="outline">
                  {permission}
                </Badge>
              ))}
            </div>
          ) : (
            <p className="text-sm text-[var(--color-content-muted)]">{t("home.permissions.empty")}</p>
          )}
        </Card>

        <Card title={t("home.locale.title")}>
          <Row label={t("home.locale.language")} value={t(`language.${user.culture}`)} />
          <Row label={t("home.locale.timeZone")} value={user.timeZoneId} />
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
