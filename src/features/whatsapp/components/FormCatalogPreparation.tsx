import { ApiError } from "@/shared/api/ApiError";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Banner } from "@/shared/ui/Banner";
import { Button } from "@/shared/ui/button";
import { DisabledReason } from "@/shared/ui/DisabledReason";
import { Spinner } from "@/shared/ui/Spinner";
import type { UseQueryResult } from "@tanstack/react-query";
import type { ChatFormPreparation } from "../api/forms";

const issueKeys: Readonly<Record<string,string>> = {
  "Forms.Record.CatalogUnavailable":"unavailable", "Forms.Record.CatalogTooLarge":"tooLarge",
  "Forms.Record.CatalogTooLargeForMultiple":"tooLargeForMultiple",
  "Forms.Record.RecipientDataMissing":"recipientDataMissing", "Forms.Record.CatalogFilterUnavailable":"filterUnavailable",
  "Forms.Record.CatalogEmpty":"empty", "Forms.Record.CatalogOptionInvalid":"invalidOption",
};
/// `waitReason` is the wait of a 429: it turns off Retry and is its reason. Null when there is no wait.
export function FormCatalogPreparation({query,waitReason,hasCatalogQuestions,recipientName}: {query:UseQueryResult<ChatFormPreparation>,waitReason:string|null,hasCatalogQuestions:boolean,recipientName:string}) {
  const {t}=useTranslation("whatsapp");
  // A retry of a preparation that never arrived turns the query back to pending: the failure stays with its working Retry meanwhile.
  const [retrying,setRetrying]=useState(false);
  const retry=()=>{setRetrying(true);void query.refetch().finally(()=>setRetrying(false));};
  if(query.isPending&&!retrying) return <div role="status" className="flex items-center gap-2 text-sm text-[var(--color-content-muted)]"><Spinner decorative />{t(hasCatalogQuestions?"forms.catalogs.loading":"forms.preparing")}</div>;
  if(query.isError && query.error instanceof ApiError && query.error.status===409)
    return <Banner tone="danger">{t(query.error.code==="WhatsApp.Flow.RecipientContextChanged"?"forms.recipientChanged":"forms.formUnavailable")}</Banner>;
  if(query.isError||retrying) return <div className="flex items-center justify-between gap-2"><p className="text-sm">{t(hasCatalogQuestions?"forms.catalogs.loadFailed":"forms.preparationFailed")}</p>
    <DisabledReason reason={retrying?null:waitReason}><Button type="button" variant="outline" size="sm" pending={retrying} disabled={Boolean(waitReason)} onClick={retry}>{t(retrying?"retrying":"retry")}</Button></DisabledReason></div>;
  if(!query.data) return null;
  return <div className="flex flex-col gap-2">
    {query.data.preparation.catalogs.map(offer=><Banner key={offer.fieldId}>{t("forms.catalogs.options",{label:offer.label,count:offer.count})}</Banner>)}
    {query.data.preparation.issues.map(issue=><Banner key={issue.fieldId} tone="danger">{t("forms.catalogs."+(issueKeys[issue.code]??"unavailable"),{label:issue.label,catalog:issue.catalogName,count:issue.invalidOptionCount ?? undefined,name:recipientName,data:issue.missingData})}</Banner>)}
  </div>;
}
