import { z } from 'zod';
import { formatDateOnly } from '@/shared/lib/dateTime';
import { withoutFormReplyValues } from "../lib/threadPrivacy";
import type { Thread } from './chat';

// Matches the written WhatsAppFormReplyResponse DTO. Actual producer HTTP bodies are verified separately.
const guid = z.string().uuid();
const text = z.string().min(1);
const number = z.string().regex(/^[A-Z][A-Z0-9]{0,11}-\d{6,19}$/).refine(value => {
  const digits = value.slice(value.lastIndexOf('-') + 1);
  return /^\d{6,19}$/.test(digits) && BigInt(digits) > 0n && BigInt(digits) <= 9223372036854775807n;
});
const field = { fieldId: guid, key: text, label: text };
const decimal = z.string().regex(/^-?(?:0|[1-9]\d*)(?:\.\d+)?$/);
const date = z.string().refine(value => formatDateOnly(value, 'en') !== null);
const file = z.strictObject({ fileId: guid, name: text.max(255), contentType: z.enum(["image/jpeg","image/png","application/pdf","application/msword","application/vnd.ms-excel","application/vnd.openxmlformats-officedocument.wordprocessingml.document","application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"]), size:z.number().int().positive().max(25*1024*1024), hasThumbnail:z.boolean() });
const fileList = z.array(file).max(10).refine(files=>new Set(files.map(f=>f.fileId)).size===files.length);
export type FormReplyFile = z.infer<typeof file>;
const value = z.discriminatedUnion('type', [
  z.strictObject({...field,type:z.literal("photo"),value:fileList.refine(files=>files.every(f=>f.hasThumbnail && (f.contentType==="image/jpeg"||f.contentType==="image/png")))}),
  z.strictObject({...field,type:z.literal("document"),value:fileList.refine(files=>files.every(f=>!f.hasThumbnail))}),
  z.strictObject({ ...field, type: z.literal('shortText'), value: z.string().nullable() }),
  z.strictObject({ ...field, type: z.literal('longText'), value: z.string().nullable() }),
  z.strictObject({ ...field, type: z.literal('decimal'), value: decimal.nullable() }),
  z.strictObject({ ...field, type: z.literal('date'), value: date.nullable() }),
  z.strictObject({ ...field, type: z.literal('boolean'), value: z.boolean().nullable() }),
  z.strictObject({ ...field, type: z.literal('choice'), value: z.strictObject({ choiceId: guid, label: text, catalogId:guid.optional(), catalogName:text.optional(), detail:z.string().nullable().optional(), value: z.string().min(1).max(64).optional(), valueType: z.enum(["Integer", "Decimal", "Date"]).optional() })
    .refine(value=>(value.catalogId===undefined)===(value.catalogName===undefined) && (value.detail===undefined||value.catalogId!==undefined) && (value.value===undefined)===(value.valueType===undefined)).nullable() }),
]);
const values = z.array(value).refine(rows => new Set(rows.map(row => row.fieldId)).size === rows.length && new Set(rows.map(row => row.key)).size === rows.length);
const fileMetadata = { fileCount:z.number().int().nonnegative().optional(), receivedAtUtc:z.iso.datetime().optional() };
const historical = { definitionId: guid, versionId: guid, versionNumber: z.number().int().positive().max(Number.MAX_SAFE_INTEGER), name: text };
const optionalHistorical = { definitionId: guid.nullable(), versionId: guid.nullable(), versionNumber: historical.versionNumber.nullable(), name: text.nullable() };
const noRecord = { recordId: z.null(), number: z.null(), values: z.null() };
const schema = z.discriminatedUnion('state', [
  z.strictObject({ state: z.literal('Completed'), ...historical, ...fileMetadata, recordId: guid, number, values: values.nullable() }),
  z.strictObject({ state: z.literal('Pending'), ...optionalHistorical, ...fileMetadata, ...noRecord }),
  z.strictObject({ state: z.literal('Downloading'), ...optionalHistorical, ...fileMetadata, ...noRecord }),
  z.strictObject({ state: z.literal('RetryingFiles'), ...optionalHistorical, ...fileMetadata, ...noRecord }),
  z.strictObject({ state: z.literal('Rejected'), ...optionalHistorical, ...fileMetadata, ...noRecord, rejectionCode:text.optional(), rejectedQuestion:text.optional() }),
  z.strictObject({ state: z.literal('Unrecognized'), definitionId: z.null(), versionId: z.null(), versionNumber: z.null(), name: z.null(), ...fileMetadata, ...noRecord }),
]);
export type FormReply = z.infer<typeof schema>;
export type FormReplyValue = z.infer<typeof value>;

export function readFormReply(input: unknown, canReadValues: boolean): FormReply | null {
  // Do not inspect or retain unauthorized values, even if that private payload is malformed.
  const candidate = !canReadValues && input !== null && typeof input === 'object' && !Array.isArray(input)
    ? { ...input, values: null } : input;
  const parsed = schema.safeParse(candidate);
  if (!parsed.success || canReadValues && parsed.data.state === 'Completed' && parsed.data.values === null) return null;
  return parsed.data;
}
export function readThreadFormReplies(thread: Thread): Thread {
  const allowed = thread.canReadFormRecords === true;
  const safeThread = allowed ? thread : withoutFormReplyValues(thread);
  return { ...safeThread, canReadFormRecords: allowed, messages: safeThread.messages.map(message => {
    const { formReply: discarded, ...safe } = message;
    if (message.kind !== 'FlowReply') return safe;
    return { ...safe, body: null, formReply: message.direction === 'Inbound' && message.purpose !== 'Access' ? readFormReply(discarded, allowed) : null };
  }) };
}
