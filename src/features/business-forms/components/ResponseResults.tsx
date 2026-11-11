import { useTranslation } from "react-i18next";
import type { ResponseResult } from "../api/responses";
import { responseResultText } from "../responseResults";

// RE1-A: what an external action left («Emitir comprobante en ARCA»: voucher, authorization code and its expiry) is a zone with the
// action's name above the answers, its data in sight: the label in grey above, the value below, in three columns (one on a phone).
// Without a result there is no zone.
export function ResponseResults({ results }: { results: readonly ResponseResult[] | undefined }) {
  const { t, i18n } = useTranslation("forms");
  if (!results?.length) return null;
  return <div className="flex flex-col gap-3 border-b border-[var(--color-border)] pb-3">
    {results.map(result => <section key={result.source} aria-labelledby={"result-" + result.source} className="flex flex-col gap-2">
      <h3 id={"result-" + result.source} className="text-sm font-semibold">{result.name}</h3>
      <dl className="grid grid-cols-1 gap-x-4 gap-y-2 sm:grid-cols-3">
        {result.values.map(value => <div key={value.key} className="flex min-w-0 flex-col gap-0.5">
          <dt className="text-xs text-[var(--color-content-muted)]">{value.label}</dt>
          <dd className="min-w-0 break-words text-sm">{responseResultText(value.kind, value.value, i18n.language) ?? t("responses.resultEmpty")}</dd>
        </div>)}
      </dl>
    </section>)}
  </div>;
}
