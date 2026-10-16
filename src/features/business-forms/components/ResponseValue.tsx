import { useTranslation } from "react-i18next";
import { Link } from "react-router";
import { FormRecordFiles } from "@/shared/ui/FormRecordFiles";
import { formatDateOnly } from "@/shared/lib/dateTime";
import { formatExactDecimal } from "@/shared/lib/decimal";
import { responseDocumentFormat, responseValueText, type ResponseCell } from "../responses";
import type { PrivateFormFile } from "@/shared/api/formFiles";
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
  if (
    (cell.type === "photo" || cell.type === "document") &&
    Array.isArray(cell.value)
  ) {
    if (cell.type === "document" && !detail)
      return (
        <Link
          to={detailLink}
          className="text-[var(--color-brand-700)] underline"
        >
          {t("responses.documents", { count: cell.value.length })} ·{" "}
          {[
            ...new Set(
              cell.value.map((file) =>
                responseDocumentFormat(file.contentType),
              ),
            ),
           ].filter(Boolean).join(", ")}
        </Link>
      );
    return (
      <FormRecordFiles
        actor={actor}
        recordId={recordId}
        files={cell.value}
        photo={cell.type === "photo"}
        label={viewerFiles ? t("responses.photos") : label}
        number={number}
        thumbnailLimit={detail ? cell.value.length : 1}
        compact={!detail}
        viewerFiles={viewerFiles}
        onForbidden={onForbidden}
        onError={onError}
      />
    );
  }
  const text =
    typeof cell.value === "string" && cell.type === "decimal"
      ? (formatExactDecimal(cell.value, i18n.language) ?? cell.value)
      : typeof cell.value === "string" && cell.type === "date"
        ? (formatDateOnly(cell.value, i18n.language) ?? cell.value)
        : responseValueText(
            cell,
            t("responses.unanswered"),
            t("responses.yes"),
            t("responses.no"),
          );
  const choice =
    cell.type === "choice" &&
    cell.value &&
    typeof cell.value === "object" &&
    !Array.isArray(cell.value)
      ? cell.value
      : null;
  return (
    <div
      className={
        detail ? "min-w-0 break-words whitespace-pre-wrap" : "max-w-64 truncate"
      }
    >
      <span>{text}</span>
      {choice?.detail ? (
        <p className="text-xs text-[var(--color-content-muted)]">
          {choice.detail}
        </p>
      ) : null}
      {detail && choice?.catalogName ? (
        <p className="text-xs text-[var(--color-content-muted)]">
          {choice.catalogName}
        </p>
      ) : null}
    </div>
  );
}
