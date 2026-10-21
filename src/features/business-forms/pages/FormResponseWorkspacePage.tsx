import { useParams } from "react-router";
import { usePermissions } from "@/auth/usePermissions";
import { ForbiddenPage } from "@/shared/ui/ForbiddenPage";
import { useResponseScope } from "../hooks/useResponseQueries";
import { FormPendingApprovals } from "../components/FormPendingApprovals";
import { FormResponsesPage } from "./FormResponsesPage";
export function FormResponseWorkspacePage() {
  const { formId = "" } = useParams();
  const { has } = usePermissions();
  const readScope = useResponseScope();
  if (readScope.allowed) return <FormResponsesPage/>;
  if (!has("formapprovals.decide")) return <ForbiddenPage/>;
  return <FormPendingApprovals formId={formId} standalone/>;
}
