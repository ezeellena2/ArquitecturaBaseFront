import { Fragment, useEffect, useId, useRef, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { useMediaQuery } from "@/shared/hooks/useMediaQuery";
import { useRestoreFocusOnClose } from "@/shared/hooks/useRestoreFocusOnClose";
import { ActionTooltip } from "@/shared/ui/ActionTooltip";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { Checkbox } from "@/shared/ui/checkbox";
import { CheckboxField } from "@/shared/ui/CheckboxField";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/shared/ui/dialog";
import { Surface } from "@/shared/ui/Surface";
import { DisabledReason } from "@/shared/ui/DisabledReason";
import { IconButton } from "@/shared/ui/IconButton";
import { AlertTriangleIcon, ChevronDownIcon, InfoIcon, LockIcon, PlusIcon, TrashIcon } from "@/shared/ui/icons";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import { NativeSelect } from "@/shared/ui/NativeSelect";
import { SegmentedControl } from "@/shared/ui/SegmentedControl";
import type { CatalogFieldFeedback } from "../api/catalogFieldFeedback";
import { catalogFieldTypes, type CatalogPresentation } from "../api/catalogResponse";
import { catalogFieldHasErrors, catalogFieldRuleSummary, newCatalogField, type CatalogFieldDraft, type CatalogFieldErrors, type CatalogFieldType } from "../catalogFields";
import { administrativeName, contentReference, contentRequired, moveItem } from "../editorModel";
import type { CatalogReadScope } from "../hooks/useCatalogDraftEditor";
import type { FormCulture } from "../model";
import { localizedIssue, localizedIssueMessage } from "../validationPaths";
import { CatalogFieldSourceInput } from "./CatalogFieldSourceInput";
import { CatalogFieldSourceSummary } from "./CatalogFieldSourceSummary";
import { CatalogFieldUses } from "./CatalogFieldUses";

const maxFields = 20;
const rangeTypes: readonly CatalogFieldType[] = ["integer", "decimal", "date"];
// A FieldInUse 409 marks removing the field or changing its role, type or source.
const inUsePaths = ["isActive", "role", "type", "sourceCatalogId"];
type FieldMessages = Readonly<Record<string, readonly string[]>>;

export interface CatalogFieldsDialogProps {
  catalogName: string;
  fields: readonly CatalogFieldDraft[];
  /** The draft's «En WhatsApp»: it says whether removing a field also takes it out of there. */
  presentation: CatalogPresentation | null;
  /** Names are edited in the menu language (`culture`); only the catalog's original (`original`) is required. */
  culture: FormCulture; original: FormCulture;
  scope: CatalogReadScope;
  /** Without Manage, while saving or with a pending review: every field as text. */
  readOnly: boolean;
  confirmedRemovals: readonly string[];
  errors?: CatalogFieldErrors;
  feedback?: CatalogFieldFeedback | null;
  /** The saved type of each saved field: changing it in a field with values says that saving checks them. */
  savedTypes?: Readonly<Record<string, CatalogFieldType>>;
  /** The field «Revisar» opens, with the focus on its first marked control. */
  initialFieldId?: string | null;
  onApply: (fields: readonly CatalogFieldDraft[], confirmed: readonly string[]) => void;
  onClose: () => void;
}

// Every field of a catalog in one modal (C, 2026-10-27): the list on the left and the chosen field on the right, each in its
// box; on the phone, first the list and then the field. It edits a copy: «Listo» leaves it in the catalog, which «Guardar»
// saves, and «Cancelar» or Esc discard it. It is mounted only while open.
export function CatalogFieldsDialog({ catalogName, fields, presentation, culture, original, scope, readOnly, confirmedRemovals, errors = {}, feedback, savedTypes, initialFieldId = null, onApply, onClose }: CatalogFieldsDialogProps) {
  const { t } = useTranslation("forms");
  const desktop = useMediaQuery("(min-width: 640px)");
  const restoreFocus = useRestoreFocusOnClose();
  // «Agregar campos» on a catalog without fields opens on a new one; untouched, «Listo» leaves nothing in the catalog.
  const [starting] = useState(() => !readOnly && !fields.some(field => field.isActive || catalogFieldHasErrors(errors, field)));
  const [draft, setDraft] = useState(() => ({ fields: starting ? [...fields, newCatalogField(crypto.randomUUID(), fields.length + 1)] : fields, confirmed: confirmedRemovals, changed: false }));
  // What the server said stays until something is edited here, as anywhere else on the page; a new error shows again.
  const errorStamp = JSON.stringify(errors);
  const [hiddenErrors, setHiddenErrors] = useState<string | null>(null);
  const shown: CatalogFieldErrors = hiddenErrors === errorStamp ? {} : errors;
  // A removed field stays in the list while the server says something about it, with Restore.
  const visible = draft.fields.filter(field => field.isActive || catalogFieldHasErrors(errors, field));
  const active = draft.fields.filter(field => field.isActive);
  const [selectedId, setSelectedId] = useState<string | null>(() => initialFieldId ?? (desktop || starting ? visible[0]?.localId ?? null : null));
  const selected = visible.find(field => field.localId === selectedId) ?? (desktop ? visible[0] : undefined);
  // «Revisar», choosing a field or adding one puts the cursor in it; just opening leaves the focus on the list.
  const [focusField, setFocusField] = useState(initialFieldId !== null || starting);
  const [removing, setRemoving] = useState<string | null>(null), [confirmValues, setConfirmValues] = useState(false);
  const [returnTo, setReturnTo] = useState<string | null>(null);
  const rows = useRef(new Map<string, HTMLButtonElement>());
  const addRef = useRef<HTMLButtonElement>(null);
  const restoreRemoveFocus = useRestoreFocusOnClose(removing !== null, addRef);
  useEffect(() => { if (returnTo) rows.current.get(returnTo)?.focus(); }, [returnTo]);
  const title = (field: CatalogFieldDraft) => administrativeName(field.name, culture) || t("catalogs.fields.new");
  const canOpenForms = scope.permissions.includes("formtemplates.read");
  const update = (next: readonly CatalogFieldDraft[], confirmed = draft.confirmed) => { setDraft({ fields: next, confirmed, changed: true }); setHiddenErrors(errorStamp); };
  const choose = (field: CatalogFieldDraft) => { setSelectedId(field.localId); setFocusField(true); setReturnTo(null); };
  const add = () => {
    if (readOnly || active.length >= maxFields) return;
    const field = newCatalogField(crypto.randomUUID(), draft.fields.length + 1);
    update([...draft.fields, field]);
    choose(field);
  };
  // The arrows move between active fields: swap with the active neighbor, leaving removed fields in place.
  const move = (field: CatalogFieldDraft, delta: -1 | 1) => {
    const neighbor = active[active.indexOf(field) + delta];
    if (!neighbor) return;
    const from = draft.fields.indexOf(field);
    update(moveItem(draft.fields, from, draft.fields.indexOf(neighbor) - from));
  };
  const restore = (field: CatalogFieldDraft) => { update(draft.fields.map(value => value.localId === field.localId ? { ...value, isActive: true } : value), draft.confirmed.filter(id => id !== field.id)); setFocusField(true); };
  const apply = () => { if (draft.changed) onApply(draft.fields, draft.confirmed); onClose(); };
  const backToList = () => { setReturnTo(selected?.localId ?? null); setSelectedId(null); };
  const uses = (field: CatalogFieldDraft) => feedback?.uses?.length && inUsePaths.some(path => shown[field.localId]?.[path]?.length) ? <CatalogFieldUses uses={feedback.uses} canOpenForms={canOpenForms} /> : null;

  // With a single field there is nothing to move: no arrows, so its name has the room.
  const arrows = (field: CatalogFieldDraft) => {
    if (active.length < 2) return null;
    const index = active.indexOf(field);
    return <div className="flex shrink-0 gap-1">
      <IconButton size="icon-sm" label={t("up", { name: title(field) })} disabled={index <= 0} onClick={() => move(field, -1)}><ChevronDownIcon className="size-4 rotate-180" /></IconButton>
      <IconButton size="icon-sm" label={t("down", { name: title(field) })} disabled={index === active.length - 1} onClick={() => move(field, 1)}><ChevronDownIcon className="size-4" /></IconButton>
    </div>;
  };
  // The list in its box: a line between fields, the chosen one tinted with a bar on its edge, and «Agregar campo» at the foot.
  const list = <Surface title={t("catalogs.fields.title")} headingLevel={3} actions={!readOnly ? <span className="text-xs text-[var(--color-surface-header-foreground)]">{t("catalogs.fields.count", { count: active.length, max: maxFields })}</span> : null}>
    {visible.length ? <ul aria-label={t("catalogs.fields.title")} className="flex flex-col divide-y divide-[var(--color-border)]">{visible.map(field => {
      const current = field.localId === selected?.localId;
      return <li key={field.localId} className={"flex items-center gap-1 p-1" + (current && desktop ? " bg-[var(--color-brand-50)] shadow-[inset_3px_0_0_var(--color-brand-600)]" : "")}>
        <Button ref={button => { if (button) rows.current.set(field.localId, button); else rows.current.delete(field.localId); }} type="button" variant="ghost" size="touch" className="min-w-0 flex-1 justify-start text-left" aria-current={current && desktop ? "true" : undefined} aria-label={t(readOnly ? "catalogs.fields.viewNamed" : "catalogs.editNamed", { name: title(field) })} onClick={() => choose(field)}>
          <span className="w-5 shrink-0 text-xs text-[var(--color-content-muted)]">{field.isActive ? active.indexOf(field) + 1 : "—"}</span>
          <span className="flex min-w-0 flex-1 flex-col gap-0.5">
            <span className="flex min-w-0 items-center gap-1.5"><span className="truncate">{title(field)}</span>{!field.id ? <Badge variant="warning">{t("catalogs.fields.newBadge")}</Badge> : null}{catalogFieldHasErrors(shown, field) ? <AlertTriangleIcon className="size-3.5 shrink-0 text-[var(--color-danger)]" /> : null}</span>
            <span className="truncate text-xs font-normal text-[var(--color-content-muted)]">{field.isActive ? t("catalogs.fields.types." + field.type) + " · " + t("catalogs.fields.roles." + field.role) : t("catalogs.fields.removedState")}</span>
          </span>
        </Button>
        {current && desktop && !readOnly && field.isActive ? arrows(field) : null}
      </li>;
    })}</ul> : <p className="p-4 text-sm">{t("catalogs.fields.empty")}</p>}
    {!readOnly ? <div className="border-t border-[var(--color-border)] p-2">
      <DisabledReason reason={active.length >= maxFields ? t("catalogs.fields.limit", { count: maxFields }) : null}><Button ref={addRef} type="button" variant="outline" disabled={active.length >= maxFields} onClick={add}><PlusIcon className="size-4" />{t("catalogs.fields.add")}</Button></DisabledReason>
    </div> : null}
  </Surface>;

  // The chosen field in its box: its band says which one it is and carries «Quitar campo» (and the arrows on the phone).
  const pane = selected ? <Surface title={selected.id ? t("catalogs.fields.position", { number: active.indexOf(selected) + 1, count: active.length }) : t("catalogs.fields.new")} headingLevel={3}
    padded={!selected.isActive || readOnly}
    actions={!readOnly && selected.isActive ? <>{!desktop ? arrows(selected) : null}<Button type="button" variant="destructive-outline" onClick={() => { setRemoving(selected.localId); setConfirmValues(false); }}><TrashIcon className="size-4" />{t("catalogs.fields.removeField")}</Button></> : null}>
    {!selected.isActive ? <RemovedField title={title(selected)} messages={shown[selected.localId] ?? {}} uses={uses(selected)} readOnly={readOnly} onRestore={() => restore(selected)} />
      : readOnly ? <FieldText field={selected} title={title(selected)} scope={scope} />
      : <FieldForm key={selected.localId} field={selected} culture={culture} original={original} scope={scope} errors={shown[selected.localId] ?? {}} uses={uses(selected)} focusOnOpen={focusField}
        typeChanged={!!selected.id && selected.valuesCount > 0 && !!savedTypes?.[selected.id] && savedTypes[selected.id] !== selected.type}
        onChange={next => update(draft.fields.map(value => value.localId === next.localId ? next : value))} />}
  </Surface> : null;

  const removingField = draft.fields.find(field => field.localId === removing);
  // Only forms block removing. The server's Catalog use reflects what is saved; the draft's presentation decides here,
  // because removing the field takes it out of the draft's «En WhatsApp».
  const formUses = removingField?.usedBy.filter(use => use.stage !== "Catalog") ?? [];
  const ownPresentation = !!removingField?.id && !!presentation && [...presentation.title, ...presentation.description].includes(removingField.id);
  // The saved values it takes away (the server's count of options with a value): removing them asks for the checkbox.
  const removedValues = removingField?.valuesCount ?? 0;
  const remove = () => {
    if (!removingField) return;
    update(removingField.id ? draft.fields.map(field => field.localId === removingField.localId ? { ...field, isActive: false } : field) : draft.fields.filter(field => field.localId !== removingField.localId),
      removingField.id && removedValues > 0 ? [...draft.confirmed, removingField.id] : draft.confirmed);
    setRemoving(null);
  };

  const onPhoneField = !desktop && !!selected;
  return <Dialog open onOpenChange={open => { if (!open) onClose(); }}>
    <DialogContent mobileFullscreen aria-describedby={undefined} className="flex flex-col sm:max-w-4xl" onOpenAutoFocus={event => { if (focusField) event.preventDefault(); }} onCloseAutoFocus={restoreFocus}>
      <DialogHeader><DialogTitle className="pr-6">{t("catalogs.fields.dialogTitle", { name: catalogName })}</DialogTitle></DialogHeader>
      <div className="min-h-0 flex-1 overflow-y-auto">
        {desktop ? <div className="grid items-start gap-4 sm:grid-cols-[18rem_minmax(0,1fr)]">{list}{pane}</div> : onPhoneField ? pane : list}
      </div>
      <DialogFooter className="shrink-0 sm:items-center">
        {onPhoneField ? <Button type="button" variant="outline" onClick={backToList}>{t("catalogs.fields.backToList")}</Button>
          : readOnly ? <Button type="button" variant="outline" onClick={onClose}>{t("common:actions.close")}</Button>
          : <><Button type="button" variant="outline" onClick={onClose}>{t("common:actions.cancel")}</Button><Button type="button" onClick={apply}>{t("done")}</Button></>}
      </DialogFooter>
      <Dialog open={!!removingField} onOpenChange={open => { if (!open) setRemoving(null); }}><DialogContent onCloseAutoFocus={restoreRemoveFocus}>
        <DialogHeader><DialogTitle>{t("catalogs.fields.removeTitle", { name: removingField ? title(removingField) : "" })}</DialogTitle><DialogDescription>{t(formUses.length ? "catalogs.fields.inUse" : "catalogs.fields.removeHint")}</DialogDescription></DialogHeader>
        {formUses.length || ownPresentation ? <CatalogFieldUses uses={formUses} ownPresentation={ownPresentation} canOpenForms={canOpenForms} onNavigate={() => setRemoving(null)} /> : null}
        {!formUses.length && removedValues > 0 ? <CheckboxField label={t("catalogs.fields.confirmRemoval", { count: removedValues })} checked={confirmValues} onCheckedChange={setConfirmValues} /> : null}
        <DialogFooter><Button type="button" variant="outline" onClick={() => setRemoving(null)}>{t("common:actions.close")}</Button>{!formUses.length ? <Button type="button" variant="destructive" disabled={removedValues > 0 && !confirmValues} onClick={remove}>{t("catalogs.fields.remove")}</Button> : null}</DialogFooter>
      </DialogContent></Dialog>
    </DialogContent>
  </Dialog>;
}

// A row of the field: the label on the left from 640 px, on top below.
function Row({ label, children }: { label: ReactNode; children: ReactNode }) {
  return <div className="grid gap-1.5 sm:grid-cols-[6rem_minmax(0,1fr)] sm:gap-x-4">
    <div className="flex items-center gap-1 sm:min-h-[var(--height-control)] sm:self-start">{label}</div>
    <div className="flex min-w-0 flex-col gap-1.5">{children}</div>
  </div>;
}
function Message({ id, error, children }: { id?: string; error?: boolean; children: ReactNode }) {
  return <p id={id} role={error ? "alert" : undefined} className={error ? "text-sm text-[var(--color-danger)]" : "text-sm text-[var(--color-content-muted)]"}>{children}</p>;
}
function Help({ label, text }: { label: string; text: string }) {
  return <ActionTooltip label={text}><Button type="button" variant="ghost" size="icon-xs" aria-label={label}><InfoIcon className="size-3.5" /></Button></ActionTooltip>;
}

function FieldForm({ field, culture, original, scope, errors, uses, typeChanged, focusOnOpen, onChange }: { field: CatalogFieldDraft; culture: FormCulture; original: FormCulture; scope: CatalogReadScope; errors: FieldMessages; uses: ReactNode; typeChanged: boolean; focusOnOpen: boolean; onChange: (field: CatalogFieldDraft) => void }) {
  const { t } = useTranslation("forms");
  const id = useId();
  const root = useRef<HTMLDivElement>(null), nameRef = useRef<HTMLInputElement>(null);
  // Choosing or adding the field puts the cursor in its first marked control, or in Nombre. The form is mounted per field.
  const [focusOnMount] = useState(focusOnOpen);
  useEffect(() => { if (focusOnMount) (root.current?.querySelector<HTMLElement>('[aria-invalid="true"]') ?? nameRef.current)?.focus(); }, [focusOnMount]);
  const set = (next: Partial<CatalogFieldDraft>) => onChange({ ...field, ...next });
  const changeType = (type: CatalogFieldType) => set({ type, sourceCatalogId: type === "catalog" ? field.sourceCatalogId : null, min: rangeTypes.includes(type) ? field.min : null, max: rangeTypes.includes(type) ? field.max : null, maxLength: type === "text" ? field.maxLength : null });
  const error = (path: string) => errors[path]?.length ? errors[path]!.join(" ") : undefined;
  const marked = (path: string) => error(path) ? { "aria-invalid": true, "aria-describedby": id + path + "-message" } : {};
  const messageOf = (path: string) => error(path) ? <Message id={id + path + "-message"} error>{error(path)}</Message> : null;
  // The name may fail in either language; a restore the server rejected is said under it too.
  const nameError = [localizedIssueMessage(localizedIssue(errors, "name", culture), culture, t), error("isActive")].filter(Boolean).join(" ") || undefined;
  const reference = contentReference(field.name, culture, original);
  const nameHint = reference ? t("originalText", { language: t("cultures." + original), text: reference }) : undefined;
  const typeHint = error("type") ?? (typeChanged ? t("catalogs.fields.typeReview") : undefined);
  const bound = (key: "min" | "max") => <Input type={field.type === "date" ? "date" : "text"} inputMode={field.type === "integer" ? "numeric" : field.type === "decimal" ? "decimal" : undefined} className={field.type === "date" ? "w-40" : "w-24"} aria-label={t("catalogs.fields." + key)} value={field[key] ?? ""} onChange={event => set({ [key]: event.target.value || null })} {...marked(key)} />;
  // The type's detail goes on its own row under Tipo: a length, a range or the source catalog.
  const detailKind = field.type === "text" ? "text" : rangeTypes.includes(field.type) ? "range" : field.type === "catalog" ? "catalog" : null;
  const detail = field.type === "text" ? <div className="flex items-center gap-2 text-sm text-[var(--color-content-muted)]">{t("catalogs.fields.inline.upTo")}<Input type="number" min={1} max={300} className="w-20" aria-label={t("maxLength")} value={field.maxLength ?? ""} onChange={event => set({ maxLength: event.target.value ? Number(event.target.value) : null })} {...marked("maxLength")} />{t("catalogs.fields.inline.characters")}</div>
    // Each word stays with its control: two dates that do not fit side by side go one under the other, never a lone «a».
    : rangeTypes.includes(field.type) ? <div className="flex flex-wrap items-center gap-2 text-sm text-[var(--color-content-muted)]"><span className="flex items-center gap-2">{t("catalogs.fields.inline.from")}{bound("min")}</span><span className="flex items-center gap-2">{t("catalogs.fields.inline.to")}{bound("max")}</span></div>
    : field.type === "catalog" ? <CatalogFieldSourceInput scope={scope} value={field.sourceCatalogId} label={t("catalogQuestion.catalog")} readOnly={false} onChange={sourceCatalogId => set({ sourceCatalogId })} {...marked("sourceCatalogId")} />
    : null;
  // A new field starts optional: its Obligatorio says why as a tooltip and its description, without a text under it.
  const check = (path: "required" | "unique", label: string, reason: string | null) => <div className="flex flex-col gap-1">
    <div className="flex items-center gap-2"><DisabledReason reason={reason} id={id + path} {...marked(path)}><Checkbox checked={field[path]} disabled={!!reason} onCheckedChange={value => set({ [path]: value === true })} /></DisabledReason><Label htmlFor={id + path} className="font-normal">{label}</Label></div>
    {messageOf(path)}
  </div>;
  // A line between rows; the type and its detail share one.
  return <div ref={root} className="flex flex-col divide-y divide-[var(--color-border)] [&>*]:px-4 [&>*]:py-3">
    {uses ? <div>{uses}</div> : null}
    <Row label={<Label htmlFor={id + "name"}>{t("name")}{contentRequired(field.name, culture, original) ? <span aria-hidden="true"> *</span> : null}</Label>}>
      <Input ref={nameRef} id={id + "name"} maxLength={120} placeholder={culture !== original ? t("missingText") : undefined} value={field.name[culture] ?? ""} aria-invalid={nameError ? true : undefined} aria-describedby={nameError || nameHint ? id + "name-message" : undefined} onChange={event => set({ name: { ...field.name, [culture]: event.target.value } })} />
      {nameError || nameHint ? <Message id={id + "name-message"} error={!!nameError}>{nameError ?? nameHint}</Message> : null}
    </Row>
    <Row label={<><Label htmlFor={id + "key"}>{t("catalogs.fields.key")}<span aria-hidden="true"> *</span></Label><Help label={t("catalogs.fields.keyHelp")} text={t("catalogs.fields.keyHint")} /></>}>
      <div className="relative">{field.id ? <LockIcon aria-hidden="true" className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-[var(--color-content-muted)]" /> : null}<Input id={id + "key"} aria-required maxLength={40} readOnly={field.id !== null} className={field.id ? "pl-7" : undefined} value={field.key} onChange={event => set({ key: event.target.value })} {...marked("key")} /></div>
      {messageOf("key")}
    </Row>
    <div className="flex flex-col gap-3">
      <Row label={<Label htmlFor={id + "type"}>{t("catalogs.fields.type")}<span aria-hidden="true"> *</span></Label>}>
        <NativeSelect id={id + "type"} aria-required value={field.type} aria-invalid={error("type") ? true : undefined} aria-describedby={typeHint ? id + "type-message" : undefined} onChange={event => changeType(event.target.value as CatalogFieldType)}>{catalogFieldTypes.map(type => <option key={type} value={type}>{t("catalogs.fields.types." + type)}</option>)}</NativeSelect>
        {typeHint ? <Message id={id + "type-message"} error={!!error("type")}>{typeHint}</Message> : null}
      </Row>
      {detailKind ? <Row label={<Label id={id + "detail"}>{t("catalogs.fields.detailLabel." + detailKind)}</Label>}>
        <div role="group" aria-labelledby={id + "detail"}>{detail}</div>
        {messageOf("maxLength")}{messageOf("min")}{messageOf("max")}{messageOf("sourceCatalogId")}
      </Row> : null}
    </div>
    <Row label={<Label>{t("catalogs.fields.rules")}</Label>}>
      <div className="flex flex-wrap items-start gap-x-6 gap-y-2 sm:min-h-[var(--height-control)] sm:items-center">{check("required", t("catalogs.fields.requiredLabel"), field.id === null ? t("catalogs.fields.optionalFirst") : null)}{check("unique", t("catalogs.fields.unique"), null)}</div>
    </Row>
    <Row label={<><Label>{t("catalogs.fields.role")}</Label><Help label={t("catalogs.fields.roleHelp")} text={t("catalogs.fields.roleHelpText")} /></>}>
      {/* Halves of the width on the phone; from 640 px, as wide as its texts. */}
      <div className="sm:self-start"><SegmentedControl fullWidth aria-label={t("catalogs.fields.role")} options={(["filter", "data"] as const).map(role => ({ key: role, label: t("catalogs.fields.roles." + role), pressed: field.role === role, onSelect: () => set({ role }) }))} /></div>
      <Message>{t("catalogs.fields.roleHint." + field.role)}</Message>
      {messageOf("role")}
    </Row>
  </div>;
}

// A removed field the server said something about: what it said, its uses and Restore.
function RemovedField({ title, messages, uses, readOnly, onRestore }: { title: string; messages: FieldMessages; uses: ReactNode; readOnly: boolean; onRestore: () => void }) {
  const { t } = useTranslation("forms");
  return <div className="flex flex-col gap-3">
    <p className="text-sm font-medium">{title}</p>
    {Object.values(messages).flat().map((message, index) => <Message key={index} error>{message}</Message>)}
    {uses}
    {!readOnly ? <Button type="button" variant="outline" className="self-start" onClick={onRestore}>{t("catalogs.fields.restoreField")}</Button> : null}
  </div>;
}

// The field as text, for someone who can only read it or while the catalog cannot change.
function FieldText({ field, title, scope }: { field: CatalogFieldDraft; title: string; scope: CatalogReadScope }) {
  const { t } = useTranslation("forms");
  const id = useId();
  const muted = "text-xs text-[var(--color-content-muted)]";
  const rule = field.type === "catalog" ? null : catalogFieldRuleSummary(field, scope.culture, t);
  const detail = field.type === "catalog" ? field.sourceCatalogId ? <CatalogFieldSourceSummary scope={scope} id={field.sourceCatalogId} className={muted} /> : null : rule ? <p className={muted}>{rule}</p> : null;
  const entries: readonly (readonly [string, string, ReactNode])[] = [
    ["name", t("name"), title],
    ["key", t("catalogs.fields.key"), field.key || "—"],
    ["type", t("catalogs.fields.type"), <>{t("catalogs.fields.types." + field.type)}{detail}</>],
    ["rules", t("catalogs.fields.rules"), [field.required ? t("catalogs.fields.requiredLabel") : null, field.unique ? t("catalogs.fields.unique") : null].filter(Boolean).join(" · ") || "—"],
    ["role", t("catalogs.fields.role"), t("catalogs.fields.roles." + field.role)],
  ];
  return <dl className="grid gap-x-4 gap-y-3 text-sm sm:grid-cols-[6rem_minmax(0,1fr)]">{entries.map(([key, label, value]) => <Fragment key={key}>
    <dt id={id + key} className="text-[var(--color-content-muted)]">{label}</dt>
    <dd aria-labelledby={id + key} className="m-0 min-w-0 break-words">{value}</dd>
  </Fragment>)}</dl>;
}
