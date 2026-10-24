import { Checkbox } from "@/shared/ui/checkbox";
import { CatalogInlineInput } from "./CatalogInlineInput";
import { catalogScalarText, catalogTypedValueTypes, type CatalogValueType } from "../catalogValues";
import { catalogItemColumns, catalogTableColumns } from "../catalogColumns";
import { Fragment, useId, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { AlertTriangleIcon, ChevronDownIcon, PencilIcon } from "@/shared/ui/icons";
import { IconButton } from "@/shared/ui/IconButton";
import { TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/shared/ui/table";
import { WideTable, WideTableCell, WideTableHead } from "@/shared/ui/WideTable";
import { localizedValue } from "../editorModel";
import { withCatalogFieldValue, type CatalogManualItemValue } from "../catalogItemEdits";
import type { FormCulture } from "../model";
import { unconvertedFieldValue, type CatalogFieldDraft } from "../catalogFields";
import { catalogItemFieldRule } from "../catalogDraft";
import type { CatalogReadScope } from "../hooks/useCatalogDraftEditor";
import { CatalogExtraFieldInput } from "./CatalogExtraFieldInput";

export function CatalogItemsTable({ items, culture, valueType, fields = [], scope, visibleFieldIds, canManage, busy, hasPendingMoves, totalCount, expandedKey, expandedContent, inline, selected, onSelect, onSelectAll, errors, warnings, sortPending, onExpand, onChange, onMove, onActionRef }: {
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
  fields?: readonly CatalogFieldDraft[]; scope?: CatalogReadScope; visibleFieldIds?: readonly string[];
}) {
  const { t } = useTranslation("forms");
  const readOnly = !canManage || busy;
  const editing = inline && canManage;
  const allColumns = catalogTableColumns(catalogItemColumns(valueType, culture, fields), editing);
  const columns = allColumns.filter(column => !column.field || !visibleFieldIds || visibleFieldIds.includes(column.field.localId));
  const problemId = useId();
  // Typed values are read and shown in the draft's culture, the one its editable text was written in.
  const valueCulture = scope?.culture ?? culture, yesNo = { yes: t("catalogs.presentation.yes"), no: t("catalogs.presentation.no") };
  return (
    <WideTable label={t("catalogs.items.title")} overflowHint={t("catalogs.items.moreColumns")}><TableHeader><TableRow>
      {canManage ? <TableHead scope="col"><Checkbox aria-label={t("catalogs.items.selectPage")} disabled={busy || !items.length} checked={selected.length === items.length && items.length > 0 ? true : selected.length ? "indeterminate" : false} onCheckedChange={value => onSelectAll(value === true)}/></TableHead> : null}
      <TableHead scope="col">#</TableHead>{columns.map(column => <WideTableHead key={column.id} pinned={column.id === "text" ? "start" : undefined} scope="col">{column.field ? localizedValue(column.field.name, culture, "es") : t(column.tableLabelKey)}{column.field && !column.field.id ? <p className="text-xs font-normal normal-case">{t("catalogs.fields.savedFirst")}</p> : null}</WideTableHead>)}<WideTableHead pinned="end" scope="col" className="text-right">{t("actionsColumn")}</WideTableHead>
    </TableRow></TableHeader><TableBody>
      {items.map((item, index) => {
        const name = localizedValue(item.label, culture, "es") || (item.itemId === null ? t("catalogs.items.new") : t("option", { number: item.position }));
        const number = item.position ?? index + 1;
        const messages = errors?.[item.localId];
        const expanded = expandedKey === item.localId;
        const rememberAction = (button: HTMLButtonElement | null) => onActionRef(item.localId, button);
        // While editing, a field value's error goes on its own line under the row, «Fila N · Campo: motivo», which the cell
        // refers to; a hidden column still says it there. It quotes the value and changes with each keystroke, so it is a
        // polite status, not an alert that interrupts the typing.
        const problems = editing ? allColumns.flatMap(column => {
          const message = column.field ? messages?.[column.errorPath]?.join(" ") : undefined;
          return column.field && message ? [{ columnId: column.id, id: problemId + item.localId + column.id, text: t("catalogs.fields.rowProblem", { row: number, field: localizedValue(column.field.name, culture, "es"), message }) }] : [];
        }) : [];
        return <Fragment key={item.localId}><TableRow>
          {canManage ? <TableCell><Checkbox aria-label={t("catalogs.items.selectNamed", { name })} checked={selected.includes(item.localId)} disabled={busy} onCheckedChange={value => onSelect(item.localId, value === true)}/></TableCell> : null}
          <TableCell>{item.itemId === null ? "—" : item.position}</TableCell>{columns.map(column => {
            const error = messages?.[column.errorPath]?.join(" ");
            let content: ReactNode;
            if (column.field) {
              const field = catalogItemFieldRule(column.field, item), key = field.id ?? field.localId, value = item.fields?.[key], texts = item.fieldTexts?.[key];
              const problem = problems.find(problem => problem.columnId === column.id);
              if (editing) content = <CatalogExtraFieldInput field={field} scope={scope} label={t("catalogs.fields.valueLabel", { row: number, field: localizedValue(field.name, culture, "es") })} value={value} texts={texts} culture={culture} readOnly={readOnly} aria-invalid={problem ? true : undefined} aria-describedby={problem?.id} onChange={(value, texts) => onChange(withCatalogFieldValue(item, key, value, texts))} />;
              else {
                const shown = value === null || value === undefined ? "—" : field.type === "catalog" && texts ? localizedValue(texts, culture, "es") : unconvertedFieldValue(field.type, value) ?? (field.type === "catalog" ? "—" : field.type === "text" ? value : catalogScalarText(field.type, value, valueCulture, yesNo, valueCulture));
                // The text cell (below 640 px or without Manage) keeps its mark, such as a value the new type does not take.
                content = error ? <><p>{shown}</p><p className="whitespace-normal text-xs text-[var(--color-danger)]">{error}</p></> : shown;
              }
            } else switch (column.id) {
              case "text": content = editing ? <CatalogInlineInput label={t("catalogs.items.inlineText", { number })} value={item.label[culture] ?? ""} readOnly={readOnly} count error={error} warning={warnings?.[item.localId]} onChange={value => onChange({ ...item, label: { ...item.label, [culture]: value } })}/> : <><p>{name}</p><p className="text-xs text-[var(--color-content-muted)]">{item.code}</p></>; break;
              case "code": content = <CatalogInlineInput maxLength={column.maxLength} label={t("catalogs.items.inlineCode", { number })} value={item.code} readOnly={readOnly} error={error} onChange={code => onChange({ ...item, code })}/>; break;
              case "value": content = editing ? <CatalogInlineInput maxLength={column.maxLength} label={t("catalogs.items.inlineValue", { number })} value={item.value ?? ""} readOnly={readOnly} type={column.inputType} inputMode={column.inputMode} error={error} onChange={value => onChange({ ...item, value: value || null })}/> : valueType === "Text" || !item.value ? item.value || "—" : catalogScalarText(catalogTypedValueTypes[valueType], item.value, valueCulture, yesNo, valueCulture); break;
              case "detail": content = editing ? <CatalogInlineInput maxLength={column.maxLength} label={t("catalogs.items.inlineDetail", { number })} value={item.detail[culture] ?? ""} readOnly={readOnly} error={error} onChange={value => onChange({ ...item, detail: { ...item.detail, [culture]: value || null } })}/> : localizedValue(item.detail, culture, "es") || "—"; break;
              case "isActive": content = editing ? <Checkbox aria-label={t("catalogs.items.activeNamed", { name })} checked={item.isActive} disabled={readOnly} onCheckedChange={value => onChange({ ...item, isActive: value === true })}/> : <Badge variant="outline">{t(item.isActive ? "catalogs.items.active" : "catalogs.state.Inactive")}</Badge>; break;
            }
            return <WideTableCell key={column.id} pinned={column.id === "text" ? "start" : undefined}>{content}</WideTableCell>;
          })}
          <WideTableCell pinned="end" className="text-right">{canManage ? <div className="flex justify-end gap-1">
            {onMove ? <><IconButton size="icon-sm" label={item.itemId === null ? t("catalogs.items.moveAfterSave", { action: t("up", { name }) }) : t("up", { name })} disabled={readOnly || sortPending || item.itemId === null || !hasPendingMoves && item.position === 1} onClick={() => onMove(item, -1)}><ChevronDownIcon className="size-4 rotate-180" /></IconButton>
            <IconButton size="icon-sm" label={item.itemId === null ? t("catalogs.items.moveAfterSave", { action: t("down", { name }) }) : t("down", { name })} disabled={readOnly || sortPending || item.itemId === null || !hasPendingMoves && item.position === totalCount} onClick={() => onMove(item, 1)}><ChevronDownIcon className="size-4" /></IconButton></> : null}
            {item.isActive || expanded ? <IconButton ref={rememberAction} size="icon-sm" label={t("catalogs.editNamed", { name })} disabled={busy} aria-expanded={expanded} onClick={() => onExpand(expanded ? null : item.localId)}><PencilIcon className="size-4" /></IconButton>
              : <Button ref={rememberAction} type="button" variant="outline" size="sm" disabled={busy} aria-label={t("catalogs.items.reactivateNamed", { name })} onClick={() => onChange({ ...item, isActive: true })}>{t("catalogs.items.reactivate")}</Button>}
          </div> : null}</WideTableCell>
        </TableRow>{problems.length ? <TableRow><TableCell colSpan={columns.length + 2 + (canManage ? 1 : 0)} className="whitespace-normal">{problems.map(problem => <p key={problem.id} id={problem.id} role="status" className="sticky left-4 flex w-fit items-start gap-1 text-xs text-[var(--color-danger)]"><AlertTriangleIcon className="mt-px size-3.5 shrink-0" />{problem.text}</p>)}</TableCell></TableRow> : null}{expanded && expandedContent ? <TableRow><TableCell colSpan={columns.length + 2 + (canManage ? 1 : 0)} className="whitespace-normal">{expandedContent}</TableCell></TableRow> : null}</Fragment>;
      })}
    </TableBody></WideTable>
  );
}
