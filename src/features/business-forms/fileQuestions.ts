import type { DraftQuestion } from "./model";

export const maximumFiles = (questions: readonly DraftQuestion[]) => questions.reduce((sum, question) => sum + (question.type === "photo" || question.type === "document" ? question.files.maxFiles : 0), 0);

// Each file question starts a screen; the scalar questions following it share that screen.
export function formScreens(questions: readonly DraftQuestion[]): readonly (readonly DraftQuestion[])[] {
  const screens: DraftQuestion[][] = [[]];
  for (const question of questions) {
    if ((question.type === "photo" || question.type === "document") && screens.at(-1)!.length > 0) screens.push([]);
    screens.at(-1)!.push(question);
  }
  return screens;
}
