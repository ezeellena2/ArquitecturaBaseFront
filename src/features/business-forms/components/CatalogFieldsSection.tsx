import { Fragment, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { CheckboxField } from "@/shared/ui/CheckboxField";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/shared/ui/dialog";
import { IconButton } from "@/shared/ui/IconButton";
import { ChevronDownIcon, PencilIcon, PlusIcon, TrashIcon } from "@/shared/ui/icons";
import { Surface } from "@/shared/ui/Surface";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/shared/ui/table";
import { useRestoreFocusOnClose } from "@/shared/hooks/useRestoreFocusOnClose";
import { useMediaQuery } from "@/shared/hooks/useMediaQuery";
import { localizedValue, moveItem } from "../editorModel";
import { newCatalogField, type CatalogFieldDraft } from "../catalogFields";
import type { CatalogReadScope } from "../hooks/useCatalogDraftEditor";
import type { FormCulture } from "../model";
import { CatalogFieldEditor } from "./CatalogFieldEditor";
import type { CatalogFieldFeedback } from "../api/catalogFieldFeedback";
import type { CatalogFieldUsage } from "../api/catalogResponse";

// A FieldInUse 409 marks removing the field or changing its role, type or source.
const inUsePaths = ["isActive", "role", "type", "sourceCatalogId"];
function FieldUses({ uses }: { uses: readonly CatalogFieldUsage[] }) {
  return <ul className="space-y-1 text-sm text-[var(--color-content)]">{uses.map((use, index) => <li key={index}>{use.formName}{use.question ? " · " + use.question : ""}</li>)}</ul>;
}

export function CatalogFieldsSection({ fields, culture, scope, readOnly, confirmedRemovals, errors = {}, feedback, rootErrors, onChange }: { fields: readonly CatalogFieldDraft[]; culture: FormCulture; scope: CatalogReadScope; readOnly: boolean; confirmedRemovals: readonly string[]; errors?: Readonly<Record<string, Readonly<Record<string, readonly string[]>>>>; feedback?: CatalogFieldFeedback | null; rootErrors?: readonly string[]; onChange: (fields: readonly CatalogFieldDraft[], confirmed: readonly string[]) => void }) {
  const { t } = useTranslation("forms");
  const [open, setOpen] = useState(false), [expanded, setExpanded] = useState<string | null>(null);
  const [removing, setRemoving] = useState<string | null>(null), [confirmValues, setConfirmValues] = useState(false);
  const errorStamp = JSON.stringify(errors);
  const [handledErrors, setHandledErrors] = useState("");
  if (handledErrors !== errorStamp) {
    setHandledErrors(errorStamp);
    const failed = fields.find(field => Object.keys(errors[field.localId] ?? {}).length);
    if (failed) { setOpen(true); setExpanded(failed.localId); }
  }
  const addRef = useRef<HTMLButtonElement>(null);
  const restoreFocus = useRestoreFocusOnClose(removing !== null, addRef);
  const desktop = useMediaQuery("(min-width: 640px)");
  const activeFields = fields.filter(field => field.isActive);
  const visibleFields = fields.filter(field => field.isActive || Object.keys(errors[field.localId] ?? {}).length);
  const selected = fields.find(field => field.localId === removing);
  const title = (field: CatalogFieldDraft) => localizedValue(field.name, culture, "es") || t("catalogs.fields.new");
  const change = (next: readonly CatalogFieldDraft[], confirmed = confirmedRemovals) => { if (!readOnly) onChange(next, confirmed); };
  const feedbackCounts = !!feedback && (feedback.missingCount !== undefined || feedback.invalidCount !== undefined || feedback.convertedCount !== undefined || !!feedback.invalidRows?.length);
  const fieldUses = (field: CatalogFieldDraft) => feedback?.uses?.length && inUsePaths.some(path => errors[field.localId]?.[path]) ? <FieldUses uses={feedback.uses} /> : null;
  const editor = (field: CatalogFieldDraft) => <CatalogFieldEditor field={field} scope={scope} readOnly={readOnly} errors={errors[field.localId]} uses={fieldUses(field)} onChange={next => change(fields.map(value => value.localId === next.localId ? next : value))} onDone={() => setExpanded(null)} />;
  const add = () => { if (readOnly || fields.length >= 20) return; const field = newCatalogField(crypto.randomUUID(), fields.length + 1); change([...fields, field]); setOpen(true); setExpanded(field.localId); };
  const restore = (field: CatalogFieldDraft) => {
    change(fields.map(value => value.localId === field.localId ? { ...value, isActive: true } : value), confirmedRemovals.filter(id => id !== field.id));
    setExpanded(field.localId);
  };
  const removedError = (field: CatalogFieldDraft) => !field.isActive ? <div role="alert" className="max-w-sm space-y-1 whitespace-normal text-sm text-[var(--color-danger)]">{Object.values(errors[field.localId] ?? {}).flat().map((message, index) => <p key={index}>{message}</p>)}{fieldUses(field)}</div> : null;
  const actions = (field: CatalogFieldDraft) => {
    if (!field.isActive) return !readOnly ? <Button type="button" variant="outline" onClick={() => restore(field)}>{t("catalogs.fields.restoreField")}</Button> : null;
    const index = activeFields.indexOf(field);
    return <div className="flex justify-end gap-1">{!readOnly ? <><IconButton size="icon-sm" label={t("up", { name: title(field) })} disabled={index === 0} onClick={() => change(moveItem(fields, fields.indexOf(field), -1))}><ChevronDownIcon className="size-4 rotate-180" /></IconButton><IconButton size="icon-sm" label={t("down", { name: title(field) })} disabled={index === activeFields.length - 1} onClick={() => change(moveItem(fields, fields.indexOf(field), 1))}><ChevronDownIcon className="size-4" /></IconButton></> : null}<IconButton size="icon-sm" label={t(readOnly ? "catalogs.fields.viewNamed" : "catalogs.editNamed", { name: title(field) })} aria-expanded={expanded === field.localId} onClick={() => setExpanded(expanded === field.localId ? null : field.localId)}><PencilIcon className="size-4" /></IconButton>{!readOnly ? <IconButton size="icon-sm" label={t("remove", { name: title(field) })} onClick={() => { setRemoving(field.localId); setConfirmValues(false); }}><TrashIcon className="size-4" /></IconButton> : null}</div>;
  };
  return <Surface title={t("catalogs.fields.title")} actions={!readOnly && open ? <Button ref={addRef} type="button" variant="outline" disabled={fields.length >= 20} onClick={add}><PlusIcon className="size-4" />{t("catalogs.fields.add")}</Button> : <Button ref={addRef} type="button" variant="outline" onClick={() => setOpen(!open)}>{t(readOnly ? "catalogs.fields.view" : "catalogs.fields.edit")}</Button>}>
    {rootErrors?.length || feedbackCounts ? <div className="space-y-1 p-4 text-sm text-[var(--color-danger)]" role="alert">{rootErrors?.map(message => <p key={message}>{message}</p>)}{feedback?.missingCount !== undefined ? <p>{t("catalogs.fields.missingValues", { count: feedback.missingCount })}</p> : null}{feedback?.invalidCount !== undefined ? <p>{t("catalogs.fields.invalidValues", { count: feedback.invalidCount })}</p> : null}{feedback?.convertedCount !== undefined ? <p>{t("catalogs.fields.convertedValues", { count: feedback.convertedCount })}</p> : null}{feedback?.invalidRows?.length ? <p>{t("catalogs.fields.invalidCodes", { codes: feedback.invalidRows.map(row => row.code).join(", ") })}</p> : null}</div> : null}
    {!open && desktop ? <div className="flex flex-wrap items-center gap-2 p-4"><p className="text-sm text-[var(--color-content-muted)]">{t("catalogs.fields.fixed")}</p>{activeFields.map(field => <Badge key={field.localId} variant="outline">{title(field)}{field.role === "filter" ? " · " + t("catalogs.fields.roles.filter") : ""}</Badge>)}{!activeFields.length ? <p className="text-sm">{t("catalogs.fields.empty")}</p> : null}</div> : !desktop ? <div className="divide-y divide-[var(--color-border)]">{visibleFields.map(field => <div key={field.localId}><div className="flex items-start gap-2 p-4"><div className="min-w-0 flex-1"><p className="break-words text-sm font-medium">{title(field)}</p><p className="text-xs text-[var(--color-content-muted)]">{t("catalogs.fields.types." + field.type)}</p>{!field.id ? <p className="text-xs">{t("catalogs.fields.unsaved")}</p> : null}{removedError(field)}</div>{actions(field)}</div>{expanded === field.localId && field.isActive ? editor(field) : null}</div>)}{!activeFields.length ? <p className="p-4 text-sm">{t("catalogs.fields.empty")}</p> : null}</div> : <Table><TableHeader><TableRow>{["field", "key", "type", "rules", "role"].map(key => <TableHead key={key} scope="col">{t("catalogs.fields." + key)}</TableHead>)}<TableHead scope="col">{t("actionsColumn")}</TableHead></TableRow></TableHeader><TableBody>{visibleFields.map(field => <Fragment key={field.localId}><TableRow><TableCell><p>{title(field)}</p>{removedError(field)}{!field.id ? <p className="text-xs text-[var(--color-content-muted)]">{t("catalogs.fields.unsaved")}</p> : null}</TableCell><TableCell>{field.key || "—"}</TableCell><TableCell>{t("catalogs.fields.types." + field.type)}</TableCell><TableCell>{[field.required ? t("required") : null, field.unique ? t("catalogs.fields.unique") : null].filter(Boolean).join(" · ") || "—"}</TableCell><TableCell><Badge variant="outline">{t("catalogs.fields.roles." + field.role)}</Badge></TableCell><TableCell>{actions(field)}</TableCell></TableRow>{expanded === field.localId && field.isActive ? <TableRow><TableCell colSpan={6} className="whitespace-normal">{editor(field)}</TableCell></TableRow> : null}</Fragment>)}</TableBody></Table>}
    {!readOnly && !activeFields.length ? <div className="p-4"><Button type="button" variant="outline" onClick={add}>{t("catalogs.fields.add")}</Button></div> : null}
    <Dialog open={!!selected} onOpenChange={next => { if (!next) setRemoving(null); }}><DialogContent onCloseAutoFocus={restoreFocus}><DialogHeader><DialogTitle>{t("catalogs.fields.removeTitle", { name: selected ? title(selected) : "" })}</DialogTitle><DialogDescription>{t(selected?.usedBy.length ? "catalogs.fields.inUse" : "catalogs.fields.removeHint")}</DialogDescription></DialogHeader>{selected?.usedBy.length ? <ul className="space-y-2 text-sm">{selected.usedBy.map((use, index) => <li key={index}>{use.formName}{use.question ? " · " + use.question : ""}</li>)}</ul> : selected?.hasValues ? <CheckboxField label={t("catalogs.fields.confirmRemoval")} checked={confirmValues} onCheckedChange={setConfirmValues} /> : null}<DialogFooter><Button type="button" variant="outline" onClick={() => setRemoving(null)}>{t("common:actions.close")}</Button>{selected && !selected.usedBy.length && !readOnly ? <Button type="button" variant="destructive" disabled={selected.hasValues && !confirmValues} onClick={() => { change(selected.id ? fields.map(field => field.localId === selected.localId ? { ...field, isActive: false } : field) : fields.filter(field => field.localId !== selected.localId), selected.id && selected.hasValues ? [...confirmedRemovals, selected.id] : confirmedRemovals); setExpanded(null); setRemoving(null); }}>{t("catalogs.fields.remove")}</Button> : null}</DialogFooter></DialogContent></Dialog>
  </Surface>;
}
