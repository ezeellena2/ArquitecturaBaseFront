import { ApiError } from "@/shared/api/ApiError";
import { errorFeedback, operationalErrorMessage, readErrorMessage } from "@/shared/api/errorFeedback";
import { notify } from "@/shared/ui/notifications";
import type { FormFolderDeletion } from "../api/folders";

type Translate = (key: string, options?: Record<string, unknown>) => string;
const conflictCodes = ["Forms.Folder.RevisionConflict", "Forms.Folder.SetChanged"];

/// One owner for the failure of a folder write. A problem of a visible field (the name, where it goes, the icon) comes back to
/// be shown under it, without a notice. A changed revision or set keeps what was chosen or written and offers to read again;
/// anything else is one notice, and a folder that no longer exists reads the tree again.
export function folderWriteFailure(error: unknown, { t, id, fields, reread }: { t: Translate; id: string; fields: readonly string[]; reread: () => void }): Record<string, string> | null {
  const feedback = errorFeedback(error, { writing: true, fields, conflictCodes });
  if (feedback.kind === "cancelled") return null;
  if (feedback.kind === "fields") return Object.fromEntries(Object.entries(feedback.fields).map(([field, messages]) => [field, messages[0] ?? ""]));
  if (feedback.kind === "conflict") {
    notify({ id, kind: "error", message: feedback.detail ?? t("common:states.error"), action: { label: t("formFolders:reread"), onClick: reread } });
    return null;
  }
  notify({ id, kind: "error", message: feedback.kind === "uncertain" ? operationalErrorMessage(error, t) : readErrorMessage(error, t) });
  if (error instanceof ApiError && error.code === "Forms.Folder.NotFound") reread();
  return null;
}

/// What deleting loses, as the board says it (CM4): a folder of the first level leaves the menu and a subfolder leaves its folder
/// (`parentName`); its subfolders go along, and its forms and catalogs stay in their other folders or without one. No form or
/// catalog is ever deleted.
export function deletionSentences(counts: FormFolderDeletion, parentName: string | null, t: Translate): string[] {
  const leaves = parentName === null ? t("deleteDialog.leavesMenu") : t("deleteDialog.leavesParent", { name: parentName });
  const items = counts.formCount > 0 && counts.catalogCount > 0 ? t("deleteDialog.items", { count: counts.formCount + counts.catalogCount })
    : counts.formCount > 0 ? t("deleteDialog.forms", { count: counts.formCount })
    : counts.catalogCount > 0 ? t("deleteDialog.catalogs", { count: counts.catalogCount }) : t("deleteDialog.empty");
  return [leaves, ...counts.subfolderCount > 0 ? [t("deleteDialog.subfolders", { count: counts.subfolderCount })] : [], items];
}
