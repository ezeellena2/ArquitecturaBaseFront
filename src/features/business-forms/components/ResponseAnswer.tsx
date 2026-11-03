import type { PrivateFormFile } from "@/shared/api/formFiles";
import type { ResponseDetail } from "../api/responses";
import { ResponseValue } from "./ResponseValue";
import { ResponseAssistance, ResponseAssistanceBadges } from "./ResponseAssistance";

// On the full page the question keeps a column of its own width, so the value stays close to it (board TL1-A); the quick view
// and the phone keep the proportion.
export function ResponseAnswer({ record: data, actor, busy: loadingTarget, photos, onForbidden: deny, onError: onFileError, layout = "panel" }: {
  record: ResponseDetail; actor: string; busy: boolean; photos: readonly PrivateFormFile[];
  onForbidden: () => void; onError: (error: unknown) => void; layout?: "panel" | "page";
}) {
  const columns = layout === "page" ? "grid-cols-[minmax(0,2fr)_minmax(0,3fr)] sm:grid-cols-[11rem_minmax(0,1fr)]" : "grid-cols-[minmax(0,2fr)_minmax(0,3fr)]";
  return <><dl className="divide-y divide-[var(--color-border)]">{data.values.map(value => <div key={value.fieldId} className={"grid gap-3 py-3 " + columns}><dt className="min-w-0 break-words text-sm text-[var(--color-content-muted)]">{value.label}</dt><dd className="min-w-0 text-sm"><ResponseValue cell={{ ...value, state: value.value === null || Array.isArray(value.value) && value.value.length === 0 ? "Unanswered" : "Answered" }} actor={actor} recordId={data.id} number={data.number} label={value.label} detail viewerFiles={photos} onForbidden={deny} onError={onFileError} detailLink=""/><ResponseAssistanceBadges record={data} fieldId={value.fieldId}/></dd></div>)}</dl><ResponseAssistance key={data.id} record={data} actor={actor} busy={loadingTarget} onForbidden={deny} onError={onFileError}/></>;
}
