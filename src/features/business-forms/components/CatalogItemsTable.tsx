import { Fragment, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { ChevronDownIcon, PencilIcon } from "@/shared/ui/icons";
import { IconButton } from "@/shared/ui/IconButton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/shared/ui/table";
import { localizedValue } from "../editorModel";
import type { CatalogManualItemValue } from "../catalogItemEdits";
import type { FormCulture } from "../model";

export function CatalogItemsTable({ items, culture, canManage, busy, hasPendingMoves, totalCount, expandedKey, expandedContent, onExpand, onChange, onMove, onActionRef }: {
  items: readonly CatalogManualItemValue[];
  culture: FormCulture;
  canManage: boolean;
  busy: boolean;
  hasPendingMoves: boolean;
  totalCount?: number;
  expandedKey: string | null;
  expandedContent?: ReactNode;
  onExpand: (key: string | null) => void;
  onChange: (item: CatalogManualItemValue) => void;
  onMove?: (item: CatalogManualItemValue, delta: -1 | 1) => void;
  onActionRef: (key: string, button: HTMLButtonElement | null) => void;
}) {
  const { t } = useTranslation("forms");
  const readOnly = !canManage || busy;
  return (
    <Table><TableHeader><TableRow>
      <TableHead scope="col">#</TableHead><TableHead scope="col">{t("catalogs.items.textAndCode")}</TableHead>
      <TableHead scope="col">{t("catalogs.items.detail")}</TableHead><TableHead scope="col">{t("catalogs.columns.state")}</TableHead><TableHead scope="col" className="text-right">{t("actionsColumn")}</TableHead>
    </TableRow></TableHeader><TableBody>
      {items.map(item => {
        const name = localizedValue(item.label, culture, "es") || (item.itemId === null ? t("catalogs.items.new") : t("option", { number: item.position }));
        const expanded = expandedKey === item.localId;
        const rememberAction = (button: HTMLButtonElement | null) => onActionRef(item.localId, button);
        return <Fragment key={item.localId}><TableRow>
          <TableCell>{item.itemId === null ? "—" : item.position}</TableCell><TableCell><p>{name}</p><p className="text-xs text-[var(--color-content-muted)]">{item.code}</p></TableCell>
          <TableCell>{localizedValue(item.detail, culture, "es") || "—"}</TableCell><TableCell><Badge variant="outline">{t(item.isActive ? "catalogs.items.active" : "catalogs.state.Inactive")}</Badge></TableCell>
          <TableCell className="text-right">{canManage ? <div className="flex justify-end gap-1">
            {onMove ? <><IconButton size="icon-sm" label={item.itemId === null ? t("catalogs.items.moveAfterSave", { action: t("up", { name }) }) : t("up", { name })} disabled={readOnly || item.itemId === null || !hasPendingMoves && item.position === 1} onClick={() => onMove(item, -1)}><ChevronDownIcon className="size-4 rotate-180" /></IconButton>
            <IconButton size="icon-sm" label={item.itemId === null ? t("catalogs.items.moveAfterSave", { action: t("down", { name }) }) : t("down", { name })} disabled={readOnly || item.itemId === null || !hasPendingMoves && item.position === totalCount} onClick={() => onMove(item, 1)}><ChevronDownIcon className="size-4" /></IconButton></> : null}
            {item.isActive || expanded ? <IconButton ref={rememberAction} size="icon-sm" label={t("catalogs.editNamed", { name })} disabled={busy} aria-expanded={expanded} onClick={() => onExpand(expanded ? null : item.localId)}><PencilIcon className="size-4" /></IconButton>
              : <Button ref={rememberAction} type="button" variant="outline" size="sm" disabled={busy} aria-label={t("catalogs.items.reactivateNamed", { name })} onClick={() => onChange({ ...item, isActive: true })}>{t("catalogs.items.reactivate")}</Button>}
          </div> : null}</TableCell>
        </TableRow>{expanded && expandedContent ? <TableRow><TableCell colSpan={5} className="whitespace-normal">{expandedContent}</TableCell></TableRow> : null}</Fragment>;
      })}
    </TableBody></Table>
  );
}
