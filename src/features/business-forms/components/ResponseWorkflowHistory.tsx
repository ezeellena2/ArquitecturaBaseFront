import { useTranslation } from "react-i18next";
import { ApiError } from "@/shared/api/ApiError";
import { readErrorMessage } from "@/shared/api/errorFeedback";
import { formatDateTimeInZone } from "@/shared/lib/dateTime";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { Spinner } from "@/shared/ui/Spinner";
import { Surface } from "@/shared/ui/Surface";
import type { ResponseDetail } from "../api/responses";
import type { useResponseWorkflow } from "../hooks/useResponseWorkflow";
import { workflowNextAction } from "../workflow";
export function ResponseWorkflowHistory({ workflow, record, timeZoneId }: { workflow: ReturnType<typeof useResponseWorkflow>; record: ResponseDetail; timeZoneId?: string }) {
  const { t, i18n } = useTranslation("forms");
  const data = workflow.query.data?.recordId === record.id ? workflow.query.data : undefined;
  const date = (utc: string) => formatDateTimeInZone(utc, i18n.language, timeZoneId);
  const canManage = workflow.canManage;
  return <Surface title={t("workflow.title")} padded actions={data?.ruleRevision ? <span className="text-xs">{t("workflow.ruleRevision", { revision: data.ruleRevision })}</span> : undefined}>
    <ol className="flex flex-col gap-4">
      {record.history.map(event => <li key={event.kind} className="flex flex-wrap gap-2 text-sm"><time dateTime={event.atUtc}>{date(event.atUtc)}</time><span>{t("responses.history" + event.kind)}</span>{event.actor?.displayName ? <span>· {event.actor.displayName}</span> : null}</li>)}
      {data?.actions.map(action => {
        const next = canManage ? workflowNextAction(action) : null;
        return <li key={action.id} className="flex flex-wrap items-start gap-3 border-t border-[var(--color-border)] pt-3 text-sm">
          <time className="text-xs text-[var(--color-content-muted)]" dateTime={action.completedAtUtc ?? action.updatedAtUtc}>{date(action.completedAtUtc ?? action.updatedAtUtc)}</time>
          <div className="min-w-0 flex-1 space-y-2"><p>{t("rules.actions." + action.kind)}</p><p className="text-xs text-[var(--color-content-muted)]">{t("rules.events." + action.event)}</p>{action.reason ? <p>{action.reason}</p> : null}{action.state === "Uncertain" ? <p className="text-xs text-[var(--color-content-muted)]">{t("workflow.consultFirst")}</p> : action.state === "NotApplicable" ? <p className="text-xs text-[var(--color-content-muted)]">{t("workflow.notApplicable")}</p> : null}
            {next ? <Button variant="outline" size="sm" disabled={workflow.busy || workflow.query.isFetching || workflow.cooldown.isRunning} onClick={() => void workflow.act(action.id)}>{t(workflow.busy ? "workflow.working" : next === "consult" ? "workflow.consult" : "common:actions.retry")}</Button> : null}
          </div><Badge variant="outline">{t("workflow.states." + action.state)}</Badge>
        </li>;
      })}
    </ol>
    {workflow.query.isPending || !data && !workflow.query.isError ? <Spinner /> : null}
    {workflow.query.error ? <div className="space-y-2 text-sm"><p role="status">{readErrorMessage(workflow.query.error, t)}</p>{!(workflow.query.error instanceof ApiError && workflow.query.error.status === 404) ? <Button variant="outline" disabled={workflow.query.isFetching} onClick={() => void workflow.query.refetch()}>{t("common:actions.retry")}</Button> : null}</div> : null}
    {workflow.controlsDenied ? <p role="status" className="text-sm">{t("workflow.noManagePermission")}</p> : null}
    {workflow.cooldown.isRunning ? <p role="status" className="text-sm">{t("wait", { count: workflow.cooldown.seconds })}</p> : null}
    <p className="text-xs text-[var(--color-content-muted)]">{t("workflow.retryHint")}</p>
  </Surface>;
}
