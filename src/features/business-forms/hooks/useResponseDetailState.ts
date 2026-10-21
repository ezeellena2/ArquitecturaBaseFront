import { useCallback, useContext, useState } from "react";
import { useTranslation } from "react-i18next";
import { ApiError } from "@/shared/api/ApiError";
import { readErrorMessage } from "@/shared/api/errorFeedback";
import { notify } from "@/shared/ui/notifications";
import { useResponseDetail, useResponseFeedback } from "./useResponseQueries";
import { ResponseWorkspaceContext } from "./useResponseWorkspace";
import { useResponseDocumentDownloads } from "./useResponseDocumentDownloads";
import { useResponseWorkflow } from "./useResponseWorkflow";

interface ResponseDetailStateOptions {
  formId: string;
  recordId: string;
  busy?: boolean;
  navigationError?: unknown;
  retryNavigation?: () => unknown;
  retainPreviousForm?: boolean;
}

export function useResponseDetailState({ formId, recordId, busy = false, navigationError, retryNavigation, retainPreviousForm = false }: ResponseDetailStateOptions) {
  const { t } = useTranslation("forms");
  const detail = useResponseDetail(recordId, formId, retainPreviousForm);
  const workflow = useResponseWorkflow(formId, recordId, retainPreviousForm);
  const workspace = useContext(ResponseWorkspaceContext);
  useResponseFeedback(detail.query.isPending ? null : detail.query.error ?? workflow.error ?? navigationError,
    "responses:detail-page:" + detail.scope.owner + ":" + formId,
    detail.query.error ? detail.query.refetch : workflow.error ? workflow.query.refetch : retryNavigation);
  const denyWorkspace = workspace?.deny;
  const deny = useCallback(() => denyWorkspace?.(), [denyWorkspace]);
  const onFileError = useCallback((error: unknown) => notify({ id: "responses:files:" + detail.scope.owner + ":" + recordId, kind: "error", message: readErrorMessage(error, t) }), [detail.scope.owner, recordId, t]);
  const data = detail.query.data;
  const [presentedWorkflow, setPresentedWorkflow] = useState<{ owner: string; data: NonNullable<typeof workflow.query.data> } | null>(null);
  if (presentedWorkflow && (!detail.scope.allowed || presentedWorkflow.owner !== detail.scope.owner)) setPresentedWorkflow(null);
  if (detail.scope.allowed && workflow.query.data?.recordId === data?.id && workflow.query.data && presentedWorkflow?.data !== workflow.query.data) setPresentedWorkflow({ owner: detail.scope.owner, data: workflow.query.data });
  const current = workflow.query.data?.recordId === data?.id ? workflow.query.data : presentedWorkflow?.owner === detail.scope.owner && presentedWorkflow.data.recordId === data?.id ? presentedWorkflow.data : undefined;
  const downloads = useResponseDocumentDownloads(detail.scope.owner, recordId, deny, busy || detail.query.isPlaceholderData || data?.id !== recordId);
  const unavailable = !!data && !detail.query.isPlaceholderData && data.definitionId !== formId || detail.query.error instanceof ApiError && detail.query.error.status === 404;
  const fileScope = detail.scope.allowed && data && !unavailable ? detail.scope.owner + ":" + data.definitionId : null;
  const allowed = detail.scope.allowed && !(detail.query.error instanceof ApiError && detail.query.error.status === 403);
  const loadingTarget = busy || detail.query.isPlaceholderData || data?.id !== recordId;
  const hasPhotos = data?.values.some(value => value.type === "photo") ?? false;
  const photos = data?.values.filter(value => value.type === "photo").flatMap(value => Array.isArray(value.value) ? value.value : []) ?? [];
  return { detail, workflow, data, current, downloads, unavailable, fileScope, allowed, loadingTarget,
    loading: busy || detail.query.isFetching, hasPhotos, photos, deny, onFileError };
}
export type ResponseDetailState = ReturnType<typeof useResponseDetailState>;
