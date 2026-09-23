import { act, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HttpResponse, http } from "msw";
import type { ReactNode } from "react";
import type { AuthContextProps } from "react-oidc-context";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { loginMethodsQueryKey, type LoginMethods } from "../api/loginCode";
import { queryClient } from "@/shared/api/queryClient";
import { loginMethods } from "@/test/mocks/handlers";
import { server } from "@/test/mocks/server";
import { renderRouteWithProviders } from "@/test/utils/renderWithProviders";

// vi.hoisted porque el vi.mock de abajo se iza arriba de este archivo y ahí el mock todavía no existiría.
const { signinRedirect } = vi.hoisted(() => ({ signinRedirect: vi.fn(() => Promise.resolve()) }));

// Lo único que se mira del OIDC acá es si el ingreso arranca el redirect, como en loginReturnUrl.test.tsx.
vi.mock("react-oidc-context", async () => {
  const actual = await vi.importActual<typeof import("react-oidc-context")>("react-oidc-context");

  type AnonymousAuth = Pick<AuthContextProps, "isAuthenticated" | "isLoading" | "user" | "signinRedirect">;

  const auth: AnonymousAuth = { isAuthenticated: false, isLoading: false, user: undefined, signinRedirect };

  return {
    ...actual,
    AuthProvider: ({ children }: { children?: ReactNode }) => <>{children}</>,
    useAuth: () => auth as AuthContextProps,
  };
});

const authorizeUrl = "/connect/authorize?client_id=web";
const loginUrl = `/login?returnUrl=${encodeURIComponent(authorizeUrl)}`;

const whatsappOn: Partial<LoginMethods> = { whatsapp: true, whatsappCountries: ["AR"], whatsappNumber: "15551632662" };

function withLoginMethods(methods: Partial<LoginMethods>) {
  server.use(http.get("/account/login-methods", () => HttpResponse.json({ ...loginMethods, ...methods })));
}

/// Espera a que la pantalla haya recibido la respuesta de `login-methods`. Sin esto, "no aparece el selector"
/// pasaría también mientras el pedido está en vuelo, y el test no probaría nada.
async function loginMethodsSettled() {
  await waitFor(() => expect(queryClient.getQueryState(loginMethodsQueryKey)?.status).not.toBe("pending"));
  // La consulta le avisa a la pantalla en el tick siguiente.
  await act(() => new Promise((resolve) => setTimeout(resolve, 0)));
}

async function chooseWhatsApp() {
  await userEvent.click(await screen.findByRole("button", { name: "WhatsApp" }));
}

const whatsAppCodeResponse = { resendAfterSeconds: 60, phone: "+5491123456789", maskedPhone: "+54 9 11 •••• 6789" };

describe("LoginPage", () => {
  // AppProviders usa el queryClient de la app (un singleton): sin esto, los medios de ingreso de un test
  // quedarían cacheados para el siguiente.
  beforeEach(() => {
    queryClient.clear();
    globalThis.sessionStorage.clear();
    signinRedirect.mockClear();
  });

  describe("the sign-in methods", () => {
    it("shows only the email when WhatsApp is off", async () => {
      renderRouteWithProviders(loginUrl);

      await loginMethodsSettled();

      expect(screen.queryByRole("group", { name: "Ingresar con" })).not.toBeInTheDocument();
      expect(screen.getByRole("textbox", { name: "Correo electrónico" })).toBeInTheDocument();
      expect(screen.getByRole("link", { name: "Ingresar con Google" })).toBeInTheDocument();
    });

    it("keeps the email sign-in working as always when the methods can not be loaded", async () => {
      server.use(
        http.get("/account/login-methods", () =>
          HttpResponse.json({ status: 500, code: "General.Unexpected" }, { status: 500 }),
        ),
      );
      renderRouteWithProviders(loginUrl);

      await loginMethodsSettled();

      expect(screen.queryByRole("group", { name: "Ingresar con" })).not.toBeInTheDocument();
      expect(screen.getByRole("textbox", { name: "Correo electrónico" })).toBeInTheDocument();
      expect(screen.getByRole("link", { name: "Ingresar con Google" })).toBeInTheDocument();
      // Es un pedido de la pantalla, no uno que la persona hizo: su falla no se anuncia con un aviso.
      expect(screen.queryByText(/ocurrió un error/i)).not.toBeInTheDocument();
    });

    it("offers WhatsApp next to the email, starting with the email", async () => {
      withLoginMethods(whatsappOn);
      renderRouteWithProviders(loginUrl);

      const group = await screen.findByRole("group", { name: "Ingresar con" });

      expect(within(group).getByRole("button", { name: "Correo" })).toHaveAttribute("aria-pressed", "true");
      expect(within(group).getByRole("button", { name: "WhatsApp" })).toHaveAttribute("aria-pressed", "false");
      expect(screen.getByRole("textbox", { name: "Correo electrónico" })).toBeInTheDocument();
    });

    it("asks for the WhatsApp number, with the country on its left", async () => {
      withLoginMethods(whatsappOn);
      renderRouteWithProviders(loginUrl);

      await chooseWhatsApp();

      expect(screen.getByRole("button", { name: "WhatsApp" })).toHaveAttribute("aria-pressed", "true");
      expect(screen.queryByRole("textbox", { name: "Correo electrónico" })).not.toBeInTheDocument();

      const number = screen.getByRole("textbox", { name: "Número de WhatsApp" });
      expect(number).toHaveAttribute("type", "tel");
      expect(number).toHaveAttribute("autocomplete", "tel-national");
      expect(number).toHaveAccessibleDescription("Te mandamos un código por WhatsApp.");
      expect(screen.getByRole("combobox", { name: "País: Argentina, +54" })).toHaveTextContent("AR +54");
      expect(screen.getByRole("button", { name: "Enviar código" })).toBeEnabled();
    });

    it("hides Google only when the server says it is off", async () => {
      withLoginMethods({ google: false });
      renderRouteWithProviders(loginUrl);

      await waitFor(() => expect(screen.queryByRole("link", { name: "Ingresar con Google" })).not.toBeInTheDocument());
      // Sin Google, el separador "o" no separa nada.
      expect(screen.queryByText("o")).not.toBeInTheDocument();
      expect(screen.getByRole("textbox", { name: "Correo electrónico" })).toBeInTheDocument();
    });

    it("comes back with WhatsApp chosen when the code screen asks for it", async () => {
      withLoginMethods(whatsappOn);
      renderRouteWithProviders(loginUrl, { state: { channel: "whatsapp" } });

      expect(await screen.findByRole("textbox", { name: "Número de WhatsApp" })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "WhatsApp" })).toHaveAttribute("aria-pressed", "true");
    });
  });

  describe("the code by WhatsApp", () => {
    it("asks for the code and goes to the code screen with the number the server understood", async () => {
      const bodies: unknown[] = [];
      withLoginMethods(whatsappOn);
      server.use(
        http.post("/account/login-code/whatsapp", async ({ request }) => {
          bodies.push(await request.json());

          return HttpResponse.json(whatsAppCodeResponse, { status: 202 });
        }),
      );
      const { router } = renderRouteWithProviders(loginUrl);

      await chooseWhatsApp();
      await userEvent.type(screen.getByRole("textbox", { name: "Número de WhatsApp" }), "11 2345-6789");
      await userEvent.click(screen.getByRole("button", { name: "Enviar código" }));

      expect(await screen.findByRole("heading", { name: "Revisá tu WhatsApp" })).toBeInTheDocument();
      expect(bodies).toEqual([{ country: "AR", number: "11 2345-6789" }]);
      expect(router.state.location.pathname).toBe("/login/codigo");
      expect(router.state.location.search).toBe(`?returnUrl=${encodeURIComponent(authorizeUrl)}`);
      expect(router.state.location.state).toEqual({
        channel: "whatsapp",
        phone: "+5491123456789",
        maskedPhone: "+54 9 11 •••• 6789",
        resendAfterSeconds: 60,
      });
    });

    it("says the number is not valid when it is sent empty, in place of the hint", async () => {
      const bodies: unknown[] = [];
      withLoginMethods(whatsappOn);
      server.use(
        http.post("/account/login-code/whatsapp", async ({ request }) => {
          bodies.push(await request.json());

          return HttpResponse.json(whatsAppCodeResponse, { status: 202 });
        }),
      );
      renderRouteWithProviders(loginUrl);

      await chooseWhatsApp();
      const number = screen.getByRole("textbox", { name: "Número de WhatsApp" });

      // Se valida al enviar, no al tipear: antes de enviar, la ayuda sigue ahí.
      expect(number).not.toHaveAttribute("aria-invalid");

      await userEvent.click(screen.getByRole("button", { name: "Enviar código" }));

      await waitFor(() => expect(number).toHaveAttribute("aria-invalid", "true"));
      expect(number).toHaveAccessibleDescription("Ingresá un número de celular válido.");
      expect(screen.queryByText("Te mandamos un código por WhatsApp.")).not.toBeInTheDocument();
      expect(bodies).toEqual([]);
    });

    it.each([
      ["Users.Phone.Invalid", "Ingresá un número de celular válido."],
      ["Auth.WhatsApp.CountryNotSupported", "Todavía no mandamos códigos a números de ese país."],
    ])("puts %s under the number, although the server does not name the field", async (code, detail) => {
      withLoginMethods(whatsappOn);
      server.use(
        http.post("/account/login-code/whatsapp", () =>
          HttpResponse.json({ status: 400, code, title: "Solicitud inválida", detail }, { status: 400 }),
        ),
      );
      renderRouteWithProviders(loginUrl);

      await chooseWhatsApp();
      const number = screen.getByRole("textbox", { name: "Número de WhatsApp" });
      await userEvent.type(number, "11 2345");
      await userEvent.click(screen.getByRole("button", { name: "Enviar código" }));

      await waitFor(() => expect(number).toHaveAttribute("aria-invalid", "true"));
      expect(number).toHaveAccessibleDescription(detail);
      expect(screen.queryByText("Te mandamos un código por WhatsApp.")).not.toBeInTheDocument();
    });

    it("waits before asking again after too many codes, like the email", async () => {
      withLoginMethods(whatsappOn);
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
      renderRouteWithProviders(loginUrl);

      await chooseWhatsApp();
      await userEvent.type(screen.getByRole("textbox", { name: "Número de WhatsApp" }), "11 2345-6789");
      await userEvent.click(screen.getByRole("button", { name: "Enviar código" }));

      expect(await screen.findByRole("alert")).toHaveTextContent("Pediste demasiados códigos. Probá de nuevo más tarde.");
      expect(screen.getByRole("button", { name: "Reintentá en 42 s" })).toBeDisabled();
    });
  });

  describe("the code by email", () => {
    it("asks for the code and goes to the code screen with the email, as always", async () => {
      const bodies: unknown[] = [];
      server.use(
        http.post("/account/login-code", async ({ request }) => {
          bodies.push(await request.json());

          return HttpResponse.json({ resendAfterSeconds: 60 }, { status: 202 });
        }),
      );
      const { router } = renderRouteWithProviders(loginUrl);

      await userEvent.type(await screen.findByRole("textbox", { name: "Correo electrónico" }), "ana@example.com");
      await userEvent.click(screen.getByRole("button", { name: "Enviar código" }));

      expect(await screen.findByRole("heading", { name: "Revisá tu correo" })).toBeInTheDocument();
      expect(bodies).toEqual([{ email: "ana@example.com" }]);
      expect(router.state.location.state).toEqual({ channel: "email", email: "ana@example.com", resendAfterSeconds: 60 });
    });
  });

  describe("an error sent back by the server", () => {
    /// El backend manda a `/login?error=<código>` sin `returnUrl` (ExternalLoginEndpoints). La pantalla arranca el
    /// ingreso de nuevo, y el mensaje se ve cuando el servidor vuelve a mandar para acá con el `returnUrl`.
    async function arriveWithError(code: string) {
      const first = renderRouteWithProviders(`/login?error=${encodeURIComponent(code)}`);
      await waitFor(() => expect(signinRedirect).toHaveBeenCalledTimes(1));
      first.unmount();

      return renderRouteWithProviders(loginUrl);
    }

    it("says why the Google sign-in failed", async () => {
      await arriveWithError("Auth.Account.NotInvited");

      expect(await screen.findByRole("alert")).toHaveTextContent(
        "Todavía no tenés acceso al sistema. Pedile a un administrador que te dé de alta.",
      );
    });

    it("has its own text for each known code", async () => {
      await arriveWithError("Auth.ExternalLogin.Failed");

      expect(await screen.findByRole("alert")).toHaveTextContent("No pudimos completar el ingreso con Google.");
    });

    it("has a generic text for a code it does not know", async () => {
      await arriveWithError("Auth.Something.New");

      expect(await screen.findByRole("alert")).toHaveTextContent("No pudimos completar el ingreso. Probá de nuevo.");
    });

    it("shows it only once: the next visit to /login starts clean", async () => {
      const second = await arriveWithError("Auth.Account.Disabled");
      expect(await screen.findByRole("alert")).toHaveTextContent("Tu cuenta está deshabilitada.");
      second.unmount();

      renderRouteWithProviders(loginUrl);

      expect(await screen.findByRole("textbox", { name: "Correo electrónico" })).toBeInTheDocument();
      expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    });

    it("clears it when the form is sent", async () => {
      await arriveWithError("Auth.Account.LockedOut");
      expect(await screen.findByRole("alert")).toHaveTextContent("Tu cuenta está bloqueada por unos minutos");

      // Un correo inválido no llega al servidor: alcanza para ver que enviar el formulario ya lo saca.
      await userEvent.type(screen.getByRole("textbox", { name: "Correo electrónico" }), "ana");
      await userEvent.click(screen.getByRole("button", { name: "Enviar código" }));

      await waitFor(() => expect(screen.queryByText(/bloqueada/)).not.toBeInTheDocument());
    });

    it("also reads it next to the returnUrl, and takes it out of the address when the form is sent", async () => {
      const { router } = renderRouteWithProviders(`${loginUrl}&error=Auth.Account.Disabled`);

      expect(await screen.findByRole("alert")).toHaveTextContent("Tu cuenta está deshabilitada.");
      expect(signinRedirect).not.toHaveBeenCalled();

      await userEvent.type(screen.getByRole("textbox", { name: "Correo electrónico" }), "ana");
      await userEvent.click(screen.getByRole("button", { name: "Enviar código" }));

      // Fuera de la dirección, volver atrás a esta entrada del historial ya no lo muestra de nuevo.
      await waitFor(() => expect(router.state.location.search).toBe(`?returnUrl=${encodeURIComponent(authorizeUrl)}`));
      expect(screen.queryByText(/deshabilitada/)).not.toBeInTheDocument();
    });
  });
});
