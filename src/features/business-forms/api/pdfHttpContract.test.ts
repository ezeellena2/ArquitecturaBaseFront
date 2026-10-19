import { createHash } from "node:crypto";
import { expect, it } from "vitest";
import { http } from "msw";
import { httpCohort } from "@/test/httpCohort";
import { server } from "@/test/mocks/server";
import { readPdfDesign, fetchPdfDesign, savePdfDesign, previewPdfDesign, fetchResponseDocument } from "./pdf";
import { readResponseWorkflow } from "./workflow";
import { z } from "zod";
it("reads independent PDF revisions and original-only design maps from unchanged HTTP", () => {
  const cohort = httpCohort("pdf"); const source = cohort.verify(); expect(source.producer).toContain("FormPdfHttpTests");
  expect(readPdfDesign(cohort.json("default-es.json"))).toMatchObject({ id: null, revision: 0, design: { includePhotos: true } });
  const saved = readPdfDesign(cohort.json("saved-es.json")); expect(saved.revision).toBe(1); expect(saved.design.name).toEqual({ es: "Constancia original" });
  for (const culture of ["es", "en"]) expect(readPdfDesign(cohort.json("design-" + culture + ".json"))).toEqual(saved);
});
it("uses actual PDF response headers and bytes through preview and fixed-document adapters", async () => {
  const cohort = httpCohort("pdf"); const design = readPdfDesign(cohort.json("design-es.json")); const path = "/api/forms/definitions/" + design.definitionId + "/pdf-design";
  server.use(http.get(path, () => cohort.capturedResponse("design-es.json", "design-es.http.json")), http.post(path, () => cohort.capturedResponse("saved-es.json", "saved-es.http.json")),
    http.post(path + "/preview", () => cohort.capturedResponse("preview-en-fallback.pdf", "preview-en-fallback.http.json")));
  expect(await fetchPdfDesign(design.definitionId)).toEqual(design); expect(await savePdfDesign(design.definitionId, 0, design.design)).toEqual(design);
  const preview = await previewPdfDesign(design.definitionId, design.design, "en"); expect(preview.contentLanguage).toBe("es"); expect(preview.blob.type).toBe("application/pdf");
  const emittedBody = cohort.json("issued-es.json"); const recordId = z.object({ recordId: z.string().uuid() }).parse(emittedBody).recordId;
  const emitted = readResponseWorkflow(emittedBody, recordId); const document = emitted.documents[0];
  server.use(http.get("/api/forms/records/" + recordId + "/documents/" + document.id + "/content", () => cohort.capturedResponse("document-es.pdf", "document-es.http.json")));
  const downloaded = await fetchResponseDocument(recordId, document.id, true); expect(downloaded.contentLanguage).toBe("es"); expect(downloaded.blob.size).toBe(cohort.bytes("document-es.pdf").length);
  expect(downloaded.fileName).toBe(document.name);
  expect(createHash("sha256").update(new Uint8Array(await downloaded.blob.arrayBuffer())).digest("hex")).toBe(createHash("sha256").update(cohort.bytes("document-es.pdf")).digest("hex"));
  const otherRecord = crypto.randomUUID();
  server.use(http.get("/api/forms/records/" + otherRecord + "/documents/" + document.id + "/content", () => cohort.capturedResponse("document-mismatch-en.json", "document-mismatch-en.http.json")));
  await expect(fetchResponseDocument(otherRecord, document.id, true)).rejects.toMatchObject({ status: 404 });
});

// The bytes and HTTP metadata arrive in the joint export, never as fabricated defaults.
it("downloads the English fixed PDF when only a catalog item falls back to its original text", async () => {
  const cohort = httpCohort("pdf");
  const body = httpCohort("workflow").json("e2e-catalog-original-item-en.json");
  const recordId = z.object({ recordId: z.string().uuid() }).parse(body).recordId;
  const workflow = readResponseWorkflow(body, recordId);
  const document = workflow.documents.find(item => item.culture === "en")!;
  expect(document).toBeDefined();
  const sample = "e2e-catalog-original-item-en";
  server.use(http.get("/api/forms/records/" + recordId + "/documents/" + document.id + "/content", () => cohort.capturedResponse(sample + ".pdf", sample + ".http.json")));
  const downloaded = await fetchResponseDocument(recordId, document.id, true);
  expect(downloaded.contentLanguage).toBe("en");
  expect(downloaded.blob.type).toBe("application/pdf");
  expect(downloaded.fileName).toBe(document.name);
  expect(downloaded.blob.size).toBe(document.size);
  expect(downloaded.blob.size).toBe(cohort.bytes(sample + ".pdf").length);
  expect(createHash("sha256").update(new Uint8Array(await downloaded.blob.arrayBuffer())).digest("hex")).toBe(createHash("sha256").update(cohort.bytes(sample + ".pdf")).digest("hex"));
});
