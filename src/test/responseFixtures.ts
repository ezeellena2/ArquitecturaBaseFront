import type {
  ResponseSheet,
  ResponseDetail,
} from "@/features/business-forms/api/responses";
import type { FormEntryQuestion, FormResponseEntry } from "@/features/business-forms/api/entries";
type DetailValue = ResponseDetail["values"][number]["value"];
type DetailAnswer = Pick<ResponseDetail["values"][number], "fieldId" | "type" | "label" | "value">;
type EntryAnswer = FormResponseEntry["answers"][number];
const isChoice = (value: unknown): value is { choiceId: string; label: string; catalogId?: string | null; detail?: string | null } =>
  typeof value === "object" && value !== null && "choiceId" in value;
const isFile = (value: unknown): value is { fileId: string; name: string; contentType: string; size: number; hasThumbnail?: boolean } =>
  typeof value === "object" && value !== null && "fileId" in value;
// An own option that no answer chose, so a list question always has its options (the form asks for at least one).
const placeholderOption = { id: "0199a0c0-0000-7000-8000-0000000009ff", label: "Otra opción" };

/**
 * The form of a response's version and its answers in that shape (VF1-A), built from the values of the detail: each value is
 * a question of its type, a catalog option a catalog question and a block the questions of its items. Synthetic: enough for the
 * reading to draw the same answers the detail brings.
 */
export function responseEntryFixture(values: readonly DetailAnswer[], versionId = "0199a0c0-0000-7000-8000-000000000013", versionNumber = 2): FormResponseEntry {
  const question = (value: DetailAnswer, repeated = false): FormEntryQuestion => {
    const chosen = Array.isArray(value.value) ? (value.value as unknown[]).filter(isChoice) : isChoice(value.value) ? [value.value] : [];
    const list = value.type === "choice" || value.type === "multiChoice";
    const catalog = list && chosen.some(option => option.catalogId);
    const options = chosen.map(option => ({ id: option.choiceId, label: option.label }));
    return {
      fieldId: value.fieldId, type: value.type as FormEntryQuestion["type"], label: value.label || "Pregunta", help: null, required: false, maxLength: null,
      options: list && !catalog ? options.length ? options : [placeholderOption] : null,
      selection: value.type === "multiChoice" ? { minSelected: 0, maxSelected: 20 } : null,
      files: value.type === "photo" || value.type === "document" ? { minFiles: 0, maxFiles: 10, photoSource: null } : null,
      catalog: catalog ? { onlyOption: null, issue: null, missingData: null } : null,
      ...value.type === "group" ? { rows: { minRows: 0, maxRows: 20 } } : {},
      ...repeated ? { repeated: true as const } : {},
    };
  };
  const answer = (value: DetailAnswer): EntryAnswer | null => {
    const chosen = Array.isArray(value.value) ? (value.value as unknown[]).filter(isChoice) : isChoice(value.value) ? [value.value] : [];
    const catalog = chosen.some(option => option.catalogId);
    const texts = catalog ? chosen.map(option => ({ id: option.choiceId, title: option.label, description: option.detail ?? null })) : null;
    if (value.type === "multiChoice") return { fieldId: value.fieldId, value: null, choiceIds: chosen.map(option => option.choiceId), options: texts };
    if (value.type === "choice") return chosen.length ? { fieldId: value.fieldId, value: chosen[0].choiceId, choiceIds: null, options: texts } : null;
    if (typeof value.value === "boolean") return { fieldId: value.fieldId, value: value.value ? "true" : "false", choiceIds: null, options: null };
    return typeof value.value === "string" ? { fieldId: value.fieldId, value: value.value, choiceIds: null, options: null } : null;
  };
  const questions: FormEntryQuestion[] = [], answers: FormResponseEntry["answers"] = [], files: FormResponseEntry["files"] = [];
  for (const value of values) {
    questions.push(question(value));
    if (value.type === "group") {
      const items = (Array.isArray(value.value) ? value.value : []) as { values: DetailAnswer[] }[];
      for (const inner of items[0]?.values ?? []) questions.push(question(inner, true));
      answers.push({ fieldId: value.fieldId, value: null, choiceIds: null, options: null,
        rows: items.map(item => item.values.map(answer).filter((inner): inner is EntryAnswer => inner !== null)) });
      continue;
    }
    if (Array.isArray(value.value)) for (const file of (value.value as unknown[]).filter(isFile))
      files.push({ fileId: file.fileId, fieldId: value.fieldId, name: file.name, contentType: file.contentType, size: file.size, hasThumbnail: file.hasThumbnail ?? false });
    const loaded = answer(value);
    if (loaded) answers.push(loaded);
  }
  return { entry: { definitionId: "0199a0c0-0000-7000-8000-000000000010", versionId, versionNumber, prefix: "TEST", name: "Formulario publicado",
    culture: "es", submitLabel: "Enviar", maxFileSizeMiB: 10, questions }, answers, files };
}
type SheetCell = ResponseSheet["records"]["items"][number]["cells"][number];
/** A cell of the sheet as the detail brings it: a block turns its items of cells into items with the questions its version had. */
export function detailValue(cell: SheetCell, columns: ResponseSheet["columns"]): DetailValue {
  if (cell.type !== "group" || !Array.isArray(cell.value)) return cell.value as DetailValue;
  const questions = columns.find(column => column.fieldId === cell.fieldId)?.questions ?? [];
  return (cell.value as { cells: { fieldId: string; type: "shortText" | "longText" | "decimal" | "date" | "boolean" | "choice"; state: string; value: unknown }[] }[])
    .map(item => ({ values: item.cells.filter(itemCell => itemCell.state !== "NotAsked").map(itemCell => ({
      fieldId: itemCell.fieldId, key: "field_" + itemCell.fieldId.replaceAll("-", ""), type: itemCell.type,
      label: questions.find(question => question.fieldId === itemCell.fieldId)?.label ?? "",
      value: itemCell.state === "Answered" ? itemCell.value : null })) })) as DetailValue;
}
export const responseFormId = "0199a0c0-0000-7000-8000-000000000010";
export const responseRecordId = "0199a0c0-0000-7000-8000-000000000011";
export const responseSecondId = "0199a0c0-0000-7000-8000-000000000012";
const version = "0199a0c0-0000-7000-8000-000000000013";
const id = (index: number) =>
  `0199a0c0-0000-7000-8000-${String(index).padStart(12, "0")}`;
const actor = { userId: id(20), displayName: "Ana" };
// Synthetic behavior data. HTTP contract qualification uses untouched backend exports separately.
export function responseSheetFixture(): ResponseSheet {
  const columns: ResponseSheet["columns"] = [
    {
      fieldId: id(30),
      type: "decimal",
      label: "Importe",
      introducedInVersion: 1,
      options: [],
    },
    {
      fieldId: id(31),
      type: "longText",
      label: "Observaciones",
      introducedInVersion: 1,
      options: [],
    },
    {
      fieldId: id(32),
      type: "boolean",
      label: "Confirmado",
      introducedInVersion: 1,
      options: [],
    },
    {
      fieldId: id(33),
      type: "shortText",
      label: "Detalle opcional",
      introducedInVersion: 2,
      options: [],
    },
    {
      fieldId: id(34),
      type: "choice",
      label: "Modalidad",
      introducedInVersion: 1,
      options: [{ id: id(40), label: "Opción histórica" }],
    },
  ];
  const rows = [responseRecordId, responseSecondId].map((recordId, index) => ({
    id: recordId,
    versionId: index === 0 ? version : id(14),
    versionNumber: index === 0 ? 2 : 1,
    number: `TEST-00000${2 - index}`,
    submittedAtUtc: "2026-10-16T12:00:00Z",
    actor,
    channel: "phone",
    state: "Received" as const,
    hasPdf: false,
    cells: columns.map((column) => ({
      fieldId: column.fieldId,
      type: column.type,
      state:
        column.fieldId === id(33)
          ? index === 0
            ? ("Unanswered" as const)
            : ("NotAsked" as const)
          : ("Answered" as const),
      value:
        column.type === "decimal"
          ? "0"
          : column.type === "boolean"
            ? false
            : column.type === "longText"
              ? "Texto completo para revisar"
              : column.type === "choice"
                ? {
                    choiceId: id(40),
                    label: "Opción histórica",
                  }
                : null,
    })),
  }));
  return {
    definitionId: responseFormId,
    name: "Formulario publicado",
    prefix: "TEST",
    activeVersionNumber: 2,
    hasApproval: false,
    columns,
    versions: [
      { id: id(14), number: 1 },
      { id: version, number: 2 },
    ],
    records: {
      items: rows,
      page: 1,
      pageSize: 20,
      totalCount: 2,
      totalPages: 1,
      hasPrevious: false,
      hasNext: false,
    },
  };
}
export function responseDetailFixture(
  recordId = responseRecordId,
): ResponseDetail {
  const sheet = responseSheetFixture();
  const row = sheet.records.items.find((row) => row.id === recordId)!;
  return {
    id: recordId,
    definitionId: responseFormId,
    versionId: row.versionId,
    versionNumber: row.versionNumber,
    number: row.number,
    name: sheet.name,
    submittedAtUtc: row.submittedAtUtc,
    actor,
    channel: "phone",
    origin: {
      sourceReceiptId: recordId === responseRecordId ? id(60) : id(62),
      channelId: "phone",
      senderKind: "Manual",
      senderUserId: actor.userId,
      senderName: actor.displayName,
      sentAtUtc: "2026-10-16T11:59:00Z",
      conversationId: id(61),
      maskedAddress: "+54 •••• 0069",
    },
    assistance: null,
    chain: [],
    values: row.cells
      .filter((cell) => cell.state !== "NotAsked")
      .map((cell) => ({
        fieldId: cell.fieldId,
        key: "field_" + cell.fieldId.replaceAll("-", ""),
        type: cell.type,
        label: sheet.columns.find((column) => column.fieldId === cell.fieldId)!
          .label,
        value: detailValue(cell, sheet.columns),
      })),
    history: [
      { kind: "Sent", atUtc: "2026-10-16T11:59:00Z", actor },
      { kind: "Submitted", atUtc: row.submittedAtUtc, actor },
      { kind: "Saved", atUtc: row.submittedAtUtc, actor: null },
    ],
    entry: responseEntryFixture(row.cells.filter(cell => cell.state !== "NotAsked").map(cell => ({ fieldId: cell.fieldId, type: cell.type,
      label: sheet.columns.find(column => column.fieldId === cell.fieldId)!.label, value: detailValue(cell, sheet.columns) })), row.versionId, row.versionNumber),
  };
}

export function responseWorkflowFixture(recordId = responseRecordId): import("@/features/business-forms/api/workflow").ResponseWorkflow {
  return { recordId, recordState: "Received", ruleRevision: null, task: null, actions: [], documents: [] };
}
