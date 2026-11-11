import type { Ref } from "react";
import { useTranslation } from "react-i18next";
import { ActionsMenu, type ActionsMenuEntry } from "@/shared/ui/ActionsMenu";
import { BanIcon, RefreshIcon, TrashIcon } from "@/shared/ui/icons";
import type { FormLifecycle } from "../api/response";

/// ⋮ of the form editor (AC1-A): «Dar de baja» or «Reactivar» and, after a line, «Eliminar» in red, each with its reason
/// inside when it is unavailable; with responses, the menu ends saying why it cannot be deleted.
export function FormLifecycleMenu({ lifecycle, blocked, onDeactivate, onReactivate, triggerRef, onDelete, canManage, canPublish }: { canManage: boolean; canPublish: boolean; onDelete: () => void; triggerRef?: Ref<HTMLButtonElement>; lifecycle: FormLifecycle; blocked: boolean; onDeactivate: () => void; onReactivate: () => void }) {
  const { t } = useTranslation("forms");
  const deactivated = !!lifecycle.deactivatedAtUtc;
  const allowed = deactivated ? lifecycle.canReactivate : lifecycle.canDeactivate;
  const hasResponses = lifecycle.deletionUnavailableReason === "HasResponses" || lifecycle.responseCount !== null && lifecycle.responseCount > 0;
  const showDelete = canManage && !hasResponses;
  if (!canPublish && !showDelete) return null;
  const items: ActionsMenuEntry[] = [];
  if (canPublish) items.push({
    label: t(deactivated ? "lifecycle.reactivate" : "lifecycle.deactivate"),
    icon: deactivated ? RefreshIcon : BanIcon,
    unavailable: blocked || !allowed,
    reason: allowed ? null : t("lifecycle.reasons." + (lifecycle.unavailableReason ?? "Unavailable")),
    onSelect: deactivated ? onReactivate : onDeactivate,
  });
  if (showDelete) items.push({
    label: t("lifecycle.delete"),
    icon: TrashIcon,
    destructive: true,
    unavailable: blocked || !lifecycle.canDelete,
    reason: lifecycle.canDelete ? null : t("lifecycle.deletionReasons." + (lifecycle.deletionUnavailableReason ?? "Unavailable")),
    onSelect: onDelete,
  });
  return <ActionsMenu label={t("lifecycle.actions")} triggerRef={triggerRef} items={items}
    note={canManage && hasResponses ? t("lifecycle.deletionReasons.HasResponses") : undefined} />;
}
