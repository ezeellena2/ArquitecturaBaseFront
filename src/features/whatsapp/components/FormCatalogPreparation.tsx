import { useTranslation } from "react-i18next";
import { Banner } from "@/shared/ui/Banner";
import { Button } from "@/shared/ui/button";
import type { UseQueryResult } from "@tanstack/react-query";
import type { ChatFormPreparation } from "../api/forms";

const issueKeys: Readonly<Record<string,string>> = {
  "Forms.Record.CatalogUnavailable":"unavailable", "Forms.Record.CatalogTooLarge":"tooLarge",
  "Forms.Record.CatalogEmpty":"empty", "Forms.Record.CatalogOptionInvalid":"invalidOption",
};
export function FormCatalogPreparation({query,waiting}: {query:UseQueryResult<ChatFormPreparation>,waiting:boolean}) {
  const {t}=useTranslation("whatsapp");
  if(query.isPending) return <p role="status" className="text-sm text-[var(--color-content-muted)]">{t("forms.catalogs.loading")}</p>;
  if(query.isError) return <div className="flex items-center justify-between gap-2"><p className="text-sm">{t("forms.catalogs.loadFailed")}</p>
    <Button type="button" variant="outline" size="sm" disabled={waiting||query.isFetching} onClick={()=>void query.refetch()}>{t("retry")}</Button></div>;
  return <div className="flex flex-col gap-2">
    {query.data.preparation.catalogs.map(offer=><Banner key={offer.fieldId}>{t("forms.catalogs.options",{label:offer.label,count:offer.options.length})}</Banner>)}
    {query.data.preparation.issues.map(issue=><Banner key={issue.fieldId} tone="danger">{t("forms.catalogs."+(issueKeys[issue.code]??"unavailable"),{label:issue.label})}</Banner>)}
  </div>;
}
