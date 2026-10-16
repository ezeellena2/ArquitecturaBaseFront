import type { PrivateFormFile } from "@/shared/api/formFiles";
export type ResponseType = "shortText" | "longText" | "decimal" | "date" | "boolean" | "choice" | "photo" | "document";
export interface ResponseChoice { choiceId: string; label: string; catalogId?: string | null; catalogName?: string | null; detail?: string | null }
export type ResponseValue = string | boolean | ResponseChoice | PrivateFormFile[] | null;
export interface ResponseCell { fieldId: string; type: ResponseType; state: "NotAsked" | "Unanswered" | "Answered"; value: ResponseValue }
export interface ResponseColumn { fieldId: string; type: ResponseType; label: string; introducedInVersion: number; options: { id: string; label: string }[] }
export interface ResponseCondition { fieldId: string; operator: string; values?: readonly string[] | null }
export interface ResponseFilter { search?: string; actorIds?: readonly string[]; receivedFromUtc?: string; receivedToUtc?: string; conditions?: readonly ResponseCondition[] }
export interface ResponseQuery extends ResponseFilter { page: number; pageSize: number; sort?: string; sortFieldId?: string; versionIds?: readonly string[] }
export function visibleResponseColumns(columns: readonly ResponseColumn[], selection: string | null): readonly ResponseColumn[] {
 if(selection===null)return columns;
 const ids=new Set(selection.split(","));return columns.filter(column=>ids.has(column.fieldId));
}
export function responseValueText(cell: ResponseCell, unanswered: string, yes: string, no: string): string {
 if(cell.state==="NotAsked")return "—";
 if(cell.state==="Unanswered")return unanswered;
 if(typeof cell.value==="boolean")return cell.value?yes:no;
 if(typeof cell.value==="string")return cell.value;
 if(cell.value && !Array.isArray(cell.value))return cell.value.label;
 return "";
}
