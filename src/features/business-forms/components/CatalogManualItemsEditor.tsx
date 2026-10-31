import type { CatalogValueType } from "../catalogValues";
import { useRef, useState, type ReactNode } from "react";
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
import { CatalogItemsTable } from "./CatalogItemsTable";
import type { CatalogFieldDraft } from "../catalogFields";
import type { CatalogReadScope } from "../hooks/useCatalogDraftEditor";
import { DropdownMenu, DropdownMenuContent, DropdownMenuCheckboxItem } from "@/shared/ui/dropdown-menu";
import { FilterMenuTrigger } from "@/shared/ui/FilterMenuTrigger";
import { ConfirmDialog } from "@/shared/ui/ConfirmDialog";

export function CatalogManualItemsEditor({ items, culture, original, valueType, fields = [], scope, canManage, busy = false, hasPendingMoves = false, errors, onEdit, onChange, onFieldBlur, onAdd, onMove, onRemove, deletedItemIds, deleteErrors, onDelete, onRestore, filters, pagination, totalCount = pagination?.totalCount, onPageChange, onPageSizeChange, actions, notice, warnings, pendingTexts, sortPending }: {
  actions?: ReactNode;
  /** Above the table: what the server said about the fields when saving. */
  notice?: ReactNode; warnings?: Readonly<Record<string, string>>; sortPending?: boolean;
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
  /** The pencil: the page opens the option in the options modal. */
  onEdit: (item: CatalogManualItemValue) => void;
  onChange: (item: CatalogManualItemValue) => void;
  /** Leaving a control of an option in the table, by the control's error path. */
  onFieldBlur?: (localId: string, path: string) => void;
  /** «Agregar opción»: the page opens the options modal on a new option. */
  onAdd: () => void;
  onMove?: (item: CatalogManualItemValue, delta: -1 | 1) => void;
  /** A new option, never saved, leaves the draft; the focus goes to «Agregar opción». */
  onRemove?: (item: CatalogManualItemValue) => void;
  /** A saved option is marked to delete on Save after confirming, and can be restored until then. */
  deletedItemIds?: readonly string[]; deleteErrors?: Readonly<Record<string, string>>;
  onDelete?: (item: CatalogManualItemValue) => void; onRestore?: (item: CatalogManualItemValue) => void;
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
  const addRef = useRef<HTMLButtonElement>(null);
  const [deleting, setDeleting] = useState<CatalogManualItemValue | null>(null);
  const fieldsInsideTable = useMediaQuery("(min-width: 640px)");
  return <Surface title={t("catalogs.items.title")} actions={<>{canManage ? <Button ref={addRef} type="button" variant="outline" disabled={busy} onClick={onAdd}><PlusIcon className="size-4" />{t("addOption")}</Button> : null}{actions}</>}>
    {notice}
    {selected.length && canManage ? <div className="flex flex-wrap items-center gap-2 border-b border-[var(--color-border)] px-4 py-2"><p className="mr-auto text-sm">{t("catalogs.items.selectedPage", { count: selected.length })}</p><Button variant="outline" size="sm" disabled={busy} onClick={() => items.filter(item => selected.includes(item.localId)).forEach(item => onChange({ ...item, isActive: false }))}>{t("catalogs.lifecycle.deactivate")}</Button><Button variant="outline" size="sm" disabled={busy} onClick={() => items.filter(item => selected.includes(item.localId)).forEach(item => onChange({ ...item, isActive: true }))}>{t("catalogs.items.reactivate")}</Button><Button variant="ghost" size="sm" onClick={() => setSelection({ pageKey, ids: [] })}>{t("catalogs.items.clearSelection")}</Button></div> : null}
    {fields.some(field => field.isActive) ? <div className="flex flex-wrap items-center gap-3 p-4">{filters}<DropdownMenu><FilterMenuTrigger>{t("catalogs.fields.columns")}</FilterMenuTrigger><DropdownMenuContent align="start">{fields.filter(field => field.isActive).map(field => <DropdownMenuCheckboxItem key={field.localId} checked={!hiddenFields.includes(field.localId)} onSelect={event => event.preventDefault()} onCheckedChange={visible => setHiddenFields(current => visible ? current.filter(id => id !== field.localId) : [...current, field.localId])}>{administrativeName(field.name, culture) || t("catalogs.fields.new")}</DropdownMenuCheckboxItem>)}</DropdownMenuContent></DropdownMenu></div> : filters}
    <CatalogItemsTable fields={fields} scope={scope} visibleFieldIds={fields.filter(field => !hiddenFields.includes(field.localId)).map(field => field.localId)} inline={fieldsInsideTable} selected={selected} onSelect={(id, checked) => setSelection({ pageKey, ids: checked ? [...selected, id] : selected.filter(value => value !== id) })} onSelectAll={checked => setSelection({ pageKey, ids: checked ? items.map(item => item.localId) : [] })} errors={errors} warnings={warnings} pendingTexts={pendingTexts} sortPending={sortPending} items={items} culture={culture} original={original} valueType={valueType} canManage={canManage} busy={busy} hasPendingMoves={hasPendingMoves} totalCount={totalCount}
      onEdit={onEdit} onChange={onChange} onFieldBlur={onFieldBlur} onMove={onMove} onRemove={onRemove ? item => { addRef.current?.focus(); onRemove(item); } : undefined}
      deletedItemIds={deletedItemIds} deleteErrors={deleteErrors} onDelete={onDelete ? setDeleting : undefined} onRestore={onRestore}
      deleteDisabledReason={hasPendingMoves || sortPending ? t("catalogs.items.deleteAfterOrder") : null} />
    {items.length === 0 ? <div className="p-4"><p className="text-sm text-[var(--color-content-muted)]">{t("catalogs.items.empty")}</p></div> : null}
    {pagination && onPageChange ? <Pagination {...pagination} onPageChange={onPageChange} onPageSizeChange={onPageSizeChange} /> : null}
    <ConfirmDialog open={deleting !== null} onOpenChange={open => { if (!open) setDeleting(null); }} title={t("catalogs.items.deleteTitle", { name: deleting ? administrativeName(deleting.label, culture) || t("option", { number: deleting.position }) : "" })}
      description={t("catalogs.items.deleteDescription")} confirmLabel={t("catalogs.items.deleteConfirm")} destructive focusFallback={addRef} onConfirm={() => { if (deleting) onDelete?.(deleting); setDeleting(null); }} />
  </Surface>;
}
