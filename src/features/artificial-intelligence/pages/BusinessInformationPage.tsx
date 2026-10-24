import { useQuery } from "@tanstack/react-query";
import { useState, type ChangeEvent } from "react";
import { useTranslation } from "react-i18next";
import { Navigate } from "react-router";
import { usePermissions } from "@/auth/usePermissions";
import { useSystemPresentation } from "@/shared/api/presentation";
import { ApiError } from "@/shared/api/ApiError";
import { Button } from "@/shared/ui/button";
import { ConfirmDialog } from "@/shared/ui/ConfirmDialog";
import { EmptyState } from "@/shared/ui/EmptyState";
import { FormField } from "@/shared/ui/FormField";
import { Input } from "@/shared/ui/input";
import { Page } from "@/shared/ui/Page";
import { Skeleton } from "@/shared/ui/skeleton";
import { Spinner } from "@/shared/ui/Spinner";
import { Surface } from "@/shared/ui/Surface";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableRowHeader } from "@/shared/ui/table";
import { Textarea } from "@/shared/ui/textarea";
import { businessInformationQueryKey, fetchBusinessInformation, type BusinessInformation } from "../api/businessInformation";
import { businessFields, businessDetailFields, businessLimits, type BusinessField } from "../businessInformationModel";
import { emptyBusinessDetails, mapLink, validPoint } from "../businessDetailsModel";
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
  const { t } = useTranslation("businessInformation");
  const presentation = useSystemPresentation();
  const editor = useBusinessInformationEditor(initial);
  const [discarding, setDiscarding] = useState(false);
  const locked = editor.busy || editor.recovery !== "none";
  const uncertain = editor.recovery === "uncertain" || editor.recovery === "missing";
  const details = editor.draft.details ?? emptyBusinessDetails(presentation.data?.defaultTimeZoneId ?? "UTC");
  const reviewFields = [...businessFields, ...businessDetailFields];
  function reviewText(name: typeof reviewFields[number], value: BusinessInformation) {
    if (name === "details.location") { const location = value.details?.location; return location ? [t(location.mode), location.address, location.reference, location.area, validPoint(location.latitude, location.longitude) ? mapLink({ latitude: location.latitude!, longitude: location.longitude! }) : ""].filter(Boolean).join("\n") : ""; }
    if (name === "details.openingHours") { const hours = value.details?.openingHours; return hours ? [hours.timeZoneId, ...hours.days.map(day => `${t(`days.${["monday","tuesday","wednesday","thursday","friday","saturday","sunday"][day.weekday]}`)}: ${t(day.status)} ${day.periods.map(period => `${period.start}–${period.end}${period.nextDay ? " (+1)" : ""}`).join(", ")}`), ...hours.exceptions.map(day => `${day.date}: ${t(day.status)} ${day.periods.map(period => `${period.start}–${period.end}${period.nextDay ? " (+1)" : ""}`).join(", ")}`)].join("\n") : ""; }
    if (name === "details.faq") return value.details?.faq.map(entry => `${entry.question}\n${entry.answer || t("unanswered")}`).join("\n\n") ?? "";
    return value[name];
  }
  function legacy(name: "hours" | "location" | "faq") {
    return editor.draft[name] || editor.baseline[name] ? <div className="space-y-2 border-t border-[var(--color-border)] pt-3"><p className="text-xs text-[var(--color-content-muted)]">{t("legacyHint")}</p>{field(name, true)}</div> : null;
  }
  function field(name: BusinessField, multiline = false) {
    const props = { id: `business-${name}`, value: editor.draft[name], maxLength: businessLimits[name], readOnly: !canManage,
      disabled: locked, placeholder: t(`${name}Placeholder`), onChange: (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => editor.change({ [name]: event.target.value }) };
    return <FormField label={t(name)} hint={t(`${name}Hint`)} error={editor.errors[name]} required={name === "name"}>
      {multiline ? <Textarea {...props} rows={name === "faq" ? 4 : 2} /> : <Input {...props} />}
    </FormField>;
  }
  // El estado es el del objeto (sólo lectura o un guardado por revisar): Guardar habilitado ya dice que hay cambios.
  return <Page title={t("title")} status={!canManage || uncertain ? <span className="text-xs text-[var(--color-content-muted)]">{t(!canManage ? "readonly" : "pending")}</span> : undefined}
    actions={canManage ? <><Button variant="outline" disabled={!editor.changed || locked} onClick={() => setDiscarding(true)}>{t("discard")}</Button>
      <Button disabled={!editor.changed || locked} onClick={() => void editor.save()}>{editor.busy ? <Spinner decorative /> : null}{t(editor.busy ? "saving" : "save")}</Button></> : undefined}>
    <div className="flex flex-col gap-5">
      <p className="max-w-3xl text-sm text-[var(--color-content-muted)]">{t(!canManage ? "readonlyHint" : "intro")}</p>
      {/* El cuerpo explica el estado del guardado; revisar, reintentar y elegir van en la banda. */}
      {editor.recovery !== "none" ? <Surface title={t(editor.recovery === "conflict" ? "reviewTitle" : "pending")} padded actions={<>
        <Button variant="outline" disabled={editor.busy} onClick={() => void editor.recover()}>{t(editor.recovery === "conflict" ? "review" : "verify")}</Button>
        {editor.recovery === "missing" ? <Button disabled={editor.busy} onClick={() => void editor.save(true)}>{t("retrySame")}</Button> : null}
        {editor.review ? <><Button variant="outline" disabled={editor.busy} onClick={() => editor.acceptReview(false)}>{t("useCurrent")}</Button>
          <Button disabled={editor.busy} onClick={() => editor.acceptReview(true)}>{t("keepMine")}</Button></> : null}
      </>}>
        <p className="max-w-3xl text-sm">{t(editor.recovery === "conflict" ? "conflictMessage" : editor.recovery === "missing" ? "missingReceipt" : "uncertainHint")}</p>
        {editor.review ? <>
          <p className="text-sm text-[var(--color-content-muted)]">{t("reviewHint")}</p>
          <Table><TableHeader><TableRow><TableHead scope="col">{t("field")}</TableHead><TableHead scope="col" className="whitespace-normal">{t("current")}</TableHead><TableHead scope="col" className="whitespace-normal">{t("mine")}</TableHead></TableRow></TableHeader>
            <TableBody>{reviewFields.filter(name => editor.review && reviewText(name, editor.review) !== reviewText(name, { ...editor.draft, revision: editor.baseline.revision })).map(name => <TableRow key={name}>
              <TableRowHeader className="whitespace-normal">{t(name === "details.location" ? "locationSection" : name === "details.openingHours" ? "hoursSection" : name === "details.faq" ? "answers" : name)}</TableRowHeader><TableCell className="min-w-48 max-w-sm whitespace-pre-wrap break-words">{editor.review && reviewText(name, editor.review) || t("noValue")}</TableCell><TableCell className="min-w-48 max-w-sm whitespace-pre-wrap break-words">{reviewText(name, { ...editor.draft, revision: editor.baseline.revision }) || t("noValue")}</TableCell>
            </TableRow>)}</TableBody>
          </Table>
        </> : null}
      </Surface> : null}
      <Surface title={t("basics")} padded><div className="grid gap-4 sm:grid-cols-2">{field("name")}{field("description", true)}</div></Surface>
      <div className="grid items-start gap-5 xl:grid-cols-2">
        <BusinessLocationEditor value={details.location} onChange={location => editor.change({ details: { ...details, location } })} editable={canManage} locked={locked} error={editor.errors["details.location"]} legacy={legacy("location")} />
        <BusinessHoursEditor value={details.openingHours} onChange={openingHours => editor.change({ details: { ...details, openingHours } })} editable={canManage} locked={locked} error={editor.errors["details.openingHours"]} legacy={legacy("hours")} />
      </div>
      <Surface title={t("offering")} padded><div className="grid gap-4 sm:grid-cols-2">{field("services", true)}{field("policies", true)}</div></Surface>
      <BusinessFaqEditor value={details.faq} onChange={faq => editor.change({ details: { ...details, faq } })} editable={canManage} locked={locked} error={editor.errors["details.faq"]} legacy={legacy("faq")} />
      <p className="max-w-3xl text-xs text-[var(--color-content-muted)]">{t("limitsHint")}</p>
    </div>
    <ConfirmDialog open={discarding} onOpenChange={setDiscarding} title={t("discardTitle")} description={t("discardHint")} confirmLabel={t("discard")} cancelLabel={t("stay")} onConfirm={editor.discard} />
    <ConfirmDialog open={editor.guard.isBlocked} onOpenChange={open => { if (!open) editor.guard.stay(); }} title={t(uncertain ? "uncertainLeaveTitle" : "discardTitle")} description={t(uncertain ? "uncertainLeaveHint" : "discardHint")} confirmLabel={t(uncertain ? "leave" : "discard")} cancelLabel={t("stay")} onConfirm={editor.guard.leave} />
  </Page>;
}
