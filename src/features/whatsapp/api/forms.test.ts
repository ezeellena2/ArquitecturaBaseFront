import { whatsappFormsHttpJson } from '@/test/fixtures/whatsappFormsHttp';
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
const option = { definitionId, versionId, versionNumber: 1, prefix: "VIS", name: { es: "Visita", en: "Visit" },
  questionCount: 2, submitLabel: { es: "Confirmar", en: "Confirm" } };
const forms = { page: { items: [option], page: 1, pageSize: 4, totalCount: 1, totalPages: 1, hasPrevious: false, hasNext: false }, recipientCulture: "en", recipientContextRevision: "context" };
const receipt = { quickReplies: null, assistant: null, id: "019abcde-1000-7000-8000-000000000004", requestId: request.requestId, operatorUserId: "actor",
  body: request.message, requestedAtUtc: "2026-10-10T12:00:00Z", state: "Pending", waMessageId: null, kind: "Flow", origin: "Conversation",
  form: { definitionId, versionId, versionNumber: 1, name: option.name, culture: "en" },
  recoveryPath: "/api/whatsapp/chats/" + contactId + "/outgoing/" + request.requestId };
afterEach(resetHttpClient);
describe("Chat forms DTO contract", () => {
  it.each(["Pending", "Accepted"] as const)("accepts the declared Conversation origin on a %s manual receipt", state => {
    const actual = { ...receipt, state, origin: "Conversation" };
    expect(parseFormOutgoing(actual, request, "actor", contactId)).toEqual(actual);
  });
  it.each([undefined, null, "Manual", "FormAction", "Assistant"])("rejects a missing or non-manual receipt origin %#", origin => {
    expect(() => parseFormOutgoing({ ...receipt, origin }, request, "actor", contactId)).toThrow("Unsupported chat form response.");
  });
  it("preserves the complete sealed text maps and recipient language", () => {
    expect(parseChatForms(forms)).toEqual(forms);
  });
  it("accepts the required sealed prefix from the final selection DTO without dropping it", () => {
    const finalDto = { ...forms, page: { ...forms.page, items: [{ ...option, prefix: "PRB1010" }] } };
    expect(parseChatForms(finalDto)).toEqual(finalDto);
  });
  it.each(["es", "en"] as const)("accepts the unchanged current producer HTTP selector in %s", culture => {
    const captured = whatsappFormsHttpJson(culture, "choices");
    expect(parseChatForms(captured)).toEqual(captured);
  });
  it.each([undefined, null, 12, "", "prb", "1PRB", "PRB-1", "ABCDEFGHIJKLM", "PRB\n"])("rejects a missing or invalid required prefix %#", invalid => {
    expect(() => parseChatForms({ ...forms, page: { ...forms.page, items: [{ ...option, prefix: invalid }] } })).toThrow("Unsupported chat form response.");
  });
  it("rejects unknown option fields while accepting the declared prefix", () => {
    expect(() => parseChatForms({ ...forms, page: { ...forms.page, items: [{ ...option, unknownField: "private-value" }] } })).toThrow("Unsupported chat form response.");
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
    expect(await sendFormMessage(contactId, frozen, "actor")).toMatchObject({ state: "Pending", origin: "Conversation" });
    expect(await recoverFormMessage(contactId, frozen, "actor")).toMatchObject({ origin: "Conversation", form: { name: option.name } });
    expect(calls).toEqual(["POST", "GET"]);
    expect(frozen.message).toBe("  Complete this form  ");
  });
  it("requires the Api-generated owned recovery path on acceptance", async () => {
    server.use(http.post("/api/whatsapp/chats/" + contactId + "/form-messages", () => HttpResponse.json({...receipt,recoveryPath:null}, {status:202})));
    await expect(sendFormMessage(contactId, request, "actor")).rejects.toThrow("Unsupported chat form response.");
  });
  it("rejects unknown transport metadata without exposing it", () => {
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

it("accepts the server resolved default opening without sending the preview as authority", () => {
 expect(parseFormOutgoing(receipt, {...request,message:null}, "actor", contactId)).toEqual(receipt);
 expect(()=>parseFormOutgoing({...receipt,body:null}, {...request,message:null}, "actor", contactId)).toThrow();
 expect(()=>parseFormOutgoing({...receipt,body:" "}, {...request,message:null}, "actor", contactId)).toThrow();
});

for (const original of ["es", "en"] as const) for (const secondaryText of [undefined, ""]) {
  const secondary = original === "es" ? "en" : "es";
  const name = { [original]: original === "es" ? "Visita" : "Visit", ...(secondaryText === undefined ? {} : { [secondary]: secondaryText }) };
  const submitLabel = { [original]: original === "es" ? "Confirmar" : "Confirm", ...(secondaryText === undefined ? {} : { [secondary]: secondaryText }) };
  const scenario = original + " original with " + (secondaryText === undefined ? "absent" : "empty") + " secondary";
  it("accepts a selector for the other recipient culture with " + scenario, () => {
    const actual = { ...forms, recipientCulture: secondary, page: { ...forms.page, items: [{ ...option, name, submitLabel }] } };
    expect(parseChatForms(actual)).toEqual(actual);
  });
  it("preserves a receipt and historical metadata with " + scenario, () => {
    const actual = { ...receipt, form: { ...receipt.form, name, culture: original } };
    expect(parseFormOutgoing(actual, request, "actor", contactId)).toEqual(actual);
    expect(readFormMetadata(actual.form)).toEqual(actual.form);
  });
}
it.each([{}, { es: "", en: " " }, { es: "Visita", fr: "Visite" }])("rejects a selector without a supported nonblank name %#", name => {
  expect(() => parseChatForms({ ...forms, page: { ...forms.page, items: [{ ...option, name }] } })).toThrow("Unsupported chat form response.");
});
it.each([{}, { es: "", en: " " }, { es: "Confirmar", fr: "Confirmer" }])("rejects a selector without a supported nonblank submit label %#", submitLabel => {
  expect(() => parseChatForms({ ...forms, page: { ...forms.page, items: [{ ...option, submitLabel }] } })).toThrow("Unsupported chat form response.");
});
it.each([undefined, "", " "])("rejects an absent or blank effective receipt name %# instead of falling back", effective => {
  const name = { es: "Visita", ...(effective === undefined ? {} : { en: effective }) };
  const actual = { ...receipt, form: { ...receipt.form, name, culture: "en" } };
  expect(() => parseFormOutgoing(actual, request, "actor", contactId)).toThrow("Unsupported chat form response.");
  expect(readFormMetadata(actual.form)).toBeNull();
});
it("rejects unsupported historical metadata keys and cultures", () => {
  expect(readFormMetadata({ ...receipt.form, name: { es: "Visita", en: "Visit", fr: "Visite" } })).toBeNull();
  expect(readFormMetadata({ ...receipt.form, culture: "fr" })).toBeNull();
  expect(readFormMetadata({ ...receipt.form, unknown: "private" })).toBeNull();
});
