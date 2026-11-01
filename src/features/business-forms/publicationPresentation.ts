export function publicationLabelKey(state: string | null | undefined, list = false): string {
  if (list) return state === "Published" ? "publication.listPublished" : state === "Failed" ? "publication.listFailed" : state === "Uncertain" ? "publication.unconfirmed" : state && state !== "Draft" ? "publication.listPublishing" : "draft";
  return state === "Published" ? "publication.published" : state === "Failed" ? "publication.failed" : state === "Uncertain" ? "publication.unconfirmed" : state && state !== "Draft" ? "publication.publishing" : "draft";
}

import type { FormPublicationStatus } from "./api/response";
import type { DraftEditorValue } from "./model";
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
