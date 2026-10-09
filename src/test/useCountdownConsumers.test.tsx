import { act, cleanup, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HttpResponse, http } from "msw";
import type { ReactNode } from "react";
import { MemoryRouter } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { EmailCodeForm } from "@/features/auth/components/EmailCodeForm";
import { WhatsAppCodeForm } from "@/features/auth/components/WhatsAppCodeForm";
import { queryClient } from "@/shared/api/queryClient";
import { VerifyDestinationDialog } from "@/shared/ui/VerifyDestinationDialog";
import { server } from "./mocks/server";
import { renderRouteWithProviders, renderWithProviders } from "./utils/renderWithProviders";

vi.mock("react-oidc-context", async () => {
  const actual = await vi.importActual<typeof import("react-oidc-context")>("react-oidc-context");

  return {
    ...actual,
    AuthProvider: ({ children }: { children?: ReactNode }) => <>{children}</>,
    useAuth: () => ({ isAuthenticated: false, isLoading: false, user: undefined }),
  };
});

const returnUrl = "/connect/authorize?client_id=web";
const token = "k7Qe2xV9-mB4_tLp0ZrH8sWc1YnJ6fGa3DuK5oXiE2q";
const phone = "+5491123456789";
const maskedPhone = "+54 9 11 •••• 6789";

describe("countdown consumers after a suspended tab", () => {
  let monotonicNow = 0;

  beforeEach(() => {
    queryClient.clear();
    monotonicNow = 0;
    vi.spyOn(performance, "now").mockImplementation(() => monotonicNow);
    vi.spyOn(document, "visibilityState", "get").mockReturnValue("visible");
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  function resumeAfter(seconds: number) {
    act(() => {
      monotonicNow += seconds * 1000;
      document.dispatchEvent(new Event("visibilitychange"));
    });
  }

  it.each(["email", "whatsapp"])("allows LoginCodePage to resend %s after the original deadline", async (channel) => {
    renderRouteWithProviders(`/login/codigo?returnUrl=${encodeURIComponent(returnUrl)}`, {
      state: channel === "email"
        ? { channel, email: "ana@example.com", resendAfterSeconds: 45 }
        : { channel, phone, maskedPhone, resendAfterSeconds: 45 },
    });

    expect(await screen.findByRole("button", { name: "Reenviar en 45 s" })).toBeDisabled();

    resumeAfter(45);

    expect(screen.getByRole("button", { name: "Reenviar código" })).toBeEnabled();
  });

  it("allows LoginLinkPage to retry a preview after its cooldown without an automatic request", async () => {
    let previews = 0;
    server.use(http.post("/account/login-link/preview", () => {
      previews += 1;

      return HttpResponse.json({
        status: 429,
        code: "Http.TooManyRequests",
        detail: "Esperá antes de intentar de nuevo.",
        retryAfter: 45,
      }, { status: 429 });
    }));
    globalThis.history.replaceState(null, "", `/ingresar#t=${token}`);
    renderRouteWithProviders("/ingresar");

    expect(await screen.findByRole("button", { name: "Reintentá en 45 s" })).toBeDisabled();

    resumeAfter(45);

    expect(screen.getByRole("button", { name: "Reintentar" })).toBeEnabled();
    expect(previews).toBe(1);
  });

  it.each(["email", "whatsapp"])("preserves the %s request draft while its cooldown expires", async (channel) => {
    const endpoint = channel === "email" ? "/account/login-code" : "/account/login-code/whatsapp";
    let requests = 0;
    server.use(http.post(endpoint, () => {
      requests += 1;

      return HttpResponse.json({
        status: 429,
        code: "Auth.LoginCode.TooManyRequests",
        detail: "Pediste demasiados códigos. Probá de nuevo más tarde.",
        retryAfter: 45,
      }, { status: 429 });
    }));

    renderWithProviders(
      <MemoryRouter>
        {channel === "email"
          ? <EmailCodeForm returnUrl={returnUrl} onSubmitStart={() => {}} />
          : <WhatsAppCodeForm returnUrl={returnUrl} countries={["AR"]} onSubmitStart={() => {}} />}
      </MemoryRouter>,
    );
    const value = channel === "email" ? "ana@example.com" : "11 2345-6789";
    const field = screen.getByRole("textbox", { name: channel === "email" ? "Correo electrónico" : "Número de WhatsApp" });
    await userEvent.type(field, value);
    await userEvent.click(screen.getByRole("button", { name: "Enviar código" }));
    expect(await screen.findByRole("button", { name: "Reintentá en 45 s" })).toBeDisabled();

    resumeAfter(45);

    expect(screen.getByRole("button", { name: "Enviar código" })).toBeEnabled();
    expect(field).toHaveValue(value);
    expect(requests).toBe(1);
  });

  it.each(["email", "whatsapp"])("lets the shared %s destination dialog resend and restart its deadline", async (channel) => {
    const endpoint = channel === "email" ? "/api/me/email/code" : "/api/me/whatsapp/code";
    let requests = 0;
    server.use(http.post(endpoint, () => {
      requests += 1;

      return HttpResponse.json({ resendAfterSeconds: 45, phone, maskedPhone }, { status: 202 });
    }));
    renderWithProviders(channel === "email"
      ? <VerifyDestinationDialog channel="email" onClose={() => {}} />
      : <VerifyDestinationDialog channel="whatsapp" countries={["AR"]} onClose={() => {}} />);

    const dialog = await screen.findByRole("dialog");
    await userEvent.type(within(dialog).getByRole("textbox", {
      name: channel === "email" ? "Correo electrónico" : "Número de WhatsApp",
    }), channel === "email" ? "ana@example.com" : "11 2345-6789");
    await userEvent.click(within(dialog).getByRole("button", { name: "Enviar código" }));
    expect(await within(dialog).findByRole("button", { name: "Reenviar en 45 s" })).toBeDisabled();

    resumeAfter(45);

    expect(within(dialog).getByRole("button", { name: "Reenviar código" })).toBeEnabled();
    expect(requests).toBe(1);

    await userEvent.click(within(dialog).getByRole("button", { name: "Reenviar código" }));

    expect(await within(dialog).findByRole("button", { name: "Reenviar en 45 s" })).toBeDisabled();
    expect(requests).toBe(2);
    resumeAfter(44);
    expect(within(dialog).getByRole("button", { name: "Reenviar en 1 s" })).toBeDisabled();
    resumeAfter(1);
    expect(within(dialog).getByRole("button", { name: "Reenviar código" })).toBeEnabled();
  });
});
