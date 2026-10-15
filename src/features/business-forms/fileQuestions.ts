import type { DraftQuestion, DraftFileSettings, FormFileSettings } from "./model";

export const maximumFiles = (questions: readonly DraftQuestion[]) => questions.reduce((sum, question) =>
  sum + ((question.type === "photo" || question.type === "document") && Number.isInteger(question.files.maxFiles)
    ? question.files.maxFiles ?? 0 : 0), 0);

// Each file question starts a screen; the scalar questions following it share that screen.
export function formScreens(questions: readonly DraftQuestion[]): readonly (readonly DraftQuestion[])[] {
  const screens: DraftQuestion[][] = [[]];
  for (const question of questions) {
    if ((question.type === "photo" || question.type === "document") && screens.at(-1)!.length > 0) screens.push([]);
    screens.at(-1)!.push(question);
  }
  return screens;
}

export function validFileCounts(files: DraftFileSettings): files is FormFileSettings {
  return files.minFiles !== null && files.maxFiles !== null && Number.isInteger(files.minFiles) && Number.isInteger(files.maxFiles)
    && files.minFiles >= 0 && files.maxFiles >= 1 && files.maxFiles <= 10 && files.minFiles <= files.maxFiles;
}

export function hasInvalidFileCounts(questions: readonly DraftQuestion[]): boolean {
  return questions.some(question => (question.type === "photo" || question.type === "document") && !validFileCounts(question.files));
}
