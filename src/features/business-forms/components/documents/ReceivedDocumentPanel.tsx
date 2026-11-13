import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router";
import { useTranslation } from "react-i18next";
import { ApiError } from "@/shared/api/ApiError";
import { useBreadcrumbLeaf } from "@/shared/hooks/useBreadcrumbLeaf";
import { formatDateInZone, formatDateTimeInZone } from "@/shared/lib/dateTime";
import { Badge } from "@/shared/ui/badge";
import { Banner } from "@/shared/ui/Banner";
import { Button } from "@/shared/ui/button";
import { ConfirmDialog } from "@/shared/ui/ConfirmDialog";
import { DataList } from "@/shared/ui/DataList";
import { DisabledReason } from "@/shared/ui/DisabledReason";
import { DocumentViewer } from "@/shared/ui/DocumentViewer";
import { EmptyState } from "@/shared/ui/EmptyState";
import { FormField } from "@/shared/ui/FormField";
import { NativeSelect } from "@/shared/ui/NativeSelect";
import { Spinner } from "@/shared/ui/Spinner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/shared/ui/Tabs";
import { receivedDocumentForbidden, useReceivedDocumentDetail, useReceivedDocumentFile, useReceivedDocumentReadWait, useReceivedDocumentReview,
  useReceivedDocumentScope } from "../../hooks/useReceivedDocuments";
import { documentFormProposalPath } from "../../documentFormProposal";
import { receivedDocumentActions, receivedDocumentFieldId, receivedDocumentForms, receivedDocumentName, receivedDocumentReason, receivedDocumentRowLabel, receivedDocumentStateLabel,
  receivedDocumentStateVariant } from "../../receivedDocuments";
import { ResponsePanelFrame, type ResponsePanelNavigation } from "../ResponsePanelFrame";
import { ReceivedDocumentData } from "./ReceivedDocumentData";
import { ReceivedDocumentHistory } from "./ReceivedDocumentHistory";
import { ReceivedDocumentRow } from "./ReceivedDocumentRow";

const retentionDays = 90;

/**
 * The panel of a document (DOC5-A), in the place of the response's quick view (D2) and with its frame: ↑ ↓ go through the list, Escape
 * closes it and the foot says where it is; on the phone it opens on its own screen with the actions at the bottom. «Revisar» has the
 * document (`DocumentViewer`), why it is where it is, the form the AI recognized with how sure it is, and its data; «Historial (N)»,
 * what happened. With «Revisar documentos» (the server's `canReview`) it discards, reopens, changes its form and passes it to the
 * form; without it everything is read. The tab goes in the address, like D2's. A reading that waits for a 429 says so in its «Reintentar»,
 * and a change of form whose reading failed stops, says so and offers «Reintentar» without keeping the actions off.
 */
export function ReceivedDocumentPanel({ documentId, navigation, onDenied }: { documentId: string; navigation: ResponsePanelNavigation; onDenied: () => void }) {
  const { t, i18n } = useTranslation("formDocuments");
  const scope = useReceivedDocumentScope();
  const zone = scope.user?.timeZoneId;
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const tab = params.get("tab") === "history" ? "history" : "review";
  const detail = useReceivedDocumentDetail(documentId);
  const shown = detail.data;
  const current = shown?.document.id.toLowerCase() === documentId.toLowerCase() && !detail.isPlaceholderData ? shown : undefined;
  // A rejected file the inbox kept no copy of is never asked for, and a row's spreadsheet only when it is downloaded (VC1-A).
  const file = useReceivedDocumentFile(current?.document.file.stored && !current.document.row ? current.document.id : undefined);
  // The confirmation of «Descartar», with the day it would be deleted, counted when it opens.
  const [discarding, setDiscarding] = useState<string | null>(null);
  const review = useReceivedDocumentReview(current, { onDenied });
  const detailWait = useReceivedDocumentReadWait(detail.error);
  const fileWait = useReceivedDocumentReadWait(file.error);
  const named = (key: string, values?: Record<string, string>) => t(key, values);
  useBreadcrumbLeaf(current ? receivedDocumentName(current.document, named) : undefined);
  const denied = receivedDocumentForbidden(detail.error) || receivedDocumentForbidden(file.error);
  useEffect(() => { if (denied) onDenied(); }, [denied, onDenied]);
  // A change of form that runs keeps being read where it was left, whoever asked for it (the server reads it with the asker's
  // context): after reloading, coming back to the document or opening one someone else is changing. Only whoever reviews reads it;
  // whoever only sees it reads «Leyendo…» until the document is read again.
  const { resume } = review;
  const running = current?.extraction;
  const asked = current ? [...current.history].reverse().find(event => event.kind === "extractionRequested") : undefined;
  useEffect(() => { if (current?.canReview && running) resume(current.document.id, running.requestId, asked?.detail ?? ""); }, [current, running, asked, resume]);

  const frame = { label: t("panel.label"), failedLabel: t("loadFailed") };
  if (!shown) return <ResponsePanelFrame {...frame} title={t("panel.label")} navigation={navigation}>
    {detail.isPending ? <Spinner /> : <EmptyState embedded title={t(detail.error instanceof ApiError && detail.error.status === 404 ? "panel.unavailable" : "panel.loadFailed")}
      action={detail.error instanceof ApiError && detail.error.status === 404 ? undefined : <DisabledReason reason={detailWait}>
        <Button variant="outline" disabled={!!detailWait} onClick={() => void detail.refetch()}>{t("common:actions.retry")}</Button>
      </DisabledReason>} />}
  </ResponsePanelFrame>;

  const document = shown.document;
  const actions = receivedDocumentActions(shown);
  const label = receivedDocumentStateLabel(document);
  const person = document.sender.displayName ?? t("unknownPerson");
  // A repeated row names the data that matched, «A», «A» y «B», as the menu's language joins them.
  const reason = receivedDocumentReason(shown, t("unknownPerson"),
    labels => new Intl.ListFormat(i18n.language, { type: "conjunction" }).format(labels.map(label => t("reasons.row.datum", { label }))));
  const row = document.row ? receivedDocumentRowLabel(document.row) : null;
  const forms = receivedDocumentForms(shown);
  const candidate = review.candidate;
  const working = review.working;
  // A change of form whose reading this panel stopped because it failed says so and leaves the document as it is, with its actions.
  const stalled = review.stalled && running && review.stalled.requestId === running.requestId.toLowerCase() ? review.stalled : null;
  const followed = stalled ? undefined : running;
  // While its data are read for another form, nothing else changes it: the form is named as the history names it.
  const readingForm = working?.work === "form" && working.form ? working.form : followed ? asked?.detail : undefined;
  const reading = readingForm ? t("extraction.reading", { form: readingForm }) : working?.work === "form" || followed ? t("extraction.readingOther") : null;
  const busy = !!working || !!followed || !current;
  const wait = review.cooldown.isRunning ? t("wait", { count: review.cooldown.seconds }) : null;
  // VC1-A: a proposed document its person was sent waits for them until its deadline; its actions stay in place, off, with the reason
  // over them.
  const waiting = actions.waiting && document.replyExpiresAtUtc
    ? t(row ? "reasons.row.waiting" : "reasons.waiting", { person, date: formatDateTimeInZone(document.replyExpiresAtUtc, i18n.language, zone) }) : null;
  const reasonOf = (blocked: string | null) => waiting ?? wait ?? blocked;
  const selectedForm = document.form?.definitionId ?? "";
  const outcome = shown.proposal?.outcome;
  const certainty = document.form && outcome && outcome !== "unknown" ? <Badge variant={outcome === "sure" ? "success" : "warning"}>{t("form." + outcome)}</Badge> : null;
  const values = candidate?.values ?? [];
  const pass = async () => {
    const field = await review.submit();
    // After the render that unfolds it, if it was under «Ver los N datos más».
    if (field) setTimeout(() => globalThis.document.getElementById(receivedDocumentFieldId(field))?.focus(), 0);
  };
  const changeTab = (next: string) => setParams(previous => { const result = new URLSearchParams(previous); if (next === "history") result.set("tab", next); else result.delete("tab"); return result; }, { replace: true });

  const footerActions = actions.discard || actions.reopen || actions.pass ? <>
    {actions.discard ? <DisabledReason reason={busy ? null : reasonOf(null)} className="max-sm:*:flex-1">
      <Button type="button" variant="destructive-outline" disabled={busy || !!waiting || !!wait} pending={working?.work === "discard"}
        onClick={() => setDiscarding(formatDateInZone(new Date(Date.now() + retentionDays * 86_400_000).toISOString(), i18n.language, zone))}>
        {working?.work === "discard" ? t("discard.pending") : t("discard.action")}
      </Button>
    </DisabledReason> : null}
    {actions.reopen ? <DisabledReason reason={busy ? null : wait} className="max-sm:*:flex-1">
      <Button type="button" variant="outline" disabled={busy || !!wait} pending={working?.work === "reopen"} onClick={() => void review.reopen()}>
        {working?.work === "reopen" ? t("reopen.pending") : t("reopen.action")}
      </Button>
    </DisabledReason> : null}
    {actions.pass ? <DisabledReason reason={busy ? null : reasonOf(candidate ? null : t("pass.noForm"))} className="max-sm:*:flex-1">
      <Button type="button" disabled={busy || !!waiting || !!wait || !candidate} pending={working?.work === "pass"} onClick={() => void pass()}>
        {working?.work === "pass" ? t("pass.pending") : t("pass.action")}
      </Button>
    </DisabledReason> : null}
  </> : undefined;

  return <ResponsePanelFrame {...frame} title={document.file.name} loading={!current}
    navigation={{ ...navigation, busy: navigation.busy || !current }}
    status={<Badge variant={receivedDocumentStateVariant(label)}>{t("states." + label)}</Badge>}
    subtitle={row ? t("panel.rowSubtitle", { row: t(row.key, row.values), person, date: formatDateTimeInZone(document.receivedAtUtc, i18n.language, zone) })
      : t("panel.subtitle", { person, date: formatDateTimeInZone(document.receivedAtUtc, i18n.language, zone) })}
    footer={footerActions}>
    <Tabs value={tab} onValueChange={changeTab}>
      <TabsList aria-label={t("tabs.label")}>
        <TabsTrigger value="review">{t("tabs.review")}</TabsTrigger>
        <TabsTrigger value="history">{t("tabs.history", { count: shown.history.length })}</TabsTrigger>
      </TabsList>
      <TabsContent value="review" className="flex flex-col gap-4 pt-3">
        {/* A rejected file without a copy shows its name (the title) and its reason (the banner), with nothing to see or download. A row
            shows its cells as they came, with its spreadsheet to download (VC1-A). */}
        {document.row && shown.rowCells ? <ReceivedDocumentRow key={document.id} documentId={document.id} name={document.file.name} cells={shown.rowCells} loading={!current} onDenied={onDenied} />
          : document.file.stored ? <DocumentViewer key={document.id} name={document.file.name} mediaType={document.file.mediaType} blob={file.data} loading={!current || file.isPending}
          failed={file.isError} onRetry={() => void file.refetch()} retryReason={fileWait} /> : null}
        {reason ? <Banner>{t(reason.key, reason.values)}</Banner> : null}
        {/* The forms it can change to are the ones the server can read it for: without any, the form is read as it is. */}
        {actions.changeForm && forms.length > 0 ? <div className="flex flex-col gap-1.5">
          <FormField label={t("form.label")} help={t(row ? "form.rowHelp" : "form.help")} beside={certainty}>
            <DisabledReason reason={busy ? null : waiting ?? wait}>
              <NativeSelect value={selectedForm} disabled={busy || !!waiting || !!wait} className="sm:w-72"
                onChange={event => { const form = forms.find(item => item.definitionId === event.target.value); if (form) void review.changeForm(form.definitionId, form.name); }}>
                {selectedForm ? null : <option value="">{t("form.choose")}</option>}
                {forms.map(form => <option key={form.definitionId} value={form.definitionId}>{form.name}</option>)}
              </NativeSelect>
            </DisabledReason>
          </FormField>
          {/* A select never chooses the option it shows: reading its data again for its own form goes here. */}
          {document.form ? <div><DisabledReason reason={busy ? null : waiting ?? wait}>
            <Button type="button" variant="link" size="inline" disabled={busy || !!waiting || !!wait}
              onClick={() => { if (document.form) void review.changeForm(document.form.definitionId, document.form.name); }}>
              {t("form.readAgain", { form: document.form.name })}
            </Button>
          </DisabledReason></div> : null}
        </div> : <DataList items={[
          { key: "form", label: t("form.label"), value: <span className="inline-flex flex-wrap items-center gap-1.5">{document.form?.name ?? t("form.none")}{certainty}</span> },
          ...document.record ? [{ key: "record", label: t("record.label"), value: scope.readsResponses && document.form
            ? <Link to={`/formularios/${document.form.definitionId}/respuestas/${document.record.recordId}`} className="font-medium text-[var(--color-brand-700)] underline">{document.record.number}</Link>
            : document.record.number }] : [],
        ]} />}
        {/* DOC6: an unclassified document with its reading and its copy can become a form of its own, for whoever reviews documents and
            designs forms: its page asks for the proposal under a new request. */}
        {scope.buildsForms && document.state === "unclassified" && shown.reading && document.file.stored ? <div>
          <DisabledReason reason={busy ? t("formProposal.busy") : null}>
            <Button type="button" variant="outline" size="sm" disabled={busy} onClick={() => void navigate(documentFormProposalPath(crypto.randomUUID(), { documentId: document.id }))}>
              {t("formProposal.build")}
            </Button>
          </DisabledReason>
        </div> : null}
        {reading ? <p role="status" className="flex items-center gap-2 text-sm text-[var(--color-content-muted)]"><Spinner decorative />{reading}</p> : null}
        {stalled ? <Banner tone="warning" action={<DisabledReason reason={wait}>
          <Button type="button" variant="outline" size="sm" disabled={!!wait} onClick={review.retry}>{t("common:actions.retry")}</Button>
        </DisabledReason>}>{stalled.form ? t("extraction.unknown", { form: stalled.form }) : t("extraction.unknownOther")}</Banner> : null}
        {values.length ? <div className={reading ? "opacity-45" : undefined} inert={reading ? true : undefined}>
          <ReceivedDocumentData key={`${document.id}:${document.revision}`} documentId={document.id} person={person} values={values} draft={review.values}
            problems={review.problems} server={review.serverErrors} edit={actions.edit && !!current} disabled={busy} onChange={review.change} onConflict={review.conflict} />
        </div> : null}
      </TabsContent>
      <TabsContent value="history" className="pt-3"><ReceivedDocumentHistory detail={shown} zone={zone} /></TabsContent>
    </Tabs>
    <ConfirmDialog open={discarding !== null} onOpenChange={open => { if (!open) setDiscarding(null); }}
      title={t("discard.title", { name: receivedDocumentName(document, named) })} description={t(row ? "discard.rowDescription" : "discard.description", { date: discarding ?? "" })}
      confirmLabel={t("discard.action")} destructive pending={working?.work === "discard"} pendingLabel={t("discard.pending")}
      onConfirm={() => { void review.discard().finally(() => setDiscarding(null)); }} />
  </ResponsePanelFrame>;
}
