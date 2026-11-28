import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router";
import { useRereadAfterForbidden } from "@/auth/useRereadAfterForbidden";
import { ForbiddenPage } from "@/shared/ui/ForbiddenPage";
import { fetchSystemSettings, removeBrandImage, systemSettingsQueryKey, updateSystemSettings, uploadBrandImage, type SystemSettings } from "../api/settings";
import { brandImageFileIssue, brandImageTypes, brandingChanged, brandingDraftFrom, brandingFields, brandingFrom, brandingIssues, brandingLimits, type BrandingDraft, type BrandingField } from "../model";
import { ApiError } from "@/shared/api/ApiError";
import { errorFeedback } from "@/shared/api/errorFeedback";
import { brandImageUrl, presentationQueryKey, type BrandImageKind, type SystemPresentation } from "@/shared/api/presentation";
import { appearanceColors, appearanceFonts, appearanceRoles, contrastRatio, fontFamilies, initialAppearance, isAppearanceRole, loadFont, minimumMenuAccentContrast, sameAppearance, type AppearanceFont, type AppearanceRole, type SystemAppearance } from "@/shared/lib/appearance";
import { appearanceColorsOf, appearanceRoleGroups, unreadableRoles, type AppearanceRoleGroup } from "@/shared/lib/appearanceRoles";
import { useUnsavedChangesGuard } from "@/shared/hooks/useUnsavedChangesGuard";
import { AppearancePreview } from "@/shared/ui/AppearancePreview";
import { Button } from "@/shared/ui/button";
import { DisabledReason } from "@/shared/ui/DisabledReason";
import { ConfirmDialog } from "@/shared/ui/ConfirmDialog";
import { DataTable } from "@/shared/ui/DataTable";
import { EmptyState } from "@/shared/ui/EmptyState";
import { FormField } from "@/shared/ui/FormField";
import { BrandImageField } from "@/shared/ui/BrandImageField";
import { PieceColors } from "@/shared/ui/PieceColors";
import { Input } from "@/shared/ui/input";
import { Page } from "@/shared/ui/Page";
import { Picker } from "@/shared/ui/Picker";
import { FormSkeleton } from "@/shared/ui/FormSkeleton";
import { Surface } from "@/shared/ui/Surface";
import { dismissNotification, notify } from "@/shared/ui/notifications";

const errorKeys = [...appearanceColors.map(field => `appearance.${field}`), "appearance.font", ...appearanceRoles.map(role => `appearance.overrides.${role}`),
  ...brandingFields.map(field => `branding.${field}`)];
const groupIds = Object.keys(appearanceRoleGroups) as AppearanceRoleGroup[];
const pieceErrorPrefix = "appearance.overrides.";
/// ME10: the groups with an own piece, or with a piece whose color has a problem, open; the rest stay folded.
const groupsOf = (keys: Iterable<string>) => new Set(groupIds.filter(group => [...keys].some(key =>
  (appearanceRoleGroups[group] as readonly string[]).includes(key.startsWith(pieceErrorPrefix) ? key.slice(pieceErrorPrefix.length) : key))));

export function AppearancePage() {
  const { t } = useTranslation("settings");
  const query = useQuery({ queryKey: systemSettingsQueryKey, queryFn: fetchSystemSettings, refetchOnMount: "always" });
  const [initial, setInitial] = useState<SystemSettings>();
  if (initial === undefined && query.isFetchedAfterMount && query.isSuccess && !query.isFetching) setInitial(query.data);
  if (query.error instanceof ApiError && query.error.status === 403) return <ForbiddenPage title={t("appearance.title")} />;
  if (initial) return <AppearanceEditor initial={initial} />;
  return <Page title={t("appearance.title")}>{query.isFetching || query.isPending ? <FormSkeleton zones={[{ fields: 4 }, { fields: 6 }, { rows: 3 }]} />
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
  const [imageErrors, setImageErrors] = useState<Partial<Record<BrandImageKind, string>>>({});
  const [removing, setRemoving] = useState<BrandImageKind | null>(null);
  const [needsReview, setNeedsReview] = useState(false);
  const [openGroups, setOpenGroups] = useState(() => groupsOf(Object.keys(initial.appearance.overrides)));
  const [review, setReview] = useState<SystemSettings>();
  const [reading, setReading] = useState(false);
  const active = useRef(true);
  const reviewTitle = useRef<HTMLHeadingElement>(null);
  const noticeId = "settings:appearance";
  useEffect(() => { active.current = true; return () => { active.current = false; dismissNotification(noticeId); }; }, []);
  // Revisar está en la banda y la comparación aparece después de los colores y la vista previa: cada lectura lleva el
  // foco a su título, que la deja a la vista y pone las elecciones en el siguiente Tab.
  useEffect(() => { if (review) reviewTitle.current?.focus(); }, [review]);
  // ME4: la vista previa se dibuja con la letra elegida, que se baja la primera vez.
  useEffect(() => { void loadFont(draft.font); }, [draft.font]);
  const colorsChanged = !sameAppearance(draft, baseline.appearance);
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
  // Un conflicto o un resultado incierto, al guardar o al subir: se conserva el borrador y se pide revisar.
  function reportWriteFailure(feedback: ReturnType<typeof errorFeedback>, failed: string) {
    const uncertain = feedback.kind === "uncertain", conflict = feedback.kind === "conflict";
    if (active.current && (uncertain || conflict)) setNeedsReview(true);
    notify({ id: noticeId, kind: "error", message: uncertain ? t("feedback.uncertain") : conflict ? t("feedback.conflict") : failed,
      description: conflict ? undefined : feedback.traceId ? t("errorTraceId", { traceId: feedback.traceId }) : feedback.detail,
      action: uncertain || conflict ? { label: t("review.action"), onClick: () => { if (active.current) void readCurrent(); else void navigate("/configuracion/apariencia"); } } : undefined });
  }
  function publishSaved(saved: SystemSettings) {
    client.setQueryData(systemSettingsQueryKey, saved);
    client.setQueryData<SystemPresentation>(presentationQueryKey, previous => previous ? { ...previous, appearance: saved.appearance,
      brand: { appName: saved.branding.appName, logoVersion: saved.branding.logoVersion, iconVersion: saved.branding.iconVersion } } : previous);
    void client.invalidateQueries({ queryKey: systemSettingsQueryKey });
    void client.invalidateQueries({ queryKey: presentationQueryKey });
  }
  const mutation = useMutation({
    // RC6-B: el nombre y el remitente se guardan con los colores y la letra, en el mismo pedido y con la misma revisión; viaja
    // sólo lo que cambió.
    mutationFn: ({ appearance, branding, revision }: { appearance?: SystemAppearance; branding?: BrandingDraft; revision: number }) =>
      updateSystemSettings({ ...(appearance ? { appearance } : {}), ...(branding ? { branding: brandingFrom(branding) } : {}) }, revision),
    onSuccess: (_, variables) => {
      const saved = { ...baseline, appearance: variables.appearance ?? baseline.appearance,
        branding: variables.branding ? { ...baseline.branding, ...brandingFrom(variables.branding) } : baseline.branding, revision: variables.revision + 1 };
      if (active.current) { setBaseline(saved); setDraft(saved.appearance); setBrand(brandingDraftFrom(saved.branding)); setNeedsReview(false); setReview(undefined); }
      publishSaved(saved);
      notify({ id: noticeId, kind: "success", message: t(variables.branding ? "appearance.savedAll" : "appearance.saved") });
    },
    onError: error => {
      const feedback = errorFeedback(error, { writing: true, fields: errorKeys, conflictCodes: ["Settings.System.RevisionConflict"] });
      if (feedback.kind === "session") return;
      if (active.current && feedback.kind === "forbidden") { reread(); return; }
      if (active.current) {
        setErrors(Object.fromEntries(Object.entries(feedback.fields).map(([field, messages]) => [field, messages.join(" ")])));
        openGroupsOf(Object.keys(feedback.fields));
      }
      if (feedback.kind === "fields" && active.current) return;
      reportWriteFailure(feedback, t("appearance.failed"));
    },
  });
  // ME2b: el logo y el ícono se guardan al subirlos o quitarlos, con la revisión leída; el resto del borrador queda como estaba.
  const imageMutation = useMutation({
    mutationFn: ({ kind, file, revision }: { kind: BrandImageKind; file: File | null; revision: number }) =>
      file ? uploadBrandImage(kind, file, revision) : removeBrandImage(kind, revision),
    onSuccess: (result, { kind, file }) => {
      const version = kind === "logo" ? "logoVersion" : "iconVersion";
      const saved = { ...baseline, revision: result.revision, branding: { ...baseline.branding, [version]: result.version } };
      if (active.current) { setBaseline(saved); setRemoving(null); setImageErrors(previous => ({ ...previous, [kind]: undefined })); }
      publishSaved(saved);
      notify({ id: noticeId, kind: "success", message: t(file ? `appearance.imageSaved.${kind}` : `appearance.imageRemoved.${kind}`) });
    },
    onError: (error, { kind }) => {
      if (active.current) setRemoving(null);
      const feedback = errorFeedback(error, { writing: true, fields: ["file"], conflictCodes: ["Settings.System.RevisionConflict"] });
      if (feedback.kind === "session") return;
      if (active.current && feedback.kind === "forbidden") { reread(); return; }
      if (feedback.kind === "fields") { if (active.current) setImageErrors(previous => ({ ...previous, [kind]: feedback.fields.file?.join(" ") })); return; }
      reportWriteFailure(feedback, t(`appearance.imageFailed.${kind}`));
    },
  });
  const guard = useUnsavedChangesGuard(dirty && !mutation.isPending);
  const disabled = mutation.isPending || reading || imageMutation.isPending;
  const uploading = imageMutation.isPending && imageMutation.variables?.file ? imageMutation.variables.kind : null;
  function changeBrand(field: BrandingField, value: string) {
    setBrand(previous => ({ ...previous, [field]: value }));
    setErrors(previous => ({ ...previous, [`branding.${field}`]: "" }));
  }
  function changeAppearance(next: Partial<SystemAppearance>) {
    setDraft(previous => ({ ...previous, ...next }));
    setErrors(previous => Object.fromEntries(Object.entries(previous).filter(([key]) => !Object.keys(next).some(field => key === `appearance.${field}`))));
  }
  function openGroupsOf(keys: Iterable<string>) {
    const groups = groupsOf(keys);
    if (groups.size > 0) setOpenGroups(previous => new Set([...previous, ...groups]));
  }
  // ME10: a piece changed by hand is own; ↺ returns it to automatic.
  function changePiece(role: string, color: string) {
    if (!isAppearanceRole(role)) return;
    setDraft(previous => ({ ...previous, overrides: { ...previous.overrides, [role]: color.toUpperCase() } }));
    setErrors(previous => ({ ...previous, [`${pieceErrorPrefix}${role}`]: "" }));
  }
  function resetPieces(roles: readonly string[]) {
    setDraft(previous => ({ ...previous, overrides: Object.fromEntries(Object.entries(previous.overrides).filter(([key]) => !roles.includes(key))) }));
    setErrors(previous => Object.fromEntries(Object.entries(previous).filter(([key]) => !roles.some(role => key === `${pieceErrorPrefix}${role}`))));
  }
  function upload(kind: BrandImageKind, file: File | undefined) {
    if (!file) return;
    if (brandImageFileIssue(kind, file)) { setImageErrors(previous => ({ ...previous, [kind]: t(`appearance.fileIssue.${kind}`, { name: file.name }) })); return; }
    setImageErrors(previous => ({ ...previous, [kind]: undefined }));
    imageMutation.mutate({ kind, file, revision: baseline.revision });
  }
  // Cada cuadro dice su problema antes de mandar nada; el servidor valida lo mismo.
  function save() {
    const issues: [string, string][] = Object.entries(brandingIssues(brand)).map(([field, issue]) =>
      [`branding.${field}`, t(`appearance.issues.${issue}`, { max: brandingLimits.name })]);
    if (colorsChanged && contrastRatio(draft.menuAccentColor, draft.menuColor) < minimumMenuAccentContrast)
      issues.push(["appearance.menuAccentColor", t("appearance.issues.accentContrast")]);
    if (colorsChanged) for (const role of Object.keys(unreadableRoles(draft)))
      issues.push([`${pieceErrorPrefix}${role}`, t("appearance.issues.pieceContrast")]);
    setErrors(Object.fromEntries(issues));
    openGroupsOf(issues.map(([key]) => key));
    if (issues.length > 0) return;
    mutation.mutate({ appearance: colorsChanged ? draft : undefined, branding: brandChanged ? brand : undefined, revision: baseline.revision });
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
  // ME10: the own pieces of a palette, by name and code, for the review of a conflict.
  const ownPieces = (appearance: SystemAppearance) => Object.entries(appearance.overrides).filter(([role]) => isAppearanceRole(role))
    .map(([role, color]) => `${t(`appearance.pieces.roles.${role as AppearanceRole}`)} ${color.toUpperCase()}`).join(", ") || t("appearance.pieces.none");
  const reviewRows = [...brandingFields.map(field => ({ key: field, label: t(`appearance.brandFields.${field}`),
    current: review ? brandingDraftFrom(review.branding)[field].trim() : "", mine: brand[field].trim() })),
    ...appearanceColors.map(field => ({ key: field, label: t(`appearance.fields.${field}`), current: review?.appearance[field].toUpperCase() ?? "", mine: draft[field].toUpperCase() })),
    { key: "font", label: t("appearance.font"), current: review ? fontFamilies[review.appearance.font] : "", mine: fontFamilies[draft.font] },
    { key: "overrides", label: t("appearance.pieces.title"), current: review ? ownPieces(review.appearance) : "", mine: ownPieces(draft) }];
  const { color: pieceColor } = appearanceColorsOf(draft);
  const pieceGroups = groupIds.map(group => {
    const rows = appearanceRoleGroups[group].map(role => ({ key: role, label: t(`appearance.pieces.roles.${role}`), color: pieceColor(role),
      own: Object.hasOwn(draft.overrides, role), error: errors[`${pieceErrorPrefix}${role}`] || undefined }));
    const own = rows.filter(row => row.own).length;
    return { id: group, title: t(`appearance.pieces.groups.${group}`), rows,
      summary: own > 0 ? t("appearance.pieces.summaryOwn", { count: own, total: rows.length }) : t("appearance.pieces.summaryNone", { count: rows.length }) };
  });
  const appName = brand.appName.trim() || baseline.branding.appName;
  const logoUrl = baseline.branding.logoVersion ? brandImageUrl("logo", baseline.branding.logoVersion) : null;
  const iconUrl = baseline.branding.iconVersion ? brandImageUrl("icon", baseline.branding.iconVersion) : null;
  return <Page title={t("appearance.title")}
    actions={<>{needsReview ? <Button variant="outline" pending={reading} disabled={disabled} onClick={() => void readCurrent()}>{t(reading ? "review.reading" : "review.action")}</Button> : null}
      <DisabledReason reason={reviewReason}><Button variant="outline" disabled={!dirty || disabled || needsReview} onClick={() => { setDraft(baseline.appearance); setBrand(brandingDraftFrom(baseline.branding)); setErrors({}); dismissNotification(noticeId); }}>{t("discard")}</Button></DisabledReason>
      <DisabledReason reason={reviewReason}><Button pending={mutation.isPending} disabled={!dirty || disabled || needsReview} onClick={save}>{t(mutation.isPending ? "saving" : "save")}</Button></DisabledReason></>}>
    <div className="flex flex-col gap-5">
      {/* ME2: la marca arriba de los colores. Dónde aparecen el logo y el ícono va en la (i) del título, qué pide cada archivo en
          la suya; los dos se guardan al subirlos, el nombre y el remitente con Guardar. «Así llega» se arma con el borrador. */}
      <Surface title={t("appearance.brand")} help={t("appearance.brandHint")} padded>
        <div className="grid max-w-3xl gap-5 sm:grid-cols-2">
          {(["logo", "icon"] as const).map(kind => <BrandImageField key={kind} shape={kind === "logo" ? "wide" : "square"}
            url={kind === "logo" ? logoUrl : iconUrl} fallback={kind === "logo" ? appName : undefined} background={draft.menuColor}
            accept={brandImageTypes[kind]} uploading={uploading === kind} disabled={disabled} error={imageErrors[kind]}
            labels={{ label: t(`appearance.${kind}`), help: t(`appearance.${kind}Hint`), helpLabel: t("common:actions.moreInfo", { label: t(`appearance.${kind}`) }),
              upload: t(`appearance.upload.${kind}`), uploadOther: t("appearance.uploadOther"), uploading: t("appearance.uploading"),
              remove: t(`appearance.remove.${kind}`), current: t(`appearance.current.${kind}`, { name: appName }) }}
            onFile={file => upload(kind, file)} onRemove={() => setRemoving(kind)} />)}
          <FormField label={t("appearance.brandFields.appName")} required error={errors["branding.appName"] || undefined}>
            <Input value={brand.appName} maxLength={brandingLimits.name} autoComplete="off" disabled={disabled} onChange={event => changeBrand("appName", event.target.value)} />
          </FormField>
          <FormField label={t("appearance.brandFields.emailSenderName")} help={t("appearance.senderHint")} required error={errors["branding.emailSenderName"] || undefined}>
            <Input value={brand.emailSenderName} maxLength={brandingLimits.name} autoComplete="off" disabled={disabled} onChange={event => changeBrand("emailSenderName", event.target.value)} />
          </FormField>
        </div>
        <EmailPreview brand={brand} logoUrl={logoUrl} />
      </Surface>
      {/* A quiénes se aplican, en la (i) del título; que la vista previa es el borrador se ve, y el contraste no se explica. */}
      <Surface title={t("appearance.colors")} help={t("appearance.hint")} padded actions={<Button variant="outline" disabled={disabled} onClick={() => { setDraft(previous => ({ ...initialAppearance, overrides: previous.overrides })); setErrors(previous => Object.fromEntries(Object.entries(previous).filter(([key]) => !key.startsWith("appearance.")))); }}>{t("appearance.reset")}</Button>}>
        <div className="grid max-w-3xl gap-5 sm:grid-cols-2">
          {appearanceColors.map(field => <FormField key={field} label={t(`appearance.fields.${field}`)} help={field === "menuAccentColor" ? t("appearance.accentHint") : undefined}
            hint={draft[field].toUpperCase()} error={errors[`appearance.${field}`] || undefined}>
            <Input type="color" value={draft[field]} disabled={disabled} onChange={event => changeAppearance({ [field]: event.target.value })} />
          </FormField>)}
          <FormField label={t("appearance.font")} help={t("appearance.fontHint")} error={errors["appearance.font"] || undefined}>
            <Picker label={t("appearance.font")} value={draft.font} disabled={disabled}
              options={appearanceFonts.map(font => ({ id: font, label: fontFamilies[font] }))}
              onChange={font => changeAppearance({ font: font as AppearanceFont })} />
          </FormField>
        </div>
      </Surface>
      {/* ME10: cada pieza sale de los colores básicos hasta que se le pone uno propio; los grupos con propios quedan abiertos. */}
      <Surface title={t("appearance.pieces.title")} help={t("appearance.pieces.hint")}
        actions={<Button variant="outline" disabled={disabled || Object.keys(draft.overrides).length === 0} onClick={() => resetPieces(Object.keys(draft.overrides))}>{t("appearance.pieces.allAutomatic")}</Button>}>
        <PieceColors groups={pieceGroups} open={openGroups} disabled={disabled}
          onOpenChange={(group, open) => setOpenGroups(previous => { const next = new Set(previous); if (open) next.add(group as AppearanceRoleGroup); else next.delete(group as AppearanceRoleGroup); return next; })}
          onChange={changePiece} onReset={role => resetPieces([role])}
          labels={{ piece: t("appearance.pieces.piece"), color: t("appearance.pieces.color"), origin: t("appearance.pieces.origin"), actions: t("appearance.pieces.actions"),
            automatic: t("appearance.pieces.automatic"), own: t("appearance.pieces.own"), reset: t("appearance.pieces.reset"),
            resetPiece: piece => t("appearance.pieces.resetPiece", { piece }), colorOf: piece => t("appearance.pieces.colorOf", { piece }),
            expand: group => t("appearance.pieces.expand", { group }), collapse: group => t("appearance.pieces.collapse", { group }) }} />
      </Surface>
      <AppearancePreview appearance={draft} brand={{ appName, logoUrl }} labels={{ title: t("appearance.preview"), home: t("common:navigation.dashboard"), administration: t("common:navigation.administration"), name: t("appearance.name"), role: t("appearance.role"), search: t("appearance.search"), newUser: t("appearance.newUser"),
        users: t("appearance.sample.users"), roles: t("appearance.sample.roles"), export: t("appearance.sample.export"), filters: t("appearance.sample.filters"),
        success: t("appearance.sample.success"), warning: t("appearance.sample.warning"), danger: t("appearance.sample.danger") }} />
      {review ? <Surface title={t("review.title")} titleRef={reviewTitle} padded actions={<><Button variant="outline" disabled={disabled} onClick={() => acceptReview(false)}>{t("review.useCurrent")}</Button><Button disabled={disabled} onClick={() => acceptReview(true)}>{t("review.keepMine")}</Button></>}>
        <DataTable columns={[{ sortable: false, id: "setting", header: t("review.setting"), cell: row => row.label },
          { sortable: false, id: "current", header: t("review.current"), cell: row => row.current },
          { sortable: false, id: "mine", header: t("review.mine"), cell: row => row.mine }]} rows={reviewRows} rowKey={row => row.key} />
      </Surface> : null}
    </div>
    <ConfirmDialog open={guard.isBlocked} onOpenChange={open => { if (!open) guard.stay(); }} title={t("common:unsavedChanges.title")} description={t("common:unsavedChanges.description")} confirmLabel={t("common:unsavedChanges.confirm")} cancelLabel={t("common:unsavedChanges.cancel")} onConfirm={guard.leave} />
    <ConfirmDialog open={removing !== null} onOpenChange={open => { if (!open && !imageMutation.isPending) setRemoving(null); }} destructive
      title={removing ? t(`appearance.removeTitle.${removing}`) : ""} description={removing ? t(`appearance.removeDescription.${removing}`) : ""}
      confirmLabel={removing ? t(`appearance.removeConfirm.${removing}`) : ""} cancelLabel={t("common:actions.cancel")}
      pending={imageMutation.isPending && !imageMutation.variables?.file}
      onConfirm={() => { if (removing) imageMutation.mutate({ kind: removing, file: null, revision: baseline.revision }); }} />
  </Page>;
}

/// «Así llega»: el remitente, el asunto de un código y el encabezado del correo, con el logo subido o, sin él (o si no carga), el nombre.
function EmailPreview({ brand, logoUrl }: { brand: BrandingDraft; logoUrl: string | null }) {
  const { t } = useTranslation("settings");
  const [failedLogo, setFailedLogo] = useState<string>();
  const appName = brand.appName.trim() || t("appearance.brandFields.appName");
  const showLogo = logoUrl !== null && failedLogo !== logoUrl;
  return <div className="flex max-w-3xl flex-col gap-1.5">
    <p className="text-sm text-[var(--color-content-muted)]">{t("appearance.emailPreview")}</p>
    <div className="overflow-hidden rounded-[var(--radius-control)] border border-[var(--color-border)]">
      <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-1 border-b border-[var(--color-border)] px-3 py-2 text-sm">
        <dt className="text-[var(--color-content-muted)]">{t("appearance.emailFrom")}</dt><dd className="min-w-0 truncate">{brand.emailSenderName.trim()}</dd>
        <dt className="text-[var(--color-content-muted)]">{t("appearance.emailSubject")}</dt><dd className="min-w-0 truncate">{t("appearance.emailSubjectSample", { code: "123456", app: appName })}</dd>
      </dl>
      <div className="px-3 py-3">{showLogo
        ? <img src={logoUrl} alt={appName} className="block h-8 w-auto max-w-full" onError={() => setFailedLogo(logoUrl)} />
        : <p className="text-lg font-bold">{appName}</p>}</div>
    </div>
  </div>;
}
