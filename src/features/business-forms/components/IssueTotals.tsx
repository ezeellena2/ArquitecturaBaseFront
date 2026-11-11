import { useTranslation } from "react-i18next";
import { formatExactDecimal } from "@/shared/lib/decimal";
import { Spinner } from "@/shared/ui/Spinner";
import { Surface } from "@/shared/ui/Surface";
import type { FormIssuePreview } from "../api/entries";
import { issueText } from "../issuePreview";

/**
 * IV1-A: on a form that issues, the «Total» as the issuer itemizes it while loading (net, the VAT of each rate, exempt and not
 * taxed, then the total), in a grid of values. It shows only what the issuer itemizes; the server recalculates on sending.
 */
export function IssueTotals({ totals, pending }: { totals: FormIssuePreview | null; pending: boolean }) {
  const { t, i18n } = useTranslation("formEntries");
  if (!totals?.amounts?.length) return pending ? <div role="status" aria-label={t("issue.totalsLoading")} className="flex justify-end"><Spinner/></div> : null;
  const money = (value: string | null) => value ? "$ " + (formatExactDecimal(value, i18n.language) ?? value) : "—";
  return <Surface title={t("issue.totalsTitle")} padded>
    <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm sm:grid-cols-[repeat(auto-fit,minmax(8rem,1fr))]">
      {totals.amounts.map((amount, index) => <div key={index} className="flex min-w-0 flex-col gap-0.5">
        <dt className="text-xs text-[var(--color-content-muted)]">{issueText(amount.label, i18n.language)}</dt>
        <dd className="tabular-nums">{money(amount.value)}</dd>
      </div>)}
      <div className="flex min-w-0 flex-col gap-0.5"><dt className="text-xs text-[var(--color-content-muted)]">{t("issue.total")}</dt><dd className="font-semibold tabular-nums">{money(totals.total)}</dd></div>
    </dl>
  </Surface>;
}
