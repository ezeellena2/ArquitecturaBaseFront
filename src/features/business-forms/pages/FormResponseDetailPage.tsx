import {
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { Link, useLocation, useParams } from "react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { ApiError } from "@/shared/api/ApiError";
import { readErrorMessage } from "@/shared/api/errorFeedback";
import { useBreadcrumbLeaf } from "@/shared/hooks/useBreadcrumbLeaf";
import { useQueryUpdate } from "@/shared/hooks/useQueryUpdate";
import { formatDateTimeInZone } from "@/shared/lib/dateTime";
import { Page } from "@/shared/ui/Page";
import { Surface } from "@/shared/ui/Surface";
import { Button } from "@/shared/ui/button";
import { Spinner } from "@/shared/ui/Spinner";
import { EmptyState } from "@/shared/ui/EmptyState";
import { ForbiddenPage } from "@/shared/ui/ForbiddenPage";
import { notify } from "@/shared/ui/notifications";
import { fetchResponseSheet } from "../api/responses";
import {
  useResponseDetail,
  useResponseFeedback,
  useResponseSheet,
} from "../hooks/useResponseQueries";
import { useResponseRouteQuery } from "../hooks/useResponseRouteQuery";
import { ResponseWorkspaceContext } from "../hooks/useResponseWorkspace";
import { useResponseWorkflow } from "../hooks/useResponseWorkflow";
import { ResponseDocuments } from "../components/ResponseDocuments";
import { ApprovalDecisionPanel } from "../components/ApprovalDecisionPanel";
import { ResponseWorkflowHistory } from "../components/ResponseWorkflowHistory";
import { ResponseValue } from "../components/ResponseValue";
export function FormResponseDetailPage() {
  const { formId = "", recordId = "" } = useParams();
  const { t, i18n } = useTranslation("forms");
  const detail = useResponseDetail(recordId, formId);
  const route = useResponseRouteQuery(formId);
  const workflow = useResponseWorkflow(formId, recordId);
  const sheet = useResponseSheet(formId, route.query, route.ready);
  const client = useQueryClient();
  const update = useQueryUpdate();
  const workspace = useContext(ResponseWorkspaceContext);
  const [moving, setMoving] = useState(false);
  const [moveError, setMoveError] = useState<unknown>(null);
  const live = useRef(true);
  const owner = useRef(detail.scope.owner);
  useLayoutEffect(() => {
    owner.current = detail.scope.owner;
  }, [detail.scope.owner]);
  useEffect(() => {
    live.current = true;
    return () => {
      live.current = false;
    };
  }, []);
  useResponseFeedback(
    detail.query.isPending ? null : detail.query.error ?? sheet.query.error ?? workflow.error ?? moveError,
    `responses:detail-page:${detail.scope.owner}:${formId}`,
    detail.query.error ? detail.query.refetch : sheet.query.error ? sheet.query.refetch : workflow.error ? workflow.query.refetch : sheet.query.refetch,
  );
  const deny = useCallback(() => workspace?.deny(), [workspace]);
  const onFileError = useCallback(
    (error: unknown) =>
      notify({
        id: `responses:files:${detail.scope.owner}:${recordId}`,
        kind: "error",
        message: readErrorMessage(error, t),
      }),
    [detail.scope.owner, recordId, t],
  );
  const data = detail.query.data;
  useBreadcrumbLeaf(data?.number, data?.name);
  const location = useLocation();
  const approvalReturn = (location.state as { approvalReturn?: unknown } | null)?.approvalReturn;
  const fromApprovals = typeof approvalReturn === "string" && /^\/formularios\/por-aprobar(?:\?|$)/.test(approvalReturn);
  const back = fromApprovals ? approvalReturn : `/formularios/${formId}/respuestas?${route.params}`;
  const index =
    sheet.query.data?.records.items.findIndex(
      (record) => record.id === recordId,
    ) ?? -1;
  const previous =
    index > 0 || (index === 0 && !!sheet.query.data?.records.hasPrevious);
  const next =
    index >= 0 &&
    (index < (sheet.query.data?.records.items.length ?? 0) - 1 ||
      !!sheet.query.data?.records.hasNext);
  const move = async (direction: number) => {
    const current = sheet.query.data;
    if (!current || moving || detail.query.isPlaceholderData) return;
    const expected = detail.scope.owner;
    const position = index + direction;
    let id: string | undefined = current.records.items[position]?.id;
    let page = current.records.page;
    setMoveError(null);
    setMoving(true);
    try {
      if (!id) {
        page += direction;
        const filter = { ...route.query, page };
        const result = await client.fetchQuery({
          queryKey: ["form-responses", expected, "sheet", formId, filter],
          queryFn: ({ signal }) => fetchResponseSheet(formId, filter, signal),
          gcTime: 0,
          meta: { errorOwner: "local" },
        });
        id =
          direction < 0
            ? result.records.items.at(-1)?.id
            : result.records.items[0]?.id;
      }
      if (id && live.current && owner.current === expected)
        update(
          { page: page === 1 ? undefined : String(page) },
          {
            pathname: `/formularios/${formId}/respuestas/${id}`,
            replace: false,
          },
        );
    } catch (error) {
      if (live.current && owner.current === expected) setMoveError(error);
    } finally {
      if (live.current) setMoving(false);
    }
  };
  if (
    !detail.scope.allowed ||
    (detail.query.error instanceof ApiError &&
      detail.query.error.status === 403)
  )
    return <ForbiddenPage />;
  if (detail.query.isPending)
    return (
      <Page title={t("responses.detail")}>
        <Spinner />
      </Page>
    );
  if (!data)
    return (
      <Page
        title={t("responses.detail")}
        backTo={{ to: back, label: t(fromApprovals ? "approvals.back" : "responses.back") }}
      >
        <Surface>
          <EmptyState
            embedded
            title={t(
              detail.query.error instanceof ApiError &&
                detail.query.error.status === 404
                ? "responses.unavailable"
                : "responses.loadFailed",
            )}
            action={
              detail.query.error instanceof ApiError &&
              detail.query.error.status === 404 ? (
                <Button asChild variant="outline">
                  <Link to={back}>{t("responses.back")}</Link>
                </Button>
              ) : (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    void detail.query.refetch();
                  }}
                >
                  {t("common:actions.retry")}
                </Button>
              )
            }
          />
        </Surface>
      </Page>
    );
  if (data.definitionId !== formId)
    return (
      <Page title={t("responses.detail")}>
        <EmptyState title={t("responses.unavailable")} />
      </Page>
    );
  const date = (utc: string) =>
    formatDateTimeInZone(utc, i18n.language, detail.scope.user?.timeZoneId);
  const photos = data.values
    .filter((value) => value.type === "photo")
    .flatMap((value) => (Array.isArray(value.value) ? value.value : []));
  return (
    <section aria-label={t("responses.detail")} aria-busy={detail.query.isFetching}>
    <Page
      title={data.number}
      status={`${data.name} · ${t("responses.versionLabel", { version: data.versionNumber })}`}
      backTo={{ to: back, label: t("responses.back") }}
      actions={
        <div className="flex items-center gap-2">
          {index >= 0 && sheet.query.data ? <span className="text-sm">{t("responses.position", { position: (sheet.query.data.records.page - 1) * sheet.query.data.records.pageSize + index + 1, count: sheet.query.data.records.totalCount })}</span> : null}
          <Button
            type="button"
            variant="outline"
            disabled={!previous || moving}
            onClick={() => {
              void move(-1);
            }}
          >
            {t("responses.previous")}
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={!next || moving}
            onClick={() => {
              void move(1);
            }}
          >
            {t("responses.next")}
          </Button>
        </div>
      }
    >
      {workflow.query.data?.recordId === data.id && workflow.query.data.task?.state === "Open" ? <Surface title={t("approvals.title")} padded><ApprovalDecisionPanel taskId={workflow.query.data.task.id} onDecided={() => { void workflow.query.refetch(); void sheet.query.refetch(); }} /></Surface> : null}
      <Surface title={t("responses.answer")} padded>
        <dl className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          {data.values.map((value) => (
            <div
              key={value.fieldId}
              className={
                value.type === "photo" || value.type === "document"
                  ? "min-w-0 sm:col-span-2"
                  : "min-w-0"
              }
            >
              <dt className="mb-2 text-sm font-medium text-[var(--color-content-muted)]">
                {value.label}
              </dt>
              <dd className="text-sm">
                <ResponseValue
                  cell={{
                    ...value,
                    state:
                      value.value === null ||
                      (Array.isArray(value.value) && value.value.length === 0)
                        ? "Unanswered"
                        : "Answered",
                  }}
                  actor={detail.scope.user!.id}
                  recordId={data.id}
                  number={data.number}
                  label={value.label}
                  detail
                  viewerFiles={photos}
                  onForbidden={deny}
                  onError={onFileError}
                  detailLink=""
                />
              </dd>
            </div>
          ))}
        </dl>
      </Surface>
      <Surface title={t("responses.origin")} padded>
        <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <dt>{t("responses.actor")}</dt>
            <dd>{data.actor.displayName ?? t("responses.unknownPerson")}</dd>
          </div>
          <div>
            <dt>{t("responses.channel")}</dt>
            <dd>
              {t(
                data.channel === "phone"
                  ? "responses.whatsapp"
                  : "responses.unknownChannel",
              )}
              {data.origin?.maskedAddress
                ? ` · ${data.origin.maskedAddress}`
                : ""}
            </dd>
          </div>
          <div>
            <dt>{t("responses.received")}</dt>
            <dd>{date(data.submittedAtUtc)}</dd>
          </div>
          {data.origin ? (
            <div>
              <dt>{t("responses.sentBy")}</dt>
              <dd>
                {data.origin.senderName ?? t("responses.unknownPerson")} ·{" "}
                {date(data.origin.sentAtUtc)}
              </dd>
            </div>
          ) : null}
        </dl>
        {data.origin?.conversationId &&
        detail.scope.user?.permissions.includes("whatsapp.read") ? (
          <Button variant="link" asChild>
            <Link
              to={`/whatsapp/chat?conversacion=${data.origin.conversationId}`}
            >
              {t("responses.openChat")}
            </Link>
          </Button>
        ) : null}
      </Surface>
      {workflow.query.data?.recordId === data.id ? <ResponseDocuments key={detail.scope.owner+":"+data.id} recordId={data.id} documents={workflow.query.data.documents} onForbidden={deny} timeZoneId={detail.scope.user?.timeZoneId}/> : null}
      <ResponseWorkflowHistory key={"workflow:"+detail.scope.owner+":"+data.id} workflow={workflow} record={data} timeZoneId={detail.scope.user?.timeZoneId} />
    </Page>
    </section>
  );
}
