import { useQuery } from "@tanstack/react-query";
import { useState, type ChangeEvent } from "react";
import { useTranslation } from "react-i18next";
import { Navigate } from "react-router";
import { usePermissions } from "@/auth/usePermissions";
import { useSystemPresentation } from "@/shared/api/presentation";
import { ApiError } from "@/shared/api/ApiError";
import { formatDateOnly } from "@/shared/lib/dateTime";
import { Button } from "@/shared/ui/button";
import { ComparisonTable } from "@/shared/ui/ComparisonTable";
import { ConfirmDialog } from "@/shared/ui/ConfirmDialog";
import { EmptyState } from "@/shared/ui/EmptyState";
import { FormField } from "@/shared/ui/FormField";
import { Input } from "@/shared/ui/input";
import { Page } from "@/shared/ui/Page";
import { Skeleton } from "@/shared/ui/skeleton";
import { Surface } from "@/shared/ui/Surface";
import { Textarea } from "@/shared/ui/textarea";
import { businessInformationQueryKey, fetchBusinessInformation, type BusinessInformation } from "../api/businessInformation";
import { businessLimits, businessReviewGroups, type BusinessField } from "../businessInformationModel";
import { emptyBusinessDetails } from "../businessDetailsModel";
import { BusinessLocationEditor } from "../components/BusinessLocationEditor";
import { BusinessHoursEditor } from "../components/BusinessHoursEditor";
import { BusinessFaqEditor } from "../components/BusinessFaqEditor";
import { useBusinessInformationEditor } from "../hooks/useBusinessInformationEditor";

export function BusinessInformationPage() {
  const { t } = useTranslation("businessInformation");
  const permissions = usePermissions();
  const query = useQuery({ queryKey: businessInformationQueryKey, queryFn: ({ signal }) => fetchBusinessInformation(signal), refetchOnMount: "always", retry: false });
  const [initial, setInitial] = useState<BusinessInformation>();
  if (!initial && query.isFetchedAfterMount && query.isSuccess && !query.isFetching) setInitial(query.data);
  if (query.error instanceof ApiError && query.error.status === 403) return <Navigate to="/sin-permiso" replace />;
  if (initial) return <BusinessEditor key={permissions.has("ai.business.manage") ? "manage" : "read"} initial={query.data ?? initial} canManage={permissions.has("ai.business.manage")} />;
  return <Page title={t("title")}>{query.isFetching || query.isPending ? <Skeleton className="h-24" /> :
    <EmptyState title={t("unavailableTitle")} action={<Button variant="outline" onClick={() => void query.refetch()}>{t("retry")}</Button>} />}</Page>;
}

function BusinessEditor({ initial, canManage }: { initial: BusinessInformation; canManage: boolean }) {
  const { t, i18n } = useTranslation("businessInformation");
  const presentation = useSystemPresentation();
  const editor = useBusinessInformationEditor(initial);
  const [discarding, setDiscarding] = useState(false);
  const locked = editor.busy || editor.recovery !== "none";
  const uncertain = editor.recovery === "uncertain" || editor.recovery === "missing";
  const details = editor.draft.details ?? emptyBusinessDetails(presentation.data?.defaultTimeZoneId ?? "UTC");
  // Cada dato que cambió una vez, con lo guardado y tu borrador en su columna (LR2-A); un texto que falta, en gris.
  const reviewGroups = editor.review ? businessReviewGroups(editor.review, { ...editor.draft, revision: editor.baseline.revision }, { t, date: value => formatDateOnly(value, i18n.language) ?? value }) : [];
  const reviewValue = (text: string, single: boolean) => text ? <span className="whitespace-pre-wrap">{text}</span> : <span className="text-[var(--color-content-muted)]">{single ? t("noValue") : "—"}</span>;
  // El texto anterior se conserva para revisarlo; qué es y qué hacer con él va en la (i) de su etiqueta.
  function legacy(name: "hours" | "location" | "faq") {
    return editor.draft[name] || editor.baseline[name] ? <div className="border-t border-[var(--color-border)] pt-3">{field(name, true, t("legacyHint"))}</div> : null;
  }
  function field(name: BusinessField, multiline = false, help?: string) {
    const props = { id: `business-${name}`, value: editor.draft[name], maxLength: businessLimits[name], readOnly: !canManage,
      disabled: locked, placeholder: t(`${name}Placeholder`), onChange: (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => editor.change({ [name]: event.target.value }) };
    return <FormField label={t(name)} help={help} error={editor.errors[name]} required={name === "name"}>
      {multiline ? <Textarea {...props} rows={name === "faq" ? 4 : 2} /> : <Input {...props} />}
    </FormField>;
  }
  // El estado es el del objeto (sólo lectura o un guardado por revisar): Guardar habilitado ya dice que hay cambios. Cada
  // espera se ve en el botón que se tocó: revisar o reintentar no ponen «Guardando…» en Guardar.
  return <Page title={t("title")} status={!canManage || uncertain ? <span className="text-xs text-[var(--color-content-muted)]">{t(!canManage ? "readonly" : "pending")}</span> : undefined}
    actions={canManage ? <><Button variant="outline" disabled={!editor.changed || locked} onClick={() => setDiscarding(true)}>{t("discard")}</Button>
      <Button disabled={!editor.changed || locked} pending={editor.working === "save"} onClick={() => void editor.save()}>{t(editor.working === "save" ? "saving" : "save")}</Button></> : undefined}>
    <div className="flex flex-col gap-5">
      {/* El cuerpo explica el estado del guardado; revisar, reintentar y elegir van en la banda, cada uno con su espera. */}
      {editor.recovery !== "none" ? <Surface title={t(editor.recovery === "conflict" ? "reviewTitle" : "pending")} padded actions={<>
        <Button variant="outline" disabled={editor.busy} pending={editor.working === "recover"} onClick={() => void editor.recover()}>{t(editor.working === "recover" ? "verifying" : editor.recovery === "conflict" ? "review" : "verify")}</Button>
        {editor.recovery === "missing" ? <Button disabled={editor.busy} pending={editor.working === "retry"} onClick={() => void editor.save(true)}>{t(editor.working === "retry" ? "saving" : "retrySame")}</Button> : null}
        {editor.review ? <><Button variant="outline" disabled={editor.busy} onClick={() => editor.acceptReview(false)}>{t("useCurrent")}</Button>
          <Button disabled={editor.busy} onClick={() => editor.acceptReview(true)}>{t("keepMine")}</Button></> : null}
      </>}>
        <p className="max-w-3xl text-sm">{t(editor.recovery === "conflict" ? "conflictMessage" : editor.recovery === "missing" ? "missingReceipt" : "uncertainHint")}</p>
        {editor.review ? <ComparisonTable columns={{ identity: [{ key: "field", header: t("changes") }], label: t("field"), before: t("current"), after: t("mine") }}
          groups={reviewGroups.map(group => ({ key: group.field, identity: [t(group.field === "details.location" ? "locationSection" : group.field === "details.openingHours" ? "hoursSection" : group.field === "details.faq" ? "answers" : group.field)],
            lines: group.lines.map(line => ({ key: line.key, label: line.label, before: reviewValue(line.before, !line.label), after: reviewValue(line.after, !line.label) })) }))} /> : null}
      </Surface> : null}
      {/* El único aviso sobre datos sensibles va en la (i) del título de los datos del negocio. */}
      <Surface title={t("basics")} help={t("limitsHint")} padded><div className="grid gap-4 sm:grid-cols-2">{field("name")}{field("description", true)}</div></Surface>
      <div className="grid items-start gap-5 xl:grid-cols-2">
        <BusinessLocationEditor value={details.location} onChange={location => editor.change({ details: { ...details, location } })} editable={canManage} locked={locked} error={editor.errors["details.location"]} legacy={legacy("location")} />
        <BusinessHoursEditor value={details.openingHours} onChange={openingHours => editor.change({ details: { ...details, openingHours } })} editable={canManage} locked={locked} error={editor.errors["details.openingHours"]} legacy={legacy("hours")} />
      </div>
      <Surface title={t("offering")} padded><div className="grid gap-4 sm:grid-cols-2">{field("services", true)}{field("policies", true)}</div></Surface>
      <BusinessFaqEditor value={details.faq} onChange={faq => editor.change({ details: { ...details, faq } })} editable={canManage} locked={locked} error={editor.errors["details.faq"]} legacy={legacy("faq")} />
    </div>
    <ConfirmDialog open={discarding} onOpenChange={setDiscarding} title={t("discardTitle")} description={t("discardHint")} confirmLabel={t("discard")} cancelLabel={t("stay")} onConfirm={editor.discard} />
    <ConfirmDialog open={editor.guard.isBlocked} onOpenChange={open => { if (!open) editor.guard.stay(); }} title={t(uncertain ? "uncertainLeaveTitle" : "discardTitle")} description={t(uncertain ? "uncertainLeaveHint" : "discardHint")} confirmLabel={t(uncertain ? "leave" : "discard")} cancelLabel={t("stay")} onConfirm={editor.guard.leave} />
  </Page>;
}
