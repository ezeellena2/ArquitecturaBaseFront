import { Fragment, useId, useRef, useState, type MouseEvent, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { ApiError } from "@/shared/api/ApiError";
import { useMediaQuery } from "@/shared/hooks/useMediaQuery";
import { useRestoreFocusOnClose } from "@/shared/hooks/useRestoreFocusOnClose";
import { ActionTooltip } from "@/shared/ui/ActionTooltip";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { CellText } from "@/shared/ui/CellText";
import { DataList } from "@/shared/ui/DataList";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/shared/ui/dialog";
import { DisabledReason } from "@/shared/ui/DisabledReason";
import { FormField } from "@/shared/ui/FormField";
import { CheckCheckIcon, RefreshIcon, SearchIcon } from "@/shared/ui/icons";
import { InfoTip } from "@/shared/ui/InfoTip";
import { Picker } from "@/shared/ui/Picker";
import { Spinner } from "@/shared/ui/Spinner";
import { Surface } from "@/shared/ui/Surface";
import { TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/shared/ui/table";
import { WideTable } from "@/shared/ui/WideTable";
import type { ResponseDetail } from "../api/responses";
import type { ResponseWorkflow } from "../api/workflow";
import type { useResponseWorkflow } from "../hooks/useResponseWorkflow";
import { sameWorkflowReviewTarget, workflowCanReview, type WorkflowReviewTarget } from "../workflow";
import { activityEmpty, workflowActivity, type ActivityRow } from "../workflowActivity";

type IssuedDocument = ResponseWorkflow["documents"][number];
const columns = ["date", "time", "what", "who", "channel", "detail", "state", "actions"] as const;

/**
 * The activity of a response, row by row (board VF2-A, decision 7 of «La respuesta como el formulario»): a row per thing that
 * happened, a datum per column (Fecha, Hora, Qué pasó, Quién, Canal, Detalle, Estado and Acciones), with the moments as rows
 * that separate. The full page reads it in a table from 640 px (`layout="page"`); the quick view, and the full page on a phone,
 * in a box per row, with «Qué pasó» on top and the other data with their names, two by two, like the items of a block.
 */
export function ResponseWorkflowHistory({ workflow, record, timeZoneId, documentActions, layout = "panel" }: {
  workflow: ReturnType<typeof useResponseWorkflow>; record: ResponseDetail; timeZoneId?: string; documentActions?: (document: IssuedDocument) => ReactNode;
  layout?: "panel" | "page";
}) {
  const { t, i18n } = useTranslation("forms");
  const uid = useId();
  const phone = useMediaQuery("(width < 640px)");
  const data = workflow.query.data?.recordId === record.id ? workflow.query.data : undefined;
  const canManage = workflow.canManage;
  const [reviewTarget, setReviewTarget] = useState<WorkflowReviewTarget | null>(null);
  const [wasSent, setWasSent] = useState<boolean | undefined>();
  const reviewFocus = useRef<HTMLElement | null>(null);
  const reviewingAction = data?.actions.find(action => action.id === reviewTarget?.runId);
  const reviewingRecipient = reviewingAction?.recipients.find(recipient => recipient.user.userId === reviewTarget?.recipientUserId);
  const reviewOpen = !!reviewingAction && reviewingAction.revision === reviewTarget?.expectedRevision && !!reviewingRecipient && canManage && workflowCanReview(reviewingRecipient);
  const needsConsult = !!reviewTarget && sameWorkflowReviewTarget(workflow.needsConsultReview, reviewTarget);
  // Cancel gives the focus back to «Resolver envío»; once confirmed the icon goes away and the focus goes to its row.
  const restoreFocus = useRestoreFocusOnClose(reviewOpen, reviewFocus);
  const disabled = workflow.busy || workflow.query.isFetching || workflow.cooldown.isRunning;
  // The wait of a 429 is the reason of each disabled action, not a text under the history or in the dialog. A background
  // refetch (every 2 s while an action runs, or on focus) is not the history working: it keeps the reason, so the actions
  // are not remounted under the mouse or the keyboard focus.
  const waitReason = workflow.busy || !workflow.cooldown.isRunning ? null : t("wait", { count: workflow.cooldown.seconds });
  const closeReview = () => { setReviewTarget(null); setWasSent(undefined); };
  // Why the choice is off when the last confirmation is unknown; not while the dialog works, which only turns it off.
  const consultFirst = needsConsult && !workflow.busy ? t("workflow.reviewCheckRequired") : null;
  // Only the touched icon says what it is doing (board LC1-A): its name turns into «Consultando…» or «Reintentando…» with its
  // ring, and «Consultando…» or «Confirmando…» in the dialog; the rest only turn off.
  const acting = workflow.working?.kind === "act" ? workflow.working.runId : null;
  const reviewing = workflow.working?.kind === "check" ? "workflow.working" : workflow.working?.kind === "review" ? "workflow.confirming" : null;
  const unknown = t("responses.unknownPerson");
  const bands = workflowActivity(record, data, { t, language: i18n.language, timeZoneId, canManage });
  const retryHelp = (text: string) => <InfoTip label={t("common:actions.moreInfo", { label: t("common:actions.retry") })} text={text}/>;
  // Only icons, each with its name in the tooltip (2026-11-20): a row never carries a button with text.
  const icons = (row: ActivityRow) => row.actions.length ? <div className="flex items-center justify-end gap-1">{row.actions.map(item => {
    if (item.kind === "document") return documentActions ? <Fragment key={item.document.id}>{documentActions(item.document)}</Fragment> : null;
    if (item.kind === "consult" || item.kind === "retry") {
      const busy = acting === item.action.id;
      const label = t(item.kind === "consult" ? busy ? "workflow.working" : "workflow.consult" : busy ? "responses.retrying" : "common:actions.retry");
      return <Fragment key={item.kind}>
        <RowIcon label={label} pending={busy} disabled={disabled} reason={waitReason} onClick={() => void workflow.act(item.action.id)}>{item.kind === "consult" ? <SearchIcon className="size-4"/> : <RefreshIcon className="size-4"/>}</RowIcon>
        {/* What Retry resumes goes in its (i), only where it is (decision of 2026-10-31). */}
        {item.kind === "retry" ? retryHelp(t("workflow.retryHint")) : null}
      </Fragment>;
    }
    if (item.kind === "review") return <RowIcon key="review" label={t("workflow.review")} disabled={disabled} reason={waitReason}
      onClick={event => { reviewFocus.current = event.currentTarget.closest("[data-activity-row]"); setWasSent(undefined); setReviewTarget({ runId: item.action.id, recipientUserId: item.recipient.user.userId, expectedRevision: item.action.revision }); }}><CheckCheckIcon className="size-4"/></RowIcon>;
    // A person of a role notice whose failure is confirmed is retried alone, from their own row (board RT1-A).
    const retrying = workflow.working?.kind === "recipient" && workflow.working.runId === item.action.id && workflow.working.recipientUserId === item.recipient.user.userId;
    return <Fragment key="retryRecipient">
      <RowIcon label={t(retrying ? "responses.retrying" : "common:actions.retry")} pending={retrying} disabled={disabled} reason={waitReason}
        onClick={() => void workflow.retryRecipient({ runId: item.action.id, recipientUserId: item.recipient.user.userId, expectedRevision: item.action.revision })}><RefreshIcon className="size-4"/></RowIcon>
      {retryHelp(t("workflow.retryRecipientHint"))}
    </Fragment>;
  })}</div> : null;
  const muted = (text: string) => text === activityEmpty ? <span className="text-[var(--color-content-muted)]">{text}</span> : text;
  const state = (row: ActivityRow) => row.tone ? <Badge variant={row.tone}>{row.state}</Badge> : muted(row.state);
  // A human review does not confirm the delivery of WhatsApp: it says so in the (i) next to what happened.
  const what = (row: ActivityRow) => row.whatHint ? <span className="inline-flex items-center gap-1">{row.what}<InfoTip label={t("common:actions.moreInfo", { label: row.what })} text={row.whatHint}/></span> : row.what;
  // The reason goes whole, with its lines: the only cell that may take several.
  const detail = (row: ActivityRow) => row.detail === activityEmpty ? muted(row.detail) : <span className="block min-w-40 whitespace-pre-wrap"><CellText text={row.detail}/></span>;

  const table = <WideTable label={t("detail.activity")}>
    <TableHeader><TableRow>{columns.map(column => <TableHead key={column} scope="col" className={column === "actions" ? "text-right" : undefined}>{t("detail.columns." + column)}</TableHead>)}</TableRow></TableHeader>
    {bands.map(band => <TableBody key={band.key} aria-labelledby={uid + band.key}>
      <TableRow tone="section" highlightExpanded={false}><TableCell id={uid + band.key} colSpan={columns.length} className="font-semibold">{band.title}</TableCell></TableRow>
      {band.rows.map(row => <TableRow key={row.key} tabIndex={-1} data-activity-row="">
        <TableCell><time dateTime={row.atUtc}>{row.date}</time></TableCell>
        <TableCell>{row.time}</TableCell>
        <TableCell>{what(row)}</TableCell>
        <TableCell>{muted(row.who)}</TableCell>
        <TableCell>{muted(row.channel)}</TableCell>
        <TableCell className="whitespace-normal">{detail(row)}</TableCell>
        <TableCell>{state(row)}</TableCell>
        <TableCell className="text-right">{icons(row)}</TableCell>
      </TableRow>)}
    </TableBody>)}
  </WideTable>;
  // A box per row: «Qué pasó» as its title, with its icons in its band like the items of a block, and below the data that apply
  // with their names, two by two; «Detalle» takes the whole width. The moment is the title that separates the boxes.
  const field = (column: typeof columns[number], value: ReactNode, wide = false) => <div key={column} className={wide ? "col-span-2 min-w-0" : "min-w-0"}>
    <dt className="text-[var(--color-content-muted)]">{t("detail.columns." + column)}</dt><dd className="break-words">{value}</dd></div>;
  const boxes = <ol className="flex flex-col gap-4">
    {bands.map(band => <li key={band.key} aria-labelledby={uid + band.key} className="flex flex-col gap-2">
      <p id={uid + band.key} className="text-sm font-semibold text-[var(--color-content-muted)]">{band.title}</p>
      <ol className="flex flex-col gap-2">{band.rows.map(row => <li key={row.key} tabIndex={-1} data-activity-row="">
        <Surface headingLevel={3} title={row.what} help={row.whatHint ?? undefined} actions={icons(row)}>
          <dl className="grid grid-cols-2 gap-x-3 gap-y-2 p-4 text-sm">
            {field("date", <time dateTime={row.atUtc}>{row.date}</time>)}{field("time", row.time)}
            {row.who !== activityEmpty ? field("who", row.who) : null}{row.channel !== activityEmpty ? field("channel", row.channel) : null}
            {row.detail !== activityEmpty ? field("detail", <span className="whitespace-pre-wrap">{row.detail}</span>, true) : null}
            {row.state !== activityEmpty ? field("state", state(row)) : null}
          </dl>
        </Surface>
      </li>)}</ol>
    </li>)}
  </ol>;
  return <>
    {layout === "page" && !phone ? table : boxes}
    {workflow.query.isPending || !data && !workflow.query.isError ? <Spinner /> : null}
    {workflow.query.error ? <div className="space-y-2 text-sm"><p role="status">{t("common:states.loadFailed")}</p>{!(workflow.query.error instanceof ApiError && workflow.query.error.status === 404) ? <Button variant="outline" pending={workflow.query.isFetching} onClick={() => void workflow.query.refetch()}>{t(workflow.query.isFetching ? "responses.retrying" : "common:actions.retry")}</Button> : null}</div> : null}
    {workflow.controlsDenied ? <p role="status" className="text-sm">{t("workflow.noManagePermission")}</p> : null}
    {/* While the review works the dialog waits open, with the × off and its gerund as the reason, as a confirmation that waits.
        The recipient reads in its row (DL, 2026-11-11). Sent or not is chosen in the only piece to choose (DS1-A, 2026-11-22), with
        the consequence of each as the grey line of its option; after a lost confirmation whose reading also failed, consulting
        first is the reason of the choice that is off, not a sentence under it (MA1-A). */}
    <Dialog open={reviewOpen} onOpenChange={open => { if (!open && !workflow.busy) closeReview(); }}>
      <DialogContent aria-describedby={undefined} onCloseAutoFocus={restoreFocus} closeDisabledReason={workflow.busy ? t(reviewing ?? "workflow.confirming") : undefined} onEscapeKeyDown={event => { if (workflow.busy) event.preventDefault(); }} onPointerDownOutside={event => { if (workflow.busy) event.preventDefault(); }}>
        <DialogHeader><DialogTitle>{t("workflow.reviewTitle")}</DialogTitle></DialogHeader>
        <DataList items={[{ key: "recipient", label: t("workflow.recipientLabel"), value: reviewingRecipient?.user.displayName ?? unknown }]} />
        <FormField label={t("workflow.reviewChoice")}>
          <DisabledReason reason={consultFirst} className="grid w-full"><Picker label={t("workflow.reviewChoice")} placeholder={t("select")} disabled={workflow.busy || needsConsult}
            value={wasSent === undefined ? null : String(wasSent)} onChange={value => setWasSent(value === "true")} options={[
              { id: "true", label: t("workflow.sent"), description: t("workflow.sentHint") },
              { id: "false", label: t("workflow.notSent"), description: t(reviewingAction?.kind === "NotifyRole" ? "workflow.notSentRoleHint" : "workflow.notSentHint") },
            ]}/></DisabledReason>
        </FormField>
        <DialogFooter><Button variant="outline" disabled={workflow.busy} onClick={closeReview}>{t("common:actions.cancel")}</Button><DisabledReason reason={waitReason} className="max-sm:*:flex-1"><Button pending={!!reviewing} disabled={disabled || !needsConsult && wasSent === undefined} onClick={async () => { if (!reviewTarget) return; const resolved = needsConsult ? await workflow.checkReview(reviewTarget) : wasSent !== undefined && await workflow.review(reviewTarget, wasSent); if (resolved) closeReview(); }}>{t(reviewing ?? (needsConsult ? "workflow.consult" : wasSent === undefined ? "workflow.confirmReview" : wasSent ? "workflow.confirmSent" : "workflow.confirmNotSent"))}</Button></DisabledReason></DialogFooter>
      </DialogContent>
    </Dialog>
  </>;
}

/// An icon of a row's «Acciones» (2026-11-20): its name in the tooltip and, off by a 429, the wait as its reason (MA1-A). Unlike
/// `IconButton`, its button stays the same node while another action turns it off and on, or while it works with its ring: the
/// history reads again every 2 s while an action runs, and the keyboard focus or the mouse would lose it each time.
function RowIcon({ label, reason, disabled, pending = false, onClick, children }: {
  label: string; reason: string | null; disabled: boolean; pending?: boolean; onClick: (event: MouseEvent<HTMLButtonElement>) => void; children: ReactNode;
}) {
  const button = <Button type="button" variant="ghost" size="icon" aria-label={label} pending={pending} disabled={disabled} onClick={onClick}>{pending ? null : children}</Button>;
  return reason && disabled && !pending ? <DisabledReason reason={reason}>{button}</DisabledReason> : <ActionTooltip label={label}>{button}</ActionTooltip>;
}
