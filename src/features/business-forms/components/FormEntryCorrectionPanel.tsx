import { useLayoutEffect, useRef, useState, type KeyboardEvent } from "react";
import { useTranslation } from "react-i18next";
import { useUnsavedChangesGuard } from "@/shared/hooks/useUnsavedChangesGuard";
import { Banner } from "@/shared/ui/Banner";
import { Button } from "@/shared/ui/button";
import { ConfirmDialog } from "@/shared/ui/ConfirmDialog";
import { DisabledReason } from "@/shared/ui/DisabledReason";
import { EmptyState } from "@/shared/ui/EmptyState";
import { IconButton } from "@/shared/ui/IconButton";
import { CloseIcon } from "@/shared/ui/icons";
import { notify } from "@/shared/ui/notifications";
import { Skeleton } from "@/shared/ui/skeleton";
import { correctionUnavailable, useEntryCorrectionEditor } from "../hooks/useEntryCorrectionEditor";
import { EntryCorrectionFields } from "./EntryCorrectionFields";

/**
 * Correcting next to the sheet (CW10-A), only on the computer, where D2 was: the response as it was in the active version,
 * «Antes: …» under what changed and the reason at the end. Saving replaces the response with the same number.
 */
export function FormEntryCorrectionPanel({ formId, recordId, number, onClose, onSaved }: {
  formId: string; recordId: string; number: string; onClose: () => void; onSaved: (recordId: string) => void;
}) {
  const { t } = useTranslation(["formEntries", "forms"]);
  const correction = useEntryCorrectionEditor(formId, recordId);
  const { editor, query, scope } = correction;
  const entry = correction.correction?.entry;
  const title = t("correction.title", { number: correction.correction?.number ?? number });
  const [closing, setClosing] = useState(false);
  const panel = useRef<HTMLElement | null>(null);
  const guard = useUnsavedChangesGuard(correction.dirty);
  useLayoutEffect(() => { if (!panel.current?.contains(document.activeElement)) panel.current?.focus(); }, []);
  const close = () => { if (correction.dirty) setClosing(true); else onClose(); };
  const submit = async () => {
    const result = await correction.send();
    if (!result || !entry) return;
    notify({ id: `entries:corrected:${scope.owner}:${recordId}`, kind: "success", message: t("correction.saved", { number: result.number }),
      description: t("send.savedDetail", { name: entry.name, state: t("forms:approvals.states." + result.state) }) });
    guard.allowNextNavigation();
    onSaved(result.recordId);
  };
  const onKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (event.key !== "Escape" || event.defaultPrevented) return;
    const target = event.target instanceof Element ? event.target : null;
    if (target?.closest('[role="combobox"],[role="listbox"],[role="dialog"]:not(section)')) return;
    event.preventDefault(); close();
  };
  const submitReason = editor.missing ? t("catalog.missingDataReason", { datum: editor.missing.catalog?.missingData ?? "" }) : null;
  return <section ref={panel} tabIndex={-1} aria-label={t("correction.label", { number: correction.correction?.number ?? number, name: entry?.name ?? "" })} onKeyDown={onKeyDown}
    className="absolute top-12 right-0 bottom-0 z-20 flex w-[min(32.5rem,100%)] flex-col border-l border-[var(--color-border)] bg-[var(--color-surface)] shadow-xl outline-none">
    <header className="flex shrink-0 items-center gap-2 border-b border-[var(--color-border)] px-4 py-3">
      <h2 className="min-w-0 flex-1 truncate text-lg font-semibold">{title}</h2>
      <IconButton variant="ghost" label={t("common:actions.close")} onClick={close}><CloseIcon className="size-4"/></IconButton>
    </header>
    <div className="min-h-0 flex-1 overflow-y-auto p-4">
      <div className="flex flex-col gap-4">
        {editor.conflict === "deactivated" ? <Banner tone="danger">{entry ? t("send.deactivated", { name: entry.name }) : t("send.deactivatedUnknown")}</Banner> : null}
        {editor.conflict === "version" && entry ? <Banner tone="warning" action={<Button type="button" variant="outline" pending={query.isFetching} onClick={() => void query.refetch()}>{t(query.isFetching ? "send.updating" : "send.useNewVersion")}</Button>}>
          {t("send.newVersion", { name: entry.name })}</Banner> : null}
        {editor.missing && entry ? <Banner tone="warning">{t("catalog.missingData", { form: entry.name, datum: editor.missing.catalog?.missingData ?? "" })}</Banner> : null}
        {entry && editor.draft ? <EntryCorrectionFields correction={correction} recordId={recordId} layout="panel"/>
          : query.isError ? <EmptyState title={t(correctionUnavailable(query.error) ? "correction.unavailable" : "correction.loadFailed")}
            action={correctionUnavailable(query.error) ? undefined : <Button type="button" variant="outline" onClick={() => void query.refetch()}>{t("common:actions.retry")}</Button>}/>
          : <div role="status" aria-label={t("page.opening")} className="flex flex-col gap-4">{[0, 1, 2].map(index => <div key={index} className="flex flex-col gap-2"><Skeleton className="h-4 w-32"/><Skeleton className="h-8 w-full"/></div>)}</div>}
      </div>
    </div>
    <footer className="flex shrink-0 flex-wrap items-center justify-end gap-3 border-t border-[var(--color-border)] px-4 py-3">
      <Button type="button" variant="outline" disabled={editor.sending} onClick={close}>{t("common:actions.cancel")}</Button>
      <DisabledReason reason={submitReason}><Button type="button" disabled={!entry || editor.blocked} pending={editor.sending} onClick={() => void submit()}>
        {editor.sending ? t("correction.saving", { percent: Math.round((editor.progress ?? 0) * 100) }) : t("correction.save")}</Button></DisabledReason>
    </footer>
    <ConfirmDialog open={closing || guard.isBlocked} onOpenChange={open => { if (!open) { setClosing(false); guard.stay(); } }}
      title={t("correction.closeTitle")} description={t("correction.closeDescription")} cancelLabel={t("leave.stay")} confirmLabel={t("correction.closeConfirm")} destructive
      onConfirm={() => { if (closing) { setClosing(false); guard.allowNextNavigation(); onClose(); } else guard.leave(); }}/>
  </section>;
}
