import { useEffect, useId, useState } from "react";
import { useTranslation } from "react-i18next";
import { Autocomplete } from "@/shared/ui/Autocomplete";
import { DisabledReason } from "@/shared/ui/DisabledReason";
import { FilterChip } from "@/shared/ui/FilterChip";
import { FormField } from "@/shared/ui/FormField";
import { GroupLabel } from "@/shared/ui/GroupLabel";
import { Label } from "@/shared/ui/label";
import { NativeSelect } from "@/shared/ui/NativeSelect";
import { SegmentedControl } from "@/shared/ui/SegmentedControl";
import { canHaveCondition, chooseConditionQuestion, conditionAnswers, conditionCandidates, toggleConditionAnswer, withCondition, type ConditionAnswer } from "../conditions";
import { questionIdentity } from "../dependentLists";
import { administrativeName, localizedValue } from "../editorModel";
import type { CatalogReadScope } from "../hooks/useCatalogDraftEditor";
import { useCatalogDetail, useCatalogItems, useCatalogItemsById } from "../hooks/useCatalogQueries";
import type { DraftQuestion, FormCulture } from "../model";
import { QuestionChips } from "./QuestionChips";

const answerLabel = (answer: ConditionAnswer, culture: FormCulture, original: FormCulture, yes: string, no: string) =>
  "yes" in answer ? answer.yes ? yes : no : localizedValue(answer.label, culture, original);

/** The labels of the catalog options a condition chose, read by id: «…» while they load, «Respuesta no disponible» if one is not there. */
function useCatalogAnswerLabels(scope: CatalogReadScope, catalog: string, values: readonly string[]) {
  const { t } = useTranslation("forms");
  const read = useCatalogItemsById(scope, catalog, values);
  return (value: string) => {
    const item = read.data?.items.find(option => option.id === value);
    return item ? administrativeName(item.text, scope.culture) : read.isPending && read.fetchStatus !== "idle" ? "…" : t("condition.unavailable");
  };
}

/** The line under the name in the list (CO1-A): «Si Concepto es Servicios o…», in grey. */
export function ConditionLine({ question, questions, culture, original, scope }: {
  question: DraftQuestion; questions: readonly DraftQuestion[]; culture: FormCulture; original: FormCulture; scope: CatalogReadScope;
}) {
  const { t } = useTranslation("forms");
  const showWhen = question.showWhen;
  const named = showWhen?.questionId ? questions.find(item => questionIdentity(item) === showWhen.questionId) : undefined;
  const catalog = named?.type === "choice" && named.source?.catalog ? named.source.catalog : "";
  const catalogLabel = useCatalogAnswerLabels(scope, catalog, showWhen?.values.slice(0, 1) ?? []);
  if (!showWhen) return null;
  if (!named) return <>{t("condition.lineIncomplete")}</>;
  const first = showWhen.values[0];
  const answers = conditionAnswers(named);
  const answer = first === undefined ? undefined : answers ? answers.find(item => item.id === first) : undefined;
  const label = first === undefined ? null : catalog ? catalogLabel(first)
    : answer ? answerLabel(answer, culture, original, t("yes"), t("no")) : t("condition.unavailable");
  const name = localizedValue(named.label, culture, original);
  return <>{label === null ? t("condition.lineIncomplete") : t(showWhen.values.length > 1 ? "condition.lineMore" : "condition.line", { question: name, answer: label })}</>;
}

/** «es» for a catalog question: the chosen options as chips and a search among its active options, which adds or removes them. */
function CatalogAnswers({ scope, catalog, values, readOnly, lockedReason, onToggle }: {
  scope: CatalogReadScope; catalog: string; values: readonly string[]; readOnly: boolean; lockedReason?: string | null; onToggle: (value: string, chosen: boolean) => void;
}) {
  const { t } = useTranslation("forms");
  const id = useId();
  const [search, setSearch] = useState(""), [settled, setSettled] = useState("");
  useEffect(() => { const timer = setTimeout(() => setSettled(search), 300); return () => clearTimeout(timer); }, [search]);
  const off = readOnly || !!lockedReason;
  const detail = useCatalogDetail(scope, off ? "" : catalog, "global");
  const items = useCatalogItems(scope, off ? "" : catalog, detail.data?.revision ?? null, { page: 1, pageSize: 20, search: settled, isActive: true, sort: "text" }, "global");
  const label = useCatalogAnswerLabels(scope, catalog, values);
  const searching = search !== settled || items.isPlaceholderData;
  const options = searching ? [] : (items.data?.items ?? []).map(item => ({ id: item.id, label: administrativeName(item.text, scope.culture), selected: values.includes(item.id) }));
  const status = detail.isLoading || items.isLoading ? t("common:states.loading") : searching ? t("searching") : items.data && !options.length ? t(settled.trim() ? "catalogs.items.noMatches" : "catalogs.items.empty") : undefined;
  return <div className="flex min-w-0 flex-col gap-1.5">
    <Label htmlFor={id}>{t("condition.is")}</Label>
    {values.length ? <div className="flex flex-wrap gap-1.5">{values.map(value => off ? <FilterChip key={value}>{label(value)}</FilterChip>
      : <FilterChip key={value} removeLabel={t("condition.remove", { label: label(value) })} onRemove={() => onToggle(value, false)}>{label(value)}</FilterChip>)}</div> : null}
    {readOnly ? null : <DisabledReason reason={lockedReason} className="grid w-full"><Autocomplete id={id} dropdown multiple disabled={off} value={search} placeholder={t("condition.search")}
      options={options} status={status} onValueChange={setSearch} onSelect={value => onToggle(value, !values.includes(value))} /></DisabledReason>}
  </div>;
}

/**
 * «Se muestra» of a question (CO1-A): «Siempre» or «Según otra respuesta», with «Si» (an earlier choose-one question, own or from a
 * catalog, or a yes or no, outside the block) and «es» (the answers that show it). Neither the block nor its questions have it.
 * Bound by the library standard (BI1-A), the condition stays, with its reason on each control.
 */
export function ConditionSettings({ question, questions, culture, original, readOnly, lockedReason, error, scope, onChange }: {
  question: DraftQuestion; questions: readonly DraftQuestion[]; culture: FormCulture; original: FormCulture; readOnly: boolean;
  lockedReason?: string | null; error?: string; scope: CatalogReadScope; onChange: (question: DraftQuestion) => void;
}) {
  const { t } = useTranslation("forms");
  if (!canHaveCondition(question)) return null;
  const showWhen = question.showWhen;
  const candidates = conditionCandidates(questions, question.localId, culture, original);
  const named = showWhen?.questionId ? questions.find(item => questionIdentity(item) === showWhen.questionId) : undefined;
  const candidate = candidates.find(item => item.id === showWhen?.questionId);
  const answers = named ? conditionAnswers(named) : null;
  const order = answers?.map(answer => answer.id) ?? [];
  const toggle = (value: string, chosen: boolean) => onChange(toggleConditionAnswer(question, value, chosen, order));
  const labelOf = (value: string) => { const answer = answers?.find(item => item.id === value); return answer ? answerLabel(answer, culture, original, t("yes"), t("no")) : t("condition.unavailable"); };
  return <div data-question-control="showWhen" className="flex flex-col gap-3">
    <div className="flex flex-col gap-1.5">
      <GroupLabel id={question.localId + "-condition"} help={t("condition.help")}>{t("condition.shows")}</GroupLabel>
      <SegmentedControl aria-label={t("condition.shows")} disabled={readOnly} options={[
        { key: "always", label: t("condition.always"), pressed: !showWhen, onSelect: () => onChange(withCondition(question, false)), disabledReason: lockedReason ?? undefined },
        { key: "answer", label: t("condition.byAnswer"), pressed: !!showWhen, onSelect: () => onChange(withCondition(question, true)),
          disabledReason: lockedReason ?? (!showWhen && candidates.length === 0 ? t("condition.noQuestions") : undefined) },
      ]} />
    </div>
    {showWhen ? <div className="grid items-start gap-4 sm:grid-cols-2">
      <FormField label={t("condition.if")}><DisabledReason reason={lockedReason}><NativeSelect disabled={readOnly || !!lockedReason} value={showWhen.questionId ?? ""}
        onChange={event => { if (event.target.value) onChange(chooseConditionQuestion(question, event.target.value)); }}>
        <option value="" disabled>{t("condition.choose")}</option>
        {showWhen.questionId && !candidate ? <option value={showWhen.questionId}>{t("condition.unavailableQuestion")}</option> : null}
        {candidates.map(item => <option key={item.id} value={item.id}>{t("condition.question", { label: item.label, number: item.number })}</option>)}
      </NativeSelect></DisabledReason></FormField>
      {candidate?.kind === "catalog" && candidate.catalog
        ? <CatalogAnswers scope={scope} catalog={candidate.catalog} values={showWhen.values} readOnly={readOnly} lockedReason={lockedReason} onToggle={toggle} />
        : <QuestionChips label={t("condition.is")} chips={showWhen.values.map(value => ({ id: value, label: labelOf(value) }))}
          options={(answers ?? []).filter(answer => !showWhen.values.includes(answer.id)).map(answer => ({ id: answer.id, label: answerLabel(answer, culture, original, t("yes"), t("no")) }))}
          addLabel={t("condition.add")} removeLabel={label => t("condition.remove", { label })} readOnly={readOnly} lockedReason={lockedReason}
          addReason={!candidate ? t("condition.chooseFirst") : (answers ?? []).every(answer => showWhen.values.includes(answer.id)) ? t("condition.allChosen") : null}
          onAdd={value => toggle(value, true)} onRemove={value => toggle(value, false)} />}
    </div> : null}
    {error ? <p role="alert" className="text-sm text-[var(--color-danger)]">{error}</p> : null}
  </div>;
}
