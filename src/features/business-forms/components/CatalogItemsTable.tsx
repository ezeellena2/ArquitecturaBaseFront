import { Checkbox } from "@/shared/ui/checkbox";
import { CatalogInlineInput } from "./CatalogInlineInput";
import { formatCatalogValue, type CatalogValueType } from "../catalogValues";
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

export function CatalogItemsTable({ items, culture, valueType, canManage, busy, hasPendingMoves, totalCount, expandedKey, expandedContent, inline, selected, onSelect, onSelectAll, errors, warnings, sortPending, onExpand, onChange, onMove, onActionRef }: {
  items: readonly CatalogManualItemValue[];
  inline: boolean; selected: readonly string[]; onSelect: (id: string, selected: boolean) => void; onSelectAll: (selected: boolean) => void;
  errors?: Readonly<Record<string, Readonly<Record<string, readonly string[]>>>>; warnings?: Readonly<Record<string, string>>; sortPending?: boolean;
  culture: FormCulture;
  valueType: CatalogValueType;
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
      {canManage ? <TableHead scope="col"><Checkbox aria-label={t("catalogs.items.selectPage")} disabled={busy || !items.length} checked={selected.length === items.length && items.length > 0 ? true : selected.length ? "indeterminate" : false} onCheckedChange={value => onSelectAll(value === true)}/></TableHead> : null}
      <TableHead scope="col">#</TableHead><TableHead scope="col">{t(inline && canManage ? "catalogs.items.text" : "catalogs.items.textAndCode")}</TableHead>{inline && canManage ? <TableHead scope="col">{t("catalogs.items.code")}</TableHead> : null}
      {valueType !== "Text" ? <TableHead scope="col">{t("catalogs.items.value")}</TableHead> : null}
      <TableHead scope="col">{t("catalogs.items.detail")}</TableHead><TableHead scope="col">{t("catalogs.columns.state")}</TableHead><TableHead scope="col" className="text-right">{t("actionsColumn")}</TableHead>
    </TableRow></TableHeader><TableBody>
      {items.map((item, index) => {
        const name = localizedValue(item.label, culture, "es") || (item.itemId === null ? t("catalogs.items.new") : t("option", { number: item.position }));
        const number = item.position ?? index + 1;
        const messages = errors?.[item.localId];
        const expanded = expandedKey === item.localId;
        const rememberAction = (button: HTMLButtonElement | null) => onActionRef(item.localId, button);
        return <Fragment key={item.localId}><TableRow>
          {canManage ? <TableCell><Checkbox aria-label={t("catalogs.items.selectNamed", { name })} checked={selected.includes(item.localId)} disabled={busy} onCheckedChange={value => onSelect(item.localId, value === true)}/></TableCell> : null}
          <TableCell>{item.itemId === null ? "—" : item.position}</TableCell><TableCell>{inline && canManage ? <CatalogInlineInput label={t("catalogs.items.inlineText", { number })} value={item.label[culture] ?? ""} readOnly={readOnly} count error={messages?.["text." + culture]?.join(" ")} warning={warnings?.[item.localId]} onChange={value => onChange({ ...item, label: { ...item.label, [culture]: value } })}/> : <><p>{name}</p><p className="text-xs text-[var(--color-content-muted)]">{item.code}</p></>}</TableCell>
          {inline && canManage ? <TableCell> <CatalogInlineInput maxLength={80} label={t("catalogs.items.inlineCode", { number })} value={item.code} readOnly={readOnly} error={messages?.code?.join(" ")} onChange={code => onChange({ ...item, code })}/></TableCell> : null}
          {valueType !== "Text" ? <TableCell>{inline && canManage ? <CatalogInlineInput maxLength={64} label={t("catalogs.items.inlineValue", { number })} value={item.value ?? ""} readOnly={readOnly} type={valueType === "Date" ? "date" : "text"} inputMode={valueType === "Date" ? undefined : valueType === "Integer" ? "numeric" : "decimal"} error={messages?.value?.join(" ")} onChange={value => onChange({ ...item, value: value || null })}/> : valueType === "Date" ? formatCatalogValue(valueType, item.value, culture) : item.value || "—"}</TableCell> : null}
          <TableCell>{inline && canManage ? <CatalogInlineInput maxLength={300} label={t("catalogs.items.inlineDetail", { number })} value={item.detail[culture] ?? ""} readOnly={readOnly} error={messages?.["detail." + culture]?.join(" ")} onChange={value => onChange({ ...item, detail: { ...item.detail, [culture]: value || null } })}/> : localizedValue(item.detail, culture, "es") || "—"}</TableCell><TableCell>{inline && canManage ? <Checkbox aria-label={t("catalogs.items.activeNamed", { name })} checked={item.isActive} disabled={readOnly} onCheckedChange={value => onChange({ ...item, isActive: value === true })}/> : <Badge variant="outline">{t(item.isActive ? "catalogs.items.active" : "catalogs.state.Inactive")}</Badge>}</TableCell>
          <TableCell className="text-right">{canManage ? <div className="flex justify-end gap-1">
            {onMove ? <><IconButton size="icon-sm" label={item.itemId === null ? t("catalogs.items.moveAfterSave", { action: t("up", { name }) }) : t("up", { name })} disabled={readOnly || sortPending || item.itemId === null || !hasPendingMoves && item.position === 1} onClick={() => onMove(item, -1)}><ChevronDownIcon className="size-4 rotate-180" /></IconButton>
            <IconButton size="icon-sm" label={item.itemId === null ? t("catalogs.items.moveAfterSave", { action: t("down", { name }) }) : t("down", { name })} disabled={readOnly || sortPending || item.itemId === null || !hasPendingMoves && item.position === totalCount} onClick={() => onMove(item, 1)}><ChevronDownIcon className="size-4" /></IconButton></> : null}
            {item.isActive || expanded ? <IconButton ref={rememberAction} size="icon-sm" label={t("catalogs.editNamed", { name })} disabled={busy} aria-expanded={expanded} onClick={() => onExpand(expanded ? null : item.localId)}><PencilIcon className="size-4" /></IconButton>
              : <Button ref={rememberAction} type="button" variant="outline" size="sm" disabled={busy} aria-label={t("catalogs.items.reactivateNamed", { name })} onClick={() => onChange({ ...item, isActive: true })}>{t("catalogs.items.reactivate")}</Button>}
          </div> : null}</TableCell>
        </TableRow>{expanded && expandedContent ? <TableRow><TableCell colSpan={(valueType === "Text" ? 5 : 6) + (canManage ? 1 : 0) + (inline && canManage ? 1 : 0)} className="whitespace-normal">{expandedContent}</TableCell></TableRow> : null}</Fragment>;
      })}
    </TableBody></Table>
  );
}
