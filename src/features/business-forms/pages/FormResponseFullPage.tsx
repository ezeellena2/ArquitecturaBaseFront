import { responseFiles } from "../responses";
import { useLayoutEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router";
import { useTranslation } from "react-i18next";
import { useMediaQuery } from "@/shared/hooks/useMediaQuery";
import { useBreadcrumbLeaf } from "@/shared/hooks/useBreadcrumbLeaf";
import { cn } from "@/shared/lib/utils";
import { Page } from "@/shared/ui/Page";
import { Button } from "@/shared/ui/button";
import { Badge } from "@/shared/ui/badge";
import { IconButton } from "@/shared/ui/IconButton";
import { ArrowUpIcon, ArrowDownIcon } from "@/shared/ui/icons";
import { Spinner } from "@/shared/ui/Spinner";
import { EmptyState } from "@/shared/ui/EmptyState";
import { ForbiddenPage } from "@/shared/ui/ForbiddenPage";
import { CollapsibleSection } from "@/shared/ui/CollapsibleSection";
import { Banner } from "@/shared/ui/Banner";
import { formatDateTimeInZone } from "@/shared/lib/dateTime";
import { useResponseWorkspace } from "../hooks/useResponseWorkspace";
import { useResponseDetailState } from "../hooks/useResponseDetailState";
import { useFullResponseNavigation } from "../hooks/useFullResponseNavigation";
import { responseFullPath } from "../responseNavigationPaths";
import { composeWorkflowMoments } from "../workflowMoments";
import { approvalStateVariant } from "../approvals";
import type { ApprovalTask } from "../api/approvals";
import { readingDraft } from "../responseReading";
import { ResponseAssistance, ResponseAssistanceBadges } from "../components/ResponseAssistance";
import { ResponseForm } from "../components/ResponseForm";
import { ResponseWorkflowHistory } from "../components/ResponseWorkflowHistory";
import { ResponseMoments } from "../components/ResponseDetailContent";
import { ResponseDocumentActions, ResponseDocumentDownloads } from "../components/ResponseDocuments";
import { ApprovalDecisionPanel } from "../components/ApprovalDecisionPanel";
import { FormEntryCorrection } from "../components/FormEntryCorrection";
import { ResponseAmendActions, ResponseCorrectAction } from "../components/ResponseAmendActions";
import { ResponseFiscalPdf } from "../components/ResponseFiscalPdf";
import { ResponseIssuance } from "../components/ResponseIssuance";
import { VoidResponseDialog } from "../components/VoidResponseDialog";
import { responseIssuance } from "../issuance";

export function FormResponseFullPage() {
  const { formId = "", recordId = "" } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const workspace = useResponseWorkspace(formId);
  const path = responseFullPath(formId, recordId, location.search);
  const transitioning = workspace.fullEntry?.locationKey === null && workspace.fullEntry.recordId !== recordId;
  const prepared = workspace.fullEntry?.locationKey === null && workspace.fullEntry.recordId === recordId;
  const ready = workspace.fullEntry?.recordId === recordId && workspace.fullEntry.locationKey === location.key && location.pathname + location.search === path;
  useLayoutEffect(() => {
    if (transitioning) return;
    if (location.pathname + location.search !== path) { navigate(path, { replace: true }); return; }
    if (!ready) workspace.enterFull(recordId, location.key, location.search);
  }, [location.key, location.pathname, location.search, navigate, path, ready, recordId, transitioning, workspace]);
  return ready || transitioning || prepared ? <FullResponse key={formId} formId={formId} recordId={recordId} transitioning={!ready} openPdf={workspace.fullEntry?.recordId === recordId && workspace.fullEntry.intent === "pdf"}/> : <Spinner/>;
}

function FullResponse({ formId, recordId, transitioning, openPdf }: { formId: string; recordId: string; transitioning: boolean; openPdf: boolean }) {
  const { t, i18n } = useTranslation(["forms", "formEntries"]);
  const routerNavigate = useNavigate();
  const [voiding, setVoiding] = useState(false);
  // VF1-A, decision 5: «Corregir» unlocks the same page, without another route; it lives only here, for this response.
  const [correcting, setCorrecting] = useState<string | null>(null);
  // O52: the response whose correction found it changed meanwhile reads as it was, with the notice on top until «Ver la actual».
  const [changed, setChanged] = useState<string | null>(null);
  const mobile = useMediaQuery("(width < 640px)");
  const navigation = useFullResponseNavigation(formId, recordId);
  const state = useResponseDetailState({ formId, recordId, busy: navigation.busy || transitioning, navigationError: navigation.error, retryNavigation: navigation.onRetry });
  const { detail, data, current, workflow, downloads, loadingTarget, allowed, unavailable, deny, onFileError } = state;
  const [activityOpen, setActivityOpen] = useState(!mobile || openPdf);
  const [decisionTarget, setDecisionTarget] = useState<HTMLDivElement | null>(null);
  const [unavailableTask, setUnavailableTask] = useState<string | null>(null);
  const container = useRef<HTMLDivElement | null>(null);
  const draft = useMemo(() => data ? readingDraft(data, i18n.language) : undefined, [data, i18n.language]);
  const editing = correcting === recordId && allowed && !unavailable && data?.id === recordId;
  // Back from correcting, the focus comes to the reading again.
  useLayoutEffect(() => { container.current?.focus(); }, [data?.id, editing]);
  // A replaced version reads as «Versión anterior» of its number (CW10-A); while it is corrected, «Corregir PED-000010».
  useBreadcrumbLeaf(data && editing ? t("formEntries:correction.title", { number: data.number }) : data?.replacedBy ? t("detail.previousVersion") : data?.number, data?.name);
  // «Ver la actual» of a response that can no longer be corrected (O52): it reads again and, when another correction replaced it,
  // the current version opens instead.
  const viewCurrent = async () => {
    setCorrecting(null); setChanged(null);
    void workflow.query.refetch();
    const replacement = (await detail.query.refetch()).data?.replacedBy;
    if (replacement) routerNavigate(responseFullPath(formId, replacement.recordId, ""));
  };
  const refresh = async (task?: ApprovalTask) => {
    if (task && !await workflow.observeApproval(task)) return;
    void workflow.query.refetch(); navigation.refreshPending();
  };
  // Deciding also takes the task's role: outside it the panel hands the task back and the page keeps no decision bar.
  const taskKey = current?.task ? detail.scope.owner + ":" + current.task.id : null;
  const canDecide = detail.scope.user?.permissions.includes("formapprovals.decide") && !navigation.decisionDenied && !(taskKey && taskKey === unavailableTask);
  const pending = current?.task?.state === "Open" && canDecide;
  const backTo = { to: navigation.backTo, label: t("detail.backToResponses") };
  if (!allowed) return <Page title={t("responses.detail")} backTo={backTo}><ForbiddenPage/></Page>;
  if (!data || unavailable) return <Page title={t("responses.detail")} backTo={backTo}>{detail.query.isPending ? <Spinner/> : <EmptyState title={t(unavailable ? "responses.unavailable" : "responses.loadFailed")} action={unavailable ? undefined : <Button variant="outline" onClick={() => void detail.query.refetch()}>{t("common:actions.retry")}</Button>}/>}</Page>;
  // Correcting takes the page: «Cancelar» reads it again and saving reads the new response, at its own full route.
  if (editing) return <FormEntryCorrection layout="page" formId={formId} record={data} backTo={backTo} onClose={() => setCorrecting(null)}
    onViewCurrent={() => void viewCurrent()} onUnavailable={() => { setCorrecting(null); setChanged(recordId); }}
    onSaved={id => routerNavigate(responseFullPath(formId, id, ""), { replace: true })}/>;
  const files = data.values.filter(value => value.type === "document").flatMap(responseFiles);
  // EM1-A and NC1-A: the issuance says «Anulándose» in the title, offers «PDF fiscal» apart and changes what ⋮ allows.
  const issuance = responseIssuance(current);
  const fiscal = current?.documents.filter(document => issuance.fiscalRunIds.has(document.runId)) ?? [];
  const copies = current?.documents.filter(document => !issuance.fiscalRunIds.has(document.runId)) ?? [];
  const activitySummary = composeWorkflowMoments(data, current).map(moment => t(moment.kind === "received" ? "responses.received" : moment.kind === "effects" ? "detail.events." + moment.event
    : moment.kind === "approval" ? moment.again ? "detail.pendingAgain" : "approvals.taskStates." + moment.task.state : moment.kind === "previousDecision" ? "approvals.taskStates." + moment.state
    : moment.kind === "corrected" ? "detail.corrected" : "approvals.states.Voided")).join(" · ");
  return <div ref={container} tabIndex={-1} className={pending ? "outline-none max-sm:pb-24" : "outline-none"} aria-busy={loadingTarget} onKeyDown={event => {
    if (event.defaultPrevented || event.nativeEvent.isComposing || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey ||
      event.target instanceof Element && event.target.closest('input,textarea,select,[contenteditable="true"],[role="dialog"],[role="combobox"],[role="menu"]')) return;
    if (event.key === "ArrowUp" && navigation.previous && !loadingTarget) { event.preventDefault(); navigation.onMove(-1); }
    if (event.key === "ArrowDown" && navigation.next && !loadingTarget) { event.preventDefault(); navigation.onMove(1); }
  }}><Page title={data.number} backTo={backTo} status={<>{data.replacedBy ? <Badge variant="outline">{t("detail.replaced")}</Badge>
    : issuance.voiding ? <Badge variant="warning">{t("issuance.voidingStatus")}</Badge>
    : current ? <Badge variant={approvalStateVariant(current.recordState)}>{t("approvals.states." + current.recordState)}</Badge> : workflow.query.isPending && !loadingTarget ? <Spinner/> : null}
    {data.correction ? <Badge variant="outline">{t("detail.corrected")}</Badge> : null}
    {/* VF1-A, decision 6: the response reads with its own version, which the band says. */}
    <span className="text-xs text-[var(--color-content-muted)]">{t("responses.versionLabel", { version: data.versionNumber })}</span></>} actions={<>
    {/* AC1-A: deciding is the task while it waits, so «Rechazar» and «Aprobar» go first; on the phone they go fixed at the foot. */}
    <div ref={setDecisionTarget} className={pending ? "max-sm:fixed max-sm:inset-x-0 max-sm:bottom-0 max-sm:z-30 max-sm:border-t max-sm:border-[var(--color-border)] max-sm:bg-[var(--color-surface)] max-sm:p-4" : undefined}/>
    {/* VF1-A, decision 4: «Corregir» in view, for whoever may change it now. */}
    {data.canAmend ? <ResponseCorrectAction disabled={loadingTarget} issuance={issuance} onCorrect={() => setCorrecting(recordId)}/> : null}
    {data.origin?.conversationId && detail.scope.user?.permissions.includes("whatsapp.read") ? <Button variant="outline" size="sm" asChild><Link to={"/whatsapp/chat?conversacion=" + data.origin.conversationId}>{t("responses.openChat")}</Link></Button> : null}
    {/* «PDF fiscal» next to «Descargar ▾» (EM1-A, AC2), which keeps the other copies and the loaded files. */}
    <ResponseFiscalPdf documents={fiscal} downloads={downloads}/>
    {copies.length || files.length ? <ResponseDocumentDownloads documents={copies} files={files} downloads={downloads}/> : null}
    {/* ⋮ after «Descargar» (CW11-A): «Anular» asks for the reason, for whoever may change it now. */}
    {data.canAmend ? <ResponseAmendActions disabled={loadingTarget} issuance={issuance} onVoid={() => setVoiding(true)}/> : null}
    {/* «1 de 2», the spinner and ↑ ↓ wrap as one group: on a narrow screen ↓ never goes alone to the next line. */}
    <span data-slot="response-navigation" className="flex shrink-0 items-center gap-2">
    {navigation.position !== undefined && navigation.count !== undefined ? <span className="text-xs text-[var(--color-content-muted)]">{t(navigation.kind === "pending" ? "overview.pendingNavigation" : "responses.position", { position: navigation.position, count: navigation.count })}</span> : null}
    {/* While another response loads, the spinner goes next to «1 de 2» and the previous sections stay dimmed and out of reach. */}
    {loadingTarget ? <Spinner/> : null}
    <IconButton label={t("responses.previous")} disabled={!navigation.previous || loadingTarget} onClick={() => navigation.onMove(-1)}><ArrowUpIcon className="size-4"/></IconButton>
    <IconButton label={t("responses.next")} disabled={!navigation.next || loadingTarget} onClick={() => navigation.onMove(1)}><ArrowDownIcon className="size-4"/></IconButton>
    </span>
  </>}>
    <div className={cn("space-y-4", loadingTarget && "opacity-45")} inert={loadingTarget || undefined}>
      {changed === recordId ? <Banner tone="warning" action={<Button variant="outline" size="sm" onClick={() => void viewCurrent()}>{t("detail.viewCurrent")}</Button>}>
        {t("formEntries:correction.unavailable")}</Banner> : null}
      {/* A replaced version is read as it was; the notice leads to the correction that stands for it (CW10-A). */}
      {data.replacedBy ? <Banner action={<Button variant="outline" size="sm" asChild><Link to={responseFullPath(formId, data.replacedBy.recordId, "")}>{t("detail.viewCurrent")}</Link></Button>}>
        {t("detail.replacedNotice", { number: data.number, date: formatDateTimeInZone(data.replacedBy.atUtc, i18n.language, detail.scope.user?.timeZoneId) })}</Banner> : null}
      {/* EM1-A: the zone «Comprobante», first, before the moments and «Respuesta»; deciding there reads the list again. */}
      <ResponseIssuance state={state} formId={formId} onChanged={navigation.refreshPending}/>
      {/* Whoever only loads sees where their response stands, as in the quick view, without the activity (CW6-C); a correction
          or a void are told the same way to everyone. */}
      {detail.scope.ownOnly || data.correction || data.void ? <ResponseMoments data={data} current={current} own={detail.scope.ownOnly} timeZoneId={detail.scope.user?.timeZoneId}/> : null}
      {/* VF1-A: the answer reads with the shape of its form, in its zones, and what the assistant proposed goes after it. */}
      {draft ? <ResponseForm entry={data.entry.entry} draft={draft} record={data} layout="page" actor={detail.scope.user!.id} onForbidden={deny}
        onError={onFileError} aside={fieldId => <ResponseAssistanceBadges record={data} fieldId={fieldId}/>}/> : null}
      <ResponseAssistance key={data.id} record={data} actor={detail.scope.user!.id} busy={loadingTarget} onForbidden={deny} onError={onFileError}/>
      {detail.scope.ownOnly ? null : <CollapsibleSection title={t("detail.activity")} summary={activitySummary} open={activityOpen} onOpenChange={setActivityOpen} expandLabel={t("detail.expandActivity")} collapseLabel={t("detail.collapseActivity")} meta={current?.ruleRevision ? t("workflow.ruleRevision", { revision: current.ruleRevision }) : undefined}>
        {/* VF2-A: the activity is a table on the full page, with «Ver PDF» and «Descargar» as icons in their row. */}
        <div className="p-4"><ResponseWorkflowHistory key={detail.scope.owner + ":" + data.id} layout="page" workflow={workflow} record={data} timeZoneId={detail.scope.user?.timeZoneId} documentActions={document => <ResponseDocumentActions compact owner={detail.scope.owner} recordId={data.id} document={document} downloads={downloads} onForbidden={deny}/>}/></div>
      </CollapsibleSection>}
      {/* With a live issuance the void waits for its reversal (NC1-A): the page stays, reads the flow again and says «Anulándose». */}
      {voiding ? <VoidResponseDialog formId={formId} recordId={recordId} number={data.number} owner={detail.scope.owner} issuance={issuance.issued ? "issued" : issuance.live ? "live" : undefined} onClose={() => setVoiding(false)}
        onVoided={() => { setVoiding(false); if (issuance.live) { void workflow.query.refetch(); void detail.query.refetch(); } else routerNavigate(navigation.backTo); }}/> : null}
      {current?.task && canDecide ? <ApprovalDecisionPanel key={current.task.id} embedded taskId={current.task.id} disabled={loadingTarget} actionsTarget={decisionTarget} onForbidden={navigation.denyDecision} onUnavailable={() => setUnavailableTask(taskKey)} onDecided={refresh}/> : null}
    </div>
  </Page></div>;
}