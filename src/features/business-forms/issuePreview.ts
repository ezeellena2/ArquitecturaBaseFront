/** A localized text of an issuer («Factura A», the (i) of «¿La emito?», an amount's label) in the menu language. */
export const issueText = (text: Readonly<Record<string, string>> | null | undefined, language: string) => text?.[language === "en" ? "en" : "es"] ?? text?.es ?? "";
