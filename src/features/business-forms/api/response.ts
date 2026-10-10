import { z } from "zod";
import type { PagedResult } from "@/shared/api/pagedResult";
import type { CanonicalQuestion, FormDefinitionSnapshot, FormDraftSaveResult } from "../model";

const guid = z.string().regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i).refine(value => !/^0{8}-0{4}-0{4}-0{4}-0{12}$/.test(value));
const revision = z.number().int().min(1).max(Number.MAX_SAFE_INTEGER);
const utc = z.iso.datetime();
const text = z.record(z.string().refine(value => value === "es" || value === "en"), z.string());
const nameText = text.refine(map => Object.values(map).every(value => value.length <= 120 && value === value.trim()));
const helpText = text.refine(map => Object.keys(map).length > 0 && Object.values(map).every(value => !!value.trim()));
const choice = z.strictObject({ choiceId: guid, label: text });
const field = z.strictObject({ fieldId: guid, key: z.string(), type: z.enum(["shortText", "longText", "decimal", "date", "boolean", "choice"]),
  label: text, help: helpText.nullable(), required: z.boolean(), maxLength: z.number().int().min(1).max(10000).nullable(), options: z.array(choice).min(1).max(50).nullable(),
}).superRefine((value, context) => {
  const textType = value.type === "shortText" || value.type === "longText";
  if ((textType ? value.maxLength === null : value.maxLength !== null)
    || (value.type === "choice" ? value.options === null : value.options !== null)
    || value.key !== `field_${value.fieldId.replaceAll("-", "").toLowerCase()}`) context.addIssue({ code: "custom", message: "Invalid configuration." });
});
const definition = z.strictObject({ id: guid, name: nameText, prefix: z.string().regex(/^[A-Z][A-Z0-9]{0,11}$/), prefixLocked: z.boolean(), revision,
  draft: z.strictObject({ format: z.literal(1), culture: z.enum(["es", "en"]), submitLabel: text, fields: z.array(field).max(40) }),
}).superRefine((value, context) => {
  const { culture, fields, submitLabel } = value.draft;
  const labels = [value.name, submitLabel, ...fields.flatMap(item => [item.label, ...(item.options ?? []).map(option => option.label)])];
  const choices = fields.flatMap(item => (item.options ?? []).map(option => option.choiceId));
  if (labels.some(label => !label[culture]?.trim() || Object.values(label).some(item => item !== "" && !item.trim()))
    || new Set(fields.map(item => item.fieldId)).size !== fields.length || new Set(choices).size !== choices.length) {
    context.addIssue({ code: "custom", message: "Invalid draft." });
  }
});
const author = z.strictObject({ userId: guid, displayName: z.string().nullable() });
const audit = z.strictObject({ createdAtUtc: utc, modifiedAtUtc: utc.nullable(), lastChangedAtUtc: utc, lastChangedBy: author.nullable() });
const detail = z.strictObject({ definition, capabilities: z.strictObject({ canSave: z.boolean() }), audit });
const commit = z.strictObject({ requestId: guid, definition,
  identityMap: z.strictObject({ fields: z.array(z.strictObject({ localId: z.string(), fieldId: guid, key: z.string(), replacesFieldId: guid.nullable() })),
    choices: z.array(z.strictObject({ fieldLocalId: z.string(), localId: z.string(), fieldId: guid, choiceId: guid })) }),
  recovery: z.strictObject({ path: z.string(), resultExpiresAtUtc: utc }),
}).refine(value => value.recovery.path === recoveryPath(value.requestId));
const recovered = z.strictObject({ requestId: guid, kind: z.enum(["Create", "Update"]), status: z.literal("Committed"), committedAtUtc: utc, currentRevision: revision, result: commit })
  .refine(value => value.requestId === value.result.requestId && value.currentRevision >= value.result.definition.revision);
const row = z.strictObject({ id: guid, name: nameText, prefix: z.string(), questionCount: z.number().int().min(0), activeVersionNumber: revision.nullable(),
  displayState: z.literal("Draft"), lastChangedAtUtc: utc, lastChangedBy: author.nullable(), canEdit: z.boolean() });
const checkedRow = row.refine(value => Object.values(value.name).some(name => !!name.trim()));
const page = z.strictObject({ items: z.array(checkedRow), page: z.number().int().min(1), pageSize: z.number().int().min(1).max(100), totalCount: z.number().int().min(0),
  totalPages: z.number().int().min(0), hasPrevious: z.boolean(), hasNext: z.boolean() });
const facets = z.strictObject({ all: z.number().int().min(0), published: z.number().int().min(0), drafts: z.number().int().min(0) });

export class UnsupportedFormResponse extends Error {
  constructor() { super("Unsupported form response."); this.name = "UnsupportedFormResponse"; }
}
function read<T>(schema: z.ZodType<T>, value: unknown): T {
  const result = schema.safeParse(value);
  // Never retain Zod issues: their input can contain private draft content.
  if (!result.success) throw new UnsupportedFormResponse();
  return result.data;
}
export function formId(value: string): string { return read(guid, value); }
export function recoveryPath(requestId: string): string { return `/api/forms/draft-changes/${formId(requestId)}`; }

function adaptDefinition(value: z.infer<typeof definition>): FormDefinitionSnapshot {
  return { ...value, draft: { ...value.draft, fields: value.draft.fields.map((item): CanonicalQuestion => {
    const { maxLength, options, ...common } = item;
    switch (common.type) {
      case "shortText": case "longText": return { ...common, type: common.type, maxLength: maxLength! };
      case "choice": return { ...common, type: common.type, options: options! };
      default: return { ...common, type: common.type };
    }
  }) } };
}
function adaptCommit(value: z.infer<typeof commit>): FormDraftSaveResult { return { ...value, definition: adaptDefinition(value.definition) }; }
export function readFormDetail(value: unknown) { const data = read(detail, value); return { ...data, definition: adaptDefinition(data.definition) }; }
export function readFormCommit(value: unknown): FormDraftSaveResult { return adaptCommit(read(commit, value)); }
export function readFormRecovery(value: unknown) { const data = read(recovered, value); return { ...data, result: adaptCommit(data.result) }; }
export const readFormPage = (value: unknown): PagedResult<z.infer<typeof row>> => read(page, value);
export const readFormFacets = (value: unknown) => read(facets, value);
export type FormDetail = ReturnType<typeof readFormDetail>;
export type FormRecovery = ReturnType<typeof readFormRecovery>;
