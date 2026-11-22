import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Navigate, useNavigate } from "react-router";
import { fetchSystemSettings, systemSettingsQueryKey, updateSystemSettings, settingErrorKey, settingFields, type SettingsChanges, type SettingsDraft, type SystemSettings } from "../api/settings";
import { changedFields, changesFrom, draftFrom, retentionIssues } from "../model";
import { formatNumber } from "@/shared/lib/numberFormat";
import { SettingsForm, type SettingsFieldErrors } from "../components/SettingsForm";
import { SettingsReview } from "../components/SettingsReview";
import { ApiError } from "@/shared/api/ApiError";
import { errorFeedback } from "@/shared/api/errorFeedback";
import { presentationQueryKey } from "@/shared/api/presentation";
import { useUnsavedChangesGuard } from "@/shared/hooks/useUnsavedChangesGuard";
import { Button } from "@/shared/ui/button";
import { DisabledReason } from "@/shared/ui/DisabledReason";
import { ConfirmDialog } from "@/shared/ui/ConfirmDialog";
import { EmptyState } from "@/shared/ui/EmptyState";
import { Page } from "@/shared/ui/Page";
import { FormSkeleton } from "@/shared/ui/FormSkeleton";
import { notify, dismissNotification } from "@/shared/ui/notifications";

export function SettingsPage() {
  const { t } = useTranslation("settings");
  const query = useQuery({ queryKey: systemSettingsQueryKey, queryFn: fetchSystemSettings, refetchOnMount: "always" });
  const [initial, setInitial] = useState<SystemSettings>();
  // Al volver, primero leemos una revisión vigente. Una vez abierto el editor,
  // los refetch de fondo no reemplazan su borrador ni su revisión de partida.
  if (initial === undefined && query.isFetchedAfterMount && query.isSuccess && !query.isFetching) {
    setInitial(query.data);
  }
  if (query.error instanceof ApiError && query.error.status === 403) return <Navigate to="/sin-permiso" replace />;
  if (initial) return <SettingsEditor initial={initial} />;
  return <Page title={t("title")}>{query.isFetching || query.isPending ? <FormSkeleton zones={[{ fields: 2 }, { fields: 1 }, { rows: 2 }, { fields: 3 }]} />
    : <EmptyState title={t("unavailable")} action={<Button variant="outline" onClick={() => void query.refetch()}>{t("common:actions.retry")}</Button>} />}</Page>;
}

function SettingsEditor({ initial }: { initial: SystemSettings }) {
  const { t, i18n } = useTranslation("settings");
  const client = useQueryClient();
  const navigate = useNavigate();
  const [baseline, setBaseline] = useState(initial);
  const [draft, setDraft] = useState(() => draftFrom(initial));
  const [errors, setErrors] = useState<SettingsFieldErrors>({});
  const [confirm, setConfirm] = useState(false);
  const [needsReview, setNeedsReview] = useState(false);
  const [review, setReview] = useState<SystemSettings>();
  const [reading, setReading] = useState(false);
  const active = useRef(true);
  const reviewTitle = useRef<HTMLHeadingElement>(null);
  const noticeId = "settings:general";
  useEffect(() => { active.current = true; return () => { active.current = false; dismissNotification(noticeId); }; }, []);
  // Revisar está en la banda y la comparación aparece al final del contenido, a veces fuera de la vista: cada lectura
  // lleva el foco a su título, que la deja a la vista y pone las elecciones en el siguiente Tab.
  useEffect(() => { if (review) reviewTitle.current?.focus(); }, [review]);
  const changed = changedFields(draft, baseline);
  const dirty = changed.length > 0;

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
      if (feedback.kind !== "session") notify({ id: noticeId, kind: "error", message: t("feedback.reviewFailed"),
        description: feedback.traceId ? t("errorTraceId", { traceId: feedback.traceId }) : undefined,
        action: { label: t("review.action"), onClick: () => void readCurrent() } });
    } finally { if (active.current) setReading(false); }
  }

  const mutation = useMutation({
    mutationFn: ({ changes, baseline }: { changes: SettingsChanges; baseline: SystemSettings }) => updateSystemSettings(changes, baseline.revision),
    onSuccess: (_, variables) => {
      const saved = { ...variables.baseline, ...variables.changes, revision: variables.baseline.revision + 1 };
      if (active.current) { setBaseline(saved); setDraft(draftFrom(saved)); setNeedsReview(false); setReview(undefined); }
      client.setQueryData(systemSettingsQueryKey, saved);
      void client.invalidateQueries({ queryKey: systemSettingsQueryKey });
      void client.invalidateQueries({ queryKey: presentationQueryKey });
      notify({ id: noticeId, kind: "success", message: t("feedback.saved") });
    },
    onError: error => {
      const feedback = errorFeedback(error, { writing: true, fields: settingFields.map(settingErrorKey), conflictCodes: ["Settings.System.RevisionConflict"] });
      if (feedback.kind === "session") return;
      if (!active.current) {
        notify({ id: noticeId, kind: "error", message: t(feedback.kind === "uncertain" ? "feedback.lateUncertain" : "feedback.lateFailed"),
          description: feedback.traceId ? t("errorTraceId", { traceId: feedback.traceId }) : feedback.detail,
          action: feedback.kind === "uncertain" ? { label: t("review.action"), onClick: () => void navigate("/configuracion") } : undefined });
        return;
      }
      if (feedback.kind === "forbidden") { guard.allowNextNavigation(); void navigate("/sin-permiso"); return; }
      // El servidor nombra los plazos dentro de `retention`; cada mensaje va debajo de su cuadro.
      setErrors(Object.fromEntries(Object.entries(feedback.fields).map(([key, messages]) => [settingFields.find(field => settingErrorKey(field) === key) ?? key, messages.join(" ")])));
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
  const changeDraft = (next: Partial<SettingsDraft>) => {
    setDraft(previous => ({ ...previous, ...next }));
    setErrors(previous => Object.fromEntries(Object.entries(previous).filter(([field]) => !(field in next))));
  };
  const discard = () => { setDraft(draftFrom(baseline)); setErrors({}); setNeedsReview(false); setReview(undefined); dismissNotification(noticeId); };
  function acceptReview(keepDraft: boolean) {
    if (!review) return;
    // Preservar las ediciones y adoptar cambios ajenos en campos que no tocamos.
    setDraft({ ...draftFrom(review), ...(keepDraft ? Object.fromEntries(changed.map(field => [field, draft[field]])) : {}) });
    setBaseline(review);
    setNeedsReview(false); setReview(undefined); setErrors({}); dismissNotification(noticeId);
  }
  const save = () => mutation.mutate({ changes: changesFrom(draft, baseline), baseline });
  // RC1-A: un plazo fuera de su rango se marca en su cuadro sin mandar nada; el servidor valida lo mismo.
  function requestSave() {
    const issues = Object.entries(retentionIssues(draft));
    setErrors(Object.fromEntries(issues.map(([field, range]) => [field, t("retention.range", { min: formatNumber(range.min, i18n.language), max: formatNumber(range.max, i18n.language) })])));
    if (issues.length > 0) return;
    if (changed.includes("registrationMode")) setConfirm(true); else save();
  }
  // La banda lleva solo el título y las acciones: Guardar habilitado ya dice que hay cambios. Revisar actúa sobre
  // toda la pantalla y aparece en la banda mientras un conflicto o un guardado incierto lo piden.
  // Mientras tanto, Descartar y Guardar se apagan con la revisión pendiente como motivo, aunque se cierre el aviso.
  const reviewReason = needsReview && !disabled ? t("review.pending") : null;
  return <Page title={t("title")}
    actions={<>{needsReview ? <Button variant="outline" pending={reading} disabled={disabled} onClick={() => void readCurrent()}>{t(reading ? "review.reading" : "review.action")}</Button> : null}
      <DisabledReason reason={reviewReason}><Button variant="outline" disabled={!dirty || disabled || needsReview} onClick={discard}>{t("discard")}</Button></DisabledReason>
      <DisabledReason reason={reviewReason}><Button pending={mutation.isPending} disabled={!dirty || disabled || needsReview} onClick={requestSave}>{t(mutation.isPending ? "saving" : "save")}</Button></DisabledReason></>}>
    <div className="flex flex-col gap-4">
      <SettingsForm draft={draft} errors={errors} disabled={disabled} onChange={changeDraft} />
      {review ? <SettingsReview current={review} draft={draft} disabled={disabled} titleRef={reviewTitle} onAccept={acceptReview} /> : null}
    </div>
    <ConfirmDialog open={confirm} onOpenChange={setConfirm} title={t(draft.registrationMode === "Open" ? "confirm.openTitle" : "confirm.inviteOnlyTitle")}
      description={t(draft.registrationMode === "Open" ? "confirm.openDescription" : "confirm.inviteOnlyDescription")} confirmLabel={t("save")} onConfirm={save} />
    <ConfirmDialog open={guard.isBlocked} onOpenChange={open => { if (!open) guard.stay(); }} title={t("common:unsavedChanges.title")} description={t("common:unsavedChanges.description")}
      confirmLabel={t("common:unsavedChanges.confirm")} cancelLabel={t("common:unsavedChanges.cancel")} onConfirm={guard.leave} />
  </Page>;
}
