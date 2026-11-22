import { useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { Link, useLocation, useNavigate } from "react-router";
import { useTranslation } from "react-i18next";
import { PrivateFormFilesScopeProvider } from "@/shared/hooks/PrivateFormFilesScope";
import { useMediaQuery } from "@/shared/hooks/useMediaQuery";
import { useResponseWorkspace } from "../hooks/useResponseWorkspace";
import { responseFullPath } from "../responseNavigationPaths";
import { Button } from "@/shared/ui/button";
import { IconButton } from "@/shared/ui/IconButton";
import { ChatIcon, ExpandIcon } from "@/shared/ui/icons";
import { Badge } from "@/shared/ui/badge";
import { Spinner } from "@/shared/ui/Spinner";
import { EmptyState } from "@/shared/ui/EmptyState";
import { ForbiddenPage } from "@/shared/ui/ForbiddenPage";
import { approvalStateVariant } from "../approvals";
import { useResponseDetailState } from "../hooks/useResponseDetailState";
import { ResponseDocumentDownloads } from "../components/ResponseDocuments";
import { ResponseDetailContent } from "../components/ResponseDetailContent";
import { ResponsePanelFrame, type ResponsePanelNavigation } from "../components/ResponsePanelFrame";
import { ResponseAmendActions, ResponseCorrectAction } from "../components/ResponseAmendActions";
import { ResponseFiscalPdf } from "../components/ResponseFiscalPdf";
import { VoidResponseDialog } from "../components/VoidResponseDialog";
import { responseIssuance } from "../issuance";

function ResponsePanelFilesScope({ enabled, scope, children }: { enabled: boolean; scope: string | null; children: ReactNode }) {
  return enabled ? <PrivateFormFilesScopeProvider scope={scope}>{children}</PrivateFormFilesScopeProvider> : children;
}
export function FormResponseDetailPage({ formId, recordId, navigation, onDecided, onDecisionForbidden, decisionAllowed = true, retainPreviousForm = false, onCorrect, onVoided }: {
  formId: string; recordId: string; navigation: ResponsePanelNavigation; onDecided?: () => void; onDecisionForbidden?: () => void; decisionAllowed?: boolean; retainPreviousForm?: boolean;
  /** «Corregir» opens the correction next to the sheet (CW10-A); «Anular» voids it and the owner reads the sheet again (CW11-A). */
  onCorrect?: (recordId: string) => void; onVoided?: () => void;
}) {
  const mobile = useMediaQuery("(width < 640px)");
  const navigate = useNavigate();
  const location = useLocation();
  const workspace = useResponseWorkspace(formId);
  const redirected = useRef(false);
  useLayoutEffect(() => {
    if (!mobile || redirected.current) return;
    redirected.current = true;
    if (workspace.navigation?.selection.recordId !== recordId) {
      const source = workspace.navigation;
      const observed = source?.origin === "pending" ? source.pending?.tasks.find(task => task.recordId === recordId) : undefined;
      workspace.setNavigation(source && observed ? { ...source, selection: { recordId, taskId: observed.id }, search: location.search } : { origin: "sheet", selection: { recordId }, search: location.search });
    }
    workspace.prepareFull(recordId);
    navigate(responseFullPath(formId, recordId, location.search), { replace: true });
  }, [mobile, navigate, formId, recordId, location.search, workspace]);
  return mobile ? null : <QuickResponseDetail formId={formId} recordId={recordId} navigation={navigation} onDecided={onDecided} onDecisionForbidden={onDecisionForbidden} decisionAllowed={decisionAllowed} retainPreviousForm={retainPreviousForm}
    onCorrect={onCorrect} onVoided={onVoided}/>;
}
function QuickResponseDetail({ formId, recordId, navigation, onDecided, onDecisionForbidden, decisionAllowed, retainPreviousForm, onCorrect, onVoided }: {
  formId: string; recordId: string; navigation: ResponsePanelNavigation; onDecided?: () => void; onDecisionForbidden?: () => void; decisionAllowed?: boolean; retainPreviousForm: boolean;
  onCorrect?: (recordId: string) => void; onVoided?: () => void;
}) {
  const { t } = useTranslation("forms");
  const location = useLocation();
  const workspace = useResponseWorkspace(formId);
  const state = useResponseDetailState({ formId, recordId, busy: navigation.busy, navigationError: navigation.error, retryNavigation: navigation.onRetry, retainPreviousForm });
  const { detail, workflow, data, current, downloads, unavailable, fileScope, allowed, loadingTarget, loading } = state;
  const [voiding, setVoiding] = useState<string | null>(null);
  // EM1-A and NC1-A: the issuance says «Anulándose» in the title, offers «PDF fiscal» apart and changes what ⋮ allows.
  const issuance = responseIssuance(current);
  const fiscal = current?.documents.filter(document => issuance.fiscalRunIds.has(document.runId)) ?? [];
  const copies = current?.documents.filter(document => !issuance.fiscalRunIds.has(document.runId)) ?? [];
  if (!allowed) return <ResponsePanelFilesScope enabled={retainPreviousForm} scope={null}><ResponsePanelFrame title={t("responses.detail")} navigation={navigation}><ForbiddenPage/></ResponsePanelFrame></ResponsePanelFilesScope>;
  if (!data || unavailable) return <ResponsePanelFilesScope enabled={retainPreviousForm} scope={fileScope}><ResponsePanelFrame title={t("responses.detail")} navigation={navigation}>{detail.query.isPending ? <Spinner/> : <EmptyState embedded title={t(unavailable ? "responses.unavailable" : "responses.loadFailed")} action={unavailable ? undefined : <Button variant="outline" onClick={() => void detail.query.refetch()}>{t("common:actions.retry")}</Button>}/>}</ResponsePanelFrame></ResponsePanelFilesScope>;
  return <ResponsePanelFilesScope enabled={retainPreviousForm} scope={fileScope}><ResponsePanelFrame title={data.number} loading={loading} navigation={{ ...navigation, busy: navigation.busy || loadingTarget }} status={<>{issuance.voiding ? <Badge variant="warning">{t("issuance.voidingStatus")}</Badge> : current ? <Badge variant={approvalStateVariant(current.recordState)}>{t("approvals.states." + current.recordState)}</Badge> : workflow.query.isPending && !loadingTarget ? <Spinner/> : null}
    {data.correction ? <Badge variant="outline">{t("detail.corrected")}</Badge> : null}{data.replacedBy ? <Badge variant="outline">{t("detail.replaced")}</Badge> : null}</>} subtitle={data.name + " · " + t("responses.versionLabel", { version: data.versionNumber })} actions={<>
    {/* The header actions are icons with their tooltip, in the title row next to ↑ ↓ × (board TL3-A); «Corregir», the pencil, goes
        first, for whoever may change it now (VF1-A, decision 4). */}
    {data.canAmend && onCorrect && data.id === recordId ? <ResponseCorrectAction compact disabled={loadingTarget} issuance={issuance} onCorrect={() => onCorrect(recordId)}/> : null}
    <IconButton label={t("detail.openFull")} asChild><Link to={responseFullPath(formId, recordId, location.search)} onClick={event => {
      if (event.defaultPrevented || event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
      if (workspace.navigation?.selection.recordId !== recordId) {
        const source = workspace.navigation;
        const observed = source?.origin === "pending" ? source.pending?.tasks.find(task => task.recordId === recordId) : undefined;
        workspace.setNavigation(source && observed ? { ...source, selection: { recordId, taskId: observed.id }, search: location.search } : { origin: "sheet", selection: { recordId }, search: location.search });
      }
      workspace.prepareFull(recordId);
    }}><ExpandIcon className="size-4"/></Link></IconButton>
    {data.origin?.conversationId && detail.scope.user?.permissions.includes("whatsapp.read") ? <IconButton label={t("responses.openChat")} asChild><Link to={"/whatsapp/chat?conversacion=" + data.origin.conversationId}><ChatIcon className="size-4"/></Link></IconButton> : null}
    {copies.length ? <ResponseDocumentDownloads compact documents={copies} downloads={downloads}/> : null}
    {/* «PDF fiscal» goes with the icons that go elsewhere, right before ⋮ (EM1-A, AC2). */}
    <ResponseFiscalPdf compact documents={fiscal} downloads={downloads}/>
    {/* ⋮ with «Anular» after the icons, before ↑ ↓ × (CW11-A), for whoever may change it now: canAmend. */}
    {data.canAmend && onCorrect && data.id === recordId ? <ResponseAmendActions disabled={loadingTarget} issuance={issuance} onVoid={() => setVoiding(recordId)}/> : null}
  </>}>
    <ResponseDetailContent state={state} formId={formId} recordId={recordId} onDecided={onDecided} onDecisionForbidden={onDecisionForbidden} decisionAllowed={decisionAllowed}/>
    {/* With a live issuance the void waits for its reversal (NC1-A): the panel stays, reads the flow again and says «Anulándose». */}
    {voiding === recordId ? <VoidResponseDialog formId={formId} recordId={recordId} number={data.number} owner={detail.scope.owner} issuance={issuance.issued ? "issued" : issuance.live ? "live" : undefined} onClose={() => setVoiding(null)}
      onVoided={() => { setVoiding(null); if (issuance.live) { void workflow.query.refetch(); void detail.query.refetch(); } else onVoided?.(); }}/> : null}
  </ResponsePanelFrame></ResponsePanelFilesScope>;
}
