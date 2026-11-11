import { standardName } from "../boundQuestions";
import type { FormDefinitionStandard } from "../model";
import { useFormLibrary } from "./useFormLibrary";
import type { FormReadScope } from "./useFormQueries";

/**
 * BI1-A: the name of the library standard a form was copied from, as «Biblioteca» lists it in the menu language, read with the
 * same key as that screen. Without the standard nothing is read; while it loads, if it fails or the library no longer lists it,
 * the name is its key: it only names where the form came from, so a failure has no notice of its own.
 */
export function useFormStandardName(scope: FormReadScope, standard: FormDefinitionStandard | undefined): string | null {
  const library = useFormLibrary(scope, { enabled: !!standard, silent: true });
  return standard ? standardName(standard, library.data?.standards) : null;
}
