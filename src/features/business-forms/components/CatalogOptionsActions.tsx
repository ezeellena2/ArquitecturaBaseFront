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
  dialogOpen: boolean;
  focusRef: RefObject<HTMLButtonElement | null>;
  /** The file on its way (`useCatalogExport.working`): its control shows the wait, and both downloads wait for it. */
  downloading?: "export" | "template" | null;
  /** «Importar» opens the import dialog, with its two tabs: «Subir un archivo» and «Pegar desde Excel». */
  onImport: () => void;
  onExport: (template: boolean) => void;
  /** «Ordenar por…» opens the sort dialog (OR1-A), also to change an order already pending. */
  onSort: () => void;
  onGenerateCodes: () => void;
}

export function CatalogOptionsActions({ canManage, busy, saved, importDisabledReason, hasPendingMoves,
  dialogOpen, focusRef, downloading = null, onImport, onExport, onSort, onGenerateCodes }: CatalogOptionsActionsProps) {
  const { t } = useTranslation("forms");
  const mobile = useMediaQuery("(max-width: 639px)");
  const trigger = useRef<HTMLButtonElement>(null);
  const openingDialog = useRef(false);
  const [open, setOpen] = useState(false);
  const saveReason = saved ? null : t("catalogs.actions.saveFirst");
  const importReason = saveReason ?? importDisabledReason;
  const sortReason = saveReason ?? (hasPendingMoves ? t("catalogs.actions.sortMoves") : null);
  // El motivo de un botón apagado va como ayuda (DisabledReason), no escrito debajo; mientras el dueño trabaja no se
  // explica, porque el motivo no es ése.
  const shownImportReason = busy ? null : importReason;
  const exportReason = busy ? null : saveReason;
  // A download asked in «⋯» (the template, and on the phone also the export) spins the trigger, which says what it does.
  const exporting = downloading === "export", menuWorking = downloading === "template" || (mobile && exporting);

  // Importing and sorting open a dialog that takes the focus and gives it back to the control that opened it: the button, or
  // ⋮ for an item of the menu. The menu is closed here: Radix does not report it once the dialog has closed it through `open`,
  // and it would open again when the dialog closes, keeping the focus.
  function beginDialog(show: () => void, button?: HTMLButtonElement) {
    focusRef.current = button ?? trigger.current;
    openingDialog.current = true;
    setOpen(false);
    show();
  }

  const item = (label: string, reason: string | null, onSelect: () => void, unavailable = busy || reason !== null): ActionsMenuItem =>
    ({ label, reason, unavailable, onSelect });
  // While a file is on its way, the other download waits for it too: the owner takes one at a time.
  const download = (label: string, template: boolean) => item(label, saveReason, () => onExport(template), busy || saveReason !== null || downloading !== null);
  // The items that open a dialog are written out: their action reads ⋮, and `item` is a call made while rendering.
  const importItem: ActionsMenuItem = { label: t("catalogs.actions.import"), reason: importReason, unavailable: busy || importReason !== null, onSelect: () => beginDialog(onImport) };
  const sortItem: ActionsMenuItem = { label: t("catalogs.actions.sort"), reason: sortReason, unavailable: busy || sortReason !== null, onSelect: () => beginDialog(onSort) };
  // «⋯» (AC1-A): on the phone also «Importar» and «Exportar»; the template; ordering and codes for whoever manages.
  const items: ActionsMenuEntry[] = [
    ...(mobile ? [
      ...(canManage ? [importItem] : []),
      download(t("catalogs.actions.export"), false),
      { separator: true as const },
    ] : []),
    download(t("catalogs.actions.template"), true),
    ...(canManage ? [
      { separator: true as const },
      sortItem,
      item(t("catalogs.actions.generateCodes"), null, onGenerateCodes),
    ] : []),
  ];

  // Sin contenedor propio: las acciones de la Surface «Opciones» las alinea ella, al borde derecho y a la altura del título.
  return <>
    {!mobile ? <>
      {canManage ? <DisabledReason reason={shownImportReason}><Button type="button" variant="outline" disabled={busy || importReason !== null}
        onClick={event => beginDialog(onImport, event.currentTarget)}>{t("catalogs.actions.import")}</Button></DisabledReason> : null}
      <DisabledReason reason={exportReason}><Button type="button" variant="outline" pending={exporting} disabled={busy || !saved || downloading !== null}
        onClick={() => onExport(false)}>{t(exporting ? "catalogs.actions.exporting" : "catalogs.actions.export")}</Button></DisabledReason>
    </> : null}
    {/* Not off while a dialog is open: the modal dialog keeps ⋮ out of reach, and an icon button that turns off becomes another
        element, which would lose the control that the dialog gives the focus back to. */}
    <ActionsMenu items={items} open={open && !dialogOpen} triggerRef={trigger} pending={menuWorking} disabled={busy}
      label={t(!menuWorking ? "catalogs.actions.more" : exporting ? "catalogs.actions.exporting" : "catalogs.actions.downloadingTemplate")}
      onOpenChange={value => {
        if (value) openingDialog.current = false;
        setOpen(value);
      }}
      // The dialog that an item opens takes the focus; otherwise it goes back to «⋯».
      onCloseAutoFocus={event => { if (openingDialog.current || dialogOpen) event.preventDefault(); }} />
  </>;
}
