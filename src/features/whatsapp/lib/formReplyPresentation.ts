import type { FormReply, FormReplyValue } from '../api/formReplies';
import type { FormReplyDisplayRow, FormReplyDisplayValue } from './formReplyValue';

// Unavailable is a presentation fallback for an invalid projection, never a server processing state.
export type FormReplyPresentation =
  | { readonly state: 'Pending' | 'Downloading' | 'RetryingFiles' | 'Rejected' | 'Unrecognized' | 'Unavailable'; readonly name: string | null; readonly rejectionCode?: string | null; readonly rejectedQuestion?: string | null }
  | { readonly state: 'Completed'; readonly name: string; readonly recordNumber: string; readonly recordId?:string;
      readonly values: readonly FormReplyDisplayRow[] | null; readonly valuesRevoked?: boolean; readonly messageRemoved?: boolean };

function answer(row: FormReplyValue): FormReplyDisplayValue {
  if(row.type==="photo"||row.type==="document")return {type:row.type,value:row.value};
  if (row.type === 'boolean') return { type: 'boolean', value: row.value };
  if (row.type === 'choice') return { type: 'choice', value: row.value?.label ?? null, catalogName:row.value?.catalogName, detail:row.value?.detail };
  return { type: row.type, value: row.value };
}
export function toFormReplyPresentation(reply: FormReply | null): FormReplyPresentation | null {
  if (reply === null) return null;
  if (reply.state !== 'Completed') return reply.state==='Rejected' ? { state:reply.state,name:reply.name,rejectionCode:reply.rejectionCode,rejectedQuestion:reply.rejectedQuestion } : {state:reply.state,name:reply.name};
  return { state: 'Completed', name: reply.name, recordNumber: reply.number, recordId:reply.recordId,
    values: reply.values?.map(row => ({ id: row.fieldId, label: row.label, answer: answer(row) })) ?? null };
}
