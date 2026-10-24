import { z } from "zod";
import type { PagedResult } from "@/shared/api/pagedResult";
import type { DraftQuestion, CanonicalQuestion, FormDefinitionSnapshot, FormDraftSaveResult } from "../model";

const guid = z.string().regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i).refine(value => !/^0{8}-0{4}-0{4}-0{4}-0{12}$/.test(value));
const revision = z.number().int().min(1).max(Number.MAX_SAFE_INTEGER);
const utc = z.iso.datetime();
const text = z.record(z.string().refine(value => value === "es" || value === "en"), z.string());
const nameText = text.refine(map => Object.values(map).every(value => value.length <= 120 && value === value.trim()));
const helpText = text.refine(map => Object.keys(map).length > 0 && Object.values(map).every(value => !!value.trim()));
const choice = z.strictObject({ choiceId: guid, label: text });
const presentationPart = z.union([z.enum(["text", "code", "detail", "value"]), guid]);
const catalogPresentation = z.strictObject({ title: z.array(presentationPart).min(1).max(24), description: z.array(presentationPart).max(24) });
const catalogMatch = z.union([z.strictObject({ fieldId: guid, value: z.string().min(1).max(300) }), z.strictObject({ fieldId: guid, personAttributeId: guid })]);
export const canonicalCatalogSourceSchema = z.strictObject({ catalog: guid, match: z.array(catalogMatch).min(1).max(20).optional(), presentation: catalogPresentation.optional() })
  .refine(source => !source.match || new Set(source.match.map(item => item.fieldId.toLowerCase())).size === source.match.length);
export const canonicalFormFieldSchema = z.strictObject({ fieldId: guid, key: z.string(), type: z.enum(["shortText", "longText", "decimal", "date", "boolean", "choice", "multiChoice", "photo", "document"]),
  label: text, help: helpText.nullable(), required: z.boolean(), maxLength: z.number().int().min(1).max(10000).nullable(), options: z.array(choice).min(1).max(50).nullable(), source: canonicalCatalogSourceSchema.optional(),
  files: z.strictObject({ minFiles: z.number().int().min(0).max(10), maxFiles: z.number().int().min(1).max(10), photoSource: z.enum(["cameraOrGallery", "camera"]).nullish() }).optional(),
  selection: z.strictObject({ minSelected: z.number().int().min(0).max(20), maxSelected: z.number().int().min(1).max(20) }).optional(),
}).superRefine((value, context) => {
  const fileType = value.type === "photo" || value.type === "document";
  if (fileType ? !value.files || value.files.minFiles > value.files.maxFiles || value.required !== (value.files.minFiles > 0) || (value.type === "photo" ? !value.files.photoSource : value.files.photoSource != null) : value.files !== undefined) context.addIssue({ code: "custom", message: "Invalid file configuration." });
  if (value.type === "multiChoice") {
    const range = value.selection;
    if (!range || range.minSelected > range.maxSelected || value.required !== (range.minSelected > 0)
      || !value.source && (value.options == null || value.options.length > 20 || range.minSelected > value.options.length))
      context.addIssue({ code: "custom", message: "Invalid selection configuration." });
  } else if (value.selection !== undefined) context.addIssue({ code: "custom", message: "Invalid selection configuration." });
  const textType = value.type === "shortText" || value.type === "longText";
  if ((textType ? value.maxLength === null : value.maxLength !== null)
    || (value.type === "choice" || value.type === "multiChoice" ? value.source ? value.options != null : value.options == null : value.options !== null || value.source != null)
    || value.key !== `field_${value.fieldId.replaceAll("-", "").toLowerCase()}`) context.addIssue({ code: "custom", message: "Invalid configuration." });
});
const definition = z.strictObject({ id: guid, name: nameText, prefix: z.string().regex(/^[A-Z][A-Z0-9]{0,11}$/), prefixLocked: z.boolean(), revision, offerWhen: z.string().min(1).max(1000).refine(value => value === value.trim()).nullable(),
  draft: z.strictObject({ format: z.literal(1), culture: z.enum(["es", "en"]), submitLabel: text, fields: z.array(canonicalFormFieldSchema).max(40) }),
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
const publicationState = z.enum(["Accepted", "Preparing", "Publishing", "Uncertain", "ActivationPending", "Published", "Failed"]);
const displayState = z.enum(["Draft", "Accepted", "Preparing", "Publishing", "Uncertain", "ActivationPending", "Published", "Failed"]);
const activeVersion = z.strictObject({ versionId: guid, versionNumber: revision, draftRevision: revision, cultures: z.array(z.enum(["es", "en"])).min(1) });
const currentOperation = z.strictObject({ versionId: guid, versionNumber: revision, draftRevision: revision, state: publicationState, stage: z.string().min(1), requiresReview: z.boolean(), canRetry: z.literal(false), requestId: guid.nullable(), recoveryPath: z.string().nullable() });
const publicationProjection = z.strictObject({ activeVersion: activeVersion.nullable(), currentOperation: currentOperation.nullable(), displayState });
const lifecycle = z.strictObject({ deprecationState: z.enum(["Pending", "Uncertain", "Deprecated", "NeedsAttention"]).nullable(), deprecatedAtUtc: utc.nullable(), lastOpenSessionExpiresAtUtc: utc.nullable(), canDelete: z.boolean(), deletionUnavailableReason: z.enum(["PublicationInProgress", "HasResponses", "OpenSends"]).nullable(), revision, deactivatedAtUtc: utc.nullable(), deactivatedBy: author.nullable(),
  responseCount: z.number().int().min(0).max(Number.MAX_SAFE_INTEGER).nullable(), pendingApprovalCount: z.number().int().min(0).nullable(),
  nextRecordNumber: z.string().min(1).nullable(), nextVersionNumber: revision, canDeactivate: z.boolean(), canReactivate: z.boolean(),
  unavailableReason: z.enum(["PublicationInProgress", "NotPublished"]).nullable() });
const deactivation = z.strictObject({ definitionId: guid, revision, lifecycle });
const deactivationPreview = deactivation.extend({ affectedSuggestions: z.array(z.strictObject({ definitionId: guid, name: nameText })) });
const detail = z.strictObject({ definition, lifecycle, capabilities: z.strictObject({ canSave: z.boolean(), canPublish: z.boolean(), canPreview: z.boolean() }), audit, publication: publicationProjection });
const commit = z.strictObject({ requestId: guid, definition,
  identityMap: z.strictObject({ fields: z.array(z.strictObject({ localId: z.string(), fieldId: guid, key: z.string(), replacesFieldId: guid.nullable() })),
    choices: z.array(z.strictObject({ fieldLocalId: z.string(), localId: z.string(), fieldId: guid, choiceId: guid })) }),
  recovery: z.strictObject({ path: z.string(), resultExpiresAtUtc: utc }),
}).refine(value => value.recovery.path === recoveryPath(value.requestId));
const recovered = z.strictObject({ requestId: guid, kind: z.enum(["Create", "Update"]), status: z.literal("Committed"), committedAtUtc: utc, currentRevision: revision, result: commit })
  .refine(value => value.requestId === value.result.requestId && value.currentRevision >= value.result.definition.revision);
const row = z.strictObject({ id: guid, name: nameText, prefix: z.string(), questionCount: z.number().int().min(0), activeVersionNumber: revision.nullable(),
  displayState, lastChangedAtUtc: utc, lastChangedBy: author.nullable(), canEdit: z.boolean(), lifecycle });
const checkedRow = row.refine(value => Object.values(value.name).some(name => !!name.trim()));
const page = z.strictObject({ items: z.array(checkedRow), page: z.number().int().min(1), pageSize: z.number().int().min(1).max(100), totalCount: z.number().int().min(0),
  totalPages: z.number().int().min(0), hasPrevious: z.boolean(), hasNext: z.boolean() });
const facets = z.strictObject({ active: z.number().int().min(0), published: z.number().int().min(0), drafts: z.number().int().min(0), deactivated: z.number().int().min(0) });

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
    const { maxLength, options, source, files, selection, ...common } = item;
    switch (common.type) {
      case "photo": case "document": return { ...common, type: common.type, files: files! };
      case "shortText": case "longText": return { ...common, type: common.type, maxLength: maxLength! };
      case "choice": return source ? { ...common, type: common.type, source } : { ...common, type: common.type, options: options! };
      case "multiChoice": return source ? { ...common, type: common.type, source, selection: selection! } : { ...common, type: common.type, options: options!, selection: selection! };
      default: return { ...common, type: common.type };
    }
  }) } };
}
function adaptCommit(value: z.infer<typeof commit>): FormDraftSaveResult { return { ...value, definition: adaptDefinition(value.definition) }; }
export function readFormDetail(value: unknown) {
  const data = read(detail, value);
  const operation = data.publication.currentOperation;
  if (operation && (operation.requestId === null ? operation.recoveryPath !== null : !data.capabilities.canPublish || operation.recoveryPath !== publicationPath(data.definition.id, operation.requestId))) throw new UnsupportedFormResponse();
  if (data.capabilities.canPreview && !data.publication.activeVersion) throw new UnsupportedFormResponse();
  return { ...data, definition: adaptDefinition(data.definition) };
}
export function readFormCommit(value: unknown): FormDraftSaveResult { return adaptCommit(read(commit, value)); }
export function readFormRecovery(value: unknown) { const data = read(recovered, value); return { ...data, result: adaptCommit(data.result) }; }
export const readFormPage = (value: unknown): PagedResult<z.infer<typeof row>> => read(page, value);
export const readFormFacets = (value: unknown) => read(facets, value);
export type FormDetail = ReturnType<typeof readFormDetail>;
export type FormPublicationProjection = FormDetail["publication"];
export type FormRecovery = ReturnType<typeof readFormRecovery>;

const publicationCompatibility = z.enum(["Blocked", "LocallyValidated", "Unavailable"]);
const publicationIssue = z.strictObject({ channelId: z.string().nullable(), fieldId: guid.nullable(), choiceId: guid.nullable(),
  path: z.string(), code: z.string(), message: z.string(), limit: z.number().int().nullable(), culture: z.enum(["es", "en"]).nullable() });
const warningCount = z.number().int().min(0).max(Number.MAX_SAFE_INTEGER);
const warningTarget = { fieldId: guid, path: z.string(), message: z.string() };
const publicationWarning = z.discriminatedUnion("code", [
  z.strictObject({ ...warningTarget, code: z.literal("Forms.Publication.OptionsPerRecipientHigh"), limit: z.union([z.literal(20), z.literal(200)]), maximum: warningCount, maximumLabel: z.string().min(1).optional() }),
  z.strictObject({ ...warningTarget, code: z.literal("Forms.Publication.RecipientsWithoutData"), count: warningCount.min(1), people: z.array(z.string().min(1)).max(5) }),
]);
const publicationCheck = z.strictObject({ definitionId: guid, draftRevision: revision, nextVersionNumber: revision, compatibility: publicationCompatibility,
  canAccept: z.boolean(), acceptanceAvailability: z.enum(["Available", "Unavailable", "InProgress"]),
  checkToken: z.string().min(1).nullable(), checkExpiresAtUtc: utc.nullable(),
  channels: z.array(z.strictObject({ channelId: z.string().min(1), profileRevision: z.string().min(1),
    compatibility: publicationCompatibility, externalEvidence: z.literal("Pending"), cultures: z.array(z.enum(["es", "en"])) })),
  cultures: z.array(z.strictObject({ culture: z.enum(["es", "en"]), isOriginal: z.boolean(), isComplete: z.boolean(), missing: z.array(publicationIssue) })),
  issues: z.array(publicationIssue), warnings: z.array(publicationWarning),
  diff: z.strictObject({ baseVersionId: guid.nullable(), added: z.array(guid), changed: z.array(guid), removed: z.array(guid),
    addedCultures: z.array(z.enum(["es", "en"])), removedCultures: z.array(z.enum(["es", "en"])) }),
});
export function readFormPublicationCheck(value: unknown, definitionId: string, expectedRevision: number, fields: readonly DraftQuestion[]) {
  const checked = read(publicationCheck, value);
  if ([...checked.issues, ...checked.cultures.flatMap(culture => culture.missing)].some(issue => {
    if (!issue.fieldId) return issue.choiceId !== null;
    const field = fields.find(item => item.fieldId?.toLowerCase() === issue.fieldId?.toLowerCase());
    return !field || issue.choiceId !== null && (field.type !== "choice" && field.type !== "multiChoice" || !field.options?.some(option => option.choiceId?.toLowerCase() === issue.choiceId?.toLowerCase()));
  })) throw new UnsupportedFormResponse();
  if (checked.warnings.some(warning => !fields.some(field => field.fieldId?.toLowerCase() === warning.fieldId.toLowerCase()))) throw new UnsupportedFormResponse();
  const hasTicket = checked.checkToken !== null && checked.checkExpiresAtUtc !== null;
  if (checked.canAccept ? !hasTicket || checked.compatibility !== "LocallyValidated" || checked.acceptanceAvailability !== "Available" || checked.issues.length !== 0 : checked.checkToken !== null || checked.checkExpiresAtUtc !== null) throw new UnsupportedFormResponse();
  if (checked.definitionId.toLowerCase() !== definitionId.toLowerCase() || checked.draftRevision !== expectedRevision) throw new UnsupportedFormResponse();
  return checked;
}
export type FormPublicationCheck = ReturnType<typeof readFormPublicationCheck>;

export function publicationPath(definitionId: string, requestId: string): string {
  return `/api/forms/definitions/${formId(definitionId)}/publications/${formId(requestId)}`;
}
const publicationIdentity = { requestId: guid, operationId: guid, definitionId: guid, versionId: guid,
  versionNumber: revision, draftRevision: revision, acceptedAtUtc: utc };
const publicationReceipt = z.strictObject({ ...publicationIdentity, state: z.literal("Accepted"), recoveryPath: z.string() });
const publicationStatus = z.strictObject({ ...publicationIdentity,
  state: z.enum(["Accepted", "Preparing", "Publishing", "Uncertain", "ActivationPending", "Published", "Failed"]),
  stage: z.string().min(1), updatedAtUtc: utc, nextCheckAtUtc: utc.nullable(), canRetry: z.boolean(), requiresReview: z.boolean(), issues: z.array(publicationIssue), cultures: z.array(z.enum(["es", "en"])) });
function matchesPublication(value: { definitionId: string; requestId: string }, definitionId: string, requestId: string) {
  return value.definitionId.toLowerCase() === definitionId.toLowerCase() && value.requestId.toLowerCase() === requestId.toLowerCase();
}
export function readFormPublicationReceipt(value: unknown, definitionId: string, requestId: string, expectedRevision: number) {
  const checked = read(publicationReceipt, value);
  if (!matchesPublication(checked, definitionId, requestId) || checked.draftRevision !== expectedRevision
    || checked.recoveryPath !== publicationPath(definitionId, requestId)) throw new UnsupportedFormResponse();
  return checked;
}
export function readFormPublicationStatus(value: unknown, definitionId: string, requestId: string) {
  const checked = read(publicationStatus, value);
  if (!matchesPublication(checked, definitionId, requestId)) throw new UnsupportedFormResponse();
  return checked;
}
export type FormPublicationReceipt = ReturnType<typeof readFormPublicationReceipt>;
export type FormPublicationStatus = ReturnType<typeof readFormPublicationStatus>;

const officialPreview = z.strictObject({ url: z.string().url().refine(value => { const url = new URL(value); return url.protocol === "https:" && !url.username && !url.password; }), expiresAtUtc: utc });
export class ExpiredFormPreview extends Error { constructor() { super("The form preview has expired."); this.name = "ExpiredFormPreview"; } }
export function readFormPreview(value: unknown, now = Date.now()) { const checked = read(officialPreview, value); if (Date.parse(checked.expiresAtUtc) <= now) throw new ExpiredFormPreview(); return checked; }

export type FormLifecycle = z.infer<typeof lifecycle>;
export type FormDeactivation = z.infer<typeof deactivation>;
export type FormDeactivationPreview = z.infer<typeof deactivationPreview>;
export function readFormDeactivation(value: unknown, id: string): FormDeactivation {
  const result = read(deactivation, value);
  if (result.definitionId.toLowerCase() !== id.toLowerCase() || result.revision !== result.lifecycle.revision) throw new UnsupportedFormResponse();
  return result;
}
export function readFormDeactivationPreview(value: unknown, id: string): FormDeactivationPreview {
  const result = read(deactivationPreview, value);
  if (result.definitionId.toLowerCase() !== id.toLowerCase() || result.revision !== result.lifecycle.revision) throw new UnsupportedFormResponse();
  return result;
}
