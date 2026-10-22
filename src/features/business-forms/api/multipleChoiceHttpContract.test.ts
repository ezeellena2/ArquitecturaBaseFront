import { createHash } from "node:crypto";
import { http } from "msw";
import { expect, it } from "vitest";
import { z } from "zod";
import { httpCohort } from "@/test/httpCohort";
import { server } from "@/test/mocks/server";
import { openDraftSession } from "../draftSession";
import type { DraftQuestion } from "../model";
import { responseValueText, selectedResponseChoices } from "../responses";
import { readFormCommit, readFormPublicationCheck } from "./response";
import { responseDetailSchema, responseFacetSchema, responseSheetSchema, fetchResponseDetail, fetchResponseSheet } from "./responses";
import { previewPdfDesign } from "./pdf";

// Real bytes arrive only in the final joint export. This test never manufactures captures.
it("qualifies all multiple-choice capture names and producer sources from the joint run", () => {
  const definitions = httpCohort("forms").verify();
  const responses = httpCohort("responses").verify();
  const pdf = httpCohort("pdf").verify();
  expect(definitions.captures).toHaveLength(48);
  expect(responses.captures).toHaveLength(45);
  expect(pdf.captures).toHaveLength(32);
  expect(definitions.captures.map(item => item.name)).toEqual(expect.arrayContaining([
    "multiple-choice/draft.json", "multiple-choice/catalog-too-large.json",
  ]));
  expect(definitions.sources.some(item => item.path.endsWith("/FormMultipleChoiceAuthoringHttpTests.cs"))).toBe(true);
  for (const culture of ["es", "en"]) {
    expect(responses.captures.map(item => item.name)).toEqual(expect.arrayContaining([
      "multi-sheet-" + culture + ".json", "multi-detail-" + culture + ".json",
      "multi-counts-" + culture + ".json", "multi-export-" + culture + ".xlsx",
    ]));
    expect(pdf.captures.map(item => item.name)).toEqual(expect.arrayContaining([
      "multi-preview-" + culture + ".pdf", "multi-preview-" + culture + ".http.json",
    ]));
  }
  for (const manifest of [responses, pdf])
    expect(manifest.sources.some(item => item.path.endsWith("/FormMultipleChoiceReadHttpTests.cs"))).toBe(true);
});

it("opens the saved multiple-choice range and identities from the actual commit", () => {
  const raw = httpCohort("forms").json("multiple-choice/draft.json");
  const result = readFormCommit(raw);
  const [question] = result.definition.draft.fields;
  expect(result.definition.draft.fields).toHaveLength(1);
  expect(question).toMatchObject({ type: "multiChoice", required: true, selection: { minSelected: 1, maxSelected: 3 } });
  if (question.type !== "multiChoice" || question.source) throw new Error("Expected authored multiple choices");
  expect(question.options).toHaveLength(3);
  expect(question.options.map(option => option.label)).toEqual([1, 2, 3].map(index => ({ es: "Riesgo " + index, en: "Risk " + index })));
  expect(result.identityMap.fields).toContainEqual(expect.objectContaining({ localId: "multiple", fieldId: question.fieldId }));
  expect(new Set(result.identityMap.choices.map(option => option.choiceId)).size).toBe(3);
  const opened = openDraftSession({ actorId: "contract-reader", editorId: "contract-reader" }, result.definition);
  expect(opened.value.draft.fields[0]).toHaveProperty("selection", { minSelected: 1, maxSelected: 3 });
  const missingRange = structuredClone(raw) as { definition: { draft: { fields: Array<{ selection?: unknown }> } } };
  delete missingRange.definition.draft.fields[0].selection;
  expect(() => readFormCommit(missingRange)).toThrow();
});

it("reads the actual publication block for a catalog exceeding twenty multiple choices", () => {
  const raw = httpCohort("forms").json("multiple-choice/catalog-too-large.json");
  const identity = z.object({ definitionId: z.string().uuid(), draftRevision: z.number(),
    issues: z.array(z.object({ fieldId: z.string().uuid().nullable(), code: z.string() })),
  }).parse(raw);
  // The exporter provides the check, not its request. Only the observed parent identity is
  // supplied as the caller's diagnostic context; no request or response is fabricated.
  const fields: DraftQuestion[] = [...new Set(identity.issues.flatMap(issue => issue.fieldId ? [issue.fieldId] : []))]
    .map(fieldId => ({ localId: fieldId, fieldId, replacesFieldId: null, type: "multiChoice",
      label: { es: "Sectores", en: "Areas" }, help: null, required: true,
      selection: { minSelected: 1, maxSelected: 3 }, source: { catalog: null } }));
  const check = readFormPublicationCheck(raw, identity.definitionId, identity.draftRevision, fields);
  expect(check.canAccept).toBe(false);
  expect(check.issues).toContainEqual(expect.objectContaining({
    code: "Forms.Publication.CatalogTooLargeForMultiple", path: "draft.fields[0].source.catalog",
  }));
});

it.each(["es", "en"] as const)("preserves real ordered historical choices and explicit empty values in %s", async culture => {
  const cohort = httpCohort("responses");
  const sheet = responseSheetSchema.parse(cohort.json("multi-sheet-" + culture + ".json"));
  const detail = responseDetailSchema.parse(cohort.json("multi-detail-" + culture + ".json"));
  const counts = responseFacetSchema.parse(cohort.json("multi-counts-" + culture + ".json"));
  const multiple = sheet.columns.filter(column => column.type === "multiChoice");
  expect(multiple).toHaveLength(2);
  expect(sheet.records.totalCount).toBe(4);
  const [own, catalog] = multiple;
  const cells = sheet.records.items.map(row => row.cells.find(cell => cell.fieldId === own.fieldId)!);
  const labels = culture === "en" ? ["Noise", "Cold"] : ["Ruido", "Frío"];
  expect(selectedResponseChoices(cells[0]).map(option => option.label)).toEqual(labels);
  expect(responseValueText(cells[0], "unanswered", "yes", "no")).toBe(labels.join(", "));
  expect(cells[2]).toMatchObject({ state: "Unanswered", value: [] });
  expect(cells[3]).toMatchObject({ state: "Unanswered", value: null });
  const historical = detail.values.find(value => value.fieldId === catalog.fieldId)!;
  expect(selectedResponseChoices({ ...historical, state: "Answered" }).map(option => option.label))
    .toEqual(culture === "en" ? ["Historical noise", "Historical cold"] : ["Ruido histórico", "Frío histórico"]);
  expect(counts.items.map(item => item.count).sort()).toEqual([1, 2]);
  expect(cohort.bytes("multi-export-" + culture + ".xlsx").subarray(0, 2).toString()).toBe("PK");
  server.use(
    http.post("/api/forms/definitions/" + sheet.definitionId + "/records/search", () => cohort.response("multi-sheet-" + culture + ".json")),
    http.get("/api/forms/records/" + detail.id, () => cohort.response("multi-detail-" + culture + ".json")),
  );
  const signal = new AbortController().signal;
  expect(await fetchResponseSheet(sheet.definitionId, { page: 1, pageSize: 20, sort: "number" }, signal)).toEqual(sheet);
  expect(await fetchResponseDetail(detail.id, signal)).toEqual(detail);
});

it.each(["es", "en"] as const)("uses actual multi-choice PDF headers and intact bytes in %s", async culture => {
  const sheet = responseSheetSchema.parse(httpCohort("responses").json("multi-sheet-" + culture + ".json"));
  const cohort = httpCohort("pdf");
  const name = "multi-preview-" + culture;
  const field = sheet.columns.find(column => column.type === "multiChoice")!;
  expect(field).toBeDefined();
  const design = { name: { es: "Constancia", en: "Receipt" }, questionIds: [field.fieldId],
    includeApproval: false, footer: null, includePhotos: true };
  server.use(http.post("/api/forms/definitions/" + sheet.definitionId + "/pdf-design/preview",
    () => cohort.capturedResponse(name + ".pdf", name + ".http.json")));
  const file = await previewPdfDesign(sheet.definitionId, design, culture);
  expect(file.contentLanguage).toBe(culture);
  expect(file.blob.type).toBe("application/pdf");
  expect(cohort.bytes(name + ".pdf").subarray(0, 5).toString()).toBe("%PDF-");
  expect(createHash("sha256").update(new Uint8Array(await file.blob.arrayBuffer())).digest("hex"))
    .toBe(createHash("sha256").update(cohort.bytes(name + ".pdf")).digest("hex"));
});
