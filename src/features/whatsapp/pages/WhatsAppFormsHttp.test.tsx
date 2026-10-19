import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HttpResponse, http } from "msw";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { whatsappFormsHttpBody, whatsappFormsHttpJson } from "@/test/fixtures/whatsappFormsHttp";
import { currentUser } from "@/test/mocks/handlers";
import { server } from "@/test/mocks/server";
import { renderRouteWithProviders } from "@/test/utils/renderWithProviders";
import { queryClient } from "@/shared/api/queryClient";
import type { Outgoing, Thread } from "../api/chat";
import type { ChatForms } from "../api/forms";
import type { FormMessageRequest } from "../lib/formSendSession";

vi.mock("react-oidc-context", async () => ({ ...(await vi.importActual<typeof import("react-oidc-context")>("react-oidc-context")), useAuth: () => ({ isAuthenticated:true, isLoading:false, user:{access_token:"t"} }) }));

for (const culture of ["es", "en"] as const) describe("WhatsApp pages with actual HTTP bodies " + culture, () => {
  const json = <T,>(name: string) => whatsappFormsHttpJson<T>(culture, name);
  const response = (name: string, status = 200) => new HttpResponse(whatsappFormsHttpBody(culture, name), {status, headers:{"Content-Type":"application/json"}});
  const receipt = json<Outgoing>("send-pending");
  const choices = json<ChatForms>("choices");
  const selected = choices.page.items[0]!;
  let threadName: string;
  let posts: FormMessageRequest[];
  let textPosts: number;
  let reviews: number;

  function configure(name = "thread-before-send", actor = receipt.operatorUserId) {
    threadName = name;
    const thread = json<Thread>(name);
    vi.useFakeTimers({toFake:["Date"]});
    vi.setSystemTime(new Date(thread.contact.lastInboundAtUtc));
    server.use(
      http.get("/api/me", () => HttpResponse.json({...currentUser,id:actor,permissions:["whatsapp.read","whatsapp.send"]})),
      // Only the inbox envelope/session are doubles; all form and thread responses are raw captures.
      http.get("/api/whatsapp/chats", () => HttpResponse.json({page:{items:[thread.contact],page:1,pageSize:20,totalPages:1,totalCount:1},allCount:1,unreadCount:0})),
      http.get("/api/whatsapp/chats/:id/messages", () => response(threadName)),
      http.put("/api/whatsapp/chats/:id/read", () => new HttpResponse(null,{status:204})),
      http.get("/api/whatsapp/chats/:id/forms", () => response("choices")),
      http.get("/api/whatsapp/chats/:id/forms/:definitionId/versions/:versionId/preparation", () => response("preparation")),
      http.post("/api/whatsapp/chats/:id/form-messages", async ({request}) => {
        posts.push(await request.json() as FormMessageRequest);
        threadName = "thread-pending";
        return response("send-pending",202);
      }),
      http.post("/api/whatsapp/chats/:id/messages", () => { textPosts++; return HttpResponse.error(); }),
      http.post("/api/whatsapp/chats/:id/outgoing/:requestId/review", () => { reviews++; return HttpResponse.error(); }),
    );
    return thread;
  }
  async function open(name = "thread-before-send", actor = receipt.operatorUserId) {
    const thread = configure(name,actor);
    const view = renderRouteWithProviders("/whatsapp/chat");
    await userEvent.click(await screen.findByRole("button",{name:thread.contact.profileName!}));
    await screen.findByLabelText("Respuesta al cliente");
    return view;
  }
  async function choose() {
    await open();
    await userEvent.click(screen.getByRole("button",{name:"Enviar formulario"}));
    const dialog = await screen.findByRole("dialog");
    await userEvent.click(await within(dialog).findByRole("radio",{name:selected.name[culture]}));
    await waitFor(() => expect(within(dialog).getByRole("button", {name:"Enviar formulario"})).toBeEnabled());
    return dialog;
  }
  beforeEach(() => { queryClient.clear(); posts=[]; textPosts=0; reviews=0; });
  afterEach(() => { queryClient.clear(); vi.useRealTimers(); vi.restoreAllMocks(); });

  it("selects the real sealed version and accepts its exact request without a text POST", async () => {
    vi.spyOn(crypto,"randomUUID").mockReturnValue(receipt.requestId as ReturnType<Crypto["randomUUID"]>);
    const dialog = await choose();
    expect(within(dialog).getByText("Versión 1 · 1 pregunta",{exact:true})).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Respuesta al cliente"),{target:{value:"Borrador privado de texto"}});
    fireEvent.change(within(dialog).getByRole("textbox",{name:"Mensaje que lo acompaña"}),{target:{value:receipt.body}});
    await userEvent.click(within(dialog).getByRole("button",{name:"Enviar formulario"}));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(posts).toEqual([{requestId:receipt.requestId,definitionId:selected.definitionId,versionId:selected.versionId,
      expectedModeRevision:json<Thread>("thread-before-send").contact.modeRevision,
      expectedRecipientContextRevision:choices.recipientContextRevision,message:receipt.body}]);
    expect(await screen.findByText("En cola")).toBeInTheDocument();
    expect(screen.getByLabelText("Respuesta al cliente")).toHaveValue("Borrador privado de texto");
    expect(textPosts).toBe(0);
  });
  it("restores the queued card after a fresh page load without a private form draft", async () => {
    await open("thread-pending");
    expect(await screen.findByText("En cola")).toBeInTheDocument();
    expect(screen.getByLabelText("Respuesta al cliente")).toHaveValue("");
    expect(screen.getByText(selected.name[culture])).toBeInTheDocument();
    expect(posts).toEqual([]);
  });
  it("restores exactly one confirmed card from reloaded history without claiming delivery", async () => {
    await open("thread-reloaded");
    expect(screen.queryByText("Entregado",{exact:true})).not.toBeInTheDocument();
    expect(screen.getAllByText(selected.name[culture])).toHaveLength(1);
    expect(screen.getByLabelText("Respuesta al cliente")).toHaveValue("");
    expect(posts).toEqual([]);
  });
  it("keeps Failed as a form card and never offers its message as an ordinary text draft", async () => {
    await open("thread-failed");
    expect(screen.queryByRole("button",{name:"Usar este texto en el borrador"})).not.toBeInTheDocument();
    expect(screen.getByText(selected.name[culture])).toBeInTheDocument();
    expect(screen.queryByText("Entregado",{exact:true})).not.toBeInTheDocument();
    expect(textPosts).toBe(0);
  });
  it("keeps the Uncertain card and requires confirmation before reviewing the owned operation", async () => {
    await open("thread-uncertain");
    await userEvent.click(screen.getByRole("button",{name:"Ya revisé el WhatsApp"}));
    expect(await screen.findByRole("dialog")).toBeInTheDocument();
    expect(reviews).toBe(0);
    expect(posts).toEqual([]);
    expect(screen.queryByText("Entregado",{exact:true})).not.toBeInTheDocument();
    expect(screen.getByText(selected.name[culture])).toBeInTheDocument();
  });
  it("hides review from another operator while reading the same actual Uncertain thread", async () => {
    await open("thread-uncertain","019abcde-1000-7000-8000-000000000099");
    expect(screen.queryByRole("button",{name:"Ya revisé el WhatsApp"})).not.toBeInTheDocument();
    expect(screen.queryByText("Entregado",{exact:true})).not.toBeInTheDocument();
    expect(reviews).toBe(0);
  });
  it.each(["send-context-changed","send-version-unavailable"])("preserves the edited message on actual conflict %s", async name => {
    const dialog = await choose();
    const message = within(dialog).getByRole("textbox",{name:"Mensaje que lo acompaña"});
    fireEvent.change(message,{target:{value:"Mensaje privado conservado"}});
    server.use(http.post("/api/whatsapp/chats/:id/form-messages", async ({request}) => {
      posts.push(await request.json() as FormMessageRequest);return response(name,409);
    }));
    await userEvent.click(within(dialog).getByRole("button",{name:"Enviar formulario"}));
    await waitFor(() => expect(within(dialog).getByRole("button",{name:"Enviar formulario"})).toBeDisabled());
    expect(message).toHaveValue("Mensaje privado conservado");
    expect(posts).toHaveLength(1);
    expect(textPosts).toBe(0);
  });
  it("removes selection metadata when the actual selector response forbids access", async () => {
    await open();
    server.use(http.get("/api/whatsapp/chats/:id/forms", () => response("choices-forbidden",403)));
    await userEvent.click(screen.getByRole("button",{name:"Enviar formulario"}));
    const dialog = await screen.findByRole("dialog");
    expect(await within(dialog).findByText("Ya no tenés permiso para esta acción.")).toBeInTheDocument();
    expect(within(dialog).getByRole("button",{name:"Enviar formulario"})).toBeDisabled();
    expect(within(dialog).queryByRole("radio")).not.toBeInTheDocument();
    expect(within(dialog).queryByText(selected.name[culture])).not.toBeInTheDocument();
    expect(posts).toEqual([]);
  });
});
