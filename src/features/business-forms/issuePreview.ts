import type { TFunction } from "i18next";
import { formatExactDecimal } from "@/shared/lib/decimal";

/** A localized text of an issuer («Factura A», the (i) of «¿La emito?», an amount's label) in the menu language. */
export const issueText = (text: Readonly<Record<string, string>> | null | undefined, language: string) => text?.[language === "en" ? "en" : "es"] ?? text?.es ?? "";

/** An amount an issuer gives, exact and with the currency as the language writes it («$ 1.210,00»); «—» without one. */
export const issueMoney = (value: string | null | undefined, language: string, t: TFunction<["forms", "common"]> | TFunction<"formEntries"> | TFunction) =>
  value ? String(t("common:money", { amount: formatExactDecimal(value, language) ?? value })) : "—";
