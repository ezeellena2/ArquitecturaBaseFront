import type { MouseEvent } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router";
import { CellText } from "@/shared/ui/CellText";
import { FormRecordFiles } from "@/shared/ui/FormRecordFiles";
import { formatTypedValue } from "@/shared/lib/typedValue";
import { ExternalLinkIcon } from "@/shared/ui/icons";
import { formatAccuracy, formatCoordinates, mapUrl, toLocationPoint } from "../locationAnswer";
import { responseCatalogFieldText, responseFiles, responseRowsSummary, responseValueText, selectedResponseChoices, type ResponseCell, type ResponseChoice } from "../responses";
import type { PrivateFormFile } from "@/shared/api/formFiles";
// The captured fields of an option, aligned under its value (board TL1-A): the field in grey and its value in the text color,
// with a line that ties them to the value.
function CapturedFields({ choice, culture, yes, no }: { choice: ResponseChoice; culture: string; yes: string; no: string }) {
  return choice.fields?.length ? <dl className="mt-1 grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-0.5 border-l-2 border-[var(--color-surface-header)] pl-2.5 text-xs whitespace-normal">{choice.fields.map(field => <div key={field.fieldId} className="contents"><dt className="text-[var(--color-content-muted)]">{field.label}</dt><dd className="min-w-0 break-words">{responseCatalogFieldText(field, culture, yes, no)}</dd></div>)}</dl> : null;
}
export function ResponseValue({
  cell,
  actor,
  recordId,
  number,
  label,
  detail = false,
  viewerFiles,
  onForbidden,
  onError,
  detailLink,
  onOpenDetail,
}: {
  cell: ResponseCell;
  actor: string;
  recordId: string;
  number: string;
  label: string;
  detail?: boolean;
  viewerFiles?: readonly PrivateFormFile[];
  onForbidden: () => void;
  onError: (error: unknown) => void;
  detailLink: string;
  onOpenDetail?: () => void;
}) {
  const { t, i18n } = useTranslation("forms");
  if (cell.state !== "Answered")
    return (
      <span className="text-[var(--color-content-muted)]">
        {responseValueText(
          cell,
          t("responses.unanswered"),
          t("responses.yes"),
          t("responses.no"),
        )}
      </span>
    );
  // One piece of data per column (UD4): a block says how many items it has and a set of documents how many there are; what
  // is inside, and the formats, are read when the response opens.
  const openDetail = (event: MouseEvent) => { if (!event.defaultPrevented && event.button === 0 && !event.ctrlKey && !event.metaKey && !event.shiftKey && !event.altKey) onOpenDetail?.(); };
  const toDetail = (text: string) => detailLink ? <Link to={detailLink} onClick={openDetail} className="text-[var(--color-brand-700)] underline">{text}</Link> : text;
  const rows = responseRowsSummary(cell);
  if (rows) return toDetail(t("rows.items", { count: rows.count }));
  const files = responseFiles(cell);
  if (
    (cell.type === "photo" || cell.type === "document") &&
    Array.isArray(cell.value)
  ) {
    if (cell.type === "document" && !detail) return toDetail(t("responses.documents", { count: files.length }));
    return (
      <FormRecordFiles
        actor={actor}
        recordId={recordId}
        files={files}
        photo={cell.type === "photo"}
        label={viewerFiles ? t("responses.photos") : label}
        number={number}
        thumbnailLimit={detail ? files.length : 1}
        compact={!detail}
        viewerFiles={viewerFiles}
        onForbidden={onForbidden}
        onError={onError}
      />
    );
  }
  // UB4-A: a point is one datum. In the sheet the point itself is the link to the map, without its accuracy; in the detail «Ver
  // en el mapa» goes next to it and the accuracy, in grey, under it. The map opens in another tab.
  const point = cell.type === "location" ? toLocationPoint(cell.value) : null;
  if (point) {
    const coordinates = formatCoordinates(point);
    const external = { href: mapUrl(point), target: "_blank", rel: "noopener noreferrer" } as const;
    if (!detail) return <a {...external} className="inline-flex items-center gap-1 whitespace-nowrap tabular-nums text-[var(--color-brand-700)] underline">
      {coordinates}{" "}<ExternalLinkIcon className="size-3.5 shrink-0"/><span className="sr-only">{t("responses.viewOnMap")}</span></a>;
    return <div className="min-w-0">
      <p className="flex flex-wrap items-center gap-x-3 gap-y-1"><span className="tabular-nums">{coordinates}</span>
        <a {...external} className="inline-flex items-center gap-1 text-[var(--color-brand-700)] underline">{t("responses.viewOnMap")}<ExternalLinkIcon className="size-3.5 shrink-0"/></a></p>
      {point.accuracyMeters !== undefined ? <p className="text-xs text-[var(--color-content-muted)]">{formatAccuracy(point.accuracyMeters, i18n.language)}</p> : null}
    </div>;
  }
  const choices = selectedResponseChoices(cell);
  if (cell.type === "multiChoice" && detail)
    return <div className="min-w-0 space-y-2 break-words whitespace-pre-wrap">
      {choices.map(choice => <div key={choice.choiceId}>
        <span className={choice.fields?.length ? "font-medium" : undefined}>{choice.label}</span>
        {choice.detail ? <p className="text-xs text-[var(--color-content-muted)]">{choice.detail}</p> : null}
        <CapturedFields choice={choice} culture={i18n.language} yes={t("responses.yes")} no={t("responses.no")}/>
      </div>)}
    </div>;
  const text =
    typeof cell.value === "string" && (cell.type === "decimal" || cell.type === "date")
      ? (formatTypedValue(cell.type, cell.value, i18n.language) ?? cell.value)
      : responseValueText(
          cell,
          t("responses.unanswered"),
          t("responses.yes"),
          t("responses.no"),
        );
  const choice = cell.type === "choice" ? choices[0] : undefined;
  return (
    <div
      className={
        detail ? "min-w-0 break-words whitespace-pre-wrap" : cell.type === "multiChoice" ? "max-w-64 break-words whitespace-normal" : "max-w-64 truncate"
      }
    >
      {/* The detail no longer repeats the catalog's name under the value (TL1-A): the question already says it. A multiple
          choice wraps in the sheet: a code among its labels stays whole (2026-11-02). */}
      <span className={detail && choice?.fields?.length ? "font-medium" : undefined}>{cell.type === "multiChoice" ? <CellText text={text} /> : text}</span>
      {choice?.detail ? (
        <p className="text-xs text-[var(--color-content-muted)]">
          {choice.detail}
        </p>
      ) : null}
      {detail && choice ? <CapturedFields choice={choice} culture={i18n.language} yes={t("responses.yes")} no={t("responses.no")}/> : null}
    </div>
  );
}
