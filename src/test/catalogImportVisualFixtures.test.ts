import { afterEach, expect, it, vi } from "vitest";
import { readCatalog } from "@/features/business-forms/api/catalogResponse";
import { readCatalogImportPreview } from "@/features/business-forms/api/catalogImports";
import { createCatalogFixtureStore, visualCatalogId } from "./visual/catalogFixtures";

afterEach(() => vi.restoreAllMocks());
it.each(["es", "en"] as const)("provides canonical decimal values and actionable diagnostics in the CA2 typed scene in %s", async culture => {
  const store = createCatalogFixtureStore(culture, "catalogs-import-typed");
  const origin = "http://visual.test/api/forms/catalogs/" + visualCatalogId;
  const catalog = readCatalog(await (await store.handle(new Request(origin))).json(), visualCatalogId);
  expect(catalog.valueType).toBe("Decimal");
  const form = new FormData();
  form.append("file", new File(["Code,Text,Value\nN,Norte,1500.5"], "Zonas.csv", { type: "text/csv" }));
  form.append("mode", "Append"); form.append("expectedRevision", "1");
  const request = new Request(origin + "/import-previews", { method: "POST" });
  vi.spyOn(request, "formData").mockResolvedValue(form);
  const preview = readCatalogImportPreview(await (await store.handle(request)).json(), visualCatalogId, 1, "Append");
  expect(preview.added[0]).toMatchObject({ code: "N", value: "1500.5" });
  expect(preview.changed[0]!.changes).toContainEqual({ column: "value", before: "1000", after: "1500.5" });
  expect(preview.issues).toContainEqual(expect.objectContaining({ severity: "Error", relatedRow: 2 }));
  expect(preview.issues).toContainEqual(expect.objectContaining({ severity: "Warning", column: culture === "es" ? "Responsable" : "Supervisor" }));
  expect(store).toHaveProperty("writes", []);
});
