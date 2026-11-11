import type { FormEntry, FormEntryQuestion } from "./api/entries";
import { titlesByFirstQuestion } from "./sectionTitles";
import type { DraftEditorValue, DraftQuestion, FormCulture } from "./model";

// The names the editor gives what has no text yet, in the preview language.
export interface AppPreviewWords {
  readonly question: string;
  readonly option: (number: number) => string;
  readonly section: string;
  readonly form: string;
  readonly submit: string;
  /** Why a catalog question waits: the draft has no published version to bring the options of. */
  readonly catalog: string;
}

// Nothing is published yet: the identities are the editor's, never sent anywhere.
const previewId = "00000000-0000-4000-8000-000000000000";

// SA2-A (2026-11-09): with «Sólo en la app» the editor's preview is the app's «Nueva respuesta», in one column and with a box per
// item of the block. It is the draft as the app would load it, in the preview language: a question without a text yet takes the
// editor's name, and a catalog question waits for its options instead of asking the server, which only has them for a published
// version. Ranges still being written take the smallest that makes sense.
export function appPreviewEntry(value: DraftEditorValue, culture: FormCulture, words: AppPreviewWords): FormEntry {
  const text = (map: Readonly<Record<string, string | null>> | null | undefined) => map?.[culture]?.trim() ?? "";
  const titles = titlesByFirstQuestion(value.draft.fields, value.draft.sections);
  const question = (field: DraftQuestion): FormEntryQuestion => {
    const section = titles.get(field.localId);
    const list = (field.type === "choice" || field.type === "multiChoice");
    return {
      fieldId: field.fieldId ?? field.localId,
      type: field.type,
      label: text(field.label) || words.question,
      help: text(field.help) || null,
      required: field.required,
      maxLength: field.type === "shortText" || field.type === "longText" ? field.maxLength : null,
      options: list && !field.source ? field.options.map((option, index) => ({ id: option.choiceId ?? option.localId, label: text(option.label) || words.option(index + 1) })) : null,
      selection: field.type === "multiChoice" ? { minSelected: field.selection.minSelected ?? 0, maxSelected: field.selection.maxSelected ?? 20 } : null,
      files: field.type === "photo" || field.type === "document" ? { minFiles: field.files.minFiles ?? 0, maxFiles: field.files.maxFiles ?? 1,
        photoSource: field.type === "photo" ? field.files.photoSource ?? "cameraOrGallery" : null } : null,
      catalog: list && field.source ? { onlyOption: null, issue: words.catalog, missingData: null } : null,
      ...section ? { section: text(section.title) || words.section } : {},
      ...field.type === "group" ? { rows: { minRows: field.rows.minRows ?? 0, maxRows: field.rows.maxRows ?? Math.max(1, field.rows.minRows ?? 1) } } : {},
      ...("repeated" in field && field.repeated ? { repeated: true as const } : {}),
    };
  };
  return { definitionId: previewId, versionId: previewId, versionNumber: 1, prefix: value.prefix, name: text(value.name) || words.form, culture,
    submitLabel: text(value.draft.submitLabel) || words.submit, maxFileSizeMiB: 25, questions: value.draft.fields.map(question) };
}
