import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";
import { server } from "@/test/mocks/server";
import { fetchAssistantAgent, fetchAssistantAgentTest, fetchAssistantTestRecipients, saveAssistantAgent, startAssistantAgentTest, type AssistantAgent, type AssistantAgentSaveRequest } from "./assistantAgent";

const form = "0199a0c0-0000-7000-8000-0000000000f1";
const agent: AssistantAgent = {
  revision: 3, originalCulture: "es",
  profile: { name: "Asistente", introduction: "Hola", tone: "Breve", does: "Responde", doesNot: "No da precios", handoffMessage: { es: "Te paso con una persona.", en: null } },
  cases: [
    { id: "0199a0c0-0000-7000-8000-000000000001", when: "Pide hablar con una persona.", inputType: "Any", isActive: true,
      action: { kind: "Handoff", formDefinitionId: null, text: null, instructions: null, question: null, buttons: null, handoffReason: "Pide hablar con una persona." } },
    { id: "0199a0c0-0000-7000-8000-000000000002", when: "Dice que pasó por un cliente.", inputType: "Text", isActive: false,
      action: { kind: "AskButtons", formDefinitionId: null, text: null, instructions: null, question: { es: "¿Visita o entrega?", en: "Visit or delivery?" }, handoffReason: null,
        buttons: [{ title: { es: "Visita", en: null }, destination: "SendForm", formDefinitionId: form, text: null }, { title: { es: "Otra", en: null }, destination: "ExactText", formDefinitionId: null, text: { es: "Gracias.", en: null } }] } },
  ],
  fallback: { kind: "NoReply", formDefinitionId: null, text: null, instructions: null, question: null, buttons: null, handoffReason: null },
  limits: { blockedTopics: ["Precios"], cannotPromise: "Plazos", maxReplyLength: 400, dailyReplyLimit: 10, dailyOfferLimit: 2, allowedActions: ["SendForm", "ExactText", "AskButtons", "Handoff", "NoReply"],
    maxSpreadsheetLoads: 3, maxDocumentPages: 10, declinedReofferDays: null },
  forms: [{ definitionId: form, name: "Registrar visita", offerWhen: "Cuando terminó una visita." }],
  knowledge: { availability: "Available", revision: 2, unansweredQuestions: 1,
    sections: [{ key: "Details", state: "Loaded", facts: [{ id: "details.name", label: "Nombre", text: "Tu negocio" }] }, { key: "Location", state: "LegacyUnreviewed", facts: [] }, { key: "Answers", state: "Empty", facts: [] }] },
  assistantAvailability: { state: "available" },
};
const save: AssistantAgentSaveRequest = { expectedRevision: 3, originalCulture: "es", profile: agent.profile, cases: agent.cases, fallback: agent.fallback, limits: agent.limits };

describe("the assistant agent contract", () => {
  it("reads the agent with its forms, its knowledge and the availability of the assistant", async () => {
    server.use(http.get("/api/whatsapp/assistant-agent", () => HttpResponse.json(agent)));
    expect(await fetchAssistantAgent()).toStrictEqual(agent);
  });

  it.each([
    ["an unknown key", { ...agent, prompt: "PRIVATE" }],
    ["an unknown key of a case", { ...agent, cases: [{ ...agent.cases[0], priority: 1 }] }],
    ["an unknown action", { ...agent, fallback: { ...agent.fallback, kind: "Translate" } }],
    ["an unknown input type", { ...agent, cases: [{ ...agent.cases[0], inputType: "Photo" }] }],
    ["a text with a third language", { ...agent, profile: { ...agent.profile, handoffMessage: { es: "Hola", en: null, pt: "Olá" } } }],
    ["an action without one of its fields", { ...agent, fallback: { kind: "NoReply" } }],
    ["an unknown knowledge state", { ...agent, knowledge: { ...agent.knowledge, sections: [{ key: "Details", state: "Draft", facts: [] }] } }],
    ["an unknown availability", { ...agent, assistantAvailability: { state: "ready" } }],
    ["a case without a valid id", { ...agent, cases: [{ ...agent.cases[0], id: "case-1" }] }],
  ])("rejects %s without keeping the payload", async (_name, body) => {
    server.use(http.get("/api/whatsapp/assistant-agent", () => HttpResponse.json(body)));
    const error = await fetchAssistantAgent().catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(Error);
    expect((error as Error).message).toBe("Unsupported assistant agent response.");
    expect(JSON.stringify(error)).not.toContain("PRIVATE");
  });

  it("puts the four tabs with the revision read and returns the agent as saved", async () => {
    let sent: unknown;
    server.use(http.put("/api/whatsapp/assistant-agent", async ({ request }) => { sent = await request.json(); return HttpResponse.json({ ...agent, revision: 4 }); }));
    expect((await saveAssistantAgent(save)).revision).toBe(4);
    expect(sent).toStrictEqual(save);
  });

  it("rejects a saved agent that does not follow the contract", async () => {
    server.use(http.put("/api/whatsapp/assistant-agent", () => HttpResponse.json({ revision: 4 })));
    await expect(saveAssistantAgent(save)).rejects.toThrow("Unsupported assistant agent response.");
  });

  it("starts a test with its own id and reads its result for that account", async () => {
    const requestId = "0199a0c0-0000-7000-8000-0000000000a1", contactId = "0199a0c0-0000-7000-8000-0000000000c1";
    let started: unknown, asked: string | null = null;
    server.use(http.post("/api/whatsapp/assistant-agent/tests", async ({ request }) => { started = await request.json(); return new HttpResponse(null, { status: 202 }); }),
      http.get("/api/whatsapp/assistant-agent/tests/:id", ({ request, params }) => {
        asked = new URL(request.url).searchParams.get("contactId");
        return HttpResponse.json({ requestId: params.id, state: "completed", failureCode: null, actions: [{ kind: "SendForm", caseSource: "Form", caseTitle: "Registrar visita", reason: "Encaja.",
          used: ["El mensaje."], text: null, buttons: null, form: { name: "Registrar visita", fields: [{ label: "Sucursal", value: "Centro" }, { label: "Qué pasó", value: null }] }, handoffReasonCode: null, handoffReason: null }] });
      }));
    await startAssistantAgentTest({ requestId, contactId, messages: ["Hola", "Se rompió la heladera"] });
    expect(started).toStrictEqual({ requestId, contactId, messages: ["Hola", "Se rompió la heladera"] });
    const result = await fetchAssistantAgentTest(requestId, contactId);
    expect(asked).toBe(contactId);
    // A question it would leave empty comes without a value.
    expect(result.actions[0].form?.fields).toEqual([{ label: "Sucursal", value: "Centro" }, { label: "Qué pasó", value: null }]);
  });

  const asked = "0199a0c0-0000-7000-8000-0000000000a1";
  const noReply = { kind: "NoReply", caseSource: "Fallback", caseTitle: null, reason: "", used: [], text: null, buttons: null, form: null, handoffReasonCode: null, handoffReason: null };
  it.each([
    ["another test", { requestId: "0199a0c0-0000-7000-8000-0000000000a9", state: "pending", failureCode: null, actions: [] }],
    ["an unknown state", { requestId: asked, state: "running", failureCode: null, actions: [] }],
    ["more than three actions", { requestId: asked, state: "completed", failureCode: null, actions: [noReply, noReply, noReply, noReply] }],
    ["an action with an unknown key", { requestId: asked, state: "completed", failureCode: null, actions: [{ ...noReply, prompt: "PRIVATE" }] }],
  ])("rejects the result of %s", async (_name, body) => {
    server.use(http.get("/api/whatsapp/assistant-agent/tests/:id", () => HttpResponse.json(body)));
    await expect(fetchAssistantAgentTest(asked, "0199a0c0-0000-7000-8000-0000000000c1")).rejects.toThrow("Unsupported assistant agent response.");
  });

  it("searches the linked accounts to test as, with the email only when it comes", async () => {
    let search: string | null = null;
    server.use(http.get("/api/whatsapp/assistant-agent/test-recipients", ({ request }) => {
      search = new URL(request.url).searchParams.get("search");
      return HttpResponse.json({ items: [{ contactId: "0199a0c0-0000-7000-8000-0000000000c1", name: "Juan Gómez", email: null }] });
    }));
    expect(await fetchAssistantTestRecipients("Juan")).toEqual([{ contactId: "0199a0c0-0000-7000-8000-0000000000c1", name: "Juan Gómez", email: null }]);
    expect(search).toBe("Juan");
  });

  it("rejects an account with an unknown key", async () => {
    server.use(http.get("/api/whatsapp/assistant-agent/test-recipients", () => HttpResponse.json({ items: [{ contactId: "0199a0c0-0000-7000-8000-0000000000c1", name: "Juan", email: null, phone: "PRIVATE" }] })));
    await expect(fetchAssistantTestRecipients("")).rejects.toThrow("Unsupported assistant agent response.");
  });
});
