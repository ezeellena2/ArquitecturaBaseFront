export function publicationLabelKey(state: string | null | undefined, list = false): string {
  if (list) return state === "Published" ? "publication.listPublished" : state === "Failed" ? "publication.listFailed" : state === "Uncertain" ? "publication.unconfirmed" : state && state !== "Draft" ? "publication.listPublishing" : "draft";
  return state === "Published" ? "publication.published" : state === "Failed" ? "publication.failed" : state === "Uncertain" ? "publication.unconfirmed" : state && state !== "Draft" ? "publication.publishing" : "draft";
}

import type { FormPublicationStatus } from "./api/response";
export function uniquePublicationIssues(issues: FormPublicationStatus["issues"]) {
 const seen = new Set<string>();
 return (issues ?? []).filter(issue => {
  const key = JSON.stringify([issue.channelId,issue.code,issue.path,issue.fieldId,issue.choiceId,issue.culture]);
  if (seen.has(key)) return false;
  seen.add(key); return true;
 });
}
