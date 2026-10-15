import type { PrivateFormFile } from "@/shared/api/formFiles";
import { formatDateOnly } from "@/shared/lib/dateTime";
import { formatExactDecimal } from "@/shared/lib/decimal";

// Presentation input only, not a wire DTO. Choice text is the authorized historical label.
export type FormReplyDisplayValue =
  | { readonly type:"photo"|"document";readonly value:readonly PrivateFormFile[] }
  | { readonly type: "shortText" | "longText"; readonly value: string | null }
  | { readonly type: "choice"; readonly value: string | null; readonly catalogName?: string; readonly detail?: string | null }
  | { readonly type: "decimal" | "date"; readonly value: string | null }
  | { readonly type: "boolean"; readonly value: boolean | null };

export function formatFormReplyValue(answer: FormReplyDisplayValue, language: string,
  labels: { readonly missing: string; readonly yes: string; readonly no: string }): string | null {
  if (answer.type==="photo"||answer.type==="document") return "";
  if (answer.value === null) return labels.missing;
  switch (answer.type) {
    case "decimal": return formatExactDecimal(answer.value, language);
    case "date": return formatDateOnly(answer.value, language);
    case "boolean": return answer.value ? labels.yes : labels.no;
    default: return typeof answer.value === "string" ? answer.value : null;
  }
}

// Authorized historical rows, independent of HTTP fields or a current catalog lookup.
export interface FormReplyDisplayRow {
  readonly id: string;
  readonly label: string;
  readonly answer: FormReplyDisplayValue;
}
