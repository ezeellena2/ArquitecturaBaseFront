import { act, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { toast } from "sonner";
import { queryClient } from "@/shared/api/queryClient";
import { currentUser } from "@/test/mocks/handlers";
import { server } from "@/test/mocks/server";
import { renderRouteWithProviders } from "@/test/utils/renderWithProviders";
import type { AgentAction, AgentTestResult, AssistantAgent, AssistantAgentSaveRequest } from "../api/assistantAgent";

vi.mock("react-oidc-context", async () => ({ ...(await vi.importActual<typeof import("react-oidc-context")>("react-oidc-context")), useAuth: () => ({ isAuthenticated: true, isLoading: false, user: { access_token: "t" } }) }));

const none: AgentAction = { kind: "NoReply", formDefinitionId: null, text: null, instructions: null, question: null, buttons: null, handoffReason: null };
const visit = "0199a0c0-0000-7000-8000-0000000000f1", part = "0199a0c0-0000-7000-8000-0000000000f2";
const ids = ["0199a0c0-0000-7000-8000-000000000001", "0199a0c0-0000-7000-8000-000000000002", "0199a0c0-0000-7000-8000-000000000003"];
const juan = "0199a0c0-0000-7000-8000-0000000000c1";
const allowed = ["SendForm", "ExactText", "DraftedReply", "AskButtons", "Handoff", "NoReply"] as const;
let current: AssistantAgent;
let writes: AssistantAgentSaveRequest[];
let permissions: string[];

// The account is the only piece to choose (DS1-A): its list opens with the keyboard and searches inside.
async function chooseRecipient(panel: HTMLElement, name: RegExp = /Juan Gómez/) {
  const trigger = within(panel).getByRole("button", { name: /^Como si escribiera/ });
  await act(async () => { trigger.focus(); });
  await userEvent.keyboard("{Enter}");
  await userEvent.click(await within(await screen.findByRole("listbox", { name: "Como si escribiera" })).findByRole("option", { name }));
}
function saved(): AssistantAgent {
  return {
    revision: 3, originalCulture: "es",
    profile: { name: "Asistente", introduction: "Soy el asistente.", tone: "Breve", does: "", doesNot: "", handoffMessage: { es: "Te paso con una persona.", en: null } },
    cases: [
      { id: ids[0]!, when: "Pide hablar con una persona.", inputType: "Any", isActive: true, action: { ...none, kind: "Handoff", handoffReason: "Pide hablar con una persona." } },
      { id: ids[1]!, when: "Pregunta el horario.", inputType: "Any", isActive: true, action: { ...none, kind: "ExactText", text: { es: "De 8 a 17.", en: null } } },
      { id: ids[2]!, when: "Dice que pasó por un cliente.", inputType: "Text", isActive: false, action: { ...none, kind: "AskButtons", question: { es: "¿Visita o entrega?", en: null },
        buttons: [{ title: { es: "Visita", en: null }, destination: "SendForm", formDefinitionId: visit, text: null }, { title: { es: "Otra cosa", en: null }, destination: "Handoff", formDefinitionId: null, text: null }] } },
    ],
    fallback: { ...none, kind: "DraftedReply", instructions: "Respondé breve con la información del negocio." },
    limits: { blockedTopics: ["Precios"], cannotPromise: "", maxReplyLength: 400, dailyReplyLimit: 10, dailyOfferLimit: 2, allowedActions: [...allowed] },
    forms: [{ definitionId: visit, name: "Registrar visita", offerWhen: "Cuando avisa que terminó una visita." }, { definitionId: part, name: "Pedir repuesto", offerWhen: null }],
    knowledge: { availability: "Available", revision: 2, unansweredQuestions: 1, sections: [
      { key: "Details", state: "Loaded", facts: [{ id: "details.name", label: "Nombre", text: "Tu negocio" }] },
      { key: "Location", state: "LegacyUnreviewed", facts: [] },
      { key: "Hours", state: "Empty", facts: [] },
      { key: "Services", state: "Empty", facts: [] },
      { key: "Answers", state: "Loaded", facts: [{ id: "faq.1", label: "¿Hacen envíos?", text: "Sí, al interior." }] },
    ] },
    assistantAvailability: { state: "available" },
  };
}
const asSaved = (request: AssistantAgentSaveRequest): AssistantAgent => ({ ...current, revision: current.revision + 1, originalCulture: request.originalCulture, profile: request.profile, cases: request.cases, fallback: request.fallback, limits: request.limits });

beforeEach(() => {
  queryClient.clear(); writes = []; current = saved();
  permissions = ["whatsapp.read", "whatsapp.configureassistant", "ai.business.manage", "formtemplates.manage"];
  server.use(http.get("/api/me", () => HttpResponse.json({ ...currentUser, permissions })),
    http.get("/api/whatsapp/assistant-agent", () => HttpResponse.json(current)),
    http.put("/api/whatsapp/assistant-agent", async ({ request }) => {
      const body = await request.json() as AssistantAgentSaveRequest; writes.push(body);
      current = asSaved(body);
      return HttpResponse.json(current);
    }));
});
afterEach(() => { queryClient.clear(); toast.dismiss(); vi.restoreAllMocks(); });

const open = async (path = "/whatsapp/asistente") => {
  const rendered = renderRouteWithProviders(path);
  await screen.findByRole("tablist", { name: "Partes del agente principal" });
  return rendered;
};
const header = () => screen.getByRole("heading", { level: 1, name: "Agente principal" }).closest("header") as HTMLElement;
const save = () => within(header()).getByRole("button", { name: "Guardar" });
const tab = (name: RegExp | string) => screen.getByRole("tab", { name });
const ownCases = () => within(screen.getByRole("list", { name: /^Casos propios/ })).getAllByRole("listitem");

describe("the screen «Asistente»", () => {
  it("opens in Casos with the own cases in order, the forms block and «Cualquier otra cosa» last", async () => {
    await open();
    expect(screen.getByRole("heading", { level: 1, name: "Agente principal" })).toBeInTheDocument();
    expect(screen.getByText("Atiende todas las conversaciones en modo Asistente")).toBeInTheDocument();
    // Three own cases, one form with «Cuándo lo ofrece» and «Cualquier otra cosa».
    expect(tab(/Casos/)).toHaveAttribute("aria-selected", "true");
    expect(tab(/Casos/)).toHaveAccessibleName("Casos 5");
    expect(ownCases().map(item => item.textContent)).toEqual([
      expect.stringContaining("Pide hablar con una persona."), expect.stringContaining("Pregunta el horario."), expect.stringContaining("Dice que pasó por un cliente.")]);
    // The configuration in grey under the action, without «Motivo:»; a paused case is only its box.
    const [first, , third] = ownCases();
    expect(within(first!).getByText("Derivar a una persona")).toBeInTheDocument();
    expect(within(first!).getByText("«Pide hablar con una persona.»")).toBeInTheDocument();
    expect(first).not.toHaveTextContent("Motivo");
    expect(within(third!).getByRole("checkbox", { name: "Caso 3 · Activo" })).not.toBeChecked();
    expect(third).not.toHaveTextContent("Pausado");
    expect(within(third!).getByText("«¿Visita o entrega?» · Visita → Registrar visita · Otra cosa → Derivar a una persona")).toBeInTheDocument();
    const forms = screen.getByRole("list", { name: "De los formularios · 1" });
    expect(within(forms).getByText("Cuando avisa que terminó una visita.")).toBeInTheDocument();
    expect(within(forms).getByText("Mandar Registrar visita")).toBeInTheDocument();
    expect(within(forms).getByRole("link", { name: "Editar en el formulario Registrar visita" })).toHaveAttribute("href", "/formularios/" + visit);
    expect(screen.getByText("Cualquier otra cosa")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Editar «Cualquier otra cosa»" })).toBeInTheDocument();
    expect(screen.queryByText(/Arrastrá/)).not.toBeInTheDocument();
    // Without changes, Guardar is off with nothing next to it.
    expect(save()).toBeDisabled();
    expect(screen.getByRole("link", { name: "Asistente" })).toHaveAttribute("href", "/whatsapp/asistente");
  });

  it("opens a new agent in Perfil with the notice that it does what it does today until it is set up", async () => {
    current = { ...saved(), revision: 0, profile: { name: "", introduction: "", tone: "", does: "", doesNot: "", handoffMessage: { es: null, en: null } }, cases: [], fallback: none };
    const { router } = await open();
    expect(tab("Perfil")).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("status")).toHaveTextContent("El agente principal todavía no tiene perfil. Hasta que lo configures, el asistente hace lo de hoy");
    expect(screen.getByRole("textbox", { name: "Nombre del asistente" })).toHaveValue("");
    await userEvent.click(tab(/Casos/));
    expect(router.state.location.search).toBe("?pestana=casos");
    expect(screen.getByText("Todavía no hay casos propios.")).toBeInTheDocument();
  });

  it("keeps the tab in the address", async () => {
    const { router } = await open("/whatsapp/asistente?pestana=limites");
    expect(tab("Límites")).toHaveAttribute("aria-selected", "true");
    await userEvent.click(tab("Perfil"));
    expect(router.state.location.search).toBe("?pestana=perfil");
    await userEvent.click(tab(/Casos/));
    expect(router.state.location.search).toBe("");
  });

  // TO1-A (2026-11-21): how many forms it offers a day is set in Límites, under the reply limit, and saved with the rest.
  it("edits the form offer limit in Límites and saves it with the other limits", async () => {
    server.use(http.put("/api/whatsapp/assistant-agent", async ({ request }) => {
      const body = await request.json() as AssistantAgentSaveRequest; writes.push(body);
      current = asSaved(body);
      return HttpResponse.json(current);
    }));
    await open("/whatsapp/asistente?pestana=limites");
    const offers = screen.getByRole("spinbutton", { name: /Tope de ofrecimientos de formularios/ });
    expect(offers).toHaveValue(2);
    await userEvent.clear(offers);
    await userEvent.type(offers, "51");
    await userEvent.click(save());
    await waitFor(() => expect(offers).toHaveAccessibleDescription(expect.stringContaining("Elegí un número entre 1 y 50.")));
    expect(writes).toHaveLength(0);
    await userEvent.clear(offers);
    await userEvent.type(offers, "4");
    await userEvent.click(save());
    await waitFor(() => expect(writes).toHaveLength(1));
    expect(writes[0]!.limits).toEqual({ ...saved().limits, dailyOfferLimit: 4 });
  });

  it("saves the four tabs with the revision read and only what each action uses", async () => {
    let release!: () => void;
    const held = new Promise<void>(resolve => { release = resolve; });
    server.use(http.put("/api/whatsapp/assistant-agent", async ({ request }) => {
      const body = await request.json() as AssistantAgentSaveRequest; writes.push(body);
      await held;
      current = asSaved(body);
      return HttpResponse.json(current);
    }));
    await open("/whatsapp/asistente?pestana=perfil");
    await userEvent.type(screen.getByRole("textbox", { name: "Nombre del asistente" }), " nuevo");
    await userEvent.click(save());
    // While it saves, the button says so and the tab cannot be edited.
    expect(await within(header()).findByRole("button", { name: "Guardando…" })).toBeDisabled();
    expect(screen.getByRole("textbox", { name: "Nombre del asistente" })).toBeDisabled();
    await act(async () => release());
    await waitFor(() => expect(writes).toHaveLength(1));
    const { profile, cases, fallback, limits, revision, originalCulture } = saved();
    expect(writes[0]).toEqual({ expectedRevision: revision, originalCulture, profile: { ...profile, name: "Asistente nuevo" }, cases, fallback, limits });
    expect(await screen.findByText("Guardamos el asistente.")).toBeInTheDocument();
    await waitFor(() => expect(save()).toBeDisabled());
  });

  it("asks before leaving or discarding what was changed", async () => {
    const { router } = await open("/whatsapp/asistente?pestana=perfil");
    const name = screen.getByRole("textbox", { name: "Nombre del asistente" });
    await userEvent.type(name, " nuevo");
    await userEvent.click(within(screen.getByRole("navigation", { name: "Navegación principal" })).getByRole("link", { name: "Inicio" }));
    let dialog = await screen.findByRole("dialog", { name: "¿Descartar los cambios?" });
    await userEvent.click(within(dialog).getByRole("button", { name: "Seguir editando" }));
    expect(router.state.location.pathname).toBe("/whatsapp/asistente");
    expect(name).toHaveValue("Asistente nuevo");
    await userEvent.click(within(header()).getByRole("button", { name: "Descartar" }));
    dialog = await screen.findByRole("dialog", { name: "¿Descartar los cambios?" });
    await userEvent.click(within(dialog).getByRole("button", { name: "Descartar" }));
    expect(screen.getByRole("textbox", { name: "Nombre del asistente" })).toHaveValue("Asistente");
    expect(save()).toBeDisabled();
  });

  it("solves a conflict as Información del negocio: it reads what is saved and keeps what was edited", async () => {
    server.use(http.put("/api/whatsapp/assistant-agent", async ({ request }) => {
      const body = await request.json() as AssistantAgentSaveRequest; writes.push(body);
      if (body.expectedRevision !== current.revision) return HttpResponse.json({ code: "WhatsApp.AssistantAgent.RevisionConflict" }, { status: 409 });
      current = asSaved(body);
      return HttpResponse.json(current);
    }));
    await open("/whatsapp/asistente?pestana=perfil");
    current = { ...current, revision: 4, profile: { ...current.profile, tone: "Cercano" } };
    await userEvent.type(screen.getByRole("textbox", { name: "Nombre del asistente" }), " nuevo");
    await userEvent.click(save());
    const review = await screen.findByRole("region", { name: "Revisar cambios de otra persona" });
    expect(save()).toHaveAttribute("aria-disabled", "true");
    expect(save()).toHaveAccessibleDescription("Primero revisá los cambios de la otra persona.");
    await userEvent.click(within(review).getByRole("button", { name: "Revisar cambios" }));
    const table = await within(review).findByRole("table");
    expect(within(table).getByText("Nombre del asistente")).toBeInTheDocument();
    expect(within(table).getByText("Tono")).toBeInTheDocument();
    await userEvent.click(within(review).getByRole("button", { name: "Conservar mis cambios" }));
    expect(screen.queryByRole("region", { name: "Revisar cambios de otra persona" })).not.toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "Nombre del asistente" })).toHaveValue("Asistente nuevo");
    expect(screen.getByRole("textbox", { name: "Tono" })).toHaveValue("Cercano");
    await userEvent.click(save());
    await waitFor(() => expect(writes).toHaveLength(2));
    expect(writes[1]).toMatchObject({ expectedRevision: 4, profile: { name: "Asistente nuevo", tone: "Cercano" } });
  });

  it("puts each problem of the server in its field and marks the case that has it", { timeout: 15000 }, async () => {
    server.use(http.put("/api/whatsapp/assistant-agent", async ({ request }) => {
      writes.push(await request.json() as AssistantAgentSaveRequest);
      return HttpResponse.json({ code: "Validation.Failed", errors: { "profile.name": ["Ese nombre no sirve."], "cases[1].action.text": ["Ese texto no sirve."] } }, { status: 400 });
    }));
    await open();
    await userEvent.click(within(ownCases()[0]!).getByRole("checkbox", { name: "Caso 1 · Activo" }));
    await userEvent.click(save());
    // The first problem is in Perfil: the tab changes and its field takes the focus.
    const name = await screen.findByRole("textbox", { name: "Nombre del asistente" });
    await waitFor(() => expect(name).toHaveFocus());
    expect(name).toHaveAccessibleDescription(expect.stringContaining("Ese nombre no sirve."));
    expect(tab(/Perfil/)).toHaveTextContent("Tiene datos para revisar");
    await userEvent.click(tab(/Casos/));
    const second = ownCases()[1]!;
    expect(within(second).getByText("Revisá este caso")).toBeInTheDocument();
    expect(within(ownCases()[0]!).queryByText("Revisá este caso")).not.toBeInTheDocument();
    await userEvent.click(within(second).getByRole("button", { name: "Editar el caso 2" }));
    const editor = await screen.findByRole("dialog", { name: "Caso 2" });
    const text = within(editor).getByRole("textbox", { name: "Texto" });
    expect(text).toHaveAccessibleDescription(expect.stringContaining("Ese texto no sirve."));
    await userEvent.click(text);
    await userEvent.paste(" Sábados de 9 a 13.");
    expect(within(editor).queryByText("Ese texto no sirve.")).not.toBeInTheDocument();
    await userEvent.click(within(editor).getByRole("button", { name: "Listo" }));
    expect(within(ownCases()[1]!).queryByText("Revisá este caso")).not.toBeInTheDocument();
  });

  it("moves own cases with the arrows, keeps the focus on the moved one and says its place", async () => {
    await open();
    await userEvent.click(within(ownCases()[0]!).getByRole("button", { name: "Bajar el caso 1" }));
    expect(ownCases().map(item => item.textContent)).toEqual([expect.stringContaining("Pregunta el horario."), expect.stringContaining("Pide hablar con una persona."), expect.stringContaining("Dice que pasó por un cliente.")]);
    expect(document.activeElement).toBe(within(ownCases()[1]!).getByRole("button", { name: "Bajar el caso 2" }));
    expect(screen.getByText("Ahora es el caso 2 de 3.")).toBeInTheDocument();
    await userEvent.click(save());
    await waitFor(() => expect(writes).toHaveLength(1));
    expect(writes[0]!.cases.map(item => item.id)).toEqual([ids[1], ids[0], ids[2]]);
  });

  it("edits a case at the side: Listo takes it to the list, Cancelar leaves it and Quitar caso removes it", { timeout: 15000 }, async () => {
    await open();
    await userEvent.click(screen.getByRole("button", { name: "Nuevo caso" }));
    let editor = await screen.findByRole("dialog", { name: "Nuevo caso" });
    await userEvent.click(within(editor).getByRole("textbox", { name: "Cuándo" }));
    await userEvent.paste("Manda un currículum.");
    await userEvent.click(within(editor).getByRole("radio", { name: "Responder con un texto exacto" }));
    await userEvent.click(within(editor).getByRole("textbox", { name: "Texto" }));
    await userEvent.paste("Gracias por escribir.");
    // The removal goes apart, on the left; a new case does not have it yet.
    expect(within(editor).queryByRole("button", { name: "Quitar caso" })).not.toBeInTheDocument();
    await userEvent.click(within(editor).getByRole("button", { name: "Listo" }));
    await waitFor(() => expect(ownCases()).toHaveLength(4));
    expect(within(ownCases()[3]!).getByText("«Gracias por escribir.»")).toBeInTheDocument();

    await userEvent.click(within(ownCases()[0]!).getByRole("button", { name: "Editar el caso 1" }));
    editor = await screen.findByRole("dialog", { name: "Caso 1" });
    const footer = within(editor).getByRole("button", { name: "Listo" }).parentElement!.parentElement!;
    expect(within(footer).getAllByRole("button").map(button => button.textContent)).toEqual(["Quitar caso", "Cancelar", "Listo"]);
    await userEvent.clear(within(editor).getByRole("textbox", { name: "Cuándo" }));
    await userEvent.click(within(editor).getByRole("button", { name: "Cancelar" }));
    expect(within(ownCases()[0]!).getByText("Pide hablar con una persona.")).toBeInTheDocument();

    await userEvent.click(within(ownCases()[1]!).getByRole("button", { name: "Editar el caso 2" }));
    editor = await screen.findByRole("dialog", { name: "Caso 2" });
    await userEvent.click(within(editor).getByRole("button", { name: "Quitar caso" }));
    await waitFor(() => expect(ownCases()).toHaveLength(3));
    expect(screen.queryByText("Pregunta el horario.")).not.toBeInTheDocument();
    await userEvent.click(save());
    await waitFor(() => expect(writes).toHaveLength(1));
    expect(writes[0]!.cases.map(item => item.when)).toEqual(["Pide hablar con una persona.", "Dice que pasó por un cliente.", "Manda un currículum."]);
    expect(writes[0]!.cases[2]!.action).toEqual({ ...none, kind: "ExactText", text: { es: "Gracias por escribir.", en: null } });
  });

  it("edits «Cualquier otra cosa» with its «Cuándo» fixed and without pausing or removing it", async () => {
    await open();
    await userEvent.click(screen.getByRole("button", { name: "Editar «Cualquier otra cosa»" }));
    const editor = await screen.findByRole("dialog", { name: "Cualquier otra cosa" });
    expect(within(editor).getByRole("textbox", { name: "Cuándo" })).toHaveAttribute("readonly");
    expect(within(editor).getByRole("button", { name: "Es fijo: este caso siempre existe y va al final." })).toBeInTheDocument();
    expect(within(editor).queryByRole("checkbox", { name: /Activo/ })).not.toBeInTheDocument();
    expect(within(editor).queryByRole("button", { name: "Quitar caso" })).not.toBeInTheDocument();
    await userEvent.click(within(editor).getByRole("radio", { name: "No responder" }));
    await userEvent.click(within(editor).getByRole("button", { name: "Listo" }));
    await userEvent.click(save());
    await waitFor(() => expect(writes).toHaveLength(1));
    expect(writes[0]!.fallback).toEqual(none);
  });

  it("takes a turned-off action out of the editor and marks the case that uses it when saving", async () => {
    await open("/whatsapp/asistente?pestana=limites");
    const actions = screen.getByRole("group", { name: "Acciones que puede usar" });
    await userEvent.click(within(actions).getByRole("checkbox", { name: "Derivar a una persona" }));
    await userEvent.click(tab(/Casos/));
    await userEvent.click(within(ownCases()[0]!).getByRole("button", { name: "Editar el caso 1" }));
    let editor = await screen.findByRole("dialog", { name: "Caso 1" });
    const options = within(editor).getByRole("radiogroup", { name: "Qué hacer" });
    expect(within(options).queryByRole("radio", { name: "Derivar a una persona" })).not.toBeInTheDocument();
    expect(within(options).getAllByRole("radio").every(radio => radio.getAttribute("aria-checked") === "false")).toBe(true);
    await userEvent.click(within(editor).getByRole("button", { name: "Cancelar" }));
    await userEvent.click(save());
    // The second case's buttons lead to a hand-off too: both rows are marked, and the focus goes to the first.
    await waitFor(() => expect(ownCases()[0]).toHaveFocus());
    expect(writes).toHaveLength(0);
    expect(within(ownCases()[0]!).getByText("Revisá este caso")).toBeInTheDocument();
    await userEvent.click(within(ownCases()[0]!).getByRole("button", { name: "Editar el caso 1" }));
    editor = await screen.findByRole("dialog", { name: "Caso 1" });
    expect(within(editor).getByRole("alert")).toHaveTextContent("Esta acción está apagada en Límites.");
  });

  it("reads the knowledge with the zones of Información del negocio and their state", async () => {
    await open("/whatsapp/asistente?pestana=conocimiento");
    const table = screen.getByRole("table");
    expect(within(table).getAllByRole("columnheader").map(header => header.textContent)).toEqual(["Zona", "Estado", "Qué dice"]);
    expect(within(table).getAllByRole("rowheader").map(header => header.textContent)).toEqual(["Datos del negocio", "Ubicación y zona de atención", "Horario de atención", "Servicios y condiciones", "Preguntas frecuentes"]);
    expect(within(table).getByText("Texto anterior, sin revisar")).toBeInTheDocument();
    expect(within(table).getByText("¿Hacen envíos?")).toBeInTheDocument();
    expect(within(table).getByText("1 pregunta sin respuesta")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Editar en Información del negocio" })).toHaveAttribute("href", "/configuracion/negocio");
  });

  it("hides the knowledge without the module and its edition without managing the business information", async () => {
    permissions = ["whatsapp.configureassistant"];
    await open("/whatsapp/asistente?pestana=conocimiento");
    expect(screen.queryByRole("link", { name: "Editar en Información del negocio" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /Editar en el formulario/ })).not.toBeInTheDocument();
  });

  it("does not offer the knowledge tab without its module", async () => {
    current = { ...saved(), knowledge: { availability: "NotInstalled", revision: 0, unansweredQuestions: 0, sections: [] } };
    await open("/whatsapp/asistente?pestana=conocimiento");
    expect(screen.queryByRole("tab", { name: "Conocimiento" })).not.toBeInTheDocument();
    expect(tab(/Casos/)).toHaveAttribute("aria-selected", "true");
  });
});

describe("loading, waiting and permissions", () => {
  it("draws the form while it reads and offers Retry when the read fails", async () => {
    let fail = true;
    server.use(http.get("/api/whatsapp/assistant-agent", () => fail ? HttpResponse.json({ code: "Server.Error" }, { status: 500 }) : HttpResponse.json(current)));
    renderRouteWithProviders("/whatsapp/asistente");
    expect(await screen.findByText("No pudimos cargar el asistente.")).toBeInTheDocument();
    fail = false;
    await userEvent.click(screen.getByRole("button", { name: "Reintentar" }));
    expect(await screen.findByRole("tablist", { name: "Partes del agente principal" })).toBeInTheDocument();
  });

  it("gives the wait of a 429 as the reason of Guardar", async () => {
    server.use(http.put("/api/whatsapp/assistant-agent", () => HttpResponse.json({ code: "RateLimit.Exceeded", detail: "Demasiados pedidos.", retryAfter: 30 }, { status: 429 })));
    await open("/whatsapp/asistente?pestana=perfil");
    await userEvent.type(screen.getByRole("textbox", { name: "Nombre del asistente" }), " nuevo");
    await userEvent.click(save());
    await waitFor(() => expect(save()).toHaveAttribute("aria-disabled", "true"));
    expect(save()).toHaveAccessibleDescription(/Esperá \d+ segundos para volver a guardar\./);
  });

  it("sends a 403 of its read to «No tenés permiso»", async () => {
    server.use(http.get("/api/whatsapp/assistant-agent", () => HttpResponse.json({ code: "Authorization.Forbidden" }, { status: 403 })));
    const { router } = renderRouteWithProviders("/whatsapp/asistente");
    await waitFor(() => expect(router.state.location.pathname).toBe("/sin-permiso"));
  });

  it("denies the route, and does not show its entry, without «Configurar el asistente»", async () => {
    const read = vi.fn(() => HttpResponse.json(current));
    permissions = ["whatsapp.read"];
    server.use(http.get("/api/whatsapp/assistant-agent", read),
      http.get("/api/whatsapp/chats", () => HttpResponse.json({ page: { items: [], totalCount: 0, page: 1, pageSize: 20, totalPages: 0 }, allCount: 0, unreadCount: 0 })));
    const { router } = renderRouteWithProviders("/whatsapp/asistente");
    await waitFor(() => expect(router.state.location.pathname).toBe("/sin-permiso"));
    expect(read).not.toHaveBeenCalled();
    await act(() => router.navigate("/whatsapp/chat"));
    expect(await screen.findByRole("link", { name: "Chat" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Asistente" })).not.toBeInTheDocument();
  });
});

describe("Probar", () => {
  const result = (requestId: string, state: AgentTestResult["state"]): AgentTestResult => ({ requestId, state, failureCode: null, actions: state !== "completed" ? [] : [
    { kind: "DraftedReply", caseSource: "Fallback", caseTitle: null, reason: "Saluda: no encaja en ningún caso propio.", used: ["El perfil y los dos mensajes."], text: "¡Hola! Ya te paso el formulario.", buttons: null, form: null, handoffReasonCode: null, handoffReason: null },
    { kind: "SendForm", caseSource: "Form", caseTitle: "Registrar visita", reason: "Encaja con su «Cuándo lo ofrece».", used: ["El mensaje."], text: null, buttons: null,
      form: { name: "Registrar visita", fields: [{ label: "Sucursal", value: "Centro" }] }, handoffReasonCode: null, handoffReason: null },
  ] });

  it("tests what is saved as a linked account: pending, then the actions in order with why and how the person would see them", { timeout: 15000 }, async () => {
    const started: unknown[] = [];
    let reads = 0;
    server.use(http.get("/api/whatsapp/assistant-agent/test-recipients", () => HttpResponse.json({ items: [{ contactId: juan, name: "Juan Gómez", email: "juan@example.com" }] })),
      http.post("/api/whatsapp/assistant-agent/tests", async ({ request }) => { started.push(await request.json()); return new HttpResponse(null, { status: 202 }); }),
      http.get("/api/whatsapp/assistant-agent/tests/:id", ({ params }) => HttpResponse.json(result(String(params.id), ++reads < 2 ? "pending" : "completed"))));
    await open("/whatsapp/asistente?pestana=perfil");
    await userEvent.type(screen.getByRole("textbox", { name: "Nombre del asistente" }), " nuevo");
    await userEvent.click(within(header()).getByRole("button", { name: "Probar" }));
    const panel = await screen.findByRole("dialog", { name: "Probar el asistente" });
    expect(within(panel).getByRole("status")).toHaveTextContent("Tenés cambios sin guardar: la prueba usa lo guardado.");
    // Without an account or messages, Probar marks its fields and sends nothing.
    await userEvent.click(within(panel).getByRole("button", { name: "Probar" }));
    const recipient = within(panel).getByRole("button", { name: "Como si escribiera Elegí una cuenta vinculada" });
    expect(recipient).toHaveAccessibleDescription(expect.stringContaining("Elegí una cuenta."));
    await waitFor(() => expect(recipient).toHaveFocus());
    expect(started).toHaveLength(0);
    await chooseRecipient(panel);
    // The list says the account by its name, with its e-mail in grey; the field, by its name.
    expect(recipient).toHaveAccessibleName("Como si escribiera Juan Gómez");
    await userEvent.click(within(panel).getByRole("textbox", { name: "Mensajes" }));
    await userEvent.paste("Hola\n\nSe rompió la heladera");
    await userEvent.click(within(panel).getByRole("button", { name: "Probar" }));
    expect(await within(panel).findByRole("button", { name: "Probando…" })).toBeDisabled();
    expect(started).toEqual([{ requestId: expect.any(String), contactId: juan, messages: ["Hola", "Se rompió la heladera"] }]);
    const test = await within(panel).findByRole("article", { name: "Prueba como Juan Gómez" });
    expect(await within(test).findByText("Acciones, en orden (2)", undefined, { timeout: 4000 })).toBeInTheDocument();
    const terms = within(test).getAllByRole("term").map(term => term.textContent);
    expect(terms.slice(0, 3)).toEqual(["Caso", "Por qué", "Usó"]);
    expect(within(test).getByText("Cualquier otra cosa")).toBeInTheDocument();
    expect(within(test).getByText("¡Hola! Ya te paso el formulario.")).toBeInTheDocument();
    expect(within(test).getByText("Mandar Registrar visita")).toBeInTheDocument();
    expect(within(test).getByText("Abrir formulario")).toBeInTheDocument();
    expect(within(test).getByText("Centro")).toBeInTheDocument();
    expect(within(test).queryByText("No se mandó nada.")).not.toBeInTheDocument();
    expect(within(panel).getByRole("button", { name: "Probar" })).toBeEnabled();
    // Closing forgets the results and keeps the account and the messages.
    await userEvent.keyboard("{Escape}");
    await userEvent.click(within(header()).getByRole("button", { name: "Probar" }));
    const again = await screen.findByRole("dialog", { name: "Probar el asistente" });
    expect(within(again).queryByRole("article")).not.toBeInTheDocument();
    expect(within(again).getByRole("textbox", { name: "Mensajes" })).toHaveValue("Hola\n\nSe rompió la heladera");
    expect(within(again).getByRole("button", { name: /^Como si escribiera/ })).toHaveAccessibleName("Como si escribiera Juan Gómez");
  });

  it("shows a hand-off with its reason and a test the server could not finish", async () => {
    server.use(http.get("/api/whatsapp/assistant-agent/test-recipients", () => HttpResponse.json({ items: [{ contactId: juan, name: "Juan Gómez", email: null }] })),
      http.post("/api/whatsapp/assistant-agent/tests", () => new HttpResponse(null, { status: 202 })),
      http.get("/api/whatsapp/assistant-agent/tests/:id", ({ params }) => HttpResponse.json({ requestId: params.id, state: "completed", failureCode: null, actions: [
        { kind: "Handoff", caseSource: "Own", caseTitle: "Pide hablar con una persona.", reason: "Pide una persona.", used: [], text: "Te paso con una persona.", buttons: null, form: null, handoffReasonCode: "dailyReplyLimit", handoffReason: null }] })));
    await open();
    await userEvent.click(within(header()).getByRole("button", { name: "Probar" }));
    const panel = await screen.findByRole("dialog", { name: "Probar el asistente" });
    await chooseRecipient(panel);
    await userEvent.click(within(panel).getByRole("textbox", { name: "Mensajes" }));
    await userEvent.paste("Quiero hablar con alguien");
    await userEvent.click(within(panel).getByRole("button", { name: "Probar" }));
    const test = await within(panel).findByRole("article", { name: "Prueba como Juan Gómez" });
    expect(await within(test).findByText("Necesita una persona")).toBeInTheDocument();
    expect(within(test).getByText("Llegó al tope de respuestas del día")).toBeInTheDocument();
    expect(within(test).getByText("Te paso con una persona.")).toBeInTheDocument();
  });

  it("turns Probar off with its reason when the AI is not available", async () => {
    current = { ...saved(), assistantAvailability: { state: "notConfigured" } };
    await open();
    const button = within(header()).getByRole("button", { name: "Probar" });
    expect(button).toHaveAttribute("aria-disabled", "true");
    expect(button).toHaveAccessibleDescription("El asistente no está disponible: falta configurar la conexión de IA.");
    await userEvent.click(button);
    expect(screen.queryByRole("dialog", { name: "Probar el asistente" })).not.toBeInTheDocument();
  });

  // H4: without reading responses, the server leaves out why and what a form would fill, and the test says so in their place.
  it("says where it leaves out why and what a form would fill for someone who does not read responses", async () => {
    server.use(http.get("/api/whatsapp/assistant-agent/test-recipients", () => HttpResponse.json({ items: [{ contactId: juan, name: "Juan Gómez", email: null }] })),
      http.post("/api/whatsapp/assistant-agent/tests", () => new HttpResponse(null, { status: 202 })),
      http.get("/api/whatsapp/assistant-agent/tests/:id", ({ params }) => HttpResponse.json({ requestId: params.id, state: "completed", failureCode: null, actions: [
        { kind: "SendForm", caseSource: "Form", caseTitle: "Registrar visita", reason: "", used: [], text: null, buttons: null,
          form: { name: "Registrar visita", fields: [] }, handoffReasonCode: null, handoffReason: null }] })));
    await open();
    await userEvent.click(within(header()).getByRole("button", { name: "Probar" }));
    const panel = await screen.findByRole("dialog", { name: "Probar el asistente" });
    await chooseRecipient(panel);
    await userEvent.click(within(panel).getByRole("textbox", { name: "Mensajes" }));
    await userEvent.paste("Pasé por Juan");
    await userEvent.click(within(panel).getByRole("button", { name: "Probar" }));
    const test = await within(panel).findByRole("article", { name: "Prueba como Juan Gómez" });
    expect(await within(test).findAllByText("No tenés permiso para ver las respuestas de los formularios.")).toHaveLength(2);
  });

  // H4: a 403 of Probar after reading chats went away closes the panel and keeps the page, with Probar off and its reason.
  it("keeps the page and turns Probar off when a test answers 403 and the assistant can still be configured", async () => {
    server.use(http.get("/api/whatsapp/assistant-agent/test-recipients", () => HttpResponse.json({ items: [{ contactId: juan, name: "Juan Gómez", email: null }] })),
      http.post("/api/whatsapp/assistant-agent/tests", () => new HttpResponse(null, { status: 403 })));
    await open();
    await userEvent.click(within(header()).getByRole("button", { name: "Probar" }));
    const panel = await screen.findByRole("dialog", { name: "Probar el asistente" });
    await chooseRecipient(panel);
    await userEvent.click(within(panel).getByRole("textbox", { name: "Mensajes" }));
    await userEvent.paste("Hola");
    permissions = ["whatsapp.configureassistant", "ai.business.manage", "formtemplates.manage"];
    await userEvent.click(within(panel).getByRole("button", { name: "Probar" }));
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "Probar el asistente" })).not.toBeInTheDocument());
    expect(within(header()).getByRole("button", { name: "Probar" })).toHaveAccessibleDescription("Para probar el asistente hace falta poder ver los chats de WhatsApp.");
  });

  // H4: the assistant reads the real chat of the account, so Probar is for someone who reads WhatsApp chats.
  it("turns Probar off with its reason for someone who does not read WhatsApp chats", async () => {
    permissions = ["whatsapp.configureassistant", "ai.business.manage", "formtemplates.manage"];
    await open();
    const button = within(header()).getByRole("button", { name: "Probar" });
    expect(button).toHaveAttribute("aria-disabled", "true");
    expect(button).toHaveAccessibleDescription("Para probar el asistente hace falta poder ver los chats de WhatsApp.");
    await userEvent.click(button);
    expect(screen.queryByRole("dialog", { name: "Probar el asistente" })).not.toBeInTheDocument();
  });
});
