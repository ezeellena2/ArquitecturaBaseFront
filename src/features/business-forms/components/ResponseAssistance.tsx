import { Fragment, useId, useState, type ReactNode } from "react";
import { Link } from "react-router";
import { useTranslation } from "react-i18next";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import type { ResponseDetail } from "../api/responses";
import { readingChoiceData, readingChoices, readingDatumText } from "../responseReading";
import { ResponseValue } from "./ResponseValue";

export function ResponseAssistance({ record, actor, busy, onForbidden, onError }: {
 record: ResponseDetail; actor: string; busy: boolean; onForbidden: () => void; onError: (error: unknown) => void;
}) {
 const { t, i18n } = useTranslation("forms"); const [expanded, setExpanded] = useState(false); const contentId = useId();
 const assistance = record.assistance;
 // DOC5-A: the document of «Documentos recibidos» it came from and who passed it to the form, with the way to it; the server names it only
 // to whoever sees the inbox.
 const origin = record.origin; const document = origin?.document;
 if (!assistance && record.chain.length === 0 && !document) return null;
 return <section className="mt-4 space-y-3 border-t border-[var(--color-border)] pt-4" aria-label={t("detail.assistance.origin")}>
  <h3 className="text-sm font-semibold">{t("detail.assistance.origin")}</h3>
  {document ? <div className="space-y-1 text-sm">
   {/* VC1-A: a row of a spreadsheet names its spreadsheet and its row. */}
   <p className="break-words">{document.row ? t(document.row.sheet === null ? "detail.assistance.spreadsheet" : "detail.assistance.spreadsheetSheet",
    { name: document.name, number: String(document.row.number), sheet: document.row.sheet ?? "" }) : t("detail.assistance.document", { name: document.name })}</p>
   {origin?.channelId === "documents" && origin.senderName ? <p className="text-[var(--color-content-muted)]">{t("detail.assistance.passedBy", { name: origin.senderName })}</p> : null}
   <Link className="text-[var(--color-brand-700)] underline" to={"/formularios/documentos/" + document.id}>{t("detail.assistance.viewDocument")}</Link>
  </div> : null}
  {assistance ? <>
   <p className="text-sm">{assistance.senderKind === "Assistant" ? t("detail.assistance.preparedByAssistant") : t("detail.assistance.preparedBy")} {assistance.senderKind === "Manual" ? <strong>{assistance.operator?.displayName ?? t("responses.unknownPerson")}</strong> : null}</p>
   {assistance.suggestion ? <p className="text-sm text-[var(--color-content-muted)]">{assistance.suggestion.mode === "Always" ? t("detail.assistance.always") : t("suggestions.modes.Assistant")}</p> : null}
   {assistance.reason ? <p className="whitespace-pre-wrap break-words text-sm">{assistance.reason}</p> : null}
   {assistance.values.length ? <>
    <Button variant="link" size="inline" aria-expanded={expanded} aria-controls={contentId} onClick={() => setExpanded(value => !value)}>{t(expanded ? "detail.assistance.hideProposed" : "detail.assistance.showProposed")}</Button>
    {expanded ? <div id={contentId} role="region" aria-label={t("detail.assistance.proposed")}><dl className="divide-y divide-[var(--color-border)]">{assistance.values.map(item => {
     // Nothing goes under the value (VF3, R1): the mark goes in the label's row, and the detail and the data of an option chosen
     // are rows of their own, «Pregunta · Detalle» and «Pregunta · Dato».
     const chosen = readingChoices(item.proposed.value);
     const details = chosen.flatMap(choice => choice.detail ? [choice.detail] : []);
     const row = (key: string, term: ReactNode, value: ReactNode, muted = false) => <div key={key} className="grid gap-1 py-2 text-sm sm:grid-cols-2 sm:gap-3">
      <dt className="flex min-w-0 flex-wrap items-center gap-2 text-[var(--color-content-muted)]">{term}</dt>
      <dd className={muted ? "min-w-0 break-words text-[var(--color-content-muted)]" : "min-w-0"}>{value}</dd></div>;
     return <Fragment key={item.proposed.fieldId}>
      {row("value", <><span>{item.proposed.label}</span><Badge variant="outline">{t(!item.included ? "detail.assistance.excluded" : item.changed ? "detail.assistance.changed" : "detail.assistance.included")}</Badge></>,
       <ResponseValue cell={{ ...item.proposed, state: item.proposed.value === null ? "Unanswered" : "Answered" }} actor={actor} recordId={record.id} label={item.proposed.label} detail detailLink="" onForbidden={onForbidden} onError={onError}/>)}
      {details.length ? row("detail", item.proposed.label + " · " + t("responses.optionDetail"), details.join(", "), true) : null}
      {readingChoiceData(item.proposed.label, chosen).map(datum => row(datum.key, datum.label, readingDatumText(chosen, datum.fieldId, i18n.language, t("responses.yes"), t("responses.no")), true))}
     </Fragment>;
    })}</dl></div> : null}
   </> : null}
  </> : null}
  {record.chain.length ? <div><h4 className="text-sm font-semibold">{t("detail.assistance.chain")}</h4><ol className="mt-1 space-y-1 text-sm">{record.chain.map(item => <li key={item.id}>{item.id === record.id || busy ? <span aria-current={item.id === record.id ? "page" : undefined}>{item.number} · {item.name}</span> : <Link className="text-[var(--color-brand-700)] underline" to={"/formularios/" + item.definitionId + "/respuestas/" + item.id}>{item.number} · {item.name}</Link>}</li>)}</ol></div> : null}
 </section>;
}

export function ResponseAssistanceBadges({ record, fieldId }: { record: ResponseDetail; fieldId: string }) {
 const { t } = useTranslation("forms"); const item = record.assistance?.values.find(item => item.proposed.fieldId === fieldId && item.included);
 if (!item) return null;
 const source = record.chain.find(row => row.id === record.assistance?.suggestion?.originRecordId);
 return <div className="flex flex-wrap gap-1">{item.mapped ? <Badge variant="outline">{source ? t("detail.assistance.from", { name: source.name }) : t("detail.assistance.mapped")}</Badge> : null}{item.changed ? <Badge variant="outline">{t("detail.assistance.changed")}</Badge> : null}</div>;
}
