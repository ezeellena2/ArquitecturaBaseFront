import { afterEach, expect, it, vi } from "vitest";
import { api } from "@/shared/api/httpClient";
import { fetchRecipientSamples, previewRecipient, readRecipientPreview, readRecipientSamples } from "./recipientPreview";

// Synthetic E2-3 DTOs; the final joint HTTP export qualifies the real producer separately.
const guid = (value: number) => "01990000-0000-7000-8000-" + String(value).padStart(12, "0");
const personId = guid(501), catalogId = guid(502), fieldId = guid(503), attributeId = guid(504), optionId = guid(505), definitionId = guid(506);
const body = { type: "choice" as const, source: { catalog: catalogId, match: [{ fieldId, personAttributeId: attributeId }], presentation: { title: ["text"], description: [] } }, sampleUserId: personId, culture: "es" as const };
const preview = { recipient: { id: personId, name: "Juan Gómez", values: [{ attributeId, name: "Zona", text: "Centro" }] }, state: "Ready", optionCount: 1, limit: 200, exceedsLimit: false, options: [{ id: optionId, title: "Proveedor", description: null }], presentationCheck: { titleTooLongCount: 0, examples: [] } };
const page = { items: [{ id: personId, name: "Juan Gómez" }], page: 1, pageSize: 20, totalCount: 1, totalPages: 1, hasPrevious: false, hasNext: false };
afterEach(() => vi.restoreAllMocks());
it("reads a closed sample page without accepting user internals or invalid identities", () => {
  expect(readRecipientSamples(page)).toEqual(page);
  for (const invalid of [{ ...page, items: [{ ...page.items[0], email: "PRIVATE" }] }, { ...page, items: [{ id: "invalid", name: "PRIVATE" }] }, { ...page, private: "PRIVATE" }]) expect(() => readRecipientSamples(invalid)).toThrow("Unsupported recipient preview response.");
});
it("reads the selected presentation and lets preview diagnostics describe titles longer than WhatsApp permits", () => {
  expect(readRecipientPreview(preview, body)).toEqual(preview);
  const long = "x".repeat(31);
  const warning = { ...preview, options: [{ id: optionId, title: long, description: "Visible detail" }], presentationCheck: { titleTooLongCount: 1, examples: [{ itemId: optionId, title: long }] } };
  expect(readRecipientPreview(warning, body)).toEqual(warning);
  const empty = { ...preview, options: [{ id: optionId, title: "", description: "d".repeat(301) }] };
  expect(readRecipientPreview(empty, body)).toEqual(empty);
});
it("keeps missing person data and unavailable filters as distinct closed states with no offered options", () => {
  for (const state of ["RecipientDataMissing", "FilterUnavailable"]) {
    const unavailable = { ...preview, state, optionCount: 0, options: [], recipient: { ...preview.recipient, values: [] } };
    expect(readRecipientPreview(unavailable, body)).toEqual(unavailable);
    expect(() => readRecipientPreview({ ...unavailable, options: preview.options }, body)).toThrow("Unsupported recipient preview response.");
  }
  expect(() => readRecipientPreview({ ...preview, state: "Unknown" }, body)).toThrow("Unsupported recipient preview response.");
});
it("rejects another recipient, a private unmatched attribute and inconsistent count or limit without retaining zod issues", () => {
  for (const invalid of [{ ...preview, recipient: { ...preview.recipient, id: guid(599) } }, { ...preview, recipient: { ...preview.recipient, values: [{ attributeId: guid(599), name: "PRIVATE", text: "PRIVATE" }] } }, { ...preview, limit: 20 }, { ...preview, optionCount: 2 }, { ...preview, exceedsLimit: true }, { ...preview, options: [{ ...preview.options[0], private: "PRIVATE" }] }]) {
    expect(() => readRecipientPreview(invalid, body)).toThrow("Unsupported recipient preview response.");
  }
  try { readRecipientPreview({ ...preview, private: "PRIVATE" }, body); } catch (error) { expect(JSON.stringify(error)).not.toContain("PRIVATE"); expect(error).not.toHaveProperty("issues"); }
});
it("accepts the shared 201-row sample while displaying only 20 multiChoice options", () => {
  const rows = Array.from({ length: 20 }, (_, index) => ({ id: guid(600 + index), title: "Opción " + index, description: null }));
  const exceeded = { ...preview, optionCount: 201, limit: 20, exceedsLimit: true, options: rows };
  expect(readRecipientPreview(exceeded, { ...body, type: "multiChoice" })).toEqual(exceeded);
  expect(() => readRecipientPreview({ ...exceeded, optionCount: 202 }, { ...body, type: "multiChoice" })).toThrow("Unsupported recipient preview response.");
});
it("uses the dedicated sample route and no-store cancellable preview without adding an actor or sending private search in a write", async () => {
  const signal = new AbortController().signal;
  const get = vi.spyOn(api, "get").mockResolvedValue(page);
  expect(await fetchRecipientSamples({ page: 1, pageSize: 20, search: "Juan Gómez" }, signal)).toEqual(page);
  expect(get).toHaveBeenCalledExactlyOnceWith("/api/forms/recipient-samples?page=1&pageSize=20&search=Juan+G%C3%B3mez", { signal, cache: "no-store" });
  const post = vi.spyOn(api, "post").mockResolvedValue(preview);
  expect(await previewRecipient(definitionId, body, signal)).toEqual(preview);
  expect(post).toHaveBeenCalledExactlyOnceWith("/api/forms/definitions/" + definitionId + "/recipient-previews", body, { signal, cache: "no-store" });
  await expect(previewRecipient("not-an-id", body)).rejects.toThrow("Unsupported recipient preview response.");
  expect(post).toHaveBeenCalledTimes(1);
});
