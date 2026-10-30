import { useLayoutEffect, useRef, useState, type KeyboardEvent } from "react";
import { useNavigate } from "react-router";
import { useTranslation } from "react-i18next";
import { useUnsavedChangesGuard } from "@/shared/hooks/useUnsavedChangesGuard";
import { Banner } from "@/shared/ui/Banner";
import { Button } from "@/shared/ui/button";
import { CheckboxField } from "@/shared/ui/CheckboxField";
import { ConfirmDialog } from "@/shared/ui/ConfirmDialog";
import { DisabledReason } from "@/shared/ui/DisabledReason";
import { EmptyState } from "@/shared/ui/EmptyState";
import { IconButton } from "@/shared/ui/IconButton";
import { CloseIcon } from "@/shared/ui/icons";
import { notify } from "@/shared/ui/notifications";
import { Skeleton } from "@/shared/ui/skeleton";
import { keepForNextEntry } from "../entryForm";
import { handOverEntryDraft } from "../entryHandoff";
import { useEntryEditor } from "../hooks/useEntryEditor";
import { useFormEntry } from "../hooks/useFormEntry";
import { FormEntryForm } from "./FormEntryForm";

/**
 * Loading next to the sheet (CW2-B), only on the computer. The sheet stays in view: the saved response shows on top,
 * marked, and the notice says its number. «Pantalla completa» takes what was loaded to the page.
 */
export function FormEntryPanel({ formId, formName, onClose, onSaved }: { formId: string; formName?: string; onClose: () => void; onSaved: (recordId: string) => void }) {
  const { t } = useTranslation(["formEntries", "forms"]);
  const navigate = useNavigate();
  const { scope, query } = useFormEntry(formId);
  const entry = query.data;
  const editor = useEntryEditor(formId, entry, scope.owner);
  const [keep, setKeep] = useState(false);
  const [closing, setClosing] = useState(false);
  const panel = useRef<HTMLElement | null>(null);
  const guard = useUnsavedChangesGuard(editor.dirty);
  useLayoutEffect(() => { if (!panel.current?.contains(document.activeElement)) panel.current?.focus(); }, []);
  const close = () => { if (editor.dirty) setClosing(true); else onClose(); };
  const submit = async () => {
    const draft = editor.draft;
    const result = await editor.send();
    if (!result || !entry || !draft) return;
    notify({ id: `entries:saved:${scope.owner}:${formId}`, kind: "success", message: t("send.saved", { number: result.number }),
      description: t("send.savedDetail", { name: entry.name, state: t("forms:approvals.states." + result.state) }) });
    onSaved(result.recordId);
    editor.restart(keep ? keepForNextEntry(draft) : undefined);
  };
  const onKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (event.key !== "Escape" || event.defaultPrevented) return;
    const target = event.target instanceof Element ? event.target : null;
    if (target?.closest('[role="combobox"],[role="listbox"],[role="dialog"]:not(section)')) return;
    event.preventDefault(); close();
  };
  const submitReason = editor.missing ? t("catalog.missingDataReason", { datum: editor.missing.catalog?.missingData ?? "" }) : null;
  return <section ref={panel} tabIndex={-1} aria-label={t("panel.label", { name: entry?.name ?? formName ?? "" })} onKeyDown={onKeyDown}
    className="absolute top-12 right-0 bottom-0 z-20 flex w-[min(32.5rem,100%)] flex-col border-l border-[var(--color-border)] bg-[var(--color-surface)] shadow-xl outline-none">
    <header className="flex shrink-0 items-center gap-2 border-b border-[var(--color-border)] px-4 py-3">
      <h2 className="min-w-0 flex-1 truncate text-lg font-semibold">{t("page.title")}</h2>
      <Button type="button" variant="link" size="inline" disabled={!editor.draft || editor.sending} onClick={() => {
        if (editor.draft) handOverEntryDraft(scope.owner, formId, editor.draft);
        guard.allowNextNavigation();
        navigate(`/formularios/${formId}/cargar`, { state: { from: "sheet" } });
      }}>{t("panel.fullScreen")}</Button>
      <IconButton variant="ghost" label={t("common:actions.close")} onClick={close}><CloseIcon className="size-4"/></IconButton>
    </header>
    <div className="min-h-0 flex-1 overflow-y-auto p-4">
      <div className="flex flex-col gap-4">
        {editor.conflict === "deactivated" || query.error && "code" in query.error && query.error.code === "Forms.Entry.Unavailable"
          ? <Banner tone="danger">{entry?.name ?? formName ? t("send.deactivated", { name: entry?.name ?? formName }) : t("send.deactivatedUnknown")}</Banner> : null}
        {editor.conflict === "version" && entry ? <Banner tone="warning" action={<Button type="button" variant="outline" onClick={() => void query.refetch()}>{t("send.useNewVersion")}</Button>}>
          {t("send.newVersion", { name: entry.name })}</Banner> : null}
        {editor.missing && entry ? <Banner tone="warning">{t("catalog.missingData", { form: entry.name, datum: editor.missing.catalog?.missingData ?? "" })}</Banner> : null}
        {entry && editor.draft ? <FormEntryForm entry={entry} draft={editor.draft} onChange={editor.change} errors={editor.errors} layout="panel" disabled={editor.sending}/>
          : query.isError ? <EmptyState title={t("page.loadFailed")} description={t("page.loadFailedHint")}
            action={<Button type="button" variant="outline" onClick={() => void query.refetch()}>{t("common:actions.retry")}</Button>}/>
          : <div role="status" aria-label={t("page.opening")} className="flex flex-col gap-4">{[0, 1, 2].map(index => <div key={index} className="flex flex-col gap-2"><Skeleton className="h-4 w-32"/><Skeleton className="h-8 w-full"/></div>)}</div>}
      </div>
    </div>
    <footer className="flex shrink-0 flex-wrap items-center gap-3 border-t border-[var(--color-border)] px-4 py-3">
      <div className="min-w-0 flex-1"><CheckboxField label={t("panel.keep")} checked={keep} onCheckedChange={setKeep}/></div>
      <Button type="button" variant="outline" disabled={editor.sending} onClick={close}>{t("common:actions.cancel")}</Button>
      <DisabledReason reason={submitReason}><Button type="button" disabled={!entry || editor.blocked || editor.sending} aria-busy={editor.sending || undefined} onClick={() => void submit()}>
        {editor.sending ? t("send.sending", { percent: Math.round((editor.progress ?? 0) * 100) }) : entry?.submitLabel ?? "…"}</Button></DisabledReason>
    </footer>
    <ConfirmDialog open={closing || guard.isBlocked} onOpenChange={open => { if (!open) { setClosing(false); guard.stay(); } }}
      title={t("panel.closeTitle")} description={t("panel.closeDescription")} cancelLabel={t("leave.stay")} confirmLabel={t("panel.closeConfirm")} destructive
      onConfirm={() => { if (closing) { setClosing(false); guard.allowNextNavigation(); onClose(); } else guard.leave(); }}/>
  </section>;
}
