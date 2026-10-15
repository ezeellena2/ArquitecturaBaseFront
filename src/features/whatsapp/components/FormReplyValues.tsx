import { FormReplyFiles } from "./FormReplyFiles";
import { useId, useState, type RefObject } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/shared/ui/button";
import { cn } from "@/shared/lib/utils";
import { formatFormReplyValue, type FormReplyDisplayRow } from "../lib/formReplyValue";

export type { FormReplyDisplayRow } from "../lib/formReplyValue";

export function FormReplyValues({ rows, preserveViewport, actor="", recordId, number="", onForbidden=()=>undefined, onFileError=()=>undefined, focusFallback }: {
  rows: readonly FormReplyDisplayRow[]; actor?:string; recordId?:string;number?:string;onForbidden?:()=>void;onFileError?:(error:unknown)=>void;focusFallback?:RefObject<HTMLElement|null>;
  preserveViewport?: (change: () => void) => void;
}) {
  const { t, i18n } = useTranslation("whatsapp");
  const [expanded, setExpanded] = useState(false);
  const id = useId();
  const values = rows.map(row => ({ ...row, text: formatFormReplyValue(row.answer, i18n.resolvedLanguage ?? "es",
    { missing: t("forms.reply.missing"), yes: t("forms.reply.yes"), no: t("forms.reply.no") }) }));
  if (values.some(row => row.text === null)) return <p className="px-3 py-2 text-sm">{t("forms.reply.valuesUnavailable")}</p>;
  if (!values.length) return null;
  const mayFold = values.length > 3 || values.some(row => row.answer.type === "longText" && (row.text!.length > 240 || row.text!.split("\n").length > 3));
  const shown = expanded ? values : values.slice(0, 3);
  function toggle() {
    const change = () => setExpanded(value => !value);
    if (preserveViewport) preserveViewport(change); else change();
  }
  return <div role="group" aria-label={t("forms.reply.answers")}>
    <dl id={id} className="divide-y divide-[var(--color-border)]">
      {shown.map(row => <div key={row.id} className={cn("grid min-w-0 grid-cols-1 gap-1 px-3 py-2 sm:gap-3",row.answer.type==="photo"||row.answer.type==="document"?"sm:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]":"sm:grid-cols-2")}>
        <dt className="min-w-0 break-words text-sm text-[var(--color-content-muted)]">{row.label}</dt>
        <dd className={cn("min-w-0 break-words whitespace-pre-wrap text-sm", !expanded && row.answer.type === "longText" && "line-clamp-3")}>{row.answer.type==="photo"||row.answer.type==="document" ? recordId ? <FormReplyFiles actor={actor} recordId={recordId} files={row.answer.value} photo={row.answer.type==="photo"} label={row.label} number={number} onForbidden={onForbidden} onError={onFileError} focusFallback={focusFallback}/> : t("forms.reply.valuesUnavailable") : row.text}{row.answer.type==="choice"&&row.answer.catalogName ? <p className="text-xs text-[var(--color-content-muted)]">{row.answer.catalogName}</p> : null}
          {row.answer.type==="choice"&&row.answer.detail ? <p className="text-xs text-[var(--color-content-muted)]">{row.answer.detail}</p> : null}</dd>
      </div>)}
    </dl>
    {mayFold ? <div className="px-3 py-2"><Button type="button" variant="outline" size="sm" aria-expanded={expanded} aria-controls={id} onClick={toggle}>
      {expanded ? t("forms.reply.showLess") : t("forms.reply.showAll", { count: values.length })}
    </Button></div> : null}
  </div>;
}
