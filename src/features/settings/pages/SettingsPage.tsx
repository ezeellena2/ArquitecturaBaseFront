import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Navigate, useLocation, useNavigate } from "react-router";
import { fetchSystemSettings, systemSettingsQueryKey, updateSystemSettings, type SettingField, type SystemSettings } from "../api/settings";
import { ApiError } from "@/shared/api/ApiError";
import { errorFeedback } from "@/shared/api/errorFeedback";
import { presentationQueryKey } from "@/shared/api/presentation";
import { useUnsavedChangesGuard } from "@/shared/hooks/useUnsavedChangesGuard";
import { Button } from "@/shared/ui/button";
import { ConfirmDialog } from "@/shared/ui/ConfirmDialog";
import { EmptyState } from "@/shared/ui/EmptyState";
import { FormField } from "@/shared/ui/FormField";
import { NativeSelect } from "@/shared/ui/NativeSelect";
import { Page } from "@/shared/ui/Page";
import { RadioGroupField } from "@/shared/ui/RadioGroupField";
import { Skeleton } from "@/shared/ui/skeleton";
import { notify, dismissNotification } from "@/shared/ui/notifications";
import { formatDateTimeInZone } from "@/shared/lib/dateTime";

const topics = { idioma: "defaultCulture", "zona-horaria": "defaultTimeZoneId", listados: "defaultPageSize", registro: "registrationMode" } as const;
type Topic = keyof typeof topics;

export function SettingsPage() {
  const { t } = useTranslation("settings");
  const { pathname } = useLocation();
  const topic = pathname.split("/")[2] as Topic;
  const query = useQuery({ queryKey: systemSettingsQueryKey, queryFn: fetchSystemSettings, refetchOnMount: "always" });
  if (!topics[topic]) return <Navigate to="/configuracion/idioma" replace />;
  if (query.error instanceof ApiError && query.error.status === 403) return <Navigate to="/sin-permiso" replace />;
  if (query.data) return <SettingsEditor key={topic} topic={topic} initial={query.data} />;
  return <Page title={t('topics.' + topic)}>{query.isPending ? <Skeleton className="h-24 max-w-xl" /> : <EmptyState title={t("unavailable")} action={<Button variant="outline" onClick={() => void query.refetch()}>{t("common:actions.retry")}</Button>} />}</Page>;
}

function SettingsEditor({ topic, initial }: { topic: Topic; initial: SystemSettings }) {
  const { t } = useTranslation("settings");
  const client = useQueryClient();
  const navigate = useNavigate();
  const field: SettingField = topics[topic];
  const [baseline, setBaseline] = useState(initial);
  const [draft, setDraft] = useState(String(initial[field]));
  const [fieldError, setFieldError] = useState<string>();
  const [confirm, setConfirm] = useState(false);
  const [needsReview, setNeedsReview] = useState(false);
  const [review, setReview] = useState<SystemSettings>();
  const [reading, setReading] = useState(false);
  const active = useRef(true);
  const noticeId = 'settings:' + topic;
  useEffect(() => { active.current = true; return () => { active.current = false; dismissNotification(noticeId); }; }, [noticeId]);
  const dirty = draft !== String(baseline[field]);
  const value = field === "defaultPageSize" ? Number(draft) : draft;

  async function readCurrent() {
    setReading(true);
    try {
      const current = await client.fetchQuery({ queryKey: systemSettingsQueryKey, queryFn: fetchSystemSettings, staleTime: 0, meta: { errorOwner: "local" } });
      if (!active.current) return;
      setReview(current);
      dismissNotification(noticeId);
    } catch (error) {
      if (!active.current) return;
      const feedback = errorFeedback(error);
      if (feedback.kind === "forbidden") { guard.allowNextNavigation(); void navigate("/sin-permiso"); return; }
      if (feedback.kind !== "session") notify({ id: noticeId, kind: "error", message: t("feedback.reviewFailed"), description: feedback.traceId ? t("errorTraceId", { traceId: feedback.traceId }) : undefined, action: { label: t("review.action"), onClick: () => void readCurrent() } });
    } finally { if (active.current) setReading(false); }
  }

  const mutation = useMutation({
    mutationFn: () => updateSystemSettings(field, value, baseline.revision),
    onSuccess: () => {
      const saved = { ...baseline, [field]: value, revision: baseline.revision + 1 } as SystemSettings;
      if (active.current) { setBaseline(saved); setNeedsReview(false); setReview(undefined); }
      client.setQueryData(systemSettingsQueryKey, saved);
      void client.invalidateQueries({ queryKey: systemSettingsQueryKey });
      void client.invalidateQueries({ queryKey: presentationQueryKey });
      notify({ id: noticeId, kind: "success", message: active.current ? t("feedback.saved") : t("feedback.savedTopic", { topic: t('topics.' + topic) }) });
    },
    onError: (error) => {
      const feedback = errorFeedback(error, { writing: true, fields: [field], conflictCodes: ["Settings.System.RevisionConflict"] });
      if (feedback.kind === "session") return;
      if (!active.current) {
        notify({ id: noticeId, kind: "error", message: t(feedback.kind === "uncertain" ? "feedback.lateUncertain" : "feedback.lateFailed", { topic: t('topics.' + topic) }),
          description: feedback.traceId ? t("errorTraceId", { traceId: feedback.traceId }) : feedback.detail,
          action: feedback.kind === "uncertain" ? { label: t("review.action"), onClick: () => void navigate('/configuracion/' + topic) } : undefined });
        return;
      }
      if (feedback.kind === "forbidden") { guard.allowNextNavigation(); void navigate("/sin-permiso"); return; }
      if (feedback.fields[field]) setFieldError(feedback.fields[field].join(" "));
      if (feedback.kind === "fields") return;
      const uncertain = feedback.kind === "uncertain";
      const conflict = feedback.kind === "conflict";
      if (uncertain || conflict) setNeedsReview(true);
      notify({ id: noticeId, kind: "error", message: t(uncertain ? "feedback.uncertain" : conflict ? "feedback.conflict" : "feedback.failed"),
        description: feedback.traceId ? t("errorTraceId", { traceId: feedback.traceId }) : feedback.detail,
        action: uncertain || conflict ? { label: t("review.action"), onClick: () => void readCurrent() } : undefined });
    },
  });
  const guard = useUnsavedChangesGuard(dirty && !mutation.isPending);
  const disabled = mutation.isPending || reading;
  const changeDraft = (next: string) => { setDraft(next); setFieldError(undefined); };
  const discard = () => { setDraft(String(baseline[field])); setFieldError(undefined); setNeedsReview(false); setReview(undefined); dismissNotification(noticeId); };
  function acceptReview(keepDraft: boolean) {
    if (!review) return;
    setBaseline(review);
    if (!keepDraft) setDraft(String(review[field]));
    setNeedsReview(false); setReview(undefined); setFieldError(undefined); dismissNotification(noticeId);
  }
  const previewCulture = field === "defaultCulture" ? draft : baseline.defaultCulture;
  const previewZone = field === "defaultTimeZoneId" ? draft : baseline.defaultTimeZoneId;
  const preview = formatDateTimeInZone("2026-09-30T15:30:00Z", previewCulture, previewZone);
  const zones = [...new Set([baseline.defaultTimeZoneId, "America/Argentina/Buenos_Aires", "UTC", ...Intl.supportedValuesOf("timeZone")])].sort();
  const showValue = (raw: string | number) => field === "defaultCulture" ? t('common:language.' + raw) : field === "registrationMode" ? t('registration.' + raw + 'Label') : String(raw);

  return <Page title={t('topics.' + topic)} status={dirty ? <span className="text-sm text-[var(--color-content-muted)]">{t("dirty")}</span> : undefined}
    actions={<><Button variant="outline" disabled={!dirty || disabled || needsReview} onClick={discard}>{t("discard")}</Button><Button disabled={!dirty || disabled || needsReview} onClick={() => { setFieldError(undefined); if (field === "registrationMode") setConfirm(true); else mutation.mutate(); }}>{t(mutation.isPending ? "saving" : "save")}</Button></>}>
    <div className="max-w-xl space-y-5">
      <p className="text-sm text-[var(--color-content-muted)]">{t('hints.' + topic)}</p>
      {field === "registrationMode" ? <RadioGroupField label={t("registration.title")} value={draft} onValueChange={changeDraft} error={fieldError}
        options={[{ value: "InviteOnly", label: t("registration.InviteOnlyLabel"), description: t("registration.inviteOnly"), disabled }, { value: "Open", label: t("registration.OpenLabel"), description: t("registration.open"), disabled }]} /> :
        <div className={field === "defaultTimeZoneId" ? "max-w-md" : "max-w-xs"}><FormField label={t('fields.' + field)} error={fieldError}><NativeSelect value={draft} onChange={event => changeDraft(event.target.value)} disabled={disabled}>
          {field === "defaultCulture" ? ["es", "en"].map(language => <option key={language} value={language}>{t('common:language.' + language)}</option>) : field === "defaultPageSize" ? [10,20,50,100].map(size => <option key={size} value={size}>{size}</option>) : zones.map(zone => <option key={zone} value={zone}>{zone.replaceAll("_", " ")}</option>)}
        </NativeSelect></FormField></div>}
      {field === "defaultCulture" || field === "defaultTimeZoneId" ? <div className="space-y-1"><p className="text-sm text-[var(--color-content-muted)]">{t("preview.label")}</p><p className="text-sm font-medium">{preview}</p></div> : null}
      {needsReview ? <Button variant="outline" disabled={disabled} onClick={() => void readCurrent()}>{t(reading ? "review.reading" : "review.action")}</Button> : null}
      {review ? <section aria-label={t("review.title")} className="space-y-3">
        <h2 className="text-sm font-semibold">{t("review.title")}</h2>
        <div className="overflow-hidden rounded-[var(--radius-card)] border border-[var(--color-border)]"><table className="w-full text-sm"><thead className="bg-[var(--color-surface-muted)]"><tr><th scope="col" className="p-3 text-left">{t("review.source")}</th><th scope="col" className="p-3 text-left">{t("review.value")}</th></tr></thead><tbody><tr className="border-t border-[var(--color-border)]"><th scope="row" className="p-3 text-left font-normal">{t("review.current")}</th><td className="break-all p-3">{showValue(review[field])}</td></tr><tr className="border-t border-[var(--color-border)]"><th scope="row" className="p-3 text-left font-normal">{t("review.mine")}</th><td className="break-all p-3">{showValue(value)}</td></tr></tbody></table></div>
        <div className="flex flex-wrap gap-2"><Button variant="outline" onClick={() => acceptReview(false)}>{t("review.useCurrent")}</Button><Button onClick={() => acceptReview(true)}>{t("review.keepMine")}</Button></div>
      </section> : null}
    </div>
    <ConfirmDialog open={confirm} onOpenChange={setConfirm} title={t(draft === "Open" ? "confirm.openTitle" : "confirm.inviteOnlyTitle")} description={t(draft === "Open" ? "confirm.openDescription" : "confirm.inviteOnlyDescription")} confirmLabel={t("confirm.confirm")} onConfirm={() => mutation.mutate()} />
    <ConfirmDialog open={guard.isBlocked} onOpenChange={open => { if (!open) guard.stay(); }} title={t("leave.title")} description={t("leave.description")} confirmLabel={t("leave.confirm")} cancelLabel={t("leave.cancel")} onConfirm={guard.leave} />
  </Page>;
}
