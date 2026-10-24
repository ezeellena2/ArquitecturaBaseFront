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
  onImport: (source: "file" | "paste") => void;
  onExport: (template: boolean) => void;
  onSort: () => void;
  onGenerateCodes: () => void;
}

export function CatalogOptionsActions({ canManage, busy, saved, importDisabledReason, hasPendingMoves,
  sortPending, dialogOpen, focusRef, onImport, onExport, onSort, onGenerateCodes }: CatalogOptionsActionsProps) {
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
  const pasteImportReason = busy ? null : importReason;
  const exportReason = busy ? null : saveReason;

  function beginImport(source: "file" | "paste", button: HTMLButtonElement | null) {
    focusRef.current = button;
    openingDialog.current = true;
    onImport(source);
  }

  function item(label: string, reason: string | null, action: () => void) {
    const unavailable = busy || reason !== null;
    return <DropdownMenuItem aria-disabled={unavailable || undefined} onSelect={event => {
      if (unavailable) event.preventDefault(); else action();
    }}><span>{label}{reason ? <span className="block text-xs">{reason}</span> : null}</span></DropdownMenuItem>;
  }

  // Sin contenedor propio: las acciones de la Surface «Opciones» las alinea ella, al borde derecho y a la altura del título.
  return <>
    {!mobile ? <>
      {canManage ? <>
        <DisabledReason reason={pasteImportReason}><Button type="button" variant="outline" disabled={busy || importReason !== null}
          onClick={event => beginImport("paste", event.currentTarget)}>{t("catalogs.actions.paste")}</Button></DisabledReason>
        <DisabledReason reason={pasteImportReason}><Button type="button" variant="outline" disabled={busy || importReason !== null}
          onClick={event => beginImport("file", event.currentTarget)}>{t("catalogs.actions.import")}</Button></DisabledReason>
      </> : null}
      <DisabledReason reason={exportReason}><Button type="button" variant="outline" disabled={busy || !saved}
        onClick={() => onExport(false)}>{t("catalogs.actions.export")}</Button></DisabledReason>
    </> : null}
    <DropdownMenu open={open && !dialogOpen} onOpenChange={value => {
      if (value) openingDialog.current = false;
      setOpen(value);
    }}>
      <DropdownMenuTrigger asChild><IconButton ref={trigger} label={t("catalogs.actions.more")}
        disabled={busy || dialogOpen}><MoreVerticalIcon className="size-4" aria-hidden="true" /></IconButton></DropdownMenuTrigger>
      <DropdownMenuContent align="end" onCloseAutoFocus={event => {
        if (openingDialog.current || dialogOpen) event.preventDefault();
      }}>
        {mobile ? <>
          {canManage ? <>
            <DropdownMenuItem aria-disabled={busy || importReason !== null || undefined} onSelect={event => {
              if (busy || importReason !== null) event.preventDefault(); else beginImport("paste", trigger.current);
            }}><span>{t("catalogs.actions.paste")}{importReason ? <span className="block text-xs">{importReason}</span> : null}</span></DropdownMenuItem>
            <DropdownMenuItem aria-disabled={busy || importReason !== null || undefined} onSelect={event => {
              if (busy || importReason !== null) event.preventDefault(); else beginImport("file", trigger.current);
            }}><span>{t("catalogs.actions.import")}{importReason ? <span className="block text-xs">{importReason}</span> : null}</span></DropdownMenuItem>
          </> : null}
          {item(t("catalogs.actions.export"), saveReason, () => onExport(false))}
          <DropdownMenuSeparator />
        </> : null}
        {item(t("catalogs.actions.template"), saveReason, () => onExport(true))}
        {canManage ? <>
          <DropdownMenuSeparator />
          {item(t("catalogs.actions.sort"), sortReason, onSort)}
          {item(t("catalogs.actions.generateCodes"), null, onGenerateCodes)}
        </> : null}
      </DropdownMenuContent>
    </DropdownMenu>
  </>;
}
