import { afterEach, describe, expect, it } from "vitest";
import { http, HttpResponse } from "msw";
import { server } from "@/test/mocks/server";
import { resetHttpClient } from "@/shared/api/httpClient";
import { parseChatForms, parseFormOutgoing, readFormMetadata, sendFormMessage, recoverFormMessage } from "./forms";
const contactId = "019abcde-1000-7000-8000-000000000010";
const definitionId = "019abcde-1000-7000-8000-000000000001";
const versionId = "019abcde-1000-7000-8000-000000000002";
const request = { requestId: "019abcde-1000-7000-8000-000000000003", definitionId, versionId,
  expectedModeRevision: 7, expectedRecipientContextRevision: "context", message: "Complete this form" };
const option = { definitionId, versionId, versionNumber: 1, name: { es: "Visita", en: "Visit" },
  questionCount: 2, submitLabel: { es: "Confirmar", en: "Confirm" } };
const forms = { page: { items: [option], page: 1, pageSize: 4, totalCount: 1, totalPages: 1, hasPrevious: false, hasNext: false }, recipientCulture: "en", recipientContextRevision: "context" };
const receipt = { id: "019abcde-1000-7000-8000-000000000004", requestId: request.requestId, operatorUserId: "actor",
  body: request.message, requestedAtUtc: "2026-10-10T12:00:00Z", state: "Pending", waMessageId: null, kind: "Flow",
  form: { definitionId, versionId, versionNumber: 1, name: option.name, culture: "en" },
  recoveryPath: "/api/whatsapp/chats/" + contactId + "/outgoing/" + request.requestId };
afterEach(resetHttpClient);
describe("Chat forms DTO contract", () => {
  it("preserves the complete sealed text maps and recipient language", () => {
    expect(parseChatForms(forms)).toEqual(forms);
  });
  it("accepts an empty selector when recipient eligibility disappeared", () => {
    const unavailable = { ...forms, page: { ...forms.page, items: [], totalCount: 0, totalPages: 0 }, recipientCulture: null, recipientContextRevision: null };
    expect(parseChatForms(unavailable)).toEqual(unavailable);
  });
  it("accepts the Api recovery path and a recovered receipt with no supplied path", () => {
    expect(parseFormOutgoing(receipt, request, "actor", contactId)).toEqual(receipt);
    expect(parseFormOutgoing({ ...receipt, recoveryPath: null }, request, "actor", contactId).form?.name).toEqual(option.name);
    expect(readFormMetadata(receipt.form)).toEqual(receipt.form);
  });
  it("accepts the server-trimmed message without rewriting the frozen request", () => {
    const padded = Object.freeze({ ...request, message: "  Complete this form  " });
    expect(parseFormOutgoing(receipt, padded, "actor", contactId).body).toBe("Complete this form");
    expect(padded.message).toBe("  Complete this form  ");
  });
  it.each(["https://foreign.example/private", "/api/whatsapp/chats/other/outgoing/" + request.requestId])("rejects an unowned recovery path without exposing it", recoveryPath => {
    expect(() => parseFormOutgoing({ ...receipt, recoveryPath }, request, "actor", contactId)).toThrow("Unsupported chat form response.");
  });
  it("posts the exact frozen body and recovers only through its owned route without Location", async () => {
    const frozen = Object.freeze({ ...request, message: "  Complete this form  " });
    const calls: string[] = [];
    server.use(http.post("/api/whatsapp/chats/" + contactId + "/form-messages", async ({request: httpRequest}) => {
      expect(await httpRequest.json()).toEqual(frozen);
      calls.push("POST");
      return HttpResponse.json(receipt, {status:202});
    }), http.get("/api/whatsapp/chats/" + contactId + "/outgoing/" + request.requestId, () => {
      calls.push("GET");
      return HttpResponse.json({...receipt, recoveryPath:null});
    }));
    expect((await sendFormMessage(contactId, frozen, "actor")).state).toBe("Pending");
    expect((await recoverFormMessage(contactId, frozen, "actor")).form?.name).toEqual(option.name);
    expect(calls).toEqual(["POST", "GET"]);
    expect(frozen.message).toBe("  Complete this form  ");
  });
  it("requires the Api-generated owned recovery path on acceptance", async () => {
    server.use(http.post("/api/whatsapp/chats/" + contactId + "/form-messages", () => HttpResponse.json({...receipt,recoveryPath:null}, {status:202})));
    await expect(sendFormMessage(contactId, request, "actor")).rejects.toThrow("Unsupported chat form response.");
  });
  it("rejects fallback to another culture or unknown transport metadata", () => {
    expect(() => parseChatForms({ ...forms, page: { ...forms.page, items: [{ ...option, name: { es: "Visita" } }] } })).toThrow();
    expect(readFormMetadata({ ...receipt.form, name: { es: "Visita" } })).toBeNull();
    let error: unknown;
    try { parseChatForms({ ...forms, flowToken: "private-token" }); } catch (caught) { error = caught; }
    expect(String(error)).not.toContain("flowToken");
    expect(JSON.stringify(error)).not.toContain("private-token");
    expect(error).toBeInstanceOf(Error);
  });
  it("sanitizes malformed receipts before uncertain-send handling", () => {
    let error: unknown;
    try { parseFormOutgoing({ form: { name: "private-contact-content" } }, request, "actor", contactId); } catch (caught) { error = caught; }
    expect(JSON.stringify(error)).not.toContain("private-contact-content");
    expect(String(error)).toBe("UnsupportedChatFormResponse: Unsupported chat form response.");
  });
});
