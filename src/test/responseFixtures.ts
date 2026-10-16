import type {
  ResponseSheet,
  ResponseDetail,
} from "@/features/business-forms/api/responses";
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
                    catalogId: null,
                    catalogName: null,
                    detail: null,
                  }
                : null,
    })),
  }));
  return {
    definitionId: responseFormId,
    name: "Formulario publicado",
    prefix: "TEST",
    activeVersionNumber: 2,
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
      senderUserId: actor.userId,
      senderName: actor.displayName,
      sentAtUtc: "2026-10-16T11:59:00Z",
      conversationId: id(61),
      maskedAddress: "+54 •••• 0069",
    },
    values: row.cells
      .filter((cell) => cell.state !== "NotAsked")
      .map((cell) => ({
        fieldId: cell.fieldId,
        key: "field_" + cell.fieldId.replaceAll("-", ""),
        type: cell.type,
        label: sheet.columns.find((column) => column.fieldId === cell.fieldId)!
          .label,
        value: cell.value,
      })),
    history: [
      { kind: "Sent", atUtc: "2026-10-16T11:59:00Z", actor },
      { kind: "Submitted", atUtc: row.submittedAtUtc, actor },
      { kind: "Saved", atUtc: row.submittedAtUtc, actor: null },
    ],
  };
}
