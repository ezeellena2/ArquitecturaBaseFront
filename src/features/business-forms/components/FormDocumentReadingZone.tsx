import { Fragment, useId, useRef, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { ApiError } from "@/shared/api/ApiError";
import { useMediaQuery } from "@/shared/hooks/useMediaQuery";
import { formatDateInZone } from "@/shared/lib/dateTime";
import { numberFormat } from "@/shared/lib/numberFormat";
import { Button } from "@/shared/ui/button";
import { CheckboxField } from "@/shared/ui/CheckboxField";
import { CollapsibleSection } from "@/shared/ui/CollapsibleSection";
import { ComparisonTable } from "@/shared/ui/ComparisonTable";
import { DataList } from "@/shared/ui/DataList";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/shared/ui/dialog";
import { DisabledReason } from "@/shared/ui/DisabledReason";
import { FormField } from "@/shared/ui/FormField";
import { GroupLabel } from "@/shared/ui/GroupLabel";
import { IconButton } from "@/shared/ui/IconButton";
import { AlertTriangleIcon, LockIcon, PlusIcon, TrashIcon } from "@/shared/ui/icons";
import { Label } from "@/shared/ui/label";
import { NativeSelect } from "@/shared/ui/NativeSelect";
import { Skeleton } from "@/shared/ui/skeleton";
import { Surface } from "@/shared/ui/Surface";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/shared/ui/table";
import { Textarea } from "@/shared/ui/textarea";
import type { FormDocumentReadingStats } from "../api/documentReading";
import type { FormStandard } from "../api/library";
import { changeDocumentReading, documentLookupsIncomplete, groupReadingExamples, keptComparison, lookupComparisons, lookupQuestions, maxDocumentLookups, readingQuestionName,
  standardDataRows, unchangedShare, type LookupQuestion } from "../documentReading";
import { administrativeName, localizedValue, questionEditorType } from "../editorModel";
import { useCatalogDetail } from "../hooks/useCatalogQueries";
import { useFormDocumentReading } from "../hooks/useFormDocumentReading";
import { useFormLibrary } from "../hooks/useFormLibrary";
import type { FormReadScope } from "../hooks/useFormQueries";
import type { DraftEditorValue, FormCulture, FormDefinitionStandard, FormDocumentLookup, FormDocumentReading } from "../model";
import type { DraftFieldIssue } from "../validationPaths";

const prefix = "draft.documentReading";
const emptyReading: FormDocumentReading = { enabled: false, recognition: "", lookups: [] };
const muted = "text-[var(--color-content-muted)]";

// Like the zones of a catalog question (ZP1-A): folded, it says what is configured; a problem in it opens it, while rendering, so
// the focus that follows finds its control. Only a new problem opens it again.
function useZoneOpen(problem: string) {
  const [open, setOpen] = useState(problem !== "");
  const [shown, setShown] = useState(problem);
  if (problem !== shown) {
    setShown(problem);
    if (problem) setOpen(true);
  }
  return [open, setOpen] as const;
}

interface ZoneProps {
  value: DraftEditorValue;
  onChange: (value: DraftEditorValue) => void;
  /** The form cannot be edited (permission, a deactivated form): without the controls that change it. */
  readOnly: boolean;
  /** While the draft saves or waits for a review: the same controls, off, so nothing changes place. */
  disabled?: boolean;
  scope: FormReadScope;
  /** BI1-A: the library standard the form was copied from; an own form has none. */
  standard: FormDefinitionStandard | undefined;
  /** The saved form, whose reading «Cómo viene leyendo» counts. */
  definitionId: string | null;
  culture: FormCulture;
  timeZoneId?: string;
  /** The problems the editor shows: the zone takes those of the reading, from saving or from publishing. */
  issues: readonly DraftFieldIssue[];
  /** After a save stopped by a lookup still to complete, it says what is missing (like a calculation without its questions). */
  showIncomplete: boolean;
}

/**
 * «Lectura de documentos» (DOC1), after «Preguntas»: whether the documents that arrive by WhatsApp are read, «Cómo reconocerlo» and
 * the lookups in catalogs, saved with the draft. A copy of a library standard also says which questions receive its data, sealed
 * by «Agregar» with their fixed validations (BI1-A), what marks a repeated document and «Cómo viene leyendo».
 */
export function FormDocumentReadingZone({ value, onChange, readOnly, disabled = false, scope, standard, definitionId, culture, timeZoneId, issues, showIncomplete }: ZoneProps) {
  const { t } = useTranslation("forms");
  const reading = value.draft.documentReading;
  // Off, only the switch shows: the editor takes another problem of the reading to the common notice.
  const errors = issues.filter(issue => issue.path === prefix || !!reading?.enabled && issue.path.startsWith(prefix + "."));
  const errorFor = (path: string) => errors.find(issue => issue.path === prefix + path)?.messages[0];
  // After a save stopped by the reading: on, «Cómo reconocerlo» is required and each lookup complete.
  const incomplete = showIncomplete && !!reading?.enabled && documentLookupsIncomplete(reading);
  const unrecognized = showIncomplete && !!reading?.enabled && !reading.recognition.trim();
  const [open, setOpen] = useZoneOpen([...errors.map(issue => issue.path + ": " + issue.messages.join(" ")), incomplete ? "incomplete" : "", unrecognized ? "recognition" : ""]
    .filter(Boolean).join("\n"));
  const change = (next: FormDocumentReading) => onChange(changeDocumentReading(value, next));
  const title = t("documentReading.title");
  const summary = reading?.enabled ? [t("documentReading.on"), ...reading.lookups.length ? [t("documentReading.lookupsCount", { count: reading.lookups.length })] : []].join(" · ")
    : t("documentReading.off");
  return <CollapsibleSection title={title} help={t("documentReading.help")} open={open} onOpenChange={setOpen} summary={summary}
    expandLabel={t("catalogQuestion.zones.expand", { name: title })} collapseLabel={t("catalogQuestion.zones.collapse", { name: title })}>
    <div className="flex flex-col divide-y divide-[var(--color-border)]">
      <div className="p-4"><CheckboxField label={t("documentReading.enabled")} checked={!!reading?.enabled} disabled={readOnly || disabled} error={errorFor("")}
        onCheckedChange={checked => change({ ...reading ?? emptyReading, enabled: checked })} /></div>
      {reading?.enabled ? <ReadingDetails reading={reading} value={value} change={change} readOnly={readOnly} disabled={disabled} scope={scope} standard={standard} definitionId={definitionId}
        culture={culture} timeZoneId={timeZoneId} errorFor={errorFor} incomplete={incomplete} unrecognized={unrecognized} open={open} /> : null}
    </div>
  </CollapsibleSection>;
}

function ReadingDetails({ reading, value, change, readOnly, disabled, scope, standard, definitionId, culture, timeZoneId, errorFor, incomplete, unrecognized, open }: {
  reading: FormDocumentReading; value: DraftEditorValue; change: (next: FormDocumentReading) => void; readOnly: boolean; disabled: boolean; scope: FormReadScope;
  standard: FormDefinitionStandard | undefined; definitionId: string | null; culture: FormCulture; timeZoneId?: string; errorFor: (path: string) => string | undefined;
  incomplete: boolean; unrecognized: boolean; open: boolean;
}) {
  const { t } = useTranslation("forms");
  // The library names the standard and says whether it reads documents: the same reading as the editor's header, without a notice
  // of its own. While it loads, or if it fails, the data of the standard wait.
  const library = useFormLibrary(scope, { enabled: !!standard, silent: true });
  const fromLibrary = standard ? library.data?.standards.find(item => item.key === standard.key) : undefined;
  return <>
    <div className="p-4"><FormField label={t("documentReading.recognition")} help={t("documentReading.recognitionHelp")}
      error={errorFor(".recognition") ?? (unrecognized ? t("documentReading.recognitionRequired") : undefined)}>
      <Textarea readOnly={readOnly || disabled} maxLength={1000} data-reading-control="recognition" value={reading.recognition} onChange={event => change({ ...reading, recognition: event.target.value })} />
    </FormField></div>
    {standard && fromLibrary?.reads ? <StandardData value={value} standard={standard} fromLibrary={fromLibrary} reads={fromLibrary.reads} culture={culture} /> : null}
    <Lookups reading={reading} value={value} change={change} readOnly={readOnly} disabled={disabled} scope={scope} culture={culture} errorFor={errorFor} incomplete={incomplete} />
    {standard ? <ReadingStats value={value} scope={scope} definitionId={definitionId} culture={culture} timeZoneId={timeZoneId} open={open} /> : null}
  </>;
}

// The data the standard reads and the question of the copy that receives each one: «Agregar» fixed it through `standard.bound` (BI1-A),
// so it is read, not chosen, and a renamed or moved question still receives its datum. Each datum with the type of its question in
// grey and the fixed validation that question carries, which every capture enforces. On the phone, as the board, one block per datum:
// its name, the question that receives it and, in grey, its fixed validation.
function StandardData({ value, standard, fromLibrary, reads, culture }: { value: DraftEditorValue; standard: FormDefinitionStandard; fromLibrary: FormStandard;
  reads: NonNullable<FormStandard["reads"]>; culture: FormCulture }) {
  const { t } = useTranslation("forms");
  const id = useId();
  const phone = useMediaQuery("(max-width: 639px)");
  const rows = standardDataRows(reads, standard.bound, value.draft.fields);
  const receivedBy = (row: (typeof rows)[number]) => row.question ? localizedValue(row.question.label, culture, value.draft.culture) : <span className={muted}>{t("documentReading.noQuestion")}</span>;
  const validation = (kind: NonNullable<(typeof rows)[number]["validation"]>) => <span className="inline-flex items-start gap-1">
    <LockIcon aria-hidden="true" className={"mt-0.5 size-3.5 shrink-0 " + muted} />{t("documentReading.validations." + kind)}</span>;
  return <div className="flex flex-col gap-2 p-4">
    <GroupLabel id={id} help={t("documentReading.standardDataHelp", { name: fromLibrary.name, version: standard.version })}>{t("documentReading.standardData")}</GroupLabel>
    {phone ? <Surface><ul aria-labelledby={id} className="flex flex-col divide-y divide-[var(--color-border)]">{rows.map(row => <li key={row.key} className="flex flex-col gap-0.5 px-4 py-2">
      <span className={"text-xs " + muted}>{row.name}</span>
      <span className="text-sm">{receivedBy(row)}</span>
      {row.validation ? <span className={"text-xs " + muted}>{validation(row.validation)}</span> : null}
    </li>)}</ul></Surface> : <Surface><Table aria-labelledby={id}>
      <TableHeader><TableRow><TableHead className="whitespace-normal">{t("documentReading.datum")}</TableHead><TableHead className="whitespace-normal">{t("documentReading.receivedBy")}</TableHead>
        <TableHead className="whitespace-normal">{t("documentReading.validation")}</TableHead></TableRow></TableHeader>
      <TableBody>{rows.map(row => <TableRow key={row.key}>
        <TableCell className="py-1.5 whitespace-normal"><span className="block">{row.name}</span>
          {row.question ? <span className={"block text-xs " + muted}>{t("types." + questionEditorType(row.question))}</span> : null}</TableCell>
        <TableCell className="py-1.5 whitespace-normal">{receivedBy(row)}</TableCell>
        <TableCell className="py-1.5 whitespace-normal">{row.validation ? validation(row.validation) : <span className={muted}>—</span>}</TableCell>
      </TableRow>)}</TableBody>
    </Table></Surface>}
  </div>;
}

// «Cruce con catálogos»: up to five, each the question read, the catalog question it fills and what of the catalog is compared. In
// a table from 640 px and, on the phone, one box per lookup with its buttons and lists of 44 px. Quitar goes without asking, like an
// item: Guardar keeps the draft. Read only and without lookups, there is nothing to show; while the draft saves, everything stays, off.
function Lookups({ reading, value, change, readOnly, disabled, scope, culture, errorFor, incomplete }: {
  reading: FormDocumentReading; value: DraftEditorValue; change: (next: FormDocumentReading) => void; readOnly: boolean; disabled: boolean; scope: FormReadScope; culture: FormCulture;
  errorFor: (path: string) => string | undefined; incomplete: boolean;
}) {
  const { t } = useTranslation("forms");
  const id = useId();
  const phone = useMediaQuery("(max-width: 639px)");
  const root = useRef<HTMLDivElement>(null);
  const add = useRef<HTMLButtonElement>(null);
  const questions = lookupQuestions(value.draft.fields, culture, value.draft.culture);
  const lookups = reading.lookups;
  const update = (index: number, lookup: FormDocumentLookup) => change({ ...reading, lookups: lookups.map((item, position) => position === index ? lookup : item) });
  const remove = (index: number) => { change({ ...reading, lookups: lookups.filter((_, position) => position !== index) }); requestAnimationFrame(() => add.current?.focus()); };
  const addLookup = () => {
    change({ ...reading, lookups: [...lookups, { questionId: "", sourceQuestionId: "", field: "" }] });
    requestAnimationFrame(() => root.current?.querySelector<HTMLElement>(`[data-reading-control="lookups[${lookups.length}].sourceQuestionId"]`)?.focus());
  };
  // Each lookup fills another catalog question: with all of them filled, another one could not be completed.
  const free = questions.targets.filter(target => !lookups.some(lookup => lookup.questionId.toLowerCase() === target.id.toLowerCase()));
  const addReason = lookups.length >= maxDocumentLookups ? t("documentReading.limit", { count: maxDocumentLookups })
    : questions.targets.length === 0 ? t("documentReading.noCatalogQuestions") : free.length === 0 ? t("documentReading.allFilled") : null;
  const rows = lookups.map((lookup, index) => <LookupRow key={index} index={index} lookup={lookup} lookups={lookups} questions={questions} scope={scope} readOnly={readOnly} disabled={disabled}
    phone={phone} errorFor={errorFor} incomplete={incomplete} onChange={next => update(index, next)} onRemove={() => remove(index)} />);
  if (readOnly && !lookups.length) return null;
  return <div ref={root} className="flex flex-col gap-2 p-4">
    <GroupLabel id={id} help={t("documentReading.lookupsHelp")}>{t("documentReading.lookups")}</GroupLabel>
    {lookups.length ? phone ? <div className="flex flex-col gap-3">{rows}</div> : <Surface><Table aria-labelledby={id}>
      <TableHeader><TableRow>
        <TableHead>{t("documentReading.source")}</TableHead><TableHead>{t("documentReading.target")}</TableHead><TableHead>{t("documentReading.field")}</TableHead>
        {readOnly ? null : <TableHead className="w-px"><span className="sr-only">{t("actionsColumn")}</span></TableHead>}
      </TableRow></TableHeader>
      <TableBody striped={false}>{rows}</TableBody>
    </Table></Surface> : null}
    {errorFor(".lookups") ? <p role="alert" className="text-sm text-[var(--color-danger)]">{errorFor(".lookups")}</p> : null}
    {readOnly ? null : <div className="flex"><DisabledReason reason={disabled ? null : addReason}>
      <Button ref={add} type="button" variant="outline" size={phone ? "touch" : "sm"} disabled={disabled || addReason !== null} onClick={addLookup}><PlusIcon className="size-4" />{t("documentReading.add")}</Button>
    </DisabledReason></div>}
  </div>;
}

type LookupPart = "sourceQuestionId" | "questionId" | "field";
function LookupRow({ index, lookup, lookups, questions, scope, readOnly, disabled, phone, errorFor, incomplete, onChange, onRemove }: {
  index: number; lookup: FormDocumentLookup; lookups: readonly FormDocumentLookup[]; questions: ReturnType<typeof lookupQuestions>; scope: FormReadScope; readOnly: boolean;
  disabled: boolean; phone: boolean; errorFor: (path: string) => string | undefined; incomplete: boolean; onChange: (lookup: FormDocumentLookup) => void; onRemove: () => void;
}) {
  const { t } = useTranslation("forms");
  const ids = useId();
  const same = (left: string, right: string) => left.toLowerCase() === right.toLowerCase();
  const source = questions.sources.find(item => same(item.id, lookup.sourceQuestionId));
  const target = questions.targets.find(item => same(item.id, lookup.questionId));
  // Each lookup fills another question; its own stays on its list.
  const targets = questions.targets.filter(item => same(item.id, lookup.questionId) || !lookups.some(other => other !== lookup && same(other.questionId, item.id)));
  // The fields of the catalog it fills, read like its detail (with «Ver catálogos»): while they arrive «Se busca por» says it is loading,
  // and without them it offers the option's code or text; when that leaves nothing to choose, or it compares a field it cannot name,
  // it is off with the reason, like the catalog of a question.
  const detail = useCatalogDetail(scope, target?.catalog ?? "", "local");
  const catalogFields = detail.data?.fields ?? undefined;
  const comparisons = lookupComparisons(source?.type ?? null, catalogFields ?? []);
  const readsCatalogs = !!scope.actorId && scope.permissions.includes("formcatalogs.read");
  const loadingFields = readsCatalogs && !!target?.catalog && detail.isLoading;
  const fieldReason = !readsCatalogs && (comparisons.length === 0 || !["", "code", "text"].includes(lookup.field)) ? t("documentReading.fieldsNeedRead") : null;
  const number = index + 1;
  const parts: readonly { part: LookupPart; label: string }[] = [
    { part: "sourceQuestionId", label: t("documentReading.source") }, { part: "questionId", label: t("documentReading.target") }, { part: "field", label: t("documentReading.field") }];
  // Under the row, each problem says which of the three it is: «Se busca por: elegí un campo del catálogo.»
  const problems = parts.flatMap(({ part, label }) => {
    const message = errorFor(`.lookups[${index}].${part}`);
    return message ? [{ part, text: t("documentReading.problem", { label, message: message.charAt(0).toLocaleLowerCase(scope.culture) + message.slice(1) }) }] : [];
  });
  const whole = errorFor(`.lookups[${index}]`);
  const missing = (part: LookupPart) => incomplete && lookup[part] === "";
  const messages = [...problems.map(problem => problem.text), ...whole ? [whole] : [], ...incomplete && parts.some(({ part }) => lookup[part] === "") ? [t("documentReading.incomplete")] : []];
  const messageId = `${ids}-message`;
  const questionOption = (item: LookupQuestion) => <option key={item.id} value={item.id}>{t("documentReading.questionOption", { label: item.label, number: item.number })}</option>;
  const comparisonName = (field: string) => field === "code" ? t("documentReading.byCode") : field === "text" ? t("documentReading.byText")
    : catalogFields?.find(item => item.id === field) ? administrativeName(catalogFields.find(item => item.id === field)!.name, scope.culture) : t("documentReading.unavailableField");
  // In the table a control has no label in sight: its name says the lookup and the column. On the phone its label is above it, and
  // the list is 44 px tall.
  const select = (part: LookupPart, label: string, options: ReactNode, unavailable: string | null, { loading = false, reason = null }: { loading?: boolean; reason?: string | null } = {}) => {
    const control = <NativeSelect data-reading-control={`lookups[${index}].${part}`} id={`${ids}-${part}`} size={phone ? "touch" : "default"}
      aria-label={phone ? undefined : t("documentReading.cell", { number, label })} aria-labelledby={phone ? `${ids}-${part}-label` : undefined}
      aria-invalid={problems.some(problem => problem.part === part) || missing(part) || undefined} aria-describedby={messages.length ? messageId : undefined}
      aria-busy={loading || undefined} disabled={readOnly || disabled || loading || reason !== null} value={loading ? "" : lookup[part]} onChange={event => {
        const chosen = event.target.value;
        if (part === "field") { onChange({ ...lookup, field: chosen }); return; }
        if (part === "sourceQuestionId") {
          const next = questions.sources.find(item => same(item.id, chosen));
          onChange({ ...lookup, sourceQuestionId: chosen, field: keptComparison(lookup.field, next?.type ?? null, catalogFields) });
          return;
        }
        // Another catalog has other fields: a field of the one it filled is chosen again.
        const next = questions.targets.find(item => same(item.id, chosen));
        onChange({ ...lookup, questionId: chosen, field: lookup.field === "code" || lookup.field === "text" || next?.catalog === target?.catalog ? lookup.field : "" });
      }}>
      {loading ? <option value="">{t("common:states.loading")}</option> : <>
        <option value="">{t("select")}</option>
        {unavailable !== null ? <option value={lookup[part]}>{unavailable}</option> : null}
        {options}
      </>}
    </NativeSelect>;
    return reason ? <DisabledReason reason={reason} className="grid w-full">{control}</DisabledReason> : control;
  };
  const controls: Record<LookupPart, ReactNode> = {
    sourceQuestionId: select("sourceQuestionId", t("documentReading.source"), questions.sources.map(questionOption),
      lookup.sourceQuestionId && !source ? t("documentReading.unavailableQuestion") : null),
    questionId: select("questionId", t("documentReading.target"), targets.map(questionOption), lookup.questionId && !target ? t("documentReading.unavailableQuestion") : null),
    field: select("field", t("documentReading.field"), comparisons.map(item => <option key={item.value} value={item.value}>{comparisonName(item.value)}</option>),
      lookup.field && !comparisons.some(item => item.value === lookup.field) ? comparisonName(lookup.field) : null, { loading: loadingFields, reason: fieldReason }),
  };
  const list = messages.length ? <div id={messageId} className="flex flex-col gap-0.5">{messages.map(message => <p key={message} role="alert"
    className="flex items-start gap-1 text-xs text-[var(--color-danger)]"><AlertTriangleIcon aria-hidden="true" className="mt-px size-3.5 shrink-0" />{message}</p>)}</div> : null;
  if (phone) return <div data-reading-lookup={index}><Surface headingLevel={3} title={t("documentReading.lookup", { number })} actions={readOnly ? undefined
    : <Button type="button" size="touch" variant="destructive-outline" aria-label={t("documentReading.remove", { number })} disabled={disabled} onClick={onRemove}>{t("documentReading.removeShort")}</Button>}>
    <div className="flex flex-col gap-4 p-4">
      {parts.map(({ part, label }) => <div key={part} className="flex flex-col gap-1.5"><Label id={`${ids}-${part}-label`} htmlFor={`${ids}-${part}`}>{label}</Label>{controls[part]}</div>)}
      {list}
    </div>
  </Surface></div>;
  return <Fragment>
    <TableRow data-reading-lookup={index}>
      {parts.map(({ part }) => <TableCell key={part} className="py-1.5 align-top whitespace-normal">{controls[part]}</TableCell>)}
      {readOnly ? null : <TableCell className="w-px py-1.5 align-top"><IconButton size="icon-sm" variant="destructive-outline" label={t("documentReading.remove", { number })} disabled={disabled} onClick={onRemove}>
        <TrashIcon className="size-4" /></IconButton></TableCell>}
    </TableRow>
    {list ? <TableRow className="hover:bg-transparent"><TableCell colSpan={readOnly ? 3 : 4} className="pb-2 whitespace-normal">{list}</TableCell></TableRow> : null}
  </Fragment>;
}

// For a copy of a standard, what marks a repeated document and «Cómo viene leyendo»: read when the zone shows them, private like
// the responses their corrections come from. On the phone its buttons are 44 px.
function ReadingStats({ value, scope, definitionId, culture, timeZoneId, open }: { value: DraftEditorValue; scope: FormReadScope; definitionId: string | null; culture: FormCulture;
  timeZoneId?: string; open: boolean }) {
  const { t } = useTranslation("forms");
  const { query: stats, forbidden, cooldown } = useFormDocumentReading(scope, definitionId, open);
  const phone = useMediaQuery("(max-width: 639px)");
  const duplicatesId = useId(), statsId = useId();
  const [examplesOpen, setExamplesOpen] = useState(false);
  const fields = value.draft.fields;
  const name = (id: string) => readingQuestionName(fields, id, culture, value.draft.culture);
  // A 401 or 403 leaves nothing to show; another failure says so, with «Reintentar» (the common notice says why), off while a 429 waits.
  if (!definitionId || forbidden || stats.error instanceof ApiError && stats.error.status === 401) return null;
  const waiting = <div role="status" className="flex flex-col gap-2"><span className="sr-only">{t("common:states.loading")}</span>
    {["w-3/4", "w-1/2", "w-2/3"].map(width => <Skeleton key={width} aria-hidden="true" className={"h-4 " + width} />)}</div>;
  const data = stats.data;
  const duplicates = data?.duplicateQuestionIds.map(name).filter((item): item is string => !!item) ?? [];
  const list = new Intl.ListFormat(culture, { type: "conjunction" });
  return <>
    {stats.isError ? null : <div className="flex flex-col gap-2 p-4">
      <GroupLabel id={duplicatesId} help={t("documentReading.duplicatesHelp")}>{t("documentReading.duplicates")}</GroupLabel>
      {data ? <p aria-labelledby={duplicatesId} className="text-sm">{duplicates.length ? t("documentReading.duplicatesData", { list: list.format(duplicates) }) : t("documentReading.duplicatesFile")}</p>
        : <Skeleton aria-hidden="true" className="h-4 w-2/3" />}
    </div>}
    <div className="flex flex-col gap-2 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <GroupLabel id={statsId} help={t("documentReading.statsHelp")}>{t("documentReading.stats")}</GroupLabel>
        {data?.examples ? <DisabledReason reason={data.examples.length ? null : t("documentReading.noExamples")}>
          <Button type="button" variant="outline" size={phone ? "touch" : "sm"} disabled={!data.examples.length} onClick={() => setExamplesOpen(true)}>
            {t("documentReading.examples", { count: data.examples.length })}</Button>
        </DisabledReason> : null}
      </div>
      {stats.isError ? <div className="flex flex-wrap items-center gap-3"><p className="text-sm">{t("documentReading.loadError")}</p>
        <DisabledReason reason={cooldown.isRunning ? t("wait", { count: cooldown.seconds }) : null}>
          <Button type="button" variant="outline" size={phone ? "touch" : "sm"} pending={stats.isFetching} disabled={cooldown.isRunning} onClick={() => void stats.refetch()}>
            {t(stats.isFetching ? "retrying" : "common:actions.retry")}</Button>
        </DisabledReason></div>
        : data ? <StatsTables data={data} name={name} culture={culture} timeZoneId={timeZoneId} labelledBy={statsId} /> : waiting}
    </div>
    {data?.examples && examplesOpen ? <ExamplesDialog examples={data.examples} name={name} culture={culture} timeZoneId={timeZoneId} onClose={() => setExamplesOpen(false)} /> : null}
  </>;
}

function StatsTables({ data, name, culture, timeZoneId, labelledBy }: { data: FormDocumentReadingStats; name: (id: string) => string | null; culture: FormCulture; timeZoneId?: string;
  labelledBy: string }) {
  const { t } = useTranslation("forms");
  const share = numberFormat(culture, { style: "percent", maximumFractionDigits: 0 });
  const mostCorrected = data.mostCorrected;
  return <>
    <DataList items={[
      { key: "documents", label: t("documentReading.documents"), value: data.documents },
      { key: "since", label: t("documentReading.since"), value: formatDateInZone(data.sinceUtc, culture, timeZoneId) },
      ...mostCorrected ? [{ key: "most", label: t("documentReading.mostCorrected"), value: <>{name(mostCorrected.questionId) ?? <span className={muted}>{t("documentReading.removedQuestion")}</span>}
        <span className={muted}>{" · " + t("documentReading.corrections", { count: mostCorrected.corrections })}</span></> }] : [],
    ]} />
    {/* Per question, the share of what it read that was confirmed without changes (the total of documents is above). */}
    {data.questions.length ? <Surface><Table aria-labelledby={labelledBy}>
      <TableHeader><TableRow><TableHead className="whitespace-normal">{t("documentReading.question")}</TableHead>
        <TableHead numeric className="whitespace-normal">{t("documentReading.unchanged")}</TableHead></TableRow></TableHeader>
      <TableBody>{data.questions.map(question => <TableRow key={question.questionId}>
        <TableCell className="py-1.5 whitespace-normal">{name(question.questionId) ?? <span className={muted}>{t("documentReading.removedQuestion")}</span>}</TableCell>
        <TableCell numeric className="tabular-nums">{question.read ? share.format(unchangedShare(question.unchanged, question.read)) : "—"}</TableCell>
      </TableRow>)}</TableBody>
    </Table></Surface> : null}
  </>;
}

// «Ver los ejemplos»: the latest corrections side by side (LR2-A), what was read and what was confirmed, one group per response. It
// is for whoever designs the form to improve «Cómo reconocerlo» by hand; nothing of it goes to the AI.
function ExamplesDialog({ examples, name, culture, timeZoneId, onClose }: { examples: NonNullable<FormDocumentReadingStats["examples"]>; name: (id: string) => string | null;
  culture: FormCulture; timeZoneId?: string; onClose: () => void }) {
  const { t } = useTranslation("forms");
  const empty = <span className={muted}>—</span>;
  return <Dialog open onOpenChange={open => { if (!open) onClose(); }}>
    <DialogContent mobileFullscreen aria-describedby={undefined} className="flex flex-col sm:max-w-3xl">
      <DialogHeader><DialogTitle>{t("documentReading.examplesTitle")}</DialogTitle></DialogHeader>
      <div className="min-h-0 flex-1 overflow-y-auto"><Surface><ComparisonTable
        columns={{ identity: [{ key: "record", header: t("documentReading.record") }, { key: "date", header: t("documentReading.date") }], label: t("documentReading.question"),
          before: t("documentReading.exampleRead"), after: t("documentReading.exampleConfirmed") }}
        groups={groupReadingExamples(examples).map(group => {
          const date = formatDateInZone(group.confirmedAtUtc, culture, timeZoneId);
          return { key: group.recordId, identity: [group.recordNumber, date], mobileTitle: group.recordNumber + " · " + date,
            lines: group.items.map(item => ({ key: item.questionId, label: name(item.questionId) ?? <span className={muted}>{t("documentReading.removedQuestion")}</span>,
              before: item.read || empty, after: item.confirmed || empty })) };
        })} /></Surface></div>
      <DialogFooter showCloseButton />
    </DialogContent>
  </Dialog>;
}
