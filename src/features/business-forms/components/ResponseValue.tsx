import { useTranslation } from "react-i18next";
import { Link } from "react-router";
import { FormRecordFiles } from "@/shared/ui/FormRecordFiles";
import { formatDateOnly } from "@/shared/lib/dateTime";
import { formatExactDecimal } from "@/shared/lib/decimal";
import { responseCatalogFieldText, responseDocumentFormat, responseFiles, responseValueText, selectedResponseChoices, type ResponseCell, type ResponseChoice } from "../responses";
import type { PrivateFormFile } from "@/shared/api/formFiles";
function CapturedFields({ choice, culture, yes, no }: { choice: ResponseChoice; culture: string; yes: string; no: string }) {
  return choice.fields?.length ? <dl className="mt-1 space-y-0.5 text-xs text-[var(--color-content-muted)]">{choice.fields.map(field => <div key={field.fieldId} className="flex flex-wrap gap-x-1"><dt>{field.label}</dt><dd className="min-w-0 break-words">{responseCatalogFieldText(field, culture, yes, no)}</dd></div>)}</dl> : null;
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
  const files = responseFiles(cell);
  if (
    (cell.type === "photo" || cell.type === "document") &&
    Array.isArray(cell.value)
  ) {
    if (cell.type === "document" && !detail)
      return (
        <Link
          to={detailLink}
          onClick={event => { if (!event.defaultPrevented && event.button === 0 && !event.ctrlKey && !event.metaKey && !event.shiftKey && !event.altKey) onOpenDetail?.(); }}
          className="text-[var(--color-brand-700)] underline"
        >
          {t("responses.documents", { count: files.length })} ·{" "}
          {[
            ...new Set(
              files.map((file) =>
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
  const choices = selectedResponseChoices(cell);
  if (cell.type === "multiChoice" && detail)
    return <div className="min-w-0 space-y-2 break-words whitespace-pre-wrap">
      {choices.map(choice => <div key={choice.choiceId}>
        <span>{choice.label}</span>
        {choice.detail ? <p className="text-xs text-[var(--color-content-muted)]">{choice.detail}</p> : null}
        {choice.catalogName ? <p className="text-xs text-[var(--color-content-muted)]">{choice.catalogName}</p> : null}
        <CapturedFields choice={choice} culture={i18n.language} yes={t("responses.yes")} no={t("responses.no")}/>
      </div>)}
    </div>;
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
  const choice = cell.type === "choice" ? choices[0] : undefined;
  return (
    <div
      className={
        detail ? "min-w-0 break-words whitespace-pre-wrap" : cell.type === "multiChoice" ? "max-w-64 break-words whitespace-normal" : "max-w-64 truncate"
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
      {detail && choice ? <CapturedFields choice={choice} culture={i18n.language} yes={t("responses.yes")} no={t("responses.no")}/> : null}
    </div>
  );
}
