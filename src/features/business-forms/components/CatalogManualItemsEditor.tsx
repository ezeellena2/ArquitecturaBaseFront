import type { CatalogValueType } from "../catalogValues";
import { useLayoutEffect, useRef, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import type { PagedResult } from "@/shared/api/pagedResult";
import { useMediaQuery } from "@/shared/hooks/useMediaQuery";
import { Button } from "@/shared/ui/button";
import { PlusIcon } from "@/shared/ui/icons";
import { Pagination } from "@/shared/ui/Pagination";
import { Surface } from "@/shared/ui/Surface";
import { localizedValue } from "../editorModel";
import type { CatalogManualItemValue } from "../catalogItemEdits";
import type { FormCulture } from "../model";
import { CatalogItemFields } from "./CatalogItemFields";
import { CatalogItemsTable } from "./CatalogItemsTable";

export function CatalogManualItemsEditor({ items, culture, valueType, canManage, busy = false, hasPendingMoves = false, errors, editingItems = [], expandedKey, onExpand, onChange, onAdd, onMove, filters, pagination, onPageChange, onPageSizeChange }: {
  items: readonly CatalogManualItemValue[];
  culture: FormCulture;
  valueType: CatalogValueType;
  canManage: boolean;
  busy?: boolean;
  hasPendingMoves?: boolean;
  errors?: Readonly<Record<string, Readonly<Record<string, readonly string[]>>>>;
  editingItems?: readonly CatalogManualItemValue[];
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
  const expandedItem = items.find(item => item.localId === expandedKey) ?? editingItems.find(item => item.localId === expandedKey);
  return <Surface title={t("catalogs.items.title")} actions={canManage ? <Button ref={addRef} type="button" variant="outline" disabled={busy} onClick={onAdd}><PlusIcon className="size-4" />{t("addOption")}</Button> : undefined}>
    {filters}
    <CatalogItemsTable items={items} culture={culture} valueType={valueType} canManage={canManage} busy={busy} hasPendingMoves={hasPendingMoves} totalCount={pagination?.totalCount} expandedKey={expandedKey}
      expandedContent={fieldsInsideTable && expandedItem ? <CatalogItemFields item={expandedItem} errors={errors?.[expandedItem.localId]} culture={culture} valueType={valueType} readOnly={readOnly} onChange={onChange} onDone={() => onExpand(null)}/> : undefined}
      onExpand={onExpand} onChange={onChange} onMove={onMove} onActionRef={(key, button) => { if (button) actionRefs.current.set(key, button); else actionRefs.current.delete(key); }}/>
    {expandedItem && (!fieldsInsideTable || !items.some(item => item.localId === expandedItem.localId)) ? <div className="flex flex-col gap-3 p-4"><p className="text-sm font-medium">{t("catalogs.items.editing", { name: localizedValue(expandedItem.label, culture, "es") || t("option", { number: expandedItem.position }) })}</p><CatalogItemFields item={expandedItem} errors={errors?.[expandedItem.localId]} culture={culture} valueType={valueType} readOnly={readOnly} onChange={onChange} onDone={() => onExpand(null)} /></div> : null}
    {items.length === 0 ? <div className="p-4"><p className="text-sm text-[var(--color-content-muted)]">{t("catalogs.items.empty")}</p></div> : null}
    {pagination && onPageChange ? <Pagination {...pagination} onPageChange={onPageChange} onPageSizeChange={onPageSizeChange} /> : null}
  </Surface>;
}
