import type { TFunction } from "i18next";
import { agentActionKinds, type AgentAction, type AgentActionKind, type AgentButtonDestination, type AgentCulture, type AgentForm, type AgentInputType, type AgentTexts, type AssistantAgent, type AssistantAgentSaveRequest } from "../api/assistantAgent";

// The editor of the screen «Asistente» (AS1-A): the draft of the four tabs, what Guardar sends, what changed, what is wrong and
// where, and how a conflict keeps what was edited. Pure: identities, the time and the translations come as parameters.

/** A fixed text while it is edited: one field in the language of the menu, the original required and the other optional. */
export interface DraftTexts { es: string; en: string }
export interface DraftButton { key: string; title: DraftTexts; destination: AgentButtonDestination | null; formDefinitionId: string | null; text: DraftTexts }
/** Keeps what was written for every action, so going back to one finds it; Guardar sends only what the chosen one uses. */
export interface DraftAction { kind: AgentActionKind | null; formDefinitionId: string | null; text: DraftTexts; instructions: string; question: DraftTexts; buttons: DraftButton[]; handoffReason: string }
export interface DraftCase { id: string; when: string; inputType: AgentInputType; isActive: boolean; action: DraftAction }
export interface DraftProfile { name: string; introduction: string; tone: string; does: string; doesNot: string; handoffMessage: DraftTexts }
/** The numbers stay as typed until they are saved. */
export interface DraftLimits { blockedTopics: string[]; cannotPromise: string; maxReplyLength: string; dailyReplyLimit: string; allowedActions: AgentActionKind[] }
export interface AgentDraft { profile: DraftProfile; cases: DraftCase[]; fallback: DraftAction; limits: DraftLimits }
/** What was last read or saved: the draft starts from it and Guardar sends its revision and its original language. */
export type AgentConfig = Pick<AssistantAgent, "revision" | "originalCulture" | "profile" | "cases" | "fallback" | "limits">;
export type ProfileField = Exclude<keyof DraftProfile, "handoffMessage">;

/** The same limits as the server (`WhatsAppAssistantAgentLimits`). */
export const agentLimits = {
  name: 80, introduction: 500, tone: 200, does: 1000, doesNot: 1000, handoffMessage: 1000, cases: 20, when: 300, text: 1000, instructions: 1000, question: 1024,
  buttons: 3, buttonTitle: 20, handoffReason: 200, blockedTopics: 20, blockedTopic: 80, cannotPromise: 500, minReplyLength: 100, maxReplyLength: 1000,
  minDailyReplies: 1, maxDailyReplies: 50, testMessages: 5, testMessage: 1000,
} as const;

export const caseKey = (id: string) => "case:" + id;
const join = (prefix: string, path: string) => prefix ? prefix + "." + path : path;
const other = (culture: AgentCulture): AgentCulture => culture === "es" ? "en" : "es";

const draftTexts = (value: AgentTexts | null): DraftTexts => ({ es: value?.es ?? "", en: value?.en ?? "" });
export const emptyTexts = (): DraftTexts => ({ es: "", en: "" });
export function emptyAction(kind: AgentActionKind | null = null): DraftAction {
  return { kind, formDefinitionId: null, text: emptyTexts(), instructions: "", question: emptyTexts(), buttons: [], handoffReason: "" };
}
/** A new case: any input, active and without an action chosen. */
export const newCase = (id: string): DraftCase => ({ id, when: "", inputType: "Any", isActive: true, action: emptyAction() });
export const newButton = (key: string): DraftButton => ({ key, title: emptyTexts(), destination: null, formDefinitionId: null, text: emptyTexts() });

function draftAction(action: AgentAction): DraftAction {
  return { kind: action.kind, formDefinitionId: action.formDefinitionId, text: draftTexts(action.text), instructions: action.instructions ?? "", question: draftTexts(action.question),
    buttons: (action.buttons ?? []).map((button, index) => ({ key: "saved-" + index, title: draftTexts(button.title), destination: button.destination,
      formDefinitionId: button.formDefinitionId, text: draftTexts(button.text) })), handoffReason: action.handoffReason ?? "" };
}

export function configOf(agent: AssistantAgent): AgentConfig {
  return { revision: agent.revision, originalCulture: agent.originalCulture, profile: agent.profile, cases: agent.cases, fallback: agent.fallback, limits: agent.limits };
}

export function draftFromAgent(agent: AgentConfig): AgentDraft {
  const { profile, limits } = agent;
  return {
    profile: { name: profile.name, introduction: profile.introduction, tone: profile.tone, does: profile.does, doesNot: profile.doesNot, handoffMessage: draftTexts(profile.handoffMessage) },
    cases: agent.cases.map(item => ({ id: item.id, when: item.when, inputType: item.inputType, isActive: item.isActive, action: draftAction(item.action) })),
    fallback: draftAction(agent.fallback),
    limits: { blockedTopics: [...limits.blockedTopics], cannotPromise: limits.cannotPromise, maxReplyLength: String(limits.maxReplyLength), dailyReplyLimit: String(limits.dailyReplyLimit),
      allowedActions: [...limits.allowedActions] },
  };
}

/** A blank language is not sent: the server keeps the original and an optional translation. */
const ownTexts = (value: DraftTexts): AgentTexts => ({ es: value.es.trim() || null, en: value.en.trim() || null });
const ordered = (kinds: readonly AgentActionKind[]) => agentActionKinds.filter(kind => kinds.includes(kind));
export const destinationKind = (destination: AgentButtonDestination): AgentActionKind => destination === "SendForm" ? "SendForm" : destination === "ExactText" ? "ExactText" : "Handoff";

/** Only what the action uses; the rest goes null, as the server asks. A draft without an action chosen does not reach here. */
export function actionBody(action: DraftAction): AgentAction {
  const kind = action.kind ?? "NoReply";
  const body: AgentAction = { kind, formDefinitionId: null, text: null, instructions: null, question: null, buttons: null, handoffReason: null };
  switch (kind) {
    case "SendForm": return { ...body, formDefinitionId: action.formDefinitionId };
    case "ExactText": return { ...body, text: ownTexts(action.text) };
    case "DraftedReply": return { ...body, instructions: action.instructions.trim() || null };
    case "AskButtons": return { ...body, question: ownTexts(action.question), buttons: action.buttons.map(button => ({ title: ownTexts(button.title), destination: button.destination ?? "Handoff",
      formDefinitionId: button.destination === "SendForm" ? button.formDefinitionId : null, text: button.destination === "ExactText" ? ownTexts(button.text) : null })) };
    case "Handoff": return { ...body, handoffReason: action.handoffReason.trim() || null };
    case "NoReply": return body;
  }
}

/** What Guardar sends: the four tabs, with the revision and the original language that were read. */
export function saveRequest(draft: AgentDraft, baseline: AgentConfig): AssistantAgentSaveRequest {
  const { profile, limits } = draft;
  return {
    expectedRevision: baseline.revision, originalCulture: baseline.originalCulture,
    profile: { name: profile.name.trim(), introduction: profile.introduction.trim(), tone: profile.tone.trim(), does: profile.does.trim(), doesNot: profile.doesNot.trim(),
      handoffMessage: ownTexts(profile.handoffMessage) },
    cases: draft.cases.map(item => ({ id: item.id, when: item.when.trim(), inputType: item.inputType, isActive: item.isActive, action: actionBody(item.action) })),
    fallback: actionBody(draft.fallback),
    limits: { blockedTopics: limits.blockedTopics.map(topic => topic.trim()), cannotPromise: limits.cannotPromise.trim(), maxReplyLength: Number(limits.maxReplyLength.trim()),
      dailyReplyLimit: Number(limits.dailyReplyLimit.trim()), allowedActions: ordered(limits.allowedActions) },
  };
}

// The comparable form of each part: what Guardar would send, with the numbers as typed. A kind that comes back finds its text.
const actionSnapshot = (action: DraftAction) => action.kind ? actionBody(action) : { kind: null };
const parts = (draft: AgentDraft) => ({
  "profile.name": draft.profile.name.trim(), "profile.introduction": draft.profile.introduction.trim(), "profile.tone": draft.profile.tone.trim(),
  "profile.does": draft.profile.does.trim(), "profile.doesNot": draft.profile.doesNot.trim(), "profile.handoffMessage": ownTexts(draft.profile.handoffMessage),
  cases: draft.cases.map(item => ({ id: item.id, when: item.when.trim(), inputType: item.inputType, isActive: item.isActive, action: actionSnapshot(item.action) })),
  fallback: actionSnapshot(draft.fallback),
  "limits.blockedTopics": draft.limits.blockedTopics.map(topic => topic.trim()), "limits.cannotPromise": draft.limits.cannotPromise.trim(),
  "limits.maxReplyLength": draft.limits.maxReplyLength.trim(), "limits.dailyReplyLimit": draft.limits.dailyReplyLimit.trim(),
  "limits.allowedActions": ordered(draft.limits.allowedActions),
});
type Part = keyof ReturnType<typeof parts>;
const emptyDraft: AgentDraft = { profile: { name: "", introduction: "", tone: "", does: "", doesNot: "", handoffMessage: emptyTexts() }, cases: [], fallback: emptyAction(), limits: { blockedTopics: [], cannotPromise: "", maxReplyLength: "", dailyReplyLimit: "", allowedActions: [] } };
export const draftSnapshot = (draft: AgentDraft) => JSON.stringify(parts(draft));
export const caseSnapshot = (item: DraftCase) => JSON.stringify(parts({ ...emptyDraft, cases: [item] }).cases);
export const actionSnapshotText = (action: DraftAction) => JSON.stringify(actionSnapshot(action));

/** A conflict that keeps what was edited (as Información del negocio): what I changed stays and the rest takes what the other person saved. */
export function mergeDrafts(mine: AgentDraft, base: AgentDraft, theirs: AgentDraft): AgentDraft {
  const [m, b] = [parts(mine), parts(base)];
  const keep = (part: Part) => JSON.stringify(m[part]) !== JSON.stringify(b[part]);
  const from = (part: Part) => keep(part) ? mine : theirs;
  return {
    profile: { name: from("profile.name").profile.name, introduction: from("profile.introduction").profile.introduction, tone: from("profile.tone").profile.tone,
      does: from("profile.does").profile.does, doesNot: from("profile.doesNot").profile.doesNot, handoffMessage: from("profile.handoffMessage").profile.handoffMessage },
    cases: from("cases").cases, fallback: from("fallback").fallback,
    limits: { blockedTopics: from("limits.blockedTopics").limits.blockedTopics, cannotPromise: from("limits.cannotPromise").limits.cannotPromise,
      maxReplyLength: from("limits.maxReplyLength").limits.maxReplyLength, dailyReplyLimit: from("limits.dailyReplyLimit").limits.dailyReplyLimit,
      allowedActions: from("limits.allowedActions").limits.allowedActions },
  };
}
/** The parts that differ between two versions, in the order of the screen. */
export const changedParts = (left: AgentDraft, right: AgentDraft): Part[] => {
  const [l, r] = [parts(left), parts(right)];
  return (Object.keys(l) as Part[]).filter(part => JSON.stringify(l[part]) !== JSON.stringify(r[part]));
};

export function moveCase(cases: readonly DraftCase[], id: string, offset: -1 | 1): DraftCase[] {
  const from = cases.findIndex(item => item.id === id), to = from + offset;
  if (from < 0 || to < 0 || to >= cases.length) return [...cases];
  const next = [...cases];
  [next[from], next[to]] = [next[to]!, next[from]!];
  return next;
}

/** A problem to show at its field: the key of its text in «whatsappAssistant» and, for a fixed text, the language it is about. */
export interface AgentIssue { key: string; values?: Record<string, string | number>; culture?: AgentCulture }
export type AgentIssues = Record<string, AgentIssue>;

function required(issues: AgentIssues, key: string, value: string, max: number) {
  const text = value.trim();
  if (!text) issues[key] = { key: "validation.required" };
  else if (text.length > max) issues[key] = { key: "validation.tooLong", values: { count: max } };
}
function optional(issues: AgentIssues, key: string, value: string, max: number) {
  if (value.trim().length > max) issues[key] = { key: "validation.tooLong", values: { count: max } };
}
/** A fixed text needs its original; both languages have the same limit. */
function fixed(issues: AgentIssues, key: string, value: DraftTexts, max: number, original: AgentCulture) {
  if (!value[original].trim()) { issues[key] = { key: "validation.required", culture: original }; return; }
  const long = [original, other(original)].find(culture => value[culture].trim().length > max);
  if (long) issues[key] = { key: "validation.tooLong", values: { count: max }, culture: long };
}
function integer(issues: AgentIssues, key: string, value: string, min: number, max: number) {
  const number = Number(value.trim());
  if (!value.trim() || !Number.isInteger(number) || number < min || number > max) issues[key] = { key: "validation.range", values: { min, max } };
}

/** «Qué hacer» and its configuration, at `prefix` (`case:<id>.action`, `fallback` or, in the editor, `action`). */
export function validateAction(action: DraftAction, allowed: readonly AgentActionKind[], original: AgentCulture, prefix: string, issues: AgentIssues = {}): AgentIssues {
  const at = (path: string) => join(prefix, path);
  if (!action.kind) { issues[at("kind")] = { key: "validation.kindRequired" }; return issues; }
  if (!allowed.includes(action.kind)) issues[at("kind")] = { key: "validation.actionNotAllowed" };
  switch (action.kind) {
    case "SendForm": if (!action.formDefinitionId) issues[at("formDefinitionId")] = { key: "validation.formRequired" }; break;
    case "ExactText": fixed(issues, at("text"), action.text, agentLimits.text, original); break;
    case "DraftedReply": optional(issues, at("instructions"), action.instructions, agentLimits.instructions); break;
    case "Handoff": required(issues, at("handoffReason"), action.handoffReason, agentLimits.handoffReason); break;
    case "AskButtons": {
      fixed(issues, at("question"), action.question, agentLimits.question, original);
      if (!action.buttons.length) issues[at("buttons")] = { key: "validation.buttonsRequired" };
      const seen: Record<AgentCulture, Set<string>> = { es: new Set(), en: new Set() };
      action.buttons.forEach((button, index) => {
        const path = (name: string) => at(`buttons[${index}].${name}`);
        fixed(issues, path("title"), button.title, agentLimits.buttonTitle, original);
        for (const culture of ["es", "en"] as const) {
          const title = button.title[culture].trim().toLocaleLowerCase(culture);
          if (title && seen[culture].has(title) && !issues[path("title")]) issues[path("title")] = { key: "validation.repeatedButton", culture };
          if (title) seen[culture].add(title);
        }
        if (!button.destination) issues[path("destination")] = { key: "validation.destinationRequired" };
        else if (!allowed.includes(destinationKind(button.destination))) issues[path("destination")] = { key: "validation.actionNotAllowed" };
        else if (button.destination === "SendForm" && !button.formDefinitionId) issues[path("destination")] = { key: "validation.formRequired" };
        if (button.destination === "ExactText") fixed(issues, path("text"), button.text, agentLimits.text, original);
      });
      break;
    }
    case "NoReply": break;
  }
  return issues;
}

export function validateCase(item: DraftCase, allowed: readonly AgentActionKind[], original: AgentCulture, prefix: string, issues: AgentIssues = {}): AgentIssues {
  required(issues, join(prefix, "when"), item.when, agentLimits.when);
  return validateAction(item.action, allowed, original, join(prefix, "action"), issues);
}

/** Everything Guardar checks before sending, at the server's paths, with each case named by its id: moving it keeps its problems. */
export function validateDraft(draft: AgentDraft, original: AgentCulture): AgentIssues {
  const issues: AgentIssues = {};
  const { profile, limits } = draft;
  required(issues, "profile.name", profile.name, agentLimits.name);
  optional(issues, "profile.introduction", profile.introduction, agentLimits.introduction);
  optional(issues, "profile.tone", profile.tone, agentLimits.tone);
  optional(issues, "profile.does", profile.does, agentLimits.does);
  optional(issues, "profile.doesNot", profile.doesNot, agentLimits.doesNot);
  fixed(issues, "profile.handoffMessage", profile.handoffMessage, agentLimits.handoffMessage, original);
  for (const item of draft.cases) validateCase(item, limits.allowedActions, original, caseKey(item.id), issues);
  validateAction(draft.fallback, limits.allowedActions, original, "fallback", issues);
  const seen = new Set<string>();
  limits.blockedTopics.forEach((topic, index) => {
    const key = `limits.blockedTopics[${index}]`;
    required(issues, key, topic, agentLimits.blockedTopic);
    const name = topic.trim().toLocaleLowerCase();
    if (name && seen.has(name) && !issues[key]) issues[key] = { key: "validation.repeatedTopic" };
    seen.add(name);
  });
  if (limits.blockedTopics.length > agentLimits.blockedTopics) issues["limits.blockedTopics"] = { key: "validation.tooManyTopics", values: { count: agentLimits.blockedTopics } };
  optional(issues, "limits.cannotPromise", limits.cannotPromise, agentLimits.cannotPromise);
  integer(issues, "limits.maxReplyLength", limits.maxReplyLength, agentLimits.minReplyLength, agentLimits.maxReplyLength);
  integer(issues, "limits.dailyReplyLimit", limits.dailyReplyLimit, agentLimits.minDailyReplies, agentLimits.maxDailyReplies);
  if (!limits.allowedActions.length) issues["limits.allowedActions"] = { key: "validation.actionsRequired" };
  return issues;
}

const profileOrLimits = /^(profile\.(name|introduction|tone|does|doesNot|handoffMessage)|limits\.(blockedTopics(\[\d+\])?|cannotPromise|maxReplyLength|dailyReplyLimit|allowedActions))$/;
/**
 * The 400 of a save, at the screen's keys: `cases[2].when` becomes the key of the case that was third when it was sent. What has no
 * place on the screen (a count of cases, the revision) goes apart, to say it once.
 */
export function serverIssueKeys(errors: Readonly<Record<string, readonly string[]>>, caseIds: readonly string[]): { fields: Record<string, string[]>; others: string[] } {
  const fields: Record<string, string[]> = {}, others: string[] = [];
  for (const [path, messages] of Object.entries(errors)) {
    const match = /^cases\[(\d+)\](.*)$/.exec(path), id = match ? caseIds[Number(match[1])] : undefined;
    if (match && id) fields[caseKey(id) + match[2]] = [...messages];
    else if (!match && (profileOrLimits.test(path) || /^fallback(\.|$)/.test(path))) fields[path] = [...messages];
    else others.push(...messages);
  }
  return { fields, others };
}

/** The keys of one case or of «Cualquier otra cosa», relative to it (`when`, `action.text`; for the fallback, `kind`, `text`). */
export function issuesUnder<T>(issues: Readonly<Record<string, T>>, prefix: string): Record<string, T> {
  return Object.fromEntries(Object.entries(issues).flatMap(([key, value]) => key === prefix ? [["", value]] : key.startsWith(prefix + ".") ? [[key.slice(prefix.length + 1), value]] : []));
}
export const hasIssuesUnder = (issues: Readonly<Record<string, unknown>>, prefix: string) => Object.keys(issues).some(key => key === prefix || key.startsWith(prefix + "."));

/** The text in the language of the menu or, untranslated, the original. */
export const textIn = (value: DraftTexts | AgentTexts | null, culture: AgentCulture, original: AgentCulture) => value?.[culture]?.trim() || value?.[original]?.trim() || "";
/** The original, shown as a datum under the field (never copied) while the menu is in the other language. */
export const originalReference = (value: DraftTexts, culture: AgentCulture, original: AgentCulture) => culture !== original && value[original].trim() ? value[original].trim() : undefined;

/** The cases of the list: own ones, the forms block («Cuándo lo ofrece») and «Cualquier otra cosa». */
export const formCases = (forms: readonly AgentForm[]) => forms.filter(form => form.offerWhen?.trim());
export const caseCount = (draft: AgentDraft, forms: readonly AgentForm[]) => draft.cases.length + formCases(forms).length + 1;

/** How an action reads in a row: its label (with the form, to send one) and its configuration, in grey under it. */
export function describeAction(t: TFunction<"whatsappAssistant">, action: DraftAction, forms: readonly AgentForm[], culture: AgentCulture, original: AgentCulture): { label: string; detail: string } {
  const formName = (id: string | null) => forms.find(form => form.definitionId === id)?.name;
  const quoted = (text: string) => text ? t("quoted", { text }) : "";
  switch (action.kind) {
    case null: return { label: t("cases.noAction"), detail: "" };
    case "SendForm": {
      const name = formName(action.formDefinitionId);
      return name ? { label: t("cases.sendNamed", { form: name }), detail: "" } : { label: t("actions.SendForm"), detail: action.formDefinitionId ? t("cases.formUnavailable") : "" };
    }
    case "ExactText": return { label: t("actions.ExactText"), detail: quoted(textIn(action.text, culture, original)) };
    case "DraftedReply": return { label: t("actions.DraftedReply"), detail: quoted(action.instructions.trim()) };
    case "Handoff": return { label: t("actions.Handoff"), detail: quoted(action.handoffReason.trim()) };
    case "NoReply": return { label: t("actions.NoReply"), detail: "" };
    case "AskButtons": {
      const buttons = action.buttons.map(button => {
        const title = textIn(button.title, culture, original) || "…";
        const target = button.destination === "SendForm" ? formName(button.formDefinitionId) ?? t("cases.formUnavailable")
          : button.destination === "ExactText" ? quoted(textIn(button.text, culture, original)) || t("actions.ExactText")
          : button.destination === "Handoff" ? t("actions.Handoff") : "…";
        return t("cases.buttonTarget", { title, target });
      });
      return { label: t("actions.AskButtons"), detail: [quoted(textIn(action.question, culture, original)), ...buttons].filter(Boolean).join(" · ") };
    }
  }
}

/** Why a test or the chat hands off, from the code of the server: a case says its own reason as it is; a button, what was tapped (AS4). */
export function handoffReasonText(t: TFunction<"whatsappAssistant">, code: string | null, reason: string | null): string {
  switch (code) {
    case "case": return reason?.trim() || t("test.handoff.other");
    case "button": return reason?.trim() ? t("test.handoff.button", { title: reason.trim() }) : t("test.handoff.other");
    case "dailyReplyLimit": return t("test.handoff.dailyReplyLimit");
    case "replyTooLong": case "replyNotAllowed": return t("test.handoff.limits");
    case "blockedTopic": return t("test.handoff.blockedTopic");
    case "unknown": return t("test.handoff.unknown");
    // Task 8 of the documents: a linked account that can neither load nor build forms sent a document.
    case "documentNotAllowed": return t("test.handoff.documentNotAllowed");
    default: return t("test.handoff.other");
  }
}

/** The lines of the box «Mensajes»: one message per line, without the empty ones. */
export const testMessages = (value: string) => value.split(/\r?\n/).map(line => line.trim()).filter(Boolean);
export function testMessagesIssue(messages: readonly string[]): AgentIssue | null {
  if (!messages.length) return { key: "test.messagesRequired" };
  if (messages.length > agentLimits.testMessages) return { key: "test.tooManyMessages", values: { count: agentLimits.testMessages } };
  if (messages.some(message => message.length > agentLimits.testMessage)) return { key: "test.messageTooLong", values: { count: agentLimits.testMessage } };
  return null;
}
