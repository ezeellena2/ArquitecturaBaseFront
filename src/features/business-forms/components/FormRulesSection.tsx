import { useCallback, useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router";
import { useTranslation } from "react-i18next";
import { ApiError } from "@/shared/api/ApiError";
import { errorFeedback, operationalErrorMessage, readErrorMessage } from "@/shared/api/errorFeedback";
import { useRestoreFocusOnClose } from "@/shared/hooks/useRestoreFocusOnClose";
import { useCountdown } from "@/shared/hooks/useCountdown";
import { formatDateTimeInZone } from "@/shared/lib/dateTime";
import { Button } from "@/shared/ui/button";
import { Badge } from "@/shared/ui/badge";
import { CheckboxField } from "@/shared/ui/CheckboxField";
import { EmptyState } from "@/shared/ui/EmptyState";
import { FormField } from "@/shared/ui/FormField";
import { IconButton } from "@/shared/ui/IconButton";
import { Input } from "@/shared/ui/input";
import { Textarea } from "@/shared/ui/textarea";
import { NativeSelect } from "@/shared/ui/NativeSelect";
import { Pagination } from "@/shared/ui/Pagination";
import { Spinner } from "@/shared/ui/Spinner";
import { Surface } from "@/shared/ui/Surface";
import { ChevronDownIcon, PencilIcon, TrashIcon } from "@/shared/ui/icons";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/shared/ui/dialog";
import { notify } from "@/shared/ui/notifications";
import { fetchFormRules, fetchRuleHistory, fetchRuleOptions, fetchRuleRevision, saveFormRules, type FormRuleSet } from "../api/rules";
import { formScopeKey, usePrivateQueryCleanup, type FormReadScope } from "../hooks/useFormQueries";
import { localizedValue, moveItem } from "../editorModel";
import { newRule, newRuleAction, prepareRules, ruleActionKinds, ruleEvents, type FormRule, type RuleActionKind } from "../rules";
import type { FormCulture } from "../model";
import type { ResponseColumn, ResponseCondition } from "../responses";
interface Props { timeZoneId?: string; definitionId: string; definitionRevision: number; scope: FormReadScope; contentCulture: FormCulture; onDirtyChange: (dirty: boolean) => void }
export function FormRulesSection(props: Props) {
  const { t } = useTranslation("forms");
  const owner = JSON.stringify([...formScopeKey(props.scope), props.definitionId]);
  const [deniedOwner, setDeniedOwner] = useState<string | null>(null);
  const onDenied = useCallback(() => setDeniedOwner(owner), [owner]);
  if (!props.scope.actorId || !props.scope.permissions.includes("formrules.manage")) return null;
  if (deniedOwner === owner) return <Surface title={t("rules.title")} padded><p>{t("rules.noPermission")}</p></Surface>;
  return <RulesEditor key={owner} {...props} onDenied={onDenied} />;
}
function RulesEditor({ definitionId, definitionRevision, scope, contentCulture, timeZoneId, onDirtyChange, onDenied }: Props & { onDenied: () => void }) {
  const { t } = useTranslation("forms");
  const root = [...formScopeKey(scope), "rules", definitionId];
  usePrivateQueryCleanup(root);
  const query = useQuery({ queryKey: [...root, "editor", definitionRevision], queryFn: async ({ signal }) => {
    const [current, options] = await Promise.all([fetchFormRules(definitionId, signal), fetchRuleOptions(definitionId, signal)]);
    return { current, options };
  }, placeholderData: previous => previous, gcTime: 0, meta: { errorOwner: "local" } });
  const [baseline, setBaseline] = useState<FormRuleSet | null>(null);
  const [rules, setRules] = useState<readonly FormRule[] | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [needsReview, setNeedsReview] = useState(false);
  const [current, setCurrent] = useState<FormRuleSet | null>(null);
  const [revisionView, setRevisionView] = useState<FormRuleSet | null>(null);
  const revisionTrigger = useRef<HTMLButtonElement | null>(null);
  const restoreRevisionFocus = useRestoreFocusOnClose(revisionView !== null);
  const [historyPage, setHistoryPage] = useState(1);
  const history = useQuery({ queryKey: [...root, "history", historyPage], queryFn: ({ signal }) => fetchRuleHistory(definitionId, historyPage, signal), gcTime: 0, meta: { errorOwner: "local" } });
  useEffect(() => { if ([query.error, history.error].some(error => error instanceof ApiError && error.status === 403)) onDenied(); }, [query.error, history.error, onDenied]);
  const cooldown = useCountdown(0);
  const active = useRef(true);
  const operation = useRef<AbortController | null>(null);
  useEffect(() => { active.current = true; return () => { active.current = false; operation.current?.abort(); onDirtyChange(false); }; }, [onDirtyChange]);
  if (query.data && baseline === null) { setBaseline(query.data.current); setRules(query.data.current.rules); }
  const dirty = rules !== null && baseline !== null && JSON.stringify(rules) !== JSON.stringify(baseline.rules);
  useEffect(() => onDirtyChange(dirty), [dirty, onDirtyChange]);
  const options = query.data?.options;
  const columns: ResponseColumn[] = options?.questions.map(field => ({ fieldId: field.fieldId, type: field.type, label: localizedValue(field.label, contentCulture, options.originalCulture), introducedInVersion: 1, options: options.conditionChoices[field.fieldId] ?? (field.options ?? []).map(option => ({ id: option.choiceId, label: localizedValue(option.label, contentCulture, options.originalCulture) })) })) ?? [];
  const prepared = prepareRules(rules ?? [], options?.originalCulture ?? "es", columns);
  const conflict = needsReview;
  const blocked = busy || cooldown.isRunning;
  const change = (next: readonly FormRule[]) => { if (!blocked) { setRules(next); setError(null); } };
  const changeRule = (index: number, rule: FormRule) => change((rules ?? []).map((item, position) => position === index ? rule : item));
  const run = async (action: (signal: AbortSignal) => Promise<void>) => {
    if (blocked) return;
    const controller = new AbortController();
    operation.current = controller;
    setBusy(true); setError(null);
    try { await action(controller.signal); } catch (failure) {
      if (!active.current || errorFeedback(failure).kind === "cancelled") return;
      setError(failure);
      if (failure instanceof ApiError && failure.status === 409) setNeedsReview(true);
      if (failure instanceof ApiError && failure.status === 403) onDenied();
      if (failure instanceof ApiError && failure.status === 429) cooldown.restart(failure.retryAfterSeconds ?? 60);
    } finally { if (active.current) setBusy(false); }
  };
  const fieldError = (path: string) => {
    const local = prepared.issues.find(issue => issue.path === path);
    return (error instanceof ApiError ? error.errors?.[path]?.[0] : undefined) ?? (local ? t("rules.errors." + local.key) : undefined);
  };
  if (query.isPending || !baseline || rules === null || !options) return <Surface title={t("rules.title")} padded>{query.isPending ? <Spinner /> : <EmptyState embedded title={readErrorMessage(query.error, t)} action={<Button variant="outline" onClick={() => void query.refetch()}>{t("common:actions.retry")}</Button>} />}</Surface>;
  const label = (fieldId: string) => columns.find(column => column.fieldId === fieldId)?.label ?? t("rules.missingQuestion");
  const summary = (rule: FormRule) => <><p>{t("rules.events." + rule.event)}</p>{rule.conditions.length ? <p className="mt-1 text-xs text-[var(--color-content-muted)]">{t("rules.if")}: {rule.conditions.map(condition => label(condition.fieldId)).join(", ")}</p> : null}<ol className="mt-2 list-decimal space-y-1 pl-5 text-sm">{rule.actions.map(action => <li key={action.id}>{t("rules.actions." + action.kind)}{action.roleId ? " · " + (options.roles.find(role => role.id === action.roleId)?.name ?? t("rules.unavailableRole")) : ""}{action.text ? ": " + localizedValue(action.text, contentCulture, options.originalCulture) : ""}</li>)}</ol></>;
  return <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
    <Surface title={t("rules.title")} actions={<>{dirty ? <Badge variant="outline">{t("dirty")}</Badge> : <span className="text-xs">{t("rules.revision", { revision: baseline.revision })}</span>}<Button disabled={blocked || !dirty || prepared.issues.length > 0 || conflict} onClick={() => void run(async signal => {
      const saved = await saveFormRules(definitionId, { expectedRevision: baseline.revision, rules: prepared.rules }, signal);
      if (!active.current) return;
      setBaseline(saved); setRules(saved.rules); setCurrent(null);
      void history.refetch();
      notify({ id: "forms:rules-saved:" + definitionId, kind: "success", message: t("rules.saved") });
    })}>{t(busy ? "rules.saving" : "rules.save")}</Button></>}>
      <p className="border-b border-[var(--color-border)] p-4 text-sm">{t("rules.independent")}</p>
      {error || conflict ? <div className="space-y-2 border-b border-[var(--color-border)] p-4"><p role="alert">{conflict ? (error instanceof ApiError ? error.detail : null) ?? t("rules.conflict") : operationalErrorMessage(error, t, "save")}</p>{conflict ? <><Button variant="outline" disabled={blocked} onClick={() => void run(async signal => { const fresh = await fetchFormRules(definitionId, signal); if (active.current) setCurrent(fresh); })}>{t("rules.reread")}</Button>{current ? <Button variant="outline" disabled={blocked} onClick={() => { setBaseline(current); setRules(current.rules); setExpanded(null); setCurrent(null); setNeedsReview(false); setError(null); }}>{t("rules.useCurrent")}</Button> : null}</> : null}</div> : null}
      {cooldown.isRunning ? <p role="status" className="p-4 text-sm">{t("wait", { count: cooldown.seconds })}</p> : null}
      {rules.length === 0 ? <p className="p-4 text-sm text-[var(--color-content-muted)]">{t("rules.empty")}</p> : null}
      {rules.map((rule, index) => <section key={rule.id} aria-label={t("rules.rule", { number: index + 1 })} className="border-b border-[var(--color-border)] p-4">
        <div className="flex items-start justify-between gap-3"><span className="text-xs text-[var(--color-content-muted)]">{index + 1}</span><div className="min-w-0 flex-1">{expanded !== rule.id ? summary(rule) : null}</div><div className="flex shrink-0">
          <IconButton label={t("rules.editRule", { number: index + 1 })} disabled={blocked} onClick={() => setExpanded(expanded === rule.id ? null : rule.id)} aria-expanded={expanded === rule.id}><PencilIcon className="size-4" /></IconButton>
          <IconButton label={t("rules.removeRule", { number: index + 1 })} disabled={blocked} onClick={() => change(rules.filter(item => item.id !== rule.id))}><TrashIcon className="size-4" /></IconButton>
        </div></div>
        {expanded === rule.id ? <div className="mt-3 space-y-5">
          <FormField label={t("rules.when")}><NativeSelect disabled={blocked} value={rule.event} onChange={event => changeRule(index, { ...rule, event: event.target.value as FormRule["event"] })}>{ruleEvents.map(event => <option key={event} value={event}>{t("rules.events." + event)}</option>)}</NativeSelect></FormField>
          <div className="space-y-3"><h3 className="text-sm font-medium">{t("rules.ifOptional")}</h3>{rule.conditions.map((condition, conditionIndex) => {
            const field = options.questions.find(item => item.fieldId === condition.fieldId);
            const operators = ["answered", "unanswered", "notAsked", ...(field?.type === "decimal" || field?.type === "date" ? ["equals", "gte", "lte"] : field?.type === "shortText" || field?.type === "longText" ? ["contains", "equals"] : field?.type === "boolean" || field?.type === "choice" && columns.find(column => column.fieldId === field.fieldId)?.options.length ? ["in"] : [])];
            const updateCondition = (value: ResponseCondition) => changeRule(index, { ...rule, conditions: rule.conditions.map((item, position) => position === conditionIndex ? value : item) });
            const presence = ["answered", "unanswered", "notAsked"].includes(condition.operator);
            return <div key={conditionIndex} className="grid items-start gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_auto]">
              <FormField label={t("rules.question")}><NativeSelect disabled={blocked} value={condition.fieldId} onChange={event => updateCondition({ fieldId: event.target.value, operator: "answered", values: [] })}>{options.questions.map(question => <option key={question.fieldId} value={question.fieldId}>{label(question.fieldId)}</option>)}</NativeSelect></FormField>
              <FormField label={t("rules.operator")}><NativeSelect disabled={blocked} value={condition.operator} onChange={event => updateCondition({ ...condition, operator: event.target.value, values: ["answered", "unanswered", "notAsked"].includes(event.target.value) ? [] : [field?.type === "boolean" ? "true" : ""] })}>{operators.map(operator => <option key={operator} value={operator}>{t("rules.operators." + operator)}</option>)}</NativeSelect></FormField>
              {!presence ? <FormField label={t("rules.value")}>{field?.type === "boolean" ? <NativeSelect disabled={blocked} value={condition.values?.[0] ?? ""} onChange={event => updateCondition({ ...condition, values: [event.target.value] })}><option value="true">{t("responses.yes")}</option><option value="false">{t("responses.no")}</option></NativeSelect> : field?.type === "choice" ? <NativeSelect multiple size={3} disabled={blocked} value={[...(condition.values ?? [])]} onChange={event => updateCondition({ ...condition, values: [...event.target.selectedOptions].map(option => option.value) })}>{columns.find(column => column.fieldId === field.fieldId)?.options.map(option => <option key={option.id} value={option.id}>{option.label}</option>)}</NativeSelect> : <Input disabled={blocked} type={field?.type === "date" ? "date" : "text"} inputMode={field?.type === "decimal" ? "decimal" : undefined} value={condition.values?.[0] ?? ""} onChange={event => updateCondition({ ...condition, values: [event.target.value] })} />}</FormField> : <span />}
              <IconButton className="sm:mt-6" label={t("rules.removeCondition", { number: conditionIndex + 1 })} disabled={blocked} onClick={() => changeRule(index, { ...rule, conditions: rule.conditions.filter((_, position) => position !== conditionIndex) })}><TrashIcon className="size-4" /></IconButton>
            </div>;
          })}{fieldError("rules." + index + ".conditions") ? <p role="alert" className="text-sm text-[var(--color-danger)]">{fieldError("rules." + index + ".conditions")}</p> : null}
          <p className="text-xs text-[var(--color-content-muted)]">{t("rules.always")}</p><Button variant="outline" disabled={blocked || !options.questions.length || rule.conditions.length >= 10} onClick={() => changeRule(index, { ...rule, conditions: [...rule.conditions, { fieldId: options.questions[0].fieldId, operator: "answered", values: [] }] })}>{t("rules.addCondition")}</Button></div>
          <div className="space-y-3"><h3 className="text-sm font-medium">{t("rules.doInOrder")}</h3>{rule.actions.map((action, actionIndex) => {
            const actionPath = "rules." + index + ".actions." + actionIndex;
            return <Surface key={action.id} padded>
              <div className="flex items-start gap-2"><div className="min-w-0 flex-1"><FormField label={t("rules.action", { number: actionIndex + 1 })} error={fieldError(actionPath)}><NativeSelect disabled={blocked} value={action.kind} onChange={event => changeRule(index, { ...rule, actions: rule.actions.map((item, position) => position === actionIndex ? { ...newRuleAction(event.target.value as RuleActionKind), id: item.id } : item) })}>{ruleActionKinds.map(kind => <option key={kind} value={kind}>{t("rules.actions." + kind)}</option>)}</NativeSelect></FormField></div>
              <div className="mt-6 flex">{[-1, 1].map(delta => <IconButton key={delta} label={t(delta < 0 ? "rules.upAction" : "rules.downAction", { number: actionIndex + 1 })} disabled={blocked || actionIndex + delta < 0 || actionIndex + delta >= rule.actions.length} onClick={() => changeRule(index, { ...rule, actions: moveItem(rule.actions, actionIndex, delta) })}><ChevronDownIcon className={"size-4 " + (delta < 0 ? "rotate-180" : "")} /></IconButton>)}<IconButton label={t("rules.removeAction", { number: actionIndex + 1 })} disabled={blocked} onClick={() => changeRule(index, { ...rule, actions: rule.actions.filter((_, position) => position !== actionIndex) })}><TrashIcon className="size-4" /></IconButton></div></div>
              {action.kind === "RequestApproval" || action.kind === "NotifyRole" ? <FormField label={t("rules.role")} error={fieldError(actionPath + ".roleId")}><NativeSelect disabled={blocked} value={action.roleId ?? ""} onChange={event => changeRule(index, { ...rule, actions: rule.actions.map((item, position) => position === actionIndex ? { ...item, roleId: event.target.value || null } : item) })}><option value="">{t("rules.chooseRole")}</option>{action.roleId && !options.roles.some(role => role.id === action.roleId) ? <option value={action.roleId}>{t("rules.unavailableRole")}</option> : null}{options.roles.map(role => <option key={role.id} value={role.id}>{role.name}</option>)}</NativeSelect></FormField> : null}
              {action.kind === "GeneratePdf" ? <div className="space-y-2 text-sm"><p>{t("rules.currentDesign")}</p><Button asChild variant="link"><Link to={"/formularios/" + definitionId + "/pdf"}>{t("rules.viewDesign")}</Link></Button></div> : null}
              {action.text ? <><FormField label={t("rules.message")} hint={t("rules.messageHint", { language: t("cultures." + options.originalCulture) })} error={fieldError(actionPath + ".text." + contentCulture) ?? fieldError(actionPath + ".text." + options.originalCulture)}><Textarea disabled={blocked} maxLength={action.includePdf ? 1024 : 4096} value={action.text[contentCulture] ?? ""} onChange={event => changeRule(index, { ...rule, actions: rule.actions.map((item, position) => position === actionIndex ? { ...item, text: { ...item.text, [contentCulture]: event.target.value } } : item) })} /></FormField>{action.kind === "NotifyAuthor" ? <CheckboxField error={fieldError(actionPath + ".includePdf")} checked={action.includePdf} disabled={blocked || rule.event !== "Approved"} onCheckedChange={checked => changeRule(index, { ...rule, actions: rule.actions.map((item, position) => position === actionIndex ? { ...item, includePdf: checked } : item) })} label={t("rules.includePdf")} /> : null}</> : null}
            </Surface>;
          })}{fieldError("rules." + index + ".actions") ? <p role="alert" className="text-sm text-[var(--color-danger)]">{fieldError("rules." + index + ".actions")}</p> : null}<Button variant="outline" disabled={blocked || rule.actions.length >= 10 || rule.actions.at(-1)?.kind === "RequestApproval"} onClick={() => changeRule(index, { ...rule, actions: [...rule.actions, newRuleAction("NotifyAuthor")] })}>{t("rules.addAction")}</Button></div>
          <div className="flex justify-end"><Button variant="outline" onClick={() => setExpanded(null)}>{t("done")}</Button></div>
        </div> : null}
      </section>)}
      <div className="p-4"><Button variant="outline" disabled={blocked || rules.length >= 20} onClick={() => { const rule = newRule(); change([...rules, rule]); setExpanded(rule.id); }}>{t("rules.addRule")}</Button></div>
    </Surface>
    <Surface title={t("rules.history")} padded>{history.isPending ? <Spinner /> : history.error ? <EmptyState embedded title={readErrorMessage(history.error, t)} action={<Button variant="outline" onClick={() => void history.refetch()}>{t("common:actions.retry")}</Button>} /> : <><ol className="space-y-3">{history.data?.items.map(revision => <li key={revision.id} className="border-b border-[var(--color-border)] pb-3"><Button variant="link" disabled={blocked} onClick={event => { revisionTrigger.current = event.currentTarget; void run(async signal => { const view = await fetchRuleRevision(definitionId, revision.revision, signal); if (active.current) setRevisionView(view); }); }}>{t("rules.revision", { revision: revision.revision })}</Button>{baseline.revision === revision.revision ? <Badge variant="outline">{t("rules.current")}</Badge> : null}<p className="text-xs">{formatDateTimeInZone(revision.createdAtUtc, scope.culture, timeZoneId)} · {revision.author?.displayName ?? t("responses.unknownPerson")}</p></li>)}</ol>{history.data && history.data.totalPages > 1 ? <Pagination {...history.data} onPageChange={setHistoryPage} /> : null}<p className="text-xs text-[var(--color-content-muted)]">{t("rules.historyHint")}</p></>}</Surface>
    {revisionView ? <Dialog open onOpenChange={open => { if (!open) setRevisionView(null); }}><DialogContent onCloseAutoFocus={event => { const target = revisionTrigger.current; if (target?.isConnected && !target.disabled) { event.preventDefault(); target.focus(); } else restoreRevisionFocus(event); }} className="max-h-[90svh] overflow-y-auto"><DialogHeader><DialogTitle>{t("rules.revision", { revision: revisionView?.revision })}</DialogTitle></DialogHeader><ol className="space-y-4">{revisionView?.rules.map(rule => <li key={rule.id}>{summary(rule)}</li>)}</ol></DialogContent></Dialog> : null}
  </div>;
}
