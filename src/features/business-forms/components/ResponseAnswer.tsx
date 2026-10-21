import type { PrivateFormFile } from "@/shared/api/formFiles";
import type { ResponseDetail } from "../api/responses";
import { ResponseValue } from "./ResponseValue";
import { ResponseAssistance, ResponseAssistanceBadges } from "./ResponseAssistance";

export function ResponseAnswer({ record: data, actor, busy: loadingTarget, photos, onForbidden: deny, onError: onFileError }: {
  record: ResponseDetail; actor: string; busy: boolean; photos: readonly PrivateFormFile[];
  onForbidden: () => void; onError: (error: unknown) => void;
}) {
  return <><dl className="divide-y divide-[var(--color-border)]">{data.values.map(value => <div key={value.fieldId} className="grid grid-cols-[minmax(0,2fr)_minmax(0,3fr)] gap-3 py-3"><dt className="min-w-0 break-words text-sm text-[var(--color-content-muted)]">{value.label}</dt><dd className="min-w-0 text-sm"><ResponseValue cell={{ ...value, state: value.value === null || Array.isArray(value.value) && value.value.length === 0 ? "Unanswered" : "Answered" }} actor={actor} recordId={data.id} number={data.number} label={value.label} detail viewerFiles={photos} onForbidden={deny} onError={onFileError} detailLink=""/><ResponseAssistanceBadges record={data} fieldId={value.fieldId}/></dd></div>)}</dl><ResponseAssistance key={data.id} record={data} actor={actor} busy={loadingTarget} onForbidden={deny} onError={onFileError}/></>;
}
