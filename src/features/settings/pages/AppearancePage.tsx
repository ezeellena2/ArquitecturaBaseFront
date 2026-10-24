import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Navigate, useNavigate } from "react-router";
import { fetchSystemSettings, systemSettingsQueryKey, updateSystemSettings, type SystemSettings } from "../api/settings";
import { ApiError } from "@/shared/api/ApiError";
import { errorFeedback } from "@/shared/api/errorFeedback";
import { presentationQueryKey, type SystemPresentation } from "@/shared/api/presentation";
import { initialAppearance, type SystemAppearance } from "@/shared/lib/appearance";
import { useUnsavedChangesGuard } from "@/shared/hooks/useUnsavedChangesGuard";
import { AppearancePreview } from "@/shared/ui/AppearancePreview";
import { Button } from "@/shared/ui/button";
import { ConfirmDialog } from "@/shared/ui/ConfirmDialog";
import { DataTable } from "@/shared/ui/DataTable";
import { EmptyState } from "@/shared/ui/EmptyState";
import { FormField } from "@/shared/ui/FormField";
import { Input } from "@/shared/ui/input";
import { Page } from "@/shared/ui/Page";
import { Skeleton } from "@/shared/ui/skeleton";
import { Surface } from "@/shared/ui/Surface";
import { dismissNotification, notify } from "@/shared/ui/notifications";

const fields = Object.keys(initialAppearance) as (keyof SystemAppearance)[];
const samePalette = (first: SystemAppearance, second: SystemAppearance) => fields.every(field => first[field].toUpperCase() === second[field].toUpperCase());

export function AppearancePage() {
  const { t } = useTranslation("settings");
  const query = useQuery({ queryKey: systemSettingsQueryKey, queryFn: fetchSystemSettings, refetchOnMount: "always" });
  const [initial, setInitial] = useState<SystemSettings>();
  if (initial === undefined && query.isFetchedAfterMount && query.isSuccess && !query.isFetching) setInitial(query.data);
  if (query.error instanceof ApiError && query.error.status === 403) return <Navigate to="/sin-permiso" replace />;
  if (initial) return <AppearanceEditor initial={initial} />;
  return <Page title={t("appearance.title")}>{query.isFetching || query.isPending ? <Skeleton className="h-52" />
    : <EmptyState title={t("unavailable")} action={<Button variant="outline" onClick={() => void query.refetch()}>{t("common:actions.retry")}</Button>} />}</Page>;
}

function AppearanceEditor({ initial }: { initial: SystemSettings }) {
  const { t } = useTranslation("settings");
  const client = useQueryClient();
  const navigate = useNavigate();
  const [baseline, setBaseline] = useState(initial);
  const [draft, setDraft] = useState(initial.appearance);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [needsReview, setNeedsReview] = useState(false);
  const [review, setReview] = useState<SystemSettings>();
  const [reading, setReading] = useState(false);
  const active = useRef(true);
  const noticeId = "settings:appearance";
  useEffect(() => { active.current = true; return () => { active.current = false; dismissNotification(noticeId); }; }, []);
  const dirty = !samePalette(draft, baseline.appearance);
  async function readCurrent() {
    setReading(true);
    try {
      const current = await client.fetchQuery({ queryKey: systemSettingsQueryKey, queryFn: fetchSystemSettings, staleTime: 0, meta: { errorOwner: "local" } });
      if (active.current) { setReview(current); dismissNotification(noticeId); }
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
    mutationFn: ({ appearance, revision }: { appearance: SystemAppearance; revision: number }) => updateSystemSettings({ appearance }, revision),
    onSuccess: (_, variables) => {
      const saved = { ...baseline, appearance: variables.appearance, revision: variables.revision + 1 };
      if (active.current) { setBaseline(saved); setDraft(saved.appearance); setNeedsReview(false); setReview(undefined); }
      client.setQueryData(systemSettingsQueryKey, saved);
      client.setQueryData<SystemPresentation>(presentationQueryKey, previous => previous ? { ...previous, appearance: saved.appearance } : previous);
      void client.invalidateQueries({ queryKey: systemSettingsQueryKey });
      void client.invalidateQueries({ queryKey: presentationQueryKey });
      notify({ id: noticeId, kind: "success", message: t("appearance.saved") });
    },
    onError: error => {
      const feedback = errorFeedback(error, { writing: true, fields: fields.map(field => `appearance.${field}`), conflictCodes: ["Settings.System.RevisionConflict"] });
      if (feedback.kind === "session") return;
      if (active.current && feedback.kind === "forbidden") { guard.allowNextNavigation(); void navigate("/sin-permiso"); return; }
      if (active.current) setErrors(Object.fromEntries(Object.entries(feedback.fields).map(([field, messages]) => [field, messages.join(" ")])));
      if (feedback.kind === "fields" && active.current) return;
      const uncertain = feedback.kind === "uncertain", conflict = feedback.kind === "conflict";
      if (active.current && (uncertain || conflict)) setNeedsReview(true);
      notify({ id: noticeId, kind: "error", message: t(uncertain ? "feedback.uncertain" : conflict ? "feedback.conflict" : "appearance.failed"),
        description: feedback.traceId ? t("errorTraceId", { traceId: feedback.traceId }) : feedback.detail,
        action: uncertain || conflict ? { label: t("review.action"), onClick: () => { if (active.current) void readCurrent(); else void navigate("/configuracion/apariencia"); } } : undefined });
    },
  });
  const guard = useUnsavedChangesGuard(dirty && !mutation.isPending);
  const disabled = mutation.isPending || reading;
  function acceptReview(keepDraft: boolean) {
    if (!review) return;
    if (!keepDraft) setDraft(review.appearance);
    setBaseline(review); setReview(undefined); setNeedsReview(false); setErrors({}); dismissNotification(noticeId);
  }
  // La banda lleva solo el título y las acciones: Guardar habilitado ya dice que hay cambios. Revisar actúa sobre
  // toda la pantalla y aparece en la banda mientras un conflicto o un guardado incierto lo piden.
  return <Page title={t("appearance.title")}
    actions={<>{needsReview ? <Button variant="outline" disabled={disabled} onClick={() => void readCurrent()}>{t(reading ? "review.reading" : "review.action")}</Button> : null}
      <Button variant="outline" disabled={!dirty || disabled || needsReview} onClick={() => { setDraft(baseline.appearance); setErrors({}); dismissNotification(noticeId); }}>{t("discard")}</Button>
      <Button disabled={!dirty || disabled || needsReview} onClick={() => { setErrors({}); mutation.mutate({ appearance: draft, revision: baseline.revision }); }}>{t(mutation.isPending ? "saving" : "save")}</Button></>}>
    <div className="flex flex-col gap-5">
      <Surface title={t("appearance.colors")} padded actions={<Button variant="outline" disabled={disabled} onClick={() => { setDraft(initialAppearance); setErrors({}); }}>{t("appearance.reset")}</Button>}>
        <p className="text-sm text-[var(--color-content-muted)]">{t("appearance.hint")}</p>
        <div className="grid max-w-3xl gap-5 sm:grid-cols-2">{fields.map(field => <FormField key={field} label={t(`appearance.fields.${field}`)} hint={draft[field].toUpperCase()} error={errors[`appearance.${field}`]}>
          <Input type="color" value={draft[field]} disabled={disabled} onChange={event => { setDraft(previous => ({ ...previous, [field]: event.target.value })); setErrors(previous => ({ ...previous, [`appearance.${field}`]: "" })); }} />
        </FormField>)}</div>
        <p className="max-w-3xl text-sm text-[var(--color-content-muted)]">{t("appearance.contrast")}</p>
      </Surface>
      <AppearancePreview appearance={draft} labels={{ title: t("appearance.preview"), home: t("common:navigation.dashboard"), administration: t("common:navigation.administration"), name: t("appearance.name"), role: t("appearance.role"), search: t("appearance.search"), newUser: t("appearance.newUser") }} />
      {review ? <Surface title={t("review.title")} padded actions={<><Button variant="outline" disabled={disabled} onClick={() => acceptReview(false)}>{t("review.useCurrent")}</Button><Button disabled={disabled} onClick={() => acceptReview(true)}>{t("review.keepMine")}</Button></>}>
        <DataTable columns={[{ id: "setting", header: t("review.setting"), cell: row => t(`appearance.fields.${row.field}`) },
          { id: "current", header: t("review.current"), cell: row => review.appearance[row.field].toUpperCase() },
          { id: "mine", header: t("review.mine"), cell: row => draft[row.field].toUpperCase() }]} rows={fields.map(field => ({ field }))} rowKey={row => row.field} />
      </Surface> : null}
    </div>
    <ConfirmDialog open={guard.isBlocked} onOpenChange={open => { if (!open) guard.stay(); }} title={t("common:unsavedChanges.title")} description={t("common:unsavedChanges.description")} confirmLabel={t("common:unsavedChanges.confirm")} cancelLabel={t("common:unsavedChanges.cancel")} onConfirm={guard.leave} />
  </Page>;
}
