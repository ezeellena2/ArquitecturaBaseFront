import { useTranslation } from "react-i18next";
import { ruleConditionSummaries, type ResponseColumn, type ResponseCondition } from "../responses";

/**
 * The conditions of a rule or a suggestion as their step reads them (board LR1-A): one per line, with «Si» and «y» in grey at
 * its start, the question and the value in bold and the words that join them in grey.
 */
export function ConditionLines({ conditions, columns }: { conditions: readonly ResponseCondition[]; columns: readonly ResponseColumn[] }) {
  const { t, i18n } = useTranslation("forms");
  return <ul className="space-y-0.5">{ruleConditionSummaries(conditions, columns, t, i18n.language).map((condition, index) => <li key={condition.key}>
    <span className="text-[var(--color-content-muted)]">{t(index ? "rules.conditionWords.and" : "rules.if")}</span> <span className="font-semibold">{condition.question || t("rules.missingQuestion")}</span>
    {condition.clauses.map((clause, position) => <span key={position}> <span className="text-[var(--color-content-muted)]">{clause.words}</span>{clause.values ? <> <span className="font-semibold">{clause.values}</span></> : null}</span>)}
  </li>)}</ul>;
}
