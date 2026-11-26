import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router";
import { useRereadAfterForbidden } from "@/auth/useRereadAfterForbidden";
import { ForbiddenPage } from "@/shared/ui/ForbiddenPage";
import { ApiError } from "@/shared/api/ApiError";
import { errorFeedback } from "@/shared/api/errorFeedback";
import { useUnsavedChangesGuard } from "@/shared/hooks/useUnsavedChangesGuard";
import { countryCallingCode, countryName, whatsAppCountries } from "@/shared/lib/countries";
import { Button } from "@/shared/ui/button";
import { CellText } from "@/shared/ui/CellText";
import { ComparisonTable } from "@/shared/ui/ComparisonTable";
import { ConfirmDialog } from "@/shared/ui/ConfirmDialog";
import { DisabledReason } from "@/shared/ui/DisabledReason";
import { EmptyState } from "@/shared/ui/EmptyState";
import { FormField } from "@/shared/ui/FormField";
import { FormSkeleton } from "@/shared/ui/FormSkeleton";
import { Input } from "@/shared/ui/input";
import { dismissNotification, notify } from "@/shared/ui/notifications";
import { Page } from "@/shared/ui/Page";
import { Picker, type PickerOption } from "@/shared/ui/Picker";
import { Surface } from "@/shared/ui/Surface";
import { fetchWhatsAppSettings, saveWhatsAppSettings, whatsAppSettingFields, whatsAppSettingsKey, whatsAppSettingsLimits as limits, type WhatsAppSettingField,
  type WhatsAppSettings } from "../api/whatsappSettings";
import { changedFields, draftFromSettings, mergeDrafts, newCountries, saveRequest, validateDraft, type WhatsAppSettingsDraft } from "../lib/whatsappSettingsDraft";

const fieldId: Record<WhatsAppSettingField, string> = {
  flowSessionLifetimeHours: "whatsapp-settings-lifetime", allowedCountries: "whatsapp-settings-countries", messageRetentionDays: "whatsapp-settings-retention",
};

/**
 * Configuración › WhatsApp (RC3-A, 2026-11-22): how long a sent form accepts its answer, the countries that receive codes and how long the
 * messages keep their content, as the board confirmed by the user. Saved whole with the revision read, like Configuración › General.
 */
export function WhatsAppSettingsPage() {
  const { t } = useTranslation("whatsapp");
  const query = useQuery({ queryKey: whatsAppSettingsKey, queryFn: ({ signal }) => fetchWhatsAppSettings(signal), refetchOnMount: "always" });
  const [initial, setInitial] = useState<WhatsAppSettings>();
  // As General: the editor starts from a revision read now, and a refetch in the background does not replace its draft.
  if (initial === undefined && query.isFetchedAfterMount && query.isSuccess && !query.isFetching) setInitial(query.data);
  if (query.error instanceof ApiError && query.error.status === 403) return <ForbiddenPage title={t("settings.title")} />;
  if (initial) return <WhatsAppSettingsEditor initial={initial} />;
  return <Page title={t("settings.title")}>{query.isFetching || query.isPending ? <FormSkeleton zones={[{ fields: 1 }, { fields: 1 }, { fields: 1 }]} />
    : <EmptyState title={t("settings.unavailable")} action={<Button variant="outline" onClick={() => void query.refetch()}>{t("common:actions.retry")}</Button>} />}</Page>;
}

function WhatsAppSettingsEditor({ initial }: { initial: WhatsAppSettings }) {
  const { t, i18n } = useTranslation("whatsapp");
  const client = useQueryClient();
  const navigate = useNavigate();
  const reread = useRereadAfterForbidden();
  const [baseline, setBaseline] = useState(initial);
  const [draft, setDraft] = useState(() => draftFromSettings(initial));
  const [errors, setErrors] = useState<Partial<Record<WhatsAppSettingField, string>>>({});
  const [needsReview, setNeedsReview] = useState(false);
  const [review, setReview] = useState<WhatsAppSettings>();
  const [reading, setReading] = useState(false);
  const active = useRef(true);
  const reviewTitle = useRef<HTMLHeadingElement>(null);
  const noticeId = "whatsapp:settings";
  const costNoticeId = "whatsapp:settings-cost";
  useEffect(() => { active.current = true; return () => { active.current = false; dismissNotification(noticeId); dismissNotification(costNoticeId); }; }, []);
  useEffect(() => { if (review) reviewTitle.current?.focus(); }, [review]);
  const base = draftFromSettings(baseline);
  const dirty = changedFields(draft, base).length > 0;
  // Each country by its name in the language of the menu, with its prefix in grey; a saved one the list does not offer keeps its code.
  const name = (country: string) => countryName(country, i18n.language);
  const countryOptions = useMemo<PickerOption[]>(() => whatsAppCountries.map(country => ({ id: country, label: countryName(country, i18n.language),
    description: countryCallingCode(country), keywords: country })).sort((left, right) => left.label.localeCompare(right.label, i18n.language)), [i18n.language]);
  const savedOutside = draft.allowedCountries.filter(country => !whatsAppCountries.includes(country)).map(country => ({ id: country, label: name(country) }));

  async function readCurrent() {
    setReading(true);
    try {
      const current = await client.fetchQuery({ queryKey: whatsAppSettingsKey, queryFn: ({ signal }) => fetchWhatsAppSettings(signal), staleTime: 0, meta: { errorOwner: "local" } });
      if (!active.current) return;
      setReview(current);
      dismissNotification(noticeId);
    } catch (error) {
      if (!active.current) return;
      const feedback = errorFeedback(error);
      if (feedback.kind === "forbidden") { reread(); return; }
      if (feedback.kind !== "session") notify({ id: noticeId, kind: "error", message: t("settings.feedback.reviewFailed"),
        description: feedback.traceId ? t("settings.feedback.traceId", { traceId: feedback.traceId }) : undefined,
        action: { label: t("settings.review.action"), onClick: () => void readCurrent() } });
    } finally { if (active.current) setReading(false); }
  }

  const mutation = useMutation({
    mutationFn: ({ draft, baseline }: { draft: WhatsAppSettingsDraft; baseline: WhatsAppSettings }) => saveWhatsAppSettings(saveRequest(draft, baseline)),
    onSuccess: saved => {
      if (active.current) { setBaseline(saved); setDraft(draftFromSettings(saved)); setNeedsReview(false); setReview(undefined); }
      client.setQueryData(whatsAppSettingsKey, saved);
      dismissNotification(costNoticeId);
      notify({ id: noticeId, kind: "success", message: t("settings.feedback.saved") });
    },
    onError: (error, variables) => {
      // A 400 names each country by its place in what was sent (`allowedCountries[1]`): those paths are the field of the countries too.
      const countryPaths = saveRequest(variables.draft, variables.baseline).allowedCountries.map((_, index) => `allowedCountries[${index}]`);
      const feedback = errorFeedback(error, { writing: true, fields: [...whatsAppSettingFields, ...countryPaths], conflictCodes: ["WhatsApp.Settings.RevisionConflict"] });
      if (feedback.kind === "session") return;
      if (!active.current) {
        notify({ id: noticeId, kind: "error", message: t(feedback.kind === "uncertain" ? "settings.feedback.lateUncertain" : "settings.feedback.lateFailed"),
          description: feedback.traceId ? t("settings.feedback.traceId", { traceId: feedback.traceId }) : feedback.detail,
          action: feedback.kind === "uncertain" ? { label: t("settings.review.action"), onClick: () => void navigate("/configuracion/whatsapp") } : undefined });
        return;
      }
      if (feedback.kind === "forbidden") { reread(); return; }
      // A 400 names `allowedCountries[1]`: it goes to the field of the countries.
      setErrors(Object.fromEntries(Object.entries(feedback.fields).map(([field, messages]) => [field.replace(/\[\d+\]$/, ""), messages.join(" ")])));
      if (feedback.kind === "fields") return;
      const uncertain = feedback.kind === "uncertain";
      const conflict = feedback.kind === "conflict";
      if (uncertain || conflict) setNeedsReview(true);
      notify({ id: noticeId, kind: "error", message: t(uncertain ? "settings.feedback.uncertain" : conflict ? "settings.feedback.conflict" : "settings.feedback.failed"),
        description: conflict ? undefined : feedback.traceId ? t("settings.feedback.traceId", { traceId: feedback.traceId }) : feedback.detail,
        action: uncertain || conflict ? { label: t("settings.review.action"), onClick: () => void readCurrent() } : undefined });
    },
  });
  const guard = useUnsavedChangesGuard(dirty && !mutation.isPending);
  const disabled = mutation.isPending || reading;

  const change = (next: Partial<WhatsAppSettingsDraft>) => {
    setDraft(previous => ({ ...previous, ...next }));
    setErrors(previous => Object.fromEntries(Object.entries(previous).filter(([field]) => !(field in next))));
  };
  // The cost of a country (decided with the board): adding one that is not saved says, once, that its codes are paid with its rate.
  const changeCountries = (next: string[]) => {
    const added = newCountries(next, draft.allowedCountries, baseline.allowedCountries);
    change({ allowedCountries: next });
    if (added.length) notify({ id: costNoticeId, kind: "warning", message: t("settings.countryCost", { count: added.length, countries: added.map(name).join(", ") }) });
  };
  const discard = () => { setDraft(draftFromSettings(baseline)); setErrors({}); setNeedsReview(false); setReview(undefined); dismissNotification(noticeId); dismissNotification(costNoticeId); };
  function acceptReview(keepDraft: boolean) {
    if (!review) return;
    // Keeps what was edited and takes what the other person changed in the rest.
    setDraft(keepDraft ? mergeDrafts(draft, base, draftFromSettings(review)) : draftFromSettings(review));
    setBaseline(review);
    setNeedsReview(false); setReview(undefined); setErrors({}); dismissNotification(noticeId);
  }
  const save = () => {
    const issues = validateDraft(draft);
    const found = whatsAppSettingFields.filter(field => issues[field]);
    if (found.length) {
      setErrors(Object.fromEntries(found.map(field => [field, t(issues[field]!.key, issues[field]!.values)])));
      document.getElementById(fieldId[found[0]!])?.focus();
      return;
    }
    setErrors({});
    mutation.mutate({ draft, baseline });
  };
  const reviewReason = needsReview && !disabled ? t("settings.review.pending") : null;
  const units = (text: string) => <span className="text-sm text-[var(--color-content-muted)]">{text}</span>;
  const number = (field: "flowSessionLifetimeHours" | "messageRetentionDays", min: number, max: number, unit: string) =>
    <FormField label={t(`settings.fields.${field}`)} help={t(`settings.help.${field}`)} required error={errors[field]} beside={units(unit)}>
      <Input id={fieldId[field]} type="number" inputMode="numeric" step={1} min={min} max={max} className="w-24" disabled={disabled} value={draft[field]}
        onChange={event => change({ [field]: event.target.value })} />
    </FormField>;
  const display = (field: WhatsAppSettingField, version: WhatsAppSettingsDraft) => field === "allowedCountries" ? version.allowedCountries.map(name).join(", ")
    : t(field === "flowSessionLifetimeHours" ? "settings.units.hoursValue" : "settings.units.daysValue", { count: Number(version[field]) });

  return <Page title={t("settings.title")}
    actions={<>{needsReview ? <Button variant="outline" pending={reading} disabled={disabled} onClick={() => void readCurrent()}>{t(reading ? "settings.review.reading" : "settings.review.action")}</Button> : null}
      <DisabledReason reason={reviewReason}><Button variant="outline" disabled={!dirty || disabled || needsReview} onClick={discard}>{t("settings.discard")}</Button></DisabledReason>
      <DisabledReason reason={reviewReason}><Button pending={mutation.isPending} disabled={!dirty || disabled || needsReview} onClick={save}>{t(mutation.isPending ? "settings.saving" : "settings.save")}</Button></DisabledReason></>}>
    <div className="flex flex-col gap-4">
      <Surface title={t("settings.sections.forms")} padded>
        {number("flowSessionLifetimeHours", limits.minFlowSessionLifetimeHours, limits.maxFlowSessionLifetimeHours, t("settings.units.hours"))}
      </Surface>
      <Surface title={t("settings.sections.login")} padded>
        <div className="w-full sm:w-72"><FormField label={t("settings.fields.allowedCountries")} help={t("settings.help.allowedCountries")} required error={errors.allowedCountries}>
          <Picker multiple id={fieldId.allowedCountries} label={t("settings.fields.allowedCountries")} options={countryOptions} selectedOptions={savedOutside}
            placeholder={t("settings.noCountries")} disabled={disabled} value={draft.allowedCountries} onChange={changeCountries} />
        </FormField></div>
      </Surface>
      <Surface title={t("settings.sections.retention")} padded>
        {number("messageRetentionDays", limits.minMessageRetentionDays, limits.maxMessageRetentionDays, t("settings.units.days"))}
      </Surface>
      {review ? <Surface title={t("settings.review.title")} titleRef={reviewTitle} padded actions={<>
        <Button variant="outline" disabled={disabled} onClick={() => acceptReview(false)}>{t("settings.review.useCurrent")}</Button>
        <Button disabled={disabled} onClick={() => acceptReview(true)}>{t("settings.review.keepMine")}</Button>
      </>}>
        {changedFields(draftFromSettings(review), draft).length ? <ComparisonTable columns={{ identity: [{ key: "setting", header: t("settings.review.setting") }],
          before: t("settings.review.current"), after: t("settings.review.mine") }}
          groups={changedFields(draftFromSettings(review), draft).map(field => ({ key: field, identity: [t(`settings.fields.${field}`)],
            lines: [{ key: "value", before: <CellText text={display(field, draftFromSettings(review))} />, after: <CellText text={display(field, draft)} /> }] }))} />
          : <p className="text-sm text-[var(--color-content-muted)]">{t("settings.review.same")}</p>}
      </Surface> : null}
    </div>
    <ConfirmDialog open={guard.isBlocked} onOpenChange={open => { if (!open) guard.stay(); }} title={t("common:unsavedChanges.title")} description={t("common:unsavedChanges.description")}
      confirmLabel={t("common:unsavedChanges.confirm")} cancelLabel={t("common:unsavedChanges.cancel")} onConfirm={guard.leave} />
  </Page>;
}
