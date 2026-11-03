import { FormConditionsEditor } from "./FormConditionsEditor";
import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router";
import { useTranslation } from "react-i18next";
import { ApiError } from "@/shared/api/ApiError";
import { errorFeedback, operationalErrorMessage, readErrorMessage } from "@/shared/api/errorFeedback";
import { useCountdown } from "@/shared/hooks/useCountdown";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { CheckboxField } from "@/shared/ui/CheckboxField";
import { DisabledReason } from "@/shared/ui/DisabledReason";
import { EmptyState } from "@/shared/ui/EmptyState";
import { FormField } from "@/shared/ui/FormField";
import { IconButton } from "@/shared/ui/IconButton";
import { NativeSelect } from "@/shared/ui/NativeSelect";
import { Spinner } from "@/shared/ui/Spinner";
import { StepList } from "@/shared/ui/StepList";
import { Surface } from "@/shared/ui/Surface";
import { ArrowDownIcon, BanIcon, ChatIcon, CheckIcon, ChevronDownIcon, DocumentIcon, PencilIcon, ShieldIcon, SlidersIcon, TrashIcon, UsersIcon } from "@/shared/ui/icons";
import { dismissNotification, notify } from "@/shared/ui/notifications";
import { fetchFormRules, fetchRuleHistory, fetchRuleOptions, fetchRuleRevision, saveFormRules, type FormRuleSet } from "../api/rules";
import { formScopeKey, usePrivateQueryCleanup, type FormReadScope } from "../hooks/useFormQueries";
import { contentReference, localizedValue, moveItem } from "../editorModel";
import { newRule, newRuleAction, fixPdfAttachment, pdfAttachmentIssue, prepareRules, ruleFieldErrors, ruleActionKinds, ruleEvents, usesMessage, usesRole, withRuleActionKind, type FormRule, type RuleActionKind } from "../rules";
import type { ResponseColumn } from "../responses";
import { localizedIssue, localizedIssueMessage } from "../validationPaths";
import { RevisionHistoryButton, RevisionHistoryPanel } from "./RevisionHistory";
import { parseRuleMessage, ruleMessageDataLabel, ruleMessageText, type RuleMessageData } from "../ruleMessage";
import { RuleMessageField } from "./RuleMessageField";
import { ConditionLines } from "./ConditionLines";
import { DataTag } from "./DataTag";
/** `prefix`: the form's prefix, for the example number of «Así llega». */
interface Props { timeZoneId?: string; definitionId: string; definitionRevision: number; prefix: string; scope: FormReadScope; onDirtyChange: (dirty: boolean) => void }
export function FormRulesSection(props: Props) {
  const { t } = useTranslation("forms");
  // The menu language is not part of the owner: changing it keeps the rules being edited.
  const owner = JSON.stringify([props.scope.actorId, [...new Set(props.scope.permissions)].sort().join(","), props.definitionId]);
  const [deniedOwner, setDeniedOwner] = useState<string | null>(null);
  const onDenied = useCallback(() => setDeniedOwner(owner), [owner]);
  if (!props.scope.actorId || !props.scope.permissions.includes("formrules.manage")) return null;
  if (deniedOwner === owner) return <Surface title={t("rules.title")} padded><p>{t("rules.noPermission")}</p></Surface>;
  return <RulesEditor key={owner} {...props} onDenied={onDenied} />;
}
function RulesEditor({ definitionId, definitionRevision, prefix, scope, timeZoneId, onDirtyChange, onDenied }: Props & { onDenied: () => void }) {
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
  // What is running, so each control shows its own sign: rereading or opening a revision never makes Save say it saves.
  const [running, setRunning] = useState<{ kind: "save" | "reread" | "revision"; revision?: number } | null>(null);
  const busy = running !== null;
  const [error, setError] = useState<unknown>(null);
  const [needsReview, setNeedsReview] = useState(false);
  const [current, setCurrent] = useState<FormRuleSet | null>(null);
  const [revisionView, setRevisionView] = useState<FormRuleSet | null>(null);
  // The history opens from «Historial» in a side panel (board HI1-A); the focus goes back to that button on closing.
  const [historyOpen, setHistoryOpen] = useState(false);
  const historyTrigger = useRef<HTMLButtonElement | null>(null);
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
  const run = async (kind: "save" | "reread" | "revision", action: (signal: AbortSignal) => Promise<void>, revision?: number) => {
    if (blocked) return;
    const controller = new AbortController();
    operation.current = controller;
    setRunning({ kind, revision }); setError(null); dismissNotification(notificationRoot + ":" + kind); pendingNotices.current.delete(kind);
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
    } finally { if (active.current) setRunning(null); }
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
  // A rule reads in steps, from top to bottom, in the order it happens (board LR1-A): when, if (only with conditions) and each
  // action, each with its icon. The data (the question, the value) are bold and what joins them grey; the role and the PDF go
  // apart after the action and each message goes whole in its box.
  const summary = (rule: FormRule) => <StepList steps={[
    { key: "when", icon: ruleEventIcons[rule.event], content: <p className="font-semibold">{t("rules.events." + rule.event)}</p> },
    ...rule.conditions.length ? [{ key: "if", icon: <SlidersIcon/>, content: <ConditionLines conditions={rule.conditions} columns={columns}/> }] : [],
    ...rule.actions.map(action => ({ key: action.id, icon: ruleActionIcons[action.kind], content: <>
      <p className="flex flex-wrap items-center gap-x-2 gap-y-1"><span className="font-semibold">{t("rules.actions." + action.kind)}</span>{usesRole(action.kind) && action.roleId ? <Badge variant="outline">{options.roles.find(role => role.id === action.roleId)?.name ?? t("rules.unavailableRole")}</Badge> : null}{action.kind === "NotifyAuthor" && action.includePdf ? <Badge variant="outline"><DocumentIcon/>{t("rules.withPdf")}</Badge> : null}</p>
      {usesMessage(action.kind) && action.text ? <RuleMessage text={localizedValue(action.text, culture, options.originalCulture)} name={data => ruleMessageDataLabel(data, options.questions, culture, options.originalCulture, t)} missing={t("rules.missingQuestion")}/> : null}
    </> })),
  ]}/>;
  const changes = (revision: { changes: { addedRules: number; updatedRules: number; removedRules: number; orderChanged: boolean } }) => [revision.changes.addedRules ? t("rules.historyAdded", { count: revision.changes.addedRules }) : null, revision.changes.updatedRules ? t("rules.historyUpdated", { count: revision.changes.updatedRules }) : null, revision.changes.removedRules ? t("rules.historyRemoved", { count: revision.changes.removedRules }) : null, revision.changes.orderChanged ? t("rules.historyOrderChanged") : null].filter(Boolean).join(" · ") || t("rules.historyUnchanged");
  return <div ref={host} className="flex flex-col gap-4">
    {/* A conflict is its own surface above the editor: rereading and choosing go in its header, so the rules header keeps its shape. */}
    {conflict ? <div><Surface title={t("rules.conflictTitle")} padded actions={<>
      <Button variant="outline" disabled={blocked} pending={running?.kind === "reread"} onClick={() => void run("reread", async signal => { const fresh = await fetchFormRules(definitionId, signal); if (active.current) setCurrent(fresh); })}>{t(running?.kind === "reread" ? "rereading" : "rules.reread")}</Button>
      {current ? <><Button variant="outline" disabled={blocked} onClick={() => resolveConflict(false)}>{t("rules.useCurrent")}</Button><Button variant="outline" disabled={blocked} onClick={() => resolveConflict(true)}>{t("keepMine")}</Button></> : null}
    </>}><p role="alert" className="text-sm">{t("rules.conflict")}</p></Surface></div> : null}
    <Surface title={t("rules.title")} help={t("rules.independent")} actions={<>
      <RevisionHistoryButton count={history.data?.totalCount} blocked={blocked} waitReason={!busy && cooldown.isRunning ? t("responses.wait", { count: cooldown.seconds }) : null} onOpen={trigger => { historyTrigger.current = trigger; setHistoryOpen(true); }}/>
      <DisabledReason reason={!busy && rules.length >= 20 ? t("rules.errors.tooMany") : null}><Button data-add-rule variant="outline" disabled={blocked || rules.length >= 20} onClick={() => { const rule = newRule(); change([...rules, rule]); setExpanded(rule.id); }}>{t("rules.addRule")}</Button></DisabledReason>
      <DisabledReason reason={saveDisabledReason}><Button disabled={blocked || conflict || !dirty} pending={running?.kind === "save"} onClick={save}>{t(running?.kind === "save" ? "rules.saving" : "rules.save")}</Button></DisabledReason>
    </>}>
      {rules.length === 0 ? <p className="p-4 text-sm text-[var(--color-content-muted)]">{t("rules.empty")}</p> : null}
      {rules.map((rule, index) => <section key={rule.id} data-rule-id={rule.id} aria-label={t("rules.rule", { number: index + 1 })} className="border-b border-[var(--color-border)] p-4">
        <div className="flex items-start justify-between gap-3"><span className={"text-xs text-[var(--color-content-muted)] tabular-nums " + (expanded !== rule.id ? "pt-1" : "")}>{index + 1}</span><div className="min-w-0 flex-1">{expanded !== rule.id ? summary(rule) : null}</div><div className="flex shrink-0">
          <IconButton data-edit-rule={rule.id} label={t("rules.editRule", { number: index + 1 })} disabled={blocked} onClick={() => setExpanded(expanded === rule.id ? null : rule.id)} aria-expanded={expanded === rule.id}><PencilIcon className="size-4" /></IconButton>
          <IconButton label={t("rules.removeRule", { number: index + 1 })} disabled={blocked} onClick={() => { const neighbor = rules[index + 1] ?? rules[index - 1]; pendingFocus.current = { selector: neighbor ? '[data-edit-rule="' + neighbor.id + '"]' : "[data-add-rule]" }; change(rules.filter(item => item.id !== rule.id)); if (expanded === rule.id) setExpanded(null); }}><TrashIcon className="size-4" /></IconButton>
        </div></div>
        {expanded === rule.id ? <div className="mt-3 space-y-5">
          <FormField label={t("rules.when")}><NativeSelect disabled={blocked} value={rule.event} onChange={event => changeRule(index, { ...rule, event: event.target.value as FormRule["event"] })}>{ruleEvents.map(event => <option key={event} value={event}>{t("rules.events." + event)}</option>)}</NativeSelect></FormField>
          <FormConditionsEditor heading={t("rules.ifOptional")} help={t("rules.always")} fieldPath={"rules." + index + ".conditions"} conditions={rule.conditions} columns={columns} blocked={blocked} error={fieldError("rules." + index + ".conditions")} onChange={conditions => changeRule(index, { ...rule, conditions })}/>
          <div className="space-y-3"><h3 className="text-sm font-medium">{t("rules.doInOrder")}</h3>{rule.actions.map((action, actionIndex) => {
            const actionPath = "rules." + index + ".actions." + actionIndex;
            const reference = contentReference(action.text, culture, options.originalCulture);
            const attachment = pdfAttachmentIssue(rule, actionIndex);
            return <Surface key={action.id} padded>
              <div className="flex flex-col items-stretch gap-2 sm:flex-row sm:items-start"><div className="min-w-0 flex-1"><FormField label={<><span aria-hidden="true" className="min-w-0 sm:hidden">{t("rules.action", { number: actionIndex + 1 })}: {t("rules.actions." + action.kind)}</span><span className="sr-only sm:not-sr-only">{t("rules.action", { number: actionIndex + 1 })}</span></>} error={fieldError(actionPath)}><NativeSelect data-action-editor={action.id} disabled={blocked} value={action.kind} onChange={event => changeRule(index, { ...rule, actions: rule.actions.map((item, position) => position === actionIndex ? withRuleActionKind(item, event.target.value as RuleActionKind) : item) })}>{ruleActionKinds.map(kind => <option key={kind} value={kind}>{t("rules.actions." + kind)}</option>)}</NativeSelect></FormField></div>
              <div className="flex justify-end sm:mt-6">{[-1, 1].map(delta => <IconButton key={delta} data-move-item={action.id} data-move-delta={delta} label={t(delta < 0 ? "rules.upAction" : "rules.downAction", { number: actionIndex + 1 })} disabled={blocked || actionIndex + delta < 0 || actionIndex + delta >= rule.actions.length} onClick={() => { pendingFocus.current = { actionId: action.id, delta }; setAnnouncement(t("position", { name: t("rules.action", { number: actionIndex + delta + 1 }), position: actionIndex + delta + 1, total: rule.actions.length })); changeRule(index, { ...rule, actions: moveItem(rule.actions, actionIndex, delta) }); }}><ChevronDownIcon className={"size-4 " + (delta < 0 ? "rotate-180" : "")} /></IconButton>)}<IconButton label={t("rules.removeAction", { number: actionIndex + 1 })} disabled={blocked} onClick={() => { const neighbor = rule.actions[actionIndex + 1] ?? rule.actions[actionIndex - 1]; pendingFocus.current = { selector: neighbor ? '[data-action-editor="' + neighbor.id + '"]' : '[data-add-action="' + rule.id + '"]' }; changeRule(index, { ...rule, actions: rule.actions.filter(item => item.id !== action.id) }); }}><TrashIcon className="size-4" /></IconButton></div></div>
              {action.kind === "RequestApproval" || action.kind === "NotifyRole" ? <FormField label={t("rules.role")} error={fieldError(actionPath + ".roleId")}><NativeSelect disabled={blocked} value={action.roleId ?? ""} onChange={event => changeRule(index, { ...rule, actions: rule.actions.map((item, position) => position === actionIndex ? { ...item, roleId: event.target.value || null } : item) })}><option value="">{t("rules.chooseRole")}</option>{action.roleId && !options.roles.some(role => role.id === action.roleId) ? <option value={action.roleId}>{t("rules.unavailableRole")}</option> : null}{options.roles.map(role => <option key={role.id} value={role.id}>{role.name}</option>)}</NativeSelect></FormField> : null}
              {action.kind === "GeneratePdf" ? <div className="text-sm"><Button asChild variant="link"><Link to={"/formularios/" + definitionId + "/pdf"}>{t("rules.viewDesign")}</Link></Button></div> : null}
              {/* The data go as tags with «Agregar dato» and the message shows how it arrives (board MD1-A). The original shown while
                  translating names its data in its own language. */}
              {action.text && usesMessage(action.kind) ? <><RuleMessageField label={t("rules.message")} help={t("rules.messageHint")} error={textError(actionPath + ".text")}
                hint={reference ? t("originalText", { language: t("cultures." + options.originalCulture), text: ruleMessageText(reference, options.questions, options.originalCulture, options.originalCulture, i18n.getFixedT(options.originalCulture, "forms")) }) : undefined}
                value={action.text[culture] ?? ""} onChange={value => changeRule(index, { ...rule, actions: rule.actions.map((item, position) => position === actionIndex ? { ...item, text: { ...item.text, [culture]: value } } : item) })}
                culture={culture} original={options.originalCulture} questions={options.questions} choices={options.conditionChoices} event={rule.event} prefix={prefix}
                placeholder={culture !== options.originalCulture ? t("missingText") : undefined} disabled={blocked} />{action.kind === "NotifyAuthor" ? <div data-attachment={action.id}>
                {/* Nothing clears the attachment: its problem is told under it right away, without trying to save, with the button that fixes the order (board RP1-A). */}
                <CheckboxField error={attachment ? t("rules.errors." + attachment.key) : fieldError(actionPath + ".includePdf")} checked={action.includePdf} disabled={blocked || (rule.event !== "Approved" && !action.includePdf)} disabledReason={rule.event !== "Approved" ? t("rules.errors.pdfOnApproval") : null} onCheckedChange={checked => changeRule(index, { ...rule, actions: rule.actions.map((item, position) => position === actionIndex ? { ...item, includePdf: checked } : item) })} label={t("rules.includePdf")} />
                {attachment?.fix ? <div className="pl-9"><Button variant="outline" size="sm" disabled={blocked} onClick={() => {
                  const fixed = fixPdfAttachment(rule, actionIndex);
                  pendingFocus.current = { selector: '[data-attachment="' + action.id + '"] [role="checkbox"]' };
                  setAnnouncement(t("position", { name: t("rules.actions.GeneratePdf"), position: actionIndex + 1, total: fixed.actions.length }));
                  changeRule(index, fixed);
                }}>{t(attachment.fix === "move" ? "rules.movePdfBefore" : "rules.addPdfBefore")}</Button></div> : null}
              </div> : null}</> : null}
            </Surface>;
          })}{fieldError("rules." + index + ".actions") ? <p id={errorId + "-actions-" + rule.id} role="alert" className="text-sm text-[var(--color-danger)]">{fieldError("rules." + index + ".actions")}</p> : null}<DisabledReason reason={busy ? null : rule.actions.at(-1)?.kind === "RequestApproval" ? t("rules.errors.approvalLast") : rule.actions.length >= 10 ? t("rules.errors.tooMany") : null}><Button data-add-action={rule.id} aria-invalid={fieldError("rules." + index + ".actions") ? true : undefined} aria-describedby={fieldError("rules." + index + ".actions") ? errorId + "-actions-" + rule.id : undefined} variant="outline" disabled={blocked || rule.actions.length >= 10 || rule.actions.at(-1)?.kind === "RequestApproval"} onClick={() => changeRule(index, { ...rule, actions: [...rule.actions, newRuleAction("NotifyAuthor")] })}>{t("rules.addAction")}</Button></DisabledReason></div>
          <div className="flex justify-end"><Button variant="outline" disabled={blocked} onClick={() => { pendingFocus.current = { selector: '[data-edit-rule="' + rule.id + '"]' }; setExpanded(null); }}>{t("done")}</Button></div>
        </div> : null}
      </section>)}
    </Surface>
    <span role="status" aria-live="polite" aria-atomic="true" className="sr-only">{announcement}</span>
    <RevisionHistoryPanel title={t("rules.history")} open={historyOpen} onClose={() => { setHistoryOpen(false); setRevisionView(null); }} history={history} onPageChange={setHistoryPage}
      current={baseline.revision} describe={changes} opening={running?.kind === "revision" ? running.revision : undefined} blocked={blocked}
      onOpenRevision={revision => void run("revision", async signal => { const view = await fetchRuleRevision(definitionId, revision, signal); if (active.current) setRevisionView(view); }, revision)}
      view={revisionView ? { revision: revisionView.revision, content: <ol className="divide-y divide-[var(--color-border)] border-y border-[var(--color-border)]">{revisionView.rules.map(rule => <li key={rule.id} className="py-3">{summary(rule)}</li>)}</ol> } : null}
      onBack={() => setRevisionView(null)} culture={scope.culture} timeZoneId={timeZoneId} trigger={historyTrigger}/>
  </div>;
}

// The icon of each step of a rule (board LR1-A): when a response arrives, is approved or is rejected, and what each action does.
const ruleEventIcons: Record<FormRule["event"], ReactNode> = { Received: <ArrowDownIcon/>, Approved: <CheckIcon/>, Rejected: <BanIcon/> };
const ruleActionIcons: Record<RuleActionKind, ReactNode> = { RequestApproval: <ShieldIcon/>, GeneratePdf: <DocumentIcon/>, NotifyAuthor: <ChatIcon/>, NotifyRole: <UsersIcon/> };

// The message of an action, whole, in its box (board TL2-A), with each datum marked by its name: the number, the reason or
// the question as it is called now (board MD1-A).
function RuleMessage({ text, name, missing }: { text: string; name: (data: RuleMessageData) => string | null; missing: string }) {
  return text ? <p className="rounded-[var(--radius-control)] border border-[var(--color-border)]/50 bg-[var(--color-surface-muted)] px-2.5 py-1.5 break-words whitespace-pre-wrap">
    {parseRuleMessage(text).map((part, index) => {
      if (part.kind === "text") return part.text;
      const label = name(part);
      return <DataTag key={index} missing={label === null}>{label ?? missing}</DataTag>;
    })}
  </p> : null;
}
