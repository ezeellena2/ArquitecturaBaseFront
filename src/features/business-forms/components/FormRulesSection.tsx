import { FormConditionsEditor } from "./FormConditionsEditor";
import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from "react";
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
import { DisabledReason } from "@/shared/ui/DisabledReason";
import { EmptyState } from "@/shared/ui/EmptyState";
import { FormField } from "@/shared/ui/FormField";
import { IconButton } from "@/shared/ui/IconButton";
import { Textarea } from "@/shared/ui/textarea";
import { NativeSelect } from "@/shared/ui/NativeSelect";
import { Pagination } from "@/shared/ui/Pagination";
import { Spinner } from "@/shared/ui/Spinner";
import { Surface } from "@/shared/ui/Surface";
import { ChevronDownIcon, PencilIcon, TrashIcon } from "@/shared/ui/icons";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/shared/ui/dialog";
import { dismissNotification, notify } from "@/shared/ui/notifications";
import { fetchFormRules, fetchRuleHistory, fetchRuleOptions, fetchRuleRevision, saveFormRules, type FormRuleSet } from "../api/rules";
import { formScopeKey, usePrivateQueryCleanup, type FormReadScope } from "../hooks/useFormQueries";
import { contentReference, localizedValue, moveItem } from "../editorModel";
import { newRule, newRuleAction, clearUnavailablePdfAttachments, prepareRules, ruleFieldErrors, ruleActionKinds, ruleEvents, type FormRule, type RuleActionKind } from "../rules";
import { responseFilterLabels, type ResponseColumn } from "../responses";
import { localizedIssue, localizedIssueMessage } from "../validationPaths";
interface Props { timeZoneId?: string; definitionId: string; definitionRevision: number; scope: FormReadScope; onDirtyChange: (dirty: boolean) => void }
export function FormRulesSection(props: Props) {
  const { t } = useTranslation("forms");
  const owner = JSON.stringify([...formScopeKey(props.scope), props.definitionId]);
  const [deniedOwner, setDeniedOwner] = useState<string | null>(null);
  const onDenied = useCallback(() => setDeniedOwner(owner), [owner]);
  if (!props.scope.actorId || !props.scope.permissions.includes("formrules.manage")) return null;
  if (deniedOwner === owner) return <Surface title={t("rules.title")} padded><p>{t("rules.noPermission")}</p></Surface>;
  return <RulesEditor key={owner} {...props} onDenied={onDenied} />;
}
function RulesEditor({ definitionId, definitionRevision, scope, timeZoneId, onDirtyChange, onDenied }: Props & { onDenied: () => void }) {
  const { t, i18n } = useTranslation("forms");
  // Messages are edited in the menu language; the original is shown as a reference, never copied.
  const culture = scope.culture;
  const root = [...formScopeKey(scope), "rules", definitionId];
  const notificationRoot = "forms:rules:" + JSON.stringify(root);
  const pendingNotices = useRef(new Set<string>());
  useEffect(() => () => { for (const operation of pendingNotices.current) dismissNotification(notificationRoot + ":" + operation); }, [notificationRoot]);
  usePrivateQueryCleanup(root);
  const query = useQuery({ queryKey: [...root, "editor", definitionRevision], queryFn: async ({ signal }) => {
    const [current, options] = await Promise.all([fetchFormRules(definitionId, signal), fetchRuleOptions(definitionId, signal)]);
    return { current, options };
  }, placeholderData: previous => previous, gcTime: 0 });
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
  const history = useQuery({ queryKey: [...root, "history", historyPage], queryFn: ({ signal }) => fetchRuleHistory(definitionId, historyPage, signal), gcTime: 0 });
  useEffect(() => { if ([query.error, history.error].some(error => error instanceof ApiError && error.status === 403)) onDenied(); }, [query.error, history.error, onDenied]);
  const cooldown = useCountdown(0);
  const active = useRef(true);
  const host = useRef<HTMLDivElement | null>(null);
  const errorId = useId();
  // Local problems show after the first try to save, and then live while they are corrected; a successful save clears it.
  const [attempted, setAttempted] = useState(false);
  const pendingFocus = useRef<{ selector: string } | { actionId: string; delta: number } | null>(null);
  const [announcement, setAnnouncement] = useState("");
  useLayoutEffect(() => {
    const pending = pendingFocus.current;
    if (!pending) return;
    pendingFocus.current = null;
    if ("selector" in pending) host.current?.querySelector<HTMLElement>(pending.selector)?.focus();
    else {
      const buttons = Array.from(host.current?.querySelectorAll<HTMLButtonElement>("button[data-move-item]:not(:disabled)") ?? []).filter(button => button.dataset.moveItem === pending.actionId);
      (buttons.find(button => button.dataset.moveDelta === String(pending.delta)) ?? buttons[0])?.focus();
    }
  }, [rules, expanded]);
  const operation = useRef<AbortController | null>(null);
  useEffect(() => { active.current = true; return () => { active.current = false; operation.current?.abort(); onDirtyChange(false); }; }, [onDirtyChange]);
  if (query.data && baseline === null) { setBaseline(query.data.current); setRules(query.data.current.rules); }
  const dirty = rules !== null && baseline !== null && JSON.stringify(rules) !== JSON.stringify(baseline.rules);
  useEffect(() => onDirtyChange(dirty), [dirty, onDirtyChange]);
  const options = query.data?.options;
  const columns: ResponseColumn[] = options?.questions.map(field => ({ fieldId: field.fieldId, type: field.type, label: localizedValue(field.label, culture, options.originalCulture), introducedInVersion: 1, options: options.conditionChoices[field.fieldId] ?? (field.options ?? []).map(option => ({ id: option.choiceId, label: localizedValue(option.label, culture, options.originalCulture) })) })) ?? [];
  const prepared = prepareRules(rules ?? [], options?.originalCulture ?? "es", columns);
  const conflict = needsReview;
  const blocked = busy || cooldown.isRunning;
  const change = (next: readonly FormRule[]) => { if (!blocked) { setRules(next); setError(null); } };
  const changeRule = (index: number, rule: FormRule) => change((rules ?? []).map((item, position) => position === index ? rule : item));
  const run = async (kind: "save" | "reread" | "revision", action: (signal: AbortSignal) => Promise<void>) => {
    if (blocked) return;
    const controller = new AbortController();
    operation.current = controller;
    setBusy(true); setError(null); dismissNotification(notificationRoot + ":" + kind); pendingNotices.current.delete(kind);
    try { await action(controller.signal); } catch (failure) {
      if (!active.current || errorFeedback(failure).kind === "cancelled") return;
      const validation = kind === "save" ? ruleFieldErrors(failure instanceof ApiError ? failure.errors ?? {} : {}, rules ?? []) : null;
      const normalizedFailure = validation && failure instanceof ApiError && failure.errors ? new ApiError(failure.status, { ...failure.problem, errors: validation.errors }, failure.isNetworkError) : failure;
      if (kind === "save") setError(normalizedFailure);
      if (kind === "save" && failure instanceof ApiError && failure.status === 409) { setNeedsReview(true); setCurrent(null); }
      if (validation?.firstRuleId) {
        setExpanded(validation.firstRuleId);
        requestAnimationFrame(() => { if (active.current && !controller.signal.aborted) host.current?.querySelector<HTMLElement>('[data-rule-id="' + validation.firstRuleId + '"] [aria-invalid="true"]')?.focus(); });
      }
      if (!["cancelled", "session", "forbidden", "fields"].includes(errorFeedback(normalizedFailure, { fields: validation?.fields }).kind)) { pendingNotices.current.add(kind); notify({ id: notificationRoot + ":" + kind, kind: "error", message: kind === "save" ? operationalErrorMessage(normalizedFailure, t, "save") : readErrorMessage(normalizedFailure, t) }); }
      if (failure instanceof ApiError && failure.status === 403) onDenied();
      if (failure instanceof ApiError && failure.status === 429) cooldown.restart(failure.retryAfterSeconds ?? 60);
    } finally { if (active.current) setBusy(false); }
  };
  const fieldError = (path: string) => {
    const local = attempted ? prepared.issues.find(issue => issue.path === path) : undefined;
    return (error instanceof ApiError ? error.errors?.[path]?.[0] : undefined) ?? (local ? t("rules.errors." + local.key) : undefined);
  };
  const textError = (path: string) => localizedIssueMessage(localizedIssue(Object.fromEntries([path, path + ".es", path + ".en"].flatMap(key => { const message = fieldError(key); return message ? [[key, [message]]] : []; })), path, culture), culture, t);
  if (query.isPending || !baseline || rules === null || !options) return <Surface title={t("rules.title")} padded>{query.isPending ? <Spinner /> : <EmptyState embedded title={t("common:states.loadFailed")} action={<Button variant="outline" onClick={() => void query.refetch()}>{t("common:actions.retry")}</Button>} />}</Surface>;
  // Without changes or while saving, a disabled Save is obvious; a wait or a conflict is told as its reason.
  const saveDisabledReason = busy ? null : cooldown.isRunning ? t("responses.wait", { count: cooldown.seconds }) : conflict ? t("rules.saveConflict") : null;
  const save = () => {
    const issue = prepared.issues[0];
    if (!issue) {
      void run("save", async signal => {
        const saved = await saveFormRules(definitionId, { expectedRevision: baseline.revision, rules: prepared.rules }, signal);
        if (!active.current) return;
        setBaseline(saved); setRules(saved.rules); setCurrent(null); setAttempted(false);
        void history.refetch();
        notify({ id: notificationRoot + ":save", kind: "success", message: t("rules.saved") });
      });
      return;
    }
    // Trying with problems marks them, opens the first rule with one and focuses its first marked control. Nothing is sent.
    const ruleId = rules[Number(/^rules\.(\d+)/.exec(issue.path)?.[1])]?.id;
    setAttempted(true);
    if (!ruleId) return;
    setExpanded(ruleId);
    requestAnimationFrame(() => { if (active.current) host.current?.querySelector<HTMLElement>('[data-rule-id="' + ruleId + '"] [aria-invalid="true"]')?.focus(); });
  };
  const resolveConflict = (keepMine: boolean) => {
    if (!current || blocked) return;
    setBaseline(current);
    if (!keepMine) { setRules(current.rules); setExpanded(null); }
    setCurrent(null); setNeedsReview(false); setError(null);
    pendingNotices.current.delete("save"); dismissNotification(notificationRoot + ":save");
  };
  const summary = (rule: FormRule) => <><p>{t("rules.events." + rule.event)}</p>{rule.conditions.length ? <p className="mt-1 text-xs text-[var(--color-content-muted)]">{t("rules.if")}: {responseFilterLabels({ page: 1, pageSize: 1, conditions: rule.conditions }, columns, t, i18n.language, timeZoneId).map(item => item.label).join("; ")}</p> : null}<ol className="mt-2 list-decimal space-y-1 pl-5 text-sm">{rule.actions.map(action => <li key={action.id}>{t("rules.actions." + action.kind)}{action.roleId ? " · " + (options.roles.find(role => role.id === action.roleId)?.name ?? t("rules.unavailableRole")) : ""}{action.text ? ": " + localizedValue(action.text, culture, options.originalCulture) : ""}</li>)}</ol></>;
  return <div ref={host} className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
    <Surface title={t("rules.title")} actions={<>
      <Button data-add-rule variant="outline" disabled={blocked || rules.length >= 20} onClick={() => { const rule = newRule(); change([...rules, rule]); setExpanded(rule.id); }}>{t("rules.addRule")}</Button>
      <DisabledReason reason={saveDisabledReason}><Button disabled={blocked || conflict || !dirty} onClick={save}>{t(busy ? "rules.saving" : "rules.save")}</Button></DisabledReason>
    </>}>
      <p className="border-b border-[var(--color-border)] p-4 text-sm">{t("rules.independent")}</p>
      {conflict ? <div className="space-y-2 border-b border-[var(--color-border)] p-4"><p role="alert">{t("rules.conflict")}</p>{conflict ? <><Button variant="outline" disabled={blocked} onClick={() => void run("reread", async signal => { const fresh = await fetchFormRules(definitionId, signal); if (active.current) setCurrent(fresh); })}>{t("rules.reread")}</Button>{current ? <><Button variant="outline" disabled={blocked} onClick={() => resolveConflict(false)}>{t("rules.useCurrent")}</Button><Button variant="outline" disabled={blocked} onClick={() => resolveConflict(true)}>{t("keepMine")}</Button></> : null}</> : null}</div> : null}

      {rules.length === 0 ? <p className="p-4 text-sm text-[var(--color-content-muted)]">{t("rules.empty")}</p> : null}
      {rules.map((rule, index) => <section key={rule.id} data-rule-id={rule.id} aria-label={t("rules.rule", { number: index + 1 })} className="border-b border-[var(--color-border)] p-4">
        <div className="flex items-start justify-between gap-3"><span className="text-xs text-[var(--color-content-muted)]">{index + 1}</span><div className="min-w-0 flex-1">{expanded !== rule.id ? summary(rule) : null}</div><div className="flex shrink-0">
          <IconButton data-edit-rule={rule.id} label={t("rules.editRule", { number: index + 1 })} disabled={blocked} onClick={() => setExpanded(expanded === rule.id ? null : rule.id)} aria-expanded={expanded === rule.id}><PencilIcon className="size-4" /></IconButton>
          <IconButton label={t("rules.removeRule", { number: index + 1 })} disabled={blocked} onClick={() => { const neighbor = rules[index + 1] ?? rules[index - 1]; pendingFocus.current = { selector: neighbor ? '[data-edit-rule="' + neighbor.id + '"]' : "[data-add-rule]" }; change(rules.filter(item => item.id !== rule.id)); if (expanded === rule.id) setExpanded(null); }}><TrashIcon className="size-4" /></IconButton>
        </div></div>
        {expanded === rule.id ? <div className="mt-3 space-y-5">
          <FormField label={t("rules.when")}><NativeSelect disabled={blocked} value={rule.event} onChange={event => changeRule(index, clearUnavailablePdfAttachments({ ...rule, event: event.target.value as FormRule["event"] }))}>{ruleEvents.map(event => <option key={event} value={event}>{t("rules.events." + event)}</option>)}</NativeSelect></FormField>
          <FormConditionsEditor heading={t("rules.ifOptional")} fieldPath={"rules." + index + ".conditions"} conditions={rule.conditions} columns={columns} blocked={blocked} error={fieldError("rules." + index + ".conditions")} onChange={conditions => changeRule(index, { ...rule, conditions })}/>
          <div className="space-y-3"><h3 className="text-sm font-medium">{t("rules.doInOrder")}</h3>{rule.actions.map((action, actionIndex) => {
            const actionPath = "rules." + index + ".actions." + actionIndex;
            const reference = contentReference(action.text, culture, options.originalCulture);
            return <Surface key={action.id} padded>
              <div className="flex flex-col items-stretch gap-2 sm:flex-row sm:items-start"><div className="min-w-0 flex-1"><FormField label={<><span aria-hidden="true" className="min-w-0 sm:hidden">{t("rules.action", { number: actionIndex + 1 })}: {t("rules.actions." + action.kind)}</span><span className="sr-only sm:not-sr-only">{t("rules.action", { number: actionIndex + 1 })}</span></>} error={fieldError(actionPath)}><NativeSelect data-action-editor={action.id} disabled={blocked} value={action.kind} onChange={event => changeRule(index, clearUnavailablePdfAttachments({ ...rule, actions: rule.actions.map((item, position) => position === actionIndex ? { ...newRuleAction(event.target.value as RuleActionKind), id: item.id } : item) }))}>{ruleActionKinds.map(kind => <option key={kind} value={kind}>{t("rules.actions." + kind)}</option>)}</NativeSelect></FormField></div>
              <div className="flex justify-end sm:mt-6">{[-1, 1].map(delta => <IconButton key={delta} data-move-item={action.id} data-move-delta={delta} label={t(delta < 0 ? "rules.upAction" : "rules.downAction", { number: actionIndex + 1 })} disabled={blocked || actionIndex + delta < 0 || actionIndex + delta >= rule.actions.length} onClick={() => { pendingFocus.current = { actionId: action.id, delta }; setAnnouncement(t("position", { name: t("rules.action", { number: actionIndex + delta + 1 }), position: actionIndex + delta + 1, total: rule.actions.length })); changeRule(index, clearUnavailablePdfAttachments({ ...rule, actions: moveItem(rule.actions, actionIndex, delta) })); }}><ChevronDownIcon className={"size-4 " + (delta < 0 ? "rotate-180" : "")} /></IconButton>)}<IconButton label={t("rules.removeAction", { number: actionIndex + 1 })} disabled={blocked} onClick={() => { const neighbor = rule.actions[actionIndex + 1] ?? rule.actions[actionIndex - 1]; pendingFocus.current = { selector: neighbor ? '[data-action-editor="' + neighbor.id + '"]' : '[data-add-action="' + rule.id + '"]' }; changeRule(index, clearUnavailablePdfAttachments({ ...rule, actions: rule.actions.filter(item => item.id !== action.id) })); }}><TrashIcon className="size-4" /></IconButton></div></div>
              {action.kind === "RequestApproval" || action.kind === "NotifyRole" ? <FormField label={t("rules.role")} error={fieldError(actionPath + ".roleId")}><NativeSelect disabled={blocked} value={action.roleId ?? ""} onChange={event => changeRule(index, { ...rule, actions: rule.actions.map((item, position) => position === actionIndex ? { ...item, roleId: event.target.value || null } : item) })}><option value="">{t("rules.chooseRole")}</option>{action.roleId && !options.roles.some(role => role.id === action.roleId) ? <option value={action.roleId}>{t("rules.unavailableRole")}</option> : null}{options.roles.map(role => <option key={role.id} value={role.id}>{role.name}</option>)}</NativeSelect></FormField> : null}
              {action.kind === "GeneratePdf" ? <div className="space-y-2 text-sm"><p>{t("rules.currentDesign")}</p><Button asChild variant="link"><Link to={"/formularios/" + definitionId + "/pdf"}>{t("rules.viewDesign")}</Link></Button></div> : null}
              {action.text ? <><FormField label={t("rules.message")} hint={reference ? t("originalText", { language: t("cultures." + options.originalCulture), text: reference }) : t("rules.messageHint")} error={textError(actionPath + ".text")}><Textarea disabled={blocked} maxLength={action.includePdf ? 1024 : 4096} placeholder={culture !== options.originalCulture ? t("missingText") : undefined} value={action.text[culture] ?? ""} onChange={event => changeRule(index, { ...rule, actions: rule.actions.map((item, position) => position === actionIndex ? { ...item, text: { ...item.text, [culture]: event.target.value } } : item) })} /></FormField>{action.kind === "NotifyAuthor" ? <CheckboxField error={fieldError(actionPath + ".includePdf")} checked={action.includePdf} disabled={blocked || rule.event !== "Approved"} onCheckedChange={checked => changeRule(index, { ...rule, actions: rule.actions.map((item, position) => position === actionIndex ? { ...item, includePdf: checked } : item) })} label={t("rules.includePdf")} /> : null}</> : null}
            </Surface>;
          })}{fieldError("rules." + index + ".actions") ? <p id={errorId + "-actions-" + rule.id} role="alert" className="text-sm text-[var(--color-danger)]">{fieldError("rules." + index + ".actions")}</p> : null}<Button data-add-action={rule.id} aria-invalid={fieldError("rules." + index + ".actions") ? true : undefined} aria-describedby={fieldError("rules." + index + ".actions") ? errorId + "-actions-" + rule.id : undefined} variant="outline" disabled={blocked || rule.actions.length >= 10 || rule.actions.at(-1)?.kind === "RequestApproval"} onClick={() => changeRule(index, { ...rule, actions: [...rule.actions, newRuleAction("NotifyAuthor")] })}>{t("rules.addAction")}</Button></div>
          <div className="flex justify-end"><Button variant="outline" disabled={blocked} onClick={() => { pendingFocus.current = { selector: '[data-edit-rule="' + rule.id + '"]' }; setExpanded(null); }}>{t("done")}</Button></div>
        </div> : null}
      </section>)}
    </Surface>
    <span role="status" aria-live="polite" aria-atomic="true" className="sr-only">{announcement}</span>
    <Surface title={t("rules.history")} padded>{history.isPending ? <Spinner /> : history.error && !history.data ? <EmptyState embedded title={t("common:states.loadFailed")} action={<Button variant="outline" onClick={() => void history.refetch()}>{t("common:actions.retry")}</Button>} /> : <><ol className="space-y-3">{history.data?.items.map(revision => <li key={revision.id} className="border-b border-[var(--color-border)] pb-3"><Button variant="link" disabled={blocked} onClick={event => { revisionTrigger.current = event.currentTarget; void run("revision", async signal => { const view = await fetchRuleRevision(definitionId, revision.revision, signal); if (active.current) setRevisionView(view); }); }}>{t("rules.revision", { revision: revision.revision })}</Button>{baseline.revision === revision.revision ? <Badge variant="outline">{t("rules.current")}</Badge> : null}<p className="text-xs">{formatDateTimeInZone(revision.createdAtUtc, scope.culture, timeZoneId)} · {revision.author?.displayName ?? t("responses.unknownPerson")}</p><p className="mt-1 text-xs text-[var(--color-content-muted)]">{[revision.changes.addedRules ? t("rules.historyAdded", { count: revision.changes.addedRules }) : null, revision.changes.updatedRules ? t("rules.historyUpdated", { count: revision.changes.updatedRules }) : null, revision.changes.removedRules ? t("rules.historyRemoved", { count: revision.changes.removedRules }) : null, revision.changes.orderChanged ? t("rules.historyOrderChanged") : null].filter(Boolean).join(" · ") || t("rules.historyUnchanged")}</p></li>)}</ol>{history.data && history.data.totalPages > 1 ? <Pagination {...history.data} onPageChange={setHistoryPage} /> : null}<p className="text-xs text-[var(--color-content-muted)]">{t("rules.historyHint")}</p></>}</Surface>
    {revisionView ? <Dialog open onOpenChange={open => { if (!open) setRevisionView(null); }}><DialogContent onCloseAutoFocus={event => { const target = revisionTrigger.current; if (target?.isConnected && !target.disabled) { event.preventDefault(); target.focus(); } else restoreRevisionFocus(event); }} className="max-h-[90svh] overflow-y-auto"><DialogHeader><DialogTitle>{t("rules.revision", { revision: revisionView?.revision })}</DialogTitle></DialogHeader><ol className="space-y-4">{revisionView?.rules.map(rule => <li key={rule.id}>{summary(rule)}</li>)}</ol></DialogContent></Dialog> : null}
  </div>;
}
