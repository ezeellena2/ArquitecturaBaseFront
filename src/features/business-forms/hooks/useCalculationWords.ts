import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import type { FormulaWords } from "../calculations";

/** The words of a calculation's formula (CA1-A) in the language of the screen, for its (i) when loading and its line in the editor. */
export function useCalculationWords(): FormulaWords {
  const { t, i18n } = useTranslation("formEntries");
  return useMemo(() => ({
    multiply: (first, second) => t("calculation.multiply", { first, second }),
    percent: (base, rate) => t("calculation.percent", { base, rate }),
    sum: questions => t("calculation.sum", { questions }),
    allItems: label => t("calculation.allItems", { label }),
    list: items => new Intl.ListFormat(i18n.language, { type: "conjunction" }).format(items),
    missing: "…",
  }), [t, i18n.language]);
}
