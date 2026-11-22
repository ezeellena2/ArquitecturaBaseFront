import type { AgentAction, AgentTestResult, AgentTexts, AssistantAgent } from "@/features/whatsapp/api/assistantAgent";

// «Asistente» of the WhatsApp panel (AS1-A to AS5) without a server or a model: the main agent with the examples of the boards, in
// the language of the scene, a new agent (`agent-empty`) and a test that answers at the second read. Invented data.
const id = (group: number, index: number) => `0199a0c0-0000-7000-80${group}0-${String(index).padStart(12, "0")}`;
const none: AgentAction = { kind: "NoReply", formDefinitionId: null, text: null, instructions: null, question: null, buttons: null, handoffReason: null };

export function createAssistantAgentVisualFixtures(language: "es" | "en", scenario: string) {
  const en = language === "en";
  const text = (es: string, english: string) => en ? english : es;
  // A fixed text in the agent's original language, the one of the scene, without a translation.
  const own = (es: string, english: string): AgentTexts => en ? { es: null, en: english } : { es, en: null };
  const forms = { visit: id(1, 1), delivery: id(1, 2), repair: id(1, 3), part: id(1, 4), survey: id(1, 5) };
  const saved: AssistantAgent = {
    revision: 7, originalCulture: language,
    profile: {
      name: text("Asistente de Tu negocio", "Your business assistant"), tone: text("Cercano y breve, con voseo.", "Friendly and brief."),
      introduction: text("Soy el asistente de Tu negocio. Te ayudo con visitas, entregas y consultas del negocio.", "I'm the assistant of Your business. I can help you with visits, deliveries and questions about the business."),
      does: text("Responde consultas con la información del negocio, manda formularios y pasa a una persona lo que no sabe.", "Answers questions with the business information, sends forms and passes to a person what it doesn't know."),
      doesNot: text("No da precios ni presupuestos. No toma reclamos ni cambia pedidos.", "Doesn't give prices or quotes. Doesn't take complaints or change orders."),
      handoffMessage: own("Te paso con una persona del equipo. Te va a escribir por acá en el horario de atención.", "I'll put you in touch with someone from the team. They'll write to you here during business hours."),
    },
    cases: [
      { id: id(2, 1), when: text("Pide hablar con una persona o con alguien del equipo.", "Asks to talk to a person or someone on the team."), inputType: "Any", isActive: true,
        action: { ...none, kind: "Handoff", handoffReason: text("Pide hablar con una persona.", "Asks to talk to a person.") } },
      { id: id(2, 2), when: text("Pregunta el horario o si están abiertos.", "Asks about the opening hours or if they're open."), inputType: "Any", isActive: true,
        action: { ...none, kind: "ExactText", text: own("Atendemos de lunes a viernes de 8 a 17 y los sábados de 9 a 13.", "We're open Monday to Friday from 8 to 5 and on Saturdays from 9 to 1.") } },
      { id: id(2, 3), when: text("Dice que pasó por un cliente, sin aclarar si fue una visita o una entrega.", "Says they went by a customer, without saying if it was a visit or a delivery."), inputType: "Text", isActive: true,
        action: { ...none, kind: "AskButtons", question: own("¿Fue una visita o una entrega?", "Was it a visit or a delivery?"),
          buttons: [{ title: own("Visita", "Visit"), destination: "SendForm", formDefinitionId: forms.visit, text: null },
            { title: own("Entrega", "Delivery"), destination: "SendForm", formDefinitionId: forms.delivery, text: null }] } },
      { id: id(2, 4), when: text("Manda cadenas, publicidad o mensajes que no son para el negocio.", "Sends chain messages, ads or messages that aren't for the business."), inputType: "Any", isActive: true, action: none },
      { id: id(2, 5), when: text("Pregunta por trabajo o manda un currículum.", "Asks about jobs or sends a résumé."), inputType: "Any", isActive: false,
        action: { ...none, kind: "ExactText", text: own("Gracias por escribir. Por ahora no estamos buscando personal.", "Thanks for writing. We're not hiring right now.") } },
    ],
    fallback: { ...none, kind: "DraftedReply", instructions: text("Respondé breve con la información del negocio; si no la tenés, decí que lo pasás a una persona y derivá.", "Reply briefly with the business information; if you don't have it, say you're passing it to a person and hand off.") },
    limits: { blockedTopics: text("Precios y presupuestos|Reclamos|Datos de otros clientes", "Prices and quotes|Complaints|Other customers' data").split("|"),
      cannotPromise: text("Plazos de entrega, descuentos ni disponibilidad de stock.", "Delivery times, discounts or stock availability."), maxReplyLength: 400, dailyReplyLimit: 10, dailyOfferLimit: 2,
      allowedActions: ["SendForm", "ExactText", "DraftedReply", "AskButtons", "Handoff", "NoReply"] },
    forms: [
      { definitionId: forms.visit, name: text("Registrar visita", "Register visit"), offerWhen: text("Cuando avisa que terminó una visita a un cliente.", "When they say they finished a visit to a customer.") },
      { definitionId: forms.delivery, name: text("Registrar entrega", "Register delivery"), offerWhen: text("Cuando cuenta que entregó materiales a un cliente.", "When they say they delivered materials to a customer.") },
      { definitionId: forms.repair, name: text("Registrar mantenimiento", "Register maintenance"), offerWhen: text("Cuando algo se rompe o hay que arreglarlo en una sucursal.", "When something breaks or needs fixing at a branch.") },
      { definitionId: forms.part, name: text("Pedir repuesto", "Request a part"), offerWhen: text("Cuando necesita un repuesto o un material para un arreglo.", "When they need a part or a material for a repair.") },
      { definitionId: forms.survey, name: text("Encuesta de atención", "Service survey"), offerWhen: null },
    ],
    knowledge: { availability: "Available", revision: 4, unansweredQuestions: 1, sections: [
      { key: "Details", state: "Loaded", facts: [{ id: "details.name", label: text("Nombre", "Name"), text: text("Tu negocio", "Your business") },
        { id: "details.description", label: text("Descripción", "Description"), text: text("Obras, mantenimiento y entrega de materiales para comercios.", "Works, maintenance and delivery of materials for shops.") }] },
      { key: "Location", state: "LegacyUnreviewed", facts: [] },
      { key: "Hours", state: "Loaded", facts: [{ id: "hours.week", label: text("Semana", "Week"), text: text("Lunes a viernes de 8 a 17 y sábados de 9 a 13.", "Monday to Friday from 8 to 5 and Saturdays from 9 to 1.") }] },
      { key: "Services", state: "Empty", facts: [] },
      { key: "Answers", state: "Loaded", facts: [{ id: "faq.1", label: text("¿Hacen envíos?", "Do you deliver?"), text: text("Sí, al interior por transporte, a cargo del cliente.", "Yes, to other provinces by carrier, paid by the customer.") }] },
    ] },
    assistantAvailability: { state: "available" },
  };
  let agent: AssistantAgent = scenario === "agent-empty"
    ? { ...saved, revision: 0, profile: { name: "", introduction: "", tone: "", does: "", doesNot: "", handoffMessage: { es: null, en: null } }, cases: [], fallback: none,
      limits: { ...saved.limits, blockedTopics: [], cannotPromise: "" } }
    : saved;
  const result = (requestId: string, reads: number): AgentTestResult => reads < 2 ? { requestId, state: "pending", failureCode: null, actions: [] } : { requestId, state: "completed", failureCode: null, actions: [
    { kind: "DraftedReply", caseSource: "Fallback", caseTitle: null, reason: text("Saluda: el saludo no encaja en ningún caso propio.", "It's a greeting: it doesn't fit any own case."),
      used: [text("El perfil y los tres mensajes.", "The profile and the three messages.")], text: text("¡Hola! Ya te paso los formularios para la heladera de la sucursal Centro.", "Hi! I'm sending you the forms for the fridge at the Centro branch."),
      buttons: null, form: null, handoffReasonCode: null, handoffReason: null },
    { kind: "SendForm", caseSource: "Form", caseTitle: text("Registrar mantenimiento", "Register maintenance"), reason: text("«Se rompió la heladera» encaja con su «Cuándo lo ofrece».", "“The fridge broke” fits its «When to offer it»."),
      used: [text("Los tres mensajes.", "The three messages."), text("El historial: hoy no se mandó ningún formulario.", "The history: no form was sent today.")], text: text("Este es para reportar el arreglo.", "This one is to report the repair."), buttons: null,
      form: { name: text("Registrar mantenimiento", "Register maintenance"), fields: [{ label: text("Sucursal", "Branch"), value: "Centro" }, { label: text("Qué pasó", "What happened"), value: text("Se rompió la heladera", "The fridge broke") }] },
      handoffReasonCode: null, handoffReason: null },
    { kind: "SendForm", caseSource: "Form", caseTitle: text("Pedir repuesto", "Request a part"), reason: text("«Necesito un repuesto» encaja con su «Cuándo lo ofrece».", "“I need a part” fits its «When to offer it»."),
      used: [text("Sucursal = Centro y Para qué = la heladera.", "Branch = Centro and What for = the fridge.")], text: text("Y este, para pedir el repuesto.", "And this one, to request the part."), buttons: null,
      form: { name: text("Pedir repuesto", "Request a part"), fields: [{ label: text("Sucursal", "Branch"), value: "Centro" }] }, handoffReasonCode: null, handoffReason: null },
  ] };
  const reads = new Map<string, number>();
  const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json" } });
  return {
    permissions: ["whatsapp.read", "whatsapp.configureassistant", "ai.business.read", "ai.business.manage", "formtemplates.read", "formtemplates.manage"],
    async handle(request: Request): Promise<Response | undefined> {
      const url = new URL(request.url), path = url.pathname;
      if (!path.startsWith("/api/whatsapp/assistant-agent")) return undefined;
      if (path === "/api/whatsapp/assistant-agent" && request.method === "GET") return json(agent);
      if (path === "/api/whatsapp/assistant-agent" && request.method === "PUT") {
        const body = await request.json() as Pick<AssistantAgent, "originalCulture" | "profile" | "cases" | "fallback" | "limits">;
        agent = { ...agent, revision: agent.revision + 1, originalCulture: body.originalCulture, profile: body.profile, cases: body.cases, fallback: body.fallback, limits: body.limits };
        return json(agent);
      }
      if (path === "/api/whatsapp/assistant-agent/test-recipients") return json({ items: [
        { contactId: id(3, 1), name: "Juan Gómez", email: "juan@example.com" }, { contactId: id(3, 2), name: "Laura Ríos", email: null }] });
      if (path === "/api/whatsapp/assistant-agent/tests" && request.method === "POST") return new Response(null, { status: 202 });
      const test = /^\/api\/whatsapp\/assistant-agent\/tests\/([^/]+)$/.exec(path);
      if (test) { const count = (reads.get(test[1]!) ?? 0) + 1; reads.set(test[1]!, count); return json(result(test[1]!, count)); }
      return json({ code: "Visual.NotFound" }, 404);
    },
  };
}
