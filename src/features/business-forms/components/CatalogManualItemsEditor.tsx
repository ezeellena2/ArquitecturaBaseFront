import type { CatalogValueType } from "../catalogValues";
import { useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import type { PagedResult } from "@/shared/api/pagedResult";
import { useMediaQuery } from "@/shared/hooks/useMediaQuery";
import { Button } from "@/shared/ui/button";
import { PlusIcon } from "@/shared/ui/icons";
import { Pagination } from "@/shared/ui/Pagination";
import { Surface } from "@/shared/ui/Surface";
import { administrativeName } from "../editorModel";
import type { CatalogManualItemValue } from "../catalogItemEdits";
import type { FormCulture } from "../model";
import { CatalogItemFields } from "./CatalogItemFields";
import { CatalogItemsTable } from "./CatalogItemsTable";
import type { CatalogFieldDraft } from "../catalogFields";
import type { CatalogReadScope } from "../hooks/useCatalogDraftEditor";
import { DropdownMenu, DropdownMenuContent, DropdownMenuCheckboxItem } from "@/shared/ui/dropdown-menu";
import { FilterMenuTrigger } from "@/shared/ui/FilterMenuTrigger";

export function CatalogManualItemsEditor({ items, culture, original, valueType, fields = [], scope, canManage, busy = false, hasPendingMoves = false, errors, editingItems = [], expandedKey, onExpand, onChange, onFieldBlur, onAdd, onMove, filters, pagination, totalCount = pagination?.totalCount, onPageChange, onPageSizeChange, actions, warnings, pendingTexts, sortPending, onGenerateCode }: {
  actions?: ReactNode; warnings?: Readonly<Record<string, string>>; sortPending?: boolean; onGenerateCode?: (item: CatalogManualItemValue) => void;
  /** By option and field, what an unedited option or yes/no showed while a type change is pending (`pendingFieldTexts`). */
  pendingTexts?: Readonly<Record<string, Readonly<Record<string, string>>>>;
  items: readonly CatalogManualItemValue[];
  /** The menu language, in which the texts are edited, and the catalog's original, shown as a reference in the other one. */
  culture: FormCulture; original: FormCulture;
  valueType: CatalogValueType;
  canManage: boolean;
  busy?: boolean;
  hasPendingMoves?: boolean;
  errors?: Readonly<Record<string, Readonly<Record<string, readonly string[]>>>>;
  editingItems?: readonly CatalogManualItemValue[];
  expandedKey: string | null;
  onExpand: (key: string | null) => void;
  onChange: (item: CatalogManualItemValue) => void;
  /** Leaving a control of an option, in the table or in its editor, by the control's error path. */
  onFieldBlur?: (localId: string, path: string) => void;
  onAdd: () => void;
  onMove?: (item: CatalogManualItemValue, delta: -1 | 1) => void;
  filters?: ReactNode;
  pagination?: Omit<PagedResult<unknown>, "items">;
  /** Where the last option stops moving down: the pagination's total, or the unfiltered list's while only the rows with errors show. */
  totalCount?: number;
  onPageChange?: (page: number) => void;
  onPageSizeChange?: (pageSize: number) => void;
  fields?: readonly CatalogFieldDraft[]; scope?: CatalogReadScope;
}) {
  const { t } = useTranslation("forms");
  const [hiddenFields, setHiddenFields] = useState<readonly string[]>([]);
  const pageKey = items.map(item => item.localId).join(",");
  const [selection, setSelection] = useState({ pageKey, ids: [] as string[] });
  if (selection.pageKey !== pageKey) setSelection({ pageKey, ids: [] });
  const selected = selection.pageKey === pageKey ? selection.ids : [];
  const previousExpanded = useRef<string | null>(null);
  const actionRefs = useRef(new Map<string, HTMLButtonElement>());
  const addRef = useRef<HTMLButtonElement>(null);
  useLayoutEffect(() => {
    if (previousExpanded.current !== null && expandedKey === null) (actionRefs.current.get(previousExpanded.current) ?? addRef.current)?.focus();
    previousExpanded.current = expandedKey;
  }, [expandedKey]);
  const readOnly = !canManage || busy;
  // Generating a code follows the permission, not the moment: while saving or reviewing it stays, disabled.
  const generateCode = canManage ? onGenerateCode : undefined;
  const fieldsInsideTable = useMediaQuery("(min-width: 640px)");
  const expandedItem = items.find(item => item.localId === expandedKey) ?? editingItems.find(item => item.localId === expandedKey);
  return <Surface title={t("catalogs.items.title")} actions={<>{canManage ? <Button ref={addRef} type="button" variant="outline" disabled={busy} onClick={onAdd}><PlusIcon className="size-4" />{t("addOption")}</Button> : null}{actions}</>}>
    {selected.length && canManage ? <div className="flex flex-wrap items-center gap-2 border-b border-[var(--color-border)] px-4 py-2"><p className="mr-auto text-sm">{t("catalogs.items.selectedPage", { count: selected.length })}</p><Button variant="outline" size="sm" disabled={busy} onClick={() => items.filter(item => selected.includes(item.localId)).forEach(item => onChange({ ...item, isActive: false }))}>{t("catalogs.lifecycle.deactivate")}</Button><Button variant="outline" size="sm" disabled={busy} onClick={() => items.filter(item => selected.includes(item.localId)).forEach(item => onChange({ ...item, isActive: true }))}>{t("catalogs.items.reactivate")}</Button><Button variant="ghost" size="sm" onClick={() => setSelection({ pageKey, ids: [] })}>{t("catalogs.items.clearSelection")}</Button></div> : null}
    {fields.some(field => field.isActive) ? <div className="flex flex-wrap items-center gap-3 p-4">{filters}<DropdownMenu><FilterMenuTrigger>{t("catalogs.fields.columns")}</FilterMenuTrigger><DropdownMenuContent align="start">{fields.filter(field => field.isActive).map(field => <DropdownMenuCheckboxItem key={field.localId} checked={!hiddenFields.includes(field.localId)} onSelect={event => event.preventDefault()} onCheckedChange={visible => setHiddenFields(current => visible ? current.filter(id => id !== field.localId) : [...current, field.localId])}>{administrativeName(field.name, culture) || t("catalogs.fields.new")}</DropdownMenuCheckboxItem>)}</DropdownMenuContent></DropdownMenu></div> : filters}
    <CatalogItemsTable fields={fields} scope={scope} visibleFieldIds={fields.filter(field => !hiddenFields.includes(field.localId)).map(field => field.localId)} inline={fieldsInsideTable} selected={selected} onSelect={(id, checked) => setSelection({ pageKey, ids: checked ? [...selected, id] : selected.filter(value => value !== id) })} onSelectAll={checked => setSelection({ pageKey, ids: checked ? items.map(item => item.localId) : [] })} errors={errors} warnings={warnings} pendingTexts={pendingTexts} sortPending={sortPending} items={items} culture={culture} original={original} valueType={valueType} canManage={canManage} busy={busy} hasPendingMoves={hasPendingMoves} totalCount={totalCount} expandedKey={expandedKey}
      expandedContent={fieldsInsideTable && expandedItem ? <CatalogItemFields fields={fields} scope={scope} warning={warnings?.[expandedItem.localId]} pendingTexts={pendingTexts?.[expandedItem.localId]} onGenerateCode={generateCode ? () => generateCode(expandedItem) : undefined} item={expandedItem} errors={errors?.[expandedItem.localId]} culture={culture} original={original} valueType={valueType} readOnly={readOnly} onChange={onChange} onFieldBlur={path => onFieldBlur?.(expandedItem.localId, path)} onDone={() => onExpand(null)}/> : undefined}
      onExpand={onExpand} onChange={onChange} onFieldBlur={onFieldBlur} onMove={onMove} onActionRef={(key, button) => { if (button) actionRefs.current.set(key, button); else actionRefs.current.delete(key); }}/>
    {expandedItem && (!fieldsInsideTable || !items.some(item => item.localId === expandedItem.localId)) ? <div className="flex flex-col gap-3 p-4"><p className="text-sm font-medium">{t("catalogs.items.editing", { name: administrativeName(expandedItem.label, culture) || t("option", { number: expandedItem.position }) })}</p><CatalogItemFields fields={fields} scope={scope} warning={warnings?.[expandedItem.localId]} pendingTexts={pendingTexts?.[expandedItem.localId]} onGenerateCode={generateCode ? () => generateCode(expandedItem) : undefined} item={expandedItem} errors={errors?.[expandedItem.localId]} culture={culture} original={original} valueType={valueType} readOnly={readOnly} onChange={onChange} onFieldBlur={path => onFieldBlur?.(expandedItem.localId, path)} onDone={() => onExpand(null)} /></div> : null}
    {items.length === 0 ? <div className="p-4"><p className="text-sm text-[var(--color-content-muted)]">{t("catalogs.items.empty")}</p></div> : null}
    {pagination && onPageChange ? <Pagination {...pagination} onPageChange={onPageChange} onPageSizeChange={onPageSizeChange} /> : null}
  </Surface>;
}
