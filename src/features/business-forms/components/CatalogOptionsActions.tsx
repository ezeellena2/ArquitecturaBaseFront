import { useRef, useState } from "react";
import type { RefObject } from "react";
import { useTranslation } from "react-i18next";
import { useMediaQuery } from "@/shared/hooks/useMediaQuery";
import { Button } from "@/shared/ui/button";
import { DisabledReason } from "@/shared/ui/DisabledReason";
import { IconButton } from "@/shared/ui/IconButton";
import { MoreVerticalIcon } from "@/shared/ui/icons";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/shared/ui/dropdown-menu";

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

  function item(label: string, reason: string | null, action: () => void, unavailable = busy || reason !== null) {
    return <DropdownMenuItem aria-disabled={unavailable || undefined} onSelect={event => {
      if (unavailable) event.preventDefault(); else action();
    }}><span>{label}{reason ? <span className="block text-xs">{reason}</span> : null}</span></DropdownMenuItem>;
  }
  // While a file is on its way, the other download waits for it too: the owner takes one at a time.
  const download = (label: string, template: boolean) => item(label, saveReason, () => onExport(template), busy || saveReason !== null || downloading !== null);

  // Sin contenedor propio: las acciones de la Surface «Opciones» las alinea ella, al borde derecho y a la altura del título.
  return <>
    {!mobile ? <>
      {canManage ? <DisabledReason reason={shownImportReason}><Button type="button" variant="outline" disabled={busy || importReason !== null}
        onClick={event => beginImport(event.currentTarget)}>{t("catalogs.actions.import")}</Button></DisabledReason> : null}
      <DisabledReason reason={exportReason}><Button type="button" variant="outline" pending={exporting} disabled={busy || !saved || downloading !== null}
        onClick={() => onExport(false)}>{t(exporting ? "catalogs.actions.exporting" : "catalogs.actions.export")}</Button></DisabledReason>
    </> : null}
    <DropdownMenu open={open && !dialogOpen} onOpenChange={value => {
      if (value) openingDialog.current = false;
      setOpen(value);
    }}>
      <DropdownMenuTrigger asChild><IconButton ref={trigger} pending={menuWorking}
        label={t(!menuWorking ? "catalogs.actions.more" : exporting ? "catalogs.actions.exporting" : "catalogs.actions.downloadingTemplate")}
        disabled={busy || dialogOpen}><MoreVerticalIcon className="size-4" aria-hidden="true" /></IconButton></DropdownMenuTrigger>
      <DropdownMenuContent align="end" onCloseAutoFocus={event => {
        if (openingDialog.current || dialogOpen) event.preventDefault();
      }}>
        {mobile ? <>
          {canManage ? <DropdownMenuItem aria-disabled={busy || importReason !== null || undefined} onSelect={event => {
            if (busy || importReason !== null) event.preventDefault(); else beginImport(trigger.current);
          }}><span>{t("catalogs.actions.import")}{importReason ? <span className="block text-xs">{importReason}</span> : null}</span></DropdownMenuItem> : null}
          {download(t("catalogs.actions.export"), false)}
          <DropdownMenuSeparator />
        </> : null}
        {download(t("catalogs.actions.template"), true)}
        {canManage ? <>
          <DropdownMenuSeparator />
          {item(t("catalogs.actions.sort"), sortReason, onSort)}
          {item(t("catalogs.actions.generateCodes"), null, onGenerateCodes)}
        </> : null}
      </DropdownMenuContent>
    </DropdownMenu>
  </>;
}
