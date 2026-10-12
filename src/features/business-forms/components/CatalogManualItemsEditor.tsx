import { Fragment, useEffect, useLayoutEffect, useRef, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import type { PagedResult } from "@/shared/api/pagedResult";
import { useMediaQuery } from "@/shared/hooks/useMediaQuery";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { CheckboxField } from "@/shared/ui/CheckboxField";
import { FormField } from "@/shared/ui/FormField";
import { ChevronDownIcon, PencilIcon, PlusIcon } from "@/shared/ui/icons";
import { IconButton } from "@/shared/ui/IconButton";
import { Input } from "@/shared/ui/input";
import { Pagination } from "@/shared/ui/Pagination";
import { Surface } from "@/shared/ui/Surface";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/shared/ui/table";
import { Textarea } from "@/shared/ui/textarea";
import { localizedValue } from "../editorModel";
import type { CatalogManualItemValue } from "../catalogItemEdits";
import type { FormCulture } from "../model";

function ItemFields({ item, culture, readOnly, onChange, onDone }: {
  item: CatalogManualItemValue; culture: FormCulture; readOnly: boolean;
  onChange: (item: CatalogManualItemValue) => void; onDone: () => void;
}) {
  const { t } = useTranslation("forms");
  const textRef = useRef<HTMLInputElement>(null);
  useEffect(() => { textRef.current?.focus(); }, []);
  return <Surface padded>
    <div className="grid gap-4 sm:grid-cols-2">
      <FormField label={t("catalogs.items.text")} required={culture === "es"} hint={culture === "en" ? t("catalogs.items.englishHint") : undefined}>
        <Input ref={textRef} maxLength={200} readOnly={readOnly} value={item.label[culture] ?? ""} onChange={event => onChange({ ...item, label: { ...item.label, [culture]: event.target.value } })} />
      </FormField>
      <FormField label={t("catalogs.items.code")} required hint={t("catalogs.items.codeHint")}>
        <Input maxLength={80} readOnly={readOnly} value={item.code} onChange={event => onChange({ ...item, code: event.target.value })} />
      </FormField>
      <FormField label={t("catalogs.items.detail")} hint={t("optional")}>
        <Textarea maxLength={500} readOnly={readOnly} value={item.detail[culture] ?? ""} onChange={event => onChange({ ...item, detail: { ...item.detail, [culture]: event.target.value || null } })} />
      </FormField>
      <CheckboxField label={t("catalogs.items.active")} description={t("catalogs.items.activeHint")} checked={item.isActive} disabled={readOnly} onCheckedChange={isActive => onChange({ ...item, isActive })} />
    </div>
    <div className="flex justify-end"><Button type="button" variant="outline" onClick={onDone}>{t("done")}</Button></div>
  </Surface>;
}

export function CatalogManualItemsEditor({ items, culture, canManage, busy = false, hasPendingMoves = false, expandedKey, onExpand, onChange, onAdd, onMove, filters, pagination, onPageChange, onPageSizeChange }: {
  items: readonly CatalogManualItemValue[];
  culture: FormCulture;
  canManage: boolean;
  busy?: boolean;
  hasPendingMoves?: boolean;
  expandedKey: string | null;
  onExpand: (key: string | null) => void;
  onChange: (item: CatalogManualItemValue) => void;
  onAdd: () => void;
  onMove?: (item: CatalogManualItemValue, delta: -1 | 1) => void;
  filters?: ReactNode;
  pagination?: Omit<PagedResult<unknown>, "items">;
  onPageChange?: (page: number) => void;
  onPageSizeChange?: (pageSize: number) => void;
}) {
  const { t } = useTranslation("forms");
  const previousExpanded = useRef<string | null>(null);
  const actionRefs = useRef(new Map<string, HTMLButtonElement>());
  const addRef = useRef<HTMLButtonElement>(null);
  useLayoutEffect(() => {
    if (previousExpanded.current !== null && expandedKey === null) (actionRefs.current.get(previousExpanded.current) ?? addRef.current)?.focus();
    previousExpanded.current = expandedKey;
  }, [expandedKey]);
  const readOnly = !canManage || busy;
  const fieldsInsideTable = useMediaQuery("(min-width: 640px)");
  const expandedItem = items.find(item => item.localId === expandedKey);
  return <Surface title={t("catalogs.items.title")} actions={canManage ? <Button ref={addRef} type="button" variant="outline" disabled={busy} onClick={onAdd}><PlusIcon className="size-4" />{t("addOption")}</Button> : undefined}>
    {filters}
    <Table><TableHeader><TableRow>
      <TableHead scope="col">#</TableHead><TableHead scope="col">{t("catalogs.items.textAndCode")}</TableHead>
      <TableHead scope="col">{t("catalogs.items.detail")}</TableHead><TableHead scope="col">{t("catalogs.columns.state")}</TableHead><TableHead scope="col" className="text-right">{t("actionsColumn")}</TableHead>
    </TableRow></TableHeader><TableBody>
      {items.map(item => {
        const name = localizedValue(item.label, culture, "es") || (item.itemId === null ? t("catalogs.items.new") : t("option", { number: item.position }));
        const expanded = expandedKey === item.localId;
        const rememberAction = (button: HTMLButtonElement | null) => { if (button) actionRefs.current.set(item.localId, button); else actionRefs.current.delete(item.localId); };
        return <Fragment key={item.localId}><TableRow>
          <TableCell>{item.itemId === null ? "—" : item.position}</TableCell><TableCell><p>{name}</p><p className="text-xs text-[var(--color-content-muted)]">{item.code}</p></TableCell>
          <TableCell>{localizedValue(item.detail, culture, "es") || "—"}</TableCell><TableCell><Badge variant="outline">{t(item.isActive ? "catalogs.items.active" : "catalogs.state.Inactive")}</Badge></TableCell>
          <TableCell className="text-right">{canManage ? <div className="flex justify-end gap-1">
            {onMove ? <><IconButton size="icon-sm" label={item.itemId === null ? t("catalogs.items.moveAfterSave", { action: t("up", { name }) }) : t("up", { name })} disabled={readOnly || item.itemId === null || !hasPendingMoves && item.position === 1} onClick={() => onMove(item, -1)}><ChevronDownIcon className="size-4 rotate-180" /></IconButton>
            <IconButton size="icon-sm" label={item.itemId === null ? t("catalogs.items.moveAfterSave", { action: t("down", { name }) }) : t("down", { name })} disabled={readOnly || item.itemId === null || !hasPendingMoves && item.position === pagination?.totalCount} onClick={() => onMove(item, 1)}><ChevronDownIcon className="size-4" /></IconButton></> : null}
            {item.isActive || expanded ? <IconButton ref={rememberAction} size="icon-sm" label={t("catalogs.editNamed", { name })} disabled={busy} aria-expanded={expanded} onClick={() => onExpand(expanded ? null : item.localId)}><PencilIcon className="size-4" /></IconButton>
              : <Button ref={rememberAction} type="button" variant="outline" size="sm" disabled={busy} aria-label={t("catalogs.items.reactivateNamed", { name })} onClick={() => onChange({ ...item, isActive: true })}>{t("catalogs.items.reactivate")}</Button>}
          </div> : null}</TableCell>
        </TableRow>{expanded && fieldsInsideTable ? <TableRow><TableCell colSpan={5} className="whitespace-normal"><ItemFields item={item} culture={culture} readOnly={readOnly} onChange={onChange} onDone={() => onExpand(null)} /></TableCell></TableRow> : null}</Fragment>;
      })}
    </TableBody></Table>
    {!fieldsInsideTable && expandedItem ? <div className="flex flex-col gap-3 p-4"><p className="text-sm font-medium">{t("catalogs.items.editing", { name: localizedValue(expandedItem.label, culture, "es") || t("option", { number: expandedItem.position }) })}</p><ItemFields item={expandedItem} culture={culture} readOnly={readOnly} onChange={onChange} onDone={() => onExpand(null)} /></div> : null}
    {items.length === 0 ? <div className="p-4"><p className="text-sm text-[var(--color-content-muted)]">{t("catalogs.items.empty")}</p></div> : null}
    {pagination && onPageChange ? <Pagination {...pagination} onPageChange={onPageChange} onPageSizeChange={onPageSizeChange} /> : null}
  </Surface>;
}
