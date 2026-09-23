import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HttpResponse, http } from "msw";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { queryClient } from "@/shared/api/queryClient";
import { loginMethods } from "@/test/mocks/handlers";
import { renderRouteWithProviders } from "@/test/utils/renderWithProviders";
import { server } from "@/test/mocks/server";

const assign = vi.fn();

vi.stubGlobal("location", { ...globalThis.location, assign, origin: "https://localhost:5173" });

// Solo hace falta para el caso sin returnUrl, que termina en /login y ahí dispara el redirect de OIDC
// (LoginPage). El AuthProvider real llamaría a la Api de verdad para arrancarlo; acá no importa que lo haga,
// solo que se intente, así que se reemplaza por un espía como en ProtectedRoute.test.tsx.
const signinRedirect = vi.fn().mockResolvedValue(undefined);

vi.mock("react-oidc-context", async () => {
  const actual = await vi.importActual<typeof import("react-oidc-context")>("react-oidc-context");

  return {
    ...actual,
    AuthProvider: ({ children }: { children?: ReactNode }) => <>{children}</>,
    useAuth: () => ({ isAuthenticated: false, isLoading: false, user: undefined, signinRedirect }),
  };
});

const returnUrl = "/connect/authorize?client_id=web";
const codeUrl = `/login/codigo?returnUrl=${encodeURIComponent(returnUrl)}`;
const loginUrl = `/login?returnUrl=${encodeURIComponent(returnUrl)}`;

/// Lo que deja `LoginPage` en el estado de la ruta después de pedir el código por WhatsApp.
const whatsappState = {
  channel: "whatsapp",
  phone: "+5491123456789",
  maskedPhone: "+54 9 11 •••• 6789",
  resendAfterSeconds: 45,
};

async function typeCodeAndVerify(code: string) {
  await userEvent.type(screen.getAllByRole("textbox")[0], code);
  await userEvent.click(screen.getByRole("button", { name: /verificar/i }));
}

function verifyFailsWith(status: number, problem: Record<string, unknown>) {
  server.use(http.post("/account/login-code/verify", () => HttpResponse.json({ status, ...problem }, { status })));
}

describe("LoginCodePage", () => {
  // "Usar otro número" vuelve a /login, que pide los medios de ingreso con el queryClient de la app.
  beforeEach(() => {
    queryClient.clear();
    assign.mockClear();
  });

  it("verifies the code and goes to the authorize request", async () => {
    server.use(
      http.post("/account/login-code/verify", () => HttpResponse.json({ returnUrl })),
    );
    renderRouteWithProviders(`/login/codigo?returnUrl=${encodeURIComponent(returnUrl)}`, {
      state: { email: "ana@example.com" },
    });

    await userEvent.type(screen.getAllByRole("textbox")[0], "482913");
    await userEvent.click(screen.getByRole("button", { name: /verificar/i }));

    await waitFor(() => expect(assign).toHaveBeenCalledWith(returnUrl));
  });

  it("shows the message and the attempts left when the code is wrong", async () => {
    server.use(
      http.post("/account/login-code/verify", () =>
        HttpResponse.json(
          { status: 400, code: "Auth.LoginCode.Invalid", detail: "El código no es válido.", attemptsLeft: 4 },
          { status: 400 },
        ),
      ),
    );
    renderRouteWithProviders(`/login/codigo?returnUrl=${encodeURIComponent(returnUrl)}`, {
      state: { email: "ana@example.com" },
    });

    await userEvent.type(screen.getAllByRole("textbox")[0], "000000");
    await userEvent.click(screen.getByRole("button", { name: /verificar/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent("El código no es válido.");
    expect(screen.getByText(/te quedan 4 intentos/i)).toBeInTheDocument();
  });

  it("waits before letting the code be sent again", async () => {
    renderRouteWithProviders(`/login/codigo?returnUrl=${encodeURIComponent(returnUrl)}`, {
      state: { email: "ana@example.com", resendAfterSeconds: 60 },
    });

    expect(screen.getByRole("button", { name: /reenviar/i })).toBeDisabled();
  });

  it("without returnUrl in the query, does not show the code form and goes through /login", async () => {
    renderRouteWithProviders("/login/codigo");

    // Sin returnUrl no hay contexto del flujo: nunca se ve el formulario del código...
    expect(screen.queryAllByRole("textbox")).toHaveLength(0);
    // ...y termina en /login sin returnUrl, que es lo que arranca el redirect de OIDC.
    await waitFor(() => expect(signinRedirect).toHaveBeenCalledTimes(1));
  });

  it("goes back to /login when nobody asked for a code first", async () => {
    const { router } = renderRouteWithProviders(codeUrl);

    await waitFor(() => expect(router.state.location.pathname).toBe("/login"));
    expect(router.state.location.search).toBe(`?returnUrl=${encodeURIComponent(returnUrl)}`);
  });

  it.each([
    ["Auth.Account.NotInvited", "Todavía no tenés acceso al sistema. Pedile a un administrador que te dé de alta."],
    ["Auth.Account.Disabled", "Tu cuenta está deshabilitada. Contactá a un administrador."],
  ])("ends the attempt when the account can not sign in (%s)", async (code, detail) => {
    verifyFailsWith(403, { code, detail });
    renderRouteWithProviders(codeUrl, { state: { email: "ana@example.com" } });

    await typeCodeAndVerify("482913");

    expect(await screen.findByRole("alert")).toHaveTextContent(detail);
    // Un reintento cambiaría el mensaje por "El código ya se usó": no hay nada más que hacer acá.
    expect(screen.getByRole("button", { name: /verificar/i })).toBeDisabled();
    expect(screen.getByRole("button", { name: /reenviar/i })).toBeDisabled();
    expect(screen.getByRole("link", { name: "Volver a ingresar" })).toHaveAttribute("href", loginUrl);
  });

  describe("with WhatsApp", () => {
    it("says the code went to WhatsApp, to which number and where it shows up", async () => {
      renderRouteWithProviders(codeUrl, { state: whatsappState });

      expect(await screen.findByRole("heading", { name: "Revisá tu WhatsApp" })).toBeInTheDocument();
      expect(screen.getByRole("link", { name: "Usar otro número" })).toHaveAttribute("href", loginUrl);

      // El número va resaltado dentro de la frase.
      const number = screen.getByText("+54 9 11 •••• 6789");
      expect(number.tagName).toBe("STRONG");
      expect(number.parentElement).toHaveTextContent(
        "Te mandamos un código al +54 9 11 •••• 6789. Vence en 10 minutos.",
      );

      expect(screen.getByRole("group", { name: "Código" })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Verificar" })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Reenviar en 45 s" })).toBeDisabled();
      expect(screen.getByText("Llega al WhatsApp de tu celular. En WhatsApp Web no se muestra.")).toBeInTheDocument();
      expect(screen.queryByText(/revisá tu correo/i)).not.toBeInTheDocument();
    });

    it("goes back to /login with WhatsApp chosen to use another number", async () => {
      server.use(
        http.get("/account/login-methods", () =>
          HttpResponse.json({ ...loginMethods, whatsapp: true, whatsappCountries: ["AR"] }),
        ),
      );
      renderRouteWithProviders(codeUrl, { state: whatsappState });

      await userEvent.click(await screen.findByRole("link", { name: "Usar otro número" }));

      expect(await screen.findByRole("textbox", { name: "Número de WhatsApp" })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "WhatsApp" })).toHaveAttribute("aria-pressed", "true");
    });

    it("verifies with the number, not with an email", async () => {
      const bodies: unknown[] = [];
      server.use(
        http.post("/account/login-code/verify", async ({ request }) => {
          bodies.push(await request.json());

          return HttpResponse.json({ returnUrl });
        }),
      );
      renderRouteWithProviders(codeUrl, { state: whatsappState });

      await typeCodeAndVerify("482913");

      await waitFor(() => expect(assign).toHaveBeenCalledWith(returnUrl));
      expect(bodies).toEqual([{ phone: "+5491123456789", code: "482913", returnUrl }]);
    });

    it("sends the code again by WhatsApp, to the same number", async () => {
      const bodies: unknown[] = [];
      server.use(
        http.post("/account/login-code/whatsapp", async ({ request }) => {
          bodies.push(await request.json());

          return HttpResponse.json(
            { resendAfterSeconds: 60, phone: "+5491123456789", maskedPhone: "+54 9 11 •••• 6789" },
            { status: 202 },
          );
        }),
      );
      renderRouteWithProviders(codeUrl, { state: { ...whatsappState, resendAfterSeconds: 0 } });

      await userEvent.click(await screen.findByRole("button", { name: "Reenviar código" }));

      expect(await screen.findByRole("button", { name: "Reenviar en 60 s" })).toBeDisabled();
      // En formato internacional: con el "+", el servidor no necesita el país.
      expect(bodies).toEqual([{ number: "+5491123456789" }]);
    });

    it("shows the error and the attempts left above Verificar, with Reenviar código available", async () => {
      verifyFailsWith(400, { code: "Auth.LoginCode.Invalid", detail: "El código no es válido.", attemptsLeft: 3 });
      renderRouteWithProviders(codeUrl, { state: { ...whatsappState, resendAfterSeconds: 0 } });

      await typeCodeAndVerify("482915");

      const alert = await screen.findByRole("alert");
      expect(alert).toHaveTextContent("El código no es válido.");
      expect(alert).toHaveTextContent("Te quedan 3 intentos");
      expect(alert.compareDocumentPosition(screen.getByRole("button", { name: "Verificar" }))).toBe(
        Node.DOCUMENT_POSITION_FOLLOWING,
      );
      expect(screen.getByRole("button", { name: "Reenviar código" })).toBeEnabled();

      // Las casillas se marcan en error, como en el tablero, y vuelven a la normalidad al escribir otro código.
      const boxes = screen.getAllByRole("textbox", { name: /^Código \d$/u });
      expect(boxes).toHaveLength(6);
      for (const box of boxes) {
        expect(box).toHaveAttribute("aria-invalid", "true");
      }

      boxes[0].focus();
      await userEvent.paste("482913");

      for (const box of screen.getAllByRole("textbox", { name: /^Código \d$/u })) {
        expect(box).not.toHaveAttribute("aria-invalid");
      }
    });

    it("says the last attempt in singular", async () => {
      verifyFailsWith(400, { code: "Auth.LoginCode.Invalid", detail: "El código no es válido.", attemptsLeft: 1 });
      renderRouteWithProviders(codeUrl, { state: { ...whatsappState, resendAfterSeconds: 0 } });

      await typeCodeAndVerify("482915");

      expect(await screen.findByRole("alert")).toHaveTextContent("Te queda 1 intento");
    });

    it.each([
      ["Auth.LoginCode.Expired", "El código venció. Pedí uno nuevo."],
      ["Auth.LoginCode.AlreadyUsed", "El código ya se usó. Pedí uno nuevo."],
    ])("shows the server text when the code can not be used (%s)", async (code, detail) => {
      verifyFailsWith(400, { code, detail });
      renderRouteWithProviders(codeUrl, { state: { ...whatsappState, resendAfterSeconds: 0 } });

      await typeCodeAndVerify("482913");

      expect(await screen.findByRole("alert")).toHaveTextContent(detail);
      expect(screen.getByRole("button", { name: "Reenviar código" })).toBeEnabled();
    });

    it.each([
      [
        "Auth.LoginCode.TooManyAttempts",
        400,
        "Superaste los intentos para este código. Pedí uno nuevo.",
      ],
      [
        "Auth.Account.LockedOut",
        429,
        "Tu cuenta está bloqueada por unos minutos por demasiados intentos fallidos.",
      ],
    ])("offers a new code, back in /login with WhatsApp, when this one is spent (%s)", async (code, status, detail) => {
      server.use(
        http.get("/account/login-methods", () =>
          HttpResponse.json({ ...loginMethods, whatsapp: true, whatsappCountries: ["AR"] }),
        ),
      );
      verifyFailsWith(status, { code, detail });
      renderRouteWithProviders(codeUrl, { state: whatsappState });

      await typeCodeAndVerify("482913");

      expect(await screen.findByRole("alert")).toHaveTextContent(detail);
      expect(screen.getByRole("button", { name: "Verificar" })).toBeDisabled();

      await userEvent.click(screen.getByRole("link", { name: "Pedí un código nuevo" }));

      expect(await screen.findByRole("textbox", { name: "Número de WhatsApp" })).toBeInTheDocument();
    });

    it.each([
      ["Auth.Account.NotInvited", "Todavía no tenés acceso al sistema. Pedile a un administrador que te dé de alta."],
      ["Auth.Account.Disabled", "Tu cuenta está deshabilitada. Contactá a un administrador."],
    ])("ends the attempt when the account can not sign in (%s)", async (code, detail) => {
      verifyFailsWith(403, { code, detail });
      renderRouteWithProviders(codeUrl, { state: { ...whatsappState, resendAfterSeconds: 0 } });

      await typeCodeAndVerify("482913");

      expect(await screen.findByRole("alert")).toHaveTextContent(detail);
      expect(screen.getByRole("button", { name: "Verificar" })).toBeDisabled();
      expect(screen.getByRole("button", { name: "Reenviar código" })).toBeDisabled();
      expect(screen.getByRole("link", { name: "Volver a ingresar" })).toHaveAttribute("href", loginUrl);
    });

    it("says there were too many requests when sending it again", async () => {
      server.use(
        http.post("/account/login-code/whatsapp", () =>
          HttpResponse.json(
            {
              status: 429,
              code: "Auth.LoginCode.TooManyRequests",
              detail: "Pediste demasiados códigos. Probá de nuevo más tarde.",
              retryAfter: 42,
            },
            { status: 429 },
          ),
        ),
      );
      renderRouteWithProviders(codeUrl, { state: { ...whatsappState, resendAfterSeconds: 0 } });

      await userEvent.click(await screen.findByRole("button", { name: "Reenviar código" }));

      expect(await screen.findByRole("alert")).toHaveTextContent("Pediste demasiados códigos. Probá de nuevo más tarde.");
    });

    it("goes back to /login when the number is missing", async () => {
      const { router } = renderRouteWithProviders(codeUrl, { state: { channel: "whatsapp", resendAfterSeconds: 60 } });

      await waitFor(() => expect(router.state.location.pathname).toBe("/login"));
      expect(screen.queryByRole("heading", { name: "Revisá tu WhatsApp" })).not.toBeInTheDocument();
    });
  });
});
