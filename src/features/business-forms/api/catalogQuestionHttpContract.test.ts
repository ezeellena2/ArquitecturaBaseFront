import { httpCohort } from "@/test/httpCohort";
import { expect, it } from "vitest";
import { openDraftSession } from "../draftSession";
import { readFormCommit, readFormDetail, readFormPublicationCheck, readFormRecovery } from "./response";
import { readCatalogPage, readCatalogSave } from "./catalogResponse";

// Unchanged HTTP examples delivered by the backend export script.
const cohort=httpCohort("catalogSource");
const body=(name:string):unknown=>cohort.json(name+".json");
const names = ["active-catalog-created", "active-catalog-list-usage", "catalog-choice-check-invalid", "catalog-choice-check-valid", "catalog-choice-create-receipt", "catalog-choice-created", "catalog-choice-detail", "catalog-choice-invalid-created", "catalog-choice-reloaded", "catalog-choice-update-receipt", "catalog-choice-updated"];
const scope = { actorId: "contract-reader", editorId: "contract-editor" };

it("verifies all eleven exact K6 captures from the common run", () => {
 const provenance=cohort.verify();
 expect(provenance.sources.some(source=>source.path.endsWith("FormPublicationCheckTests.cs"))).toBe(true);
 expect(provenance.captures.map(entry=>entry.name).sort()).toEqual(names.map(name=>name+".json").sort());
});

it("keeps source-only choices and canonical identities across actual create and update receipts", () => {
  const created = readFormCommit(body("catalog-choice-created"));
  const updated = readFormCommit(body("catalog-choice-updated"));
  const createReceipt = readFormRecovery(body("catalog-choice-create-receipt"));
  const updateReceipt = readFormRecovery(body("catalog-choice-update-receipt"));
  expect(createReceipt.result).toEqual(created);
  expect(updateReceipt.result).toEqual(updated);
  expect(created.definition.draft.fields).toHaveLength(2);
  expect(updated.definition.revision).toBe(created.definition.revision + 1);
  expect(updated.definition.draft.fields.map(field => field.fieldId)).toEqual(created.definition.draft.fields.map(field => field.fieldId));
  for (const result of [created, updated]) {
    expect(result.identityMap.choices).toEqual([]);
    for (const field of result.definition.draft.fields) {
      expect(field.type).toBe("choice"); expect(field.source?.catalog).toBeTruthy();
      expect(field).not.toHaveProperty("options");
    }
  }
});

it("reopens actual detail and reloaded drafts with the retained source reference", () => {
  const created = readFormCommit(body("catalog-choice-created"));
  const updated = readFormCommit(body("catalog-choice-updated"));
  expect(readFormDetail(body("catalog-choice-detail")).definition).toEqual(created.definition);
  const reloaded = readFormDetail(body("catalog-choice-reloaded"));
  expect(reloaded.definition).toEqual(updated.definition);
  const session = openDraftSession(scope, reloaded.definition);
  expect(session.value.draft.fields.map(field => field.source)).toEqual(updated.definition.draft.fields.map(field => field.source));
  expect(session.value.draft.fields.every(field => field.type === "choice" && field.options == null)).toBe(true);
});

it("consumes actual locally validated catalog checks without inventing a publication ticket", () => {
  const definition = readFormCommit(body("catalog-choice-updated")).definition;
  const fields = openDraftSession(scope, definition).value.draft.fields;
  const check = readFormPublicationCheck(body("catalog-choice-check-valid"), definition.id, definition.revision, fields);
  expect(check.compatibility).toBe("LocallyValidated"); expect(check.issues).toEqual([]);
  expect(check.canAccept).toBe(false); expect(check.checkToken).toBeNull();
});

it("consumes the actual blocked catalog issue tied to its source and field identity", () => {
  const definition = readFormCommit(body("catalog-choice-invalid-created")).definition;
  const fields = openDraftSession(scope, definition).value.draft.fields;
  const check = readFormPublicationCheck(body("catalog-choice-check-invalid"), definition.id, definition.revision, fields);
  expect(check.compatibility).toBe("Blocked"); expect(check.canAccept).toBe(false); expect(check.checkToken).toBeNull();
  expect(check.issues).toContainEqual(expect.objectContaining({ path: "draft.fields[0].source.catalog", fieldId: definition.draft.fields[0]!.fieldId, choiceId: null }));
});

it("consumes sorted actual catalog usages and finds the referenced catalog by identity", () => {
  const raw = body("active-catalog-created") as { itemIdentityMap: Record<string, string> };
  const catalog = readCatalogSave(raw, Object.keys(raw.itemIdentityMap)).catalog;
  const definition = readFormCommit(body("catalog-choice-created")).definition;
  expect(definition.draft.fields.every(field => field.source?.catalog === catalog.id)).toBe(true);
  const page = readCatalogPage(body("active-catalog-list-usage"));
  expect(page.items.map(item => item.usageCount)).toEqual([0, 1]);
  expect(page.items.find(item => item.id === catalog.id)).toMatchObject({ usageCount: 1, state: "Active" });
});
