import { useTranslation } from "react-i18next";
import { formatDateOnly } from "@/shared/lib/dateTime";
import { InfoTip } from "@/shared/ui/InfoTip";
import { issueMoney, issueText } from "../issuePreview";
import { ResultData } from "./ResultData";

type Localized = Readonly<Record<string, string>>;
/** What «¿La emito?» says, as the preview of the app and the confirmation of a channel bring it. */
export interface IssueSummaryData {
  readonly document: Localized | null; readonly info?: Localized; readonly receiver: string | null; readonly date?: string;
  readonly amounts?: readonly { readonly label: Localized; readonly value: string }[]; readonly total: string | null;
}

/**
 * The summary of «¿La emito?» (EM2-A with IV3), the same in the app's dialog and in «Esperando que lo confirmes»: the document
 * with why in its (i), the customer, the date, the amounts it itemizes and the total.
 */
export function IssueSummary({ summary, label, layout }: { summary: IssueSummaryData; label?: string; layout?: "four" | "two" }) {
  const { t, i18n } = useTranslation(["forms", "common"]);
  const language = i18n.language;
  const info = issueText(summary.info, language);
  return <ResultData label={label} layout={layout} items={[
    { key: "document", label: t("forms:issuance.document"),
      value: <span className="inline-flex items-center gap-1">{issueText(summary.document, language) || "—"}{info ? <InfoTip label={t("forms:issuance.why")} text={info}/> : null}</span> },
    { key: "receiver", label: t("forms:issuance.receiver"), value: summary.receiver ?? "—" },
    ...summary.date ? [{ key: "date", label: t("forms:issuance.date"), value: formatDateOnly(summary.date, language) ?? summary.date }] : [],
    ...(summary.amounts ?? []).map((amount, index) => ({ key: "amount:" + index, label: issueText(amount.label, language), value: issueMoney(amount.value, language, t), numeric: true })),
    { key: "total", label: t("forms:issuance.total"), value: issueMoney(summary.total, language, t), numeric: true, strong: true },
  ]}/>;
}
