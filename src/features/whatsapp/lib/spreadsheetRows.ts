import type { SpreadsheetRows } from "../api/chat";

type SheetRow = SpreadsheetRows["sent"][number];
/** A part of a list of rows: one row (`from` and `to` alike), or a run of more than three rows in a row («5 a 8»). */
export interface SpreadsheetRowPart { from: number; to: number }
export interface SpreadsheetRowGroup { sheet: string | null; count: number; parts: SpreadsheetRowPart[] }

/**
 * VC1-A, «Por qué lo propuso» of the notice of the loads: the rows of a list grouped by their sheet, in the order the sheets come (a notice
 * names every sheet or none), each sheet's rows in order. A run of more than three rows in a row reads as a range («Filas 5 a 8») and up to
 * three are listed («Filas 2, 3 y 4»), as the design writes them; a row number is an identifier, never grouped.
 */
export function spreadsheetRowGroups(rows: readonly SheetRow[]): SpreadsheetRowGroup[] {
  const sheets = [...new Set(rows.map(row => row.sheet))];
  return sheets.map(sheet => {
    const numbers = [...new Set(rows.filter(row => row.sheet === sheet).map(row => row.number))].sort((left, right) => left - right);
    const parts: SpreadsheetRowPart[] = [];
    let start = 0;
    for (let index = 1; index <= numbers.length; index++) {
      if (index < numbers.length && numbers[index] === numbers[index - 1] + 1) continue;
      const run = numbers.slice(start, index);
      if (run.length > 3) parts.push({ from: run[0], to: run[run.length - 1] });
      else parts.push(...run.map(number => ({ from: number, to: number })));
      start = index;
    }
    return { sheet, count: numbers.length, parts };
  });
}
