import { useLayoutEffect, useRef, type ReactNode } from "react";
import { Link, useLocation, useNavigate } from "react-router";
import { useTranslation } from "react-i18next";
import { PrivateFormFilesScopeProvider } from "@/shared/hooks/PrivateFormFilesScope";
import { useMediaQuery } from "@/shared/hooks/useMediaQuery";
import { useResponseWorkspace } from "../hooks/useResponseWorkspace";
import { responseFullPath } from "../responseNavigationPaths";
import { Button } from "@/shared/ui/button";
import { Badge } from "@/shared/ui/badge";
import { Spinner } from "@/shared/ui/Spinner";
import { EmptyState } from "@/shared/ui/EmptyState";
import { ForbiddenPage } from "@/shared/ui/ForbiddenPage";
import { approvalStateVariant } from "../approvals";
import { useResponseDetailState } from "../hooks/useResponseDetailState";
import { ResponseDocumentDownloads } from "../components/ResponseDocuments";
import { ResponseDetailContent } from "../components/ResponseDetailContent";
import { ResponsePanelFrame, type ResponsePanelNavigation } from "../components/ResponsePanelFrame";

function ResponsePanelFilesScope({ enabled, scope, children }: { enabled: boolean; scope: string | null; children: ReactNode }) {
  return enabled ? <PrivateFormFilesScopeProvider scope={scope}>{children}</PrivateFormFilesScopeProvider> : children;
}
export function FormResponseDetailPage({ formId, recordId, navigation, onDecided, onDecisionForbidden, decisionAllowed = true, retainPreviousForm = false }: {
  formId: string; recordId: string; navigation: ResponsePanelNavigation; onDecided?: () => void; onDecisionForbidden?: () => void; decisionAllowed?: boolean; retainPreviousForm?: boolean;
}) {
  const mobile = useMediaQuery("(width < 640px)");
  const navigate = useNavigate();
  const location = useLocation();
  const workspace = useResponseWorkspace(formId);
  const redirected = useRef(false);
  useLayoutEffect(() => {
    if (!mobile || redirected.current) return;
    redirected.current = true;
    if (workspace.navigation?.selection.recordId !== recordId) workspace.setNavigation({ origin: "sheet", selection: { recordId }, search: location.search });
    workspace.prepareFull(recordId);
    navigate(responseFullPath(formId, recordId, location.search), { replace: true });
  }, [mobile, navigate, formId, recordId, location.search, workspace]);
  return mobile ? null : <QuickResponseDetail formId={formId} recordId={recordId} navigation={navigation} onDecided={onDecided} onDecisionForbidden={onDecisionForbidden} decisionAllowed={decisionAllowed} retainPreviousForm={retainPreviousForm}/>;
}
function QuickResponseDetail({ formId, recordId, navigation, onDecided, onDecisionForbidden, decisionAllowed, retainPreviousForm }: {
  formId: string; recordId: string; navigation: ResponsePanelNavigation; onDecided?: () => void; onDecisionForbidden?: () => void; decisionAllowed?: boolean; retainPreviousForm: boolean;
}) {
  const { t } = useTranslation("forms");
  const location = useLocation();
  const workspace = useResponseWorkspace(formId);
  const state = useResponseDetailState({ formId, recordId, busy: navigation.busy, navigationError: navigation.error, retryNavigation: navigation.onRetry, retainPreviousForm });
  const { detail, data, current, downloads, unavailable, fileScope, allowed, loadingTarget, loading } = state;
  if (!allowed) return <ResponsePanelFilesScope enabled={retainPreviousForm} scope={null}><ResponsePanelFrame title={t("responses.detail")} navigation={navigation}><ForbiddenPage/></ResponsePanelFrame></ResponsePanelFilesScope>;
  if (!data || unavailable) return <ResponsePanelFilesScope enabled={retainPreviousForm} scope={fileScope}><ResponsePanelFrame title={t("responses.detail")} navigation={navigation}>{detail.query.isPending ? <Spinner/> : <EmptyState embedded title={t(unavailable ? "responses.unavailable" : "responses.loadFailed")} action={unavailable ? undefined : <Button variant="outline" onClick={() => void detail.query.refetch()}>{t("common:actions.retry")}</Button>}/>}</ResponsePanelFrame></ResponsePanelFilesScope>;
  return <ResponsePanelFilesScope enabled={retainPreviousForm} scope={fileScope}><ResponsePanelFrame title={data.number} loading={loading} navigation={{ ...navigation, busy: navigation.busy || loadingTarget }} status={current ? <Badge variant={approvalStateVariant(current.recordState)}>{t("approvals.states." + current.recordState)}</Badge> : null} subtitle={data.name + " · " + t("responses.versionLabel", { version: data.versionNumber })} actions={<>
    <Button variant="outline" size="sm" asChild><Link to={responseFullPath(formId, recordId, location.search)} onClick={event => {
      if (event.defaultPrevented || event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
      if (workspace.navigation?.selection.recordId !== recordId) workspace.setNavigation({ origin: "sheet", selection: { recordId }, search: location.search });
      workspace.prepareFull(recordId);
    }}>{t("detail.openFull")}</Link></Button>
    {data.origin?.conversationId && detail.scope.user?.permissions.includes("whatsapp.read") ? <Button variant="link" size="inline" asChild><Link to={"/whatsapp/chat?conversacion=" + data.origin.conversationId}>{t("responses.openChat")}</Link></Button> : null}
    {current?.documents.length ? <ResponseDocumentDownloads documents={current.documents} downloads={downloads}/> : null}
  </>}>
    <ResponseDetailContent state={state} formId={formId} recordId={recordId} onDecided={onDecided} onDecisionForbidden={onDecisionForbidden} decisionAllowed={decisionAllowed}/>
  </ResponsePanelFrame></ResponsePanelFilesScope>;
}
