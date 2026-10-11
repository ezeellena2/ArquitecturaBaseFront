import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HttpResponse, http } from "msw";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { whatsappFormsHttpBody, whatsappFormsHttpJson } from "@/test/fixtures/whatsappFormsHttp";
import { currentUser } from "@/test/mocks/handlers";
import { server } from "@/test/mocks/server";
import { renderRouteWithProviders } from "@/test/utils/renderWithProviders";
import { queryClient } from "@/shared/api/queryClient";
import type { Thread } from "../api/chat";

vi.mock("react-oidc-context", async () => ({ ...(await vi.importActual<typeof import("react-oidc-context")>("react-oidc-context")),
  useAuth: () => ({ isAuthenticated: true, isLoading: false, user: { access_token: "t" } }) }));

for (const culture of ["es", "en"] as const) describe("chat account privacy with actual HTTP " + culture, () => {
  async function open(name: string, permissions: string[]) {
    const thread = whatsappFormsHttpJson<Thread>(culture, name);
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date(thread.contact.lastInboundAtUtc));
    server.use(
      http.get("/api/me", () => HttpResponse.json({ ...currentUser, permissions })),
      // Session and inbox envelope are doubles; the thread is unchanged controller output.
      http.get("/api/whatsapp/chats", () => HttpResponse.json({ page: { items: [thread.contact], page: 1, pageSize: 20, totalPages: 1, totalCount: 1 }, allCount: 1, unreadCount: 0 })),
      http.get("/api/whatsapp/chats/:id/messages", () => new HttpResponse(whatsappFormsHttpBody(culture, name), { headers: { "Content-Type": "application/json" } })),
      http.put("/api/whatsapp/chats/:id/read", () => new HttpResponse(null, { status: 204 })),
    );
    renderRouteWithProviders("/whatsapp/chat");
    await userEvent.click(await screen.findByRole("button", { name: thread.contact.profileName! }));
    await screen.findByLabelText("Respuesta al cliente");
    return thread;
  }
  beforeEach(() => queryClient.clear());
  afterEach(() => { queryClient.clear(); vi.useRealTimers(); vi.restoreAllMocks(); });

  it("reads a real null-metadata thread without presenting an absent account", async () => {
    const thread = await open("thread-read-only", ["whatsapp.read"]);
    expect(thread.contact.linkedAccount).toBeNull();
    expect(thread.contact.formEligibility).toBeNull();
    expect(screen.queryByText("Número sin cuenta vinculada")).not.toBeInTheDocument();
    expect(screen.queryByText(/Cuenta vinculada/)).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Enviar formulario" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Enviar" })).not.toBeInTheDocument();
    expect(screen.getByLabelText("Respuesta al cliente")).toBeDisabled();
  });
  it("keeps sending eligible without inferring the hidden email is absent", async () => {
    const thread = await open("thread-send-without-users-read", ["whatsapp.read", "whatsapp.send"]);
    expect(thread.contact.linkedAccount?.email).toBeNull();
    expect(thread.contact.formEligibility?.status).toBe("Eligible");
    expect(screen.getByText("Cuenta vinculada: " + thread.contact.linkedAccount!.displayName)).toBeInTheDocument();
    expect(screen.queryByText(/sin correo/)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Enviar formulario" })).toBeEnabled();
  });
  it("presents the email only when the captured response and permission allow it", async () => {
    const thread = await open("thread-send-with-users-read", ["whatsapp.read", "whatsapp.send", "users.read"]);
    expect(thread.contact.linkedAccount?.email).toBeTypeOf("string");
    expect(screen.getByText("Cuenta vinculada: " + thread.contact.linkedAccount!.email)).toBeInTheDocument();
    expect(screen.queryByText(/sin correo/)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Enviar formulario" })).toBeEnabled();
  });
});
