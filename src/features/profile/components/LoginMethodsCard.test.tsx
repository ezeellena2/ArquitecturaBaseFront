import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HttpResponse, delay, http } from "msw";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CurrentUser } from "@/auth/useCurrentUser";
import { loginMethodsQueryKey, type LoginMethods } from "@/shared/api/loginMethods";
import { queryClient } from "@/shared/api/queryClient";
import { currentUser, loginMethods, phoneOnlyUser, whatsappLoginMethods } from "@/test/mocks/handlers";
import { server } from "@/test/mocks/server";
import { renderRouteWithProviders } from "@/test/utils/renderWithProviders";

vi.mock("react-oidc-context", async () => {
  const actual = await vi.importActual<typeof import("react-oidc-context")>("react-oidc-context");

  return { ...actual, useAuth: () => ({ isAuthenticated: true, isLoading: false, user: { access_token: "t" } }) };
});

const onlyMethodHint = "Es tu único medio de ingreso: para desvincularlo, primero agregá un correo.";

function withProfile(user: CurrentUser, methods: LoginMethods = loginMethods) {
  server.use(
    http.get("/api/me", () => HttpResponse.json(user)),
    http.get("/account/login-methods", () => HttpResponse.json(methods)),
  );
}

/// La superficie "Medios de ingreso" de `/perfil`, ya con el perfil y los medios de ingreso cargados: antes de
/// eso, que una fila no esté no dice nada.
async function openMethods() {
  renderRouteWithProviders("/perfil");

  const region = await screen.findByRole("region", { name: "Medios de ingreso" });
  await waitFor(() => expect(queryClient.getQueryState(loginMethodsQueryKey)?.status).not.toBe("pending"));

  return within(region);
}

describe("LoginMethodsCard", () => {
  beforeEach(() => {
    queryClient.clear();
  });

  describe("the email row", () => {
    it("shows the email with the Verified badge", async () => {
      withProfile(currentUser);

      const methods = await openMethods();

      expect(methods.getByText("Correo electrónico")).toBeInTheDocument();
      expect(methods.getByText("ana@example.com")).toBeInTheDocument();
      expect(methods.getByText("Verificado")).toBeInTheDocument();
      // No hay "cambiar correo": el correo se agrega una vez, y después es el de la cuenta.
      expect(methods.queryByRole("button", { name: "Agregar correo" })).not.toBeInTheDocument();
    });

    it("shows an email that is not verified without the badge", async () => {
      withProfile({ ...currentUser, emailConfirmed: false });

      const methods = await openMethods();

      expect(methods.getByText("ana@example.com")).toBeInTheDocument();
      expect(methods.queryByText("Verificado")).not.toBeInTheDocument();
    });

    it("offers to add an email when the account has none, and says what it is for", async () => {
      withProfile(phoneOnlyUser);

      const methods = await openMethods();

      expect(methods.getByText("Todavía no agregaste uno.")).toBeInTheDocument();
      expect(methods.getByText("Con un correo recuperás la cuenta si cambiás de número.")).toBeInTheDocument();
      expect(methods.getByRole("button", { name: "Agregar correo" })).toBeInTheDocument();
    });
  });

  describe("the WhatsApp row", () => {
    it("shows the number formatted and verified, never in E.164", async () => {
      withProfile(phoneOnlyUser, whatsappLoginMethods);

      const methods = await openMethods();

      expect(methods.getByText("WhatsApp")).toBeInTheDocument();
      expect(methods.getByText("+54 9 11 2345-6789")).toBeInTheDocument();
      expect(methods.queryByText("+5491123456789")).not.toBeInTheDocument();
      expect(methods.getByText("Verificado")).toBeInTheDocument();
    });

    it("shows a number that is not verified without the badge", async () => {
      withProfile({ ...phoneOnlyUser, phoneNumberConfirmed: false });

      const methods = await openMethods();

      expect(methods.getByText("+54 9 11 2345-6789")).toBeInTheDocument();
      expect(methods.queryByText("Verificado")).not.toBeInTheDocument();
    });

    it("explains instead of offering to unlink when the number is the only way in", async () => {
      withProfile(phoneOnlyUser, whatsappLoginMethods);

      const methods = await openMethods();

      expect(methods.getByText(onlyMethodHint)).toBeInTheDocument();
      expect(methods.queryByRole("button", { name: "Desvincular" })).not.toBeInTheDocument();
    });

    it("counts an email that is not verified as no other way in", async () => {
      // La misma regla que el backend (`UserGuards.HasOtherLoginMethodAsync`): un correo sin verificar no sirve para
      // entrar, así que desvincular dejaría la cuenta sin forma de entrar.
      withProfile({ ...phoneOnlyUser, email: "ana@example.com", emailConfirmed: false });

      const methods = await openMethods();

      expect(methods.getByText(onlyMethodHint)).toBeInTheDocument();
      expect(methods.queryByRole("button", { name: "Desvincular" })).not.toBeInTheDocument();
    });

    it.each([
      ["a verified email", { email: "ana@example.com", emailConfirmed: true }],
      ["Google", { hasGoogleLogin: true }],
    ])("offers to unlink the number when the account also signs in with %s", async (_method, other) => {
      withProfile({ ...phoneOnlyUser, ...other }, whatsappLoginMethods);

      const methods = await openMethods();

      expect(methods.getByRole("button", { name: "Desvincular" })).toBeInTheDocument();
      expect(methods.queryByText(onlyMethodHint)).not.toBeInTheDocument();
    });

    it("offers to link a number when WhatsApp is on and the account has none", async () => {
      withProfile(currentUser, whatsappLoginMethods);

      const methods = await openMethods();

      expect(methods.getByText("WhatsApp")).toBeInTheDocument();
      expect(methods.getByText("Sin vincular")).toBeInTheDocument();
      expect(methods.getByRole("button", { name: "Vincular" })).toBeInTheDocument();
    });

    it("is not there when WhatsApp is off and the account has no number", async () => {
      withProfile(currentUser, loginMethods);

      const methods = await openMethods();

      expect(methods.getByText("ana@example.com")).toBeInTheDocument();
      expect(methods.queryByText("WhatsApp")).not.toBeInTheDocument();
      expect(methods.queryByRole("button", { name: "Vincular" })).not.toBeInTheDocument();
    });

    it("still shows a number with WhatsApp off, so it can be unlinked", async () => {
      withProfile({ ...phoneOnlyUser, email: "ana@example.com", emailConfirmed: true }, loginMethods);

      const methods = await openMethods();

      expect(methods.getByText("+54 9 11 2345-6789")).toBeInTheDocument();
      expect(methods.getByRole("button", { name: "Desvincular" })).toBeInTheDocument();
    });
  });

  describe("unlinking WhatsApp", () => {
    const withEmailAndPhone: CurrentUser = { ...phoneOnlyUser, email: "ana@example.com", emailConfirmed: true };
    const withoutPhone: CurrentUser = {
      ...withEmailAndPhone,
      phoneNumber: null,
      formattedPhoneNumber: null,
      maskedPhoneNumber: null,
      phoneNumberConfirmed: false,
    };

    /// Un `/api/me` que responde `withEmailAndPhone` hasta el DELETE y `after` desde ahí, como el servidor: es lo que
    /// prueba que la pantalla vuelve a pedir el perfil.
    ///
    /// El DELETE tarda un poco, como en la red: la confirmación se cierra antes de que llegue la respuesta, y el foco
    /// vuelve a la fila mientras el pedido sigue en curso. Una respuesta instantánea escondía que el botón de la fila se
    /// apagaba justo en ese momento.
    function unlinkServer({
      after,
      methods = whatsappLoginMethods,
      respond,
    }: {
      after: CurrentUser;
      methods?: LoginMethods;
      respond: () => Response;
    }) {
      const calls = { deletes: 0 };
      let profile = withEmailAndPhone;

      server.use(
        http.get("/api/me", () => HttpResponse.json(profile)),
        http.get("/account/login-methods", () => HttpResponse.json(methods)),
        http.delete("/api/me/whatsapp", async () => {
          calls.deletes++;
          await delay(50);
          profile = after;

          return respond();
        }),
      );

      return calls;
    }

    const unlinked = () => new HttpResponse(null, { status: 204 });
    const lastLoginMethod = () =>
      HttpResponse.json(
        { status: 409, code: "Users.User.LastLoginMethod", detail: "El detalle del servidor." },
        { status: 409 },
      );

    async function confirmUnlink() {
      const methods = await openMethods();
      await userEvent.click(methods.getByRole("button", { name: "Desvincular" }));
      const dialog = await screen.findByRole("dialog", { name: "¿Desvincular tu WhatsApp?" });
      await userEvent.click(within(dialog).getByRole("button", { name: "Desvincular" }));

      return methods;
    }

    it("asks first, saying what is lost with the masked number", async () => {
      withProfile(withEmailAndPhone, whatsappLoginMethods);

      const methods = await openMethods();
      await userEvent.click(methods.getByRole("button", { name: "Desvincular" }));

      const dialog = await screen.findByRole("dialog", { name: "¿Desvincular tu WhatsApp?" });
      expect(dialog).toHaveTextContent(
        "Ya no vas a poder entrar con +54 9 11 •••• 6789 ni desde el chat. Podés volver a vincularlo cuando quieras.",
      );
      expect(within(dialog).getByRole("button", { name: "Cancelar" })).toBeInTheDocument();
      expect(within(dialog).getByRole("button", { name: "Desvincular" })).toBeInTheDocument();
    });

    it("unlinks the number and refreshes the profile", async () => {
      const calls = unlinkServer({ after: withoutPhone, respond: unlinked });

      const methods = await confirmUnlink();

      expect(await screen.findByText("Desvinculamos tu WhatsApp.")).toBeInTheDocument();
      expect(await methods.findByText("Sin vincular")).toBeInTheDocument();
      expect(methods.queryByText("+54 9 11 2345-6789")).not.toBeInTheDocument();
      expect(calls.deletes).toBe(1);
    });

    it("says why it could not unlink the number", async () => {
      // El perfil cargado decía que había un correo verificado, pero el servidor ya no lo tiene (se sacó desde otro
      // lado): gana el servidor. Con el perfil nuevo, la fila explica por qué no se puede.
      unlinkServer({ after: phoneOnlyUser, respond: lastLoginMethod });

      const methods = await confirmUnlink();

      expect(await screen.findByText("El detalle del servidor.")).toBeInTheDocument();
      expect(await methods.findByText(onlyMethodHint)).toBeInTheDocument();
      expect(methods.queryByRole("button", { name: "Desvincular" })).not.toBeInTheDocument();
      expect(methods.getByText("+54 9 11 2345-6789")).toBeInTheDocument();
    });

    describe("where the focus goes", () => {
      // Quien usa el teclado sigue desde donde estaba: si el foco cae en `<body>`, el siguiente Tab arranca desde el
      // principio de la página y el lector de pantalla pierde el lugar.
      const title = () => screen.getByRole("heading", { name: "Medios de ingreso" });

      it("goes back to the row button, which now offers to link", async () => {
        // El botón de la fila no se apaga mientras se desvincula: apagado, no toma el foco que le devuelve el diálogo.
        unlinkServer({ after: withoutPhone, respond: unlinked });

        const methods = await confirmUnlink();

        await waitFor(() => expect(methods.getByRole("button", { name: "Vincular" })).toHaveFocus());
      });

      it("goes to the title of the surface when the row goes away", async () => {
        // Con WhatsApp apagado, una cuenta sin número no tiene fila de WhatsApp.
        unlinkServer({ after: withoutPhone, methods: loginMethods, respond: unlinked });

        const methods = await confirmUnlink();

        await waitFor(() => expect(methods.queryByText("WhatsApp")).not.toBeInTheDocument());
        await waitFor(() => expect(title()).toHaveFocus());
      });

      it("goes to the title of the surface when the server refuses and the button goes away", async () => {
        unlinkServer({ after: phoneOnlyUser, respond: lastLoginMethod });

        const methods = await confirmUnlink();

        expect(await methods.findByText(onlyMethodHint)).toBeInTheDocument();
        await waitFor(() => expect(title()).toHaveFocus());
      });
    });
  });
});
