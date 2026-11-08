import { expect, it } from "vitest";
import { z } from "zod";
import { httpCohort } from "@/test/httpCohort";
import { openDraftSession } from "../draftSession";
import type { DraftQuestion } from "../model";
import { readFormCommit, readFormPublicationCheck } from "./response";

// RG1-A, RG3-A and RG6-A over the joint export: the draft saved with a block (FormGroupDraftHttpTests) and the two checks of
// FormGroupPublicationHttpTests, the empty block with its warning and the published question that moves into the block. The
// exporter provides each check, not its draft: only the questions a check names are supplied, as that test saved them.
const uuid = z.string().uuid();

it("qualifies the three bodies of the block and the tests that produce them", () => {
  const forms = httpCohort("forms").verify();
  expect(forms.captures.map(item => item.name)).toEqual(expect.arrayContaining(["rows/draft.json", "rows/publication-check.json", "rows/publication-check-moved.json"]));
  for (const producer of ["/FormGroupDraftHttpTests.cs", "/FormGroupPublicationHttpTests.cs"])
    expect(forms.sources.some(item => item.path.endsWith(producer))).toBe(true);
});

it("opens the saved block, with the questions of each item right after it and their identities", () => {
  const raw = httpCohort("forms").json("rows/draft.json");
  const result = readFormCommit(raw);
  const fields = result.definition.draft.fields;
  expect(fields.map(field => field.type)).toEqual(["shortText", "group", "decimal", "longText"]);
  expect(fields[1]).toMatchObject({ type: "group", required: true, label: { es: "Artículos", en: "Items" }, rows: { minRows: 1, maxRows: 20 } });
  expect(fields.map(field => "repeated" in field && field.repeated === true)).toEqual([false, false, true, true]);
  expect(result.identityMap.fields.map(field => field.localId)).toEqual(["first", "articulos", "cantidad", "observaciones"]);
  const opened = openDraftSession({ actorId: "contract-reader", editorId: "contract-reader" }, result.definition);
  expect(opened.value.draft.fields[1]).toMatchObject({ type: "group", rows: { minRows: 1, maxRows: 20 } });
  // A block without its counts, or a question of an item before the block, is not read.
  const withoutRows = structuredClone(raw) as { definition: { draft: { fields: Array<Record<string, unknown>> } } };
  delete withoutRows.definition.draft.fields[1]!.rows;
  expect(() => readFormCommit(withoutRows)).toThrow();
  const outside = structuredClone(raw) as { definition: { draft: { fields: Array<Record<string, unknown>> } } };
  outside.definition.draft.fields[0]!.repeated = true;
  expect(() => readFormCommit(outside)).toThrow();
});

it("reads the check that stops an empty block and warns about the items WhatsApp does not load", () => {
  const raw = httpCohort("forms").json("rows/publication-check.json");
  const identity = z.object({ definitionId: uuid, draftRevision: z.number(), issues: z.array(z.object({ fieldId: uuid })).length(1),
    diff: z.object({ added: z.array(uuid) }) }).parse(raw);
  const block = identity.issues[0]!.fieldId;
  const name = identity.diff.added.find(id => id !== block)!;
  const fields: DraftQuestion[] = [
    { localId: "first", fieldId: name, replacesFieldId: null, type: "shortText", label: { es: "Nombre", en: "Name" }, help: { es: "Tu nombre", en: "Your name" }, required: false, maxLength: 80 },
    { localId: "articulos", fieldId: block, replacesFieldId: null, type: "group", label: { es: "Artículos", en: "Items" }, help: null, required: true, rows: { minRows: 1, maxRows: 20 } },
  ];

  const check = readFormPublicationCheck(raw, identity.definitionId, identity.draftRevision, fields);

  expect(check.canAccept).toBe(false);
  expect(check.issues).toEqual([expect.objectContaining({ code: "Forms.Publication.GroupEmpty", fieldId: block, path: "draft.fields[1]" })]);
  expect(check.warnings).toEqual([expect.objectContaining({ code: "Forms.Publication.RowsOverChannelLimit", fieldId: block, limit: 10, maximum: 20 })]);
  expect(check.diff.movedToRows).toBeUndefined();
  // The problem and the warning point at the block: without it in the draft, the check is not read.
  expect(() => readFormPublicationCheck(raw, identity.definitionId, identity.draftRevision, fields.slice(0, 1))).toThrow();
});

it("reads the check that names the published question moving into the block", () => {
  const raw = httpCohort("forms").json("rows/publication-check-moved.json");
  const identity = z.object({ definitionId: uuid, draftRevision: z.number(),
    diff: z.object({ added: z.array(uuid).length(1), movedToRows: z.array(uuid).length(1) }) }).parse(raw);
  const [block] = identity.diff.added as [string];
  const [quantity] = identity.diff.movedToRows as [string];
  const fields: DraftQuestion[] = [
    { localId: "articulos", fieldId: block, replacesFieldId: null, type: "group", label: { es: "Artículos", en: "Items" }, help: null, required: true, rows: { minRows: 1, maxRows: 10 } },
    { localId: "cantidad-fila", fieldId: quantity, replacesFieldId: null, type: "decimal", label: { es: "Cantidad", en: "Quantity" }, help: null, required: false, repeated: true },
  ];

  const check = readFormPublicationCheck(raw, identity.definitionId, identity.draftRevision, fields);

  // With its publication open the check brings no ticket; what is published still says which questions move into the block.
  expect(check).toMatchObject({ canAccept: false, acceptanceAvailability: "InProgress", checkToken: null, issues: [], warnings: [] });
  expect(check.diff.baseVersionId).not.toBeNull();
  expect(check.diff).toMatchObject({ added: [block], removed: [], movedToRows: [quantity] });
  // «Pasan al bloque» only names questions of the block: the same question outside it is not read.
  const outside = fields.map(field => field.fieldId === quantity ? { ...field, repeated: undefined } : field) as DraftQuestion[];
  expect(() => readFormPublicationCheck(raw, identity.definitionId, identity.draftRevision, outside)).toThrow();
});
