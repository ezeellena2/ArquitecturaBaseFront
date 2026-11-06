export function publicationLabelKey(state: string | null | undefined, list = false): string {
  if (list) return state === "Published" ? "publication.listPublished" : state === "Failed" ? "publication.listFailed" : state === "Uncertain" ? "publication.unconfirmed" : state && state !== "Draft" ? "publication.listPublishing" : "draft";
  return state === "Published" ? "publication.published" : state === "Failed" ? "publication.failed" : state === "Uncertain" ? "publication.unconfirmed" : state && state !== "Draft" ? "publication.publishing" : "draft";
}

import type { TFunction } from "i18next";
import type { FormPublicationCheck, FormPublicationStatus } from "./api/response";
import { localizedValue } from "./editorModel";
import type { DraftEditorValue, FormCulture } from "./model";
export function uniquePublicationIssues(issues: FormPublicationStatus["issues"]) {
 const seen = new Set<string>();
 return (issues ?? []).filter(issue => {
  const key = JSON.stringify([issue.channelId,issue.code,issue.path,issue.fieldId,issue.choiceId,issue.culture]);
  if (seen.has(key)) return false;
  seen.add(key); return true;
 });
}

// The saved text an issue points at, in its language, and how long it is: the form name (saved trimmed, as the server
// keeps it), the final button, or a question's title, help or option. Null when the draft no longer has it.
export function publicationIssueText(issue: { path: string; fieldId: string | null; choiceId: string | null; culture: "es" | "en" | null }, value: DraftEditorValue) {
 const { culture } = issue;
 if (!culture) return null;
 const measure = (part: "name" | "submitLabel" | "label" | "help" | "option", text: string | null | undefined) => text === null || text === undefined ? null : { part, length: text.length };
 if (issue.path.startsWith("name.")) return measure("name", value.name[culture]?.trim());
 if (issue.path.startsWith("draft.submitLabel.")) return measure("submitLabel", value.draft.submitLabel[culture]);
 const question = value.draft.fields.find(field => !!field.fieldId && field.fieldId.toLowerCase() === issue.fieldId?.toLowerCase());
 if (!question) return null;
 if (issue.path.includes(".options[")) {
  const options = (question.type === "choice" || question.type === "multiChoice") && !question.source ? question.options : [];
  return measure("option", options.find(option => !!option.choiceId && option.choiceId.toLowerCase() === issue.choiceId?.toLowerCase())?.label[culture]);
 }
 return issue.path.includes(".help.") ? measure("help", question.help?.[culture]) : measure("label", question.label[culture]);
}

// How a publication problem is named and detailed, from the draft it points at: the question, section title or text in the menu
// language (the original when it has no translation), and a text over its limit with how long it is. The check before publishing
// (PU1-A) and a publication that did not go through (EP1-A) show the same rows.
export function publicationIssueNames(value: DraftEditorValue, culture: FormCulture, t: TFunction<"forms">) {
 type Issue = FormPublicationCheck["issues"][number];
 const questionOf = (fieldId: string | null) => value.draft.fields.find(q => !!q.fieldId && q.fieldId.toLowerCase() === fieldId?.toLowerCase());
 const questionName = (fieldId: string | null) => { const question = questionOf(fieldId); return question ? localizedValue(question.label, culture, value.draft.culture) : null; };
 // A section title (CW15-B) is named by its place in the draft.
 const sectionOf = (path: string) => { const match = /^draft\.sections\[(\d+)\]/.exec(path); return match ? value.draft.sections?.[Number(match[1])] : undefined; };
 const sectionName = (path: string) => { const section = sectionOf(path); return section ? localizedValue(section.title, culture, value.draft.culture) || t("sections.title") : null; };
 const choiceName = (issue: Issue) => {
  const question = questionOf(issue.fieldId);
  const option = question && (question.type === "choice" || question.type === "multiChoice") && !question.source ? question.options.find(choice => choice.choiceId === issue.choiceId) : undefined;
  return option ? localizedValue(option.label, culture, value.draft.culture) : null;
 };
 const issueName = (issue: Issue) => {
  const name = questionName(issue.fieldId) ?? sectionName(issue.path)
   ?? (issue.path.startsWith("name") ? t("name") : issue.path.startsWith("draft.submitLabel") ? t("submitLabel") : issue.channelId || issue.path === "channel" ? t("publication.channelIssue") : t("publication.formIssue"));
  // NI1-A (2026-11-03): a problem names its language only when it is not the menu's.
  return issue.culture && issue.culture !== culture ? t("localizedChange", { name, language: t("cultures." + issue.culture) }) : name;
 };
 // A text over its limit says how long it is, and which text when it is not the title (the limit comes in the issue).
 const issueDetail = (issue: Issue) => {
  const text = issue.code === "WhatsApp.Flow.TextTooLong" && issue.limit !== null ? publicationIssueText(issue, value) : null;
  if (!text) return issue.message;
  return t(text.part === "help" ? "publication.helpTooLong" : text.part === "option" ? "publication.optionTooLong" : "publication.textTooLong", { limit: issue.limit, length: text.length, option: choiceName(issue) });
 };
 return { questionOf, questionName, sectionOf, sectionName, choiceName, issueName, issueDetail };
}

// VO1-A (2026-11-06): Meta's official preview runs in its interactive mode, so «Continuar» moves on as on the phone. That mode
// refuses to start without knowing where: the first screen of every Flow the app compiles is FORM (WhatsAppFlowScreenBuilder in the
// backend), where the messages that open a form start too. Without its actions panel (`debug`), which shows technical names and JSON.
export function interactivePreviewUrl(url: string) {
 const preview = new URL(url);
 preview.searchParams.set("interactive", "true");
 preview.searchParams.set("flow_action", "navigate");
 preview.searchParams.set("flow_action_payload", JSON.stringify({ screen: "FORM" }));
 return preview.toString();
}
