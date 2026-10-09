import { useEffect, useRef, useState, type ChangeEvent } from "react";
import { useTranslation } from "react-i18next";
import { useUnsavedChangesGuard } from "@/shared/hooks/useUnsavedChangesGuard";
import { Button } from "@/shared/ui/button";
import { ConfirmDialog } from "@/shared/ui/ConfirmDialog";
import { EmptyState } from "@/shared/ui/EmptyState";
import { FormField } from "@/shared/ui/FormField";
import { Input } from "@/shared/ui/input";
import { NativeSelect } from "@/shared/ui/NativeSelect";
import { dismissNotification, notify } from "@/shared/ui/notifications";
import { Page } from "@/shared/ui/Page";
import { Spinner } from "@/shared/ui/Spinner";
import { Surface } from "@/shared/ui/Surface";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableRowHeader } from "@/shared/ui/table";
import { Textarea } from "@/shared/ui/textarea";

const scenarios = ["normal", "empty", "loading", "readOnly", "denied", "loadError", "saveError", "conflict", "uncertain", "unresolved"] as const;
type Scenario = typeof scenarios[number];
const fields = ["name", "description", "hours", "location", "services", "policies", "faq"] as const;
type Field = typeof fields[number];
type Information = Record<Field, string>;
const limits: Record<Field, number> = { name: 120, description: 1000, hours: 500, location: 500, services: 2000, policies: 2000, faq: 4000 };
const saveNotice = "business-information-proposal-save";
const loadNotice = "business-information-proposal-load";
const initialInformation: Information = { name: "", description: "", hours: "", location: "", services: "", policies: "", faq: "" };

// Simulation only: no API, storage, provider, or product router is used here.
export function BusinessInformationProposal() {
  const { t } = useTranslation("businessInformationProposal");
  const sample = (): Information => ({ name: t("sampleName"), description: t("sampleDescription"), hours: t("sampleHours"), location: t("sampleLocation"), services: t("sampleServices"), policies: t("samplePolicies"), faq: t("sampleFaq") });
  const [scenario, setScenario] = useState<Scenario>("normal");
  const [saved, setSaved] = useState(sample);
  const [draft, setDraft] = useState(sample);
  const [errors, setErrors] = useState<Partial<Record<Field, string>>>({});
  const [busy, setBusy] = useState<"save" | "review" | null>(null);
  const [uncertain, setUncertain] = useState(false);
  const [conflicting, setConflicting] = useState<Information | null>(null);
  const [discarding, setDiscarding] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const attempted = useRef<Information | null>(null);
  const running = useRef(false);
  const mounted = useRef(true);
  const reviewHeading = useRef<HTMLHeadingElement>(null);
  const dirty = fields.some(field => saved[field] !== draft[field]);
  const restricted = scenario === "readOnly";
  const unavailable = scenario === "loading" || scenario === "loadError" || scenario === "denied";
  const locked = busy !== null || uncertain || conflicting !== null;
  const guard = useUnsavedChangesGuard((dirty || uncertain) && !busy);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      if (timer.current) clearTimeout(timer.current);
      dismissNotification(saveNotice);
      dismissNotification(loadNotice);
    };
  }, []);
  useEffect(() => {
    if (scenario === "loadError") notify({ id: loadNotice, kind: "error", message: t("readFailed") });
  }, [scenario, t]);

  function resetScenario(next: Scenario) {
    if (timer.current) clearTimeout(timer.current);
    running.current = false;
    attempted.current = null;
    setScenario(next);
    const value = next === "empty" ? { ...initialInformation } : sample();
    setSaved(value); setDraft({ ...value }); setErrors({});
    setBusy(null); setUncertain(false); setConflicting(null); setDiscarding(false);
    dismissNotification(saveNotice); dismissNotification(loadNotice);
  }
  function change(field: Field, value: string) {
    setDraft(previous => ({ ...previous, [field]: value }));
    setErrors(previous => ({ ...previous, [field]: undefined }));
  }
  function validate() {
    const next: Partial<Record<Field, string>> = {};
    if (!draft.name.trim()) next.name = t("nameRequired");
    if (fields.filter(field => field !== "name").every(field => !draft[field].trim())) next.description = t("contentRequired");
    for (const field of fields) if (draft[field].length > limits[field]) next[field] = t("tooLong", { count: limits[field] });
    setErrors(next);
    const invalid = fields.find(field => next[field]);
    if (invalid) document.getElementById(`business-${invalid}`)?.focus();
    return invalid === undefined;
  }
  function reviewSave() {
    if (!mounted.current || running.current || !attempted.current) return;
    running.current = true; setBusy("review");
    timer.current = setTimeout(() => {
      running.current = false; setBusy(null);
      if (scenario === "unresolved") {
        notify({ id: saveNotice, kind: "error", message: t("unresolvedMessage"), action: { label: t("verify"), onClick: reviewSave } });
        return;
      }
      // This scenario simulates a confirmed receipt, never equality of two profiles.
      const confirmed = attempted.current;
      if (!confirmed) return;
      setSaved(confirmed); setDraft({ ...confirmed }); setUncertain(false);
      attempted.current = null;
      notify({ id: saveNotice, kind: "success", message: t("confirmed") });
    }, 500);
  }
  function save() {
    if (restricted || locked || running.current || !dirty || !validate()) return;
    running.current = true; setBusy("save");
    const submitted = { ...draft };
    timer.current = setTimeout(() => {
      running.current = false; setBusy(null);
      if (scenario === "saveError") {
        notify({ id: saveNotice, kind: "error", message: t("saveFailed") });
      } else if (scenario === "conflict") {
        setConflicting({ ...saved, hours: t("otherHours"), location: t("otherLocation") });
        notify({ id: saveNotice, kind: "error", message: t("conflictMessage"), action: { label: t("review"), onClick: () => reviewHeading.current?.focus() } });
      } else if (scenario === "uncertain" || scenario === "unresolved") {
        attempted.current = submitted; setUncertain(true);
        notify({ id: saveNotice, kind: "error", message: t("uncertainMessage"), action: { label: t("verify"), onClick: reviewSave } });
      } else {
        setSaved(submitted); setDraft({ ...submitted });
        notify({ id: saveNotice, kind: "success", message: t("saved") });
      }
    }, 500);
  }
  function acceptReview(keepMine: boolean) {
    if (!conflicting) return;
    const merged = { ...conflicting };
    if (keepMine) for (const field of fields) if (draft[field] !== saved[field]) merged[field] = draft[field];
    setSaved(conflicting); setDraft(merged); setConflicting(null); setScenario("normal"); setErrors({});
    notify({ id: saveNotice, kind: "info", message: t(keepMine ? "merged" : "adopted") });
  }
  function discard() {
    setDraft({ ...saved }); setErrors({}); dismissNotification(saveNotice);
  }
  function textField(field: Field, multiline = false) {
    const props = { id: `business-${field}`, value: draft[field], maxLength: limits[field], readOnly: restricted, disabled: locked, placeholder: t(`${field}Placeholder`), onChange: (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => change(field, event.target.value) };
    return <FormField label={t(field)} hint={t(`${field}Hint`)} error={errors[field]} required={field === "name"}>
      {multiline ? <Textarea {...props} rows={field === "faq" ? 4 : 2} /> : <Input {...props} />}
    </FormField>;
  }

  return <Page title={t("title")} backTo={{ to: "/configuracion", label: t("back") }} status={uncertain || dirty || restricted ? <span className="text-xs text-[var(--color-content-muted)]">{t(uncertain ? "pending" : restricted ? "readonly" : "dirty")}</span> : undefined}
    actions={restricted || unavailable ? undefined : <>
      <Button type="button" variant="outline" disabled={!dirty || locked} onClick={() => setDiscarding(true)}>{t("discard")}</Button>
      <Button type="button" disabled={!dirty || locked} onClick={save}>{busy === "save" ? <Spinner decorative /> : null}{t(busy === "save" ? "saving" : "save")}</Button>
    </>}>
    <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
      <p className="max-w-xl text-xs text-[var(--color-content-muted)]">{t("lab")}</p>
      <div className="w-64 max-w-full"><FormField label={t("scenario")}><NativeSelect value={scenario} disabled={busy !== null} onChange={event => resetScenario(event.target.value as Scenario)}>{scenarios.map(item => <option key={item} value={item}>{t(item)}</option>)}</NativeSelect></FormField></div>
    </div>
    {unavailable ? <Surface>{scenario === "loading" ? <div className="flex items-center gap-2 p-4" role="status"><Spinner decorative />{t("loadingTitle")}</div> : <EmptyState embedded title={t(scenario === "denied" ? "deniedTitle" : "unavailableTitle")} description={t(scenario === "denied" ? "permissionHint" : "retryHint")} action={scenario === "loadError" ? <Button type="button" variant="outline" onClick={() => resetScenario("normal")}>{t("retry")}</Button> : undefined} />}</Surface> : <div className="flex flex-col gap-5">
      <p className="max-w-3xl text-sm text-[var(--color-content-muted)]">{t(restricted ? "readonlyHint" : scenario === "empty" ? "emptyHint" : "intro")}</p>
      {conflicting ? <Surface title={t("reviewTitle")} titleRef={reviewHeading} padded>
        <p className="max-w-3xl text-sm text-[var(--color-content-muted)]">{t("reviewHint")}</p>
        <Table><TableHeader><TableRow><TableHead scope="col">{t("field")}</TableHead><TableHead scope="col" className="whitespace-normal">{t("current")}</TableHead><TableHead scope="col" className="whitespace-normal">{t("mine")}</TableHead></TableRow></TableHeader>
          <TableBody>{fields.filter(field => conflicting[field] !== draft[field]).map(field => <TableRow key={field}><TableRowHeader className="whitespace-normal">{t(field)}</TableRowHeader><TableCell className="min-w-48 max-w-sm whitespace-pre-wrap break-words">{conflicting[field] || t("noValue")}</TableCell><TableCell className="min-w-48 max-w-sm whitespace-pre-wrap break-words">{draft[field] || t("noValue")}</TableCell></TableRow>)}</TableBody>
        </Table>
        <div className="flex flex-wrap gap-2"><Button type="button" variant="outline" onClick={() => acceptReview(false)}>{t("useCurrent")}</Button><Button type="button" onClick={() => acceptReview(true)}>{t("keepMine")}</Button></div>
      </Surface> : null}
      {uncertain ? <Surface padded><div className="flex flex-wrap items-center justify-between gap-3"><p className="max-w-xl text-sm text-[var(--color-content-muted)]">{t("uncertainHint")}</p><Button type="button" variant="outline" disabled={busy !== null} onClick={reviewSave}>{busy === "review" ? <Spinner decorative /> : null}{t(busy === "review" ? "verifying" : "verify")}</Button></div></Surface> : null}
      <Surface title={t("basics")} padded>
        <div className="grid gap-4 sm:grid-cols-2">{textField("name")}{textField("location")}{textField("description", true)}{textField("hours", true)}</div>
      </Surface>
      <Surface title={t("offering")} padded>
        <div className="grid gap-4 sm:grid-cols-2">{textField("services", true)}{textField("policies", true)}</div>
      </Surface>
      <Surface title={t("answers")} padded>{textField("faq", true)}</Surface>
      <p className="max-w-3xl text-xs text-[var(--color-content-muted)]">{t("limitsHint")}</p>
    </div>}
    <ConfirmDialog open={discarding} onOpenChange={setDiscarding} title={t("discardTitle")} description={t("discardHint")} confirmLabel={t("discard")} cancelLabel={t("stay")} onConfirm={discard} />
    <ConfirmDialog open={guard.isBlocked} onOpenChange={open => { if (!open) guard.stay(); }} title={t(uncertain ? "uncertainLeaveTitle" : "discardTitle")} description={t(uncertain ? "uncertainLeaveHint" : "discardHint")} confirmLabel={t(uncertain ? "leave" : "discard")} cancelLabel={t("stay")} onConfirm={guard.leave} />
  </Page>;
}
