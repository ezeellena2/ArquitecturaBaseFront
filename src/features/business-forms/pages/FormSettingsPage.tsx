import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState, type Ref } from "react";
import { useTranslation } from "react-i18next";
import { Navigate, useNavigate } from "react-router";
import { fetchFormSettings, formSettingFields, formSettingRanges, formSettingsQueryKey, updateFormSettings, type FormSettingField, type FormSettings,
  type FormSettingValues } from "../api/formSettings";
import { ApiError } from "@/shared/api/ApiError";
import { errorFeedback } from "@/shared/api/errorFeedback";
import { useUnsavedChangesGuard } from "@/shared/hooks/useUnsavedChangesGuard";
import { formatNumber } from "@/shared/lib/numberFormat";
import { Button } from "@/shared/ui/button";
import { CellText } from "@/shared/ui/CellText";
import { ComparisonTable } from "@/shared/ui/ComparisonTable";
import { ConfirmDialog } from "@/shared/ui/ConfirmDialog";
import { DisabledReason } from "@/shared/ui/DisabledReason";
import { EmptyState } from "@/shared/ui/EmptyState";
import { FormField } from "@/shared/ui/FormField";
import { FormSkeleton } from "@/shared/ui/FormSkeleton";
import { Input } from "@/shared/ui/input";
import { Page } from "@/shared/ui/Page";
import { Surface } from "@/shared/ui/Surface";
import { dismissNotification, notify } from "@/shared/ui/notifications";

type Draft = Record<FormSettingField, string>;
type FieldErrors = Partial<Record<FormSettingField, string>>;
// Board CF1 (RC4-A): «Archivos» with the size and «Documentos recibidos» in two columns, the re-reads and the suggestion on the left and the two
// terms of the retention (RC1-A) on the right; one column on the phone.
const zones: readonly { key: "files" | "documents"; columns: readonly (readonly FormSettingField[])[] }[] = [
  { key: "files", columns: [["maxFileSizeMiB"]] },
  { key: "documents", columns: [["dailyRereadsPerAsker", "similarDocumentsToSuggest"], ["proposedExpiryDays", "discardedRetentionDays"]] },
];
const noticeId = "settings:forms";
const fieldId = (field: FormSettingField) => "form-setting-" + field;
const draftFrom = (settings: FormSettings): Draft => Object.fromEntries(formSettingFields.map(field => [field, String(settings[field])])) as Draft;
/** A number of the draft as the server takes it, or null while it is not a whole number within its range. */
function valueOf(field: FormSettingField, text: string): number | null {
  const trimmed = text.trim();
  const value = Number(trimmed);
  const range = formSettingRanges[field];
  return trimmed && Number.isInteger(value) && value >= range.min && value <= range.max ? value : null;
}

/** Configuración › Formularios (RC4-A): the numbers of the module an administrator adjusts, saved together with the revision read. */
export function FormSettingsPage() {
  const { t } = useTranslation("formSettings");
  const query = useQuery({ queryKey: formSettingsQueryKey, queryFn: ({ signal }) => fetchFormSettings(signal), refetchOnMount: "always" });
  const [initial, setInitial] = useState<FormSettings>();
  // As in General: first a current revision; once the editor is open, background reads do not replace its draft or its revision.
  if (initial === undefined && query.isFetchedAfterMount && query.isSuccess && !query.isFetching) setInitial(query.data);
  if (query.error instanceof ApiError && query.error.status === 403) return <Navigate to="/sin-permiso" replace />;
  if (initial) return <FormSettingsEditor initial={initial} />;
  return <Page title={t("title")}>{query.isFetching || query.isPending ? <FormSkeleton zones={[{ fields: 1 }, { fields: 4 }]} />
    : <EmptyState title={t("unavailable")} action={<Button variant="outline" onClick={() => void query.refetch()}>{t("common:actions.retry")}</Button>} />}</Page>;
}

function FormSettingsEditor({ initial }: { initial: FormSettings }) {
  const { t } = useTranslation("formSettings");
  const client = useQueryClient();
  const navigate = useNavigate();
  const [baseline, setBaseline] = useState(initial);
  const [draft, setDraft] = useState(() => draftFrom(initial));
  const [errors, setErrors] = useState<FieldErrors>({});
  const [checked, setChecked] = useState(false);
  const [needsReview, setNeedsReview] = useState(false);
  const [review, setReview] = useState<FormSettings>();
  const [reading, setReading] = useState(false);
  const active = useRef(true);
  const reviewTitle = useRef<HTMLHeadingElement>(null);
  useEffect(() => { active.current = true; return () => { active.current = false; dismissNotification(noticeId); }; }, []);
  useEffect(() => { if (review) reviewTitle.current?.focus(); }, [review]);
  const changed = formSettingFields.filter(field => draft[field].trim() !== String(baseline[field]));
  const dirty = changed.length > 0;
  const rangeError = (field: FormSettingField) => t("validation.range", formSettingRanges[field]);
  // After a first try every field is checked as it is written, like the limits of the assistant.
  const localErrors = (values: Draft): FieldErrors => Object.fromEntries(formSettingFields.filter(field => valueOf(field, values[field]) === null)
    .map(field => [field, rangeError(field)]));

  async function readCurrent() {
    setReading(true);
    try {
      const current = await client.fetchQuery({ queryKey: formSettingsQueryKey, queryFn: ({ signal }) => fetchFormSettings(signal), staleTime: 0, meta: { errorOwner: "local" } });
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
    mutationFn: ({ values, revision }: { values: FormSettingValues; revision: number }) => updateFormSettings(values, revision),
    onSuccess: saved => {
      if (active.current) { setBaseline(saved); setDraft(draftFrom(saved)); setErrors({}); setChecked(false); setNeedsReview(false); setReview(undefined); }
      client.setQueryData(formSettingsQueryKey, saved);
      notify({ id: noticeId, kind: "success", message: t("feedback.saved") });
    },
    onError: error => {
      const feedback = errorFeedback(error, { writing: true, fields: formSettingFields, conflictCodes: ["Forms.Settings.RevisionConflict"] });
      if (feedback.kind === "session") return;
      if (!active.current) {
        notify({ id: noticeId, kind: "error", message: t(feedback.kind === "uncertain" ? "feedback.lateUncertain" : "feedback.lateFailed"),
          description: feedback.traceId ? t("errorTraceId", { traceId: feedback.traceId }) : feedback.detail,
          action: feedback.kind === "uncertain" ? { label: t("review.action"), onClick: () => void navigate("/configuracion/formularios") } : undefined });
        return;
      }
      if (feedback.kind === "forbidden") { guard.allowNextNavigation(); void navigate("/sin-permiso"); return; }
      setErrors(Object.fromEntries(Object.entries(feedback.fields).map(([field, messages]) => [field, messages.join(" ")])));
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
  const change = (field: FormSettingField, value: string) => {
    const next = { ...draft, [field]: value };
    setDraft(next);
    setErrors(previous => {
      const rest = Object.fromEntries(Object.entries(previous).filter(([key]) => key !== field));
      return checked && valueOf(field, value) === null ? { ...rest, [field]: rangeError(field) } : rest;
    });
  };
  const discard = () => { setDraft(draftFrom(baseline)); setErrors({}); setChecked(false); setNeedsReview(false); setReview(undefined); dismissNotification(noticeId); };
  function save() {
    setChecked(true);
    const invalid = localErrors(draft);
    setErrors(invalid);
    const first = formSettingFields.find(field => invalid[field]);
    if (first) { document.getElementById(fieldId(first))?.focus(); return; }
    mutation.mutate({ values: Object.fromEntries(formSettingFields.map(field => [field, valueOf(field, draft[field])!])) as FormSettingValues, revision: baseline.revision });
  }
  function acceptReview(keepDraft: boolean) {
    if (!review) return;
    // Keep the edits and adopt what someone else changed in the numbers this draft did not touch.
    setDraft({ ...draftFrom(review), ...(keepDraft ? Object.fromEntries(changed.map(field => [field, draft[field]])) : {}) });
    setBaseline(review);
    setNeedsReview(false); setReview(undefined); setErrors({}); dismissNotification(noticeId);
  }
  const reviewReason = needsReview && !disabled ? t("review.pending") : null;
  const number = (field: FormSettingField) => {
    const range = formSettingRanges[field];
    // The unit is short on the phone, as in the board, and whole from the tablet on.
    return <FormField key={field} label={t("fields." + field)} help={t("hints." + field, range)} required error={errors[field]}
      beside={<span className="text-sm text-[var(--color-content-muted)]"><span className="sm:hidden">{t("unitsShort." + field)}</span><span className="max-sm:hidden">{t("units." + field)}</span></span>}>
      <Input id={fieldId(field)} type="number" inputMode="numeric" step={1} min={range.min} max={range.max} className="w-24" disabled={disabled}
        value={draft[field]} onChange={event => change(field, event.target.value)} />
    </FormField>;
  };
  return <Page title={t("title")}
    actions={<>{needsReview ? <Button variant="outline" pending={reading} disabled={disabled} onClick={() => void readCurrent()}>{t(reading ? "review.reading" : "review.action")}</Button> : null}
      <DisabledReason reason={reviewReason}><Button variant="outline" disabled={!dirty || disabled || needsReview} onClick={discard}>{t("discard")}</Button></DisabledReason>
      <DisabledReason reason={reviewReason}><Button pending={mutation.isPending} disabled={!dirty || disabled || needsReview} onClick={save}>{t(mutation.isPending ? "saving" : "save")}</Button></DisabledReason></>}>
    <div className="flex flex-col gap-4">
      {zones.map(zone => <Surface key={zone.key} title={t("sections." + zone.key)} padded>
        <div className="grid gap-x-6 gap-y-4 lg:grid-cols-2">{zone.columns.map(column => <div key={column.join()} className="flex min-w-0 flex-col gap-4">{column.map(number)}</div>)}</div>
      </Surface>)}
      {review ? <FormSettingsReview current={review} draft={draft} disabled={disabled} titleRef={reviewTitle} onAccept={acceptReview} /> : null}
    </div>
    <ConfirmDialog open={guard.isBlocked} onOpenChange={open => { if (!open) guard.stay(); }} title={t("common:unsavedChanges.title")} description={t("common:unsavedChanges.description")}
      confirmLabel={t("common:unsavedChanges.confirm")} cancelLabel={t("common:unsavedChanges.cancel")} onConfirm={guard.leave} />
  </Page>;
}

/** «Revisar cambios», as in General: only the numbers that differ, what is saved and the draft side by side (LR2-A). */
function FormSettingsReview({ current, draft, disabled, titleRef, onAccept }: {
  current: FormSettings; draft: Draft; disabled: boolean; titleRef: Ref<HTMLHeadingElement>; onAccept: (keepDraft: boolean) => void;
}) {
  const { t, i18n } = useTranslation("formSettings");
  const show = (field: FormSettingField, text: string) => { const value = valueOf(field, text); return value === null ? text.trim() : formatNumber(value, i18n.language); };
  return <Surface title={t("review.title")} titleRef={titleRef} padded actions={<>
    <Button variant="outline" disabled={disabled} onClick={() => onAccept(false)}>{t("review.useCurrent")}</Button>
    <Button disabled={disabled} onClick={() => onAccept(true)}>{t("review.keepMine")}</Button>
  </>}>
    <ComparisonTable columns={{ identity: [{ key: "setting", header: t("review.setting") }], before: t("review.current"), after: t("review.mine") }}
      groups={formSettingFields.filter(field => String(current[field]) !== draft[field].trim()).map(field => ({ key: field, identity: [t("fields." + field)],
        lines: [{ key: "value", before: <CellText text={formatNumber(current[field], i18n.language)} />, after: <CellText text={show(field, draft[field])} /> }] }))} />
  </Surface>;
}
