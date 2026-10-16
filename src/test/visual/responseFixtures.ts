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
  sheet.name = en ? "Delivery report" : "Informe de entregas";
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
  return {
    async handle(request: Request): Promise<Response> {
      const url = new URL(request.url);
      const path = url.pathname;
      if (scenario === "responses-loading") {
        await new Promise((resolve) => setTimeout(resolve, 60_000));
      }
      if (path === "/api/forms/navigation") {
        const forms = Array.from(
          { length: scenario === "responses-many" ? 26 : 1 },
          (_, index) => ({
            id: index ? id(100 + index) : responseFormId,
            name: index
              ? `${en ? "Form" : "Formulario"} ${index + 1}`
              : sheet.name,
            prefix: "TEST",
            versionNumber: 2,
          }),
        );
        const number = Number(url.searchParams.get("page") ?? 1),
          size = Number(url.searchParams.get("pageSize") ?? 20);
        const searched = forms.filter(
          (form) =>
            !url.searchParams.get("search") ||
            form.name
              .toLowerCase()
              .includes(url.searchParams.get("search")!.toLowerCase()),
        );
        return json(
          page(
            searched.slice((number - 1) * size, number * size),
            number,
            size,
            searched.length,
          ),
        );
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
        if (path.endsWith("/export"))
          return json({ code: "Forms.Record.ExportTooLarge" }, 400);
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
      if (/\/records\/[^/]+\/workflow$/.test(path)) {
        if (scenario === "responses-missing") return json({ code: "Forms.Record.NotFound" }, 404);
        return json(responseWorkflowFixture(path.split("/").at(-2)!));
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
        return json(detail);
      }
      return json({ code: "NotFound" }, 404);
    },
  };
}
