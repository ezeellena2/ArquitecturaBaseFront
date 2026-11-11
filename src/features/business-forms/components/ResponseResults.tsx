import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import type { ResponseResult } from "../api/responses";
import { responseResultText } from "../responseResults";

export interface ResultDatum { readonly key: string; readonly label: string; readonly value: ReactNode; readonly strong?: boolean }

// The data of a result in sight, each in its place: the label in grey above, the value below, four per row (two on a phone),
// as the zone «Comprobante» draws them (EM1-A). The group is named after what it reads.
export function ResultData({ label, items }: { label: string; items: readonly ResultDatum[] }) {
  return <div role="group" aria-label={label}><dl className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-4">
    {items.map(item => <div key={item.key} className="flex min-w-0 flex-col gap-0.5">
      <dt className="text-xs text-[var(--color-content-muted)]">{item.label}</dt>
      <dd className={"min-w-0 break-words text-sm" + (item.strong ? " font-semibold" : "")}>{item.value}</dd>
    </div>)}
  </dl></div>;
}

// RE1-A: what external actions left (the voucher, its number, the authorization code, its expiry and the total), in the order
// they came: the credit note that voids an invoice (NC1-A) follows it after a line. Without a result there is nothing.
export function ResponseResults({ results }: { results: readonly ResponseResult[] | undefined }) {
  const { t, i18n } = useTranslation("forms");
  if (!results?.length) return null;
  return <div className="flex flex-col gap-3">
    {results.map((result, index) => <div key={result.source + ":" + index} className={index ? "border-t border-[var(--color-border)] pt-3" : undefined}>
      <ResultData label={result.name} items={result.values.map(value => ({
        key: value.key, label: value.label, value: responseResultText(value.kind, value.value, i18n.language) ?? t("responses.resultEmpty"),
      }))}/>
    </div>)}
  </div>;
}
