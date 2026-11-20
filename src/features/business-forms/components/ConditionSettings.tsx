import { useTranslation } from "react-i18next";
import { DisabledReason } from "@/shared/ui/DisabledReason";
import { FormField } from "@/shared/ui/FormField";
import { GroupLabel } from "@/shared/ui/GroupLabel";
import { Picker } from "@/shared/ui/Picker";
import { SegmentedControl } from "@/shared/ui/SegmentedControl";
import type { CatalogItem } from "../api/catalogResponse";
import { canHaveCondition, chooseConditionQuestion, conditionAnswers, conditionCandidates, conditionDepth, toggleConditionAnswer, withCondition, type ConditionAnswer } from "../conditions";
import { questionIdentity } from "../dependentLists";
import { administrativeName, localizedValue } from "../editorModel";
import type { CatalogReadScope } from "../hooks/useCatalogDraftEditor";
import { useCatalogDetail, useCatalogItems, useCatalogItemsById } from "../hooks/useCatalogQueries";
import { usePickerPages } from "../hooks/usePickerPages";
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
  if (!showWhen) return null;
  const named = showWhen.questionId ? questions.find(item => questionIdentity(item) === showWhen.questionId) : undefined;
  const first = showWhen.values[0];
  if (!named || first === undefined) return <>{t("condition.lineIncomplete")}</>;
  const line = (label: string) => t(showWhen.values.length > 1 ? "condition.lineMore" : "condition.line", { question: localizedValue(named.label, culture, original), answer: label });
  // Only a catalog's option is read by id, and only then: its label comes from the catalog.
  if (named.type === "choice" && named.source?.catalog) return <CatalogConditionLine scope={scope} catalog={named.source.catalog} value={first} line={line} />;
  const answer = conditionAnswers(named)?.find(item => item.id === first);
  return <>{line(answer ? answerLabel(answer, culture, original, t("yes"), t("no")) : t("condition.unavailable"))}</>;
}
function CatalogConditionLine({ scope, catalog, value, line }: { scope: CatalogReadScope; catalog: string; value: string; line: (label: string) => string }) {
  const label = useCatalogAnswerLabels(scope, catalog, [value]);
  return <>{line(label(value))}</>;
}

/**
 * «es» for a catalog question, with the only piece to choose several (DS1-A): its active options, searched in the server twenty at a
 * time with «Mostrar N más», and the chosen ones by their names and «y N más» (DS2-A), read by id when they are not in the page. In a
 * form that goes through WhatsApp it takes one, as its (i) says: the options of a catalog arrive with the message and cannot show a
 * question for several (r13). Without any chosen, the editor takes the focus there (`data-engine-unset`).
 */
function CatalogAnswers({ scope, catalog, values, readOnly, lockedReason, single, onChange }: {
  scope: CatalogReadScope; catalog: string; values: readonly string[]; readOnly: boolean; lockedReason?: string | null; single: boolean;
  onChange: (values: readonly string[]) => void;
}) {
  const { t } = useTranslation("forms");
  const pages = usePickerPages<CatalogItem>();
  const off = readOnly || !!lockedReason;
  const detail = useCatalogDetail(scope, off ? "" : catalog, "global");
  const items = useCatalogItems(scope, off ? "" : catalog, detail.data?.revision ?? null, { page: pages.page, pageSize: 20, search: pages.settled, isActive: true, sort: "text" }, "global");
  const list = pages.list(items);
  const label = useCatalogAnswerLabels(scope, catalog, values);
  const failed = (detail.isError && !detail.isFetching) || list.failed;
  return <div data-engine-unset={values.length === 0 ? "" : undefined}><FormField label={t("condition.is")} help={single ? t("condition.catalogSingle") : undefined}>
    <DisabledReason reason={lockedReason} className="grid w-full"><Picker multiple label={t("condition.is")} disabled={off} value={values} placeholder={t("condition.chooseAnswers")}
      max={single ? 1 : undefined} options={list.options.map(item => ({ id: item.id, label: administrativeName(item.text, scope.culture) }))}
      selectedOptions={values.map(value => ({ id: value, label: label(value) }))}
      search={pages.search} onSearchChange={pages.onSearchChange} total={list.total} loading={!failed && ((detail.isFetching && !detail.data) || list.loading)} failed={failed}
      onRetry={() => { void detail.refetch(); void items.refetch(); }} onLoadMore={list.onLoadMore} loadingMore={list.loadingMore} pageSize={list.pageSize}
      onChange={onChange} /></DisabledReason>
  </FormField></div>;
}

/**
 * «Se muestra» of a question (CO1-A): «Siempre» or «Según otra respuesta», with «Si» (an earlier choose-one question, own or from a
 * catalog, or a yes or no, outside the block) and «es» (the answers that show it). Neither the block nor its questions have it.
 * Bound by the library standard (BI1-A), the condition stays, with its reason on each control. In a form that goes through
 * WhatsApp (`whatsApp`), what it cannot publish is stopped or said here: one answer of a catalog question, and a fourth condition
 * in a row.
 */
export function ConditionSettings({ question, questions, culture, original, readOnly, lockedReason, error, scope, whatsApp = false, onChange }: {
  question: DraftQuestion; questions: readonly DraftQuestion[]; culture: FormCulture; original: FormCulture; readOnly: boolean;
  lockedReason?: string | null; error?: string; scope: CatalogReadScope; whatsApp?: boolean; onChange: (question: DraftQuestion) => void;
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
  // The list of several applies its marks at once (on the phone, all of them with «Listo»).
  const answer = (next: readonly string[]) => onChange([...(showWhen?.values ?? []).filter(value => !next.includes(value)).map(value => [value, false] as const),
    ...next.filter(value => !showWhen?.values.includes(value)).map(value => [value, true] as const)].reduce((current, [value, chosen]) => toggleConditionAnswer(current, value, chosen, order), question));
  const labelOf = (value: string) => { const answer = answers?.find(item => item.id === value); return answer ? answerLabel(answer, culture, original, t("yes"), t("no")) : t("condition.unavailable"); };
  return <div data-question-control="showWhen" className="flex flex-col gap-3">
    <div className="flex flex-col gap-1.5">
      <GroupLabel id={question.localId + "-condition"} help={t("condition.help")}>{t("condition.shows")}</GroupLabel>
      {/* wrap: in English, «Always | Depending on another answer» does not fit a phone of 320 px in one row. */}
      <SegmentedControl aria-label={t("condition.shows")} disabled={readOnly} wrap options={[
        { key: "always", label: t("condition.always"), pressed: !showWhen, onSelect: () => onChange(withCondition(question, false)), disabledReason: lockedReason ?? undefined },
        { key: "answer", label: t("condition.byAnswer"), pressed: !!showWhen, onSelect: () => onChange(withCondition(question, true)),
          disabledReason: lockedReason ?? (!showWhen && candidates.length === 0 ? t("condition.noQuestions") : undefined) },
      ]} />
    </div>
    {showWhen ? <div className="grid items-start gap-4 sm:grid-cols-2">
      {/* The question still to choose is where the editor takes the focus (CO1-A). */}
      <div data-engine-unset={showWhen.questionId ? undefined : ""}><FormField label={t("condition.if")}><DisabledReason reason={lockedReason}><Picker label={t("condition.if")}
        disabled={readOnly || !!lockedReason} value={showWhen.questionId} placeholder={t("condition.choose")} onChange={id => onChange(chooseConditionQuestion(question, id))}
        options={[...showWhen.questionId && !candidate ? [{ id: showWhen.questionId, label: t("condition.unavailableQuestion") }] : [],
          ...candidates.map(item => ({ id: item.id, label: t("condition.question", { label: item.label, number: item.number }) }))]} />
      </DisabledReason></FormField></div>
      {candidate?.kind === "catalog" && candidate.catalog
        ? <CatalogAnswers scope={scope} catalog={candidate.catalog} values={showWhen.values} readOnly={readOnly} lockedReason={lockedReason} single={whatsApp} onChange={answer} />
        : <QuestionChips label={t("condition.is")} chips={showWhen.values.map(value => ({ id: value, label: labelOf(value) }))}
          options={(answers ?? []).filter(answer => !showWhen.values.includes(answer.id)).map(answer => ({ id: answer.id, label: answerLabel(answer, culture, original, t("yes"), t("no")) }))}
          addLabel={t("condition.add")} removeLabel={label => t("condition.remove", { label })} readOnly={readOnly} lockedReason={lockedReason}
          addReason={!candidate ? t("condition.chooseFirst") : (answers ?? []).every(answer => showWhen.values.includes(answer.id)) ? t("condition.allChosen") : null}
          onAdd={value => toggle(value, true)} onRemove={value => toggle(value, false)} />}
    </div> : null}
    {error ?? (whatsApp && showWhen && conditionDepth(questions, question) > 3 ? t("condition.tooDeep") : null)
      ? <p role="alert" className="text-sm text-[var(--color-danger)]">{error ?? t("condition.tooDeep")}</p> : null}
  </div>;
}
