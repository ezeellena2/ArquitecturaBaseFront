import { expect, it } from "vitest";
import { z } from "zod";
import { httpCohort } from "@/test/httpCohort";
import type { DraftQuestion } from "../model";
import { readFormPublicationCheck } from "./response";

// RG13-A: the check of FormGroupPublicationHttpTests that stops a minimum of items WhatsApp does not load, exported with the
// rest of the forms cohort. The exporter provides the check, not its draft: only the block it points at is supplied.
it("reads the check that stops a minimum of items over what WhatsApp loads, with its limit", () => {
  const forms = httpCohort("forms");
  expect(forms.verify().sources.some(source => source.path.endsWith("/FormGroupPublicationHttpTests.cs"))).toBe(true);
  const raw = forms.json("rows/publication-check-minimum.json");
  const identity = z.object({ definitionId: z.string().uuid(), draftRevision: z.number(),
    issues: z.array(z.object({ fieldId: z.string().uuid().nullable(), code: z.string() })) }).parse(raw);
  const blocks: DraftQuestion[] = [...new Set(identity.issues.flatMap(issue => issue.fieldId ? [issue.fieldId] : []))]
    .map(fieldId => ({ localId: fieldId, fieldId, replacesFieldId: null, type: "group", label: { es: "Artículos", en: "Items" }, help: null,
      required: true, rows: { minRows: 15, maxRows: 20 } }));

  const check = readFormPublicationCheck(raw, identity.definitionId, identity.draftRevision, blocks);

  expect(check.canAccept).toBe(false);
  expect(check.issues).toContainEqual(expect.objectContaining({ code: "Forms.Publication.MinRowsOverChannelLimit", limit: 10 }));
});
