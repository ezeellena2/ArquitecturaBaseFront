import { useRef, useState } from "react";
import type { RefObject } from "react";
import { useTranslation } from "react-i18next";
import { useMediaQuery } from "@/shared/hooks/useMediaQuery";
import { ActionsMenu, type ActionsMenuEntry, type ActionsMenuItem } from "@/shared/ui/ActionsMenu";
import { Button } from "@/shared/ui/button";
import { DisabledReason } from "@/shared/ui/DisabledReason";

export interface CatalogOptionsActionsProps {
  canManage: boolean;
  busy: boolean;
  saved: boolean;
  importDisabledReason: string | null;
  hasPendingMoves: boolean;
  sortPending: boolean;
  dialogOpen: boolean;
  focusRef: RefObject<HTMLButtonElement | null>;
  /** The file on its way (`useCatalogExport.working`): its control shows the wait, and both downloads wait for it. */
  downloading?: "export" | "template" | null;
  /** «Importar» opens the import dialog, with its two tabs: «Subir un archivo» and «Pegar desde Excel». */
  onImport: () => void;
  onExport: (template: boolean) => void;
  onSort: () => void;
  onGenerateCodes: () => void;
}

export function CatalogOptionsActions({ canManage, busy, saved, importDisabledReason, hasPendingMoves,
  sortPending, dialogOpen, focusRef, downloading = null, onImport, onExport, onSort, onGenerateCodes }: CatalogOptionsActionsProps) {
  const { t } = useTranslation("forms");
  const mobile = useMediaQuery("(max-width: 639px)");
  const trigger = useRef<HTMLButtonElement>(null);
  const openingDialog = useRef(false);
  const [open, setOpen] = useState(false);
  const saveReason = saved ? null : t("catalogs.actions.saveFirst");
  const importReason = saveReason ?? importDisabledReason;
  const sortReason = saveReason ?? (hasPendingMoves ? t("catalogs.actions.sortMoves")
    : sortPending ? t("catalogs.actions.sortPending") : null);
  // El motivo de un botón apagado va como ayuda (DisabledReason), no escrito debajo; mientras el dueño trabaja no se
  // explica, porque el motivo no es ése.
  const shownImportReason = busy ? null : importReason;
  const exportReason = busy ? null : saveReason;
  // A download asked in «⋯» (the template, and on the phone also the export) spins the trigger, which says what it does.
  const exporting = downloading === "export", menuWorking = downloading === "template" || (mobile && exporting);

  function beginImport(button: HTMLButtonElement | null) {
    focusRef.current = button;
    openingDialog.current = true;
    onImport();
  }

  const item = (label: string, reason: string | null, onSelect: () => void, unavailable = busy || reason !== null): ActionsMenuItem =>
    ({ label, reason, unavailable, onSelect });
  // While a file is on its way, the other download waits for it too: the owner takes one at a time.
  const download = (label: string, template: boolean) => item(label, saveReason, () => onExport(template), busy || saveReason !== null || downloading !== null);
  // «⋯» (AC1-A): on the phone also «Importar» and «Exportar»; the template; ordering and codes for whoever manages.
  const items: ActionsMenuEntry[] = [
    ...(mobile ? [
      ...(canManage ? [item(t("catalogs.actions.import"), importReason, () => beginImport(trigger.current))] : []),
      download(t("catalogs.actions.export"), false),
      { separator: true as const },
    ] : []),
    download(t("catalogs.actions.template"), true),
    ...(canManage ? [
      { separator: true as const },
      item(t("catalogs.actions.sort"), sortReason, onSort),
      item(t("catalogs.actions.generateCodes"), null, onGenerateCodes),
    ] : []),
  ];

  // Sin contenedor propio: las acciones de la Surface «Opciones» las alinea ella, al borde derecho y a la altura del título.
  return <>
    {!mobile ? <>
      {canManage ? <DisabledReason reason={shownImportReason}><Button type="button" variant="outline" disabled={busy || importReason !== null}
        onClick={event => beginImport(event.currentTarget)}>{t("catalogs.actions.import")}</Button></DisabledReason> : null}
      <DisabledReason reason={exportReason}><Button type="button" variant="outline" pending={exporting} disabled={busy || !saved || downloading !== null}
        onClick={() => onExport(false)}>{t(exporting ? "catalogs.actions.exporting" : "catalogs.actions.export")}</Button></DisabledReason>
    </> : null}
    <ActionsMenu items={items} open={open && !dialogOpen} triggerRef={trigger} pending={menuWorking} disabled={busy || dialogOpen}
      label={t(!menuWorking ? "catalogs.actions.more" : exporting ? "catalogs.actions.exporting" : "catalogs.actions.downloadingTemplate")}
      onOpenChange={value => {
        if (value) openingDialog.current = false;
        setOpen(value);
      }}
      // The dialog that an item opens takes the focus; otherwise it goes back to «⋯».
      onCloseAutoFocus={event => { if (openingDialog.current || dialogOpen) event.preventDefault(); }} />
  </>;
}
