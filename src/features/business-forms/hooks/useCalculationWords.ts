import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import type { FormulaWords } from "../calculations";

// Each screen reads them from the namespace it already has loaded: the editor from «forms», the loading from «formEntries».
// Asking the editor for another namespace would make it wait for that file while it is drawn.
const prefixes = { forms: "calculation.formula.", formEntries: "calculation." } as const;

/** The words of a calculation's formula (CA1-A) in the language of the screen, for its line in the editor and its (i) when loading. */
export function useCalculationWords(namespace: "forms" | "formEntries"): FormulaWords {
  const { t, i18n } = useTranslation(namespace);
  return useMemo(() => {
    const prefix = prefixes[namespace];
    return {
      multiply: (first, second) => t(prefix + "multiply", { first, second }),
      percent: (base, rate) => t(prefix + "percent", { base, rate }),
      sum: questions => t(prefix + "sum", { questions }),
      allItems: label => t(prefix + "allItems", { label }),
      list: items => new Intl.ListFormat(i18n.language, { type: "conjunction" }).format(items),
      missing: "…",
    };
  }, [t, i18n.language, namespace]);
}
