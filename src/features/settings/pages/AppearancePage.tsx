import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router";
import { useRereadAfterForbidden } from "@/auth/useRereadAfterForbidden";
import { ForbiddenPage } from "@/shared/ui/ForbiddenPage";
import { fetchSystemSettings, systemSettingsQueryKey, updateSystemSettings, type SystemBranding, type SystemSettings } from "../api/settings";
import { brandingChanged, brandingDraftFrom, brandingFields, brandingFrom, brandingIssues, brandingLimits, isLogoUrl, type BrandingDraft, type BrandingField } from "../model";
import { ApiError } from "@/shared/api/ApiError";
import { errorFeedback } from "@/shared/api/errorFeedback";
import { presentationQueryKey, type SystemPresentation } from "@/shared/api/presentation";
import { initialAppearance, type SystemAppearance } from "@/shared/lib/appearance";
import { useUnsavedChangesGuard } from "@/shared/hooks/useUnsavedChangesGuard";
import { AppearancePreview } from "@/shared/ui/AppearancePreview";
import { Button } from "@/shared/ui/button";
import { DisabledReason } from "@/shared/ui/DisabledReason";
import { ConfirmDialog } from "@/shared/ui/ConfirmDialog";
import { DataTable } from "@/shared/ui/DataTable";
import { EmptyState } from "@/shared/ui/EmptyState";
import { FormField } from "@/shared/ui/FormField";
import { Input } from "@/shared/ui/input";
import { Page } from "@/shared/ui/Page";
import { FormSkeleton } from "@/shared/ui/FormSkeleton";
import { Surface } from "@/shared/ui/Surface";
import { dismissNotification, notify } from "@/shared/ui/notifications";

const fields = Object.keys(initialAppearance) as (keyof SystemAppearance)[];
const samePalette = (first: SystemAppearance, second: SystemAppearance) => fields.every(field => first[field].toUpperCase() === second[field].toUpperCase());
const errorKeys = [...fields.map(field => `appearance.${field}`), ...brandingFields.map(field => `branding.${field}`)];

export function AppearancePage() {
  const { t } = useTranslation("settings");
  const query = useQuery({ queryKey: systemSettingsQueryKey, queryFn: fetchSystemSettings, refetchOnMount: "always" });
  const [initial, setInitial] = useState<SystemSettings>();
  if (initial === undefined && query.isFetchedAfterMount && query.isSuccess && !query.isFetching) setInitial(query.data);
  if (query.error instanceof ApiError && query.error.status === 403) return <ForbiddenPage title={t("appearance.title")} />;
  if (initial) return <AppearanceEditor initial={initial} />;
  return <Page title={t("appearance.title")}>{query.isFetching || query.isPending ? <FormSkeleton zones={[{ fields: 3 }, { fields: 4 }, { rows: 3 }]} />
    : <EmptyState title={t("unavailable")} action={<Button variant="outline" onClick={() => void query.refetch()}>{t("common:actions.retry")}</Button>} />}</Page>;
}

function AppearanceEditor({ initial }: { initial: SystemSettings }) {
  const { t } = useTranslation("settings");
  const client = useQueryClient();
  const navigate = useNavigate();
  const reread = useRereadAfterForbidden();
  const [baseline, setBaseline] = useState(initial);
  const [draft, setDraft] = useState(initial.appearance);
  const [brand, setBrand] = useState(() => brandingDraftFrom(initial.branding));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [needsReview, setNeedsReview] = useState(false);
  const [review, setReview] = useState<SystemSettings>();
  const [reading, setReading] = useState(false);
  const active = useRef(true);
  const reviewTitle = useRef<HTMLHeadingElement>(null);
  const noticeId = "settings:appearance";
  useEffect(() => { active.current = true; return () => { active.current = false; dismissNotification(noticeId); }; }, []);
  // Revisar está en la banda y la comparación aparece después de los colores y la vista previa: cada lectura lleva el
  // foco a su título, que la deja a la vista y pone las elecciones en el siguiente Tab.
  useEffect(() => { if (review) reviewTitle.current?.focus(); }, [review]);
  const colorsChanged = !samePalette(draft, baseline.appearance);
  const brandChanged = brandingChanged(brand, baseline.branding);
  const dirty = colorsChanged || brandChanged;
  async function readCurrent() {
    setReading(true);
    try {
      const current = await client.fetchQuery({ queryKey: systemSettingsQueryKey, queryFn: fetchSystemSettings, staleTime: 0, meta: { errorOwner: "local" } });
      if (active.current) { setReview(current); dismissNotification(noticeId); }
    } catch (error) {
      if (!active.current) return;
      const feedback = errorFeedback(error);
      if (feedback.kind === "forbidden") { reread(); return; }
      if (feedback.kind !== "session") notify({ id: noticeId, kind: "error", message: t("feedback.reviewFailed"),
        description: feedback.traceId ? t("errorTraceId", { traceId: feedback.traceId }) : undefined,
        action: { label: t("review.action"), onClick: () => void readCurrent() } });
    } finally { if (active.current) setReading(false); }
  }
  const mutation = useMutation({
    // RC6-B: el nombre, el remitente y el logo se guardan con los colores, en el mismo pedido y con la misma revisión; viaja sólo lo que cambió.
    mutationFn: ({ appearance, branding, revision }: { appearance?: SystemAppearance; branding?: SystemBranding; revision: number }) =>
      updateSystemSettings({ ...(appearance ? { appearance } : {}), ...(branding ? { branding } : {}) }, revision),
    onSuccess: (_, variables) => {
      const saved = { ...baseline, appearance: variables.appearance ?? baseline.appearance, branding: variables.branding ?? baseline.branding, revision: variables.revision + 1 };
      if (active.current) { setBaseline(saved); setDraft(saved.appearance); setBrand(brandingDraftFrom(saved.branding)); setNeedsReview(false); setReview(undefined); }
      client.setQueryData(systemSettingsQueryKey, saved);
      if (variables.appearance) client.setQueryData<SystemPresentation>(presentationQueryKey, previous => previous ? { ...previous, appearance: saved.appearance } : previous);
      void client.invalidateQueries({ queryKey: systemSettingsQueryKey });
      void client.invalidateQueries({ queryKey: presentationQueryKey });
      notify({ id: noticeId, kind: "success", message: t(variables.branding ? "appearance.savedAll" : "appearance.saved") });
    },
    onError: error => {
      const feedback = errorFeedback(error, { writing: true, fields: errorKeys, conflictCodes: ["Settings.System.RevisionConflict"] });
      if (feedback.kind === "session") return;
      if (active.current && feedback.kind === "forbidden") { reread(); return; }
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
  function changeBrand(field: BrandingField, value: string) {
    setBrand(previous => ({ ...previous, [field]: value }));
    setErrors(previous => ({ ...previous, [`branding.${field}`]: "" }));
  }
  // Cada cuadro dice su problema antes de mandar nada; el servidor valida lo mismo.
  function save() {
    const issues = Object.entries(brandingIssues(brand));
    setErrors(Object.fromEntries(issues.map(([field, issue]) => [`branding.${field}`, t(`appearance.issues.${issue}`, { max: brandingLimits.name })])));
    if (issues.length > 0) return;
    mutation.mutate({ appearance: colorsChanged ? draft : undefined, branding: brandChanged ? brandingFrom(brand) : undefined, revision: baseline.revision });
  }
  function acceptReview(keepDraft: boolean) {
    if (!review) return;
    if (!keepDraft) { setDraft(review.appearance); setBrand(brandingDraftFrom(review.branding)); }
    setBaseline(review); setReview(undefined); setNeedsReview(false); setErrors({}); dismissNotification(noticeId);
  }
  // La banda lleva solo el título y las acciones: Guardar habilitado ya dice que hay cambios. Revisar actúa sobre
  // toda la pantalla y aparece en la banda mientras un conflicto o un guardado incierto lo piden.
  // Mientras tanto, Descartar y Guardar se apagan con la revisión pendiente como motivo, aunque se cierre el aviso.
  const reviewReason = needsReview && !disabled ? t("review.pending") : null;
  const brandText = (value: BrandingDraft, field: BrandingField) => field === "emailLogoUrl" && !value.emailLogoUrl.trim() ? t("appearance.noLogo") : value[field].trim();
  const reviewRows = [...brandingFields.map(field => ({ key: field, label: t(`appearance.brandFields.${field}`),
    current: review ? brandText(brandingDraftFrom(review.branding), field) : "", mine: brandText(brand, field) })),
    ...fields.map(field => ({ key: field, label: t(`appearance.fields.${field}`), current: review?.appearance[field].toUpperCase() ?? "", mine: draft[field].toUpperCase() }))];
  return <Page title={t("appearance.title")}
    actions={<>{needsReview ? <Button variant="outline" pending={reading} disabled={disabled} onClick={() => void readCurrent()}>{t(reading ? "review.reading" : "review.action")}</Button> : null}
      <DisabledReason reason={reviewReason}><Button variant="outline" disabled={!dirty || disabled || needsReview} onClick={() => { setDraft(baseline.appearance); setBrand(brandingDraftFrom(baseline.branding)); setErrors({}); dismissNotification(noticeId); }}>{t("discard")}</Button></DisabledReason>
      <DisabledReason reason={reviewReason}><Button pending={mutation.isPending} disabled={!dirty || disabled || needsReview} onClick={save}>{t(mutation.isPending ? "saving" : "save")}</Button></DisabledReason></>}>
    <div className="flex flex-col gap-5">
      {/* RC6-B: cómo se presenta la instalación, arriba de los colores. Dónde aparece va en la (i) del título y qué pide el
          logo, en la suya; «Así llega» se arma con el borrador. */}
      <Surface title={t("appearance.brand")} help={t("appearance.brandHint")} padded>
        <div className="grid max-w-3xl gap-5 sm:grid-cols-2">
          <FormField label={t("appearance.brandFields.appName")} required error={errors["branding.appName"] || undefined}>
            <Input value={brand.appName} maxLength={brandingLimits.name} autoComplete="off" disabled={disabled} onChange={event => changeBrand("appName", event.target.value)} />
          </FormField>
          <FormField label={t("appearance.brandFields.emailSenderName")} help={t("appearance.senderHint")} required error={errors["branding.emailSenderName"] || undefined}>
            <Input value={brand.emailSenderName} maxLength={brandingLimits.name} autoComplete="off" disabled={disabled} onChange={event => changeBrand("emailSenderName", event.target.value)} />
          </FormField>
          <div className="sm:col-span-2"><FormField label={t("appearance.brandFields.emailLogoUrl")} help={t("appearance.logoHint")} error={errors["branding.emailLogoUrl"] || undefined}>
            <Input type="url" inputMode="url" placeholder="https://" value={brand.emailLogoUrl} maxLength={brandingLimits.logoUrl} autoComplete="off" spellCheck={false} autoCapitalize="none"
              disabled={disabled} onChange={event => changeBrand("emailLogoUrl", event.target.value)} />
          </FormField></div>
        </div>
        <EmailPreview brand={brand} />
      </Surface>
      {/* A quiénes se aplican, en la (i) del título; que la vista previa es el borrador se ve, y el contraste no se explica. */}
      <Surface title={t("appearance.colors")} help={t("appearance.hint")} padded actions={<Button variant="outline" disabled={disabled} onClick={() => { setDraft(initialAppearance); setErrors(previous => Object.fromEntries(Object.entries(previous).filter(([key]) => !key.startsWith("appearance.")))); }}>{t("appearance.reset")}</Button>}>
        <div className="grid max-w-3xl gap-5 sm:grid-cols-2">{fields.map(field => <FormField key={field} label={t(`appearance.fields.${field}`)} hint={draft[field].toUpperCase()} error={errors[`appearance.${field}`] || undefined}>
          <Input type="color" value={draft[field]} disabled={disabled} onChange={event => { setDraft(previous => ({ ...previous, [field]: event.target.value })); setErrors(previous => ({ ...previous, [`appearance.${field}`]: "" })); }} />
        </FormField>)}</div>
      </Surface>
      <AppearancePreview appearance={draft} labels={{ title: t("appearance.preview"), home: t("common:navigation.dashboard"), administration: t("common:navigation.administration"), name: t("appearance.name"), role: t("appearance.role"), search: t("appearance.search"), newUser: t("appearance.newUser") }} />
      {review ? <Surface title={t("review.title")} titleRef={reviewTitle} padded actions={<><Button variant="outline" disabled={disabled} onClick={() => acceptReview(false)}>{t("review.useCurrent")}</Button><Button disabled={disabled} onClick={() => acceptReview(true)}>{t("review.keepMine")}</Button></>}>
        <DataTable columns={[{ sortable: false, id: "setting", header: t("review.setting"), cell: row => row.label },
          { sortable: false, id: "current", header: t("review.current"), cell: row => row.current },
          { sortable: false, id: "mine", header: t("review.mine"), cell: row => row.mine }]} rows={reviewRows} rowKey={row => row.key} />
      </Surface> : null}
    </div>
    <ConfirmDialog open={guard.isBlocked} onOpenChange={open => { if (!open) guard.stay(); }} title={t("common:unsavedChanges.title")} description={t("common:unsavedChanges.description")} confirmLabel={t("common:unsavedChanges.confirm")} cancelLabel={t("common:unsavedChanges.cancel")} onConfirm={guard.leave} />
  </Page>;
}

/// «Así llega»: el remitente, el asunto de un código y el encabezado del correo, con el logo o, sin él (o si no carga), el nombre.
function EmailPreview({ brand }: { brand: BrandingDraft }) {
  const { t } = useTranslation("settings");
  const [failedLogo, setFailedLogo] = useState<string>();
  const appName = brand.appName.trim() || t("appearance.brandFields.appName");
  const logo = brand.emailLogoUrl.trim();
  const showLogo = logo !== "" && isLogoUrl(logo) && failedLogo !== logo;
  return <div className="flex max-w-3xl flex-col gap-1.5">
    <p className="text-sm text-[var(--color-content-muted)]">{t("appearance.emailPreview")}</p>
    <div className="overflow-hidden rounded-[var(--radius-control)] border border-[var(--color-border)]">
      <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-1 border-b border-[var(--color-border)] px-3 py-2 text-sm">
        <dt className="text-[var(--color-content-muted)]">{t("appearance.emailFrom")}</dt><dd className="min-w-0 truncate">{brand.emailSenderName.trim()}</dd>
        <dt className="text-[var(--color-content-muted)]">{t("appearance.emailSubject")}</dt><dd className="min-w-0 truncate">{t("appearance.emailSubjectSample", { code: "123456", app: appName })}</dd>
      </dl>
      <div className="px-3 py-3">{showLogo
        ? <img src={logo} alt={appName} className="block h-8 w-auto max-w-full" onError={() => setFailedLogo(logo)} />
        : <p className="text-lg font-bold">{appName}</p>}</div>
    </div>
  </div>;
}
