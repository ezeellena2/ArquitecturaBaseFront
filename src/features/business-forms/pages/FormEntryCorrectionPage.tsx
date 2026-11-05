import { useNavigate, useParams } from "react-router";
import { useTranslation } from "react-i18next";
import { useBreadcrumbLeaf } from "@/shared/hooks/useBreadcrumbLeaf";
import { useMediaQuery } from "@/shared/hooks/useMediaQuery";
import { useUnsavedChangesGuard } from "@/shared/hooks/useUnsavedChangesGuard";
import { Banner } from "@/shared/ui/Banner";
import { Button } from "@/shared/ui/button";
import { ConfirmDialog } from "@/shared/ui/ConfirmDialog";
import { DisabledReason } from "@/shared/ui/DisabledReason";
import { EmptyState } from "@/shared/ui/EmptyState";
import { notify } from "@/shared/ui/notifications";
import { Page } from "@/shared/ui/Page";
import { Skeleton } from "@/shared/ui/skeleton";
import { Surface } from "@/shared/ui/Surface";
import { EntryCorrectionFields } from "../components/EntryCorrectionFields";
import { correctionUnavailable, useEntryCorrectionEditor } from "../hooks/useEntryCorrectionEditor";
import { responseFullPath } from "../responseNavigationPaths";

/**
 * «Corregir APL-000124» on its own page (CW10-A): from the full view and on the phone, with the response as it was in the
 * active version and the reason at the end. Saving opens the correction, which replaces the response with the same number.
 */
export function FormEntryCorrectionPage() {
  const { formId = "", recordId = "" } = useParams();
  const { t } = useTranslation(["formEntries", "forms"]);
  const navigate = useNavigate();
  const mobile = useMediaQuery("(width < 640px)");
  const correction = useEntryCorrectionEditor(formId, recordId);
  const { editor, query, scope } = correction;
  const entry = correction.correction?.entry;
  const number = correction.correction?.number;
  const guard = useUnsavedChangesGuard(correction.dirty);
  const back = responseFullPath(formId, recordId, "");
  useBreadcrumbLeaf(number ? t("correction.title", { number }) : t("correction.title", { number: "…" }), entry?.name);
  const submit = async () => {
    const result = await correction.send();
    if (!result || !entry) return;
    notify({ id: `entries:corrected:${scope.owner}:${recordId}`, kind: "success", message: t("correction.saved", { number: result.number }),
      description: t("send.savedDetail", { name: entry.name, state: t("forms:approvals.states." + result.state) }) });
    guard.allowNextNavigation();
    navigate(responseFullPath(formId, result.recordId, ""), { replace: true });
  };
  const submitReason = editor.missing ? t("catalog.missingDataReason", { datum: editor.missing.catalog?.missingData ?? "" }) : null;
  const saveButton = (touch = false) => <DisabledReason reason={submitReason}>
    <Button type="button" size={touch ? "touch" : "default"} className={touch ? "w-full" : undefined} disabled={!entry || editor.blocked}
      pending={editor.sending} onClick={() => void submit()}>
      {editor.sending ? t("correction.saving", { percent: Math.round((editor.progress ?? 0) * 100) }) : t("correction.save")}</Button>
  </DisabledReason>;
  const actions = mobile || !entry ? undefined : <>
    <Button type="button" variant="outline" disabled={editor.sending} onClick={() => navigate(back)}>{t("common:actions.cancel")}</Button>
    {saveButton()}
  </>;
  return <Page title={number ? t("correction.title", { number }) : t("correction.title", { number: "…" })} backTo={{ to: back, label: number ?? t("forms:responses.detail") }} actions={actions}>
    <div className="flex flex-col gap-4">
      {editor.conflict === "deactivated" ? <Banner tone="danger">{entry ? t("send.deactivated", { name: entry.name }) : t("send.deactivatedUnknown")}</Banner> : null}
      {editor.conflict === "version" && entry ? <Banner tone="warning" action={<Button type="button" variant="outline" pending={query.isFetching} onClick={() => void query.refetch()}>{t(query.isFetching ? "send.updating" : "send.useNewVersion")}</Button>}>
        {t("send.newVersion", { name: entry.name })}</Banner> : null}
      {editor.missing && entry ? <Banner tone="warning">{t("catalog.missingData", { form: entry.name, datum: editor.missing.catalog?.missingData ?? "" })}</Banner> : null}
      {entry && editor.draft ? <EntryCorrectionFields correction={correction} recordId={recordId} layout="page"/>
        : query.isError ? <Surface padded><EmptyState title={t(correctionUnavailable(query.error) ? "correction.unavailable" : "correction.loadFailed")}
          action={correctionUnavailable(query.error) ? <Button type="button" variant="outline" onClick={() => navigate(back)}>{t("forms:detail.viewCurrent")}</Button>
            : <Button type="button" variant="outline" onClick={() => void query.refetch()}>{t("common:actions.retry")}</Button>}/></Surface>
        : <Surface title={t("page.data")}><div role="status" aria-label={t("page.opening")} className="flex flex-col gap-4 p-4">
          {[0, 1, 2].map(index => <div key={index} className="flex flex-col gap-2"><Skeleton className="h-4 w-32"/><Skeleton className="h-8 w-full"/></div>)}
        </div></Surface>}
    </div>
    {mobile && entry ? <div className="sticky bottom-0 -mx-4 mt-4 flex flex-col gap-2 border-t border-[var(--color-border)] bg-[var(--color-surface)] p-3">{saveButton(true)}</div> : null}
    <ConfirmDialog open={guard.isBlocked} onOpenChange={open => { if (!open) guard.stay(); }} title={t("correction.closeTitle")}
      description={t("correction.closeDescription")} cancelLabel={t("correction.stay")} confirmLabel={t("correction.closeConfirm")} destructive onConfirm={guard.leave}/>
  </Page>;
}
