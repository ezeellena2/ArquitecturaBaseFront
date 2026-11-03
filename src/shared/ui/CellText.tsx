import { Fragment } from "react";

/** The text of a table cell that wraps: it breaks only at its spaces and, between words, after a slash, with its words
 *  whole (2026-11-02). A code or a number with hyphens («30-71458236-9») stays on one line, and a path such as a time zone
 *  («America/Argentina/Buenos Aires») breaks only after its slashes. A date and the words without hyphens or slashes are
 *  left as they are. */
export function CellText({ text }: { text: string }) {
  return text.split(/(\s+)/).map((part, index) => /\p{L}\/|\/\p{L}/u.test(part)
    ? <Fragment key={index}>{part.split(/(?<=\/)/).map((piece, at) => <Fragment key={at}>{at ? <wbr /> : null}<span className="whitespace-nowrap">{piece}</span></Fragment>)}</Fragment>
    : part.includes("-") ? <span key={index} className="whitespace-nowrap">{part}</span> : part);
}
