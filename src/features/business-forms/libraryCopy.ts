import type { FormStandard } from "./api/library";

// BI1-A: the standard's prefix, or with a number after it when copies already took it: «FAC», «FAC2»… within the twelve characters a
// prefix takes. The server still says if it is taken.
export function suggestedPrefix(standard: Pick<FormStandard, "prefix" | "copies">): string {
  if (standard.copies === 0) return standard.prefix;
  const suffix = String(standard.copies + 1);
  return standard.prefix.slice(0, 12 - suffix.length) + suffix;
}
