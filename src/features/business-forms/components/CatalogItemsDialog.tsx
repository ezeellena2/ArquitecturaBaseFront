import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useMediaQuery } from "@/shared/hooks/useMediaQuery";
import { useRestoreFocusOnClose } from "@/shared/hooks/useRestoreFocusOnClose";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { ConfirmDialog } from "@/shared/ui/ConfirmDialog";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/shared/ui/dialog";
import { AlertTriangleIcon, PlusIcon, TrashIcon } from "@/shared/ui/icons";
import { Surface } from "@/shared/ui/Surface";
import type { CatalogValueType } from "../catalogValues";
import type { CatalogManualItemValue } from "../catalogItemEdits";
import type { CatalogFieldDraft } from "../catalogFields";
import type { CatalogReadScope } from "../hooks/useCatalogDraftEditor";
import type { FormCulture } from "../model";
import { administrativeName } from "../editorModel";
import { CatalogItemFields } from "./CatalogItemFields";

export interface CatalogItemsDialogProps {
  catalogName: string;
  /** «Agregar opción» lists only the options added in the modal; the pencil and a failed Save, the page's options. */
  mode: "new" | "edit";
  items: readonly CatalogManualItemValue[];
  /** The chosen option. On the phone, null shows the list. */
  selectedId: string | null;
  /** The catalog's saved options, for «Opción N de M»; `range` is the page's, for the pencil's list. */
  totalCount: number; range?: string;
  /** The menu language, in which the texts are edited, and the catalog's original. */
  culture: FormCulture; original: FormCulture;
  valueType: CatalogValueType;
  fields?: readonly CatalogFieldDraft[]; scope?: CatalogReadScope;
  readOnly: boolean;
  errors?: Readonly<Record<string, Readonly<Record<string, readonly string[]>>>>; warnings?: Readonly<Record<string, string>>;
  pendingTexts?: Readonly<Record<string, Readonly<Record<string, string>>>>;
  deletedItemIds?: readonly string[]; deleteErrors?: Readonly<Record<string, string>>;
  onSelect: (localId: string | null) => void;
  onChange: (item: CatalogManualItemValue) => void;
  onFieldBlur?: (localId: string, path: string) => void;
  onGenerateCode?: (item: CatalogManualItemValue) => void;
  onAdd: () => void;
  /** A new option leaves the draft without asking; a saved one is marked to delete on Save after confirming. */
  onRemove: (item: CatalogManualItemValue) => void; onDelete: (item: CatalogManualItemValue) => void; onRestore: (item: CatalogManualItemValue) => void;
  onDone: () => void; onCancel: () => void;
}

// The options in a modal like «Campos de…» (B, 2026-10-31): the list on the left and the chosen option on the right, each in
// its box; on the phone, first the list and then the option. It edits the draft as it is typed: «Listo» keeps it, «Cancelar»
// or Esc ask the page to put it back. It is mounted only while open.
export function CatalogItemsDialog({ catalogName, mode, items, selectedId, totalCount, range, culture, original, valueType, fields, scope, readOnly, errors, warnings, pendingTexts, deletedItemIds = [], deleteErrors, onSelect, onChange, onFieldBlur, onGenerateCode, onAdd, onRemove, onDelete, onRestore, onDone, onCancel }: CatalogItemsDialogProps) {
  const { t } = useTranslation("forms");
  const desktop = useMediaQuery("(min-width: 640px)");
  const restoreFocus = useRestoreFocusOnClose();
  const [deleting, setDeleting] = useState<CatalogManualItemValue | null>(null);
  const selected = items.find(item => item.localId === selectedId) ?? (desktop ? items[0] : undefined);
  const name = (item: CatalogManualItemValue) => administrativeName(item.label, culture) || (item.itemId === null ? t("catalogs.items.new") : t("option", { number: item.position }));
  const deleted = (item: CatalogManualItemValue) => item.itemId !== null && deletedItemIds.includes(item.itemId);
  const marked = (item: CatalogManualItemValue) => Object.values(errors?.[item.localId] ?? {}).some(messages => messages.length > 0);
  const remove = (item: CatalogManualItemValue) => {
    if (item.itemId !== null) { setDeleting(item); return; }
    const index = items.indexOf(item);
    onRemove(item);
    onSelect(items[index + 1]?.localId ?? items[index - 1]?.localId ?? null);
  };
  const listTitle = t(mode === "new" ? "catalogs.items.listNew" : "catalogs.items.title");

  // The list in its box: a line between options, the chosen one tinted with a bar on its edge, and «Agregar opción» at the foot.
  const list = <Surface title={listTitle} headingLevel={3} actions={<span className="text-xs text-[var(--color-surface-header-foreground)]">{mode === "new" ? items.length : range}</span>}>
    {items.length ? <ul aria-label={listTitle} className="flex flex-col divide-y divide-[var(--color-border)]">{items.map(item => {
      const current = item.localId === selected?.localId;
      return <li key={item.localId} className={"flex items-center gap-1 p-1" + (current && desktop ? " bg-[var(--color-brand-50)] shadow-[inset_3px_0_0_var(--color-brand-600)]" : "")}>
        <Button type="button" variant="ghost" size="touch" className="min-w-0 flex-1 justify-start text-left" aria-current={current && desktop ? "true" : undefined} aria-label={t("catalogs.editNamed", { name: name(item) })} onClick={() => onSelect(item.localId)}>
          <span className="w-5 shrink-0 text-xs text-[var(--color-content-muted)]">{item.itemId === null ? "—" : item.position}</span>
          <span className="flex min-w-0 flex-1 flex-col gap-0.5">
            <span className="flex min-w-0 items-center gap-1.5"><span className="truncate">{name(item)}</span>{item.itemId === null ? <Badge variant="warning">{t("catalogs.items.newBadge")}</Badge> : null}{marked(item) ? <AlertTriangleIcon className="size-3.5 shrink-0 text-[var(--color-danger)]" /> : null}</span>
            <span className={"truncate text-xs font-normal " + (deleted(item) ? "text-[var(--color-danger)]" : "text-[var(--color-content-muted)]")}>{deleted(item) ? t("catalogs.items.deletedState") : item.code || t("catalogs.items.noCode")}</span>
          </span>
        </Button>
      </li>;
    })}</ul> : <p className="p-4 text-sm">{t("catalogs.items.empty")}</p>}
    {!readOnly ? <div className="border-t border-[var(--color-border)] p-2"><Button type="button" variant="outline" onClick={onAdd}><PlusIcon className="size-4" />{t("addOption")}</Button></div> : null}
  </Surface>;

  // The chosen option in its box: its band says which one it is and carries «Quitar opción».
  const removed = !!selected && deleted(selected);
  const pane = selected ? <Surface title={selected.itemId === null ? t("catalogs.items.new") : t("catalogs.items.position", { number: selected.position, count: totalCount })} headingLevel={3} padded={removed}
    actions={!readOnly && !removed ? <Button type="button" variant="destructive-outline" onClick={() => remove(selected)}><TrashIcon className="size-4" />{t("catalogs.items.removeOption")}</Button> : null}>
    {removed ? <div className="flex flex-col gap-3">
      <p className="text-sm font-medium">{name(selected)}</p>
      <p className="text-sm text-[var(--color-danger)]">{t("catalogs.items.deletedState")}</p>
      {deleteErrors?.[selected.localId] ? <p role="alert" className="text-sm text-[var(--color-danger)]">{deleteErrors[selected.localId]}</p> : null}
      {!readOnly ? <Button type="button" variant="outline" className="self-start" onClick={() => onRestore(selected)}>{t("catalogs.items.restore")}</Button> : null}
    </div> : <CatalogItemFields key={selected.localId} item={selected} culture={culture} original={original} valueType={valueType} fields={fields} scope={scope} readOnly={readOnly}
      errors={errors?.[selected.localId]} warning={warnings?.[selected.localId]} pendingTexts={pendingTexts?.[selected.localId]} onGenerateCode={onGenerateCode ? () => onGenerateCode(selected) : undefined}
      onChange={onChange} onFieldBlur={path => onFieldBlur?.(selected.localId, path)} />}
  </Surface> : null;

  const onPhoneItem = !desktop && !!selected;
  return <Dialog open onOpenChange={open => { if (!open) onCancel(); }}>
    {/* The option puts the cursor in its Texto (or the page in its first marked control), so the dialog does not take it. */}
    <DialogContent mobileFullscreen aria-describedby={undefined} className="flex flex-col sm:max-w-4xl" onOpenAutoFocus={event => { if (selected && !removed) event.preventDefault(); }} onCloseAutoFocus={restoreFocus}>
      <DialogHeader><DialogTitle className="pr-6">{t(mode === "new" ? "catalogs.items.dialogNew" : "catalogs.items.dialogEdit", { name: catalogName })}</DialogTitle></DialogHeader>
      <div className="min-h-0 flex-1 overflow-y-auto">
        {desktop ? <div className="grid items-start gap-4 sm:grid-cols-[18rem_minmax(0,1fr)]">{list}{pane}</div> : onPhoneItem ? pane : list}
      </div>
      <DialogFooter className="shrink-0 sm:items-center">
        {onPhoneItem ? <Button type="button" variant="outline" onClick={() => onSelect(null)}>{t("catalogs.fields.backToList")}</Button>
          : readOnly ? <Button type="button" variant="outline" onClick={onCancel}>{t("common:actions.close")}</Button>
          : <><Button type="button" variant="outline" onClick={onCancel}>{t("common:actions.cancel")}</Button><Button type="button" onClick={onDone}>{t("done")}</Button></>}
      </DialogFooter>
      <ConfirmDialog open={deleting !== null} onOpenChange={open => { if (!open) setDeleting(null); }} title={t("catalogs.items.deleteTitle", { name: deleting ? name(deleting) : "" })}
        confirmLabel={t("catalogs.items.deleteConfirm")} destructive onConfirm={() => { if (deleting) onDelete(deleting); }} />
    </DialogContent>
  </Dialog>;
}
