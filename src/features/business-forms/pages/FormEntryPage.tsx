import { useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router";
import { useTranslation } from "react-i18next";
import { ApiError } from "@/shared/api/ApiError";
import { useBreadcrumbLeaf } from "@/shared/hooks/useBreadcrumbLeaf";
import { useMediaQuery } from "@/shared/hooks/useMediaQuery";
import { useUnsavedChangesGuard } from "@/shared/hooks/useUnsavedChangesGuard";
import { Badge } from "@/shared/ui/badge";
import { Banner } from "@/shared/ui/Banner";
import { Button } from "@/shared/ui/button";
import { CheckboxField } from "@/shared/ui/CheckboxField";
import { ConfirmDialog } from "@/shared/ui/ConfirmDialog";
import { DisabledReason } from "@/shared/ui/DisabledReason";
import { EmptyState } from "@/shared/ui/EmptyState";
import { ForbiddenPage } from "@/shared/ui/ForbiddenPage";
import { notify } from "@/shared/ui/notifications";
import { Page } from "@/shared/ui/Page";
import { Skeleton } from "@/shared/ui/skeleton";
import { Surface } from "@/shared/ui/Surface";
import type { FormEntry, FormEntrySubmitted } from "../api/entries";
import { approvalStateVariant } from "../approvals";
import { FormEntryForm } from "../components/FormEntryForm";
import { FormEntrySent } from "../components/FormEntrySent";
import { entryZones, keepForNextEntry, type EntryDraft } from "../entryForm";
import { takeEntryDraft } from "../entryHandoff";
import { useEntryEditor } from "../hooks/useEntryEditor";
import { useFormEntry } from "../hooks/useFormEntry";

/**
 * «Nueva respuesta» (CW2-A): the active version in its own page, for the computer and the phone. «Volver» goes back to
 * where it came from, «Formularios» or the sheet; leaving with something loaded asks first.
 */
export function FormEntryPage() {
  const { formId = "" } = useParams();
  const { t } = useTranslation(["formEntries", "forms"]);
  const location = useLocation();
  const navigate = useNavigate();
  const mobile = useMediaQuery("(width < 640px)");
  const { scope, query } = useFormEntry(formId);
  const [initial] = useState(() => takeEntryDraft(scope.owner, formId));
  const entry = query.data;
  const editor = useEntryEditor(formId, entry, scope.owner, initial);
  const [sent, setSent] = useState<{ result: FormEntrySubmitted; entry: FormEntry; draft: EntryDraft } | null>(null);
  // «Mantener las respuestas para la siguiente» lasts while loading: coming back, it starts unchecked (AR2-A).
  const [keep, setKeep] = useState(false);
  const guard = useUnsavedChangesGuard(editor.dirty && !sent);
  const fromSheet = (location.state as { from?: string } | null)?.from === "sheet";
  const back = fromSheet ? `/formularios/${formId}/respuestas` : "/formularios/respuestas";
  useBreadcrumbLeaf(sent ? sent.result.number : t("page.title"), entry?.name);
  if (!scope.canCreate || query.error instanceof ApiError && query.error.status === 403 || editor.conflict === "forbidden") return <ForbiddenPage/>;

  if (sent) {
    const exits = <>
      <Button type="button" onClick={() => { setSent(null); editor.restart(); }}>{t("sent.loadAnother")}</Button>
      <Button type="button" variant="outline" onClick={() => navigate("/formularios/respuestas")}>{t("send.backToForms")}</Button>
      {scope.canRead ? <Button type="button" variant="outline" onClick={() => navigate(`/formularios/${formId}/respuestas/${sent.result.recordId}`)}>{t("sent.viewInSheet")}</Button> : null}
    </>;
    return <Page title={sent.result.number} backTo={{ to: "/formularios/respuestas", label: t("forms:overview.title") }}
      status={<Badge variant={approvalStateVariant(sent.result.state)}>{t("forms:approvals.states." + sent.result.state)}</Badge>}>
      <FormEntrySent entry={sent.entry} draft={sent.draft} result={sent.result} timeZone={scope.user?.timeZoneId} actions={mobile ? undefined : exits}/>
      {mobile ? <div className="sticky bottom-0 -mx-4 mt-auto flex flex-col gap-2 border-t border-[var(--color-border)] bg-[var(--color-surface)] p-3">
        <Button type="button" variant="outline" size="touch" onClick={() => navigate("/formularios/respuestas")}>{t("send.backToForms")}</Button>
        <Button type="button" size="touch" onClick={() => { setSent(null); editor.restart(); }}>{t("sent.loadAnother")}</Button>
      </div> : null}
    </Page>;
  }

  const unavailable = editor.conflict === "deactivated" || query.error instanceof ApiError && query.error.code === "Forms.Entry.Unavailable";
  const missingForm = editor.conflict === "missing" || query.error instanceof ApiError && query.error.status === 404;
  const submitReason = editor.missing ? t("catalog.missingDataReason", { datum: editor.missing.catalog?.missingData ?? "" }) : null;
  const sendLabel = editor.sending ? t("send.sending", { percent: Math.round((editor.progress ?? 0) * 100) }) : entry?.submitLabel ?? "…";
  // Kept, the form stays for the next one as in the panel (AR2-A): the notice says the number, the files start empty and
  // the focus goes back to the first question. Otherwise, «Enviada».
  const submit = async () => {
    const draft = editor.draft;
    const result = await editor.send();
    if (!result || !entry || !draft) return;
    if (!keep) { setSent({ result, entry, draft }); return; }
    notify({ id: `entries:saved:${scope.owner}:${formId}`, kind: "success", message: t("send.saved", { number: result.number }),
      description: t("send.savedDetail", { name: entry.name, state: t("forms:approvals.states." + result.state) }) });
    editor.restart(keepForNextEntry(draft));
    const first = entryZones(entry)[0]?.questions[0];
    if (first) editor.focus(first.fieldId);
  };
  const keepBox = <CheckboxField label={t("panel.keep")} checked={keep} onCheckedChange={setKeep}/>;
  const sendButton = (touch = false) => <DisabledReason reason={submitReason}>
    <Button type="button" size={touch ? "touch" : "default"} className={touch ? "w-full" : undefined} disabled={!entry || editor.blocked || unavailable}
      pending={editor.sending} onClick={() => void submit()}>{sendLabel}</Button>
  </DisabledReason>;
  const actions = mobile || !entry ? undefined : <>
    {keepBox}
    <Button type="button" variant="outline" disabled={editor.sending} onClick={() => navigate(back)}>{t("common:actions.cancel")}</Button>
    {sendButton()}
  </>;
  return <Page title={t("page.title")} backTo={{ to: back, label: fromSheet ? entry?.name ?? t("forms:overview.title") : t("forms:overview.title") }} actions={actions}>
    <div className="flex flex-col gap-4">
      {unavailable ? <Banner tone="danger" action={<Button type="button" variant="outline" onClick={() => navigate("/formularios/respuestas")}>{t("send.backToForms")}</Button>}>
        {entry ? t("send.deactivated", { name: entry.name }) : t("send.deactivatedUnknown")}</Banner> : null}
      {editor.conflict === "version" && entry ? <Banner tone="warning" action={<Button type="button" variant="outline" pending={query.isFetching} onClick={() => void query.refetch()}>{t(query.isFetching ? "send.updating" : "send.useNewVersion")}</Button>}>
        {t("send.newVersion", { name: entry.name })}</Banner> : null}
      {editor.missing && entry ? <Banner tone="warning">{t("catalog.missingData", { form: entry.name, datum: editor.missing.catalog?.missingData ?? "" })}</Banner> : null}
      {missingForm ? <EmptyState title={t("forms:responses.unavailableForm")} action={<Button type="button" variant="outline" onClick={() => navigate("/formularios/respuestas")}>{t("send.backToForms")}</Button>}/>
        : entry && editor.draft ? <FormEntryForm entry={entry} draft={editor.draft} onChange={editor.change} errors={editor.errors} layout="page" disabled={editor.sending || unavailable} reveal={editor.reveal}/>
        // Reintentar goes back to the skeleton below while it reads the form again.
        : query.isError && !unavailable ? <Surface padded><EmptyState title={t("page.loadFailed")}
          action={<Button type="button" variant="outline" onClick={() => void query.refetch()}>{t("common:actions.retry")}</Button>}/></Surface>
        : !unavailable ? <Surface title={t("page.data")}><div role="status" aria-label={t("page.opening")} className="flex flex-col gap-4 p-4">
          {[0, 1, 2].map(index => <div key={index} className="flex flex-col gap-2"><Skeleton className="h-4 w-32"/><Skeleton className="h-8 w-full"/></div>)}
        </div></Surface> : null}
    </div>
    {mobile && entry && !unavailable ? <div className="sticky bottom-0 -mx-4 mt-4 flex flex-col gap-2 border-t border-[var(--color-border)] bg-[var(--color-surface)] p-3">{keepBox}{sendButton(true)}</div> : null}
    <ConfirmDialog open={guard.isBlocked} onOpenChange={open => { if (!open) guard.stay(); }} title={t("leave.title")}
      description={t("leave.description", { name: entry?.name ?? "" })} cancelLabel={t("leave.stay")} confirmLabel={t("leave.confirm")} destructive onConfirm={guard.leave}/>
  </Page>;
}
