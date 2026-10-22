import { ApiError } from "@/shared/api/ApiError";
import { useTranslation } from "react-i18next";
import { Banner } from "@/shared/ui/Banner";
import { Button } from "@/shared/ui/button";
import type { UseQueryResult } from "@tanstack/react-query";
import type { ChatFormPreparation } from "../api/forms";

const issueKeys: Readonly<Record<string,string>> = {
  "Forms.Record.CatalogUnavailable":"unavailable", "Forms.Record.CatalogTooLarge":"tooLarge",
  "Forms.Record.CatalogTooLargeForMultiple":"tooLargeForMultiple",
  "Forms.Record.CatalogEmpty":"empty", "Forms.Record.CatalogOptionInvalid":"invalidOption",
};
export function FormCatalogPreparation({query,waiting,hasCatalogQuestions}: {query:UseQueryResult<ChatFormPreparation>,waiting:boolean,hasCatalogQuestions:boolean}) {
  const {t}=useTranslation("whatsapp");
  if(query.isPending) return <p role="status" className="text-sm text-[var(--color-content-muted)]">{t(hasCatalogQuestions?"forms.catalogs.loading":"forms.preparing")}</p>;
  if(query.isError && query.error instanceof ApiError && query.error.status===409)
    return <Banner tone="danger">{t(query.error.code==="WhatsApp.Flow.RecipientContextChanged"?"forms.recipientChanged":"forms.formUnavailable")}</Banner>;
  if(query.isError) return <div className="flex items-center justify-between gap-2"><p className="text-sm">{t(hasCatalogQuestions?"forms.catalogs.loadFailed":"forms.preparationFailed")}</p>
    <Button type="button" variant="outline" size="sm" disabled={waiting||query.isFetching} onClick={()=>void query.refetch()}>{t("retry")}</Button></div>;
  return <div className="flex flex-col gap-2">
    {query.data.preparation.catalogs.map(offer=><Banner key={offer.fieldId}>{t("forms.catalogs.options",{label:offer.label,count:offer.count})}</Banner>)}
    {query.data.preparation.issues.map(issue=><Banner key={issue.fieldId} tone="danger">{t("forms.catalogs."+(issueKeys[issue.code]??"unavailable"),{label:issue.label,catalog:issue.catalogName,count:issue.invalidOptionCount ?? undefined})}</Banner>)}
  </div>;
}
