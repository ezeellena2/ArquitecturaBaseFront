import { useLayoutEffect } from "react";
import { Navigate, useLocation, useMatch, useParams } from "react-router";
import { useMediaQuery } from "@/shared/hooks/useMediaQuery";
import { responseFullPath } from "../responseNavigationPaths";
import { usePermissions } from "@/auth/usePermissions";
import { ForbiddenPage } from "@/shared/ui/ForbiddenPage";
import { useResponseScope } from "../hooks/useResponseQueries";
import { useResponseWorkspace } from "../hooks/useResponseWorkspace";
import { FormPendingApprovals } from "../components/FormPendingApprovals";
import { FormResponsesPage } from "./FormResponsesPage";
export function FormResponseWorkspacePage() {
  const { formId = "" } = useParams();
  const { has } = usePermissions();
  const readScope = useResponseScope();
  const mobile = useMediaQuery("(width < 640px)");
  const direct = useMatch("/formularios/:formId/respuestas/:recordId");
  const location = useLocation();
  if (readScope.allowed && mobile && direct?.params.recordId) return <MobileResponseRedirect formId={formId} recordId={direct.params.recordId} search={location.search}/>;
  if (readScope.allowed) return <FormResponsesPage/>;
  if (!has("formapprovals.decide")) return <ForbiddenPage/>;
  return <FormPendingApprovals formId={formId} standalone/>;
}

function MobileResponseRedirect({ formId, recordId, search }: { formId: string; recordId: string; search: string }) {
  const workspace = useResponseWorkspace(formId);
  useLayoutEffect(() => {
    if (workspace.navigation?.selection.recordId === recordId) workspace.prepareFull(recordId);
  }, [recordId, workspace]);
  return <Navigate to={responseFullPath(formId, recordId, search)} replace/>;
}