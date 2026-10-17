import { useId, useState } from "react";
import { Link } from "react-router";
import { useTranslation } from "react-i18next";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import type { ResponseDetail } from "../api/responses";
import { ResponseValue } from "./ResponseValue";

export function ResponseAssistance({ record, actor, busy, onForbidden, onError }: {
 record: ResponseDetail; actor: string; busy: boolean; onForbidden: () => void; onError: (error: unknown) => void;
}) {
 const { t } = useTranslation("forms"); const [expanded, setExpanded] = useState(false); const contentId = useId();
 const assistance = record.assistance;
 if (!assistance && record.chain.length === 0) return null;
 return <section className="mt-4 space-y-3 border-t border-[var(--color-border)] pt-4" aria-label={t("detail.assistance.origin")}>
  <h3 className="text-sm font-semibold">{t("detail.assistance.origin")}</h3>
  {assistance ? <>
   <p className="text-sm">{assistance.senderKind === "Assistant" ? t("detail.assistance.preparedByAssistant") : t("detail.assistance.preparedBy")} {assistance.senderKind === "Manual" ? <strong>{assistance.operator?.displayName ?? t("responses.unknownPerson")}</strong> : null}</p>
   {assistance.suggestion ? <p className="text-sm text-[var(--color-content-muted)]">{assistance.suggestion.mode === "Always" ? t("detail.assistance.always") : t("suggestions.modes.Assistant")}</p> : null}
   {assistance.reason ? <p className="whitespace-pre-wrap break-words text-sm">{assistance.reason}</p> : null}
   {assistance.values.length ? <>
    <Button variant="link" size="inline" aria-expanded={expanded} aria-controls={contentId} onClick={() => setExpanded(value => !value)}>{t(expanded ? "detail.assistance.hideProposed" : "detail.assistance.showProposed")}</Button>
    {expanded ? <div id={contentId} role="region" aria-label={t("detail.assistance.proposed")}><dl className="divide-y divide-[var(--color-border)]">{assistance.values.map(item => <div key={item.proposed.fieldId} className="space-y-1 py-2 text-sm"><dt className="text-[var(--color-content-muted)]">{item.proposed.label}</dt><dd><ResponseValue cell={{ ...item.proposed, state: item.proposed.value === null ? "Unanswered" : "Answered" }} actor={actor} recordId={record.id} number={record.number} label={item.proposed.label} detail detailLink="" onForbidden={onForbidden} onError={onError}/><Badge variant="outline">{t(!item.included ? "detail.assistance.excluded" : item.changed ? "detail.assistance.changed" : "detail.assistance.included")}</Badge></dd></div>)}</dl></div> : null}
   </> : null}
  </> : null}
  {record.chain.length ? <div><h4 className="text-sm font-semibold">{t("detail.assistance.chain")}</h4><ol className="mt-1 space-y-1 text-sm">{record.chain.map(item => <li key={item.id}>{item.id === record.id || busy ? <span aria-current={item.id === record.id ? "page" : undefined}>{item.number} · {item.name}</span> : <Link className="text-[var(--color-brand-700)] underline" to={"/formularios/" + item.definitionId + "/respuestas/" + item.id}>{item.number} · {item.name}</Link>}</li>)}</ol></div> : null}
 </section>;
}

export function ResponseAssistanceBadges({ record, fieldId }: { record: ResponseDetail; fieldId: string }) {
 const { t } = useTranslation("forms"); const item = record.assistance?.values.find(item => item.proposed.fieldId === fieldId && item.included);
 if (!item) return null;
 const source = record.chain.find(row => row.id === record.assistance?.suggestion?.originRecordId);
 return <div className="mt-1 flex flex-wrap gap-1">{item.mapped ? <Badge variant="outline">{source ? t("detail.assistance.from", { name: source.name }) : t("detail.assistance.mapped")}</Badge> : null}{item.changed ? <Badge variant="outline">{t("detail.assistance.changed")}</Badge> : null}</div>;
}
