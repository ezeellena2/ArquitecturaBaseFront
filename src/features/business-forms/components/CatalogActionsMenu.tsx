import { useState, type RefObject } from "react";
import { useTranslation } from "react-i18next";
import { ActionsMenu, type ActionsMenuEntry } from "@/shared/ui/ActionsMenu";
import { ConfirmDialog } from "@/shared/ui/ConfirmDialog";
import { BanIcon, FolderIcon, RefreshIcon } from "@/shared/ui/icons";

/// ⋮ of a catalog editor, «Acciones del catálogo» (AC1-A, 2026-11-11): what else is done with a saved catalog waits here,
/// after «Descartar» and «Guardar», as in the form editor. First «Carpetas…» (CP2-A), whose dialog the page mounts while it
/// is open, and then «Dar de baja» or «Reactivar», which asks with the confirmation of always and is applied with Save.
/// Without any of them (a new catalog, a pending proposal) there is no ⋮. Every dialog gives the focus back to ⋮.
export function CatalogActionsMenu({ triggerRef, onFolders, state }: {
  triggerRef: RefObject<HTMLButtonElement | null>;
  onFolders?: () => void;
  state?: { isActive: boolean; disabled: boolean; onChange: (isActive: boolean) => void };
}) {
  const { t } = useTranslation(["forms", "formFolders"]);
  const [confirming, setConfirming] = useState(false);
  const action = state ? t(state.isActive ? "catalogs.lifecycle.deactivate" : "catalogs.lifecycle.reactivate") : "";
  const items: ActionsMenuEntry[] = [];
  if (onFolders) items.push({ label: t("formFolders:item.action"), icon: FolderIcon, onSelect: onFolders });
  if (state) items.push({ label: action, icon: state.isActive ? BanIcon : RefreshIcon, unavailable: state.disabled, onSelect: () => setConfirming(true) });
  if (!items.length) return null;
  return <>
    <ActionsMenu label={t("catalogs.lifecycle.actions")} triggerRef={triggerRef} items={items} />
    {state ? <ConfirmDialog open={confirming} onOpenChange={setConfirming} focusFallback={triggerRef} title={action}
      description={t(state.isActive ? "catalogs.lifecycle.deactivateHint" : "catalogs.lifecycle.reactivateHint")}
      confirmLabel={action} destructive={state.isActive} onConfirm={() => { if (!state.disabled) state.onChange(!state.isActive); }} /> : null}
  </>;
}
