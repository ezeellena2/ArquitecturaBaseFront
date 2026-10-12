import type {
  CanonicalQuestion, DraftEditorValue, DraftQuestion, DraftWriteBody, FormDefinitionSnapshot,
  FormDraftSaveResult, FormIdentityMap,
} from "./model";

export interface DraftEditorScope { readonly actorId: string; readonly editorId: string }
export interface DraftAttemptIdentity extends DraftEditorScope { readonly requestId: string }
export interface DraftSaveAttempt {
  readonly identity: DraftAttemptIdentity;
  readonly definitionId: string | null;
  readonly body: DraftWriteBody;
}
export interface DraftSession {
  readonly scope: DraftEditorScope;
  readonly value: DraftEditorValue;
  readonly baseline: DraftEditorValue;
  readonly confirmed: FormDefinitionSnapshot | null;
  readonly identityMap: FormIdentityMap | null;
  readonly currentRevision: number | null;
  readonly pending: DraftSaveAttempt | null;
  readonly phase: "Editing" | "Saving" | "Unconfirmed" | "ReviewRequired";
}

// Copy the closed JSON value graph; freeze nested translations/options as well as the envelope.
function snapshot<T>(value: T): T {
  if (Array.isArray(value)) return Object.freeze(value.map(item => snapshot(item))) as T;
  if (value !== null && typeof value === "object") {
    return Object.freeze(Object.fromEntries(Object.entries(value).map(([key, item]) => [key, snapshot(item)]))) as T;
  }
  return value;
}

function editorQuestion(field: CanonicalQuestion, localId: string, optionLocalId: (id: string) => string): DraftQuestion {
  const common = { localId, fieldId: field.fieldId, replacesFieldId: null, label: field.label, help: field.help, required: field.required };
  switch (field.type) {
    case "choice": return field.source ? { ...common, type: field.type, source: { ...field.source } } : { ...common, type: field.type, options: field.options.map(option => ({ ...option, localId: optionLocalId(option.choiceId) })) };
    case "shortText": case "longText": return { ...common, type: field.type, maxLength: field.maxLength };
    default: return { ...common, type: field.type };
  }
}

export function startDraftSession(scope: DraftEditorScope, value: DraftEditorValue): DraftSession {
  const baseline = snapshot(value);
  return { scope: snapshot(scope), value: baseline, baseline, confirmed: null, identityMap: null, currentRevision: null, pending: null, phase: "Editing" };
}

export function openDraftSession(scope: DraftEditorScope, definition: FormDefinitionSnapshot): DraftSession {
  const value: DraftEditorValue = { name: definition.name, prefix: definition.prefix,
    draft: { ...definition.draft, fields: definition.draft.fields.map(field => editorQuestion(field, field.fieldId, id => id)) } };
  return { ...startDraftSession(scope, value), confirmed: snapshot(definition), currentRevision: definition.revision };
}

export function changeDraft(session: DraftSession, value: DraftEditorValue): DraftSession {
  return session.phase === "Editing" ? { ...session, value: snapshot(value) } : session;
}

export function discardDraft(session: DraftSession): DraftSession {
  return session.phase === "Editing" ? { ...session, value: session.baseline } : session;
}

export function beginDraftSave(session: DraftSession, requestId: string): DraftSession {
  if (session.phase !== "Editing") return session;
  const body: DraftWriteBody = { ...session.value, requestId,
    ...(session.confirmed ? { expectedRevision: session.confirmed.revision } : {}) };
  return { ...session, phase: "Saving", pending: snapshot({
    identity: { ...session.scope, requestId }, definitionId: session.confirmed?.id ?? null, body,
  }) };
}

function matches(session: DraftSession, identity: DraftAttemptIdentity): boolean {
  const pending = session.pending;
  return pending !== null && session.scope.actorId === identity.actorId && session.scope.editorId === identity.editorId
    && pending.identity.requestId === identity.requestId;
}

export function markDraftSaveUnconfirmed(session: DraftSession, identity: DraftAttemptIdentity): DraftSession {
  return matches(session, identity) ? { ...session, phase: "Unconfirmed" } : session;
}

// Only a definitive rejection of this frozen request may release it. A missing receipt,
// transport failure or cancellation stays Unconfirmed; RequestConflict retains its UUID/body.
export function rejectDraftSave(
  session: DraftSession, identity: DraftAttemptIdentity,
  reason: "Validation" | "RevisionConflict" | "IdentityRetired" | "PrefixLocked" | "RequestConflict",
): DraftSession {
  if (!matches(session, identity)) return session;
  if (reason === "RequestConflict") return markDraftSaveUnconfirmed(session, identity);
  return { ...session, pending: null, phase: reason === "Validation" ? "Editing" : "ReviewRequired" };
}

const choiceKey = (fieldLocalId: string, localId: string) => JSON.stringify([fieldLocalId, localId]);

function bindResult(attempt: DraftSaveAttempt, result: FormDraftSaveResult): DraftEditorValue | null {
  const input = attempt.body.draft.fields;
  const canonical = result.definition.draft.fields;
  const fieldMap = new Map(result.identityMap.fields.map(field => [field.localId, field]));
  const canonicalFields = new Map(canonical.map(field => [field.fieldId, field]));
  const choiceMap = new Map(result.identityMap.choices.map(choice => [choiceKey(choice.fieldLocalId, choice.localId), choice]));
  if (fieldMap.size !== input.length || fieldMap.size !== result.identityMap.fields.length
    || canonicalFields.size !== canonical.length || canonical.length !== input.length
    || choiceMap.size !== result.identityMap.choices.length) return null;

  const handles = new Map<string, { localId: string; options: Map<string, string> }>();
  let choiceCount = 0;
  for (const field of input) {
    const binding = fieldMap.get(field.localId);
    const saved = binding && canonicalFields.get(binding.fieldId);
    if (!binding || !saved || handles.has(saved.fieldId) || saved.type !== field.type || saved.key !== binding.key
      || binding.replacesFieldId !== field.replacesFieldId
      || (field.fieldId !== null && binding.fieldId !== field.fieldId)
      || (field.replacesFieldId !== null && binding.fieldId === field.replacesFieldId)) return null;
    const options = new Map<string, string>();
    if (field.type === "choice" && saved.type === "choice" && field.source?.catalog !== saved.source?.catalog) return null;
    if (field.type === "choice" && saved.type === "choice" && !field.source && !saved.source) {
      const savedOptions = new Map(saved.options.map(option => [option.choiceId, option]));
      if (savedOptions.size !== saved.options.length || field.options.length !== saved.options.length) return null;
      const localOptions = new Set<string>();
      for (const option of field.options) {
        const choice = choiceMap.get(choiceKey(field.localId, option.localId));
        if (!choice || localOptions.has(option.localId) || options.has(choice.choiceId)
          || choice.fieldId !== saved.fieldId || !savedOptions.has(choice.choiceId)
          || (option.choiceId !== null && choice.choiceId !== option.choiceId)) return null;
        localOptions.add(option.localId);
        options.set(choice.choiceId, option.localId);
        choiceCount++;
      }
    }
    handles.set(saved.fieldId, { localId: field.localId, options });
  }
  if (choiceCount !== choiceMap.size) return null;
  return { name: result.definition.name, prefix: result.definition.prefix, draft: {
    ...result.definition.draft, fields: canonical.map(field => {
      const handle = handles.get(field.fieldId)!;
      return editorQuestion(field, handle.localId, id => handle.options.get(id)!);
    }),
  } };
}

export function confirmDraftSave(
  session: DraftSession, identity: DraftAttemptIdentity, result: FormDraftSaveResult,
  currentRevision = result.definition.revision,
): DraftSession {
  if (!matches(session, identity)) return session;
  const attempt = session.pending!;
  const expectedRevision = (attempt.body.expectedRevision ?? 0) + 1;
  const validRevision = Number.isSafeInteger(result.definition.revision) && result.definition.revision === expectedRevision
    && Number.isSafeInteger(currentRevision) && currentRevision >= result.definition.revision;
  const value = result.requestId === identity.requestId && validRevision
    && (attempt.definitionId === null || attempt.definitionId === result.definition.id) ? bindResult(attempt, result) : null;
  if (!value) return { ...session, phase: "Unconfirmed" };
  const baseline = snapshot(value);
  return { ...session, value: baseline, baseline, confirmed: snapshot(result.definition), identityMap: snapshot(result.identityMap),
    pending: null, currentRevision, phase: currentRevision > result.definition.revision ? "ReviewRequired" : "Editing" };
}

export function requestDraftReview(session: DraftSession): DraftSession {
  return session.phase === "Editing" && session.confirmed !== null ? { ...session, phase: "ReviewRequired" } : session;
}
