import { describe, expect, it } from "vitest";
import type { AgentAction, AssistantAgent } from "../api/assistantAgent";
import { caseKey, changedParts, configOf, describeAction, draftFromAgent, draftSnapshot, emptyAction, issuesUnder, mergeDrafts, moveCase, newButton, newCase, saveRequest, serverIssueKeys, testMessages, testMessagesIssue, textIn, validateDraft, type AgentDraft } from "./assistantAgentDraft";

const none: AgentAction = { kind: "NoReply", formDefinitionId: null, text: null, instructions: null, question: null, buttons: null, handoffReason: null };
const form = "0199a0c0-0000-7000-8000-0000000000f1";
const agent: AssistantAgent = {
  revision: 2, originalCulture: "es",
  profile: { name: "Asistente", introduction: "", tone: "", does: "", doesNot: "", handoffMessage: { es: "Te paso con una persona.", en: null } },
  cases: [
    { id: "0199a0c0-0000-7000-8000-000000000001", when: "Pide hablar con una persona.", inputType: "Any", isActive: true, action: { ...none, kind: "Handoff", handoffReason: "Pide una persona." } },
    { id: "0199a0c0-0000-7000-8000-000000000002", when: "Pregunta el horario.", inputType: "Text", isActive: true, action: { ...none, kind: "ExactText", text: { es: "De 8 a 17.", en: null } } },
  ],
  fallback: none,
  limits: { blockedTopics: ["Precios"], cannotPromise: "", maxReplyLength: 400, dailyReplyLimit: 10, dailyOfferLimit: 2, allowedActions: ["SendForm", "ExactText", "DraftedReply", "AskButtons", "Handoff", "NoReply"] },
  forms: [{ definitionId: form, name: "Registrar visita", offerWhen: "Cuando terminó una visita." }, { definitionId: "0199a0c0-0000-7000-8000-0000000000f2", name: "Pedir repuesto", offerWhen: null }],
  knowledge: { availability: "Available", revision: 1, unansweredQuestions: 0, sections: [] },
  assistantAvailability: { state: "available" },
};
const t = ((key: string, values?: Record<string, unknown>) => values ? key + JSON.stringify(values) : key) as never;

describe("the draft of the assistant agent", () => {
  it("sends back what it read, with the revision and the original language", () => {
    const draft = draftFromAgent(configOf(agent));
    expect(saveRequest(draft, configOf(agent))).toEqual({ expectedRevision: 2, originalCulture: "es", profile: agent.profile, cases: agent.cases, fallback: agent.fallback, limits: agent.limits });
  });

  it("sends only what the chosen action uses and trims what was typed", () => {
    const draft = draftFromAgent(configOf(agent));
    const item = draft.cases[1]!;
    item.when = "  Pregunta el horario.  ";
    // Typing a text and a reason, then choosing buttons: only the question and the buttons go.
    item.action = { ...item.action, kind: "AskButtons", handoffReason: "No va", question: { es: " ¿Visita o entrega? ", en: "  " },
      buttons: [{ ...newButton("b1"), title: { es: "Visita", en: "" }, destination: "SendForm", formDefinitionId: form, text: { es: "No va", en: "" } }, { ...newButton("b2"), title: { es: "Otra", en: "Other" }, destination: "ExactText", formDefinitionId: form, text: { es: "Gracias.", en: "" } }] };
    expect(saveRequest(draft, configOf(agent)).cases[1]).toEqual({ id: item.id, when: "Pregunta el horario.", inputType: "Text", isActive: true, action: { ...none, kind: "AskButtons",
      question: { es: "¿Visita o entrega?", en: null },
      buttons: [{ title: { es: "Visita", en: null }, destination: "SendForm", formDefinitionId: form, text: null }, { title: { es: "Otra", en: "Other" }, destination: "ExactText", formDefinitionId: null, text: { es: "Gracias.", en: null } }] } });
  });

  it("does not count as a change going to another action and back, nor spaces around a text", () => {
    const base = draftFromAgent(configOf(agent));
    const draft = draftFromAgent(configOf(agent));
    draft.cases[1]!.action = { ...draft.cases[1]!.action, kind: "Handoff", handoffReason: "Algo" };
    expect(draftSnapshot(draft)).not.toBe(draftSnapshot(base));
    draft.cases[1]!.action = { ...draft.cases[1]!.action, kind: "ExactText" };
    draft.profile.name = " Asistente ";
    expect(draftSnapshot(draft)).toBe(draftSnapshot(base));
  });

  it("moves an own case one place and leaves the edges as they are", () => {
    const [first, second] = draftFromAgent(configOf(agent)).cases;
    expect(moveCase([first!, second!], second!.id, -1).map(item => item.id)).toEqual([second!.id, first!.id]);
    expect(moveCase([first!, second!], first!.id, -1).map(item => item.id)).toEqual([first!.id, second!.id]);
  });
});

describe("what Guardar checks", () => {
  it("marks each problem at the server's path, with the case named by its id", () => {
    const draft = draftFromAgent(configOf(agent));
    draft.profile.name = " ";
    draft.profile.handoffMessage = { es: "", en: "I'll hand you over." };
    const added = newCase("0199a0c0-0000-7000-8000-000000000003");
    draft.cases.push(added);
    draft.limits.maxReplyLength = "50";
    draft.limits.dailyOfferLimit = "0";
    draft.limits.blockedTopics = ["Precios", "precios"];
    const issues = validateDraft(draft, "es");
    expect(issues["profile.name"]).toEqual({ key: "validation.required" });
    expect(issues["profile.handoffMessage"]).toEqual({ key: "validation.required", culture: "es" });
    expect(issues[caseKey(added.id) + ".when"]).toEqual({ key: "validation.required" });
    expect(issues[caseKey(added.id) + ".action.kind"]).toEqual({ key: "validation.kindRequired" });
    expect(issues["limits.maxReplyLength"]).toEqual({ key: "validation.range", values: { min: 100, max: 1000 } });
    expect(issues["limits.dailyOfferLimit"]).toEqual({ key: "validation.range", values: { min: 1, max: 50 } });
    expect(issues["limits.blockedTopics[1]"]).toEqual({ key: "validation.repeatedTopic" });
  });

  it("says that a case uses an action turned off in Límites, and checks each button", () => {
    const draft = draftFromAgent(configOf(agent));
    draft.limits.allowedActions = ["AskButtons", "SendForm"];
    const item = draft.cases[1]!;
    item.action = { ...emptyAction("AskButtons"), question: { es: "¿Cuál?", en: "" },
      buttons: [{ ...newButton("1"), title: { es: "Sí", en: "" }, destination: "Handoff" }, { ...newButton("2"), title: { es: "sí", en: "" }, destination: null }, { ...newButton("3"), title: { es: "Un texto demasiado largo", en: "" }, destination: "SendForm" }] };
    const issues = issuesUnder(validateDraft(draft, "es"), caseKey(item.id));
    expect(issues["action.buttons[0].destination"]).toEqual({ key: "validation.actionNotAllowed" });
    expect(issues["action.buttons[1].title"]).toEqual({ key: "validation.repeatedButton", culture: "es" });
    expect(issues["action.buttons[1].destination"]).toEqual({ key: "validation.destinationRequired" });
    expect(issues["action.buttons[2].title"]).toEqual({ key: "validation.tooLong", values: { count: 20 }, culture: "es" });
    expect(issues["action.buttons[2].destination"]).toEqual({ key: "validation.formRequired" });
    expect(issuesUnder(validateDraft(draft, "es"), caseKey(draft.cases[0]!.id))["action.kind"]).toEqual({ key: "validation.actionNotAllowed" });
  });

  it("compares the buttons' titles as the person sees them: one without its translation goes out with its original", () => {
    const draft = draftFromAgent(configOf(agent));
    const item = draft.cases[1]!;
    const button = (id: string, es: string, en: string): ReturnType<typeof newButton> => ({ ...newButton(id), title: { es, en }, destination: "Handoff" });
    const titleIssue = (original: "es" | "en") => issuesUnder(validateDraft(draft, original), caseKey(item.id))["action.buttons[1].title"];
    item.action = { ...emptyAction("AskButtons"), question: { es: "¿Ya terminaste?", en: "Are you done?" }, buttons: [button("1", "OK", ""), button("2", "Listo", "OK")] };
    expect(titleIssue("es")).toEqual({ key: "validation.repeatedButton", culture: "en" });
    // Its English field is empty, so the message says the title it goes out with.
    item.action.buttons = [button("1", "Listo", "OK"), button("2", "OK", "")];
    expect(titleIssue("es")).toEqual({ key: "validation.repeatedUntranslated", values: { text: "OK" }, culture: "en" });
    item.action.buttons = [button("1", "OK", "  "), button("2", "Listo", "ok")];
    expect(titleIssue("es")).toEqual({ key: "validation.repeatedButton", culture: "en" });
    item.action.buttons = [button("1", "OK", "Fine"), button("2", "Listo", "OK")];
    expect(titleIssue("es")).toBeUndefined();
    // A repeated original is named in its own language, where it was written, although the other language repeats it too.
    item.action.buttons = [button("1", "", "Done"), button("2", "", "done")];
    expect(titleIssue("en")).toEqual({ key: "validation.repeatedButton", culture: "en" });
  });

  it("puts the server's problems on the case that was sent at that place, even after moving it", () => {
    const ids = ["0199a0c0-0000-7000-8000-000000000001", "0199a0c0-0000-7000-8000-000000000002"];
    const mapped = serverIssueKeys({ "cases[1].action.buttons[1].title": ["Repetido."], "profile.name": ["Requerido."], "fallback.kind": ["Apagada."], "limits.blockedTopics[3]": ["Largo."], cases: ["Demasiados."], "cases[7].when": ["Otro."], expectedRevision: ["Mal."] }, ids);
    expect(mapped.fields).toEqual({ [caseKey(ids[1]!) + ".action.buttons[1].title"]: ["Repetido."], "profile.name": ["Requerido."], "fallback.kind": ["Apagada."], "limits.blockedTopics[3]": ["Largo."] });
    expect(mapped.others).toEqual(["Demasiados.", "Otro.", "Mal."]);
  });
});

describe("a conflict", () => {
  it("keeps what I changed and takes the rest from what the other person saved", () => {
    const base = draftFromAgent(configOf(agent));
    const mine: AgentDraft = { ...base, profile: { ...base.profile, name: "Mi nombre" } };
    const theirs: AgentDraft = { ...base, profile: { ...base.profile, tone: "Cercano" }, limits: { ...base.limits, dailyReplyLimit: "20" } };
    const merged = mergeDrafts(mine, base, theirs);
    expect(merged.profile.name).toBe("Mi nombre");
    expect(merged.profile.tone).toBe("Cercano");
    expect(merged.limits.dailyReplyLimit).toBe("20");
    expect(changedParts(theirs, merged)).toEqual(["profile.name"]);
  });
});

describe("how a case reads", () => {
  it("names the form to send and quotes the configuration of the other actions in the language of the menu", () => {
    expect(describeAction(t, { ...emptyAction("SendForm"), formDefinitionId: form }, agent.forms, "es", "es")).toEqual({ label: 'cases.sendNamed{"form":"Registrar visita"}', detail: "" });
    expect(describeAction(t, { ...emptyAction("ExactText"), text: { es: "Hola", en: "Hi" } }, agent.forms, "en", "es").detail).toBe('quoted{"text":"Hi"}');
    expect(describeAction(t, { ...emptyAction("ExactText"), text: { es: "Hola", en: "" } }, agent.forms, "en", "es").detail).toBe('quoted{"text":"Hola"}');
    expect(textIn({ es: "Hola", en: " " }, "en", "es")).toBe("Hola");
  });
});

describe("the messages of a test", () => {
  it("takes one message per line, without the empty ones, and allows up to five", () => {
    expect(testMessages("Hola\n\n  Estoy en la sucursal Centro \r\nSe rompió la heladera")).toEqual(["Hola", "Estoy en la sucursal Centro", "Se rompió la heladera"]);
    expect(testMessagesIssue([])).toEqual({ key: "test.messagesRequired" });
    expect(testMessagesIssue(["1", "2", "3", "4", "5", "6"])).toEqual({ key: "test.tooManyMessages", values: { count: 5 } });
    expect(testMessagesIssue(["x".repeat(1001)])).toEqual({ key: "test.messageTooLong", values: { count: 1000 } });
    expect(testMessagesIssue(["Hola"])).toBeNull();
  });
});
