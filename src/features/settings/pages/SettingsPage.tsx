import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import {
  fetchSystemSettings,
  systemSettingsQueryKey,
  updateSystemSettings,
  type RegistrationMode,
} from "../api/settings";
import { ForbiddenPage } from "@/features/errors/pages/ForbiddenPage";
import { ApiError } from "@/shared/api/ApiError";
import { Button } from "@/shared/ui/button";
import { ConfirmDialog } from "@/shared/ui/ConfirmDialog";
import { EmptyState } from "@/shared/ui/EmptyState";
import { Label } from "@/shared/ui/label";
import { PageHeader } from "@/shared/ui/PageHeader";
import { Skeleton } from "@/shared/ui/skeleton";
import { Switch } from "@/shared/ui/switch";

/// Firma mínima que necesitamos de `t`, la misma que usan las otras features.
type Translate = (key: string, options?: Record<string, unknown>) => string;

/// Acá no hay códigos que merezcan un texto propio: los errores de negocio ya vienen traducidos del servidor.
function errorMessage(error: unknown, t: Translate): string {
  if (!(error instanceof ApiError)) {
    return t("common:states.error");
  }

  if (error.isNetworkError) {
    return t("common:errors.network");
  }

  return error.detail ?? t("common:states.error");
}

/// `/configuracion` (sección 11 del spec de la Fase 4). Es un ajuste que decide quién puede entrar al sistema,
/// así que el cambio pasa por una confirmación que dice qué implica, no por un "¿estás seguro?".
export function SettingsPage() {
  const { t } = useTranslation("settings");
  const queryClient = useQueryClient();
  const [pendingMode, setPendingMode] = useState<RegistrationMode | undefined>();

  const { data, error, refetch } = useQuery({ queryKey: systemSettingsQueryKey, queryFn: fetchSystemSettings });

  const mutation = useMutation({
    mutationFn: (registrationMode: RegistrationMode) => updateSystemSettings({ registrationMode }),
    onSuccess: async () => {
      toast.success(t("feedback.saved"));
      await queryClient.invalidateQueries({ queryKey: systemSettingsQueryKey });
    },
    onError: (mutationError) => toast.error(errorMessage(mutationError, t)),
  });

  const apiError = error instanceof ApiError ? error : undefined;

  if (apiError?.status === 403) {
    return <ForbiddenPage />;
  }

  const isOpeningRegistration = pendingMode === "Open";

  const body = apiError ? (
    <EmptyState
      title={apiError.isNetworkError ? t("common:errors.network") : (apiError.detail ?? apiError.message)}
      description={apiError.traceId ? t("errorTraceId", { traceId: apiError.traceId }) : undefined}
      action={
        <Button type="button" variant="outline" onClick={() => void refetch()}>
          {t("common:actions.retry")}
        </Button>
      }
    />
  ) : data ? (
    <>
      <div className="mt-4 flex items-center gap-3">
        <Switch
          id="registration-open"
          checked={data.registrationMode === "Open"}
          disabled={mutation.isPending}
          onCheckedChange={(checked) => setPendingMode(checked ? "Open" : "InviteOnly")}
        />
        <Label htmlFor="registration-open">{t("registration.switchLabel")}</Label>
      </div>

      {/* Las dos opciones explicadas, siempre las dos: el interruptor solo no dice qué pasa del otro lado. */}
      <ul className="mt-3 flex flex-col gap-1 text-sm text-[var(--color-content-muted)]">
        <li>{t("registration.open")}</li>
        <li>{t("registration.inviteOnly")}</li>
      </ul>
    </>
  ) : (
    <Skeleton aria-hidden="true" className="mt-4 h-10" />
  );

  return (
    <div>
      <PageHeader title={t("title")} description={t("description")} />

      <section className="rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
        <h2 className="text-sm font-semibold text-[var(--color-content)]">{t("registration.title")}</h2>
        {body}
      </section>

      {pendingMode ? (
        <ConfirmDialog
          open
          onOpenChange={(next) => {
            if (!next) {
              setPendingMode(undefined);
            }
          }}
          title={t(isOpeningRegistration ? "confirm.openTitle" : "confirm.inviteOnlyTitle")}
          description={t(isOpeningRegistration ? "confirm.openDescription" : "confirm.inviteOnlyDescription")}
          confirmLabel={t("confirm.confirm")}
          onConfirm={() => mutation.mutate(pendingMode)}
        />
      ) : null}
    </div>
  );
}
