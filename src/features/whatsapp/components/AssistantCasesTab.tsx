import { useLayoutEffect, useRef, useState, type ReactNode, type RefObject } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router";
import { cn } from "@/shared/lib/utils";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { Checkbox } from "@/shared/ui/checkbox";
import { DisabledReason } from "@/shared/ui/DisabledReason";
import { IconButton } from "@/shared/ui/IconButton";
import { AlertTriangleIcon, ChevronDownIcon, LockIcon, PencilIcon, PlusIcon, TrashIcon } from "@/shared/ui/icons";
import { InfoTip } from "@/shared/ui/InfoTip";
import { Label } from "@/shared/ui/label";
import { RowActions } from "@/shared/ui/RowActions";
import { Surface } from "@/shared/ui/Surface";
import type { AgentCulture, AgentForm } from "../api/assistantAgent";
import { agentLimits, caseKey, describeAction, emptyAction, formCases, hasIssuesUnder, type DraftAction, type DraftCase } from "../lib/assistantAgentDraft";
import { AssistantActionTag } from "./AssistantActionTag";
import { caseRowId, fallbackRowId } from "./assistantAgentParts";
// Every row keeps the same first column, for the arrows and the number of an own case: the texts of the three blocks line up.
const row = "grid grid-cols-[3rem_minmax(0,1fr)] gap-x-3 gap-y-2 px-4 py-3 sm:grid-cols-[3rem_minmax(0,1fr)_auto]";
const focusable = "outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring";

/**
 * Casos (AS2): the list in the order the assistant chooses. Own cases, which move with ↑ ↓ and pause with «Activo»; the cases
 * of the forms, a fixed block that comes from their «Cuándo lo ofrece» and is edited in the form; and «Cualquier otra cosa», last.
 * Each row says when, and under it, in grey, the input type, the action as a tag and its configuration.
 */
export function AssistantCasesTab({ cases, fallback, forms, errors, culture, original, locked, canEditForms, addId, addRef, onAdd, onEdit, onEditFallback, onRemove, onMove, onActive }: {
  cases: readonly DraftCase[]; fallback: DraftAction; forms: readonly AgentForm[]; errors: Readonly<Record<string, string>>; culture: AgentCulture; original: AgentCulture;
  locked: boolean; canEditForms: boolean;
  /** «Nuevo caso» takes the focus when a case is removed. */
  addId: string; addRef: RefObject<HTMLButtonElement | null>; onAdd: () => void; onEdit: (id: string) => void; onEditFallback: () => void; onRemove: (id: string) => void;
  onMove: (id: string, offset: -1 | 1) => void; onActive: (id: string, active: boolean) => void;
}) {
  const { t } = useTranslation("whatsappAssistant");
  const list = useRef<HTMLOListElement>(null);
  const moved = useRef<{ id: string; offset: -1 | 1 } | null>(null);
  const [announcement, setAnnouncement] = useState("");
  const offered = formCases(forms);
  const full = cases.length >= agentLimits.cases;
  // Moving keeps the focus on the arrow of the moved case (or on the other one, at an edge), and the reader hears its place.
  useLayoutEffect(() => {
    const action = moved.current;
    if (!action) return;
    moved.current = null;
    const arrows = Array.from(list.current?.querySelector(`[data-case="${action.id}"]`)?.querySelectorAll<HTMLButtonElement>("button[data-case-move]:not(:disabled)") ?? []);
    (arrows.find(arrow => arrow.dataset.caseMove === String(action.offset)) ?? arrows[0])?.focus();
  }, [cases]);
  const move = (item: DraftCase, index: number, offset: -1 | 1) => {
    moved.current = { id: item.id, offset };
    setAnnouncement(t("cases.moved", { number: index + offset + 1, count: cases.length }));
    onMove(item.id, offset);
  };
  const band = (title: string, help?: string) => <div className="flex items-center gap-1 border-y border-[var(--color-border)] bg-[var(--color-surface-muted)] px-4 py-1.5">
    <h3 className="text-[length:var(--text-caption)] font-semibold tracking-[0.06em] uppercase text-[var(--color-content-muted)]">{title}</h3>
    {help ? <span className="-my-1 inline-flex"><InfoTip text={help} label={t("common:actions.moreInfo", { label: title })} /></span> : null}
  </div>;
  return <Surface title={t("cases.title")} help={t("cases.help")} actions={<DisabledReason reason={full && !locked ? t("cases.limit", { count: agentLimits.cases }) : null}>
    <Button ref={addRef} id={addId} type="button" variant="outline" size="sm" disabled={full || locked} onClick={onAdd}><PlusIcon className="size-4" />{t("cases.add")}</Button>
  </DisabledReason>}>
    <div inert={locked || undefined}>
    {band(t("cases.own", { count: cases.length }))}
    {cases.length ? <ol ref={list} aria-label={t("cases.own", { count: cases.length })} className="divide-y divide-[var(--color-border)]">{cases.map((item, index) => {
      const number = index + 1;
      const { label, detail } = describeAction(t, item.action, forms, culture, original);
      const checkbox = caseRowId(item.id) + "-active";
      return <li key={item.id} id={caseRowId(item.id)} tabIndex={-1} data-case={item.id} className={cn(row, focusable)}>
        <div className="flex items-start justify-end gap-1.5">
          {cases.length > 1 ? <div className="flex flex-col">
            <IconButton size="icon-sm" label={t("cases.up", { number })} data-case-move="-1" disabled={locked || index === 0} onClick={() => move(item, index, -1)}><ChevronDownIcon className="size-4 rotate-180" /></IconButton>
            <IconButton size="icon-sm" label={t("cases.down", { number })} data-case-move="1" disabled={locked || index === cases.length - 1} onClick={() => move(item, index, 1)}><ChevronDownIcon className="size-4" /></IconButton>
          </div> : null}
          <span className="pt-0.5 text-sm text-[var(--color-content-muted)]">{number}</span>
        </div>
        <CaseText when={item.when} active={item.isActive} input={t("inputTypes." + item.inputType)} kind={item.action.kind} label={label} detail={detail}
          problem={hasIssuesUnder(errors, caseKey(item.id)) ? t("cases.problems") : null} />
        <div className="col-span-2 flex items-center justify-end gap-3 sm:col-span-1 sm:items-start">
          {/* The name says which case: twenty rows would otherwise give twenty boxes called «Activo». */}
          <div className="flex items-center gap-2">
            <Checkbox id={checkbox} checked={item.isActive} disabled={locked} aria-label={t("cases.activeNamed", { number })} onCheckedChange={value => onActive(item.id, value === true)} />
            <Label htmlFor={checkbox} aria-hidden="true" className="font-normal">{t("cases.active")}</Label>
          </div>
          <RowActions actions={[
            { label: t("cases.edit"), accessibleName: t("cases.editNamed", { number }), icon: PencilIcon, onSelect: () => onEdit(item.id) },
            { label: t("cases.remove"), accessibleName: t("cases.removeNamed", { number }), icon: TrashIcon, destructive: true, onSelect: () => onRemove(item.id) },
          ]} />
        </div>
      </li>;
    })}</ol> : <p className="px-4 py-3 text-sm text-[var(--color-content-muted)]">{t("cases.ownEmpty")}</p>}
    <span role="status" aria-live="polite" aria-atomic="true" className="sr-only">{announcement}</span>
    {offered.length ? <>
      {band(t("cases.forms", { count: offered.length }), t("cases.formsHelp"))}
      <ul aria-label={t("cases.forms", { count: offered.length })} className="divide-y divide-[var(--color-border)]">{offered.map(form => {
        const { label } = describeAction(t, { ...emptyAction("SendForm"), formDefinitionId: form.definitionId }, forms, culture, original);
        return <li key={form.definitionId} className={row}>
          <span aria-hidden="true" />
          <CaseText when={form.offerWhen ?? ""} active input={t("inputTypes.Any")} kind="SendForm" label={label} detail="" problem={null} />
          {canEditForms ? <div className="col-span-2 flex justify-end sm:col-span-1 sm:items-start"><Button asChild variant="outline" size="sm">
            <Link to={`/formularios/${form.definitionId}`} aria-label={t("cases.editFormNamed", { form: form.name })}>{t("cases.editForm")}</Link>
          </Button></div> : null}
        </li>;
      })}</ul>
    </> : null}
    {band(t("cases.last"), t("cases.lastHelp"))}
    <FallbackRow fallback={fallback} forms={forms} culture={culture} original={original} problem={hasIssuesUnder(errors, "fallback") ? t("cases.problems") : null} onEdit={onEditFallback} />
    </div>
  </Surface>;
}

function FallbackRow({ fallback, forms, culture, original, problem, onEdit }: {
  fallback: DraftAction; forms: readonly AgentForm[]; culture: AgentCulture; original: AgentCulture; problem: string | null; onEdit: () => void;
}) {
  const { t } = useTranslation("whatsappAssistant");
  const { label, detail } = describeAction(t, fallback, forms, culture, original);
  return <div id={fallbackRowId} tabIndex={-1} className={cn("grid grid-cols-[3rem_minmax(0,1fr)_auto] gap-x-3 px-4 py-3", focusable)}>
    <span className="flex justify-end pt-0.5 text-[var(--color-content-muted)]"><LockIcon className="size-3.5" /></span>
    <CaseText when={t("cases.fallback")} active input={t("inputTypes.Any")} kind={fallback.kind} label={label} detail={detail} problem={problem} />
    <div className="flex items-start"><RowActions actions={[{ label: t("cases.edit"), accessibleName: t("cases.editFallback"), icon: PencilIcon, onSelect: onEdit }]} /></div>
  </div>;
}

/** When, and under it in grey the input type, the action as a tag and its configuration, without labels run into the text. A paused
 * case says it in its box «Activo»; its text goes grey, like the rest of the row. */
function CaseText({ when, active, input, kind, label, detail, problem }: {
  when: string; active: boolean; input: string; kind: DraftAction["kind"]; label: string; detail: string; problem: string | null;
}): ReactNode {
  return <div className="flex min-w-0 flex-col gap-1.5">
    <p className={cn("flex flex-wrap items-center gap-2 break-words text-sm font-medium", !active && "text-[var(--color-content-muted)]")}>
      <span className="min-w-0 break-words">{when || "—"}</span>
      {problem ? <Badge variant="danger"><AlertTriangleIcon className="size-3" />{problem}</Badge> : null}
    </p>
    <p className="flex flex-wrap items-center gap-1.5 text-sm text-[var(--color-content-muted)]"><span>{input}</span><span aria-hidden="true">→</span><AssistantActionTag kind={kind} label={label} /></p>
    {detail ? <p className="break-words text-sm text-[var(--color-content-muted)]">{detail}</p> : null}
  </div>;
}
