import { useTranslation } from "react-i18next";
import type { ResponseResult } from "../api/responses";
import { responseResultText } from "../responseResults";
import { ResultData } from "./ResultData";

// RE1-A: what external actions left (the voucher, its number, the authorization code, its expiry and the total), in the order
// they came: the credit note that voids an invoice (NC1-A) follows it after a line. Without a result there is nothing.
export function ResponseResults({ results }: { results: readonly ResponseResult[] | undefined }) {
  const { t, i18n } = useTranslation("forms");
  if (!results?.length) return null;
  return <div className="flex flex-col gap-3">
    {results.map((result, index) => <div key={result.source + ":" + index} className={index ? "border-t border-[var(--color-border)] pt-3" : undefined}>
      <ResultData label={result.name} items={result.values.map(value => ({
        key: value.key, label: value.label, value: responseResultText(value.kind, value.value, i18n.language) ?? t("responses.resultEmpty"), numeric: value.kind === "number",
      }))}/>
    </div>)}
  </div>;
}
