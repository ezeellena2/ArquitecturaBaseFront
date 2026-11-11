import { http, HttpResponse } from "msw";
import { expect, it } from "vitest";
import { httpCohort } from "@/test/httpCohort";
import { server } from "@/test/mocks/server";
import { addFormStandard, fetchFormLibrary, readFormLibrary, type FormStandard } from "./library";

// BI1-A: the library lists the standards of the installed modules and «Agregar» creates an own draft under the standard's culture.
const standard: FormStandard = { key: "arca.invoice", version: 1, name: "Factura", description: "Factura C con sus ítems y el total.", prefix: "FAC", copies: 1, culture: "es", source: "ARCA", suggestedPrefix: "FAC2" };
// A real draft receipt captured by the backend export: «Agregar» answers with the same receipt as creating a draft.
const created = httpCohort("forms").json("published/created.json") as Record<string, unknown>;

it("reads the standards with their version, copies, culture and optional source", () => {
  expect(readFormLibrary({ standards: [standard] }).standards).toEqual([standard]);
  const { source: _source, ...withoutSource } = standard;
  expect(readFormLibrary({ standards: [withoutSource] }).standards[0]?.source).toBeUndefined();
});

it.each([["an unknown field", { ...standard, folder: "arca" }], ["a culture other than es or en", { ...standard, culture: "fr" }], ["a negative count", { ...standard, copies: -1 }]])(
  "rejects a standard with %s rather than hiding it", (_case, body) => {
    expect(() => readFormLibrary({ standards: [body] })).toThrow("Invalid form library contract.");
  });

it("reads the library without caching and adds a copy with the name under the standard's culture and the folder only when chosen", async () => {
  const bodies: unknown[] = []; let paths: string[] = []; let cache: RequestCache | undefined;
  server.use(
    http.get("/api/forms/library", ({ request }) => { cache = request.cache; return HttpResponse.json({ standards: [standard] }); }),
    http.post("/api/forms/library/:key/copies", async ({ request, params }) => {
      paths = [...paths, String(params.key)]; bodies.push(await request.json()); return HttpResponse.json(created, { status: 201 });
    }));

  expect((await fetchFormLibrary()).standards).toHaveLength(1);
  expect(cache).toBe("no-store");
  const requestId = "0196f2a0-0000-7000-8000-0000000000a1";
  const folderId = "0196f2a0-0000-7000-8000-0000000000f1";
  await addFormStandard({ ...standard, culture: "en" }, { requestId, name: "Invoices", prefix: "INV" });
  await addFormStandard(standard, { requestId, name: "Facturas", prefix: "FAC2", folderId });

  expect(paths).toEqual(["arca.invoice", "arca.invoice"]);
  expect(bodies).toEqual([
    { requestId, name: { en: "Invoices" }, prefix: "INV" },
    { requestId, name: { es: "Facturas" }, prefix: "FAC2", folderId },
  ]);
});
