import { useTranslation } from "react-i18next";
import { Banner } from "@/shared/ui/Banner";
import { Button } from "@/shared/ui/button";
import { Spinner } from "@/shared/ui/Spinner";
import { Surface } from "@/shared/ui/Surface";
import type { FormIssuePreview } from "../api/entries";
import { issueMoney, issueText } from "../issuePreview";
import { ResultData } from "./ResultData";

/**
 * IV1-A: on a form that issues, the «Total» as the issuer itemizes it while loading (net, the VAT of each rate, exempt and not
 * taxed, then the total), with the common grid of data. It shows only what the issuer itemizes; the server recalculates on sending.
 * A reading that failed says so, with «Volver a probar».
 */
export function IssueTotals({ totals, pending, failed = false, onRetry }: { totals: FormIssuePreview | null; pending: boolean; failed?: boolean; onRetry?: () => void }) {
  const { t, i18n } = useTranslation(["formEntries", "common"]);
  if (failed) return <Banner tone="warning" action={onRetry ? <Button type="button" variant="outline" size="sm" onClick={onRetry}>{t("formEntries:issue.retry")}</Button> : undefined}>
    {t("formEntries:issue.totalsFailed")}</Banner>;
  if (!totals?.amounts?.length) return pending ? <div role="status" aria-label={t("formEntries:issue.totalsLoading")} className="flex justify-end"><Spinner/></div> : null;
  return <Surface title={t("formEntries:issue.totalsTitle")} padded>
    <ResultData layout="fit" items={[
      ...totals.amounts.map((amount, index) => ({ key: "amount:" + index, label: issueText(amount.label, i18n.language), value: issueMoney(amount.value, i18n.language, t), numeric: true })),
      { key: "total", label: t("formEntries:issue.total"), value: issueMoney(totals.total, i18n.language, t), numeric: true, strong: true },
    ]}/>
  </Surface>;
}
