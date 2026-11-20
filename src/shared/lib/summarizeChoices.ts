/** DS2-A (2026-11-19): as many chosen names as fit, in the order of the list, and «y N más» for the rest. The first name
 * always goes, even if the field has to cut it. `fits` says whether a text fits in the field; `more` words the rest. */
export function summarizeChoices(labels: readonly string[], fits: (text: string) => boolean, more: (count: number) => string): { names: string; more: string | null } {
  for (let count = labels.length; count > 1; count--) {
    const names = labels.slice(0, count).join(", "), rest = labels.length - count;
    const suffix = rest > 0 ? more(rest) : null;
    if (fits(suffix ? `${names} ${suffix}` : names)) return { names, more: suffix };
  }
  return { names: labels[0] ?? "", more: labels.length > 1 ? more(labels.length - 1) : null };
}
