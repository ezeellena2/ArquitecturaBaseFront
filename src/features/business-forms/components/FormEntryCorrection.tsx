import { useLayoutEffect, useRef, useState, type KeyboardEvent } from "react";
import { useTranslation } from "react-i18next";
import { useMediaQuery } from "@/shared/hooks/useMediaQuery";
import { useUnsavedChangesGuard } from "@/shared/hooks/useUnsavedChangesGuard";
import { formatPercent } from "@/shared/lib/numberFormat";
import { Banner } from "@/shared/ui/Banner";
import { Button } from "@/shared/ui/button";
import { ConfirmDialog } from "@/shared/ui/ConfirmDialog";
import { DisabledReason } from "@/shared/ui/DisabledReason";
import { EmptyState } from "@/shared/ui/EmptyState";
import { IconButton } from "@/shared/ui/IconButton";
import { CloseIcon } from "@/shared/ui/icons";
import { notify } from "@/shared/ui/notifications";
import { Page } from "@/shared/ui/Page";
import { Skeleton } from "@/shared/ui/skeleton";
import { Surface } from "@/shared/ui/Surface";
import type { ResponseDetail } from "../api/responses";
import { answeredQuestions, correctionVersionNotice } from "../correctionVersion";
import { correctionUnavailable, useEntryCorrectionEditor } from "../hooks/useEntryCorrectionEditor";
import { EntryCorrectionFields } from "./EntryCorrectionFields";

/** What the correction needs of the response it reads: which one it is, and its version and values for the notice of decision 6. */
export type CorrectedResponse = Pick<ResponseDetail, "id" | "number" | "name" | "values" | "entry">;

/**
 * Correcting a response in place (VF1-A, decision 5; it replaces CW10-A's page and panel): the same controls unlocked, with the
 * response as it was in the active version, «Antes: …» under what changed and the required reason at the end. On the full page
 * it takes the page, «Corregir PED-000010» with «Cancelar» and «Guardar corrección» in the band (on the phone the save goes
 * fixed at the foot); in the quick view, the panel where D2 was. Saving replaces the response with the same number and hands
 * the new one to the owner, which reads it.
 */
export function FormEntryCorrection({ formId, record, layout, backTo, onClose, onViewCurrent, onUnavailable, onSaved }: {
  formId: string; record: CorrectedResponse; layout: "page" | "panel"; backTo?: { to: string; label: string };
  /** Back to reading, with nothing saved. */
  onClose: () => void;
  /** Back to reading a response that can no longer be corrected (replaced, voided or no longer this person's), read again. */
  onViewCurrent: () => void;
  /** Saving found that it can no longer be corrected (409): back to reading it as it was, which says so on top with «Ver la actual» (O52). */
  onUnavailable: () => void;
  onSaved: (recordId: string) => void;
}) {
  const { t, i18n } = useTranslation(["formEntries", "forms"]);
  const mobile = useMediaQuery("(width < 640px)");
  const recordId = record.id;
  const correction = useEntryCorrectionEditor(formId, recordId, onUnavailable);
  const { editor, query, scope } = correction;
  const entry = correction.correction?.entry;
  const number = correction.correction?.number ?? record.number;
  const title = t("correction.title", { number });
  const guard = useUnsavedChangesGuard(correction.dirty);
  const [closing, setClosing] = useState(false);
  const frame = useRef<HTMLElement | null>(null);
  // What started it («Corregir» or the pencil) goes away with the reading: the focus comes to the correction.
  useLayoutEffect(() => { if (!frame.current?.contains(document.activeElement)) frame.current?.focus(); }, []);
  const cancel = () => { if (correction.dirty) setClosing(true); else onClose(); };
  const submit = async () => {
    const result = await correction.send();
    if (!result || !entry) return;
    notify({ id: `entries:corrected:${scope.owner}:${recordId}`, kind: "success", message: t("correction.saved", { number: result.number }),
      description: t("send.savedDetail", { name: entry.name, state: t("forms:approvals.states." + result.state) }) });
    guard.allowNextNavigation();
    onSaved(result.recordId);
  };
  // Decision 6: a response reads with its version and is corrected with the active one; when they differ, the notice says so on top.
  const notice = correction.correction && record.entry ? correctionVersionNotice(record.entry.entry, correction.correction, answeredQuestions(record.values)) : null;
  const noticeText = !notice ? null : notice.empty.length ? t("correction.versionEmpty", { count: notice.empty.length, version: notice.versionNumber,
    questions: new Intl.ListFormat(i18n.language, { type: "conjunction" }).format(notice.empty.map(question => t("forms:responses.historyQuestion", { question }))) })
    : t("correction.version", { version: notice.versionNumber });
  // The wait of a 429 is the reason of «Guardar corrección», which stays off until it ends.
  const submitReason = editor.missing ? t("catalog.missingDataReason", { datum: editor.missing.catalog?.missingData ?? "" })
    : editor.retryWait ? t("forms:wait", { count: editor.retryWait }) : null;
  const save = (touch = false) => <DisabledReason reason={submitReason}>
    <Button type="button" size={touch ? "touch" : "default"} className={touch ? "w-full" : undefined} disabled={!entry || editor.blocked || editor.retryWait > 0}
      pending={editor.sending} onClick={() => void submit()}>
      {editor.sending ? t("correction.saving", { percent: formatPercent(editor.progress ?? 0, i18n.language) }) : t("correction.save")}</Button>
  </DisabledReason>;
  const cancelButton = <Button type="button" variant="outline" disabled={editor.sending} onClick={cancel}>{t("common:actions.cancel")}</Button>;
  const unavailable = query.isError && correctionUnavailable(query.error);
  const failure = query.isError ? <EmptyState title={t(unavailable ? "correction.unavailable" : "correction.loadFailed")}
    action={unavailable ? <Button type="button" variant="outline" onClick={onViewCurrent}>{t("forms:detail.viewCurrent")}</Button>
      : <Button type="button" variant="outline" onClick={() => void query.refetch()}>{t("common:actions.retry")}</Button>}/> : null;
  const opening = <div role="status" aria-label={t("page.opening")} className={layout === "page" ? "flex flex-col gap-4 p-4" : "flex flex-col gap-4"}>
    {[0, 1, 2].map(index => <div key={index} className="flex flex-col gap-2"><Skeleton className="h-4 w-32"/><Skeleton className="h-8 w-full"/></div>)}</div>;
  const content = <div className="flex flex-col gap-4">
    {noticeText ? <Banner>{noticeText}</Banner> : null}
    {editor.conflict === "deactivated" ? <Banner tone="danger">{entry ? t("send.deactivated", { name: entry.name }) : t("send.deactivatedUnknown")}</Banner> : null}
    {editor.conflict === "version" && entry ? <Banner tone="warning" action={<Button type="button" variant="outline" pending={query.isFetching} onClick={() => void query.refetch()}>{t(query.isFetching ? "send.updating" : "send.useNewVersion")}</Button>}>
      {t("send.newVersion", { name: entry.name })}</Banner> : null}
    {editor.missing && entry ? <Banner tone="warning">{t("catalog.missingData", { form: entry.name, datum: editor.missing.catalog?.missingData ?? "" })}</Banner> : null}
    {entry && editor.draft ? <EntryCorrectionFields correction={correction} recordId={recordId} layout={layout}/>
      : failure ? layout === "page" ? <Surface padded>{failure}</Surface> : failure
      : layout === "page" ? <Surface title={t("page.data")}>{opening}</Surface> : opening}
  </div>;
  const discard = <ConfirmDialog open={closing || guard.isBlocked} onOpenChange={open => { if (!open) { setClosing(false); guard.stay(); } }}
    title={t("correction.closeTitle")} description={t("correction.closeDescription")} cancelLabel={t("correction.stay")} confirmLabel={t("correction.closeConfirm")} destructive
    onConfirm={() => { if (closing) { setClosing(false); guard.allowNextNavigation(); onClose(); } else guard.leave(); }}/>;
  if (layout === "page") return <div ref={node => { frame.current = node; }} tabIndex={-1} className="outline-none">
    <Page title={title} backTo={backTo} actions={<>{cancelButton}{mobile ? null : save()}</>}>
      {content}
      {mobile && entry ? <div className="sticky bottom-0 -mx-4 mt-4 flex flex-col gap-2 border-t border-[var(--color-border)] bg-[var(--color-surface)] p-3">{save(true)}</div> : null}
      {discard}
    </Page>
  </div>;
  const onKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (event.key !== "Escape" || event.defaultPrevented) return;
    const target = event.target instanceof Element ? event.target : null;
    if (target?.closest('[role="combobox"],[role="listbox"],[role="dialog"]:not(section)')) return;
    event.preventDefault(); cancel();
  };
  return <section ref={node => { frame.current = node; }} tabIndex={-1} aria-label={t("correction.label", { number, name: entry?.name ?? record.name })} onKeyDown={onKeyDown}
    className="absolute top-12 right-0 bottom-0 z-20 flex w-[min(32.5rem,100%)] flex-col border-l border-[var(--color-border)] bg-[var(--color-surface)] shadow-xl outline-none">
    <header className="flex shrink-0 items-center gap-2 border-b border-[var(--color-border)] px-4 py-3">
      <h2 className="min-w-0 flex-1 truncate text-lg font-semibold">{title}</h2>
      <IconButton variant="ghost" label={t("common:actions.close")} onClick={cancel}><CloseIcon className="size-4"/></IconButton>
    </header>
    <div className="min-h-0 flex-1 overflow-y-auto p-4">{content}</div>
    <footer className="flex shrink-0 flex-wrap items-center justify-end gap-3 border-t border-[var(--color-border)] px-4 py-3">{cancelButton}{save()}</footer>
    {discard}
  </section>;
}
