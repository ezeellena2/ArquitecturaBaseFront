import type { MouseEvent } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router";
import { CellText } from "@/shared/ui/CellText";
import { FormRecordFiles } from "@/shared/ui/FormRecordFiles";
import { formatTypedValue } from "@/shared/lib/typedValue";
import { ExternalLinkIcon } from "@/shared/ui/icons";
import { formatAccuracy, formatCoordinates, mapUrl, toLocationPoint } from "../locationAnswer";
import { responseFiles, responseRowsSummary, responseValueText, type ResponseCell } from "../responses";
import type { PrivateFormFile } from "@/shared/api/formFiles";
export function ResponseValue({
  cell,
  actor,
  recordId,
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
        {point.accuracyMeters !== undefined ? <span className="text-[var(--color-content-muted)]">{formatAccuracy(point.accuracyMeters, i18n.language)}</span> : null}
        <a {...external} className="inline-flex items-center gap-1 text-[var(--color-brand-700)] underline">{t("responses.viewOnMap")}<ExternalLinkIcon className="size-3.5 shrink-0"/></a></p>
    </div>;
  }
  const text =
    typeof cell.value === "string" && (cell.type === "decimal" || cell.type === "date")
      ? (formatTypedValue(cell.type, cell.value, i18n.language) ?? cell.value)
      : responseValueText(
          cell,
          t("responses.unanswered"),
          t("responses.yes"),
          t("responses.no"),
        );
  return (
    <div
      className={
        detail ? "min-w-0 break-words whitespace-pre-wrap" : cell.type === "multiChoice" ? "max-w-64 break-words whitespace-normal" : "max-w-64 truncate"
      }
    >
      {/* Nothing goes under the value (VF3, R2-A, 2026-11-22): neither the catalog, which the question already names, nor the
          detail or the data of the option, which are columns or rows of their own. A multiple choice wraps in the sheet: a code
          among its labels stays whole (2026-11-02). */}
      <span>{cell.type === "multiChoice" ? <CellText text={text} /> : text}</span>
    </div>
  );
}
