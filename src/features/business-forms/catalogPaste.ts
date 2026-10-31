import type { CatalogValueType } from "./catalogValues";

type PastedRows = { valid: true; rows: string[][] } | { valid: false; reason: "format" | "limit" };

// Excel quotes cells containing tabs, line breaks or quotes. Keep their contents; the server owns header/row validation.
function pastedRows(text: string): PastedRows {
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
  return { valid: true, rows };
}

const csvRows = (rows: readonly (readonly string[])[]) => rows.map(cells => cells.map(value => '"' + value.replaceAll('"', '""') + '"').join(",")).join("\r\n");

/** A column the paste grid offers: its label, the header the server reads when the paste brings none, and the headers that
 *  name it (normalized). */
export interface CatalogPasteColumn { id: string; label: string; header: string; names: readonly string[] }
/** A column of the pasted sheet: one of the catalog's (`id`) or one the server does not import (`id` null), with the pasted
 *  column that fills it (`source`, -1 when nothing was pasted in it). */
export interface CatalogSheetColumn { id: string | null; label: string | null; source: number }
export interface CatalogPastedSheet {
  /** The catalog's columns in their order, then the pasted ones outside them. */
  columns: readonly CatalogSheetColumn[];
  /** The data rows, as pasted. */
  rows: readonly (readonly string[])[];
  /** By pasted column, the header the server reads, or "" when it does not import it. */
  headers: readonly string[];
}

// As the server reads a header: without accents, in lowercase, one space between words.
export const normalizeCatalogHeader = (text: string) => text.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().split(/\s+/).filter(Boolean).join(" ");
const fixedNames: Readonly<Record<string, readonly string[]>> = {
  code: ["codigo", "code"], text: ["texto", "text"], textEn: ["texto en ingles", "english text"], textEs: ["texto en espanol", "spanish text"],
  detail: ["detalle", "detail"], detailEn: ["detalle en ingles", "english detail"], detailEs: ["detalle en espanol", "spanish detail"],
  active: ["activa", "active"], value: ["valor", "value"],
};
const serverHeaders: Readonly<Record<string, string>> = { code: "Code", text: "Text", textEn: "English text", textEs: "Spanish text", detail: "Detail",
  detailEn: "English detail", detailEs: "Spanish detail", active: "Active", value: "Value" };
const typedValue = /^(valor|value|valor canonico|canonical value) \(/;
const isFixedName = (text: string) => Object.values(fixedNames).some(names => names.includes(normalizeCatalogHeader(text)));
type PasteField = { id: string; key: string; name: Readonly<Record<string, string | null | undefined>> };
type PasteLabels = { fixed: (id: string) => string; field: (field: PasteField) => string };
const fixedColumn = (id: string, labels: PasteLabels): CatalogPasteColumn => ({ id, label: labels.fixed(id), header: serverHeaders[id]!, names: fixedNames[id]! });

/** The grid's columns, in the template's order: code, text, detail, active, the value of a typed catalog and the active fields
 *  (already sorted). A field whose key is a fixed column's name goes as «key [field]», as the server writes it. */
export function catalogPasteColumns(valueType: CatalogValueType, fields: readonly PasteField[], labels: PasteLabels): CatalogPasteColumn[] {
  return [...["code", "text", "detail", "active", ...(valueType === "Text" ? [] : ["value"])].map(id => fixedColumn(id, labels)),
    ...fields.map(field => ({ id: field.id, label: labels.field(field), header: isFixedName(field.key) ? field.key + " [field]" : field.key,
      names: [field.key, ...Object.values(field.name)].filter((name): name is string => !!name?.trim()).map(normalizeCatalogHeader) }))];
}
/** The translation columns of the catalog's original, which the grid shows only when they come with their headers. */
export const catalogPasteExtraColumns = (originalCulture: string, labels: PasteLabels) =>
  (originalCulture === "en" ? ["textEs", "detailEs"] : ["textEn", "detailEn"]).map(id => fixedColumn(id, labels));

// As the server matches a header: a field written with [campo]/[field] first, then a fixed column, then a field's key or name.
function matchColumn(text: string, columns: readonly CatalogPasteColumn[]): string | null {
  const normalized = normalizeCatalogHeader(text);
  if (!normalized) return null;
  const isField = (column: CatalogPasteColumn) => !(column.id in fixedNames);
  const bare = normalized.replace(/ \[(campo|field|canonico|canonical)\]$/, "");
  if (bare !== normalized) { const field = columns.find(column => isField(column) && column.names.includes(bare)); if (field) return field.id; }
  const fixed = columns.find(column => !isField(column) && (column.names.includes(normalized) || column.id === "value" && typedValue.test(normalized)));
  return fixed?.id ?? columns.find(column => isField(column) && column.names.includes(normalized))?.id ?? null;
}

/** Pasted rows in the grid: a first row that names one of the columns is the header row and places each column; otherwise the
 *  rows go in the order of the grid's columns. Empty rows are dropped. */
export function readCatalogPaste(text: string, columns: readonly CatalogPasteColumn[], extra: readonly CatalogPasteColumn[] = []): { valid: true; sheet: CatalogPastedSheet } | { valid: false; reason: "format" | "limit" } {
  const parsed = pastedRows(text);
  if (!parsed.valid) return parsed;
  const rows = parsed.rows.filter(cells => cells.some(cell => cell.trim()));
  if (!rows.length) return { valid: false, reason: "format" };
  const known = [...columns, ...extra], first = rows[0]!.map(cell => matchColumn(cell, known));
  const headed = first.some(Boolean), width = Math.max(...rows.map(cells => cells.length));
  const pasted = Array.from({ length: width }, (_, index) => headed
    ? { id: first[index] ?? null, label: rows[0]![index]?.trim() || null, header: rows[0]![index] ?? "" }
    : { id: columns[index]?.id ?? null, label: columns[index]?.label ?? null, header: columns[index]?.header ?? "" });
  const used = new Set<number>();
  const sheetColumns: CatalogSheetColumn[] = columns.map(column => {
    const source = pasted.findIndex((value, index) => value.id === column.id && !used.has(index));
    if (source >= 0) used.add(source);
    return { id: column.id, label: column.label, source };
  });
  pasted.forEach((value, index) => { if (!used.has(index)) sheetColumns.push({ id: value.id, label: value.id ? known.find(column => column.id === value.id)!.label : value.label, source: index }); });
  return { valid: true, sheet: { columns: sheetColumns, rows: headed ? rows.slice(1) : rows, headers: pasted.map(value => value.id ? value.header : "") } };
}

/** The CSV the server reviews: only the pasted columns it imports, with their headers. */
export function catalogPasteCsv(sheet: CatalogPastedSheet): string {
  const imported = sheet.headers.flatMap((header, index) => header ? [index] : []);
  return csvRows([imported.map(index => sheet.headers[index]!), ...sheet.rows.map(cells => imported.map(index => cells[index] ?? ""))]);
}
