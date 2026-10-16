import { expect, it } from "vitest";
import { responseSheetSchema } from "./responses";
import { responseSheetFixture } from "@/test/responseFixtures";
it("requires each row to belong to its declared version and field columns", () => {
  const sheet = responseSheetFixture();
  expect(responseSheetSchema.safeParse(sheet).success).toBe(true);
  const changed = structuredClone(sheet);
  changed.records.items[0].versionNumber = 999;
  expect(responseSheetSchema.safeParse(changed).success).toBe(false);
  const foreign = structuredClone(sheet);
  foreign.records.items[0].cells[0].fieldId =
    "0199a0c0-0000-7000-8000-000000000999";
  expect(responseSheetSchema.safeParse(foreign).success).toBe(false);
});
