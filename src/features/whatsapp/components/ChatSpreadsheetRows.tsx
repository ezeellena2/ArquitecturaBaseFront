import type { ReactNode } from "react";
import { Link } from "react-router";
import { useTranslation } from "react-i18next";
import type { DataListItem } from "@/shared/ui/DataList";
import type { SpreadsheetRows } from "../api/chat";
import { spreadsheetRowGroups } from "../lib/spreadsheetRows";

type SheetRow = SpreadsheetRows["sent"][number];
// «Documentos recibidos» is a route of the forms' area: the chat only links to it, with the address the app gives it.
const receivedDocumentsPath = "/formularios/documentos";

/**
 * VC1-A, «Por qué lo propuso» under the notice of the loads of a spreadsheet, like «Por qué lo mandó» under a form: in two columns (LR1),
 * what it recognized of each form (named in the reader's language by the server), the rows it sent as loads, the ones it passed to the
 * team and the repeated ones with the response they are already in or the row they are equal to. It names forms, rows and response
 * numbers, never a value of a response, so it is seen with «Ver chats»; the way to the inbox goes only to whoever can open it. Like
 * «Prellenado con», the two columns of `DataList` go from 640 px: in the celular each value goes under its datum, so a datum never breaks
 * inside a word in the narrow box of a message.
 */
export function SpreadsheetRowsWhy({ rows, linksInbox }: { rows: SpreadsheetRows; linksInbox: boolean }) {
  const { t, i18n } = useTranslation("whatsapp");
  const list = (items: readonly string[]) => new Intl.ListFormat(i18n.resolvedLanguage ?? "es", { type: "conjunction" }).format(items);
  const lines = (items: readonly string[]): ReactNode => items.length === 1 ? items[0]
    : <ul className="flex flex-col gap-1">{items.map((item, index) => <li key={index}>{item}</li>)}</ul>;
  const rowName = (row: SheetRow, inline = false) => row.sheet === null ? t(inline ? "spreadsheetRows.rowInline" : "spreadsheetRows.row", { number: String(row.number) })
    : t("spreadsheetRows.sheetRow", { sheet: row.sheet, number: String(row.number) });
  const rowList = (items: readonly SheetRow[]) => lines(spreadsheetRowGroups(items).map(group => {
    const numbers = list(group.parts.map(part => part.from === part.to ? String(part.from) : t("spreadsheetRows.range", { from: String(part.from), to: String(part.to) })));
    return group.sheet === null ? t("spreadsheetRows.rows", { count: group.count, rows: numbers }) : t("spreadsheetRows.sheetRows", { count: group.count, rows: numbers, sheet: group.sheet });
  }));
  const items: DataListItem[] = [
    { key: "recognized", label: t("spreadsheetRows.recognized"), value: lines(rows.recognized.map(entry => t("spreadsheetRows.recognizedValue", { count: entry.count, form: entry.form }))) },
    ...rows.sent.length ? [{ key: "sent", label: t("spreadsheetRows.sent"), value: rowList(rows.sent) }] : [],
    ...rows.forTeam.length ? [{ key: "forTeam", label: t("spreadsheetRows.forTeam"), value: rowList(rows.forTeam) }] : [],
    ...rows.repeated.length ? [{ key: "repeated", label: t("spreadsheetRows.repeated"), value: lines(rows.repeated.map(entry => entry.sameAs
      ? t("spreadsheetRows.repeatedSame", { row: rowName(entry.row), other: rowName(entry.sameAs, true) })
      : t("spreadsheetRows.repeatedIn", { row: rowName(entry.row), number: entry.recordNumber ?? "" }))) }] : [],
  ];
  return <section className="rounded-[var(--radius-control)] bg-[var(--color-surface-muted)] p-3 text-sm">
    <p className="font-medium">{t("spreadsheetRows.title")}</p>
    {/* The body reads from the left, as «Por qué lo mandó»: the title follows the side of the message. */}
    <div className="mt-2 flex flex-col items-start gap-2 text-left">
      <dl className="w-full divide-y divide-[var(--color-border)]">{items.map(item => <div key={item.key} className="grid min-w-0 grid-cols-1 gap-1 py-2 sm:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] sm:gap-3">
        <dt className="min-w-0 break-words text-[var(--color-content-muted)]">{item.label}</dt>
        <dd className="min-w-0 break-words">{item.value}</dd>
      </div>)}</dl>
      {linksInbox ? <Link to={receivedDocumentsPath} className="font-medium text-[var(--color-brand-700)] underline">{t("spreadsheetRows.link")}</Link> : null}
    </div>
  </section>;
}
