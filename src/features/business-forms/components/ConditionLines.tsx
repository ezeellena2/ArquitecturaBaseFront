import { useTranslation } from "react-i18next";
import { ruleConditionSummaries, type ConditionQuestionSummary, type ResponseColumn, type ResponseCondition } from "../responses";

/**
 * The conditions of a rule or a suggestion as their step reads them (board LR1-A): one per line, with «Si» and «y» in grey at
 * its start, the question and the value in bold and the words that join them in grey. The conditions of a block of rows read
 * together (RG5-A): «Si algún ítem de Artículos con Artículo es GLIFOSATO 64% y Cantidad desde 100».
 */
export function ConditionLines({ conditions, columns }: { conditions: readonly ResponseCondition[]; columns: readonly ResponseColumn[] }) {
  const { t, i18n } = useTranslation("forms");
  const muted = "text-[var(--color-content-muted)]";
  const question = (summary: ConditionQuestionSummary) => <><span className="font-semibold">{summary.question || t("rules.missingQuestion")}</span>
    {summary.clauses.map((clause, position) => <span key={position}> <span className={muted}>{clause.words}</span>{clause.values ? <> <span className="font-semibold">{clause.values}</span></> : null}</span>)}</>;
  return <ul className="space-y-0.5">{ruleConditionSummaries(conditions, columns, t, i18n.language).map((line, index) => <li key={line.key}>
    <span className={muted}>{t(index ? "rules.conditionWords.and" : "rules.if")}</span>{" "}
    {"block" in line ? <><span className={muted}>{t("rules.conditionWords.someItemOf")}</span> <span className="font-semibold">{line.block}</span> <span className={muted}>{t("rules.conditionWords.with")}</span>
      {line.questions.map((summary, position) => <span key={summary.key}>{position ? <> <span className={muted}>{t("rules.conditionWords.and")}</span></> : null} {question(summary)}</span>)}</> : question(line)}
  </li>)}</ul>;
}
