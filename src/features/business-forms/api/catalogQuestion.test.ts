import { expect, it } from "vitest";
import { readFormDetail } from "./response";
import detail from "@/test/fixtures/forms-http/failed/detail-es.json";

it("reads source.catalog choice and rejects simultaneous authored options", () => {
  const fieldId = "01990000-0000-7000-8000-000000000091";
  const field = { fieldId, key: "field_" + fieldId.replaceAll("-", ""), type: "choice", label: { es: "Cliente", en: "Customer" }, help: null, required: true, maxLength: null, options: null, source: { catalog: "01990000-0000-7000-8000-000000000092" } };
  const response = { ...detail, definition: { ...detail.definition, draft: { ...detail.definition.draft, fields: [field] } } };
  expect(readFormDetail(response).definition.draft.fields[0]).toMatchObject({ type: "choice", source: field.source });
  expect(readFormDetail(response).definition.draft.fields[0]).not.toHaveProperty("options");
  expect(() => readFormDetail({ ...response, definition: { ...response.definition, draft: { ...response.definition.draft, fields: [{ ...field, options: [{ choiceId: fieldId, label: field.label }] }] } } })).toThrow("Unsupported form response.");
});
