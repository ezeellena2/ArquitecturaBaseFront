import { focusManager } from "@tanstack/react-query";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HttpResponse, http } from "msw";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CurrentUser } from "@/auth/useCurrentUser";
import { loginMethodsQueryKey, type LoginMethods } from "@/shared/api/loginMethods";
import { queryClient } from "@/shared/api/queryClient";
import { loginMethods, phoneOnlyUser, whatsappLoginMethods } from "@/test/mocks/handlers";
import { server } from "@/test/mocks/server";
import { renderRouteWithProviders } from "@/test/utils/renderWithProviders";
import type { WhatsAppChat } from "../api/whatsappChat";

vi.mock("react-oidc-context", async () => {
  const actual = await vi.importActual<typeof import("react-oidc-context")>("react-oidc-context");

  return { ...actual, useAuth: () => ({ isAuthenticated: true, isLoading: false, user: { access_token: "t" } }) };
});

/// Una cuenta con el número confirmado y también un correo, para que «Desvincular» no se apague.
const withNumber: CurrentUser = { ...phoneOnlyUser, email: "ana@example.com", emailConfirmed: true };

function withChat(chat: WhatsAppChat | (() => WhatsAppChat), user: CurrentUser = withNumber, methods: LoginMethods = whatsappLoginMethods) {
  server.use(
    http.get("/api/me", () => HttpResponse.json(user)),
    http.get("/account/login-methods", () => HttpResponse.json(methods)),
    http.get("/api/me/whatsapp", () => HttpResponse.json(typeof chat === "function" ? chat() : chat)),
  );
}

/// La zona «Chat de WhatsApp», ya con el estado del chat leído.
async function openChat() {
  renderRouteWithProviders("/perfil");

  return within(await screen.findByRole("region", { name: "Chat de WhatsApp" }));
}

describe("WhatsAppChatCard", () => {
  beforeEach(() => {
    queryClient.clear();
  });

  /// El caso de la prueba completa del 2026-11-03 (tablero PF2): el número dice «Verificado», pero su chat quedó suelto.
  it("says the chat of a verified number is not linked and offers to link it", async () => {
    withChat({ state: "NotLinked", noticesUntilUtc: null });

    const chat = await openChat();

    expect(await chat.findByText("Sin vincular")).toBeInTheDocument();
    expect(chat.getByRole("button", { name: "Vincular" })).toBeEnabled();
    expect(chat.getByText("No llegan")).toBeInTheDocument();
    expect(chat.queryByRole("link", { name: /Abrir el chat/ })).not.toBeInTheDocument();
  });

  it("links the chat by confirming the account's number with a code, and reads it again", async () => {
    const user = userEvent.setup();
    let state: WhatsAppChat = { state: "NotLinked", noticesUntilUtc: null };
    const asked: unknown[] = [];
    withChat(() => state);
    server.use(
      http.post("/api/me/whatsapp/code", async ({ request }) => {
        asked.push(await request.json());

        return HttpResponse.json(
          { resendAfterSeconds: 60, phone: withNumber.phoneNumber, maskedPhone: withNumber.maskedPhoneNumber },
          { status: 202 },
        );
      }),
      http.put("/api/me/whatsapp", () => {
        state = { state: "Linked", noticesUntilUtc: null };

        return new HttpResponse(null, { status: 204 });
      }),
    );

    const chat = await openChat();
    await user.click(await chat.findByRole("button", { name: "Vincular" }));
    const dialog = await screen.findByRole("dialog", { name: "Vincular el chat" });
    await user.click(within(dialog).getByRole("button", { name: "Enviar código" }));
    await user.type(await within(dialog).findByRole("textbox", { name: "Código 1" }), "123456");
    await user.click(within(dialog).getByRole("button", { name: "Verificar" }));

    expect(await chat.findByText("Vinculado")).toBeInTheDocument();
    expect(asked).toEqual([{ country: "AR", number: withNumber.phoneNumber }]);
    expect(await screen.findByText("Vinculamos el chat.")).toBeInTheDocument();
  });

  it("says until when the notices arrive, in the time zone of the profile", async () => {
    withChat({ state: "Linked", noticesUntilUtc: "2026-11-04T00:40:00Z" });

    const chat = await openChat();

    expect(await chat.findByText("Vinculado")).toBeInTheDocument();
    expect(chat.getByText("Llegan hasta el 3 nov 2026, 21:40")).toBeInTheDocument();
    expect(chat.queryByRole("button", { name: "Vincular" })).not.toBeInTheDocument();
  });

  it("says the notices are paused without a message in the last day, and opens the chat to send one", async () => {
    withChat({ state: "Linked", noticesUntilUtc: null });

    const chat = await openChat();

    expect(await chat.findByText("Pausados")).toBeInTheDocument();
    const open = chat.getByRole("link", { name: /Abrir el chat/ });
    expect(open).toHaveAttribute("href", "https://wa.me/15551632662?text=Hola");
    expect(open).toHaveAttribute("target", "_blank");
  });

  /// Un mensaje nunca vincula: primero se escribe, y después «Vincular» confirma el número.
  it("offers to open the chat, not to link it, when the number never wrote", async () => {
    withChat({ state: "NoChat", noticesUntilUtc: null });

    const chat = await openChat();

    expect(await chat.findByText("Sin chat todavía")).toBeInTheDocument();
    expect(chat.getByRole("link", { name: /Abrir el chat/ })).toBeInTheDocument();
    expect(chat.queryByRole("button", { name: "Vincular" })).not.toBeInTheDocument();
  });

  it("reads the chat again when the person comes back to the tab", async () => {
    let state: WhatsAppChat = { state: "NoChat", noticesUntilUtc: null };
    withChat(() => state);

    const chat = await openChat();
    expect(await chat.findByText("Sin chat todavía")).toBeInTheDocument();

    state = { state: "NotLinked", noticesUntilUtc: null };
    focusManager.setFocused(false);
    focusManager.setFocused(true);

    expect(await chat.findByText("Sin vincular")).toBeInTheDocument();
    focusManager.setFocused(undefined);
  });

  it("says so when the chat cannot be read, and reads it again on Retry", async () => {
    const user = userEvent.setup();
    let fail = true;
    withChat({ state: "NotLinked", noticesUntilUtc: null });
    server.use(http.get("/api/me/whatsapp", () => (fail
      ? HttpResponse.json({ status: 500, traceId: "chat" }, { status: 500 })
      : HttpResponse.json({ state: "NotLinked", noticesUntilUtc: null }))));

    const chat = await openChat();
    expect(await chat.findByRole("alert")).toHaveTextContent("No pudimos cargar los datos");

    fail = false;
    await user.click(chat.getByRole("button", { name: "Reintentar" }));

    expect(await chat.findByText("Sin vincular")).toBeInTheDocument();
  });

  it("is not there without a verified number", async () => {
    withChat({ state: "NoChat", noticesUntilUtc: null }, { ...withNumber, phoneNumberConfirmed: false });

    renderRouteWithProviders("/perfil");
    await screen.findByRole("region", { name: "Medios de ingreso" });
    await waitFor(() => expect(queryClient.getQueryState(loginMethodsQueryKey)?.status).toBe("success"));

    expect(screen.queryByRole("region", { name: "Chat de WhatsApp" })).not.toBeInTheDocument();
  });

  it("is not there with WhatsApp off", async () => {
    withChat({ state: "NoChat", noticesUntilUtc: null }, withNumber, loginMethods);

    renderRouteWithProviders("/perfil");
    await screen.findByRole("region", { name: "Medios de ingreso" });
    await waitFor(() => expect(queryClient.getQueryState(loginMethodsQueryKey)?.status).toBe("success"));

    expect(screen.queryByRole("region", { name: "Chat de WhatsApp" })).not.toBeInTheDocument();
  });
});
