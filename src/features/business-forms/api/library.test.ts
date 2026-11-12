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

// DOC1: a standard that reads documents says which data it reads, each with the key that `standard.bound` of a copy uses, and its
// fixed validations; the library lists the standards of the next stages, without a draft, as «Próximamente». Synthetic bodies: the
// backend omits the three keys when there is nothing.
const receipt: FormStandard = { key: "forms.transfer-receipt", version: 1, name: "Comprobante de transferencia", description: "Lee el comprobante de una transferencia y lo carga.",
  prefix: "REC", copies: 0, culture: "es", suggestedPrefix: "REC",
  reads: [{ key: "sourceBank", name: "Banco o billetera de origen" }, { key: "sourceAccount", name: "Cuenta de origen" }, { key: "amount", name: "Monto" }, { key: "date", name: "Fecha" }],
  validations: [{ name: "Cuenta de origen", kind: "bankAccount" }, { name: "CUIT o CUIL de origen", kind: "taxId" }] };
const upcoming = [{ key: "forms.credit-note", name: "Nota de crédito o débito", description: "Lee una nota de crédito o de débito." }];

it("reads what a standard reads, its fixed validations and the standards still to come (DOC1)", () => {
  expect(readFormLibrary({ standards: [standard, receipt], upcoming })).toEqual({ standards: [standard, receipt], upcoming });
  expect(readFormLibrary({ standards: [standard], upcoming: [] }).upcoming).toEqual([]);
});

it("keeps reading today's library, which brings none of them", () => {
  const today = readFormLibrary({ standards: [standard] });
  expect(today).not.toHaveProperty("upcoming");
  expect(today.standards[0]).not.toHaveProperty("reads");
  expect(today.standards[0]).not.toHaveProperty("validations");
});

it.each([
  ["an unknown validation kind", { standards: [{ ...receipt, validations: [{ name: "Cuenta de origen", kind: "cbu" }] }] }],
  ["a standard that reads nothing", { standards: [{ ...receipt, reads: [] }] }],
  // Each datum comes with its key: the old list of names does not say which question receives it.
  ["the data it reads as bare names", { standards: [{ ...receipt, reads: ["Banco o billetera de origen", "Cuenta de origen"] }] }],
  ["a datum without its key", { standards: [{ ...receipt, reads: [{ name: "Monto" }] }] }],
  ["a datum read twice", { standards: [{ ...receipt, reads: [{ key: "amount", name: "Monto" }, { key: "amount", name: "Importe" }] }] }],
  ["a datum key over 64 characters", { standards: [{ ...receipt, reads: [{ key: "k".repeat(65), name: "Monto" }] }] }],
  ["a datum with an unknown member", { standards: [{ ...receipt, reads: [{ key: "amount", name: "Monto", type: "decimal" }] }] }],
  ["a standard with an empty list of validations", { standards: [{ ...receipt, validations: [] }] }],
  ["an upcoming standard without key", { standards: [standard], upcoming: [{ name: "Recibo", description: "Lee un recibo." }] }],
  ["an upcoming standard with an unknown member", { standards: [standard], upcoming: [{ ...upcoming[0], prefix: "NC" }] }],
])("rejects a library with %s rather than hiding it", (_case, body) => {
  expect(() => readFormLibrary(body)).toThrow("Invalid form library contract.");
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
