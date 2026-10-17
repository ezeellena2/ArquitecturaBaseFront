import { createHash } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import { relative, resolve } from "node:path";
import { expect } from "vitest";
import { HttpResponse } from "msw";
import { z } from "zod";
const cohorts = {
  forms: ["forms-http","FORMS_HTTP_CONTRACT_INPUT","forms"],
  manualCatalogs: ["catalogs-http/manual-current","FORMS_CATALOG_HTTP_CONTRACT_INPUT","manual-catalogs"],
  catalogFilters: ["catalogs-http/filters","FORMS_CATALOG_FILTERS_HTTP_CONTRACT_INPUT","catalog-filters"],
  catalogSource: ["catalogs-http/k6-source","FORMS_CATALOG_SOURCE_HTTP_CONTRACT_INPUT","catalog-source"],
  formFiles: ["form-files-http","FORM_FILES_HTTP_INPUT","form-files"],
  whatsappCatalogs: ["whatsapp-catalogs-http","WHATSAPP_CATALOG_HTTP_CONTRACT_INPUT","whatsapp-catalogs"],
  responses: ["forms-responses-http", "FORMS_RESPONSES_HTTP_CONTRACT_INPUT", "responses"],
  rules: ["forms-rules-http", "FORMS_RULES_HTTP_CONTRACT_INPUT", "rules"],
  missingRequests: ["forms-missing-requests-http", "FORMS_MISSING_REQUEST_HTTP_CONTRACT_INPUT", "missing-requests"],
  suggestions: ["forms-suggestions-http", "FORMS_SUGGESTIONS_HTTP_CONTRACT_INPUT", "suggestions"],
  suggestionDetails: ["forms-suggestion-detail-http", "FORMS_SUGGESTION_DETAILS_HTTP_CONTRACT_INPUT", "suggestion-details"],
  catalogProposals: ["forms-catalog-proposals-http", "FORMS_CATALOG_PROPOSALS_HTTP_CONTRACT_INPUT", "catalog-proposals"],
  workflow: ["forms-workflow-http", "FORMS_WORKFLOW_HTTP_CONTRACT_INPUT", "workflow"],
  approvals: ["forms-approvals-http", "FORMS_APPROVALS_HTTP_CONTRACT_INPUT", "approvals"],
  pdf: ["forms-pdf-http", "FORMS_PDF_HTTP_CONTRACT_INPUT", "pdf"],
  whatsappAssistant: ["whatsapp-assistant-http", "WHATSAPP_ASSISTANT_HTTP_CONTRACT_INPUT", "whatsapp-assistant"],
  whatsappActions: ["whatsapp-form-actions-http", "WHATSAPP_FORM_ACTIONS_HTTP_CONTRACT_INPUT", "whatsapp-actions"],
  whatsappAudio: ["whatsapp-audio-http", "WHATSAPP_AUDIO_HTTP_CONTRACT_INPUT", "whatsapp-audio"],
  whatsappForms: ["whatsapp-forms-http", "WHATSAPP_FORMS_HTTP_CONTRACT_INPUT", "whatsapp-forms"],
} as const;
export type HttpCohort = keyof typeof cohorts;
const sha256 = z.string().regex(/^[0-9a-f]{64}$/);
const manifest = z.strictObject({
  schemaVersion: z.literal(1), artifactSet: z.string(), runId: z.string().min(1), generatedAtUtc: z.iso.datetime(),
  repositoryHead: z.string().regex(/^[0-9a-f]{40}$|^[0-9a-f]{64}$/), sourceState: z.array(z.string()), command: z.string(),
  producer: z.string(), sources: z.array(z.strictObject({ path: z.string(), sha256 })).min(1), transport: z.string(),
  captures: z.array(z.strictObject({ name: z.string(), length: z.number().int().nonnegative(), sha256 })).min(1),
});
const metadata = z.strictObject({ status: z.number().int().min(100).max(599), contentType: z.string().nullable(), contentLanguage: z.array(z.string()), contentDisposition: z.string().nullable() });
export function httpCohort(name: HttpCohort) {
  const [folder, environment, artifactSet] = cohorts[name];
  const directory = resolve(process.env[environment] ?? resolve("src/test/fixtures", folder));
  const bytes = (file: string) => readFileSync(resolve(directory, file));
  const json = (file: string): unknown => JSON.parse(bytes(file).toString("utf8"));
  const response = (file: string, status = 200, headers: Record<string, string> = { "content-type": "application/json" }) =>
    new HttpResponse(Uint8Array.from(bytes(file)).buffer, { status, headers });
  return {
    directory, bytes, json, response,
    capturedResponse(file: string, companion: string) {
      const captured = metadata.parse(json(companion)); const headers: Record<string, string> = {};
      if (captured.contentType !== null) headers["content-type"] = captured.contentType;
      if (captured.contentLanguage.length > 0) headers["content-language"] = captured.contentLanguage.join(", ");
      if (captured.contentDisposition !== null) headers["content-disposition"] = captured.contentDisposition;
      return response(file, captured.status, headers);
    },
    verify() {
      const source = manifest.parse(json("provenance.json"));
      expect(source.artifactSet).toBe(artifactSet);
      expect(new Set(source.captures.map(capture => capture.name)).size).toBe(source.captures.length);
      for (const capture of source.captures) {
        const content = bytes(capture.name);
        expect(content.length, capture.name).toBe(capture.length);
        expect(createHash("sha256").update(content).digest("hex"), capture.name).toBe(capture.sha256);
      }
      const files = readdirSync(directory, { recursive: true, withFileTypes: true }).filter(entry => entry.isFile())
        .map(entry => relative(directory, resolve(entry.parentPath, entry.name)).replaceAll("\\", "/"));
      expect(files.sort()).toEqual([...source.captures.map(capture => capture.name), "provenance.json"].sort());
      return source;
    },
  };
}
