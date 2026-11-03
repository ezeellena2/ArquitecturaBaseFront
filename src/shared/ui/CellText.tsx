/** The text of a table cell that wraps: it breaks only at its spaces, so a code or a number with hyphens
 *  («30-71458236-9») stays on one line (2026-11-02). The words without hyphens are left as they are. */
export function CellText({ text }: { text: string }) {
  return text.split(/(\s+)/).map((part, index) => part.includes("-") ? <span key={index} className="whitespace-nowrap">{part}</span> : part);
}
