import { FormReplyFiles } from "./FormReplyFiles";
import { Fragment, useId, useState, type RefObject } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/shared/ui/button";
import { mapUrl } from "@/shared/lib/mapPoint";
import { cn } from "@/shared/lib/utils";
import { ExternalLinkIcon } from "@/shared/ui/icons";
import { formatFormReplyItem, formatFormReplyValue, type FormReplyDisplayRow } from "../lib/formReplyValue";

export type { FormReplyDisplayRow } from "../lib/formReplyValue";

export function FormReplyValues({ rows, preserveViewport, actor="", recordId, onForbidden=()=>undefined, onFileError=()=>undefined, focusFallback, date }: {
  rows: readonly FormReplyDisplayRow[]; actor?:string; recordId?:string;onForbidden?:()=>void;date?:string;onFileError?:(error:unknown)=>void;focusFallback?:RefObject<HTMLElement|null>;
  preserveViewport?: (change: () => void) => void;
}) {
  const { t, i18n } = useTranslation("whatsapp");
  const [expanded, setExpanded] = useState(false);
  const id = useId();
  const labels = { missing: t("forms.reply.missing"), yes: t("forms.reply.yes"), no: t("forms.reply.no") };
  const values = rows.map(row => ({ ...row, text: formatFormReplyValue(row.answer, i18n.resolvedLanguage ?? "es", labels) }));
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
      {shown.map(row => {
        const columns = cn("grid min-w-0 grid-cols-1 gap-1 px-3 py-2 sm:gap-3", row.answer.type === "photo" || row.answer.type === "document" ? "sm:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]" : "sm:grid-cols-2");
        // Nothing goes under the answer (VF3, 2026-11-22): the question already names the catalog, and the details of the options
        // chosen go in a row of their own, «Fallas · Detalle», in the order of the options.
        const details = row.answer.type === "choice" ? row.answer.detail ? [row.answer.detail] : []
          : row.answer.type === "multiChoice" ? row.answer.value?.flatMap(choice => choice.detail ? [choice.detail] : []) ?? [] : [];
        return <Fragment key={row.id}>
          <div className={columns}>
            <dt className="min-w-0 break-words text-sm text-[var(--color-content-muted)]">{row.label}</dt>
            <dd className={cn("min-w-0 break-words whitespace-pre-wrap text-sm", !expanded && row.answer.type === "longText" && "line-clamp-3")}>{row.answer.type==="photo"||row.answer.type==="document" ? recordId ? <FormReplyFiles actor={actor} recordId={recordId} files={row.answer.value} photo={row.answer.type==="photo"} label={row.label} onForbidden={onForbidden} onError={onFileError} focusFallback={focusFallback} date={date}/> : t("forms.reply.valuesUnavailable") : row.answer.type === "group" && row.answer.value.length
              // A block of rows: an item per line, its answers in order and without the unanswered ones (RG4-A).
              ? <ol aria-label={row.label}>{row.answer.value.map((item, index) => <li key={index}>{`${index + 1}. ${formatFormReplyItem(item, i18n.resolvedLanguage ?? "es", labels)}`}</li>)}</ol>
              // UB4-A: the point itself is the link to the map, as in the sheet, so nothing goes under it.
              : row.answer.type === "location" && row.answer.value ? <a href={mapUrl(row.answer.value)} target="_blank" rel="noopener noreferrer"
                className="inline-flex w-fit items-center gap-1 whitespace-nowrap tabular-nums text-[var(--color-brand-700)] underline">{row.text}{" "}<ExternalLinkIcon className="size-3.5 shrink-0" aria-hidden="true" />
                <span className="sr-only">{t("location.viewOnMap")}</span></a>
              : row.text}</dd>
          </div>
          {details.length ? <div className={columns}>
            <dt className="min-w-0 break-words text-sm text-[var(--color-content-muted)]">{row.label + " · " + t("forms.reply.detail")}</dt>
            <dd className="min-w-0 break-words text-sm text-[var(--color-content-muted)]">{details.join(", ")}</dd>
          </div> : null}
        </Fragment>;
      })}
    </dl>
    {mayFold ? <div className="px-3 py-2"><Button type="button" variant="outline" size="sm" aria-expanded={expanded} aria-controls={id} onClick={toggle}>
      {expanded ? t("forms.reply.showLess") : t("forms.reply.showAll", { count: values.length })}
    </Button></div> : null}
  </div>;
}
