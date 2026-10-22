export type CatalogPaste = { valid: true; csv: string; rowCount: number; columnCount: number } | { valid: false; reason: "format" | "limit" };

// Excel quotes cells containing tabs, line breaks or quotes. Keep their contents; the server owns header/row validation.
export function parseCatalogPaste(text: string): CatalogPaste {
  if (!text.trim()) return { valid: false, reason: "format" };
  if (text.length > 10 * 1024 * 1024) return { valid: false, reason: "limit" };
  const rows: string[][] = []; let row: string[] = [], field = "", state: "start" | "plain" | "quoted" | "closed" = "start";
  const cell = () => { row.push(field); field = ""; state = "start"; };
  const line = () => { cell(); rows.push(row); row = []; };
  for (let index = 0; index < text.length; index++) {
    const character = text[index]!;
    if (state === "quoted") {
      if (character === '"') { if (text[index + 1] === '"') { field += '"'; index++; } else state = "closed"; }
      else field += character;
      continue;
    }
    if (character === "\t") cell();
    else if (character === "\r" || character === "\n") { if (character === "\r" && text[index + 1] === "\n") index++; line(); }
    else if (character === '"' && state === "start") state = "quoted";
    else { if (state === "closed") return { valid: false, reason: "format" }; field += character; state = "plain"; }
    if (row.length > 64 || rows.length > 10002) return { valid: false, reason: "limit" };
  }
  if (state === "quoted") return { valid: false, reason: "format" };
  if (row.length || field.length || state !== "start") line();
  if (rows.some(cells => cells.length > 64) || rows.length > 10002) return { valid: false, reason: "limit" };
  return { valid: true, csv: rows.map(cells => cells.map(value => '"' + value.replaceAll('"', '""') + '"').join(",")).join("\r\n"), rowCount: Math.max(0, rows.length - 1), columnCount: rows[0]?.length ?? 0 };
}
