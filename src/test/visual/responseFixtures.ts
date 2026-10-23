import {
  responseSheetFixture,
  responseDetailFixture,
  responseWorkflowFixture,
  responseFormId,
} from "../responseFixtures";
import type {
  ResponseDetail,
  ResponseSheet,
} from "@/features/business-forms/api/responses";
import type { ResponseQuery } from "@/features/business-forms/responses";
const id = (n: number) =>
  `0199a0c0-0000-7000-8000-${String(n).padStart(12, "0")}`;
export function createResponseVisualFixtures(
  language: "es" | "en",
  scenario: string,
) {
  const en = language === "en";
  const sheet = responseSheetFixture();
  if (scenario === "responses-pdf") sheet.records.items[0].hasPdf = true;
  if(scenario === "responses-approval"){sheet.hasApproval=true;for(const row of sheet.records.items)row.state="PendingApproval";}
  sheet.name = scenario === "responses-assisted" ? en ? "Invoice" : "Factura" : en ? "Delivery report" : "Informe de entregas";
  const labels = en
    ? ["Amount", "Notes", "Confirmed", "Optional detail", "Method"]
    : [
        "Importe",
        "Observaciones",
        "Confirmado",
        "Detalle opcional",
        "Modalidad",
      ];
  sheet.columns.forEach((column, index) => {
    column.label = labels[index];
  });
  const photos = [
    {
      fileId: id(70),
      name: "entrega.jpg",
      contentType: "image/jpeg",
      size: 88229,
      hasThumbnail: true,
    },
    {
      fileId: id(71),
      name: "detalle.jpg",
      contentType: "image/jpeg",
      size: 45231,
      hasThumbnail: true,
    },
  ];
  const document = [
    {
      fileId: id(72),
      name: "comprobante.pdf",
      contentType: "application/pdf",
      size: 41412,
      hasThumbnail: false,
    },
  ];
  const photoColumn = {
    fieldId: id(35),
    type: "photo" as const,
    label: en ? "Delivery photos" : "Fotos de la entrega",
    introducedInVersion: 1,
    options: [],
  };
  const documentColumn = {
    fieldId: id(36),
    type: "document" as const,
    label: en ? "Receipt" : "Comprobante",
    introducedInVersion: 1,
    options: [],
  };
  sheet.columns.push(photoColumn, documentColumn);
  sheet.records.items.forEach((row) =>
    row.cells.push(
      {
        fieldId: photoColumn.fieldId,
        type: "photo",
        state: "Answered",
        value: photos,
      },
      {
        fieldId: documentColumn.fieldId,
        type: "document",
        state: "Answered",
        value: document,
      },
    ),
  );
  if (scenario === "responses-type-change") {
    sheet.columns[0].introducedInVersion = 2;
    sheet.columns.push({
      fieldId: id(37),
      type: "shortText",
      label: sheet.columns[0].label,
      introducedInVersion: 1,
      options: [],
    });
    for (const row of sheet.records.items) {
      if (row.versionNumber === 1) {
        row.cells[0].state = "NotAsked";
        row.cells[0].value = null;
      }
      row.cells.push({
        fieldId: id(37),
        type: "shortText",
        state: row.versionNumber === 1 ? "Answered" : "NotAsked",
        value:
          row.versionNumber === 1
            ? en
              ? "Earlier text"
              : "Texto anterior"
            : null,
      });
    }
  }
  const page = <T>(
    items: T[],
    number = 1,
    size = 20,
    total = items.length,
  ) => ({
    items,
    page: number,
    pageSize: size,
    totalCount: total,
    totalPages: Math.ceil(total / size),
    hasPrevious: number > 1,
    hasNext: number * size < total,
  });
  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { "Content-Type": "application/json" },
    });
  const filterRows = (
    filter: ResponseQuery,
    ignoreField?: string,
    ignoreDimension?: string,
  ) =>
    sheet.records.items.filter(
      (row) =>
        (!filter.search ||
          row.cells.some(
            (cell) =>
              cell.type === "longText" &&
              typeof cell.value === "string" &&
              cell.value.toLowerCase().includes(filter.search!.toLowerCase()),
          )) &&
        (ignoreDimension === "version" ||
          !filter.versionIds?.length ||
          filter.versionIds.includes(row.versionId)) &&
        (ignoreDimension === "actor" ||
          !filter.actorIds?.length ||
          filter.actorIds.includes(row.actor.userId)) &&
        (!filter.receivedFromUtc ||
          row.submittedAtUtc >= filter.receivedFromUtc) &&
        (!filter.receivedToUtc || row.submittedAtUtc < filter.receivedToUtc) &&
        (filter.conditions ?? []).every((condition) => {
          if (condition.fieldId === ignoreField) return true;
          const values = condition.values ?? [];
          const cell = row.cells.find(
            (value) => value.fieldId === condition.fieldId,
          )!;
          if (
            ["answered", "unanswered", "notAsked"].includes(condition.operator)
          )
            return (
              cell.state.toLowerCase() === condition.operator.toLowerCase()
            );
          const value =
            cell.value &&
            typeof cell.value === "object" &&
            !Array.isArray(cell.value)
              ? cell.value.choiceId
              : String(cell.value ?? "");
          if (condition.operator === "in") return values.includes(value);
          if (condition.operator === "contains")
            return value.includes(values[0]);
          if (condition.operator === "gte")
            return Number(value) >= Number(values[0]);
          if (condition.operator === "lte")
            return Number(value) <= Number(values[0]);
          return value === values[0];
        }),
    );
  let failOnce = scenario === "responses-error";
  let actionState: "Uncertain" | "Failed" | "Completed" = "Uncertain";
  const workflow = (recordId: string) => ({ ...responseWorkflowFixture(recordId), ...(scenario === "responses-workflow" ? { recordState: "Approved", ruleRevision: 3, actions: [{ id: id(90), ruleId: id(91), kind: "NotifyAuthor", event: "Approved", order: 1, revision: 0, state: actionState, reasonCode: actionState === "Completed" ? null : "Test.Delivery", reason: actionState === "Completed" ? null : en ? "Delivery needs review." : "Revisá la entrega.", canConsult: actionState === "Uncertain", canRetry: actionState === "Failed", recipients: [{ user: { userId: id(92), displayName: "Juan Gómez" }, channelId: "WhatsApp", state: actionState === "Completed" ? "Accepted" : actionState, reasonCode: null, reason: null, canReview: actionState === "Uncertain", review: null, deliveredAtUtc: null, readAtUtc: null }], createdAtUtc: "2026-10-16T12:00:00Z", updatedAtUtc: "2026-10-16T12:00:00Z", completedAtUtc: actionState === "Completed" ? "2026-10-16T12:01:00Z" : null }] } : {}) });
  const exports: unknown[] = [];
  if (scenario === "responses-catalog-fields") {
    sheet.name = en ? "Request a spare part" : "Pedir repuesto";
    const column = sheet.columns[4];
    column.label = en ? "Suppliers to contact" : "Proveedores a consultar";
    column.type = "multiChoice";
    column.fields = [
      { fieldId: id(301), key: "cuit", label: "CUIT", type: "text", role: "data" },
      { fieldId: id(302), key: "zone", label: en ? "Zone" : "Zona", type: "catalog", role: "filter" },
      { fieldId: id(303), key: "payment_days", label: en ? "Payment terms" : "Plazo de pago", type: "integer", role: "data" },
    ];
    const row = sheet.records.items[0];
    row.cells[4] = {
      fieldId: column.fieldId, type: "multiChoice", state: "Answered", value: [
        { choiceId: id(40), label: "Frío Norte SRL", catalogId: id(310), catalogName: en ? "Suppliers" : "Proveedores", detail: null,
          fields: [
            { fieldId: id(301), label: "CUIT", type: "text", role: "data", value: "30-71234567-8" },
            { fieldId: id(302), label: en ? "Zone" : "Zona", type: "catalog", role: "filter", value: id(320), text: en ? "Center" : "Centro" },
            { fieldId: id(303), label: en ? "Payment terms" : "Plazo de pago", type: "integer", role: "data", value: "30" },
          ] },
        { choiceId: id(41), label: "Repuestos Sur", catalogId: id(310), catalogName: en ? "Suppliers" : "Proveedores", detail: null,
          fields: [
            { fieldId: id(301), label: "CUIT", type: "text", role: "data", value: "30-65432109-7" },
            { fieldId: id(302), label: en ? "Zone" : "Zona", type: "catalog", role: "filter", value: id(320), text: en ? "Center" : "Centro" },
            { fieldId: id(303), label: en ? "Previous terms" : "Plazo anterior", type: "text", role: "data", value: en ? "Cash" : "Contado" },
          ] },
      ],
    };
    sheet.records.items[1].cells[4] = { fieldId: column.fieldId, type: "multiChoice", state: "Answered", value: [
      { choiceId: id(42), label: en ? "Previous supplier" : "Proveedor anterior", catalogId: id(310), catalogName: en ? "Suppliers" : "Proveedores", detail: null },
    ] };
  }
  return {
    exports,
    async handle(request: Request): Promise<Response> {
      const url = new URL(request.url);
      const path = url.pathname;
      if (scenario === "responses-loading") {
        await new Promise((resolve) => setTimeout(resolve, 60_000));
      }
      if (scenario === "responses-revoked")
        return json({ code: "Authorization.Forbidden" }, 403);
      if (path.includes("/filter-counts/")) {
        const body = (await request.json()) as {
          dimension: string;
          fieldId?: string;
          filter: ResponseQuery;
          search?: string;
          page?: number;
          pageSize?: number;
        };
        const rows = filterRows(
          body.filter ?? {},
          body.fieldId,
          body.dimension,
        );
        const options =
          body.dimension === "actor"
            ? [
                {
                  id: sheet.records.items[0].actor.userId,
                  label: "Ana",
                  count: rows.length,
                },
              ]
            : body.dimension === "version"
              ? sheet.versions.map((version) => ({
                  id: version.id,
                  label: String(version.number),
                  count: rows.filter((row) => row.versionId === version.id)
                    .length,
                }))
              : body.dimension === "presence"
                ? ["answered", "unanswered", "notAsked"].map((state) => ({
                    id: state,
                    label: state,
                    count: rows.filter(
                      (row) =>
                        row.cells
                          .find((cell) => cell.fieldId === body.fieldId)
                          ?.state.toLowerCase() === state.toLowerCase(),
                    ).length,
                  }))
                : body.fieldId === sheet.columns[2].fieldId
                  ? [true, false].map((value) => ({
                      id: String(value),
                      label: String(value),
                      count: rows.filter((row) => row.cells[2].value === value)
                        .length,
                    }))
                  : sheet.columns[4].options.map((option) => ({
                      ...option,
                      count: rows.length,
                    }));
        return json(
          page(
            options.filter(
              (option) =>
                !body.search ||
                option.label.toLowerCase().includes(body.search.toLowerCase()),
            ),
          ),
        );
      }
      if (path.includes("/definitions/")) {
        if (path.endsWith("/export")) {
          if (scenario === "responses-catalog-fields") {
            exports.push(await request.json());
            return new Response(new Uint8Array([80, 75, 3, 4]), { headers: { "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "Content-Disposition": "attachment; filename=E2.xlsx" } });
          }
          return json({ code: "Forms.Record.ExportTooLarge" }, 400);
        }
        if (failOnce) {
          failOnce = false;
          return json({ code: "Unexpected", traceId: "visual-response" }, 500);
        }
        const filter =
          request.method === "POST"
            ? ((await request.json()) as ResponseQuery)
            : (Object.fromEntries(
                url.searchParams,
              ) as unknown as ResponseQuery);
        const rows = scenario === "responses-empty" ? [] : filterRows(filter);
        if (path.endsWith("/navigation")) {
          const recordId = path.split("/").at(-2)!;
          const index = rows.findIndex(row => row.id === recordId);
          return index < 0 ? json({ code: "Forms.Record.NotFound" }, 404) : json({ recordId,
            previousId: rows[index - 1]?.id ?? null, nextId: rows[index + 1]?.id ?? null,
            position: index + 1, totalCount: rows.length });
        }
        const result: ResponseSheet = {
          ...sheet,
          records: page(
            rows,
            Number(filter.page ?? 1),
            Number(filter.pageSize ?? 20),
            scenario === "responses-limit" ? 10001 : rows.length,
          ),
        };
        return json(result);
      }
      if (scenario === "responses-workflow" && request.method === "POST" && /\/actions\/[^/]+\/(consult|retry)$/.test(path)) {
        actionState = path.endsWith("/consult") ? "Failed" : "Completed";
        return json(workflow(path.split("/").at(-4)!));
      }
      if (/\/records\/[^/]+\/workflow$/.test(path)) {
        if (scenario === "responses-missing") return json({ code: "Forms.Record.NotFound" }, 404);
        return json(workflow(path.split("/").at(-2)!));
      }
      if (path.includes("/records/")) {
        if (scenario === "responses-missing")
          return json({ code: "Forms.Record.NotFound" }, 404);
        const recordId = path.split("/").at(-1)!;
        const base = responseDetailFixture(recordId);
        const row = sheet.records.items.find((row) => row.id === recordId)!;
        const detail: ResponseDetail = {
          ...base,
          name: sheet.name,
          values: row.cells
            .filter((cell) => cell.state !== "NotAsked")
            .map((cell) => ({
              fieldId: cell.fieldId,
              key: "field_" + cell.fieldId.replaceAll("-", ""),
              type: cell.type,
              label: sheet.columns.find(
                (column) => column.fieldId === cell.fieldId,
              )!.label,
              value: cell.value,
            })),
        };
        if (scenario === "responses-assisted") {
          // Explicit synthetic confirmed records; not an offer, model output or backend HTTP export.
          const sourceName = en ? "Delivery" : "Entrega";
          const mapped = detail.values.find(value => value.type === "longText")!;
          mapped.value = en ? "ENT-000014 (corrected)" : "ENT-000014 (corregido)";
          detail.assistance = {
            senderKind: "Manual", operator: { userId: id(20), displayName: "Ana Operadora" },
            reason: en ? "Continue the confirmed delivery with its invoice." : "Continuar la entrega confirmada con su factura.",
            suggestion: { originRecordId: id(150), suggestionId: id(152), mode: "Always" },
            values: [{ proposed: { fieldId: mapped.fieldId, key: mapped.key, type: "longText", label: mapped.label, value: "ENT-000014" },
              included: true, changed: true, mapped: true }],
          };
          detail.chain = [
            { id: id(150), definitionId: id(151), number: "ENT-000014", name: sourceName,
              submittedAtUtc: "2026-10-16T11:00:00Z", originRecordId: null },
            { id: recordId, definitionId: responseFormId, number: detail.number, name: detail.name,
              submittedAtUtc: detail.submittedAtUtc, originRecordId: id(150) },
          ];
        }
        return json(detail);
      }
      return json({ code: "NotFound" }, 404);
    },
  };
}
